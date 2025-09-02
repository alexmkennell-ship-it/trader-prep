// sw.js — network-first for HTML, cache-first for static assets
// Increase the cache version whenever assets change.  This forces browsers
// to discard old caches and pull the latest files.
const CACHE = 'trader-prep-v56';

// A list of core assets to pre‑cache. Include the HTML entry point,
// manifest, icons, and bundled static files.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './style.css',
  './main.js'
];

// Install: pre-cache core assets
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting(); // take over ASAP
});

// Activate: clean old caches
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Helper: treat navigations and HTML requests as "HTML"
function isHTMLRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

// Fetch handler
self.addEventListener('fetch', evt => {
  const req = evt.request;
  if (req.method !== 'GET') return; // don’t mess with POST/PUT/etc.
  // Allow cross-origin requests (APIs, proxies) to pass through untouched
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // NETWORK-FIRST for HTML (index & navigations)
  if (isHTMLRequest(req)) {
    evt.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() =>
        // Fall back to the cached HTML entry point when offline. First try
        // the request itself from the cache, then index.html.
        caches.match(req).then(r =>
          r || caches.match('./index.html')
        )
        )
    );
    return;
  }

  // CACHE-FIRST for everything else (icons, manifest, images, CSS, JS)
  evt.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Only cache valid, same-origin (or opaque) GET responses
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => cached); // if fetch fails, fall back (if any)
    })
  );
});

// Optional: allow page to tell the SW to activate immediately
self.addEventListener('message', evt => {
  if (evt.data && evt.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
