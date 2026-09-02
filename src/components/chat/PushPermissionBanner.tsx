"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeToPush } from "@/lib/actions/push";

const DISMISSED_KEY = "chat_push_banner_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator) || typeof window === "undefined" || !("PushManager" in window)) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  await subscribeToPush(subscription.toJSON());
}

// Admin-only (rule 13-18 of the chat prompt scope OS-level notifications
// to Ariel/admins specifically). Never prompts on its own — only ever in
// response to the admin clicking "Activar notificaciones", per rule 15.
export function PushPermissionBanner() {
  const t = useTranslations("chat.admin.push");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState(true); // default true until localStorage is checked, to avoid a flash
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function init() {
      if (typeof Notification === "undefined") {
        setPermission("unsupported");
        return;
      }
      setPermission(Notification.permission);

      let wasDismissed = false;
      try {
        wasDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
      } catch {
        // Private browsing / storage blocked — treat as not dismissed.
      }
      setDismissed(wasDismissed);

      // Already granted in an earlier session: silently (re)confirm the
      // push subscription exists, without showing any UI or re-prompting.
      if (Notification.permission === "granted") {
        await registerPushSubscription().catch(() => {});
      }
    }
    init();
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await registerPushSubscription();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to persist to — the banner will just show again next load.
    }
  }

  if (permission !== "default" || dismissed) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text">{t("prompt")}</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {t("enable")}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
        >
          {t("notNow")}
        </button>
      </div>
    </div>
  );
}
