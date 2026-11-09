// Service Worker: Seite und Termindaten werden zwischengespeichert. Erst das Netz, bei Ausfall der letzte Stand.
const CACHE = 'eventkalender-v4';
const GRUNDSTOCK = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/arten.js', 'js/filter.js', 'js/ort.js', 'js/render.js', 'js/theme.js', 'js/ueber.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/barlow-condensed-600-latin.woff2', 'fonts/barlow-condensed-600-latin-ext.woff2',
  'fonts/barlow-condensed-700-latin.woff2', 'fonts/barlow-condensed-700-latin-ext.woff2',
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2',
  'data/events.json', 'data/status.json', 'data/places.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Einzeln, damit eine fehlende Datei (z. B. noch keine Daten) die Installation nicht verhindert.
    await Promise.all(GRUNDSTOCK.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const antwort = await fetch(anfrage);
      if (antwort.ok) cache.put(anfrage, antwort.clone());
      return antwort;
    } catch {
      const gemerkt = await cache.match(anfrage, { ignoreSearch: true });
      if (gemerkt) return gemerkt;
      if (anfrage.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
      return Response.error();
    }
  })());
});
