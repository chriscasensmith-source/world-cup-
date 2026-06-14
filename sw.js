/* Service worker — offline fallback only. Never pre-caches, never serves
   cached content while online. This prevents stale code from getting stuck. */
const CACHE = "wc26-v9";

self.addEventListener("install", e => {
  // Skip waiting immediately — no pre-caching that could block or go stale.
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
  // Wipe every old cache and take control of all open tabs instantly.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.postMessage({ type: "RELOAD" })))
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Always go to the network. Only fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("index.html")))
  );
});
