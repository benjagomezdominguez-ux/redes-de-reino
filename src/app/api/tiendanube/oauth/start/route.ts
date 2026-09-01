import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAdminUserOrNull } from "@/lib/supabase/require-admin-api";
import { buildAuthorizeUrl, OAUTH_STATE_COOKIE } from "@/lib/tiendanube/oauth";
import { getRequestOrigin } from "@/lib/security/request-origin";

// Admin visits this URL (e.g. a "Conectar Tiendanube" link in
// /admin) to kick off the OAuth flow. Generates a CSRF `state` value,
// stores it in a short-lived httpOnly cookie, and redirects to
// Tiendanube's authorize screen — exactly the flow their docs
// recommend ("add a state parameter ... and check it after the
// redirection").
export async function GET() {
  const admin = await getAdminUserOrNull();
  const origin = await getRequestOrigin();
  if (!admin) {
    return NextResponse.redirect(`${origin}/es/login`);
  }

  const state = randomBytes(32).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(state);
  if (!authorizeUrl) {
    return NextResponse.json({ error: "tiendanube_not_configured" }, { status: 503 });
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/tiendanube/oauth",
  });
  return response;
}
