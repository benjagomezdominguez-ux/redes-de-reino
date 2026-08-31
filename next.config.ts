import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Dev-only: Next.js blocks cross-origin requests (including Server
  // Actions like signIn/signUp) to the dev server unless the request's
  // Origin is in this list. Needed to test from a phone on the same
  // Wi-Fi, reached via the Mac's mDNS hostname (e.g. my-mac.local:3000)
  // — see src/lib/security/request-origin.ts and the README for why a
  // ".local" hostname is used instead of a raw LAN IP. Has no effect in
  // production (Vercel doesn't apply this restriction).
  allowedDevOrigins: ["*.local"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
