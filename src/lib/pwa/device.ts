"use client";

// Shared device/install-state detection — the single source of truth,
// reused by both the push-permission banner (needs to know "can this
// browser even show a native prompt yet") and the install-instructions
// page (needs to know "which of the three cards to lead with"). Used to
// be defined twice (this exact isIOS()/isStandalone() pair also lived
// inline in PushPermissionBanner.tsx) — consolidated here instead.

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iPadOS 13+ reports as "MacIntel" with touch support, not as iPad.
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

// "Desktop" here just means "neither of the two mobile platforms we give
// dedicated instructions for" — Windows, macOS, Linux, ChromeOS all fall
// here, and all share the same "look for the install icon" guidance.
export function isDesktop(): boolean {
  return !isIOS() && !isAndroid();
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export type DeviceKind = "ios" | "android" | "desktop";

export function detectDeviceKind(): DeviceKind {
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "desktop";
}
