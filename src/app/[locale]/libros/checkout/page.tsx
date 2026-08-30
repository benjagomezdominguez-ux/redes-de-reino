import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { CheckoutView } from "@/components/ui/CheckoutView";
import { Link } from "@/i18n/navigation";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

export default async function CheckoutPage({
  params,
}: PageProps<"/[locale]/libros/checkout">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.checkout");

  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-5xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>

          {user ? (
            <CheckoutView />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-muted">{t("loginRequired")}</p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
              >
                {t("loginCta")}
              </Link>
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
