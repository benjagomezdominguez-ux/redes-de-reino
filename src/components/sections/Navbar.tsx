"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { navLinks, site } from "@/lib/site-config";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useCart } from "@/lib/cart/CartContext";
import { signOut } from "@/lib/actions/auth";
import { ChatNavBadge } from "@/components/chat/ChatNavBadge";
import { NotificationBell } from "@/components/chat/NotificationBell";

type NavbarUser = { email: string | null; role: "user" | "admin"; isChatAdmin: boolean } | null;

function CartIcon({ count }: { count: number }) {
  return (
    <Link
      href="/libros/carrito"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-900/80 transition-colors hover:text-primary-900"
      aria-label="Carrito"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-1.5 4h11" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-500 text-[10px] font-semibold text-primary-950">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function AccountLinkText({ href, labelKey, className }: { href: string; labelKey: string; className: string }) {
  const t = useTranslations();
  return (
    <Link href={href} className={className}>
      {t(labelKey)}
    </Link>
  );
}

// Desktop: a single compact icon that opens a dropdown — keeps navbar
// width bounded regardless of auth state (three separate text links here
// previously pushed the cart/language switcher off-screen once logged in).
function AccountMenuDesktop({ user }: { user: NavbarUser }) {
  const t = useTranslations("auth");
  const tChat = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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

  if (!user) {
    return (
      <Link
        href="/login"
        className="whitespace-nowrap text-sm font-medium text-primary-900/80 transition-colors hover:text-primary-900"
      >
        {t("loginLink")}
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("loginTitle")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-900/80 transition-colors hover:text-primary-900"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lifted"
        >
          <AccountLinkText
            href="/account"
            labelKey="account.title"
            className="block px-4 py-2 text-sm text-text transition-colors hover:bg-primary-900/5"
          />
          <AccountLinkText
            href="/biblioteca"
            labelKey="books.library.title"
            className="block px-4 py-2 text-sm text-text transition-colors hover:bg-primary-900/5"
          />
          <AccountLinkText
            href="/pedidos"
            labelKey="books.orders.title"
            className="block px-4 py-2 text-sm text-text transition-colors hover:bg-primary-900/5"
          />
          <Link
            href="/chat"
            className="flex items-center px-4 py-2 text-sm text-text transition-colors hover:bg-primary-900/5"
          >
            {tChat("navLink")}
            <ChatNavBadge />
          </Link>
          {user.role === "admin" ? (
            <AccountLinkText
              href="/admin"
              labelKey="admin.title"
              className="block px-4 py-2 text-sm text-text transition-colors hover:bg-primary-900/5"
            />
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary-900/5"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenuMobile({ user }: { user: NavbarUser }) {
  const t = useTranslations("auth");
  const tChat = useTranslations("chat");
  const linkClass = "block rounded-md px-3 py-3 text-base font-medium text-primary-900 hover:bg-primary-900/5";

  if (!user) {
    return (
      <Link href="/login" className={linkClass}>
        {t("loginLink")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <AccountLinkText href="/account" labelKey="account.title" className={linkClass} />
      <AccountLinkText href="/biblioteca" labelKey="books.library.title" className={linkClass} />
      <AccountLinkText href="/pedidos" labelKey="books.orders.title" className={linkClass} />
      <Link href="/chat" className={`flex items-center ${linkClass}`}>
        {tChat("navLink")}
        <ChatNavBadge />
      </Link>
      {user.role === "admin" ? (
        <AccountLinkText href="/admin" labelKey="admin.title" className={linkClass} />
      ) : null}
      <form action={signOut}>
        <button type="submit" className={linkClass}>
          {t("logout")}
        </button>
      </form>
    </div>
  );
}

export function Navbar({ user = null }: { user?: NavbarUser }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur">
      <nav
        aria-label={t("ariaLabel")}
        className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3 sm:px-8"
      >
        <Link
          href={`/${locale}#inicio`}
          className="flex shrink-0 items-center gap-3 whitespace-nowrap"
          onClick={() => setOpen(false)}
        >
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

        <div className="hidden items-center gap-4 lg:flex xl:gap-6">
          <ul className="flex items-center gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={`/${locale}${link.href}`}
                  className="whitespace-nowrap text-sm font-medium text-primary-900/80 transition-colors hover:text-primary-900"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-l border-border pl-4">
            {user?.isChatAdmin ? <NotificationBell /> : null}
            <AccountMenuDesktop user={user} />
            <CartIcon count={itemCount} />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          {user?.isChatAdmin ? <NotificationBell /> : null}
          <CartIcon count={itemCount} />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-primary-900"
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
        </div>
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
                  href={`/${locale}${link.href}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-primary-900 hover:bg-primary-900/5"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-border/80 pt-2">
            <AccountMenuMobile user={user} />
          </div>
          <div className="mt-2 border-t border-border/80 pt-2">
            <LanguageSwitcher variant="mobile" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
