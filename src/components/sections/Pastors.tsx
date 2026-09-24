import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StaggerGrid } from "@/components/ui/motion/StaggerGrid";
import { pastors } from "@/lib/site-config";

export async function Pastors() {
  const t = await getTranslations("pastors");

  return (
    <section id="pastores" className="bg-surface-alt py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading align="center" eyebrow={t("eyebrow")} title={t("title")} />

        {/* StaggerGrid marks itself data-avoid-fab by default now — see
            its own comment — so the floating chat button knows to hide
            itself rather than park over Gabriela's name/role. */}
        <StaggerGrid className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
          {pastors.map((pastor) => (
            <div
              key={pastor.name}
              className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {pastor.photo ? (
                // Circular mask (rounded-full + overflow via object-cover's
                // own clipping) over a controlled crop — never a stretch:
                // object-cover scales the source uniformly and crops the
                // overflow, it never distorts it. object-position biases
                // that crop toward the top third rather than dead-center,
                // since a non-square portrait (e.g. a 3:4 photo forced into
                // this 1:1 circle) loses more from top+bottom than left+
                // right, and a plain center crop risks trimming into the
                // forehead/hair — biasing up keeps the face itself framed
                // naturally regardless of the source photo's own ratio.
                <Image
                  src={pastor.photo}
                  alt={t("photoAlt", { name: pastor.name })}
                  width={112}
                  height={112}
                  className="h-28 w-28 rounded-full object-cover object-[center_20%]"
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full bg-primary-900/5 text-sm text-muted"
                  aria-hidden="true"
                >
                  {t("photoPlaceholder")}
                </div>
              )}
              <div>
                <h3 className="font-display text-xl font-medium text-primary-900">
                  {pastor.name}
                </h3>
                <p className="text-sm font-medium uppercase tracking-wide text-secondary-600">
                  {t(`roles.${pastor.roleKey}`)}
                </p>
              </div>
            </div>
          ))}
        </StaggerGrid>
      </Container>
    </section>
  );
}
