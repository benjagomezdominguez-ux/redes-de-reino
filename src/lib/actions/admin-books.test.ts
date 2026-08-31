import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const auditInsertMock = vi.fn();

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
        return { insert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  };
}

vi.mock("@/lib/supabase/require-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => buildAdminClient(),
}));

const { createBook, updateBook, setBookStatus } = await import("./admin-books");

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
    expect(insertedRow.currency).toBe("USD");
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
