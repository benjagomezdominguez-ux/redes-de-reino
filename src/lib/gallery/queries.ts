import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type GalleryImageRow = {
  id: string;
  storage_path: string;
  title: string | null;
  alt_text: string | null;
  object_position: string | null;
  sort_order: number;
  created_at: string;
};

export type GalleryImageWithUrl = GalleryImageRow & { url: string };

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
  }));
}
