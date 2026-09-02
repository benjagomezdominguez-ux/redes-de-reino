import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const getAuthProfileMock = vi.fn();
const sendChatPushToAdminsMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/get-profile", () => ({ getAuthProfile: getAuthProfileMock }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));
vi.mock("@/lib/push/web-push", () => ({ sendChatPushToAdmins: sendChatPushToAdminsMock }));

const { getOrCreateConversation, sendMessage, markConversationRead, refreshAdminConversations, getMyUnreadCount } =
  await import("./chat");

const USER = { id: "user-1", email: "user@example.com", firstName: "Ana", lastName: "Gómez", role: "user" as const, status: "active" as const };
const ADMIN = { id: "admin-1", email: "admin@example.com", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };
const INACTIVE_ADMIN = { ...ADMIN, id: "admin-2", status: "inactive" as const };

const CONVERSATION_ID = "conv-1";

beforeEach(() => {
  store = new FakeStore();
  getAuthProfileMock.mockReset();
  sendChatPushToAdminsMock.mockReset();
  sendChatPushToAdminsMock.mockResolvedValue({ sent: 0, removed: 0 });
});

describe("getOrCreateConversation", () => {
  it("returns null for an unauthenticated caller", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    expect(await getOrCreateConversation()).toBeNull();
  });

  it("creates a conversation on first contact", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await getOrCreateConversation();
    expect(result).not.toBeNull();
    expect(store.tables.conversations).toHaveLength(1);
    expect(store.tables.conversations[0].user_id).toBe(USER.id);
  });

  it("reuses the existing conversation instead of creating a second one", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    store.seed("conversations", [{ id: CONVERSATION_ID, user_id: USER.id }]);

    const result = await getOrCreateConversation();

    expect(result?.id).toBe(CONVERSATION_ID);
    expect(store.tables.conversations).toHaveLength(1);
  });
});

describe("sendMessage", () => {
  beforeEach(() => {
    store.seed("conversations", [{ id: CONVERSATION_ID, user_id: USER.id }]);
  });

  it("CRITICAL: rejects an unauthenticated caller before writing anything", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    const result = await sendMessage(CONVERSATION_ID, "hola");
    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
    expect(store.tables.messages ?? []).toHaveLength(0);
  });

  it("CRITICAL: a regular user can never send into someone else's conversation", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    store.seed("conversations", [{ id: "someone-elses-conversation", user_id: "different-user" }]);

    const result = await sendMessage("someone-elses-conversation", "trying to snoop");

    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
    expect(store.tables.messages ?? []).toHaveLength(0);
  });

  it("rejects empty content", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await sendMessage(CONVERSATION_ID, "   ");
    expect(result).toEqual({ status: "error", errorKey: "invalidContent" });
  });

  it("rejects content over 4000 characters", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await sendMessage(CONVERSATION_ID, "a".repeat(4001));
    expect(result).toEqual({ status: "error", errorKey: "invalidContent" });
  });

  it("CRITICAL: sender_role is always derived server-side from the real profile, never from a caller-supplied value — a regular user's message is always stored as sender_role 'user'", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await sendMessage(CONVERSATION_ID, "hola Ariel");
    expect(result.status).toBe("success");
    expect(store.tables.messages[0]).toMatchObject({ sender_id: USER.id, sender_role: "user", content: "hola Ariel" });
  });

  it("an active admin's message is stored as sender_role 'admin' and sets conversations.admin_id", async () => {
    getAuthProfileMock.mockResolvedValue(ADMIN);
    const result = await sendMessage(CONVERSATION_ID, "hola, en qué te ayudo?");
    expect(result.status).toBe("success");
    expect(store.tables.messages[0].sender_role).toBe("admin");
    expect(store.tables.conversations[0].admin_id).toBe(ADMIN.id);
  });

  it("a deactivated admin is treated as a regular unauthorized caller, not as admin", async () => {
    getAuthProfileMock.mockResolvedValue(INACTIVE_ADMIN);
    const result = await sendMessage(CONVERSATION_ID, "should not work");
    expect(result).toEqual({ status: "error", errorKey: "unauthorized" });
  });

  it("enforces a rate limit on the sender", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    store.tables.messages = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      conversation_id: CONVERSATION_ID,
      sender_id: USER.id,
      sender_role: "user",
      content: "spam",
      created_at: new Date().toISOString(),
    }));

    const result = await sendMessage(CONVERSATION_ID, "one more");

    expect(result).toEqual({ status: "error", errorKey: "rateLimited" });
  });

  it("notifies admins via push only when the sender is a user, never when an admin replies", async () => {
    getAuthProfileMock.mockResolvedValue(ADMIN);
    await sendMessage(CONVERSATION_ID, "respuesta de admin");
    expect(sendChatPushToAdminsMock).not.toHaveBeenCalled();

    getAuthProfileMock.mockResolvedValue(USER);
    await sendMessage(CONVERSATION_ID, "mensaje de usuario");
    expect(sendChatPushToAdminsMock).toHaveBeenCalledTimes(1);
    expect(sendChatPushToAdminsMock.mock.calls[0][0]).toMatchObject({ conversationId: CONVERSATION_ID });
  });
});

describe("markConversationRead", () => {
  beforeEach(() => {
    store.seed("conversations", [{ id: CONVERSATION_ID, user_id: USER.id }]);
    store.seed("messages", [
      { id: "m1", conversation_id: CONVERSATION_ID, sender_role: "admin", read_at: null },
      { id: "m2", conversation_id: CONVERSATION_ID, sender_role: "user", read_at: null },
    ]);
  });

  it("a user viewing the conversation marks only the admin's messages as read, never their own", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    await markConversationRead(CONVERSATION_ID);

    const m1 = store.tables.messages.find((m) => m.id === "m1")!;
    const m2 = store.tables.messages.find((m) => m.id === "m2")!;
    expect(m1.read_at).not.toBeNull();
    expect(m2.read_at).toBeNull();
  });

  it("an admin viewing the conversation marks only the user's messages as read", async () => {
    getAuthProfileMock.mockResolvedValue(ADMIN);
    await markConversationRead(CONVERSATION_ID);

    const m1 = store.tables.messages.find((m) => m.id === "m1")!;
    const m2 = store.tables.messages.find((m) => m.id === "m2")!;
    expect(m1.read_at).toBeNull();
    expect(m2.read_at).not.toBeNull();
  });

  it("CRITICAL: a user cannot mark another user's conversation as read", async () => {
    getAuthProfileMock.mockResolvedValue({ ...USER, id: "different-user" });
    await markConversationRead(CONVERSATION_ID);

    const m1 = store.tables.messages.find((m) => m.id === "m1")!;
    expect(m1.read_at).toBeNull();
  });
});

describe("refreshAdminConversations / getMyUnreadCount", () => {
  it("refreshAdminConversations returns nothing for a non-admin, even though the query itself would return everything", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await refreshAdminConversations();
    expect(result).toEqual([]);
  });

  it("getMyUnreadCount returns 0 with no conversation id when the user never started a conversation", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await getMyUnreadCount();
    expect(result).toEqual({ conversationId: null, count: 0 });
  });

  it("getMyUnreadCount counts only admin messages the user hasn't read", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    store.seed("conversations", [{ id: CONVERSATION_ID, user_id: USER.id }]);
    store.seed("messages", [
      { id: "m1", conversation_id: CONVERSATION_ID, sender_role: "admin", read_at: null },
      { id: "m2", conversation_id: CONVERSATION_ID, sender_role: "admin", read_at: new Date().toISOString() },
      { id: "m3", conversation_id: CONVERSATION_ID, sender_role: "user", read_at: null },
    ]);

    const result = await getMyUnreadCount();

    expect(result).toEqual({ conversationId: CONVERSATION_ID, count: 1 });
  });
});
