/* Service worker — network-first so code & results are always fresh,
   with cache as an offline fallback. Bump CACHE on any shipped change. */
const CACHE = "wc26-v8";
const SHELL = [
  ".",
  "index.html",
  "css/styles.css",
  "js/config.js",
  "js/app.js",
  "favicon.svg",
  "manifest.webmanifest",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Network-first for everything: always try the live version, fall back to
  // cache only when offline. Keeps the cache warm for offline use.
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
