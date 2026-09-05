import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PublishedDevotional = {
  id: string;
  title: string;
  content: string;
  published_at: string | null;
  created_at: string;
};

// Public reads. RLS ("Anyone can view published devotionals") already
// makes it impossible for this anon-key client to ever see a draft row —
// the explicit .eq("status", "published") below is a second, redundant
// layer, not the only thing standing between a visitor and a draft.
export async function getPublishedDevotionals(): Promise<PublishedDevotional[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("devotionals")
    .select("id, title, content, published_at, created_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("getPublishedDevotionals failed", error);
    return [];
  }

  return data ?? [];
}

export async function getPublishedDevotionalById(id: string): Promise<PublishedDevotional | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("devotionals")
    .select("id, title, content, published_at, created_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("getPublishedDevotionalById failed", error);
    return null;
  }

  return data;
}
