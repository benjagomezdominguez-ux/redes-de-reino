import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillars = [
  {
    title: "Comunidad",
    description: "Un lugar donde ser conocido, acompañado y valorado.",
  },
  {
    title: "Fe",
    description: "Una relación viva con Dios que transforma cada día.",
  },
  {
    title: "Crecimiento",
    description: "Espacios para aprender, servir y madurar juntos.",
  },
  {
    title: "Propósito",
    description: "Cada persona tiene un lugar y un llamado en el Reino.",
  },
];

export function AboutChurch() {
  return (
    <section id="nuestra-iglesia" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Nuestra Iglesia"
          title="Una red de personas conectadas por la fe"
          description="Redes de Reino es una comunidad cristiana en Salta, Argentina, donde
          familias, jóvenes y personas de toda edad crecen juntas en su
          relación con Dios y se sirven mutuamente."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-soft"
            >
              <h3 className="font-display text-xl font-medium text-primary-900">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{pillar.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
