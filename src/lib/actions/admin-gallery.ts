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
  | { ok: false; errorKey: "unauthorized" | "notFound" | "invalidFile" | "alreadyExists" | "generic" };

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

// The gallery is a single photo (Fase 12) — never a second row. The real
// enforcement is the `gallery_images_singleton` unique index in the
// database; this check just turns that into a clean error message
// instead of a raw constraint-violation, and avoids the wasted upload
// when the admin UI is out of date (e.g. a second tab left open).
export async function createGalleryImage(
  storagePath: string,
  metadata: PhotoMetadata
): Promise<GalleryActionResult> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { count } = await admin.from("gallery_images").select("*", { count: "exact", head: true });
  if (count && count > 0) return { ok: false, errorKey: "alreadyExists" };

  const { data, error } = await admin
    .from("gallery_images")
    .insert({
      storage_path: storagePath,
      title: metadata.title.trim().slice(0, MAX_TITLE_LENGTH) || null,
      alt_text: metadata.altText.trim().slice(0, MAX_ALT_LENGTH) || null,
      object_position: metadata.objectPosition.trim() || null,
      sort_order: 0,
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
