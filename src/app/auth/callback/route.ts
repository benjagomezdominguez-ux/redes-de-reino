import { NextResponse } from "next/server";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

// Lives outside the [locale] tree on purpose (see middleware.ts's matcher,
// which excludes /auth) — this is a Supabase email-link landing point
// (signup confirmation and password recovery both point here), not a
// page, so it doesn't need i18n routing.
//
// Exchanges the one-time `code` Supabase put in the email link for a real
// session, persisted via the same cookie-aware client used everywhere
// else — this IS a Route Handler, so (unlike a Server Component) it can
// actually write those cookies onto the response.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next")) ?? "/";

  if (code) {
    const supabase = await getSupabaseSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/es/login`);
}
