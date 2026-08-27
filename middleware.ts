import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals, API routes (none yet, but future-proof), and any
  // path with a file extension (icons, manifest, sw.js, robots, sitemap).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
