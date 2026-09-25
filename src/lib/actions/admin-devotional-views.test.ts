import { describe, expect, it, vi, beforeEach } from "vitest";

const requireChatAdminMock = vi.fn();
const listDevotionalViewersMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("@/lib/supabase/require-auth", () => ({ requireChatAdmin: requireChatAdminMock }));
vi.mock("@/lib/admin/devotional-view-queries", () => ({ listDevotionalViewers: listDevotionalViewersMock }));

const { getDevotionalViewers } = await import("./admin-devotional-views");

const ARIEL = { id: "ariel-1", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };

beforeEach(() => {
  requireChatAdminMock.mockReset();
  requireChatAdminMock.mockResolvedValue(ARIEL);
  listDevotionalViewersMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("getDevotionalViewers", () => {
  it("CRITICAL: requires the real devotionals admin (Ariel specifically) before reading anything — a regular user never reaches listDevotionalViewers", async () => {
    requireChatAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(getDevotionalViewers("d1", { page: 1 })).rejects.toThrow("REDIRECT");
    expect(listDevotionalViewersMock).not.toHaveBeenCalled();
  });

  it("returns the paginated data on success", async () => {
    const data = { rows: [], total: 0, page: 1, pageSize: 20 };
    listDevotionalViewersMock.mockResolvedValue(data);
    const result = await getDevotionalViewers("d1", { page: 1 });
    expect(result).toEqual({ ok: true, data });
  });

  it("passes the devotional id, page, and search through unchanged", async () => {
    listDevotionalViewersMock.mockResolvedValue({ rows: [], total: 0, page: 2, pageSize: 20 });
    await getDevotionalViewers("d1", { page: 2, search: "juan" });
    expect(listDevotionalViewersMock).toHaveBeenCalledWith("d1", { page: 2, search: "juan" });
  });

  it("maps a query failure to ok:false instead of throwing — a stats read must never crash the admin page", async () => {
    listDevotionalViewersMock.mockRejectedValue(new Error("db unreachable"));
    const result = await getDevotionalViewers("d1", { page: 1 });
    expect(result).toEqual({ ok: false });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
