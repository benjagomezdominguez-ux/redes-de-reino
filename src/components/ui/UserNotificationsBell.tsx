"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { listMyNotifications, markNotificationRead, type NotificationListItem } from "@/lib/actions/notifications";
import { getSupabaseBrowserSessionClientReady } from "@/lib/supabase/browser-session";

// General, per-user notification bell — distinct from chat's
// NotificationBell (admin-only, unread conversation counts). Any
// registered user gets this; first consumer is "new devotional
// published" (Fase 14-16 of the "modificación integral" prompt).
export function UserNotificationsBell() {
  const t = useTranslations("notifications.bell");
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Navbar renders this twice at once (desktop + mobile), same reason as
  // ChatNavBadge/NotificationBell — a shared channel name would collide.
  const instanceId = useId();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;

    async function refresh() {
      const list = await listMyNotifications();
      if (active) setNotifications(list);
    }

    async function setup() {
      await refresh();

      // See ChatWindow.tsx for why this await is required before opening
      // any channel — otherwise it subscribes with no error but never
      // delivers a single event.
      const supabase = await getSupabaseBrowserSessionClientReady();
      if (!active) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      channel = supabase
        .channel(`notifications:${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => refresh()
        )
        .subscribe();
    }
    setup();

    return () => {
      active = false;
      channel?.unsubscribe();
    };
  }, [instanceId]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSelect(notification: NotificationListItem) {
    setOpen(false);
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      await markNotificationRead(notification.id);
    }
    if (notification.link_path) router.push(notification.link_path);
  }

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
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
            {unreadCount}
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
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{t("empty")}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-primary-900/5 ${
                      n.read_at ? "" : "bg-primary-900/5"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-text">{n.title}</span>
                      {!n.read_at ? <span className="h-2 w-2 shrink-0 rounded-full bg-error" aria-hidden="true" /> : null}
                    </span>
                    {n.body ? <span className="line-clamp-2 text-xs text-muted">{n.body}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
