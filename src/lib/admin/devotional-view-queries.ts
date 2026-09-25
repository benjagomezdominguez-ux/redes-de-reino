import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Paginated } from "./queries";

// Admin-only reads, same reasoning and pattern as devotional-queries.ts
// (admin): devotional_views has NO SELECT policy for any client role at
// all (see the migration), so these always use the admin/service-role
// client. Safe here because every caller is already behind
// requireChatAdmin() — getDevotionalViewCounts() at the devotionals list
// page itself, listDevotionalViewers() one layer further behind the
// getDevotionalViewers() Server Action in actions/admin-devotional-
// views.ts (the client Drawer can only ever reach this through that
// action, never directly).

// One query for however many devotionals are on the list page — not one
// COUNT per row. devotional_id is the only column selected (no name/
// email/anything else travels for this call), then grouped in JS.
export async function getDevotionalViewCounts(devotionalIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (devotionalIds.length === 0) return counts;

  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("devotional_views").select("devotional_id").in("devotional_id", devotionalIds);

  for (const row of (data ?? []) as { devotional_id: string }[]) {
    counts.set(row.devotional_id, (counts.get(row.devotional_id) ?? 0) + 1);
  }
  return counts;
}

export type DevotionalViewerRow = {
  userId: string;
  // Never the raw email — resolved here, server-side, to a safe display
  // name (first + last name, or the local part of the email as a last
  // resort) so a bare email address never even reaches the client.
  displayName: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
};

const PAGE_SIZE = 20;

// Accent-insensitive search ("gomez" also matches "Gómez") — same fold
// already applied to name matching in is-chat-admin.ts, kept as its own
// small copy here rather than importing that module's private helper
// (that one is specifically the "is this Ariel" check, deliberately
// self-contained and comment-pinned to stay in lockstep with its SQL
// mirror; this is a plain search box with no security meaning).
function foldEsAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function displayNameFor(profile: { first_name: string | null; last_name: string | null; email: string | null }): string {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (profile.email) return profile.email.split("@")[0];
  return "Usuario";
}

// Fetches every view row for this ONE devotional (a single, narrow,
// devotional_id-indexed query — never all devotionals at once), resolves
// names via a second targeted query (the same "fetch, then map profiles
// in one extra IN() call" shape already used by listAllDevotionals()'s
// author name lookup — PostgREST can't embed profiles through
// devotional_views.user_id -> auth.users.id -> profiles.id in one call,
// same reason that lookup isn't a single embedded select there either),
// then filters/sorts/paginates in memory. At this app's real scale (a
// single congregation's devotionals) that's a couple of round trips
// moving, at most, a few hundred small rows — not the "fetch everything
// to render a count" problem this was written to avoid; the client only
// ever receives one page's worth of rows either way.
export async function listDevotionalViewers(
  devotionalId: string,
  { page, search = "" }: { page: number; search?: string }
): Promise<Paginated<DevotionalViewerRow>> {
  const admin = getSupabaseAdminClient();

  const { data: views } = await admin
    .from("devotional_views")
    .select("user_id, first_viewed_at, last_viewed_at, view_count")
    .eq("devotional_id", devotionalId)
    .order("last_viewed_at", { ascending: false });

  const rows = (views ?? []) as { user_id: string; first_viewed_at: string; last_viewed_at: string; view_count: number }[];
  if (rows.length === 0) return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name, email").in("id", userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  let merged: DevotionalViewerRow[] = rows.map((r) => {
    const profile = profileById.get(r.user_id) ?? { first_name: null, last_name: null, email: null };
    return {
      userId: r.user_id,
      displayName: displayNameFor(profile as { first_name: string | null; last_name: string | null; email: string | null }),
      firstViewedAt: r.first_viewed_at,
      lastViewedAt: r.last_viewed_at,
      viewCount: r.view_count,
    };
  });

  const term = foldEsAccents(search.trim());
  if (term) merged = merged.filter((v) => foldEsAccents(v.displayName).includes(term));

  const total = merged.length;
  const from = (page - 1) * PAGE_SIZE;
  const paged = merged.slice(from, from + PAGE_SIZE);

  return { rows: paged, total, page, pageSize: PAGE_SIZE };
}
