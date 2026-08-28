import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { AboutChurch } from "@/components/sections/AboutChurch";
import { Pastors } from "@/components/sections/Pastors";
import { Membership } from "@/components/sections/Membership";
import { Giving } from "@/components/sections/Giving";
import { BibleStudies } from "@/components/sections/BibleStudies";
import { Activities } from "@/components/sections/Activities";
import { Gallery } from "@/components/sections/Gallery";
import { Contact } from "@/components/sections/Contact";
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
      <Navbar />
      <main className="flex flex-col">
        <Hero />
        <Reveal>
          <AboutChurch />
        </Reveal>
        <Reveal>
          <Pastors />
        </Reveal>
        <Reveal>
          <Membership />
        </Reveal>
        <Reveal>
          <BibleStudies />
        </Reveal>
        <Reveal>
          <Activities />
        </Reveal>
        <Reveal>
          <Gallery />
        </Reveal>
        <Reveal>
          <Giving />
        </Reveal>
        <Reveal>
          <Contact />
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
