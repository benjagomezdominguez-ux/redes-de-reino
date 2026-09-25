"use server";

import { requireChatAdmin } from "@/lib/supabase/require-auth";
import { listDevotionalViewers, type DevotionalViewerRow } from "@/lib/admin/devotional-view-queries";
import type { Paginated } from "@/lib/admin/queries";

// The only way the "Ver quiénes lo vieron" panel (a Client Component)
// can ever reach listDevotionalViewers() — requireChatAdmin() runs on
// every call, server-side, exactly like every other devotionals admin
// action (admin-devotionals.ts), never trusting that the button was
// only rendered for Ariel. This is also what actually enforces "a
// regular user can't query another devotional's viewers, or anyone's at
// all": there is no client-reachable path to devotional_views that
// skips this check, and the table itself has no SELECT policy for any
// client role even if there were.
export type GetDevotionalViewersResult =
  | { ok: true; data: Paginated<DevotionalViewerRow> }
  | { ok: false };

export async function getDevotionalViewers(
  devotionalId: string,
  { page, search }: { page: number; search?: string }
): Promise<GetDevotionalViewersResult> {
  await requireChatAdmin();

  try {
    const data = await listDevotionalViewers(devotionalId, { page, search });
    return { ok: true, data };
  } catch (err) {
    console.error("getDevotionalViewers failed", err);
    return { ok: false };
  }
}
