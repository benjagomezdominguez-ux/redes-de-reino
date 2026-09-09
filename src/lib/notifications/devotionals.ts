import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/web-push";

// The notification's own content, not a UI chrome string — like a
// devotional's title/content, it's admin-authored content in whatever
// language Ariel actually writes in, not something that needs es/en/pt
// parity (there is no per-user locale preference stored anywhere in this
// project to even target a translation at).
const TITLE = "El pastor Ariel publicó un nuevo devocional";
const BODY = "Ya puedes leerlo en la Biblioteca de Devocionales.";

// Called only at the moment a devotional genuinely transitions into
// 'published' for the first time (never on edit/draft/delete/republish —
// see the `becomingPublished` checks in admin-devotionals.ts). Notifies
// every active user: one in-app row each (idempotent via the
// (user_id, type, resource_id) unique constraint — upsert with
// ignoreDuplicates makes a second call for the same devotional a no-op
// rather than a duplicate row or an error) plus a real OS push to
// whichever of them have an active subscription.
export async function notifyDevotionalPublished(devotionalId: string, authorId: string): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: profiles } = await admin.from("profiles").select("id").eq("status", "active");
  // Ariel never needs to be notified about his own publish.
  const userIds = (profiles ?? []).map((p) => p.id as string).filter((id) => id !== authorId);
  if (userIds.length === 0) return;

  const linkPath = `/devocionales/${devotionalId}`;

  await admin.from("notifications").upsert(
    userIds.map((userId) => ({
      user_id: userId,
      type: "devotional_published" as const,
      title: TITLE,
      body: BODY,
      link_path: linkPath,
      resource_id: devotionalId,
    })),
    { onConflict: "user_id,type,resource_id", ignoreDuplicates: true }
  );

  // Fire-and-forget on purpose (same reasoning as sendChatPush's callers
  // in chat.ts) — a real fan-out to potentially many push services must
  // never block the publish action itself, and a push failure must never
  // fail the publish or hide the in-app notification that already saved
  // above.
  sendPushToUsers(userIds, { title: TITLE, body: BODY, url: linkPath }).catch((err) =>
    console.error("devotional publish push failed", err)
  );
}

// Real, live-reproduced bug: deleting or unpublishing a devotional left
// its "devotional_published" notification rows in place, still pointing
// at /devocionales/<id>. Clicking one of those old notifications later —
// exactly what several real users' account history shows — hits
// getPublishedDevotionalById(id), finds nothing, and genuinely 404s
// (correctly, per how that page is built; the bug was the stale
// notification existing at all, not the 404 page itself). Called from
// deleteDevotional() and from the unpublish path in
// updateDevotional()/setDevotionalStatus() so this can't recur.
export async function removeDevotionalNotifications(devotionalId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin
    .from("notifications")
    .delete()
    .eq("type", "devotional_published")
    .eq("resource_id", devotionalId);
}
