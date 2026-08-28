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
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <MeetingSchedule
          meetings={meetings}
          dayLabels={dayLabels}
          pendingLabel={tCommon("pending")}
        />
      </Container>
    </section>
  );
}
