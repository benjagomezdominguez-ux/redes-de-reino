import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { PENDING, giving } from "@/lib/site-config";

export function Giving() {
  return (
    <section id="diezmos-y-ofrendas" className="bg-primary-950 py-20 text-white sm:py-28">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          tone="dark"
          eyebrow="Diezmos y Ofrendas"
          title="Generosidad que sostiene el Reino"
          description="Diezmar y ofrendar es un acto de fe y gratitud. Acá vas a
          encontrar, de forma clara y transparente, cómo colaborar con la obra
          de Redes de Reino."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              Alias
            </dt>
            <dd className="mt-1 text-base text-white/90">
              {giving.alias ?? PENDING}
            </dd>
          </dl>
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              CBU
            </dt>
            <dd className="mt-1 text-base text-white/90">
              {giving.cbu ?? PENDING}
            </dd>
          </dl>
          <dl className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-400">
              Banco
            </dt>
            <dd className="mt-1 text-base text-white/90">
              {giving.bank ?? PENDING}
            </dd>
          </dl>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button href="#contacto" variant="secondary">
            Diezmar
          </Button>
          <Button href="#contacto" variant="outline-light">
            Dar una ofrenda
          </Button>
        </div>
      </Container>
    </section>
  );
}
