import { describe, expect, it, vi, beforeEach } from "vitest";

const getAuthProfileMock = vi.fn();
const rpcMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("@/lib/supabase/get-profile", () => ({ getAuthProfile: getAuthProfileMock }));
vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({ rpc: rpcMock }),
}));

const { recordDevotionalView } = await import("./devotional-views");

const PROFILE = { id: "user-1", email: "user@example.com", firstName: "Juan", lastName: "Perez", role: "user" as const, status: "active" as const };

beforeEach(() => {
  getAuthProfileMock.mockReset();
  rpcMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("recordDevotionalView", () => {
  it("CRITICAL: never calls the RPC for an anonymous visitor (no fabricated identity)", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    await recordDevotionalView("devotional-1");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls record_devotional_view with the devotional id for a signed-in user", async () => {
    getAuthProfileMock.mockResolvedValue(PROFILE);
    rpcMock.mockResolvedValue({ data: null, error: null });
    await recordDevotionalView("devotional-1");
    expect(rpcMock).toHaveBeenCalledWith("record_devotional_view", { p_devotional_id: "devotional-1" });
  });

  it("never throws when the RPC returns an error — a stats write must never break the read page", async () => {
    getAuthProfileMock.mockResolvedValue(PROFILE);
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(recordDevotionalView("devotional-1")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("never throws when getAuthProfile itself throws", async () => {
    getAuthProfileMock.mockRejectedValue(new Error("network down"));
    await expect(recordDevotionalView("devotional-1")).resolves.toBeUndefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("never throws when the session client itself throws", async () => {
    getAuthProfileMock.mockResolvedValue(PROFILE);
    rpcMock.mockImplementation(() => {
      throw new Error("connection reset");
    });
    await expect(recordDevotionalView("devotional-1")).resolves.toBeUndefined();
  });
});
