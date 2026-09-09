import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireChatAdminMock = vi.fn();
const notifyDevotionalPublishedMock = vi.fn();
const removeDevotionalNotificationsMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireChatAdmin: requireChatAdminMock }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));
vi.mock("@/lib/notifications/devotionals", () => ({
  notifyDevotionalPublished: notifyDevotionalPublishedMock,
  removeDevotionalNotifications: removeDevotionalNotificationsMock,
}));

const { createDevotional, updateDevotional, setDevotionalStatus, deleteDevotional } = await import(
  "./admin-devotionals"
);

const ARIEL = { id: "ariel-1", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };

beforeEach(() => {
  store = new FakeStore();
  requireChatAdminMock.mockReset();
  requireChatAdminMock.mockResolvedValue(ARIEL);
  notifyDevotionalPublishedMock.mockReset();
  notifyDevotionalPublishedMock.mockResolvedValue(undefined);
  removeDevotionalNotificationsMock.mockReset();
  removeDevotionalNotificationsMock.mockResolvedValue(undefined);
});

describe("createDevotional", () => {
  it("CRITICAL: requires Ariel specifically before writing anything", async () => {
    requireChatAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(createDevotional({ title: "T", content: "C", status: "draft" })).rejects.toThrow("REDIRECT");
    expect(store.tables.devotionals ?? []).toHaveLength(0);
  });

  it("rejects a blank title or content without writing anything", async () => {
    const result = await createDevotional({ title: "   ", content: "real content", status: "draft" });
    expect(result).toEqual({ ok: false, errorKey: "required" });
    expect(store.tables.devotionals ?? []).toHaveLength(0);
  });

  it("saves a draft with no published_at", async () => {
    const result = await createDevotional({ title: "Fe", content: "Contenido real", status: "draft" });
    expect(result.ok).toBe(true);
    expect(store.tables.devotionals[0]).toMatchObject({ title: "Fe", status: "draft", published_at: null, author_id: ARIEL.id });
  });

  it("stamps published_at when created directly as published", async () => {
    await createDevotional({ title: "Fe", content: "Contenido real", status: "published" });
    expect(store.tables.devotionals[0].published_at).not.toBeNull();
  });

  it("CRITICAL: notifies users when created directly as published", async () => {
    const result = await createDevotional({ title: "Fe", content: "Contenido real", status: "published" });
    expect(result.ok).toBe(true);
    expect(notifyDevotionalPublishedMock).toHaveBeenCalledWith(store.tables.devotionals[0].id, ARIEL.id);
  });

  it("never notifies when saved as a draft", async () => {
    await createDevotional({ title: "Fe", content: "Contenido real", status: "draft" });
    expect(notifyDevotionalPublishedMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: the real authenticated actor is always the author — never a client-supplied value", async () => {
    await createDevotional({ title: "Fe", content: "Contenido real", status: "draft" });
    expect(store.tables.devotionals[0].author_id).toBe(ARIEL.id);
  });

  it("writes an audit_log entry", async () => {
    await createDevotional({ title: "Fe", content: "Contenido real", status: "published" });
    expect(store.tables.audit_log[0]).toMatchObject({ actor_id: ARIEL.id, action: "devotional_published", resource_type: "devotional" });
  });
});

describe("updateDevotional", () => {
  it("returns notFound for a nonexistent devotional", async () => {
    const result = await updateDevotional("ghost", { title: "T", content: "C", status: "draft" });
    expect(result).toEqual({ ok: false, errorKey: "notFound" });
  });

  it("CRITICAL: stamps published_at only when transitioning from draft to published", async () => {
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "draft", published_at: null }]);
    await updateDevotional("d1", { title: "new", content: "new content", status: "published" });
    expect(store.tables.devotionals[0].published_at).not.toBeNull();
  });

  it("CRITICAL: notifies users only on the first draft-to-published transition", async () => {
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "draft", published_at: null }]);
    await updateDevotional("d1", { title: "new", content: "new content", status: "published" });
    expect(notifyDevotionalPublishedMock).toHaveBeenCalledWith("d1", ARIEL.id);
  });

  it("keeps the original published_at when editing an already-published devotional", async () => {
    const originalDate = "2026-01-01T00:00:00.000Z";
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "published", published_at: originalDate }]);
    await updateDevotional("d1", { title: "edited title", content: "edited content", status: "published" });
    expect(store.tables.devotionals[0].published_at).toBe(originalDate);
  });

  it("never re-notifies when editing an already-published devotional", async () => {
    const originalDate = "2026-01-01T00:00:00.000Z";
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "published", published_at: originalDate }]);
    await updateDevotional("d1", { title: "edited title", content: "edited content", status: "published" });
    expect(notifyDevotionalPublishedMock).not.toHaveBeenCalled();
  });

  it("keeps the historical published_at when moving from published back to draft (unpublishing via edit)", async () => {
    const originalDate = "2026-01-01T00:00:00.000Z";
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "published", published_at: originalDate }]);
    await updateDevotional("d1", { title: "old", content: "old", status: "draft" });
    expect(store.tables.devotionals[0].published_at).toBe(originalDate);
    expect(store.tables.devotionals[0].status).toBe("draft");
    expect(notifyDevotionalPublishedMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: unpublishing via edit removes its stale notifications — real bug: an old notification pointing at a now-unpublished devotional 404s when clicked", async () => {
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "published", published_at: "2026-01-01T00:00:00.000Z" }]);
    await updateDevotional("d1", { title: "old", content: "old", status: "draft" });
    expect(removeDevotionalNotificationsMock).toHaveBeenCalledWith("d1");
  });

  it("does not touch notifications when a draft is saved as a draft again (never published)", async () => {
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "draft", published_at: null }]);
    await updateDevotional("d1", { title: "old", content: "old", status: "draft" });
    expect(removeDevotionalNotificationsMock).not.toHaveBeenCalled();
  });

  it("updates the updated_at timestamp and keeps the same id (no duplicate row)", async () => {
    store.seed("devotionals", [{ id: "d1", title: "old", content: "old", status: "draft", published_at: null, updated_at: "2020-01-01T00:00:00.000Z" }]);
    await updateDevotional("d1", { title: "new", content: "new content", status: "draft" });
    expect(store.tables.devotionals).toHaveLength(1);
    expect(store.tables.devotionals[0].id).toBe("d1");
    expect(store.tables.devotionals[0].updated_at).not.toBe("2020-01-01T00:00:00.000Z");
  });
});

describe("setDevotionalStatus", () => {
  it("CRITICAL: requires Ariel specifically", async () => {
    requireChatAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(setDevotionalStatus("d1", "published")).rejects.toThrow("REDIRECT");
  });

  it("publishing a draft stamps published_at and logs devotional_published", async () => {
    store.seed("devotionals", [{ id: "d1", status: "draft", published_at: null }]);
    const result = await setDevotionalStatus("d1", "published");
    expect(result).toEqual({ ok: true });
    expect(store.tables.devotionals[0].status).toBe("published");
    expect(store.tables.devotionals[0].published_at).not.toBeNull();
    expect(store.tables.audit_log[0].action).toBe("devotional_published");
  });

  it("CRITICAL: notifies users when publishing a draft via the status toggle", async () => {
    store.seed("devotionals", [{ id: "d1", status: "draft", published_at: null }]);
    await setDevotionalStatus("d1", "published");
    expect(notifyDevotionalPublishedMock).toHaveBeenCalledWith("d1", ARIEL.id);
  });

  it("unpublishing a published devotional logs devotional_unpublished and preserves published_at", async () => {
    const originalDate = "2026-01-01T00:00:00.000Z";
    store.seed("devotionals", [{ id: "d1", status: "published", published_at: originalDate }]);
    const result = await setDevotionalStatus("d1", "draft");
    expect(result).toEqual({ ok: true });
    expect(store.tables.devotionals[0].status).toBe("draft");
    expect(store.tables.devotionals[0].published_at).toBe(originalDate);
    expect(store.tables.audit_log[0].action).toBe("devotional_unpublished");
  });

  it("never notifies when unpublishing", async () => {
    store.seed("devotionals", [{ id: "d1", status: "published", published_at: "2026-01-01T00:00:00.000Z" }]);
    await setDevotionalStatus("d1", "draft");
    expect(notifyDevotionalPublishedMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: unpublishing removes its stale notifications", async () => {
    store.seed("devotionals", [{ id: "d1", status: "published", published_at: "2026-01-01T00:00:00.000Z" }]);
    await setDevotionalStatus("d1", "draft");
    expect(removeDevotionalNotificationsMock).toHaveBeenCalledWith("d1");
  });

  it("does not touch notifications when publishing (nothing stale to remove)", async () => {
    store.seed("devotionals", [{ id: "d1", status: "draft", published_at: null }]);
    await setDevotionalStatus("d1", "published");
    expect(removeDevotionalNotificationsMock).not.toHaveBeenCalled();
  });

  it("returns ok:false for a nonexistent devotional", async () => {
    const result = await setDevotionalStatus("ghost", "published");
    expect(result).toEqual({ ok: false });
  });
});

describe("deleteDevotional", () => {
  it("CRITICAL: requires Ariel specifically before deleting anything", async () => {
    requireChatAdminMock.mockRejectedValue(new Error("REDIRECT"));
    store.seed("devotionals", [{ id: "d1" }]);
    await expect(deleteDevotional("d1")).rejects.toThrow("REDIRECT");
    expect(store.tables.devotionals).toHaveLength(1);
  });

  it("deletes the row and logs it", async () => {
    store.seed("devotionals", [{ id: "d1", title: "Fe" }]);
    const result = await deleteDevotional("d1");
    expect(result).toEqual({ ok: true });
    expect(store.tables.devotionals).toHaveLength(0);
    expect(store.tables.audit_log[0]).toMatchObject({ action: "devotional_deleted", resource_id: "d1" });
  });

  it("CRITICAL: also removes its stale notifications — real bug: deleting a devotional left old notifications pointing at a dead /devocionales/<id> link, which real users then clicked and got a genuine 404", async () => {
    store.seed("devotionals", [{ id: "d1", title: "Fe" }]);
    await deleteDevotional("d1");
    expect(removeDevotionalNotificationsMock).toHaveBeenCalledWith("d1");
  });

  it("does not attempt notification cleanup for a nonexistent devotional", async () => {
    await deleteDevotional("ghost");
    expect(removeDevotionalNotificationsMock).not.toHaveBeenCalled();
  });

  it("returns notFound-style failure instead of falsely reporting success for a nonexistent devotional", async () => {
    const result = await deleteDevotional("ghost");
    expect(result).toEqual({ ok: false });
  });
});
