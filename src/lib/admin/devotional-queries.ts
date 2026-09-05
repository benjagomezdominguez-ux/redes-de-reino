import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Admin reads use the admin/service-role client — devotionals has no
// admin-facing SELECT policy for drafts (only "status = published" is
// public), same reason and pattern as listAllProducts() in
// book-queries.ts. Safe here because every caller is already behind
// requireChatAdmin() at the page level.

export type AdminDevotionalRow = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  author_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type AdminDevotionalListRow = AdminDevotionalRow & { authorName: string | null };

export async function listAllDevotionals(): Promise<AdminDevotionalListRow[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("devotionals")
    .select("id, title, content, status, author_id, created_at, updated_at, published_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as AdminDevotionalRow[];

  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, first_name, last_name").in("id", authorIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || null])
  );

  return rows.map((row) => ({
    ...row,
    authorName: row.author_id ? (nameById.get(row.author_id) ?? null) : null,
  }));
}

export async function getDevotionalForEdit(id: string): Promise<AdminDevotionalRow | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("devotionals")
    .select("id, title, content, status, author_id, created_at, updated_at, published_at")
    .eq("id", id)
    .maybeSingle();
  return (data as AdminDevotionalRow) ?? null;
}
