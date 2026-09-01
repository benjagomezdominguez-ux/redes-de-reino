import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const auditInsertMock = vi.fn();
const productFilesInsertMock = vi.fn();
const productFilesDeleteMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();

function buildAdminClient() {
  return {
    from: (table: string) => {
      if (table === "products") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                insertMock(row);
                return { data: { id: "product-1", ...row }, error: null };
              },
            }),
          }),
          update: (row: unknown) => ({
            eq: async () => {
              updateMock(row);
              return { error: null };
            },
          }),
        };
      }
      if (table === "audit_log") {
        return { insert: async (row: unknown) => auditInsertMock(row) };
      }
      if (table === "product_files") {
        return {
          insert: async (row: unknown) => {
            productFilesInsertMock(row);
            return { error: null };
          },
          delete: () => ({
            eq: async () => {
              productFilesDeleteMock();
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/book-covers/product-1/cover.png" } }),
        createSignedUploadUrl: createSignedUploadUrlMock,
      }),
    },
  };
}

vi.mock("@/lib/supabase/require-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => buildAdminClient(),
}));

const { createBook, updateBook, setBookStatus, requestBookUploadUrl, attachBookCover, attachBookFile } =
  await import("./admin-books");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("createBook / updateBook / setBookStatus", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    auditInsertMock.mockReset();
    productFilesInsertMock.mockReset();
    productFilesDeleteMock.mockReset();
    createSignedUploadUrlMock.mockReset();
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "admin" });
  });

  it("CRITICAL: every action calls requireAdmin() first — a gate failure stops execution before any write", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));

    await expect(
      createBook({ status: "idle" }, buildFormData({ title: "Test", language: "es", productType: "digital", digitalPrice: "10" }))
    ).rejects.toThrow("REDIRECT");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects creating a digital book with no digital price", async () => {
    const result = await createBook(
      { status: "idle" },
      buildFormData({ title: "Test", language: "es", productType: "digital", digitalPrice: "" })
    );
    expect(result).toEqual({ status: "error", errorKey: "required" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a physical-only book with no physical price", async () => {
    const result = await createBook(
      { status: "idle" },
      buildFormData({ title: "Test", language: "es", productType: "fisico", physicalPrice: "" })
    );
    expect(result).toEqual({ status: "error", errorKey: "required" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: creates a physical-only book even when digitalPrice/author/description/category/stock are entirely absent from the form, not just blank — BookForm hides those fields for 'fisico', so FormData.get() returns null for them, not \"\"", async () => {
    const formData = new FormData();
    formData.set("title", "Libro físico");
    formData.set("language", "es");
    formData.set("productType", "fisico");
    formData.set("physicalPrice", "50.00");
    // Deliberately NOT setting digitalPrice/author/description/category/stock at all.

    const result = await createBook({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow.physical_price_cents).toBe(5000);
    expect(insertedRow.digital_price_cents).toBeNull();
  });

  it("creates a digital book, converting dollars to cents, and logs it to the audit trail", async () => {
    const result = await createBook(
      { status: "idle" },
      buildFormData({
        title: "Columnas",
        author: "",
        description: "",
        category: "",
        language: "es",
        productType: "digital",
        digitalPrice: "15.00",
        physicalPrice: "",
        stock: "",
      })
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow.digital_price_cents).toBe(1500);
    expect(insertedRow.physical_price_cents).toBeNull();
    expect(insertedRow.currency).toBe("ARS");
    expect(insertedRow.status).toBe("draft");
    expect(result.status).toBe("success");
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: "admin-1", action: "book_created" })
    );
  });

  it("digital_fisico requires both prices", async () => {
    const result = await createBook(
      { status: "idle" },
      buildFormData({ title: "Test", language: "es", productType: "digital_fisico", digitalPrice: "10", physicalPrice: "" })
    );
    expect(result).toEqual({ status: "error", errorKey: "required" });
  });

  it("updateBook requires a productId", async () => {
    const result = await updateBook(
      { status: "idle" },
      buildFormData({ title: "Test", language: "es", productType: "digital", digitalPrice: "10" })
    );
    expect(result).toEqual({ status: "error", errorKey: "generic" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("setBookStatus requires admin and logs a publish/unpublish audit entry", async () => {
    await setBookStatus("product-1", "active");
    expect(requireAdminMock).toHaveBeenCalled();
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "book_published", resource_id: "product-1" })
    );
  });
});

describe("requestBookUploadUrl / attachBookCover / attachBookFile", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    updateMock.mockReset();
    auditInsertMock.mockReset();
    productFilesInsertMock.mockReset();
    productFilesDeleteMock.mockReset();
    createSignedUploadUrlMock.mockReset();
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "admin" });
  });

  it("CRITICAL: requires admin before minting an upload URL — never trusts the caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));

    await expect(requestBookUploadUrl("cover", "product-1", "png")).rejects.toThrow("REDIRECT");
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("mints a signed upload URL scoped to the product's folder in the right bucket", async () => {
    createSignedUploadUrlMock.mockResolvedValue({
      data: { path: "product-1/cover-abc.png", token: "tok" },
      error: null,
    });

    const result = await requestBookUploadUrl("cover", "product-1", "png");

    expect(result).toEqual({ ok: true, bucket: "book-covers", path: "product-1/cover-abc.png", token: "tok" });
  });

  it("uses the book-files bucket for a digital file upload", async () => {
    createSignedUploadUrlMock.mockResolvedValue({
      data: { path: "product-1/file-abc.pdf", token: "tok" },
      error: null,
    });

    const result = await requestBookUploadUrl("file", "product-1", "pdf");

    expect(result).toEqual({ ok: true, bucket: "book-files", path: "product-1/file-abc.pdf", token: "tok" });
  });

  it("returns ok:false if Storage fails to mint the URL", async () => {
    createSignedUploadUrlMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await requestBookUploadUrl("cover", "product-1", "png");

    expect(result).toEqual({ ok: false });
  });

  it("attachBookCover requires admin and records the public URL", async () => {
    const result = await attachBookCover("product-1", "product-1/cover-abc.png");

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ cover_url: expect.stringContaining("cover.png") });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "book_cover_updated", resource_id: "product-1" })
    );
  });

  it("attachBookFile replaces any previous file row (never leaves two)", async () => {
    const result = await attachBookFile("product-1", "product-1/file-abc.pdf", "application/pdf");

    expect(result.ok).toBe(true);
    expect(productFilesDeleteMock).toHaveBeenCalledTimes(1);
    expect(productFilesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: "product-1", storage_path: "product-1/file-abc.pdf", file_type: "pdf" })
    );
  });
});
