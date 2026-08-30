import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

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
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip Next internals, API routes, and any path with a file extension
  // (icons, manifest, sw.js, robots, sitemap).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
