import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PENDING, contact } from "@/lib/site-config";

const rows: Array<{ label: string; value: string | null }> = [
  { label: "WhatsApp", value: contact.whatsapp },
  { label: "Instagram", value: contact.instagram },
  { label: "Facebook", value: contact.facebook },
  { label: "YouTube", value: contact.youtube },
  { label: "Email", value: contact.email },
  { label: "Dirección", value: contact.address },
  { label: "Horarios", value: contact.schedule },
];

export function Contact() {
  return (
    <section id="contacto" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Contacto"
          title="Estamos para vos"
          description="Escribinos o visitanos. Nos encantaría conocerte."
        />

        <dl className="grid grid-cols-1 gap-x-8 gap-y-6 rounded-2xl border border-border bg-surface p-8 shadow-soft sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
                {row.label}
              </dt>
              <dd className="text-base text-text">{row.value ?? PENDING}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
