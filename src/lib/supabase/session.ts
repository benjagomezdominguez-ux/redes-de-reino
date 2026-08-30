import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Session-aware client for anything that needs to know who's logged in
// (checkout, library, orders, login/signup actions). Reads/writes the
// Supabase auth cookies via Next's cookies() API. Server Components can't
// write cookies, so setAll there is a no-op wrapped in try/catch — that's
// fine as long as the session is also refreshed in middleware (it is).
export async function getSupabaseSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — middleware already
          // refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
