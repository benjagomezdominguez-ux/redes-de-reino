import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pastors } from "@/lib/site-config";

export function Pastors() {
  return (
    <section id="pastores" className="bg-surface-alt py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          align="center"
          eyebrow="Pastores"
          title="Nuestros Pastores"
        />

        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
          {pastors.map((pastor) => (
            <div
              key={pastor.name}
              className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full bg-primary-900/5 text-sm text-muted"
                aria-hidden="true"
              >
                Foto
              </div>
              <div>
                <h3 className="font-display text-xl font-medium text-primary-900">
                  {pastor.name}
                </h3>
                <p className="text-sm font-medium uppercase tracking-wide text-secondary-600">
                  {pastor.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
