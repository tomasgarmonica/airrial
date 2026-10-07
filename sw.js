// Guarda la app en el teléfono para que funcione sin conexión.
const CACHE = 'airrial-v2';
const FILES = ['./', 'index.html', 'style.css', 'music.js', 'audio.js', 'app.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Con conexión trae la versión más nueva; sin conexión (o si tarda más de 3 s) usa la copia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (!cached) return fresh;
    const late = new Promise(done => setTimeout(done, 3000, cached));
    return Promise.race([fresh.catch(() => cached), late]);
  }));
});
