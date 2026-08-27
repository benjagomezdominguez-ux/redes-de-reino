import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { bibleStudies } from "@/lib/site-config";

export function BibleStudies() {
  return (
    <section id="estudios-biblicos" className="bg-surface-alt py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Estudios Bíblicos"
          title="Crecé en la Palabra"
          description="Sumate a un estudio bíblico semanal y profundizá tu fe junto a
          otros. Estos son los espacios disponibles."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bibleStudies.map((study, index) => (
            <article
              key={index}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-medium text-primary-900">
                  {study.title}
                </h3>
                <span className="shrink-0 rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
                  {study.status}
                </span>
              </div>
              <p className="text-sm text-muted">{study.description}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm text-muted">
                <div>
                  <dt className="font-semibold text-primary-900">Profesor</dt>
                  <dd>{study.teacher}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-900">Día</dt>
                  <dd>{study.day}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-primary-900">Horario</dt>
                  <dd>{study.time}</dd>
                </div>
              </dl>
              <div className="mt-auto flex gap-3 pt-2">
                <Button href="#contacto" variant="ghost" className="flex-1">
                  Ver estudio
                </Button>
                <Button href="#contacto" variant="primary" className="flex-1">
                  Participar
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
