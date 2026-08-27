import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";

const steps = [
  {
    title: "Visitanos",
    description: "Acercate a un servicio o actividad y conocé la comunidad.",
  },
  {
    title: "Conectate",
    description: "Sumate a un grupo o estudio para crecer junto a otros.",
  },
  {
    title: "Sé parte",
    description: "Da el paso de formar parte oficialmente de la familia.",
  },
];

export function Membership() {
  return (
    <section id="membresia" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Membresía"
          title="Sé parte de Redes de Reino"
          description="Formar parte de la comunidad es un camino simple: conocerse,
          conectarse y crecer juntos en fe."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-border bg-surface p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <span className="font-display text-3xl text-secondary-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-xl font-medium text-primary-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{step.description}</p>
            </div>
          ))}
        </div>

        <div>
          <Button href="#contacto">Quiero ser miembro</Button>
        </div>
      </Container>
    </section>
  );
}
