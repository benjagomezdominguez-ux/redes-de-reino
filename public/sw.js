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

// Web Push. Two payload shapes, both built by src/lib/push/web-push.ts,
// both carrying their own `url` now — chat (sendChatPush):
// { title, body, conversationId, url }, general (sendPushToUsers):
// { title, body, url }. `url` is always computed server-side, where the
// real recipient (and, for chat, their real role — Ariel vs a regular
// user) is actually known. This service worker has no notion of role at
// all, so it must never guess a destination itself — a real bug found
// here: this used to hardcode every chat notification's click target to
// /admin/chat, which only Ariel can open; any regular user's chat push
// (now much more common — Ariel can start a conversation with anyone,
// not just reply to one) sent them to a page they'd immediately get
// redirected away from.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Redes de Reino", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.conversationId ? `chat-${payload.conversationId}` : payload.url,
      data: { url: payload.url },
    })
  );
});

// Clicking the OS notification focuses an already-open tab if one
// exists, or opens a new one — either way landing on the payload's own
// `url`, never a URL this file computes itself.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/es";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
