import "server-only";

// Verified against the official docs
// (https://tiendanube.github.io/api-documentation/authentication) rather
// than assumed — see also client.ts for the resulting REST client.
const AUTHORIZE_BASE = "https://www.tiendanube.com/apps";
const TOKEN_URL = "https://www.tiendanube.com/apps/authorize/token";
const REQUEST_TIMEOUT_MS = 8000;

// Next.js restricts route.ts files to exporting only HTTP method
// handlers and a small set of framework-recognized names — a shared
// constant like this has to live outside them, not be exported from one
// route.ts and imported into another.
export const OAUTH_STATE_COOKIE = "tiendanube_oauth_state";

// TIENDANUBE_CLIENT_ID is not a secret (it's embedded in the public
// authorize URL by design), but TIENDANUBE_CLIENT_SECRET is — both live
// only in Vercel env vars, never in source.
export function buildAuthorizeUrl(state: string): string | null {
  const clientId = process.env.TIENDANUBE_CLIENT_ID;
  if (!clientId) return null;
  return `${AUTHORIZE_BASE}/${clientId}/authorize?state=${encodeURIComponent(state)}`;
}

export type TokenExchangeResult =
  | { ok: true; accessToken: string; tokenType: string; scope: string | null; storeId: string }
  | { ok: false; error: string };

// Exchanges a one-time authorization code for a real access token —
// server-side only, exactly as Tiendanube's OAuth flow requires. Never
// logs `code`, the client secret, or the resulting access token; only
// short, non-sensitive error codes.
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const clientId = process.env.TIENDANUBE_CLIENT_ID;
  const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as
      | { access_token?: string; token_type?: string; scope?: string; user_id?: string | number; store_id?: string | number }
      | null;

    if (!response.ok || !body?.access_token) {
      return { ok: false, error: `token_exchange_failed_${response.status}` };
    }

    const storeId = String(body.user_id ?? body.store_id ?? "");
    if (!storeId) {
      return { ok: false, error: "missing_store_id" };
    }

    return {
      ok: true,
      accessToken: body.access_token,
      tokenType: body.token_type ?? "bearer",
      scope: body.scope ?? null,
      storeId,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}
