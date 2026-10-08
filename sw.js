// Guarda la app en el teléfono para que funcione sin conexión.
const CACHE = 'airrial-v6';
const INBOX = 'airrial-inbox';
const FILES = ['./', 'index.html', 'style.css', 'music.js', 'audio.js', 'export.js', 'app.js',
  'manifest.webmanifest', 'incluidas.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== INBOX).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Con conexión trae la versión más nueva; sin conexión (o si tarda más de 3 s) usa la copia guardada.
// Archivo compartido hacia Airrial desde otra app (menú Compartir del teléfono):
// se deja en una bandeja y se abre la pantalla que lo muestra.
async function receive(request) {
  try {
    const file = (await request.formData()).get('archivo');
    const box = await caches.open(INBOX);
    await box.put('recibido', new Response(file ? await file.text() : ''));
  } catch { /* se abre igual y la app avisa que no pudo leerlo */ }
  return Response.redirect('./#/r', 303);
}

self.addEventListener('fetch', e => {
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/recibir')) {
    e.respondWith(receive(e.request));
    return;
  }
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    // 'no-cache': siempre consulta al servidor; si no, el navegador reutiliza archivos viejos hasta 10 minutos.
    const fresh = fetch(e.request.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (!cached) return fresh;
    const late = new Promise(done => setTimeout(done, 3000, cached));
    return Promise.race([fresh.catch(() => cached), late]);
  }));
});
