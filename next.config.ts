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
    // Every public Storage bucket rendered via next/image needs its own
    // entry here — without it, Next's image optimizer rejects the
    // remote URL outright (400) and the image silently fails to load
    // (the <img> never paints, only its alt text renders — exactly what
    // happened to gallery photos before this bucket was added: the
    // Storage URL itself was always valid, this allowlist was the only
    // thing missing). Each entry is scoped to one bucket's public path,
    // not the whole Supabase domain.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/book-covers/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/gallery-photos/**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
