'use strict';
/* TrueLift Coach — service worker
   Precachea la app para que funcione sin internet una vez visitada.
   IMPORTANTE: al publicar cambios en la app, sube el número de VERSION
   para que los navegadores de los entrenadores se actualicen. */

const VERSION = 'tlcoach-v1';
const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'data.js',
  'charts.js',
  'views.js',
  'catalogo.js',
  'plantilla.js',
  'xlsx.js',
  'planner.js',
  'app.js',
  'manifest.json',
  'media/icono.png',
  'media/icono-192.png',
  'media/banner.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Estrategia: red primero con caché de respaldo.
   Con internet siempre sirve la versión publicada más reciente;
   sin internet sirve la copia cacheada. */
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    fetch(ev.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(VERSION).then(c => c.put(ev.request, copia));
        return resp;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
