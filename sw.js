/* Service worker — network-first, always bypasses HTTP cache for code files
   so stale JS/CSS/HTML can never get stuck. Cache is offline fallback only. */
const CACHE = "wc26-v15";

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

  // For HTML/JS/CSS: bypass the browser HTTP cache entirely so GitHub Pages
  // CDN staleness can't block new code from reaching the page.
  // For everything else (fonts, images, data): normal network-first.
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
