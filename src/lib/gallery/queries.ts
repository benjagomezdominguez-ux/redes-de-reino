import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type GalleryImageRow = {
  id: string;
  storage_path: string;
  // The mobile-specific (9:16) variant — null until an admin uploads
  // one. storage_path itself always keeps meaning "the desktop/16:9
  // image", exactly as before this field existed.
  mobile_storage_path: string | null;
  title: string | null;
  alt_text: string | null;
  object_position: string | null;
  sort_order: number;
  created_at: string;
};

export type GalleryImageWithUrl = GalleryImageRow & {
  url: string;
  // Null (not a fallback URL) when no mobile variant has been uploaded
  // yet — callers that need a display fallback (the public Gallery
  // section) fall back to `url` themselves; callers that need to know
  // whether a mobile image actually exists (the admin panel) can rely
  // on this being null.
  mobileUrl: string | null;
};

// Single source of truth read by both the public carousel (Gallery.tsx)
// and the admin gallery list — there is no separate "admin view" of this
// data, it's the same public, RLS-readable table either way.
export async function getGalleryImages(): Promise<GalleryImageWithUrl[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("gallery_images")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getGalleryImages failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    url: supabase.storage.from("gallery-photos").getPublicUrl(row.storage_path).data.publicUrl,
    mobileUrl: row.mobile_storage_path
      ? supabase.storage.from("gallery-photos").getPublicUrl(row.mobile_storage_path).data.publicUrl
      : null,
  }));
}
