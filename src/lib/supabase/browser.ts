"use client";

import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe in the browser bundle by design. This
// client's ONLY job is uploadToSignedUrl(): it never reads/writes
// anything on its own authority. The actual authorization for each
// upload comes from the short-lived token an admin-gated Server Action
// minted server-side (createSignedUploadUrl) — this client just carries
// the bytes straight to Storage, bypassing the Server Action body limit
// entirely (Next.js's default 1MB cap, and Vercel's own ~4.5MB hard
// ceiling on serverless function request bodies) so a real book file
// isn't capped at a few megabytes.
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
