import type { ReactNode } from "react";
import { requireUser } from "@/lib/supabase/require-auth";

// Guards every route nested under this group (account, biblioteca,
// pedidos, libros/checkout) — requireUser() redirects to /login if
// there's no active session. This is the real security boundary; the
// middleware redirect is only a faster UX nicety on top of it (see
// middleware.ts).
//
// Not a typed LayoutProps<"..."> like other layouts: route groups (this
// folder's parenthesized name) don't appear in the URL, so Next's route
// typegen has no corresponding "/[locale]/(protected)" layout route to
// generate a type for.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
