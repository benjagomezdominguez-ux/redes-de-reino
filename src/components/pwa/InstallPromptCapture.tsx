"use client";

import { useEffect } from "react";
import { initInstallPromptCapture } from "@/lib/pwa/install-prompt";

// Mounted once in the root layout, next to ServiceWorkerRegistration —
// starts listening for the browser's native install prompt as early as
// possible (see install-prompt.ts for why timing matters here).
export function InstallPromptCapture() {
  useEffect(() => {
    initInstallPromptCapture();
  }, []);

  return null;
}
