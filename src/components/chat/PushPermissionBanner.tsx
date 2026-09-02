"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeToPush } from "@/lib/actions/push";

const DISMISSED_KEY = "chat_push_banner_dismissed";
const SUBSCRIBE_TIMEOUT_MS = 10000;

type PushState =
  | "loading"
  | "default"
  | "granted"
  | "denied"
  | "needs-install" // iOS: Notification/Push APIs don't exist until the site is added to the Home Screen and opened from there
  | "unsupported"; // genuinely unsupported browser — installing wouldn't help either

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ reports as "MacIntel" with touch support, not as iPad.
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function supportsPush(): boolean {
  return (
    typeof Notification !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Registers (or confirms) the push subscription and saves it server-side.
// Returns whether a subscription actually ended up saved — permission
// being "granted" is not the same thing as the subscription existing:
// the service worker might not be ready, or the save call could fail.
async function registerPushSubscription(): Promise<boolean> {
  if (!supportsPush()) return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return false;

  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, SUBSCRIBE_TIMEOUT_MS);
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const result = await subscribeToPush(subscription.toJSON());
    return result.ok;
  } catch {
    return false;
  }
}

// Private to Ariel (see isChatAdmin) — rendered in both /account and
// /admin/chat. Never prompts on its own — only ever in response to a
// deliberate "Activar notificaciones" click (rule 15 of the original
// chat prompt: no aggressive permission requests).
export function PushPermissionBanner() {
  const t = useTranslations("chat.admin.push");
  const [state, setState] = useState<PushState>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default true until localStorage is checked, to avoid a flash
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function init() {
      // Read the dismissed flag first, unconditionally — every branch
      // below (including "not supported here yet") needs it, and it
      // must not be left stuck at its `true` initial value.
      let wasDismissed = false;
      try {
        wasDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
      } catch {
        // Private browsing / storage blocked — treat as not dismissed.
      }
      setDismissed(wasDismissed);

      if (!supportsPush()) {
        setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }

      setState(Notification.permission);

      // Already granted in an earlier session: silently (re)confirm the
      // push subscription exists, without showing any prompt.
      if (Notification.permission === "granted") {
        const ok = await registerPushSubscription();
        setSubscribed(ok);
      }
    }
    init();
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(false);
    try {
      const result = await Notification.requestPermission();
      setState(result);
      if (result === "granted") {
        const ok = await registerPushSubscription();
        setSubscribed(ok);
        if (!ok) setError(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    setBusy(true);
    setError(false);
    try {
      const ok = await registerPushSubscription();
      setSubscribed(ok);
      if (!ok) setError(true);
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

  if (state === "loading") return null;

  if (state === "granted" && subscribed) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success">
        <span aria-hidden="true">✓</span>
        {t("enabled")}
      </p>
    );
  }

  // Permission is already granted (the browser remembers this across
  // sessions) but no subscription is saved — e.g. the save call failed,
  // or the browser blocked it after the fact. Never fall through to a
  // silent blank here: this is exactly the failure mode that hid the
  // button in the first place, just one step later in the flow.
  if (state === "granted" && !subscribed) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="text-sm font-medium text-error">
          {t("error")}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {busy ? t("enabling") : t("retry")}
        </button>
      </div>
    );
  }

  if (dismissed) return null;

  if (state === "needs-install") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <p className="text-sm font-medium text-text">{t("needsInstallTitle")}</p>
        <p className="text-sm text-muted">{t("needsInstallBody")}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="self-start text-xs font-medium text-primary-900/70 underline transition-colors hover:text-primary-900"
        >
          {t("notNow")}
        </button>
      </div>
    );
  }

  if (state === "unsupported") {
    return <p className="text-sm text-muted">{t("unsupported")}</p>;
  }

  if (state === "denied") {
    return <p className="text-sm text-muted">{t("denied")}</p>;
  }

  if (state !== "default") return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-text">{t("prompt")}</p>
        {error ? (
          <p role="alert" className="mt-1 text-xs font-medium text-error">
            {t("error")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {busy ? t("enabling") : t("enable")}
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
