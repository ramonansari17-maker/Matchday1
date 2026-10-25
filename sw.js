/* Matchday PWA service worker: cache the app shell, never stale live-score API data. */
'use strict';
const CACHE_NAME = 'matchday-app-shell-v3.4.0';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './football-icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('matchday-app-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Live data and photos stay network-driven.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  if (/\.(?:html|webmanifest|svg|png|ico|css|js)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
