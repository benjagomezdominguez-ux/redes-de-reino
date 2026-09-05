import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getDevotionalExcerpt } from "@/components/ui/DevotionalContent";
import { Link } from "@/i18n/navigation";
import { getPublishedDevotionals } from "@/lib/devotionals/queries";

export default async function DevotionalesPage({
  params,
}: PageProps<"/[locale]/devocionales">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("devotionals");

  const devotionals = await getPublishedDevotionals();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="flex flex-col gap-12">
          <SectionHeading align="center" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

          {devotionals.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {t("empty")}
            </p>
          ) : (
            <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
              {devotionals.map((devotional) => (
                <Link
                  key={devotional.id}
                  href={`/devocionales/${devotional.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-secondary-600">
                    {new Date(devotional.published_at ?? devotional.created_at).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <h3 className="font-display text-xl font-medium text-primary-900">{devotional.title}</h3>
                  <p className="line-clamp-3 text-sm text-muted">{getDevotionalExcerpt(devotional.content)}</p>
                  <span className="mt-auto pt-2 text-sm font-semibold text-primary-900 underline">{t("read")}</span>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
