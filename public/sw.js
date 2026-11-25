/* Стилова карта: offline cache. Version changes with every build. */
var CACHE = 'stilova-karta-7bd7c0c44f';
var ASSETS = ["/", "index.html", "terms.html", "privacy.html", "terms.en.html", "privacy.en.html", "manifest.webmanifest", "fonts/onest-cyrillic-400-normal.woff2", "fonts/onest-cyrillic-500-normal.woff2", "fonts/onest-cyrillic-600-normal.woff2", "fonts/onest-latin-400-normal.woff2", "fonts/onest-latin-500-normal.woff2", "fonts/onest-latin-600-normal.woff2", "fonts/prata-cyrillic-400-normal.woff2", "fonts/prata-latin-400-normal.woff2", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    /* pages: network first, so a new version shows up; cache when offline */
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  /* files: cache first */
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
