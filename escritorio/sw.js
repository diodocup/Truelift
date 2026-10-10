'use strict';
/* TrueLift Escritorio — service worker (fase 7)
   Guarda en caché los archivos de la página (no los datos: esos viven en
   IndexedDB) para poder abrirla sin conexión después de una visita con
   conexión. Con conexión sirve siempre la versión publicada.

   IMPORTANTE: al publicar cambios en el escritorio o en los módulos del
   Coach que carga, sube VERSION para renovar la caché. Al activarse solo
   borra sus propias cachés (prefijo «tlescritorio-»), nunca las del Coach
   ni las de otras páginas del mismo origen. */

const PREFIJO = 'tlescritorio-';
const VERSION = `${PREFIJO}v1`;
const ARCHIVOS = [
  './',
  'index.html',
  'escritorio.css',
  'importar.js', 'zip-seguro.js', 'fotos.js', 'evolucion.js', 'almacen.js', 'analisis.js',
  'comparacion.js', 'vistas.js', 'fisica-vista.js', 'planificador.js', 'rutina-vista.js',
  'informe.js', 'informe-vista.js', 'app.js',
  '../coach/styles.css',
  '../coach/motor.js', '../coach/data.js', '../coach/nutricion.js', '../coach/charts.js',
  '../coach/catalogo.js', '../coach/canonico.js', '../coach/plantilla.js', '../coach/xlsx.js', '../coach/planner.js',
  '../coach/media/icono.png',
  '../fonts/archivo-latin.woff2', '../fonts/archivo-latin-ext.woff2',
  '../fonts/jetbrainsmono-latin.woff2', '../fonts/jetbrainsmono-latin-ext.woff2',
];
const URLS = new Set(ARCHIVOS.map(a => new URL(a, self.registration.scope).href));

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIJO) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero con la caché de respaldo, y solo para los archivos de la
   lista: nada más pasa por la caché (ni otras páginas del sitio ni datos). */
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.search = ''; url.hash = '';
  if (!URLS.has(url.href)) return;
  ev.respondWith(
    fetch(req)
      .then(resp => {
        if (resp.ok){ const copia = resp.clone(); caches.open(VERSION).then(c => c.put(url.href, copia)); }
        return resp;
      })
      .catch(() => caches.match(url.href).then(r => r || Response.error()))
  );
});
