// Service worker: permite instalar la app y usarla sin conexiÃ³n.
const CACHE = "cuentas-claras-20260912-072356";
const LOCALES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const EXTERNOS = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(LOCALES).then(() => Promise.all(EXTERNOS.map(u => c.add(u).catch(() => {})))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, host = new URL(req.url).hostname;
  if (req.method !== "GET") return;
  // solo se guardan copias de la app y sus librerÃ­as; nunca de Firebase (cuentas y base de datos)
  const cacheable = host === self.location.hostname || host.endsWith("gstatic.com") || host === "cdnjs.cloudflare.com" || host === "fonts.googleapis.com";
  if (!cacheable) return;
  if (req.mode === "navigate") {
    // la pÃ¡gina: primero internet (para recibir actualizaciones), si no hay, la copia guardada
    e.respondWith(fetch(req)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put("index.html", copia)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return r;
  })));
});