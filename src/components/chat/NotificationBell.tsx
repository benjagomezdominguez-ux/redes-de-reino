"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { refreshAdminConversations } from "@/lib/actions/chat";
import type { AdminConversationListItem } from "@/lib/admin/chat-queries";
import { getSupabaseBrowserSessionClientReady } from "@/lib/supabase/browser-session";

type IncomingMessage = {
  conversation_id: string;
  sender_role: "user" | "admin";
  content: string;
};

export function NotificationBell() {
  const t = useTranslations("chat.admin.bell");
  const locale = useLocale();
  const pathname = usePathname();
  // The Navbar renders this twice at once — one copy per responsive
  // breakpoint (same pattern as CartIcon), each hidden via CSS rather
  // than conditionally mounted. Supabase caches realtime channels by
  // topic name, so two instances sharing one hardcoded name would have
  // the second instance's .on() throw ("cannot add callbacks... after
  // subscribe()") against the first instance's already-subscribed
  // channel — confirmed live. A per-instance id keeps each mount on its
  // own channel.
  const instanceId = useId();
  const [conversations, setConversations] = useState<AdminConversationListItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const unreadConversations = conversations.filter((c) => c.unreadCount > 0);

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;

    async function refresh() {
      const next = await refreshAdminConversations();
      if (active) setConversations(next);
      return next;
    }

    async function setup() {
      // See ChatWindow.tsx for why this await is required before opening
      // any channel — otherwise it subscribes with no error but never
      // delivers a single event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;

      await refresh();

      channel = supabase
        .channel(`admin-chat-notifications:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload: RealtimePostgresChangesPayload<IncomingMessage>) => {
            const message = payload.new as IncomingMessage;
            if (message.sender_role !== "user") return; // only user → admin messages notify Ariel/admins
            const list = await refresh();

            // Case 1 (already inside /admin/chat, tab focused): the chat
            // UI itself already reflects the new message live — no need
            // to also pop an OS notification for something already on
            // screen.
            const alreadyViewing = pathnameRef.current?.includes("/admin/chat") && document.hasFocus();
            if (alreadyViewing) return;

            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const sender = list.find((c) => c.id === message.conversation_id);
              const notification = new Notification(t("osTitle"), {
                body: `${sender?.userName ?? t("osFallbackSender")}: ${message.content.slice(0, 120)}`,
                icon: "/icon-192.png",
                tag: `chat-${message.conversation_id}`,
              });
              notification.onclick = () => {
                window.focus();
                // A plain browser Notification's onclick isn't a React
                // event — there's no router instance available here, and
                // this may fire against a background/unfocused tab, so a
                // real navigation (not client-side routing) is correct.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = `/${locale}/admin/chat?conversation=${message.conversation_id}`;
              };
            }
          }
        )
        .subscribe();
    }
    setup();

    return () => {
      active = false;
      channel?.unsubscribe();
    };
  }, [t, locale, instanceId]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("ariaLabel")}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-900/80 transition-colors hover:text-primary-900"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
        </svg>
        {unreadTotal > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
            {unreadTotal}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lifted"
        >
          <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-secondary-600">
            {t("title")}
          </p>
          {unreadConversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{t("empty")}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {unreadConversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/chat?conversation=${c.id}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 text-sm transition-colors hover:bg-primary-900/5"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text">{c.userName}</span>
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    </span>
                    <span className="line-clamp-1 text-xs text-muted">{c.lastMessage}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
