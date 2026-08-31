import { setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Hero } from "@/components/sections/Hero";
import { Gallery } from "@/components/sections/Gallery";
import { Schedule } from "@/components/sections/Schedule";
import { Pastors } from "@/components/sections/Pastors";
import { Books } from "@/components/sections/Books";
import { Footer } from "@/components/sections/Footer";
import { Reveal } from "@/components/ui/Reveal";
import { site, siteUrl } from "@/lib/site-config";

export default async function Home({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const churchJsonLd = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: site.name,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    image: `${siteUrl}/logo.png`,
    inLanguage: locale,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Salta",
      addressCountry: "AR",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(churchJsonLd) }}
      />
      <NavbarWithAuth />
      <main className="flex flex-col">
        <Hero />
        <Reveal>
          <Gallery />
        </Reveal>
        <Reveal>
          <Schedule />
        </Reveal>
        <Reveal>
          <Pastors />
        </Reveal>
        <Reveal>
          <Books />
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
