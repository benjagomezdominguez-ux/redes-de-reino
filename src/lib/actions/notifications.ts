"use server";

import { requireUser } from "@/lib/supabase/require-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

const RECENT_LIMIT = 20;

// Session client + its own RLS ("own rows only") is what actually
// prevents this from ever returning another user's notifications — this
// query simply can't select a row that isn't the caller's.
export async function listMyNotifications(): Promise<NotificationListItem[]> {
  await requireUser();
  const supabase = await getSupabaseSessionClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);

  return data ?? [];
}

// Ownership is enforced inside mark_notification_read() itself (it only
// ever updates a row matching auth.uid()), not by trusting this action's
// caller — same "constrained write via RPC" pattern as
// submit_transfer_proof().
export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  await requireUser();
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
  return { ok: !error };
}
