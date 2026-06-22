/* Service worker (League 2) — network-first, always bypasses HTTP cache for
   code files so stale JS/CSS/HTML can never get stuck. Cache is offline
   fallback only. Scoped to /draft2/ so it never touches the main league. */
const CACHE = "wc26-l2-v1";

self.addEventListener("install", e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isCode = /\.(html|js|css)(\?|$)/.test(url.pathname);

  const networkReq = isCode ? new Request(req.url, { cache: "no-cache" }) : req;

  e.respondWith(
    fetch(networkReq)
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
