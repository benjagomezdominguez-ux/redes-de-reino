"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { navLinks, site } from "@/lib/site-config";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function Navbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur">
      <nav
        aria-label={t("ariaLabel")}
        className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-8"
      >
        <Link href="#inicio" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="/logo.png"
            alt={tCommon("logoAlt", { name: site.name })}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full"
            priority
          />
          <span className="font-display text-lg font-medium text-primary-900">
            {site.name}
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-primary-900/80 transition-colors hover:text-primary-900"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-primary-900 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          className="border-t border-border/80 bg-background px-6 pb-6 lg:hidden"
        >
          <ul className="flex flex-col gap-1 pt-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-primary-900 hover:bg-primary-900/5"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-border/80 pt-2">
            <LanguageSwitcher variant="mobile" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
