import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const sendPushToUsersMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));
vi.mock("@/lib/push/web-push", () => ({ sendPushToUsers: sendPushToUsersMock }));

const { notifyDevotionalPublished } = await import("./devotionals");

beforeEach(() => {
  store = new FakeStore();
  sendPushToUsersMock.mockReset();
  sendPushToUsersMock.mockResolvedValue({ sent: 0, removed: 0 });
});

describe("notifyDevotionalPublished", () => {
  it("CRITICAL: creates one in-app notification per active user, excluding the author", async () => {
    store.seed("profiles", [
      { id: "ariel-1", status: "active" },
      { id: "user-1", status: "active" },
      { id: "user-2", status: "active" },
      { id: "inactive-1", status: "inactive" },
    ]);

    await notifyDevotionalPublished("devotional-1", "ariel-1");

    const rows = store.tables.notifications ?? [];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.user_id).sort()).toEqual(["user-1", "user-2"]);
    expect(rows[0]).toMatchObject({
      type: "devotional_published",
      resource_id: "devotional-1",
      link_path: "/devocionales/devotional-1",
    });
  });

  it("CRITICAL: never notifies the author about their own publish", async () => {
    store.seed("profiles", [{ id: "ariel-1", status: "active" }]);

    await notifyDevotionalPublished("devotional-1", "ariel-1");

    expect(store.tables.notifications ?? []).toHaveLength(0);
    expect(sendPushToUsersMock).not.toHaveBeenCalled();
  });

  it("sends a push to every notified user, never the author", async () => {
    store.seed("profiles", [
      { id: "ariel-1", status: "active" },
      { id: "user-1", status: "active" },
    ]);

    await notifyDevotionalPublished("devotional-1", "ariel-1");

    expect(sendPushToUsersMock).toHaveBeenCalledWith(["user-1"], {
      title: expect.any(String),
      body: expect.any(String),
      url: "/devocionales/devotional-1",
    });
  });

  it("is a safe no-op when there are no other active users", async () => {
    store.seed("profiles", []);
    await expect(notifyDevotionalPublished("devotional-1", "ariel-1")).resolves.toBeUndefined();
    expect(sendPushToUsersMock).not.toHaveBeenCalled();
  });
});
