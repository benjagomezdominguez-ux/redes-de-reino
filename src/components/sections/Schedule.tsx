import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MeetingSchedule } from "@/components/ui/MeetingSchedule";
import { meetings } from "@/lib/site-config";

export async function Schedule() {
  const t = await getTranslations("schedule");
  const tCommon = await getTranslations("common");

  const dayLabels = {
    lunes: t("days.lunes"),
    martes: t("days.martes"),
    miercoles: t("days.miercoles"),
    jueves: t("days.jueves"),
    viernes: t("days.viernes"),
    sabado: t("days.sabado"),
    domingo: t("days.domingo"),
  };

  return (
    <section id="horarios" className="bg-surface-alt py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-4">
          <SectionHeading align="center" eyebrow={t("eyebrow")} title={t("title")} />
          <p className="mx-auto max-w-2xl text-center text-lg sm:text-xl text-balance text-muted">
            {t("description")}
          </p>
        </div>

        {/* data-avoid-fab: the floating "Habla con el pastor" button hides
            itself while this grid occupies its bottom-corner footprint —
            see PastorChatFloatingButton.tsx. Without it, landing here via
            the navbar's #horarios anchor link parks the button directly
            over the last meeting's title/time on every visit. */}
        <div data-avoid-fab="true">
          <MeetingSchedule
            meetings={meetings}
            dayLabels={dayLabels}
            pendingLabel={tCommon("pending")}
          />
        </div>
      </Container>
    </section>
  );
}
