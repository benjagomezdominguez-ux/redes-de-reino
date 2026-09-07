"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeToPush } from "@/lib/actions/push";
import { isIOS, isStandalone } from "@/lib/pwa/device";
import { Link } from "@/i18n/navigation";

const DEFAULT_DISMISSED_KEY = "chat_push_banner_dismissed";
const SUBSCRIBE_TIMEOUT_MS = 10000;

type PushState =
  | "loading"
  | "default"
  | "granted"
  | "denied"
  | "needs-install" // iOS: Notification/Push APIs don't exist until the site is added to the Home Screen and opened from there
  | "unsupported"; // genuinely unsupported browser — installing wouldn't help either

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

// Real root cause (found live, against production, with a real Chrome
// browser and the real deployed VAPID key): PushPermissionBanner mounts
// TWICE on some pages at once — its own instance (e.g. /account,
// /admin/chat) plus GlobalPushPrompt's floating instance, which is
// mounted on every page. Both instances' mount-time effects independently
// call registerPushSubscription() whenever Notification.permission is
// already "granted" (the "silently reconfirm" path). Two concurrent
// registration.pushManager.subscribe() calls on the SAME registration
// race each other in Chrome — confirmed live via instrumenting the real
// PushManager.subscribe(): both calls start in the same millisecond and
// neither one ever settles, until the 10s SUBSCRIBE_TIMEOUT_MS here fires
// and the whole thing is reported as a failure. A single, uncontested
// retry immediately afterward always succeeds — exactly the reported
// "permiso concedido, pero falla" symptom.
//
// Fix: a module-level in-flight lock so every caller — regardless of how
// many banner instances are mounted — shares the SAME underlying
// subscribe attempt instead of starting a second, colliding one.
let inFlightSubscribe: Promise<boolean> | null = null;

// Registers (or confirms) the push subscription and saves it server-side.
// Returns whether a subscription actually ended up saved — permission
// being "granted" is not the same thing as the subscription existing:
// the service worker might not be ready, or the save call could fail.
function registerPushSubscription(): Promise<boolean> {
  if (inFlightSubscribe) return inFlightSubscribe;
  inFlightSubscribe = registerPushSubscriptionOnce().finally(() => {
    inFlightSubscribe = null;
  });
  return inFlightSubscribe;
}

// Every failure path logs which stage failed and the real browser/server
// error (name + message only — never a full stack with potentially
// sensitive request internals, and nothing server-side like the VAPID
// private key ever reaches this file at all). This is what section 2 of
// the push audit asked for: no more blanket try/catch hiding the cause.
async function registerPushSubscriptionOnce(): Promise<boolean> {
  if (!supportsPush()) {
    console.error("[push] unsupported: Notification/serviceWorker/PushManager not available in this browser");
    return false;
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from this build");
    return false;
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await withTimeout(navigator.serviceWorker.ready, SUBSCRIBE_TIMEOUT_MS);
  } catch (err) {
    console.error("[push] service worker did not become ready in time", err instanceof Error ? err.message : err);
    return false;
  }

  let subscription: PushSubscription | null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("[push] pushManager.getSubscription() failed", err instanceof Error ? err.message : err);
    return false;
  }

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      console.error(
        "[push] pushManager.subscribe() failed",
        err instanceof Error ? { name: err.name, message: err.message } : err
      );
      return false;
    }
  }

  try {
    const result = await subscribeToPush(subscription.toJSON());
    if (!result.ok) console.error("[push] backend rejected the subscription (subscribeToPush returned ok:false)");
    return result.ok;
  } catch (err) {
    console.error("[push] subscribeToPush() Server Action threw", err instanceof Error ? err.message : err);
    return false;
  }
}

// Rendered in /account (any registered user, general notifications like
// a new devotional), /admin/chat (Ariel specifically, chat
// notifications), and — via GlobalPushPrompt — floating on every page for
// any logged-in user. Same subscribe/unsubscribe mechanism everywhere,
// only the copy (namespace) and how persistently it stays visible
// (floating) differ. Never prompts on its own — only ever in response to
// a deliberate "Activar notificaciones" click (rule 15 of the original
// chat prompt: no aggressive permission requests).
//
// `floating`: used for the site-wide prompt, where showing a permanent
// "already enabled"/"blocked"/"unsupported" line on every single page
// would itself be the kind of nagging rule 15 forbids — those states are
// only ever worth surfacing on a dedicated settings surface (/account),
// so in floating mode they render nothing instead. The states that ARE
// still actionable (not yet asked, iOS needs the site installed first, or
// permission granted but saving the subscription failed) still show.
export function PushPermissionBanner({
  namespace = "chat.admin.push",
  floating = false,
  dismissKey = DEFAULT_DISMISSED_KEY,
}: {
  namespace?: string;
  floating?: boolean;
  dismissKey?: string;
}) {
  const t = useTranslations(namespace);
  const [state, setState] = useState<PushState>("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default true until localStorage is checked, to avoid a flash
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Distinguishes "silently reconfirmed an existing subscription on
  // mount" (floating mode stays quiet — rule: don't re-nag someone
  // already subscribed) from "the user just clicked Enable in THIS
  // session" (floating mode still owes them the confirmation message).
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    async function init() {
      // Read the dismissed flag first, unconditionally — every branch
      // below (including "not supported here yet") needs it, and it
      // must not be left stuck at its `true` initial value.
      let wasDismissed = false;
      try {
        wasDismissed = localStorage.getItem(dismissKey) === "1";
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
  }, [dismissKey]);

  async function handleEnable() {
    setBusy(true);
    setError(false);
    try {
      const result = await Notification.requestPermission();
      setState(result);
      if (result === "granted") {
        const ok = await registerPushSubscription();
        setSubscribed(ok);
        if (ok) setJustEnabled(true);
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
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Nothing to persist to — the banner will just show again next load.
    }
  }

  if (state === "loading") return null;

  // Nothing left to do — showing a permanent "you're all set" banner on
  // every page would itself be a form of nagging; a dedicated settings
  // surface (/account) is where "already enabled" is worth confirming.
  // Exception: right after the user just clicked Enable, they're owed the
  // one-time confirmation before it goes quiet on future page loads.
  if (floating && state === "granted" && subscribed && !justEnabled) return null;

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
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/instalar"
            className="self-start text-xs font-semibold text-primary-900 underline transition-colors hover:text-primary-800"
          >
            {t("needsInstallLink")}
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="self-start text-xs font-medium text-primary-900/70 underline transition-colors hover:text-primary-900"
          >
            {t("notNow")}
          </button>
        </div>
      </div>
    );
  }

  if (state === "unsupported") {
    if (floating) return null;
    return <p className="text-sm text-muted">{t("unsupported")}</p>;
  }

  if (state === "denied") {
    if (floating) return null;
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
