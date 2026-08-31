import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/require-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({ rpc: rpcMock }),
}));

const { confirmBankTransfer, rejectBankTransfer } = await import("./admin-payments");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("confirmBankTransfer / rejectBankTransfer", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    rpcMock.mockReset();
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "admin" });
  });

  it("CRITICAL: calls requireAdmin() before doing anything — a non-admin gate failure stops the action", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));

    await expect(
      confirmBankTransfer({ status: "idle" }, buildFormData({ payment_id: "11111111-1111-1111-1111-111111111111" }))
    ).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("confirms via the admin_confirm_bank_transfer RPC, never a direct table update", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const result = await confirmBankTransfer(
      { status: "idle" },
      buildFormData({ payment_id: "11111111-1111-1111-1111-111111111111", notes: "looks good" })
    );

    expect(rpcMock).toHaveBeenCalledWith("admin_confirm_bank_transfer", {
      p_payment_id: "11111111-1111-1111-1111-111111111111",
      p_notes: "looks good",
    });
    expect(result).toEqual({ status: "success" });
  });

  it("surfaces an error from the RPC (e.g. amount mismatch) without crashing", async () => {
    rpcMock.mockResolvedValue({ error: { message: "Declared amount is less than the amount due" } });

    const result = await confirmBankTransfer(
      { status: "idle" },
      buildFormData({ payment_id: "11111111-1111-1111-1111-111111111111" })
    );

    expect(result).toEqual({ status: "error", errorKey: "generic" });
  });

  it("rejects via the admin_reject_bank_transfer RPC", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const result = await rejectBankTransfer(
      { status: "idle" },
      buildFormData({ payment_id: "11111111-1111-1111-1111-111111111111", notes: "amount doesn't match" })
    );

    expect(rpcMock).toHaveBeenCalledWith("admin_reject_bank_transfer", {
      p_payment_id: "11111111-1111-1111-1111-111111111111",
      p_notes: "amount doesn't match",
    });
    expect(result).toEqual({ status: "success" });
  });
});
