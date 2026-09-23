"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { ChatNavBadge } from "@/components/chat/ChatNavBadge";
import { useSafeReducedMotion } from "@/lib/motion/use-safe-reduced-motion";

// Real-device screenshots (iPhone SE/13, both Horarios and Pastores)
// showed this fixed button parked directly on top of card text — e.g.
// Gabriela's name/role, or the third meeting's title/time — whenever a
// scroll happened to stop with that content in the button's footprint.
// A `position: fixed` element unavoidably overlaps whatever scrolls
// beneath it; the fix isn't padding (no fixed amount of section spacing
// prevents an arbitrary scroll position from landing there), it's not
// occluding content while the page is actually moving. Hiding the button
// during active scroll and restoring it ~200ms after scrolling settles
// is the standard pattern (Intercom/Drift-style launchers) — it never
// touches routing, auth, or the /chat destination itself, only this
// button's own visibility.
function useHideWhileScrolling(): boolean {
  const [scrolling, setScrolling] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleScroll() {
      setScrolling(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setScrolling(false), 200);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return scrolling;
}

// Roughly the button's own footprint (pill height + its bottom offset +
// a little buffer) — the region at the bottom of the viewport it visually
// occupies, used below to know when marked content is about to sit
// underneath it.
const AVOID_ZONE_HEIGHT = 96;

// Unlike useHideWhileScrolling (which only covers the button sliding over
// content *during* a scroll gesture), this covers the settled/idle case:
// the navbar's #horarios and #pastores links are real anchor scrolls
// (see site-config.ts), so every visitor who taps them lands at the exact
// same rest position — and on short viewports that position has the last
// card sitting right where this button floats, indefinitely, not just in
// transit. Elements opt in with `data-avoid-fab="true"` (Schedule.tsx,
// Pastors.tsx); this observes whether any of them currently reach into
// the button's footprint and hides it for as long as that's true.
function useAvoidingMarkedContent(): boolean {
  const [avoiding, setAvoiding] = useState(false);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('[data-avoid-fab="true"]'));
    if (targets.length === 0) return;

    const intersecting = new Set<Element>();
    let observer: IntersectionObserver | undefined;

    function setup() {
      observer?.disconnect();
      intersecting.clear();
      const bottomMargin = Math.max(window.innerHeight - AVOID_ZONE_HEIGHT, 0);
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) intersecting.add(entry.target);
            else intersecting.delete(entry.target);
          }
          setAvoiding(intersecting.size > 0);
        },
        { rootMargin: `0px 0px -${bottomMargin}px 0px`, threshold: 0 },
      );
      targets.forEach((target) => observer?.observe(target));
    }

    setup();
    // The button's footprint is a fixed viewport region, so it needs
    // recomputing whenever the viewport itself resizes (rotation, the
    // mobile URL bar collapsing/expanding, etc.).
    window.addEventListener("resize", setup);
    return () => {
      window.removeEventListener("resize", setup);
      observer?.disconnect();
    };
  }, []);

  return avoiding;
}

// Tracks whether the one-time entrance animation (delayed 0.4s so the
// button doesn't pop in before the page settles) has already played, so
// every later scroll-triggered hide/show can transition immediately
// instead of re-applying that entrance delay.
function useHasEntered(delayMs: number): boolean {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setEntered(true), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs]);

  return entered;
}

// Pages where a global "talk to Ariel" affordance is either wrong (auth
// flows, where there's no account yet to attach a conversation to) or
// redundant (the admin side already has its own dedicated access via the
// NotificationBell + /admin/chat; /chat itself IS the destination this
// button would navigate to).
const HIDDEN_PATH_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/chat", "/403"];

function isHidden(pathname: string | null): boolean {
  if (!pathname) return false;
  // Strip the locale segment ("/es/chat" -> "/chat") the same way
  // middleware.ts does, so the check works regardless of locale.
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  return HIDDEN_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// The single global entry point to Ariel's chat, replacing the button
// that used to live inside his card in the Pastors section — same
// destination (/chat), same auth/authorization/conversation logic
// (requireUser() + getOrCreateConversation() at that route, untouched
// here), just relocated and always reachable. Mounted once in the root
// layout (see [locale]/layout.tsx) rather than per-page.
export function PastorChatFloatingButton() {
  const pathname = usePathname();
  const t = useTranslations("chat.floatingButton");
  const reduceMotion = useSafeReducedMotion();
  const scrolling = useHideWhileScrolling();
  const avoidingContent = useAvoidingMarkedContent();
  const hasEntered = useHasEntered(400);

  if (isHidden(pathname)) return null;

  // Content-overlap avoidance isn't a motion preference — it's the button
  // not being allowed to sit on top of text a visitor is reading — so it
  // applies regardless of reduceMotion; only the transient scroll-hide is
  // purely cosmetic and skipped for reduced motion.
  const hideButton = (scrolling && !reduceMotion) || avoidingContent;

  return (
    <motion.div
      className={`fixed right-4 z-40 sm:right-6 ${hideButton ? "pointer-events-none" : ""}`}
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.8, y: 12 }}
      animate={{
        opacity: hideButton ? 0 : 1,
        scale: hideButton && !reduceMotion ? 0.8 : 1,
        y: hideButton && !reduceMotion ? 12 : 0,
      }}
      // The entrance delay (0.4s, so the button doesn't pop in before
      // the rest of the page has settled) only applies once, on mount —
      // every later scroll-triggered hide/show reacts immediately.
      transition={
        hasEntered
          ? { duration: 0.15, ease: "easeOut" }
          : { duration: 0.3, delay: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
    >
      <Link
        href="/chat"
        aria-label={t("ariaLabel")}
        className="inline-flex items-center gap-2 rounded-full bg-primary-900 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lifted transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-500"
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4V16h-.5A2.5 2.5 0 0 1 4 13.5v-8Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="absolute -right-1.5 -top-1.5">
            <ChatNavBadge />
          </span>
        </span>
        <span className="whitespace-nowrap">{t("label")}</span>
      </Link>
    </motion.div>
  );
}
