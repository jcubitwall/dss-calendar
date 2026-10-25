// Offline support: serve from cache instantly, refresh the cache in the background.
const CACHE = 'dss-v1';
const CORE = ['./', 'index.html', 'app.css', 'app.js', 'timeline.js', 'lookup.js', 'engine/dss.js',
  'engine/tekufah-table.json', 'data/events.json', 'icon.svg', 'apple-touch-icon.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !fonts) return;                       // Wikipedia, Bible API etc. go straight to the network
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: same && url.pathname.endsWith('/') });
    const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
