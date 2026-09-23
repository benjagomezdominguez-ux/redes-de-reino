"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site-config";
import { easeOut, staggerContainer, staggerItem } from "@/lib/motion/variants";
import { useSafeReducedMotion } from "@/lib/motion/use-safe-reduced-motion";

// The one place a "use client" conversion was worth it (translations are
// already available client-side via NextIntlClientProvider in the root
// layout, so no data is actually server-only here): this is the first
// thing anyone sees, and it used to render fully static — logo, title
// and tagline all present at once, no sense of arrival. Everything below
// is choreographed once on mount, never re-triggered, and the two
// decorative blobs already in the design (radial gradient + blur circle)
// get a slow ambient drift instead of sitting frozen — both skipped
// entirely under prefers-reduced-motion.
export function Hero() {
  const t = useTranslations("hero");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const reduceMotion = useSafeReducedMotion();

  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-primary-950 text-white"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-primary-700)_0%,_transparent_55%)] opacity-80"
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.08, 1], opacity: [0.8, 0.65, 0.8] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 bottom-[-8rem] h-96 w-96 rounded-full bg-accent-600/30 blur-3xl"
        animate={
          reduceMotion ? undefined : { x: [0, 30, 0], y: [0, -20, 0] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <Container className="relative flex flex-col items-center gap-10 py-24 text-center sm:py-32">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: easeOut }}
        >
          <Image
            src="/logo.png"
            alt={t("logoAlt", { name: site.name, location: site.location })}
            width={128}
            height={128}
            className="h-28 w-28 rounded-full shadow-lifted sm:h-32 sm:w-32"
            priority
          />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-5"
          variants={reduceMotion ? undefined : staggerContainer}
          initial={reduceMotion ? undefined : "hidden"}
          animate={reduceMotion ? undefined : "visible"}
        >
          <motion.span
            variants={reduceMotion ? undefined : staggerItem}
            className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary-400"
          >
            {site.location}
          </motion.span>
          <motion.h1
            variants={reduceMotion ? undefined : staggerItem}
            className="font-display text-4xl font-medium text-balance sm:text-6xl"
          >
            {site.name}
          </motion.h1>
          <motion.p
            variants={reduceMotion ? undefined : staggerItem}
            className="max-w-xl text-lg text-white/80 text-balance sm:text-xl"
          >
            {t("tagline")}
          </motion.p>
          <motion.div variants={reduceMotion ? undefined : staggerItem} className="mt-2">
            <Button href={`/${locale}/devocionales`} variant="outline-light">
              {tNav("devocionales")}
            </Button>
          </motion.div>
        </motion.div>
      </Container>

      <motion.a
        href="#galeria"
        aria-label={t("scrollCue")}
        className="group relative z-10 mx-auto mb-8 hidden w-fit items-center justify-center rounded-full border border-white/25 p-3 text-white/70 transition-colors hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-400 sm:flex"
        initial={reduceMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </motion.svg>
      </motion.a>
    </section>
  );
}
