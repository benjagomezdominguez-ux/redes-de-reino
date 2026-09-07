"use server";

import { z } from "zod";
import { requireUser } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Web Push is available to any registered user now (originally private
// to Ariel — the chat admin side still uses these same subscriptions via
// sendChatPush(), unaffected by opening this up). requireUser() here is
// the real gate: push_subscriptions has no client INSERT policy at all
// (see the migration), so this Server Action is the only path that can
// ever write to it, and it never trusts a client-supplied "this is my
// subscription" claim — the subscription is always tied to whichever
// account is actually authenticated right now.

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribeToPush(subscriptionJson: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(subscriptionJson);
  if (!parsed.success) return { ok: false };

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    // Surfaced server-side only (Vercel function logs) — the client only
    // ever sees { ok: false }, never this. No secrets here: just the
    // Postgres error code/message, which is what's actually needed to
    // diagnose a rejected upsert (RLS, constraint, etc).
    console.error("[push] push_subscriptions upsert failed", error.code, error.message);
  }

  return { ok: !error };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const admin = getSupabaseAdminClient();
  // Scoped to this user's own subscription — one user unsubscribing
  // their browser must never delete a different user's row, even if
  // they somehow guessed the endpoint URL.
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: !error };
}
