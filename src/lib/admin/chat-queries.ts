import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

// Session client + RLS, not the admin/service-role client — same
// reasoning as the rest of lib/admin/queries.ts: access is granted by
// the "... admins see all" policies added in the chat migration, scoped
// to is_admin(auth.uid()). Even a bug in the page-level requireAdmin()
// gate couldn't leak another user's conversation, because Postgres
// itself re-checks the caller's role on every query.

export type AdminConversationListItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export async function listConversationsForAdmin(): Promise<AdminConversationListItem[]> {
  const supabase = await getSupabaseSessionClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, user_id, last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c.id);

  // conversations.user_id references auth.users(id), the same as
  // profiles.id — there's no direct FK between conversations and
  // profiles for PostgREST to embed, so this is a second query merged in
  // JS rather than a `.select("profiles(...)")` embed.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in(
      "id",
      conversations.map((c) => c.user_id)
    );
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const { data: lastMessages } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const lastMessageByConversation = new Map<string, { content: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, { content: m.content, created_at: m.created_at });
    }
  }

  const { data: unread } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("sender_role", "user")
    .is("read_at", null);

  const unreadCounts = new Map<string, number>();
  for (const m of unread ?? []) {
    unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) ?? 0) + 1);
  }

  return conversations.map((c) => {
    const profile = profileById.get(c.user_id);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    const last = lastMessageByConversation.get(c.id);
    return {
      id: c.id,
      userId: c.user_id,
      userName: name || profile?.email || "Usuario",
      userEmail: profile?.email ?? null,
      lastMessage: last?.content ?? null,
      lastMessageAt: last?.created_at ?? c.last_message_at,
      unreadCount: unreadCounts.get(c.id) ?? 0,
    };
  });
}

export async function getTotalUnreadForAdmin(): Promise<number> {
  const supabase = await getSupabaseSessionClient();
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_role", "user")
    .is("read_at", null);
  return count ?? 0;
}
