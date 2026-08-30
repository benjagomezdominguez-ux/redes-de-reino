import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const entitlementSelectMock = vi.fn();
const productFilesSelectMock = vi.fn();
const createSignedUrlMock = vi.fn();

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "digital_entitlements") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: entitlementSelectMock,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === "product_files") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: productFilesSelectMock,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}));

const { resolveDigitalAccessUrl } = await import("./digital-access");

const BUYER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";
const PRODUCT_ID = "33333333-3333-3333-3333-333333333333";

describe("resolveDigitalAccessUrl — critical access control (rule 56)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    entitlementSelectMock.mockReset();
    productFilesSelectMock.mockReset();
    createSignedUrlMock.mockReset();
  });

  it("denies an unauthenticated visitor", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({ granted: false, reason: "unauthenticated" });
    expect(entitlementSelectMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: denies a logged-in user who bought a different product (or nothing)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: OTHER_USER_ID } } });
    // The session client is RLS-scoped to auth.uid(), so a query for this
    // product legitimately returns nothing for a non-buyer.
    entitlementSelectMock.mockResolvedValue({ data: null });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({ granted: false, reason: "no_entitlement" });
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it("denies access when the order's payment was never confirmed (no entitlement exists)", async () => {
    // Same shape as the "other user" case — a pending/failed order never
    // produces a digital_entitlements row (only grant_digital_access(),
    // called from a real confirmed-payment path, does).
    getUserMock.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    entitlementSelectMock.mockResolvedValue({ data: null });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({ granted: false, reason: "no_entitlement" });
  });

  it("denies access if the entitlement exists but the file record is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    entitlementSelectMock.mockResolvedValue({ data: { id: "ent-1" } });
    productFilesSelectMock.mockResolvedValue({ data: null });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({ granted: false, reason: "no_file" });
  });

  it("grants a short-lived signed URL to the legitimate buyer", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    entitlementSelectMock.mockResolvedValue({ data: { id: "ent-1" } });
    productFilesSelectMock.mockResolvedValue({
      data: { storage_path: "book-1/file.pdf" },
    });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/book-1/file.pdf?token=abc" },
      error: null,
    });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({
      granted: true,
      url: "https://signed.example/book-1/file.pdf?token=abc",
    });
    expect(createSignedUrlMock).toHaveBeenCalledWith("book-1/file.pdf", 60);
  });

  it("denies access when signing the URL fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: BUYER_ID } } });
    entitlementSelectMock.mockResolvedValue({ data: { id: "ent-1" } });
    productFilesSelectMock.mockResolvedValue({
      data: { storage_path: "book-1/file.pdf" },
    });
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "storage unavailable" },
    });

    const result = await resolveDigitalAccessUrl(PRODUCT_ID);

    expect(result).toEqual({ granted: false, reason: "no_file" });
  });
});
