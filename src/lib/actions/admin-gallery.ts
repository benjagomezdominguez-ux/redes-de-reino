"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Every action here starts with requireAdmin() — server-side, on every
// call, never trusting that a button was only rendered for an admin.
// Writes use the admin/service-role client on purpose: gallery_images
// has no insert/update/delete RLS policy for any client role (only a
// public SELECT policy), so this is the only way to write it — same
// pattern as every other admin write in this project (products,
// push_subscriptions status, etc).
//
// Photo bytes are never accepted here — see requestGalleryUploadUrl()
// below. The browser uploads directly to Storage via a short-lived
// signed URL (same reason as book covers/files: Next's Server Action
// body limit and Vercel's serverless request-body ceiling).

const BUCKET = "gallery-photos" as const;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_TITLE_LENGTH = 200;
const MAX_ALT_LENGTH = 300;

export type GalleryActionResult =
  | { ok: true }
  | { ok: false; errorKey: "unauthorized" | "notFound" | "invalidFile" | "generic" };

export type GalleryUploadUrlResult =
  | { ok: true; bucket: typeof BUCKET; path: string; token: string }
  | { ok: false };

export async function requestGalleryUploadUrl(extension: string): Promise<GalleryUploadUrlResult> {
  await requireAdmin();

  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(safeExtension)) return { ok: false };

  const path = `${randomUUID()}.${safeExtension}`;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false };

  return { ok: true, bucket: BUCKET, path: data.path, token: data.token };
}

type PhotoMetadata = { title: string; altText: string; objectPosition: string };

export async function createGalleryImage(
  storagePath: string,
  metadata: PhotoMetadata
): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: topRow } = await admin
    .from("gallery_images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (topRow?.sort_order ?? -1) + 1;

  const { data, error } = await admin
    .from("gallery_images")
    .insert({
      storage_path: storagePath,
      title: metadata.title.trim().slice(0, MAX_TITLE_LENGTH) || null,
      alt_text: metadata.altText.trim().slice(0, MAX_ALT_LENGTH) || null,
      object_position: metadata.objectPosition.trim() || null,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "gallery_image_created",
    resource_type: "gallery_image",
    resource_id: data.id,
    metadata: {},
  });

  return { ok: true };
}

export async function updateGalleryImage(id: string, metadata: PhotoMetadata): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { error } = await admin
    .from("gallery_images")
    .update({
      title: metadata.title.trim().slice(0, MAX_TITLE_LENGTH) || null,
      alt_text: metadata.altText.trim().slice(0, MAX_ALT_LENGTH) || null,
      object_position: metadata.objectPosition.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "gallery_image_updated",
    resource_type: "gallery_image",
    resource_id: id,
    metadata: {},
  });

  return { ok: true };
}

// Replaces the photo itself and deletes the OLD storage object — never
// leaves an orphaned file behind.
export async function replaceGalleryImagePhoto(id: string, newStoragePath: string): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin.from("gallery_images").select("storage_path").eq("id", id).maybeSingle();
  if (!existing) return { ok: false, errorKey: "notFound" };
  const oldStoragePath: string = existing.storage_path;

  const { error } = await admin.from("gallery_images").update({ storage_path: newStoragePath }).eq("id", id);
  if (error) return { ok: false, errorKey: "generic" };

  if (oldStoragePath !== newStoragePath) {
    await admin.storage.from(BUCKET).remove([oldStoragePath]);
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "gallery_image_replaced",
    resource_type: "gallery_image",
    resource_id: id,
    metadata: {},
  });

  return { ok: true };
}

export async function deleteGalleryImage(id: string): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin.from("gallery_images").select("storage_path").eq("id", id).maybeSingle();
  if (!existing) return { ok: false, errorKey: "notFound" };
  const storagePath: string = existing.storage_path;

  const { error } = await admin.from("gallery_images").delete().eq("id", id);
  if (error) return { ok: false, errorKey: "generic" };

  // Row is gone first, storage cleanup second — if this fails, we've
  // still correctly removed the carousel entry (no false "still there"
  // state), just with a harmless orphaned object logged for cleanup,
  // rather than the row surviving while claiming to be deleted.
  const { error: storageError } = await admin.storage.from(BUCKET).remove([storagePath]);
  if (storageError) {
    console.error("gallery photo removed from DB but storage cleanup failed", storagePath, storageError);
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "gallery_image_deleted",
    resource_type: "gallery_image",
    resource_id: id,
    metadata: {},
  });

  return { ok: true };
}

export async function moveGalleryImage(id: string, direction: "up" | "down"): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { data: rows, error } = await admin
    .from("gallery_images")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !rows) return { ok: false, errorKey: "generic" };

  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return { ok: false, errorKey: "notFound" };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return { ok: true }; // already at the edge — no-op, not an error

  const currentId: string = rows[index].id;
  const currentOrder: number = rows[index].sort_order;
  const neighborId: string = rows[swapIndex].id;
  const neighborOrder: number = rows[swapIndex].sort_order;

  await admin.from("gallery_images").update({ sort_order: neighborOrder }).eq("id", currentId);
  await admin.from("gallery_images").update({ sort_order: currentOrder }).eq("id", neighborId);

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "gallery_image_reordered",
    resource_type: "gallery_image",
    resource_id: id,
    metadata: { direction },
  });

  return { ok: true };
}
