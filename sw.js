// sw.js — network-first for HTML, cache-first for static assets
// Increase the cache version whenever assets change.  This forces browsers
// to discard old caches and pull the latest files.
const CACHE = 'trader-prep-v53';

// A list of core assets to pre‑cache.  Because our entry point is named
// `indexhtml.txt` in this repository, include that file explicitly rather
// than `index.html`.  The manifest and icons have been corrected and
// included here as well.  If you rename your HTML file to `index.html`
// later, update this list accordingly.
const ASSETS = [
  './',
  // Pre-cache both index.html (primary entry point on GitHub Pages) and
  // indexhtml.txt (alternate filename used in this repo).  Having both
  // ensures offline functionality regardless of which filename the
  // server is serving.
  './index.html',
  './indexhtml.txt',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png'
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
          // Fall back to the cached HTML entrypoints when offline.  First try
          // the request itself from the cache, then index.html, then indexhtml.txt.
          caches.match(req).then(r =>
            r || caches.match('./index.html').then(r2 => r2 || caches.match('./indexhtml.txt'))
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
