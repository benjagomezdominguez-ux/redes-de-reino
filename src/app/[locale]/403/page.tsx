import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";

export default async function ForbiddenPage({
  params,
}: PageProps<"/[locale]/403">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("errors.forbidden");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-24 sm:py-32">
        <Container className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
          <span className="font-display text-6xl font-medium text-primary-900">403</span>
          <h1 className="font-display text-2xl font-medium text-primary-900">
            {t("title")}
          </h1>
          <p className="text-muted">{t("body")}</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            {t("cta")}
          </Link>
        </Container>
      </main>
      <Footer />
    </>
  );
}
