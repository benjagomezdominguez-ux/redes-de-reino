import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { activities } from "@/lib/site-config";

export async function Activities() {
  const t = await getTranslations("activities");
  const tCommon = await getTranslations("common");

  return (
    <section id="actividades" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {activities.map((activity) => (
            <article
              key={activity.groupKey}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
                {t(`groups.${activity.groupKey}`)}
              </span>
              <h3 className="font-display text-lg font-medium text-primary-900">
                {activity.title ?? tCommon("pending")}
              </h3>
              <p className="text-sm text-muted">
                {t(`descriptions.${activity.groupKey}`)}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
