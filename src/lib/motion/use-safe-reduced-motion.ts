"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// motion's own useReducedMotion() reads the real device preference
// synchronously on the client's very first render (it calls
// window.matchMedia directly inside the hook body, not inside an
// effect) — server-side it's always null. Confirmed live: a visitor who
// already has reduced motion enabled triggers a genuine React hydration
// mismatch (error #418) the moment any component branches its `initial`/
// `animate` props on that raw value, because the server and the client's
// first paint disagree on which branch to render.
//
// useSyncExternalStore is the correct fix (not a `useEffect` + local
// "mounted" flag — that pattern causes an avoidable extra render and is
// its own lint error, react-hooks/set-state-in-effect): React guarantees
// the client's hydration pass uses getServerSnapshot() to match the
// server exactly, then reconciles to the real getSnapshot() value
// immediately after — a safe post-hydration update, not a mismatch.
// Mirrors the same pattern already used in src/lib/pwa/device.ts's
// consumers (useDeviceKind/useIsStandalone in InstallGuide.tsx) for the
// identical "real value only exists client-side" problem.
export function useSafeReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
