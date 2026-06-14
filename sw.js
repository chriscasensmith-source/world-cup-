/* Service worker: offline app shell + always-fresh results.
   Bump CACHE when you change app files. */
const CACHE = "wc26-v1";
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
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Results: network-first so an online tab always gets the latest scores.
  if (url.pathname.endsWith("data/matches.json")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // App shell: cache-first for instant loads / offline.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
