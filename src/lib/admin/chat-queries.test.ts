import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

let store: FakeStore;

// getSupabaseSessionClient() here stands in for "RLS as this specific
// caller" — FakeStore doesn't actually enforce RLS (it's a plain
// in-memory fake), so these tests are about listUsersForNewChat()'s own
// filtering/shaping logic, not about RLS itself (that's proven by the
// real policies + is_chat_admin(), unit-tested at the SQL/migration
// level, not here).
vi.mock("@/lib/supabase/session", () => ({ getSupabaseSessionClient: async () => store.client() }));

const { listUsersForNewChat } = await import("./chat-queries");

beforeEach(() => {
  store = new FakeStore();
});

describe("listUsersForNewChat", () => {
  it("CRITICAL: never lists the chat-admin (Ariel) himself as a candidate to start a chat with", async () => {
    store.seed("profiles", [
      { id: "ariel-1", first_name: "Ariel", last_name: "Gomez", email: "ariel@example.com", role: "admin", status: "active" },
      { id: "user-1", first_name: "Ana", last_name: "Gómez", email: "ana@example.com", role: "user", status: "active" },
    ]);

    const result = await listUsersForNewChat();

    expect(result.map((r) => r.id)).toEqual(["user-1"]);
  });

  it("excludes inactive/deactivated accounts", async () => {
    store.seed("profiles", [
      { id: "user-1", first_name: "Ana", last_name: "Gómez", email: "ana@example.com", role: "user", status: "active" },
      { id: "user-2", first_name: "Old", last_name: "Testeruser", email: "old@example.com", role: "user", status: "inactive" },
    ]);

    const result = await listUsersForNewChat();

    expect(result.map((r) => r.id)).toEqual(["user-1"]);
  });

  it("CRITICAL: correctly flags who already has a conversation, and never invents one for someone who doesn't", async () => {
    store.seed("profiles", [
      { id: "user-1", first_name: "Ana", last_name: "Gómez", email: "ana@example.com", role: "user", status: "active" },
      { id: "user-2", first_name: "Beto", last_name: "Diaz", email: "beto@example.com", role: "user", status: "active" },
    ]);
    store.seed("conversations", [{ id: "conv-1", user_id: "user-1" }]);

    const result = await listUsersForNewChat();

    const ana = result.find((r) => r.id === "user-1");
    const beto = result.find((r) => r.id === "user-2");
    expect(ana?.existingConversationId).toBe("conv-1");
    expect(beto?.existingConversationId).toBeNull();
  });

  it("falls back to the email as a display name when both first/last name are blank", async () => {
    store.seed("profiles", [
      { id: "user-1", first_name: null, last_name: null, email: "noname@example.com", role: "user", status: "active" },
    ]);

    const result = await listUsersForNewChat();

    expect(result[0].name).toBe("noname@example.com");
  });

  it("is a safe empty result when there are no other real users", async () => {
    store.seed("profiles", [
      { id: "ariel-1", first_name: "Ariel", last_name: "Gomez", email: "ariel@example.com", role: "admin", status: "active" },
    ]);

    const result = await listUsersForNewChat();

    expect(result).toEqual([]);
  });
});
