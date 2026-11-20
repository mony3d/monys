/* খাবার ও স্বাস্থ্য: অফলাইনে খোলার জন্য সার্ভিস ওয়ার্কার।
   অ্যাপের নিজের ফাইলগুলো ফোনে জমা রাখে; লগইন আর ডাটাবেসের অনুরোধ (Google, Firebase) সবসময় ইন্টারনেট দিয়ে যায়।
   নতুন সংস্করণ তুললে নিচের VERSION বদলান। */
const VERSION = 'khabar-2026-11-20-1';
const SHELL = ['./', 'index.html', 'account.js', 'firebase-config.js', 'privacy.html', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google, fonts: straight to the network
  if (req.mode === 'navigate') {
    // pages: try the network first so updates arrive, fall back to the saved copy when offline
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; });
    return hit || net;
  }));
});
