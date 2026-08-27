import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { bibleStudies } from "@/lib/site-config";

export async function BibleStudies() {
  const t = await getTranslations("bibleStudies");
  const tCommon = await getTranslations("common");

  return (
    <section id="estudios-biblicos" className="bg-surface-alt py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bibleStudies.map((study) => (
            <article
              key={study.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-medium text-primary-900">
                  {study.title}
                </h3>
                <span className="shrink-0 rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
                  {t(`status.${study.statusKey}`)}
                </span>
              </div>
              <p className="text-sm text-muted">{t("genericDescription")}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm text-muted">
                <div>
                  <dt className="font-semibold text-primary-900">{t("teacherLabel")}</dt>
                  <dd>{study.teacher ?? tCommon("pending")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-900">{t("dayLabel")}</dt>
                  <dd>{study.day ?? tCommon("pending")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-900">{t("timeLabel")}</dt>
                  <dd>{study.time ?? tCommon("pending")}</dd>
                </div>
              </dl>
              <div className="mt-auto flex gap-3 pt-2">
                <Button href="#contacto" variant="ghost" className="flex-1">
                  {t("viewCta")}
                </Button>
                <Button href="#contacto" variant="primary" className="flex-1">
                  {t("joinCta")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
