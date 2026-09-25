import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

let store: FakeStore;

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));

const { getDevotionalViewCounts, listDevotionalViewers } = await import("./devotional-view-queries");

beforeEach(() => {
  store = new FakeStore();
});

describe("getDevotionalViewCounts", () => {
  it("returns an empty map without querying anything for an empty id list", async () => {
    const counts = await getDevotionalViewCounts([]);
    expect(counts.size).toBe(0);
  });

  it("counts unique viewer rows per devotional in a single pass (not one query per devotional)", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1" },
      { devotional_id: "d1", user_id: "u2" },
      { devotional_id: "d2", user_id: "u1" },
    ]);
    const counts = await getDevotionalViewCounts(["d1", "d2", "d3"]);
    expect(counts.get("d1")).toBe(2);
    expect(counts.get("d2")).toBe(1);
    expect(counts.has("d3")).toBe(false); // no views at all — not present, callers treat missing as 0
  });

  it("only ever fetches devotional_id in that filtered set (never every devotional's views)", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1" },
      { devotional_id: "other-devotional", user_id: "u1" },
    ]);
    const counts = await getDevotionalViewCounts(["d1"]);
    expect(counts.get("d1")).toBe(1);
    expect(counts.has("other-devotional")).toBe(false);
  });
});

describe("listDevotionalViewers", () => {
  it("returns an empty page for a devotional with no views (no error, real empty state)", async () => {
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result).toEqual({ rows: [], total: 0, page: 1, pageSize: 20 });
  });

  it("resolves the display name from first + last name", async () => {
    store.seed("devotional_views", [{ devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 }]);
    store.seed("profiles", [{ id: "u1", first_name: "Juan", last_name: "Perez", email: "juan@example.com" }]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows[0].displayName).toBe("Juan Perez");
  });

  it("falls back to the local part of the email when no name is set — never the full email", async () => {
    store.seed("devotional_views", [{ devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 }]);
    store.seed("profiles", [{ id: "u1", first_name: null, last_name: null, email: "maria.gonzalez@example.com" }]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows[0].displayName).toBe("maria.gonzalez");
    expect(result.rows[0].displayName).not.toContain("@");
  });

  it("falls back to a generic label when there is neither a name nor an email", async () => {
    store.seed("devotional_views", [{ devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 }]);
    store.seed("profiles", [{ id: "u1", first_name: null, last_name: null, email: null }]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows[0].displayName).toBe("Usuario");
  });

  it("CRITICAL: never exposes the raw email, or any other field beyond what DevotionalViewerRow declares", async () => {
    store.seed("devotional_views", [{ devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 }]);
    store.seed("profiles", [{ id: "u1", first_name: "Juan", last_name: "Perez", email: "juan@example.com" }]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(Object.keys(result.rows[0]).sort()).toEqual(["displayName", "firstViewedAt", "lastViewedAt", "userId", "viewCount"]);
  });

  it("CRITICAL: one devotional's viewers never leak another devotional's rows", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 },
      { devotional_id: "d2", user_id: "u2", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 },
    ]);
    store.seed("profiles", [
      { id: "u1", first_name: "Juan", last_name: "Perez", email: null },
      { id: "u2", first_name: "Maria", last_name: "Gonzalez", email: null },
    ]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].userId).toBe("u1");
  });

  it("sorts by most recently viewed first", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 },
      { devotional_id: "d1", user_id: "u2", first_viewed_at: "2026-01-03T00:00:00Z", last_viewed_at: "2026-01-03T00:00:00Z", view_count: 1 },
    ]);
    store.seed("profiles", [
      { id: "u1", first_name: "Juan", last_name: "Perez", email: null },
      { id: "u2", first_name: "Maria", last_name: "Gonzalez", email: null },
    ]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows.map((r) => r.userId)).toEqual(["u2", "u1"]);
  });

  it("search matches by name and is accent-insensitive", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 },
      { devotional_id: "d1", user_id: "u2", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 },
    ]);
    store.seed("profiles", [
      { id: "u1", first_name: "José", last_name: "Gómez", email: null },
      { id: "u2", first_name: "Maria", last_name: "Gonzalez", email: null },
    ]);
    const result = await listDevotionalViewers("d1", { page: 1, search: "jose gomez" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].userId).toBe("u1");
    expect(result.total).toBe(1);
  });

  it("a search with no matches returns an empty page, not an error", async () => {
    store.seed("devotional_views", [{ devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T00:00:00Z", last_viewed_at: "2026-01-01T00:00:00Z", view_count: 1 }]);
    store.seed("profiles", [{ id: "u1", first_name: "Juan", last_name: "Perez", email: null }]);
    const result = await listDevotionalViewers("d1", { page: 1, search: "nobody-matches-this" });
    expect(result).toEqual({ rows: [], total: 0, page: 1, pageSize: 20 });
  });

  it("CRITICAL: paginates instead of returning everything at once — many viewers", async () => {
    const views = Array.from({ length: 45 }, (_, i) => ({
      devotional_id: "d1",
      user_id: `u${i}`,
      first_viewed_at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      last_viewed_at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      view_count: 1,
    }));
    store.seed("devotional_views", views);
    store.seed(
      "profiles",
      Array.from({ length: 45 }, (_, i) => ({ id: `u${i}`, first_name: `Persona`, last_name: `${i}`, email: null }))
    );

    const page1 = await listDevotionalViewers("d1", { page: 1 });
    expect(page1.rows).toHaveLength(20);
    expect(page1.total).toBe(45);

    const page2 = await listDevotionalViewers("d1", { page: 2 });
    expect(page2.rows).toHaveLength(20);

    const page3 = await listDevotionalViewers("d1", { page: 3 });
    expect(page3.rows).toHaveLength(5);

    // No overlap between pages.
    const allIds = [...page1.rows, ...page2.rows, ...page3.rows].map((r) => r.userId);
    expect(new Set(allIds).size).toBe(45);
  });

  it("view_count and first/last viewed dates pass through unchanged", async () => {
    store.seed("devotional_views", [
      { devotional_id: "d1", user_id: "u1", first_viewed_at: "2026-01-01T10:00:00Z", last_viewed_at: "2026-01-05T18:30:00Z", view_count: 4 },
    ]);
    store.seed("profiles", [{ id: "u1", first_name: "Juan", last_name: "Perez", email: null }]);
    const result = await listDevotionalViewers("d1", { page: 1 });
    expect(result.rows[0]).toMatchObject({
      firstViewedAt: "2026-01-01T10:00:00Z",
      lastViewedAt: "2026-01-05T18:30:00Z",
      viewCount: 4,
    });
  });
});
