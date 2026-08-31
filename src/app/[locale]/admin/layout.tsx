import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/supabase/require-auth";

// Rule 22: admin routes must stay out of search engines' reach.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  // The real gate (rule 15): authentication + admin role, checked
  // server-side on every request to anything under /admin. Middleware
  // only redirects unauthenticated visitors faster; this is what actually
  // enforces the role.
  await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-12 sm:py-16">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-display text-2xl font-medium text-primary-900 sm:text-3xl">
              {t("title")}
            </h1>
            <nav aria-label={t("navLabel")} className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
              >
                {t("nav.dashboard")}
              </Link>
              <Link
                href="/admin/books"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
              >
                {t("nav.books")}
              </Link>
              <Link
                href="/admin/users"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
              >
                {t("nav.users")}
              </Link>
              <Link
                href="/admin/orders"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
              >
                {t("nav.orders")}
              </Link>
            </nav>
          </div>
          {children}
        </Container>
      </main>
      <Footer />
    </>
  );
}
