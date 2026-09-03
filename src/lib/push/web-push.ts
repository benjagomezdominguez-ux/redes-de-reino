import "server-only";
import webpush from "web-push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Real Web Push (RFC 8030 + VAPID) — no third-party service, no signup,
// just self-generated VAPID keys (see README) and direct HTTPS requests
// to whatever push service each browser subscribed through (Chrome/FCM,
// Firefox's autopush, etc.) via the `web-push` library. This is what
// makes a notification reach an admin even when Redes de Reino isn't
// open in any tab — Notification API alone only works while a tab/page
// is still running in the background, not when the browser has fully
// discarded it.
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
}

function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export type ChatPushPayload = {
  title: string;
  body: string;
  conversationId: string;
};

// Sends only to the given recipient's own saved subscriptions — never
// the sender's. The `recipientId === senderId` check is a second,
// unconditional guard here (on top of whatever resolved the recipient
// upstream in sendMessage()): a message's sender must never receive a
// push for their own message, full stop, regardless of who they are.
// This is what makes the rule general rather than an "if this is Ariel,
// skip it" special case — it holds for any account in that position.
//
// Best-effort and fire-and-forget per subscription — one dead
// subscription must never stop another of the same recipient's devices
// from being notified. A 404/410 response means the push service itself
// says the subscription is dead (browser uninstalled, permission
// revoked, etc.) — those get deleted so they stop being retried forever.
export async function sendChatPush(params: {
  recipientId: string;
  senderId: string;
  notification: ChatPushPayload;
}): Promise<{ sent: number; removed: number }> {
  if (!isPushConfigured()) return { sent: 0, removed: 0 };
  if (params.recipientId === params.senderId) return { sent: 0, removed: 0 };
  configureVapid();

  const admin = getSupabaseAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", params.recipientId);

  let sent = 0;
  let removed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(params.notification)
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          removed += 1;
        } else {
          console.error("web-push send failed", sub.id, status, err instanceof Error ? err.message : err);
        }
      }
    })
  );

  return { sent, removed };
}
