import "server-only";
import { headers } from "next/headers";

// The one correct way to build an auth redirect URL (rule 4/5/9 of the
// mobile-access fix): derive it from the request that's actually being
// served, never from a fixed constant. That's what makes email
// confirmation/recovery links work identically whether the visitor hit
// localhost:3000, the Mac's mDNS hostname over Wi-Fi (e.g.
// my-mac.local:3000 — see README for why this is used instead of a raw
// LAN IP; either way it's never hardcoded), or the production domain —
// each one gets a link that points right back at itself.
//
// site-config.ts's `siteUrl` stays hardcoded to production on purpose: it
// feeds metadata/canonical/OG tags, which are only ever meaningful for
// the real public site regardless of where this code happens to be
// running. That's a different job from this function and shouldn't share
// a source.
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();

  // Vercel (and most reverse proxies) put the original client-facing
  // host/protocol here; a plain `next start`/`next dev` request has
  // neither, so `host` (set by every HTTP client) is the real fallback.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto");
  const proto = forwardedProto ?? (isLocalOrLan(host) ? "http" : "https");

  return `${proto}://${host}`;
}

function isLocalOrLan(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}
