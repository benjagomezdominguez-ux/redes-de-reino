import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Resolves the real account id of the chat's admin side (Ariel Gómez
// specifically) by querying the actual profiles data — the exact same
// criteria as isChatAdmin()/is_chat_admin(), never a hardcoded UUID. Used
// to determine the push recipient when a conversation's owner (a "user"
// sender) sends a message: the one recipient is whichever real account
// matches this, not any admin, and not anything the client could claim.
export async function getChatAdminId(): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active")
    .ilike("first_name", "ariel%")
    .ilike("last_name", "%gomez%")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
