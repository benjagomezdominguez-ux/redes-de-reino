"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        // Only act on an update while this page was ALREADY controlled
        // by a previous service worker — i.e. a returning visit, not
        // this browser's very first-ever load (which has no controller
        // yet at this point, so the check below is false and nothing is
        // attached). A real update — confirmed live: an already-open
        // PWA whose JS predates a new deploy calls a Server Action
        // (login included) using a stale action id the new server
        // doesn't recognize, which fails outright (see
        // src/app/[locale]/error.tsx for the other half of this fix) —
        // now reloads exactly once to pick up the new deployment's JS
        // before the user ever submits a form with it. controllerclaim
        // (self.clients.claim() in sw.js) is what makes this fire
        // promptly instead of waiting for every open tab to close.
        if (navigator.serviceWorker.controller) {
          let reloaded = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
        }
      })
      .catch(() => {
        // Installability is a progressive enhancement — a failed
        // registration shouldn't affect anything else on the page.
      });
  }, []);

  return null;
}
