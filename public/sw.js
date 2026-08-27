const CACHE_NAME = "redes-de-reino-v2";
const CORE_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Navigations (full-page loads, including locale switches) are left
// completely untouched. Re-dispatching a navigation's fetch from inside
// the service worker changes how the browser reports it to the server
// (Sec-Fetch-Dest stops being "document"), which broke next-intl's
// middleware — it uses that header to decide whether to persist the
// visitor's language choice in a cookie. Only static assets get the
// network-first + offline-cache treatment.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
