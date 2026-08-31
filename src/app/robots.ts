import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
import { routing } from "@/i18n/routing";

export default function robots(): MetadataRoute.Robots {
  // Admin pages also carry a per-page noindex (see admin/layout.tsx) —
  // this keeps crawlers from even requesting them (rule 22).
  const disallow = routing.locales.map((locale) => `/${locale}/admin`);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
