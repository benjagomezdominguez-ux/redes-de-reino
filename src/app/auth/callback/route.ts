import { NextResponse } from "next/server";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { getRequestOrigin } from "@/lib/security/request-origin";

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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next")) ?? "/";

  // request.url's origin isn't reliable here — Next.js normalizes it to
  // the server's own bind address rather than preserving the Host header
  // the client actually sent, which silently broke this redirect back to
  // localhost even when the visitor came in through the Mac's mDNS
  // hostname or the production domain. getRequestOrigin() reads the real
  // Host/X-Forwarded-Host headers instead — the same mechanism the
  // Server Actions that build these links use, so this always lands back
  // on whatever origin actually issued the request.
  const origin = await getRequestOrigin();

  if (code) {
    const supabase = await getSupabaseSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/es/login`);
}
