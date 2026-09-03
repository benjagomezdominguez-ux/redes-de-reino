import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const setVapidDetailsMock = vi.fn();
const sendNotificationMock = vi.fn();
let store: FakeStore;

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));

const { sendChatPush } = await import("./web-push");

const originalEnv = { ...process.env };

const NOTIFICATION = { title: "Nuevo mensaje", body: "hola", conversationId: "c1" };

beforeEach(() => {
  store = new FakeStore();
  setVapidDetailsMock.mockReset();
  sendNotificationMock.mockReset();
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("sendChatPush", () => {
  it("does nothing (never throws) when VAPID isn't configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const result = await sendChatPush({ recipientId: "recipient-1", senderId: "sender-1", notification: NOTIFICATION });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: never sends anything when the recipient is the sender — a message's own sender must never be pushed", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", user_id: "same-person", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
    ]);

    const result = await sendChatPush({ recipientId: "same-person", senderId: "same-person", notification: NOTIFICATION });

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends only to the recipient's own subscriptions, never a different user's", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", user_id: "recipient-1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
      { id: "s2", user_id: "recipient-1", endpoint: "https://push.example.com/2", p256dh: "c", auth_key: "d" },
      { id: "s3", user_id: "someone-else", endpoint: "https://push.example.com/3", p256dh: "e", auth_key: "f" },
    ]);
    sendNotificationMock.mockResolvedValue({});

    const result = await sendChatPush({ recipientId: "recipient-1", senderId: "sender-1", notification: NOTIFICATION });

    expect(result).toEqual({ sent: 2, removed: 0 });
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    const calledEndpoints = sendNotificationMock.mock.calls.map((c) => c[0].endpoint);
    expect(calledEndpoints).toEqual(
      expect.arrayContaining(["https://push.example.com/1", "https://push.example.com/2"])
    );
    expect(calledEndpoints).not.toContain("https://push.example.com/3");
  });

  it("removes a subscription the push service reports as gone (410), and doesn't let it block the others", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", user_id: "recipient-1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
      { id: "s2", user_id: "recipient-1", endpoint: "https://push.example.com/2", p256dh: "c", auth_key: "d" },
    ]);
    sendNotificationMock.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/1")) {
        const err = new Error("gone") as Error & { statusCode: number };
        err.statusCode = 410;
        throw err;
      }
      return {};
    });

    const result = await sendChatPush({ recipientId: "recipient-1", senderId: "sender-1", notification: NOTIFICATION });

    expect(result).toEqual({ sent: 1, removed: 1 });
    expect(store.tables.push_subscriptions).toHaveLength(1);
    expect(store.tables.push_subscriptions[0].id).toBe("s2");
  });

  it("does not remove a subscription on a non-410/404 error (transient failure)", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", user_id: "recipient-1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
    ]);
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("server error"), { statusCode: 500 }));

    const result = await sendChatPush({ recipientId: "recipient-1", senderId: "sender-1", notification: NOTIFICATION });

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(store.tables.push_subscriptions).toHaveLength(1);
  });
});
