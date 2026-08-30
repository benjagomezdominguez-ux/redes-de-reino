import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS entirely. Only for code
// paths that must act with elevated privilege on purpose:
//   - minting signed URLs for product_files (never publicly selectable)
//   - grant_digital_access(), called after a real, server-confirmed
//     payment (never from anything the browser can trigger directly)
// Never import this from a Client Component or expose its result to one.
//
// Note: this project's newer "sb_secret_..." style key (what
// SUPABASE_SECRET_KEY held previously) does NOT carry RLS-bypass
// privilege here — verified empirically (table selects and Storage both
// returned "Invalid API key" / "Invalid Compact JWS" with it). Only the
// legacy service_role JWT actually works for admin operations right now,
// hence this specific env var.
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
