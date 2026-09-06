import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InstallGuide } from "@/components/pwa/InstallGuide";

export default async function InstalarPage({
  params,
}: PageProps<"/[locale]/instalar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("install");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="flex flex-col gap-12">
          <SectionHeading align="center" eyebrow={t("eyebrow")} title={t("title")} description={t("intro")} />
          <div className="mx-auto w-full max-w-5xl">
            <InstallGuide />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
