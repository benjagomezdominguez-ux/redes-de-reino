"use server";

import { getAuthProfile, type AuthProfile } from "@/lib/supabase/get-profile";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendChatPushToAdmins } from "@/lib/push/web-push";
import { listConversationsForAdmin, type AdminConversationListItem } from "@/lib/admin/chat-queries";
import { isChatAdmin } from "@/lib/chat/is-chat-admin";

// Every write here goes through the admin/service-role client — messages
// and conversations have SELECT-only RLS policies (see the migration),
// so a Server Action is the ONLY way to write either table. That's what
// actually makes "never trust sender_id/sender_role from the client"
// true: nothing the browser sends is ever used to determine who a
// message is from — only the real authenticated profile, read
// server-side, every single call.

const MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_MAX_MESSAGES = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Returns the caller's own conversation, creating it on first contact —
// never anyone else's. The unique constraint on conversations.user_id is
// the real guarantee here, not just this get-then-insert logic.
export async function getOrCreateConversation(): Promise<{ id: string } | null> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return null;

  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ user_id: profile.id })
    .select("id")
    .single();
  if (error || !created) return null;
  return created;
}

type ConversationAccess = { allowed: boolean; isOwner: boolean };

// Whether `profile` is the conversation's own user, and whether they're
// allowed in at all (owner OR Ariel specifically — not any admin, see
// isChatAdmin), determined together because sendMessage/
// markConversationRead both need "is this the owner?" specifically —
// not just "is this Ariel" — to label things correctly. Ariel's account
// IS a user account too: if he's the owner of this particular
// conversation (e.g. he opened /chat himself), a message he sends there
// is a message from the owner, not "Ariel replying to someone else" —
// those are different things even though it's the same person.
async function getConversationAccess(conversationId: string, profile: AuthProfile): Promise<ConversationAccess> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("conversations").select("user_id").eq("id", conversationId).maybeSingle();
  if (!data) return { allowed: false, isOwner: false };

  const isOwner = data.user_id === profile.id;
  return { allowed: isOwner || isChatAdmin(profile), isOwner };
}

export type SendMessageResult =
  | { status: "success"; messageId: string }
  | { status: "error"; errorKey: "unauthorized" | "invalidContent" | "rateLimited" | "generic" };

export async function sendMessage(conversationId: string, content: string): Promise<SendMessageResult> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return { status: "error", errorKey: "unauthorized" };

  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_MESSAGE_LENGTH) {
    return { status: "error", errorKey: "invalidContent" };
  }

  const access = await getConversationAccess(conversationId, profile);
  if (!access.allowed) {
    return { status: "error", errorKey: "unauthorized" };
  }

  const admin = getSupabaseAdminClient();

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await admin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", profile.id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_MESSAGES) {
    return { status: "error", errorKey: "rateLimited" };
  }

  // The conversation's own owner is always "user", even when that same
  // account also happens to hold the admin role (e.g. Ariel testing his
  // own /chat) — see the comment on getConversationAccess(). Only
  // someone else, an admin stepping in on this conversation, is "admin".
  const senderRole = access.isOwner ? "user" : "admin";

  // content is stored and ever rendered as plain text (React escapes it
  // by default — no dangerouslySetInnerHTML anywhere in the chat UI), so
  // no HTML sanitization step is needed to prevent XSS; the length check
  // above is the only real validation this plain-text field needs.
  const { data: message, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: profile.id, sender_role: senderRole, content: trimmed })
    .select("id")
    .single();
  if (error || !message) return { status: "error", errorKey: "generic" };

  const nowIso = new Date().toISOString();
  await admin
    .from("conversations")
    .update({
      last_message_at: nowIso,
      updated_at: nowIso,
      ...(senderRole === "admin" ? { admin_id: profile.id } : {}),
    })
    .eq("id", conversationId);

  if (senderRole === "user") {
    const senderName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Alguien";
    // Fire-and-forget on purpose — a push failure (or nothing configured
    // yet) must never fail the message send itself.
    sendChatPushToAdmins({
      title: "Nuevo mensaje",
      body: `${senderName}: ${trimmed.slice(0, 120)}`,
      conversationId,
    }).catch((err) => console.error("chat push notify failed", err));
  }

  return { status: "success", messageId: message.id };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return;

  const access = await getConversationAccess(conversationId, profile);
  if (!access.allowed) return;

  const admin = getSupabaseAdminClient();
  // Same ownership-based logic as sendMessage(): the owner reads the
  // admin side's messages; anyone else here is an admin reading the
  // owner's messages.
  const otherPartyRole = access.isOwner ? "admin" : "user";

  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_role", otherPartyRole)
    .is("read_at", null);
}

// Thin "use server" wrapper so the admin chat list (a Client Component,
// for realtime updates) can re-fetch — listConversationsForAdmin() itself
// is a plain server-only function, not directly callable from the
// browser.
export async function refreshAdminConversations(): Promise<AdminConversationListItem[]> {
  const profile = await getAuthProfile();
  if (!isChatAdmin(profile)) return [];
  return listConversationsForAdmin();
}

// For the Navbar's unread badge — deliberately does NOT call
// getOrCreateConversation(): a logged-in visitor who has never opened
// /chat shouldn't get a conversation row created just because the
// Navbar rendered. No conversation yet simply means zero unread.
export async function getMyUnreadCount(): Promise<{ conversationId: string | null; count: number }> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return { conversationId: null, count: 0 };

  const admin = getSupabaseAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!conversation) return { conversationId: null, count: 0 };

  const { count } = await admin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversation.id)
    .eq("sender_role", "admin")
    .is("read_at", null);

  return { conversationId: conversation.id, count: count ?? 0 };
}
