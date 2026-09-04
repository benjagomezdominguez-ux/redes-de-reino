import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site-config";

export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-primary-950 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-primary-700)_0%,_transparent_55%)] opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 bottom-[-8rem] h-96 w-96 rounded-full bg-accent-600/30 blur-3xl"
      />

      <Container className="relative flex flex-col items-center gap-10 py-24 text-center sm:py-32">
        <Image
          src="/logo.png"
          alt={t("logoAlt", { name: site.name, location: site.location })}
          width={128}
          height={128}
          className="h-28 w-28 rounded-full shadow-lifted sm:h-32 sm:w-32"
          priority
        />

        <div className="flex flex-col items-center gap-5">
          <span className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary-400">
            {site.location}
          </span>
          <h1 className="font-display text-4xl font-medium text-balance sm:text-6xl">
            {site.name}
          </h1>
          <p className="max-w-xl text-lg text-white/80 text-balance sm:text-xl">
            {t("tagline")}
          </p>
        </div>
      </Container>
    </section>
  );
}
