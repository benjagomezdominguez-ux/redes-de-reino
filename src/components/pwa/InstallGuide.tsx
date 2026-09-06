"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { detectDeviceKind, isStandalone, type DeviceKind } from "@/lib/pwa/device";
import { hasDeferredInstallPrompt, subscribeToInstallPrompt, triggerInstallPrompt } from "@/lib/pwa/install-prompt";

const CARD_ORDER: { kind: DeviceKind; icon: string }[] = [
  { kind: "ios", icon: "📱" },
  { kind: "android", icon: "🤖" },
  { kind: "desktop", icon: "💻" },
];

function useHasNativeInstallPrompt(): boolean {
  // getServerSnapshot always returns false — the real answer only exists
  // client-side (it depends on a live browser event), so SSR/hydration
  // never claims a native button is available when it might not be.
  return useSyncExternalStore(subscribeToInstallPrompt, hasDeferredInstallPrompt, () => false);
}

// Neither of these ever change after mount, so subscribe is a no-op —
// this is just useSyncExternalStore's documented pattern for "read a
// browser global whose real value only exists client-side" without
// either a hydration mismatch or a setState-in-effect cascade: the
// server snapshot is a safe default, and React re-renders with the real
// client snapshot right after hydration, automatically.
function noopSubscribe() {
  return () => {};
}

function useDeviceKind(): DeviceKind | null {
  return useSyncExternalStore(noopSubscribe, detectDeviceKind, () => null);
}

function useIsStandalone(): boolean {
  return useSyncExternalStore(noopSubscribe, isStandalone, () => false);
}

// Only ever rendered where a real captured browser event exists — never
// a button that does nothing. Android and desktop Chrome/Edge are the
// only browsers that ever fire beforeinstallprompt; Safari/iOS never
// does, so this never appears on the iPhone/iPad card.
function NativeInstallButton() {
  const t = useTranslations("install");
  const hasPrompt = useHasNativeInstallPrompt();
  const [status, setStatus] = useState<"idle" | "prompting" | "accepted" | "dismissed">("idle");

  if (status === "accepted") {
    return (
      <p role="status" className="text-sm font-semibold text-success">
        ✓ {t("nativeInstalled")}
      </p>
    );
  }

  if (!hasPrompt) return null;

  async function handleClick() {
    setStatus("prompting");
    const outcome = await triggerInstallPrompt();
    setStatus(outcome === "accepted" ? "accepted" : outcome === "dismissed" ? "dismissed" : "idle");
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "prompting"}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {status === "prompting" ? t("nativeInstalling") : t("nativeInstallButton")}
      </button>
      {status === "dismissed" ? <p className="text-xs text-muted">{t("nativeDismissed")}</p> : null}
    </div>
  );
}

function DeviceCard({ kind, icon, isCurrent }: { kind: DeviceKind; icon: string; isCurrent: boolean }) {
  const t = useTranslations("install");
  const steps = t.raw(`${kind}.steps`) as string[];

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border p-6 shadow-soft sm:p-8 ${
        isCurrent ? "border-primary-900/40 bg-primary-900/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          {icon}
        </span>
        <h3 className="font-display text-xl font-medium text-primary-900 sm:text-2xl">{t(`${kind}.title`)}</h3>
      </div>
      {isCurrent ? (
        <span className="w-fit rounded-full bg-primary-900 px-3 py-1 text-xs font-semibold text-white">
          {t("yourDevice")}
        </span>
      ) : null}

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-3 text-base text-text sm:text-lg">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-900/10 text-sm font-semibold text-primary-900"
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {kind === "ios" ? <p className="text-sm text-muted">{t("ios.note")}</p> : null}
      {kind === "desktop" ? <p className="text-sm text-muted">{t("desktop.note")}</p> : null}
      {/* Only on the card that matches the device actually browsing right
          now — showing it on every non-iOS card too would mean the same
          single captured prompt appears to offer two separate buttons. */}
      {isCurrent && (kind === "android" || kind === "desktop") ? <NativeInstallButton /> : null}
    </div>
  );
}

export function InstallGuide() {
  const t = useTranslations("install");
  // null on the server and during the first client render — avoids ever
  // claiming a specific device before hydration, when the real answer
  // only exists client-side. All three cards still render either way;
  // this only affects ordering and the "tu dispositivo" badge.
  const deviceKind = useDeviceKind();
  const alreadyInstalled = useIsStandalone();

  const orderedCards = deviceKind
    ? [...CARD_ORDER].sort((a, b) => Number(b.kind === deviceKind) - Number(a.kind === deviceKind))
    : CARD_ORDER;

  return (
    <div className="flex flex-col gap-8">
      {alreadyInstalled ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/5 p-5 text-base font-semibold text-success"
        >
          <span aria-hidden="true">✓</span>
          {t("alreadyInstalled")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {orderedCards.map((card) => (
          <DeviceCard key={card.kind} kind={card.kind} icon={card.icon} isCurrent={card.kind === deviceKind} />
        ))}
      </div>
    </div>
  );
}
