"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Every action here starts with requireAdmin() — server-side, on every
// call, never trusting that the button was only rendered for an admin
// (rule 1 of the payments prompt: no hidden-button-based authorization).
// Writes use the admin/service-role client on purpose: `products` has no
// insert/update/delete RLS policy for any client role at all (only a
// public "active products" SELECT policy), so this is the only way to
// write it — exactly like every other admin write already in this app.
//
// Cover/file bytes are NOT accepted here anymore — see
// requestBookUploadUrl() below. A real book PDF routinely exceeds both
// Next's default 1MB Server Action body limit and Vercel's own ~4.5MB
// hard ceiling on serverless function request bodies; no next.config
// setting can raise the second one. The browser uploads the bytes
// directly to Storage via a short-lived signed URL instead, and only the
// resulting storage path ever reaches this file.

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
  errorKey?: "generic" | "required";
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

function bookFields(formData: FormData) {
  return bookFieldsSchema.safeParse({
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
}

export async function createBook(
  _prevState: AdminBookState,
  formData: FormData
): Promise<AdminBookState> {
  const admin_ = await requireAdmin();
  const parsed = bookFields(formData);
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
      currency: "ARS",
      stock: needsPhysicalPrice ? Number(parsed.data.stock || 0) : null,
      status: "draft",
    })
    .select()
    .single();

  if (error || !product) {
    return { status: "error", errorKey: "generic" };
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

  const parsed = bookFields(formData);
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

export type UploadUrlResult =
  | { ok: true; bucket: "book-covers" | "book-files"; path: string; token: string }
  | { ok: false };

// Mints a short-lived signed upload URL for one file, scoped to this
// product's folder. Called from the browser before the actual bytes are
// sent — the token IS the authorization for that one upload; nothing
// else about this endpoint needs to be secret.
export async function requestBookUploadUrl(
  kind: "cover" | "file",
  productId: string,
  extension: string
): Promise<UploadUrlResult> {
  await requireAdmin();

  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
  const bucket = kind === "cover" ? "book-covers" : "book-files";
  const path = `${productId}/${kind}-${randomUUID()}.${safeExtension}`;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false };
  }

  return { ok: true, bucket, path: data.path, token: data.token };
}

// Called after the browser finishes uploading the cover directly to
// Storage — just records the public URL. Never receives the file itself.
export async function attachBookCover(productId: string, path: string): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data } = admin.storage.from("book-covers").getPublicUrl(path);
  const { error } = await admin.from("products").update({ cover_url: data.publicUrl }).eq("id", productId);

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "book_cover_updated",
    resource_type: "product",
    resource_id: productId,
    metadata: {},
  });

  return { ok: !error };
}

// Same idea for the digital file. Replaces any previous file row for
// this product (rule 33: the storage object itself is left in place,
// only the pointer changes, and existing entitlements/orders reference
// product_id, not this row, so past purchases are unaffected).
export async function attachBookFile(
  productId: string,
  path: string,
  fileType: string
): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  await admin.from("product_files").delete().eq("product_id", productId);
  const { error } = await admin.from("product_files").insert({
    product_id: productId,
    storage_path: path,
    file_type: fileType.includes("pdf") ? "pdf" : "file",
  });

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "book_file_updated",
    resource_type: "product",
    resource_id: productId,
    metadata: {},
  });

  return { ok: !error };
}
