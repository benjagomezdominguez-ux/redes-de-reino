import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireUserMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));

const { subscribeToPush, unsubscribeFromPush } = await import("./push");

const USER = { id: "user-1", role: "user" };
const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "test-p256dh-key", auth: "test-auth-key" },
};

beforeEach(() => {
  store = new FakeStore();
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("subscribeToPush", () => {
  it("CRITICAL: requires an authenticated session before storing anything", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(subscribeToPush(VALID_SUBSCRIPTION)).rejects.toThrow("REDIRECT");
    expect(store.tables.push_subscriptions ?? []).toHaveLength(0);
  });

  it("rejects a malformed subscription payload", async () => {
    const result = await subscribeToPush({ endpoint: "not-a-url" });
    expect(result).toEqual({ ok: false });
    expect(store.tables.push_subscriptions ?? []).toHaveLength(0);
  });

  it("stores the subscription tied to the real authenticated user, never a client-supplied user id", async () => {
    const result = await subscribeToPush(VALID_SUBSCRIPTION);
    expect(result).toEqual({ ok: true });
    expect(store.tables.push_subscriptions[0]).toMatchObject({
      user_id: USER.id,
      endpoint: VALID_SUBSCRIPTION.endpoint,
      p256dh: "test-p256dh-key",
      auth_key: "test-auth-key",
    });
  });

  it("re-subscribing the same endpoint upserts instead of creating a duplicate row", async () => {
    await subscribeToPush(VALID_SUBSCRIPTION);
    await subscribeToPush(VALID_SUBSCRIPTION);
    expect(store.tables.push_subscriptions).toHaveLength(1);
  });
});

describe("unsubscribeFromPush", () => {
  it("CRITICAL: only removes the calling user's own subscription, never another user's, even with the same endpoint guessed", async () => {
    store.seed("push_subscriptions", [
      { id: "sub-1", user_id: "other-user", endpoint: VALID_SUBSCRIPTION.endpoint, p256dh: "x", auth_key: "y" },
    ]);

    const result = await unsubscribeFromPush(VALID_SUBSCRIPTION.endpoint);

    expect(result).toEqual({ ok: true });
    expect(store.tables.push_subscriptions).toHaveLength(1); // untouched — belongs to a different user
  });

  it("removes the caller's own subscription", async () => {
    store.seed("push_subscriptions", [
      { id: "sub-1", user_id: USER.id, endpoint: VALID_SUBSCRIPTION.endpoint, p256dh: "x", auth_key: "y" },
    ]);

    await unsubscribeFromPush(VALID_SUBSCRIPTION.endpoint);

    expect(store.tables.push_subscriptions).toHaveLength(0);
  });
});
