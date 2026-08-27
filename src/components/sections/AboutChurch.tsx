import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillarKeys = ["community", "faith", "growth", "purpose"] as const;

export async function AboutChurch() {
  const t = await getTranslations("about");

  return (
    <section id="nuestra-iglesia" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillarKeys.map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <h3 className="font-display text-xl font-medium text-primary-900">
                {t(`pillars.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {t(`pillars.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
