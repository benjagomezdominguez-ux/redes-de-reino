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

const { sendChatPushToAdmins } = await import("./web-push");

const originalEnv = { ...process.env };

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

describe("sendChatPushToAdmins", () => {
  it("does nothing (never throws) when VAPID isn't configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const result = await sendChatPushToAdmins({ title: "t", body: "b", conversationId: "c1" });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends to every stored admin subscription", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
      { id: "s2", endpoint: "https://push.example.com/2", p256dh: "c", auth_key: "d" },
    ]);
    sendNotificationMock.mockResolvedValue({});

    const result = await sendChatPushToAdmins({ title: "Nuevo mensaje", body: "hola", conversationId: "c1" });

    expect(result).toEqual({ sent: 2, removed: 0 });
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("removes a subscription the push service reports as gone (410), and doesn't let it block the others", async () => {
    store.seed("push_subscriptions", [
      { id: "s1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" },
      { id: "s2", endpoint: "https://push.example.com/2", p256dh: "c", auth_key: "d" },
    ]);
    sendNotificationMock.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/1")) {
        const err = new Error("gone") as Error & { statusCode: number };
        err.statusCode = 410;
        throw err;
      }
      return {};
    });

    const result = await sendChatPushToAdmins({ title: "t", body: "b", conversationId: "c1" });

    expect(result).toEqual({ sent: 1, removed: 1 });
    expect(store.tables.push_subscriptions).toHaveLength(1);
    expect(store.tables.push_subscriptions[0].id).toBe("s2");
  });

  it("does not remove a subscription on a non-410/404 error (transient failure)", async () => {
    store.seed("push_subscriptions", [{ id: "s1", endpoint: "https://push.example.com/1", p256dh: "a", auth_key: "b" }]);
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("server error"), { statusCode: 500 }));

    const result = await sendChatPushToAdmins({ title: "t", body: "b", conversationId: "c1" });

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(store.tables.push_subscriptions).toHaveLength(1);
  });
});
