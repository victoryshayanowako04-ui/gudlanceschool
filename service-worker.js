const CACHE_NAME = 'haven-school-v3';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './stationery.js',
  './parent-portal.js',
  './manifest.json',
  './favicon.png',
  './js/config.js',
  './js/navigation.js',
  './js/auth.js',
  './js/enrollment.js',
  './js/finance.js',
  './js/academics.js',
  './js/settings.js',
  './js/icons.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((path) =>
        cache.add(path).catch(() => console.warn(`[Service Worker] Could not cache ${path}`))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && response.status !== 206) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then((cached) =>
        cached || (event.request.mode === 'navigate'
          ? caches.match('./index.html')
          : Response.error())
      )
    )
  );
});
