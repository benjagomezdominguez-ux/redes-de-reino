import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/sections/ContactForm";
import { contact } from "@/lib/site-config";

type ContactLabelKey =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "youtube"
  | "email"
  | "address"
  | "schedule";

export async function Contact() {
  const t = await getTranslations("contact");
  const tCommon = await getTranslations("common");
  const pending = tCommon("pending");

  const rows: Array<{ key: ContactLabelKey; value: string | null }> = [
    { key: "whatsapp", value: contact.whatsapp },
    { key: "instagram", value: contact.instagram },
    { key: "facebook", value: contact.facebook },
    { key: "youtube", value: contact.youtube },
    { key: "email", value: contact.email },
    { key: "address", value: contact.address },
    { key: "schedule", value: contact.schedule },
  ];

  return (
    <section id="contacto" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 self-start rounded-2xl border border-border bg-surface p-8 shadow-soft sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
                  {t(`labels.${row.key}`)}
                </dt>
                <dd className="text-base text-text">{row.value ?? pending}</dd>
              </div>
            ))}
          </dl>

          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
