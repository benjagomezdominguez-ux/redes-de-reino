import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: { from: () => ({ upload: uploadMock }) },
  }),
}));

const { submitTransferProof } = await import("./payments");

// Mirrors a real <form>: every named field is always present (empty
// string if not filled in) — FormData.get() only returns null for a key
// that was never part of the form at all, which never happens for
// TransferProofForm's own fields.
function buildFormData(fields: Record<string, string | File>) {
  const formData = new FormData();
  formData.set("order_id", "");
  formData.set("operation_number", "");
  formData.set("declared_amount", "");
  formData.set("declared_date", "");
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

function mockPaymentLookup(payment: unknown) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: payment }),
      }),
    }),
  });
}

describe("submitTransferProof", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    uploadMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("rejects an unauthenticated caller before touching anything", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await submitTransferProof({ status: "idle" }, buildFormData({ order_id: ORDER_ID }));

    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: refuses when the payment isn't pending bank_transfer (e.g. already confirmed, or someone else's order)", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "confirmed" });

    const result = await submitTransferProof({ status: "idle" }, buildFormData({ order_id: ORDER_ID }));

    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refuses when the query returns nothing (order not found / not the caller's — enforced by RLS)", async () => {
    mockPaymentLookup(null);

    const result = await submitTransferProof({ status: "idle" }, buildFormData({ order_id: ORDER_ID }));

    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
  });

  it("submits declared fields via the submit_transfer_proof RPC, without a file", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });

    const result = await submitTransferProof(
      { status: "idle" },
      buildFormData({
        order_id: ORDER_ID,
        operation_number: "OP-123",
        declared_amount: "15.00",
        declared_date: "2026-08-31",
      })
    );

    expect(rpcMock).toHaveBeenCalledWith("submit_transfer_proof", {
      p_payment_id: "pay-1",
      p_operation_number: "OP-123",
      p_declared_amount_cents: 1500,
      p_declared_at: "2026-08-31",
      p_proof_storage_path: null,
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "success" });
  });

  it("uploads a valid proof file and passes its storage path to the RPC", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });
    uploadMock.mockResolvedValue({ error: null });

    const file = new File(["fake-image-bytes"], "comprobante.png", { type: "image/png" });
    const result = await submitTransferProof(
      { status: "idle" },
      buildFormData({ order_id: ORDER_ID, proof_file: file })
    );

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_proof_storage_path).toContain(ORDER_ID);
    expect(result).toEqual({ status: "success" });
  });

  it("rejects a file with a disallowed type", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });

    const file = new File(["not an image"], "malware.exe", { type: "application/x-msdownload" });
    const result = await submitTransferProof(
      { status: "idle" },
      buildFormData({ order_id: ORDER_ID, proof_file: file })
    );

    expect(uploadMock).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "error", errorKey: "generic" });
  });
});
