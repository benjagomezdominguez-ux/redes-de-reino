import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl: createSignedUploadUrlMock }) },
  }),
}));

const { submitTransferProof, requestTransferProofUploadUrl } = await import("./payments");

// Mirrors a real <form>: every named field is always present (empty
// string if not filled in) — FormData.get() only returns null for a key
// that was never part of the form at all.
function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("order_id", "");
  formData.set("operation_number", "");
  formData.set("declared_amount", "");
  formData.set("declared_date", "");
  formData.set("proof_path", "");
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

  it("submits declared fields via the submit_transfer_proof RPC, without a proof path", async () => {
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
    expect(result).toEqual({ status: "success" });
  });

  it("passes an already-uploaded proof path through to the RPC", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });

    await submitTransferProof(
      { status: "idle" },
      buildFormData({ order_id: ORDER_ID, proof_path: `${ORDER_ID}/pay-1-abc.png` })
    );

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_proof_storage_path).toBe(`${ORDER_ID}/pay-1-abc.png`);
  });
});

describe("requestTransferProofUploadUrl", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    createSignedUploadUrlMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("CRITICAL: refuses to mint an upload URL for a payment that isn't the caller's own pending bank transfer", async () => {
    mockPaymentLookup(null);

    const result = await requestTransferProofUploadUrl(ORDER_ID, "png");

    expect(result).toEqual({ ok: false });
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("mints a signed upload URL scoped to the order/payment, never touching the file itself", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });
    createSignedUploadUrlMock.mockResolvedValue({
      data: { path: `${ORDER_ID}/pay-1-xyz.png`, token: "signed-token" },
      error: null,
    });

    const result = await requestTransferProofUploadUrl(ORDER_ID, "png");

    expect(result).toEqual({
      ok: true,
      bucket: "payment-proofs",
      path: `${ORDER_ID}/pay-1-xyz.png`,
      token: "signed-token",
    });
  });

  it("returns ok:false if Storage fails to mint the URL", async () => {
    mockPaymentLookup({ id: "pay-1", order_id: ORDER_ID, method: "bank_transfer", status: "pending" });
    createSignedUploadUrlMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await requestTransferProofUploadUrl(ORDER_ID, "png");

    expect(result).toEqual({ ok: false });
  });
});
