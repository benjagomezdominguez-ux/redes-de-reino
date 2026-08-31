"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Every action here starts with requireAdmin() — server-side, on every
// call, never trusting that the button was only rendered for an admin
// (rule 1 of the payments prompt: no hidden-button-based authorization).
// Writes use the admin/service-role client on purpose: `products` has no
// insert/update/delete RLS policy for any client role at all (only a
// public "active products" SELECT policy), so this is the only way to
// write it — exactly like every other admin write already in this app.

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 100 * 1024 * 1024;

const bookFieldsSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
  language: z.string().trim().min(2).max(5),
  productType: z.enum(["digital", "fisico", "digital_fisico"]),
  digitalPrice: z.string().trim().optional().or(z.literal("")),
  physicalPrice: z.string().trim().optional().or(z.literal("")),
  stock: z.string().trim().optional().or(z.literal("")),
});

export type AdminBookState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic" | "required" | "invalidFile";
  productId?: string;
};

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "libro"}-${suffix}`;
}

function toCents(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

async function uploadCover(admin: ReturnType<typeof getSupabaseAdminClient>, productId: string, file: File) {
  if (file.size > MAX_COVER_BYTES || !ALLOWED_COVER_TYPES.includes(file.type)) {
    return { error: true as const };
  }
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${productId}/cover-${Date.now()}.${extension}`;
  const { error } = await admin.storage
    .from("book-covers")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: true as const };
  const { data } = admin.storage.from("book-covers").getPublicUrl(path);
  return { error: false as const, url: data.publicUrl };
}

async function uploadDigitalFile(admin: ReturnType<typeof getSupabaseAdminClient>, productId: string, file: File) {
  if (file.size > MAX_FILE_BYTES) {
    return { error: true as const };
  }
  const path = `${productId}/${Date.now()}-${file.name}`;
  const { error } = await admin.storage
    .from("book-files")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) return { error: true as const };
  return { error: false as const, path };
}

export async function createBook(
  _prevState: AdminBookState,
  formData: FormData
): Promise<AdminBookState> {
  const admin_ = await requireAdmin();

  const parsed = bookFieldsSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    description: formData.get("description"),
    category: formData.get("category"),
    language: formData.get("language"),
    productType: formData.get("productType"),
    digitalPrice: formData.get("digitalPrice"),
    physicalPrice: formData.get("physicalPrice"),
    stock: formData.get("stock"),
  });
  if (!parsed.success) {
    return { status: "error", errorKey: "required" };
  }

  const digitalPriceCents = toCents(parsed.data.digitalPrice ?? "");
  const physicalPriceCents = toCents(parsed.data.physicalPrice ?? "");
  const needsDigitalPrice = parsed.data.productType !== "fisico";
  const needsPhysicalPrice = parsed.data.productType !== "digital";
  if ((needsDigitalPrice && digitalPriceCents === null) || (needsPhysicalPrice && physicalPriceCents === null)) {
    return { status: "error", errorKey: "required" };
  }

  const admin = getSupabaseAdminClient();
  const slug = slugify(parsed.data.title);

  const { data: product, error } = await admin
    .from("products")
    .insert({
      slug,
      title: parsed.data.title,
      author: parsed.data.author || null,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      language: parsed.data.language,
      product_type: parsed.data.productType,
      digital_price_cents: needsDigitalPrice ? digitalPriceCents : null,
      physical_price_cents: needsPhysicalPrice ? physicalPriceCents : null,
      currency: "USD",
      stock: needsPhysicalPrice ? Number(parsed.data.stock || 0) : null,
      status: "draft",
    })
    .select()
    .single();

  if (error || !product) {
    return { status: "error", errorKey: "generic" };
  }

  const coverFile = formData.get("cover");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await uploadCover(admin, product.id, coverFile);
    if (result.error) return { status: "error", errorKey: "invalidFile", productId: product.id };
    await admin.from("products").update({ cover_url: result.url }).eq("id", product.id);
  }

  if (needsDigitalPrice) {
    const digitalFile = formData.get("file");
    if (digitalFile instanceof File && digitalFile.size > 0) {
      const result = await uploadDigitalFile(admin, product.id, digitalFile);
      if (result.error) return { status: "error", errorKey: "invalidFile", productId: product.id };
      await admin.from("product_files").insert({
        product_id: product.id,
        storage_path: result.path,
        file_type: digitalFile.type.includes("pdf") ? "pdf" : "file",
      });
    }
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "book_created",
    resource_type: "product",
    resource_id: product.id,
    metadata: { title: parsed.data.title },
  });

  return { status: "success", productId: product.id };
}

export async function updateBook(
  _prevState: AdminBookState,
  formData: FormData
): Promise<AdminBookState> {
  const admin_ = await requireAdmin();
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    return { status: "error", errorKey: "generic" };
  }

  const parsed = bookFieldsSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    description: formData.get("description"),
    category: formData.get("category"),
    language: formData.get("language"),
    productType: formData.get("productType"),
    digitalPrice: formData.get("digitalPrice"),
    physicalPrice: formData.get("physicalPrice"),
    stock: formData.get("stock"),
  });
  if (!parsed.success) {
    return { status: "error", errorKey: "required" };
  }

  const digitalPriceCents = toCents(parsed.data.digitalPrice ?? "");
  const physicalPriceCents = toCents(parsed.data.physicalPrice ?? "");
  const needsDigitalPrice = parsed.data.productType !== "fisico";
  const needsPhysicalPrice = parsed.data.productType !== "digital";
  if ((needsDigitalPrice && digitalPriceCents === null) || (needsPhysicalPrice && physicalPriceCents === null)) {
    return { status: "error", errorKey: "required" };
  }

  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from("products")
    .update({
      title: parsed.data.title,
      author: parsed.data.author || null,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      language: parsed.data.language,
      product_type: parsed.data.productType,
      digital_price_cents: needsDigitalPrice ? digitalPriceCents : null,
      physical_price_cents: needsPhysicalPrice ? physicalPriceCents : null,
      stock: needsPhysicalPrice ? Number(parsed.data.stock || 0) : null,
    })
    .eq("id", productId);

  if (error) {
    return { status: "error", errorKey: "generic" };
  }

  const coverFile = formData.get("cover");
  if (coverFile instanceof File && coverFile.size > 0) {
    const result = await uploadCover(admin, productId, coverFile);
    if (result.error) return { status: "error", errorKey: "invalidFile", productId };
    await admin.from("products").update({ cover_url: result.url }).eq("id", productId);
  }

  // Replacing the digital file keeps the same product_id relationship —
  // existing buyers' entitlements and orders are untouched (rule 33: a
  // file replacement never breaks past purchases). Old file rows for
  // this product are removed so resolveDigitalAccessUrl() always signs
  // the current one; the underlying storage object is left in place
  // rather than deleted, in case it needs to be recovered.
  if (needsDigitalPrice) {
    const digitalFile = formData.get("file");
    if (digitalFile instanceof File && digitalFile.size > 0) {
      const result = await uploadDigitalFile(admin, productId, digitalFile);
      if (result.error) return { status: "error", errorKey: "invalidFile", productId };
      await admin.from("product_files").delete().eq("product_id", productId);
      await admin.from("product_files").insert({
        product_id: productId,
        storage_path: result.path,
        file_type: digitalFile.type.includes("pdf") ? "pdf" : "file",
      });
    }
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "book_updated",
    resource_type: "product",
    resource_id: productId,
    metadata: {},
  });

  return { status: "success", productId };
}

export async function setBookStatus(productId: string, status: "draft" | "active" | "inactive") {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin.from("products").update({ status }).eq("id", productId);
  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: status === "active" ? "book_published" : "book_unpublished",
    resource_type: "product",
    resource_id: productId,
    metadata: { status },
  });
}
