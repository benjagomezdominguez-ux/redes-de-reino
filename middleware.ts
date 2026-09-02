import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Fast, cookie-only first line of defense (rule 12/38). This is a UX
// nicety, not the security boundary — every one of these paths is also
// guarded server-side by requireUser()/requireAdmin() in a layout (see
// src/lib/supabase/require-auth.ts), which is what actually enforces
// access and cannot be bypassed by skipping this redirect.
const PROTECTED_PREFIXES = ["/account", "/admin", "/pedidos", "/biblioteca", "/libros/checkout", "/chat"];

function stripLocale(pathname: string) {
  const match = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`));
  return match ? pathname.slice(match[0].length) || "/" : pathname;
}

function isProtectedPath(pathname: string) {
  const path = stripLocale(pathname);
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // next-intl redirects unprefixed paths (e.g. "/" -> "/es"). The browser
  // will immediately re-request the prefixed URL, which runs this
  // middleware again — so there's no need (and no safe way) to also
  // layer the Supabase session refresh onto a redirect response here.
  if (response.headers.get("location")) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the auth token if needed — required so server components
  // (which can't write cookies themselves) see an up-to-date session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const localeMatch = request.nextUrl.pathname.match(
      new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`)
    );
    const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Skip Next internals, API routes, the auth email-link callback (see
  // src/app/auth/callback/route.ts — it's intentionally outside [locale]
  // routing), and any path with a file extension (icons, manifest, sw.js,
  // robots, sitemap).
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
