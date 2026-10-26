const CACHE_NAME = 'grafika-contenido-v22';
const CORE_FILES = [
  './', './index.html', './styles.css', './app.js', './content/catalog.json', './content/glossary.json',
  './content/articles/fundamentos-adobe-illustrator.md',
  './content/articles/aspectos-basicos-illustrator.md',
  './content/articles/fundamentos-identidad-visual.md',
  './assets/icons/pen-tool.svg', './assets/icons/type.svg', './assets/icons/palette.svg',
  './assets/icons/printer.svg', './assets/icons/fingerprint.svg', './assets/icons/paintbrush.svg',
  './assets/icons/book-open.svg', './assets/icons/package.svg', './assets/icons/shield-check.svg',
  './assets/icons/book-open-text.svg', './assets/icons/wrench.svg', './assets/icons/message-circle.svg',
  './assets/icons/target.svg', './assets/icons/circle-help.svg', './assets/icons/circle-play.svg',
  './assets/icons/arrow-right.svg', './assets/icons/arrow-left.svg', './assets/icons/arrow-up-right.svg',
  './assets/icons/chevron-down.svg', './assets/icons/chevron-left.svg', './assets/icons/chevron-right.svg',
  './assets/icons/plus.svg', './assets/icons/x.svg', './assets/icons/rotate-cw.svg', './assets/icons/sparkles.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  if (/\.(json|md)$/.test(new URL(request.url).pathname)) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  })));
});
