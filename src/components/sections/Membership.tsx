import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";

const stepKeys = ["visit", "connect", "join"] as const;

export async function Membership() {
  const t = await getTranslations("membership");

  return (
    <section id="membresia" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stepKeys.map((key, index) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-surface p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <span className="font-display text-3xl text-secondary-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-xl font-medium text-primary-900">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted">{t(`steps.${key}.description`)}</p>
            </div>
          ))}
        </div>

        <div>
          <Button href="#contacto">{t("cta")}</Button>
        </div>
      </Container>
    </section>
  );
}
