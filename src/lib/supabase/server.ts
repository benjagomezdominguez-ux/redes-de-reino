import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses the publishable (anon) key. Row Level Security on every table
// restricts what this client can do — see supabase/migrations. Never use
// this client to bypass RLS; that requires the admin client in
// ./admin.ts (SUPABASE_SERVICE_ROLE_KEY).
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
