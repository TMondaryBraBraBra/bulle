/* =========================================================
   BULLE — service worker
   Met à jour l'app en arrière-plan et la rend dispo hors-ligne.
   ========================================================= */
'use strict';

const VERSION = '1.0.0';
const SHELL_CACHE = 'bulle-shell-v' + VERSION;
const COVER_CACHE = 'bulle-covers-v1';
const COVER_LIMIT = 320;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './css/styles.css',
  './data/seed.js',
  './js/store.js',
  './js/api.js',
  './js/core.js',
  './js/screens-home.js',
  './js/screens-library.js',
  './js/screens-settings.js',
  './js/sheet.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

const COVER_HOSTS = [
  's4.anilist.co',
  'img.anili.st',
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
  'lh3.googleusercontent.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // cache: 'reload' contourne le cache HTTP du navigateur : indispensable
      // pour que la nouvelle version soit réellement récupérée après un déploiement.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .catch((err) => console.warn('[Bulle SW] Précache partiel :', err))
  );
  // Pas de skipWaiting ici : l'app affiche « Mettre à jour » et l'utilisateur décide.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== SHELL_CACHE && key !== COVER_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isCoverRequest(url) {
  return COVER_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
}

async function trimCoverCache() {
  try {
    const cache = await caches.open(COVER_CACHE);
    const keys = await cache.keys();
    if (keys.length <= COVER_LIMIT) return;
    await Promise.all(keys.slice(0, keys.length - COVER_LIMIT).map((request) => cache.delete(request)));
  } catch (err) {
    /* pas vital */
  }
}

async function cacheFirstCover(request) {
  const cache = await caches.open(COVER_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request, { mode: 'no-cors' });
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).then(trimCoverCache).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);
  return hit || network || fetch(request);
}

async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 'inconnu'));
    cache.put('./index.html', response.clone()).catch(() => {});
    return response;
  } catch (err) {
    const shell = await cache.match('./index.html', { ignoreSearch: true });
    if (shell) return shell;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)));
    return;
  }

  if (isCoverRequest(url) || request.destination === 'image') {
    event.respondWith(cacheFirstCover(request).catch(() => caches.match(request)));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
