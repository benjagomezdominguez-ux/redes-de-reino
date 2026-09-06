import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireUserMock = vi.fn();
const rpcMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({ ...store.client(), rpc: rpcMock }),
}));

const { listMyNotifications, markNotificationRead } = await import("./notifications");

const USER = { id: "user-1", role: "user" as const };

beforeEach(() => {
  store = new FakeStore();
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ error: null });
});

describe("listMyNotifications", () => {
  it("CRITICAL: requires an authenticated session before reading anything", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(listMyNotifications()).rejects.toThrow("REDIRECT");
  });

  it("returns the caller's notifications, most recent first", async () => {
    store.seed("notifications", [
      { id: "n1", type: "devotional_published", title: "Old", body: null, link_path: null, read_at: null, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "n2", type: "devotional_published", title: "New", body: null, link_path: "/devocionales/d2", read_at: null, created_at: "2026-02-01T00:00:00.000Z" },
    ]);

    const result = await listMyNotifications();

    expect(result.map((n) => n.id)).toEqual(["n2", "n1"]);
  });
});

describe("markNotificationRead", () => {
  it("CRITICAL: requires an authenticated session before marking anything", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(markNotificationRead("n1")).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the mark_notification_read RPC with the given id — ownership is enforced inside the RPC, not here", async () => {
    const result = await markNotificationRead("n1");
    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("mark_notification_read", { p_notification_id: "n1" });
  });

  it("returns ok:false when the RPC errors", async () => {
    rpcMock.mockResolvedValue({ error: new Error("boom") });
    const result = await markNotificationRead("n1");
    expect(result).toEqual({ ok: false });
  });
});
