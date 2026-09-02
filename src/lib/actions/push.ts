"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Web Push is an admin-only feature (only Ariel/admins need OS-level
// notifications — see the chat prompt's own scoping). requireAdmin()
// here is the real gate: push_subscriptions has no client INSERT policy
// at all (see the migration), so this Server Action is the only path
// that can ever write to it, and it never trusts a client-supplied
// "this is Ariel's subscription" claim — the subscription is always
// tied to whichever admin is actually authenticated right now.

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribeToPush(subscriptionJson: unknown): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const parsed = subscriptionSchema.safeParse(subscriptionJson);
  if (!parsed.success) return { ok: false };

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: admin_.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  return { ok: !error };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();
  // Scoped to this admin's own subscription — one admin unsubscribing
  // their browser must never delete a different admin's row, even if
  // they somehow guessed the endpoint URL.
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", admin_.id);
  return { ok: !error };
}
