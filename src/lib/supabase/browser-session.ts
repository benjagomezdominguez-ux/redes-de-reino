"use client";

import { createBrowserClient } from "@supabase/ssr";

// Session-aware browser client (reads the same auth cookies as the
// server, via @supabase/ssr's browser helper) — needed for anything a
// Client Component does that RLS must scope to "whoever is actually
// logged in": specifically, Realtime subscriptions on conversations/
// messages. This is different from lib/supabase/browser.ts, whose only
// job is uploadToSignedUrl() with a bare anon-key client that carries no
// session at all (the signed URL's token is its own authorization).
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserSessionClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  }
  return client;
}

// A session restored from cookies (as createBrowserClient does) doesn't
// automatically propagate to the Realtime client's websocket auth —
// confirmed live: a channel subscribed without this first connects
// ("SUBSCRIBED", no error) but silently never receives a single
// RLS-gated postgres_changes event. Calling getSession() forces that
// sync. Every caller that opens a realtime channel must await this
// before calling .channel(...) — see ChatWindow/AdminChatView/
// NotificationBell/ChatNavBadge.
export async function getSupabaseBrowserSessionClientReady() {
  const supabase = getSupabaseBrowserSessionClient();
  await supabase.auth.getSession();
  return supabase;
}
