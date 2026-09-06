"use client";

// Captures the browser's native "beforeinstallprompt" event (Chrome/Edge
// on Android and desktop — never fired by Safari/iOS, which has no such
// API) as early as possible, so the /instalar page can trigger the real
// install flow even if the user navigates there well after the event
// fired. A module-scoped store rather than React context on purpose:
// InstallPromptCapture mounts once in the root layout, before any page
// content, so it's guaranteed to be listening before the browser could
// possibly fire the event — a page-local listener could miss it if the
// event fires during initial load, before that page's component mounts.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureStarted = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function initInstallPromptCapture(): void {
  if (typeof window === "undefined" || captureStarted) return;
  captureStarted = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress the browser's own mini-infobar — the /instalar page is
    // the one real "Instalar Redes de Reino" button, not a second,
    // uncoordinated one the browser shows on its own.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function hasDeferredInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export function subscribeToInstallPrompt(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Never renders a button that does nothing: returns "unavailable" when
// there's no captured event to replay (e.g. iOS, or a desktop browser
// that never fired one), so the caller can fall back to manual
// instructions instead of a dead button.
export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const prompt = deferredPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome;
}
