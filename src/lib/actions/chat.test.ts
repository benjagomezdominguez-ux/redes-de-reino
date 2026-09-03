import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const getAuthProfileMock = vi.fn();
const sendChatPushMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/get-profile", () => ({ getAuthProfile: getAuthProfileMock }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));
vi.mock("@/lib/push/web-push", () => ({ sendChatPush: sendChatPushMock }));

const { getOrCreateConversation, sendMessage, markConversationRead, refreshAdminConversations, getMyUnreadCount } =
  await import("./chat");

const USER = { id: "user-1", email: "user@example.com", firstName: "Ana", lastName: "Gómez", role: "user" as const, status: "active" as const };
const ADMIN = { id: "admin-1", email: "admin@example.com", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };
const INACTIVE_ADMIN = { ...ADMIN, id: "admin-2", status: "inactive" as const };
// A real, different admin account (e.g. the site's original admin/owner)
// — the chat is private to Ariel specifically, so this account must be
// refused exactly like a non-admin would be for anyone else's conversation.
const OTHER_ADMIN = {
  id: "other-admin-1",
  email: "other-admin@example.com",
  firstName: "Benjamin",
  lastName: "Gomez",
  role: "admin" as const,
  status: "active" as const,
};

const CONVERSATION_ID = "conv-1";

beforeEach(() => {
  store = new FakeStore();
  getAuthProfileMock.mockReset();
  sendChatPushMock.mockReset();
  sendChatPushMock.mockResolvedValue({ sent: 0, removed: 0 });
  // getChatAdminId() queries this for real (not mocked) — seed the one
  // real chat-admin account (Ariel) the same way it exists in production,
  // so recipient resolution behaves exactly as it does for real.
  store.seed("profiles", [{ id: ADMIN.id, role: "admin", status: "active", first_name: "Ariel", last_name: "Gomez" }]);
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

  it("CRITICAL: a different real admin (not Ariel) can never send into someone else's conversation — the chat is private to Ariel specifically, not any admin", async () => {
    getAuthProfileMock.mockResolvedValue(OTHER_ADMIN);
    store.seed("conversations", [{ id: "someone-elses-conversation", user_id: "different-user" }]);

    const result = await sendMessage("someone-elses-conversation", "un admin distinto tratando de responder");

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

  it("CRITICAL (regression): an admin who owns THIS conversation (e.g. testing their own /chat) sends as 'user', not 'admin' — sender_role reflects conversation ownership, never just 'is this account an admin somewhere'", async () => {
    store.seed("conversations", [{ id: "ariel-own-conversation", user_id: ADMIN.id }]);
    getAuthProfileMock.mockResolvedValue(ADMIN);

    const result = await sendMessage("ariel-own-conversation", "probando mi propio chat");

    expect(result.status).toBe("success");
    expect(store.tables.messages[0].sender_role).toBe("user");
    // Only a *different* admin replying sets admin_id — the owner
    // messaging their own conversation never does.
    expect(store.tables.conversations.find((c) => c.id === "ariel-own-conversation")!.admin_id).toBeUndefined();
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

  it("a user's message pushes the real chat-admin account (Ariel), never the sender", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    await sendMessage(CONVERSATION_ID, "mensaje de usuario");

    expect(sendChatPushMock).toHaveBeenCalledTimes(1);
    expect(sendChatPushMock.mock.calls[0][0]).toMatchObject({
      recipientId: ADMIN.id,
      senderId: USER.id,
      notification: { conversationId: CONVERSATION_ID },
    });
  });

  it("an admin's reply pushes the conversation's owner (the user), not the admin", async () => {
    getAuthProfileMock.mockResolvedValue(ADMIN);
    await sendMessage(CONVERSATION_ID, "respuesta de admin");

    expect(sendChatPushMock).toHaveBeenCalledTimes(1);
    expect(sendChatPushMock.mock.calls[0][0]).toMatchObject({
      recipientId: USER.id,
      senderId: ADMIN.id,
      notification: { conversationId: CONVERSATION_ID },
    });
  });

  it("CRITICAL: the real bug this fixes — an admin (Ariel) sending inside THEIR OWN conversation never pushes themself", async () => {
    store.seed("conversations", [{ id: "ariel-own-conversation", user_id: ADMIN.id }]);
    getAuthProfileMock.mockResolvedValue(ADMIN);

    const result = await sendMessage("ariel-own-conversation", "probando mi propio chat");

    expect(result.status).toBe("success");
    // The recipient resolves to "the chat admin" (Ariel, via
    // getChatAdminId()) exactly like any user's conversation would — it
    // just happens to be the same account as the sender here, which is
    // exactly what must suppress the push. No sender-specific branching.
    expect(sendChatPushMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: a regular user never pushes themself either — same general rule, different account", async () => {
    // If a user's own conversation somehow had no resolvable chat-admin
    // recipient (e.g. getChatAdminId() finds nothing), no push should be
    // attempted at all — never fall back to notifying the sender.
    store.tables.profiles = [];
    getAuthProfileMock.mockResolvedValue(USER);

    await sendMessage(CONVERSATION_ID, "mensaje de usuario");

    expect(sendChatPushMock).not.toHaveBeenCalled();
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

  it("CRITICAL: a different real admin (not Ariel) cannot mark someone else's conversation as read", async () => {
    getAuthProfileMock.mockResolvedValue(OTHER_ADMIN);
    await markConversationRead(CONVERSATION_ID);

    const m1 = store.tables.messages.find((m) => m.id === "m1")!;
    const m2 = store.tables.messages.find((m) => m.id === "m2")!;
    expect(m1.read_at).toBeNull();
    expect(m2.read_at).toBeNull();
  });

  it("CRITICAL (regression): an admin viewing THEIR OWN conversation marks the admin-side messages as read, same as any other owner would — not the reverse", async () => {
    store.seed("conversations", [{ id: "ariel-own-conversation", user_id: ADMIN.id }]);
    store.seed("messages", [
      { id: "am1", conversation_id: "ariel-own-conversation", sender_role: "admin", read_at: null },
      { id: "am2", conversation_id: "ariel-own-conversation", sender_role: "user", read_at: null },
    ]);
    getAuthProfileMock.mockResolvedValue(ADMIN);

    await markConversationRead("ariel-own-conversation");

    const am1 = store.tables.messages.find((m) => m.id === "am1")!;
    const am2 = store.tables.messages.find((m) => m.id === "am2")!;
    expect(am1.read_at).not.toBeNull(); // the "admin" side message gets marked read...
    expect(am2.read_at).toBeNull(); // ...never their own "user" (owner) message
  });
});

describe("refreshAdminConversations / getMyUnreadCount", () => {
  it("refreshAdminConversations returns nothing for a non-admin, even though the query itself would return everything", async () => {
    getAuthProfileMock.mockResolvedValue(USER);
    const result = await refreshAdminConversations();
    expect(result).toEqual([]);
  });

  it("CRITICAL: refreshAdminConversations returns nothing for a different real admin (not Ariel) — the chat inbox is private to Ariel specifically", async () => {
    getAuthProfileMock.mockResolvedValue(OTHER_ADMIN);
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
