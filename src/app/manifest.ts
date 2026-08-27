import type { MetadataRoute } from "next";
import { site } from "@/lib/site-config";
import esMessages from "../../messages/es.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    // The manifest isn't locale-routed (it's a single global resource),
    // so it uses the default-locale copy rather than the visitor's
    // current language.
    description: esMessages.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#1a2138",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
