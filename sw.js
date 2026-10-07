// Service worker: app-bestanden vooraf in de cache, lettertypes bij eerste gebruik.
const CACHE = 'tekentrainer-6f243d4dee';
const BESTANDEN = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // Eerst online proberen (zo krijg je updates), anders de cache.
    e.respondWith(fetch(e.request)
      .then((r) => { const kopie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // Lettertypes: uit de cache als ze er zijn, anders ophalen en bewaren.
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return res;
    })));
  }
});
