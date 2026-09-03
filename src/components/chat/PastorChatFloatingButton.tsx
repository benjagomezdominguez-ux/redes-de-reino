"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChatNavBadge } from "@/components/chat/ChatNavBadge";

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

  if (isHidden(pathname)) return null;

  return (
    <Link
      href="/chat"
      aria-label={t("ariaLabel")}
      className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary-900 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-lifted transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-500 sm:right-6"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
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
  );
}
