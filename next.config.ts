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
  images: {
    // Book covers live in the public "book-covers" Storage bucket and
    // are rendered via next/image — without this, Next's image
    // optimizer rejects the remote URL outright (400) and every cover
    // silently fails to load. Scoped to this bucket's public path, not
    // the whole Supabase domain.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/book-covers/**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
