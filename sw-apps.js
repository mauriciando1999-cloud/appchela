// sw-apps.js - Service worker mínimo, solo para que apps.html cumpla los
// requisitos de instalación como PWA (Chrome/Android los exige). No cachea
// nada ni intercepta de verdad las peticiones — cada pedido se deja pasar
// tal cual a la red, así no interfiere con ninguna otra página del sitio.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
