"use server";

import { getAuthProfile } from "@/lib/supabase/get-profile";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

// Called once per devotional read (see RecordDevotionalView.tsx — a tiny
// client component the read page mounts only when a profile exists).
//
// Devotionals are public (anyone, including anonymous visitors, can read
// a published one — see 20260905000000_create_devotionals.sql). This is
// intentionally NOT requireUser(): that would redirect an anonymous
// visitor to /login the moment this fires, which would hijack the very
// page they were already, legitimately, reading. Per the explicit
// design: an anonymous visitor is never given a fabricated identity —
// their view is simply never recorded, and the devotional stays exactly
// as readable as it already was.
//
// Uses the session client (not the admin/service-role client) on
// purpose: record_devotional_view()'s internal auth.uid() needs the real
// caller's JWT to be present to attribute the row to the right person —
// same reasoning as markNotificationRead() in actions/notifications.ts.
//
// Never throws. The devotional's content already rendered before this
// is ever called (see RecordDevotionalView.tsx), and a stats write must
// never be capable of breaking that — same "fire and forget, log and
// swallow" rule already applied to the push fan-out in
// notifyDevotionalPublished().
export async function recordDevotionalView(devotionalId: string): Promise<void> {
  try {
    const profile = await getAuthProfile();
    if (!profile) return;

    const supabase = await getSupabaseSessionClient();
    const { error } = await supabase.rpc("record_devotional_view", { p_devotional_id: devotionalId });
    if (error) console.error("recordDevotionalView failed", error);
  } catch (err) {
    console.error("recordDevotionalView threw", err);
  }
}
