import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase/require-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({ rpc: rpcMock }),
}));

const { deactivateUser, reactivateUser } = await import("./admin-users");

const ADMIN = { id: "admin-1", email: "admin@example.com", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };
const TARGET_USER_ID = "user-1";

beforeEach(() => {
  requireAdminMock.mockReset();
  rpcMock.mockReset();
  requireAdminMock.mockResolvedValue(ADMIN);
});

describe("deactivateUser", () => {
  it("CRITICAL: refuses to target the acting admin themself, without ever calling the RPC", async () => {
    const result = await deactivateUser(ADMIN.id);
    expect(result).toEqual({ ok: false, errorKey: "cannotTargetSelf" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the RPC with the real admin-derived request, never a client-controlled actor", async () => {
    rpcMock.mockResolvedValue({ data: { changed: true, status: "inactive" }, error: null });
    const result = await deactivateUser(TARGET_USER_ID);

    expect(rpcMock).toHaveBeenCalledWith("admin_set_user_status", {
      p_target_user_id: TARGET_USER_ID,
      p_new_status: "inactive",
    });
    expect(result).toEqual({ ok: true, changed: true });
  });

  it("is idempotent: deactivating an already-inactive user reports changed: false, not an error", async () => {
    rpcMock.mockResolvedValue({ data: { changed: false, status: "inactive" }, error: null });
    const result = await deactivateUser(TARGET_USER_ID);
    expect(result).toEqual({ ok: true, changed: false });
  });

  it("CRITICAL: maps the database's cannot_target_admin refusal to a typed error, never silently succeeding", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "cannot_target_admin" } });
    const result = await deactivateUser("some-other-admin");
    expect(result).toEqual({ ok: false, errorKey: "cannotTargetAdmin" });
  });

  it("maps a nonexistent target to notFound", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "user_not_found" } });
    const result = await deactivateUser("ghost-id");
    expect(result).toEqual({ ok: false, errorKey: "notFound" });
  });

  it("CRITICAL: maps a database-level authorization refusal to a typed error, not a thrown/leaked internal error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "not_authorized" } });
    const result = await deactivateUser(TARGET_USER_ID);
    expect(result).toEqual({ ok: false, errorKey: "unauthorized" });
  });

  it("maps any other database error to a generic key, never exposing the raw message", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "connection reset by peer" } });
    const result = await deactivateUser(TARGET_USER_ID);
    expect(result).toEqual({ ok: false, errorKey: "generic" });
  });

  it("CRITICAL: requireAdmin() is called before anything else — a non-admin caller never reaches the RPC", async () => {
    requireAdminMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
    await expect(deactivateUser(TARGET_USER_ID)).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("reactivateUser", () => {
  it("calls the RPC with p_new_status: active", async () => {
    rpcMock.mockResolvedValue({ data: { changed: true, status: "active" }, error: null });
    const result = await reactivateUser(TARGET_USER_ID);

    expect(rpcMock).toHaveBeenCalledWith("admin_set_user_status", {
      p_target_user_id: TARGET_USER_ID,
      p_new_status: "active",
    });
    expect(result).toEqual({ ok: true, changed: true });
  });

  it("also refuses self-targeting", async () => {
    const result = await reactivateUser(ADMIN.id);
    expect(result).toEqual({ ok: false, errorKey: "cannotTargetSelf" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("is idempotent: reactivating an already-active user reports changed: false", async () => {
    rpcMock.mockResolvedValue({ data: { changed: false, status: "active" }, error: null });
    const result = await reactivateUser(TARGET_USER_ID);
    expect(result).toEqual({ ok: true, changed: false });
  });
});
