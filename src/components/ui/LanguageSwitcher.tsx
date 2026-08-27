"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";

const flags: Record<Locale, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  pt: "🇧🇷",
};

export function LanguageSwitcher({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("languageSwitcher");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (variant === "mobile") {
    return (
      <div className="flex flex-col gap-1">
        <span className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("label")}
        </span>
        {routing.locales.map((loc) => (
          <a
            key={loc}
            href={`/${loc}`}
            aria-current={loc === locale ? "true" : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-3 text-base font-medium hover:bg-primary-900/5 ${
              loc === locale ? "text-primary-900" : "text-primary-900/70"
            }`}
          >
            <span aria-hidden="true">{flags[loc]}</span>
            {t(loc)}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
        className="flex items-center gap-1.5 rounded-full border border-primary-900/15 px-3 py-1.5 text-sm font-medium text-primary-900/80 transition-colors hover:border-primary-900/30 hover:text-primary-900"
      >
        <span aria-hidden="true">{flags[locale]}</span>
        <span>{locale.toUpperCase()}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lifted"
        >
          {routing.locales.map((loc) => (
            <li key={loc} role="option" aria-selected={loc === locale}>
              <a
                href={`/${loc}`}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-primary-900/5 ${
                  loc === locale ? "font-semibold text-primary-900" : "text-text"
                }`}
              >
                <span aria-hidden="true">{flags[loc]}</span>
                {t(loc)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
