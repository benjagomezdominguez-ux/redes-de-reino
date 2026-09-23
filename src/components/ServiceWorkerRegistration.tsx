"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cleanupVisibilityCheck = () => {};

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
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

        // The browser only checks for a new SW version on navigation —
        // never just from the tab/PWA sitting open. A PWA reopened from
        // the app switcher (resumed, not relaunched) never navigates at
        // all, so it can go days without that check ever happening, no
        // matter how many deploys have shipped since. registration.update()
        // forces the byte-diff check on demand; calling it once now and
        // again every time the page regains visibility (switching back
        // to an already-open tab/PWA, not just on first load) is what
        // actually catches that case, instead of only reacting after an
        // update happens to already be found.
        registration.update().catch(() => {});
        function handleVisibilityChange() {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange);
        cleanupVisibilityCheck = () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      })
      .catch(() => {
        // Installability is a progressive enhancement — a failed
        // registration shouldn't affect anything else on the page.
      });

    return () => cleanupVisibilityCheck();
  }, []);

  return null;
}
