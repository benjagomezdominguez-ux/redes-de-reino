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

// Web Push (chat notifications). The payload is the JSON string built by
// sendChatPushToAdmins() (src/lib/push/web-push.ts) — { title, body,
// conversationId }. This only ever fires for a subscription an admin
// explicitly created (see PushPermissionBanner.tsx); nothing here can be
// triggered without that opt-in.
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
      tag: payload.conversationId ? `chat-${payload.conversationId}` : undefined,
      data: { conversationId: payload.conversationId },
    })
  );
});

// Clicking the OS notification focuses an already-open tab if one
// exists, or opens a new one — either way landing on the conversation
// that triggered it, per rule 14 ("al hacer clic, abrir directamente la
// conversación correspondiente").
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data && event.notification.data.conversationId;
  const targetUrl = conversationId ? `/es/admin/chat?conversation=${conversationId}` : "/es/admin/chat";

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
