import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Real Tiendanube (Nuvemshop) REST API client. Server-only — the access
// token must never reach the browser. Verified against the current
// official docs (https://tiendanube.github.io/api-documentation/) rather
// than assumed:
//   - base URL is date-versioned: https://api.tiendanube.com/{version}/{store_id}
//   - auth: `Authorization: Bearer <token>`
//   - a descriptive `User-Agent` is mandatory — its absence alone returns
//     400 Bad Request, unrelated to the token being valid or not
//   - rate limit: leaky bucket, 2 req/s sustained / 40 burst on the base
//     plan — see x-rate-limit-* response headers
//
// The access token comes from tiendanube_connections (populated by the
// OAuth callback — src/app/api/tiendanube/oauth/callback/route.ts), not
// from an env var: a token obtained dynamically from completing OAuth
// can't be written back into a Vercel env var from a running function,
// so the database is the only real place to persist it.
const API_VERSION = "2025-03";
const USER_AGENT = "Redes de Reino (benjagomezdominguez@gmail.com)";
const REQUEST_TIMEOUT_MS = 8000;

export class TiendanubeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TiendanubeApiError";
  }
}

async function getStoredConnection(): Promise<{ storeId: string; accessToken: string } | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("tiendanube_connections")
    .select("store_id, access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { storeId: data.store_id, accessToken: data.access_token };
}

export async function isTiendanubeConfigured(): Promise<boolean> {
  return Boolean(await getStoredConnection());
}

async function tiendanubeFetch<T>(path: string): Promise<T> {
  const connection = await getStoredConnection();
  if (!connection) {
    throw new TiendanubeApiError("Tiendanube not connected — an admin needs to complete OAuth first", 0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.tiendanube.com/${API_VERSION}/${connection.storeId}${path}`, {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new TiendanubeApiError(`Tiendanube API ${path} failed (${response.status}): ${body.slice(0, 300)}`, response.status);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof TiendanubeApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TiendanubeApiError(`Tiendanube API ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`, 0);
    }
    throw new TiendanubeApiError(`Tiendanube API ${path} network error: ${err instanceof Error ? err.message : String(err)}`, 0);
  } finally {
    clearTimeout(timeout);
  }
}

export type TiendanubeStore = {
  id: number;
  name: unknown;
  main_currency: string;
  country: string;
  main_language: string;
  languages: Record<string, { currency: string; active: boolean }>;
};

export async function getTiendanubeStore(): Promise<TiendanubeStore> {
  return tiendanubeFetch<TiendanubeStore>("/store");
}

export type TiendanubeProductVariant = {
  id: number;
  price: string | null;
  promotional_price: string | null;
  stock: number | null;
};

export type TiendanubeProduct = {
  id: number;
  name: Record<string, string>;
  published: boolean;
  variants: TiendanubeProductVariant[];
};

export async function listTiendanubeProducts(): Promise<TiendanubeProduct[]> {
  return tiendanubeFetch<TiendanubeProduct[]>("/products?per_page=50");
}
