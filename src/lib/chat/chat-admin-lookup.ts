import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isChatAdmin } from "@/lib/chat/is-chat-admin";

// Resolves the real account id of the chat's admin side (Ariel Gómez
// specifically) by reusing isChatAdmin() directly against every active
// admin — the single TS source of truth for "who is Ariel" (mirrored in
// SQL by is_chat_admin() for RLS). This used to be a second, hand-
// duplicated ilike query living only in this file with its own copy of
// the matching rule — an audit flagged that as a real desync risk
// (nothing enforced the two stayed in agreement if only one were ever
// edited). Reusing isChatAdmin() here removes that risk outright rather
// than just keeping two copies carefully in sync. The candidate list is
// always small (real admin accounts on this site), so filtering in
// application code costs nothing meaningful. Never a hardcoded UUID.
export async function getChatAdminId(): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("id, first_name, last_name").eq("role", "admin").eq("status", "active");
  const match = (data ?? []).find((p) =>
    isChatAdmin({ role: "admin", status: "active", firstName: p.first_name, lastName: p.last_name })
  );
  return match?.id ?? null;
}
