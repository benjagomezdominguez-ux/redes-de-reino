"use server";

import { getAuthProfile, type AuthProfile } from "@/lib/supabase/get-profile";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendChatPush } from "@/lib/push/web-push";
import {
  listConversationsForAdmin,
  listUsersForNewChat,
  type AdminConversationListItem,
  type NewChatCandidate,
} from "@/lib/admin/chat-queries";
import { isChatAdmin } from "@/lib/chat/is-chat-admin";
import { getChatAdminId } from "@/lib/chat/chat-admin-lookup";

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
//
// Never creates one for the chat-admin (Ariel) — a real bug found by
// audit: nothing used to stop him from ending up "the owner" of his own
// conversation (e.g. by opening /chat like any regular user), which then
// silently became a dead end no other user could ever discover or reply
// into. /chat itself now redirects him away before this is ever called
// (see chat/page.tsx), but this is the defense-in-depth guarantee at the
// one function that can actually create the broken state, for any other
// caller now or in the future.
export async function getOrCreateConversation(): Promise<{ id: string } | null> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active") return null;
  if (isChatAdmin(profile)) return null;

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

export type AdminStartConversationResult =
  | { ok: true; conversationId: string }
  | { ok: false; errorKey: "unauthorized" | "invalidTarget" | "generic" };

// Lets Ariel start a conversation with any real, active, registered user
// — even one who has never written to him first. Reuses the exact same
// conversations table/shape as getOrCreateConversation() above (one row
// per non-admin user, unique on user_id): this is deliberately NOT a
// second conversation system, just a second, admin-only way to arrive at
// the same row. Idempotent — selecting an already-messaged user finds
// and returns their existing conversation rather than creating a
// duplicate, same guarantee getOrCreateConversation() gives a user
// opening /chat more than once.
//
// requireChatAdmin()-equivalent check first, unconditionally: the
// targetUserId a client sends is never trusted as-is — every property
// that makes a target valid (exists, active, not the chat-admin himself)
// is re-verified here against the real profiles row, server-side, every
// call.
export async function adminStartConversation(targetUserId: string): Promise<AdminStartConversationResult> {
  const profile = await getAuthProfile();
  if (!profile || profile.status !== "active" || !isChatAdmin(profile)) {
    return { ok: false, errorKey: "unauthorized" };
  }

  const admin = getSupabaseAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, first_name, last_name, role, status")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target || target.status !== "active") {
    return { ok: false, errorKey: "invalidTarget" };
  }
  // Never a conversation with himself, or with some other account that
  // happens to also match the chat-admin name pattern — same rule
  // getOrCreateConversation() enforces for the "user opens /chat" side.
  if (
    isChatAdmin({
      role: target.role,
      status: target.status,
      firstName: target.first_name,
      lastName: target.last_name,
    })
  ) {
    return { ok: false, errorKey: "invalidTarget" };
  }

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (existing) return { ok: true, conversationId: existing.id };

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ user_id: targetUserId })
    .select("id")
    .single();
  if (error || !created) return { ok: false, errorKey: "generic" };

  return { ok: true, conversationId: created.id };
}

type ConversationAccess = { allowed: boolean; isOwner: boolean; ownerId: string | null };

// Whether `profile` is the conversation's own user, and whether they're
// allowed in at all (owner OR Ariel specifically — not any admin, see
// isChatAdmin), determined together because sendMessage/
// markConversationRead both need "is this the owner?" specifically —
// not just "is this Ariel" — to label things correctly. `ownerId` is
// also returned — sendMessage() needs the real owner's id to resolve who
// the OTHER party is when an admin (not the owner) sends.
//
// Ariel can no longer end up owning a conversation (getOrCreateConversation()
// refuses to create one for him, and /chat redirects him to /admin/chat
// before ever calling it) — historically he could, which is exactly what
// caused a real bug: his replies, sent while accidentally "the owner",
// went into a dead-end conversation only he could see. `isOwner` staying
// possible-in-principle here (rather than asserting it can't happen) is
// deliberate belt-and-braces: this function must still behave correctly
// against whatever a conversation row actually says, not just against
// what "should" be true upstream.
async function getConversationAccess(conversationId: string, profile: AuthProfile): Promise<ConversationAccess> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("conversations").select("user_id").eq("id", conversationId).maybeSingle();
  if (!data) return { allowed: false, isOwner: false, ownerId: null };

  const isOwner = data.user_id === profile.id;
  return { allowed: isOwner || isChatAdmin(profile), isOwner, ownerId: data.user_id };
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

  // The conversation's own owner is always "user" — see the comment on
  // getConversationAccess(). Only someone else, an admin stepping in on
  // this conversation, is "admin".
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

  // The one authorized recipient, resolved entirely server-side from real
  // data — never a client-supplied id/role: the conversation's owner and
  // the real chat-admin account (Ariel, via getChatAdminId()) are the
  // only two possible parties, and whichever one is NOT the sender is
  // the recipient. sendChatPush() itself refuses recipientId === senderId
  // as a second guard, so a sender never gets pushed their own message —
  // a general rule, not a special case for any one account.
  const recipientId = access.isOwner ? await getChatAdminId() : access.ownerId;
  // Diagnostic only — ids, not message content. Helps answer "who sent,
  // who should receive, did we even attempt a push" without guessing.
  console.log(
    `[chat push] sender=${profile.id} isOwner=${access.isOwner} recipient=${recipientId ?? "null"} conversation=${conversationId}`
  );
  if (recipientId && recipientId !== profile.id) {
    const senderName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Alguien";
    // Real bug fixed here: the service worker has no notion of "role",
    // so it can't tell a chat push meant for Ariel apart from one meant
    // for a regular user just from conversationId alone — it used to
    // always send whoever clicked the notification to /admin/chat,
    // which 403s/redirects a regular user (requireChatAdmin()-gated).
    // The URL is computed HERE instead, where the recipient's identity
    // is actually known: access.isOwner true means the sender is the
    // conversation's own user, so the recipient is the chat-admin
    // (Ariel) — otherwise the recipient is the conversation's user.
    const url = access.isOwner ? `/admin/chat?conversation=${conversationId}` : "/chat";
    // Fire-and-forget on purpose — a push failure (or nothing configured
    // yet) must never fail the message send itself.
    sendChatPush({
      recipientId,
      senderId: profile.id,
      notification: {
        title: "Nuevo mensaje",
        body: `${senderName}: ${trimmed.slice(0, 120)}`,
        conversationId,
        url,
      },
    }).catch((err) => console.error("chat push notify failed", err));
  } else {
    console.log(`[chat push] skipped — recipientId=${recipientId ?? "null"} senderId=${profile.id}`);
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

// Same reasoning as refreshAdminConversations() above — the "start a new
// chat" user picker (a Client Component) needs a callable wrapper around
// the plain server-only listUsersForNewChat().
export async function listUsersToStartChat(): Promise<NewChatCandidate[]> {
  const profile = await getAuthProfile();
  if (!isChatAdmin(profile)) return [];
  return listUsersForNewChat();
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
