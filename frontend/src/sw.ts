/// <reference lib="webworker" />
// Custom service worker source for vite-plugin-pwa's `injectManifest` strategy --
// switched from `generateSW` specifically to add the push/notificationclick
// handlers below; Workbox's auto-generated worker has no hook for custom runtime
// code. Excluded from `tsc` (see tsconfig.json) since "webworker" lib types
// conflict with the main app's "dom" lib in the same project.
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; tag?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Stormglass', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Stormglass', {
      body: payload.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    })
  );
});

// Focus an already-open Stormglass tab rather than always opening a new one.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
