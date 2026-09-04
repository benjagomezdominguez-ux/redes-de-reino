import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireAdminMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();
const storageRemoveMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => {
    const client = store.client();
    return {
      ...client,
      storage: {
        from: () => ({
          createSignedUploadUrl: createSignedUploadUrlMock,
          remove: storageRemoveMock,
        }),
      },
    };
  },
}));

const {
  requestGalleryUploadUrl,
  createGalleryImage,
  updateGalleryImage,
  replaceGalleryImagePhoto,
  deleteGalleryImage,
  moveGalleryImage,
} = await import("./admin-gallery");

const ADMIN = { id: "admin-1", role: "admin" as const };

beforeEach(() => {
  store = new FakeStore();
  requireAdminMock.mockReset();
  createSignedUploadUrlMock.mockReset();
  storageRemoveMock.mockReset();
  requireAdminMock.mockResolvedValue(ADMIN);
  storageRemoveMock.mockResolvedValue({ error: null });
});

describe("requestGalleryUploadUrl", () => {
  it("CRITICAL: requires an admin before minting a signed URL", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(requestGalleryUploadUrl("jpg")).rejects.toThrow("REDIRECT");
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("rejects a disallowed extension without ever minting a URL", async () => {
    const result = await requestGalleryUploadUrl("exe");
    expect(result).toEqual({ ok: false });
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("mints a signed upload URL for an allowed image extension", async () => {
    createSignedUploadUrlMock.mockResolvedValue({ data: { path: "abc.jpg", token: "tok" }, error: null });
    const result = await requestGalleryUploadUrl("JPG");
    expect(result).toEqual({ ok: true, bucket: "gallery-photos", path: "abc.jpg", token: "tok" });
  });
});

describe("createGalleryImage", () => {
  it("CRITICAL: requires an admin before writing anything", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(createGalleryImage("path.jpg", { title: "", altText: "", objectPosition: "" })).rejects.toThrow(
      "REDIRECT"
    );
    expect(store.tables.gallery_images ?? []).toHaveLength(0);
  });

  it("inserts at sort_order 0 for the first photo", async () => {
    const result = await createGalleryImage("first.jpg", { title: "Culto", altText: "Foto del culto", objectPosition: "" });
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images[0]).toMatchObject({
      storage_path: "first.jpg",
      title: "Culto",
      alt_text: "Foto del culto",
      sort_order: 0,
    });
  });

  it("appends new photos after the current highest sort_order", async () => {
    store.seed("gallery_images", [{ id: "g1", storage_path: "a.jpg", sort_order: 5 }]);
    await createGalleryImage("b.jpg", { title: "", altText: "", objectPosition: "" });
    const newRow = store.tables.gallery_images.find((r) => r.storage_path === "b.jpg");
    expect(newRow?.sort_order).toBe(6);
  });

  it("blank title/alt/objectPosition are stored as null, not empty strings", async () => {
    await createGalleryImage("x.jpg", { title: "   ", altText: "", objectPosition: "  " });
    expect(store.tables.gallery_images[0]).toMatchObject({ title: null, alt_text: null, object_position: null });
  });

  it("writes an audit_log entry with the real actor id", async () => {
    await createGalleryImage("x.jpg", { title: "", altText: "", objectPosition: "" });
    expect(store.tables.audit_log[0]).toMatchObject({ actor_id: ADMIN.id, action: "gallery_image_created", resource_type: "gallery_image" });
  });
});

describe("updateGalleryImage", () => {
  beforeEach(() => {
    store.seed("gallery_images", [{ id: "g1", storage_path: "a.jpg", title: "old", alt_text: "old alt", object_position: null, sort_order: 0 }]);
  });

  it("updates metadata only — storage_path is never touched", async () => {
    const result = await updateGalleryImage("g1", { title: "new", altText: "new alt", objectPosition: "top" });
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images[0]).toMatchObject({
      storage_path: "a.jpg",
      title: "new",
      alt_text: "new alt",
      object_position: "top",
    });
  });
});

describe("replaceGalleryImagePhoto", () => {
  beforeEach(() => {
    store.seed("gallery_images", [{ id: "g1", storage_path: "old.jpg", sort_order: 0 }]);
  });

  it("CRITICAL: updates storage_path and deletes the OLD file — never leaves an orphan", async () => {
    const result = await replaceGalleryImagePhoto("g1", "new.jpg");
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images[0].storage_path).toBe("new.jpg");
    expect(storageRemoveMock).toHaveBeenCalledWith(["old.jpg"]);
  });

  it("returns notFound for a nonexistent image", async () => {
    const result = await replaceGalleryImagePhoto("ghost", "new.jpg");
    expect(result).toEqual({ ok: false, errorKey: "notFound" });
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });
});

describe("deleteGalleryImage", () => {
  beforeEach(() => {
    store.seed("gallery_images", [{ id: "g1", storage_path: "a.jpg", sort_order: 0 }]);
  });

  it("CRITICAL: deletes the row and the storage object", async () => {
    const result = await deleteGalleryImage("g1");
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images).toHaveLength(0);
    expect(storageRemoveMock).toHaveBeenCalledWith(["a.jpg"]);
  });

  it("returns notFound instead of falsely reporting success for a nonexistent image", async () => {
    const result = await deleteGalleryImage("ghost");
    expect(result).toEqual({ ok: false, errorKey: "notFound" });
  });
});

describe("moveGalleryImage", () => {
  beforeEach(() => {
    store.seed("gallery_images", [
      { id: "g1", sort_order: 0 },
      { id: "g2", sort_order: 1 },
      { id: "g3", sort_order: 2 },
    ]);
  });

  it("swaps sort_order with the previous image when moving up", async () => {
    await moveGalleryImage("g2", "up");
    const g1 = store.tables.gallery_images.find((r) => r.id === "g1")!;
    const g2 = store.tables.gallery_images.find((r) => r.id === "g2")!;
    expect(g2.sort_order).toBe(0);
    expect(g1.sort_order).toBe(1);
  });

  it("swaps sort_order with the next image when moving down", async () => {
    await moveGalleryImage("g2", "down");
    const g2 = store.tables.gallery_images.find((r) => r.id === "g2")!;
    const g3 = store.tables.gallery_images.find((r) => r.id === "g3")!;
    expect(g2.sort_order).toBe(2);
    expect(g3.sort_order).toBe(1);
  });

  it("is a safe no-op when already at the top", async () => {
    const result = await moveGalleryImage("g1", "up");
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images.find((r) => r.id === "g1")!.sort_order).toBe(0);
  });

  it("is a safe no-op when already at the bottom", async () => {
    const result = await moveGalleryImage("g3", "down");
    expect(result).toEqual({ ok: true });
    expect(store.tables.gallery_images.find((r) => r.id === "g3")!.sort_order).toBe(2);
  });
});
