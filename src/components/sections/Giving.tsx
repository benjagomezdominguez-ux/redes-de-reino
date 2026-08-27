import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { giving } from "@/lib/site-config";

export async function Giving() {
  const t = await getTranslations("giving");
  const tCommon = await getTranslations("common");
  const pending = tCommon("pending");

  return (
    <section id="diezmos-y-ofrendas" className="bg-primary-950 py-20 text-white sm:py-28">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          tone="dark"
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              {t("aliasLabel")}
            </dt>
            <dd className="mt-1 text-base text-white/90">{giving.alias ?? pending}</dd>
          </dl>
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              {t("cbuLabel")}
            </dt>
            <dd className="mt-1 text-base text-white/90">{giving.cbu ?? pending}</dd>
          </dl>
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              {t("bankLabel")}
            </dt>
            <dd className="mt-1 text-base text-white/90">{giving.bank ?? pending}</dd>
          </dl>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button href="#contacto" variant="secondary">
            {t("tithCta")}
          </Button>
          <Button href="#contacto" variant="outline-light">
            {t("offeringCta")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
