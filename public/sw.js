/* Sparrow service worker: keeps the app shell so it opens offline. It handles only this site's own files.
 * GitHub API calls pass straight through; the vault's offline copy lives in IndexedDB, not here.
 * Pages (navigations) are network first, so a new deploy shows up on the next open; built files have hashed names,
 * so they are cache first. Bump VERSION to drop every old cache. */
const VERSION = 'v5';
const CACHE = 'story-forge-shell-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('story-forge-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Every deploy gives the app's script and styles new names, so without this the iPad keeps a copy of each old one
 * (about 1 MB a deploy). Once a new page is saved, drop the scripts and styles it no longer names. Fonts and pictures
 * keep their names between deploys and stay. */
function prune(cache, html) {
  const named = new Set((html.match(/assets\/[^"'\s>]+\.(?:js|css)/g) || []));
  if (!named.size) return Promise.resolve();
  return cache.keys().then((reqs) => Promise.all(reqs.map((r) => {
    const m = /assets\/[^/?#]+\.(?:js|css)$/.exec(new URL(r.url).pathname);
    return m && !named.has(m[0]) ? cache.delete(r) : null;
  })));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only a good page replaces the offline copy: an error page from GitHub would otherwise be what opens offline.
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(copy.text().then((html) => caches.open(CACHE).then((c) =>
              c.put('./index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).then(() => prune(c, html)))));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
