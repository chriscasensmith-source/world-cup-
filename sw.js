/* Service worker — network-first so code & results are always fresh, with
   cache as an offline fallback only. Never pre-caches, never messages clients
   (an earlier RELOAD postMessage caused an infinite reload loop). */
const CACHE = "wc26-v11";

self.addEventListener("install", e => {
  // Activate immediately; nothing to pre-cache.
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
  // Drop every old cache, then take control of open pages.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Always try the network first; fall back to cache only when offline.
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
