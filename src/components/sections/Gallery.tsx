import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CinematicGallery } from "@/components/ui/CinematicGallery";
import { galleryImages } from "@/lib/site-config";

export async function Gallery() {
  const t = await getTranslations("gallery");

  return (
    <section id="galeria" className="py-20 sm:py-28">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <CinematicGallery images={galleryImages} />
      </Container>
    </section>
  );
}
