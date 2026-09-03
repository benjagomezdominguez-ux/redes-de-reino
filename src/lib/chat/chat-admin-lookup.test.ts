import { describe, expect, it, beforeEach, vi } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

let store: FakeStore;
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));

const { getChatAdminId } = await import("./chat-admin-lookup");

beforeEach(() => {
  store = new FakeStore();
});

describe("getChatAdminId", () => {
  it("finds the real chat-admin account by the same criteria as isChatAdmin(), never a hardcoded id", async () => {
    store.seed("profiles", [
      { id: "other-admin", role: "admin", status: "active", first_name: "Benjamin", last_name: "Gomez" },
      { id: "ariel-id", role: "admin", status: "active", first_name: "ariel", last_name: "gomez" },
      { id: "inactive-user", role: "user", status: "active", first_name: "Ariel", last_name: "Gomez" },
    ]);

    expect(await getChatAdminId()).toBe("ariel-id");
  });

  it("returns null when no account matches", async () => {
    store.seed("profiles", [{ id: "someone", role: "admin", status: "active", first_name: "Juan", last_name: "Perez" }]);
    expect(await getChatAdminId()).toBeNull();
  });

  it("does not match a deactivated Ariel Gomez account", async () => {
    store.seed("profiles", [{ id: "ariel-id", role: "admin", status: "inactive", first_name: "Ariel", last_name: "Gomez" }]);
    expect(await getChatAdminId()).toBeNull();
  });
});
