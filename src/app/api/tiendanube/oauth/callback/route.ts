import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUserOrNull } from "@/lib/supabase/require-admin-api";
import { exchangeCodeForToken, OAUTH_STATE_COOKIE } from "@/lib/tiendanube/oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/security/request-origin";

// This is the URL configured in Tiendanube's partner panel
// ("URL para redirigir después de la instalación"):
// https://redes-de-reino.vercel.app/api/tiendanube/oauth/callback
//
// Only ever processes the flow this app itself started (rule 15): it
// requires both an active admin session (the same browser that visited
// /start, since the Supabase session cookie rides along on this
// same-site top-level redirect) AND a `state` value matching the one
// /start stored in an httpOnly cookie — a stray or replayed `code`
// hitting this URL without both of those is refused before the token
// exchange is ever attempted.
export async function GET(request: Request) {
  const origin = await getRequestOrigin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const admin = await getAdminUserOrNull();
  if (!admin) {
    return NextResponse.redirect(`${origin}/es/login`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/es/admin?tiendanube=invalid_state`);
  }

  // Never log `code` itself — only the fact that an exchange happened
  // and, on failure, a short non-sensitive error code (rule 14).
  const result = await exchangeCodeForToken(code);
  if (!result.ok) {
    console.error("tiendanube oauth token exchange failed:", result.error);
    return NextResponse.redirect(`${origin}/es/admin?tiendanube=error`);
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error: saveError } = await supabaseAdmin.from("tiendanube_connections").upsert(
    {
      store_id: result.storeId,
      access_token: result.accessToken,
      token_type: result.tokenType,
      scope: result.scope,
      connected_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" }
  );

  if (saveError) {
    console.error("tiendanube oauth: failed to persist connection", saveError.message);
    return NextResponse.redirect(`${origin}/es/admin?tiendanube=save_failed`);
  }

  await supabaseAdmin.from("audit_log").insert({
    actor_id: admin.id,
    action: "tiendanube_connected",
    resource_type: "tiendanube_connection",
    resource_id: result.storeId,
    metadata: {},
  });

  return NextResponse.redirect(`${origin}/es/admin?tiendanube=connected`);
}
