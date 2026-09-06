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

// Web Push. Two payload shapes, both built by src/lib/push/web-push.ts:
// - chat (sendChatPush): { title, body, conversationId } — admin-only,
//   fires only for a subscription an admin explicitly created (see
//   PushPermissionBanner.tsx).
// - general (sendPushToUsers): { title, body, url } — any registered
//   user who opted in (e.g. a newly published devotional).
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
      data: { conversationId: payload.conversationId, url: payload.url },
    })
  );
});

// Clicking the OS notification focuses an already-open tab if one
// exists, or opens a new one — either way landing on whatever triggered
// it: the conversation for a chat push (rule 14 of the original chat
// prompt), or the payload's own `url` for a general one (e.g. the
// devotional that was just published).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.conversationId
    ? `/es/admin/chat?conversation=${data.conversationId}`
    : data.url || "/es";

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
