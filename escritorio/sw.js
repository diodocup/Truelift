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
const VERSION = `${PREFIJO}v9`;
const ARCHIVOS = [
  './',
  'index.html',
  'escritorio.css', 'tema.js',
  'importar.js', 'zip-seguro.js', 'fotos.js', 'evolucion.js', 'almacen.js', 'analisis.js',
  'comparacion.js', 'graficas.js', 'dibujos.js', 'vistas.js', 'fisica-vista.js', 'planificador.js', 'rutina-vista.js',
  'informe.js', 'informe-vista.js', 'app.js',
  '../coach/styles.css',
  '../coach/motor.js', '../coach/data.js', '../coach/nutricion.js', '../coach/charts.js',
  '../coach/catalogo.js', '../coach/canonico.js', '../coach/plantilla.js', '../coach/xlsx.js', '../coach/planner.js',
  '../coach/media/icono.png',
  '../fonts/archivo-latin.woff2', '../fonts/archivo-latin-ext.woff2',
  '../fonts/jetbrainsmono-latin.woff2', '../fonts/jetbrainsmono-latin-ext.woff2',
  // Las tres familias de la app (escritorio.css): títulos, cuerpo y cifras.
  '../fonts/sairacondensed-600-latin.woff2', '../fonts/sairacondensed-600-latin-ext.woff2',
  '../fonts/sairacondensed-700-latin.woff2', '../fonts/sairacondensed-700-latin-ext.woff2',
  '../fonts/sairacondensed-800-latin.woff2', '../fonts/sairacondensed-800-latin-ext.woff2',
  '../fonts/instrumentsans-latin.woff2', '../fonts/instrumentsans-latin-ext.woff2',
  '../fonts/ibmplexmono-400-latin.woff2', '../fonts/ibmplexmono-400-latin-ext.woff2',
  '../fonts/ibmplexmono-500-latin.woff2', '../fonts/ibmplexmono-500-latin-ext.woff2',
  '../fonts/ibmplexmono-600-latin.woff2', '../fonts/ibmplexmono-600-latin-ext.woff2',
];
const URLS = new Set(ARCHIVOS.map(a => new URL(a, self.registration.scope).href));
// Dibujos de los ejercicios (los del Coach): son cientos y no se precachean;
// la estrategia de abajo los guarda a medida que se ven, y quedan
// disponibles sin conexión.
const DIBUJOS = new URL('../coach/media/ejercicios/', self.registration.scope).href;
const dibujoVacio = () => new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
  { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' } });

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
   lista y los dibujos: nada más pasa por la caché (ni otras páginas del
   sitio ni datos). */
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.search = ''; url.hash = '';
  if (!URLS.has(url.href) && !url.href.startsWith(DIBUJOS)) return;
  // Un dibujo que aún no se había visto no está en la caché: sin conexión se
  // sirve una imagen vacía (queda el recuadro oscuro, sin icono roto ni
  // error) y el dibujo de verdad llega en cuanto vuelve la red.
  const sinCopia = () => url.href.startsWith(DIBUJOS) ? dibujoVacio() : Response.error();
  const respaldo = async () => (await (await caches.open(VERSION)).match(url.href)) || sinCopia();
  ev.respondWith(
    fetch(req)
      .then(async resp => {
        // Un 503/404 también puede ser un fallo transitorio del despliegue.
        // No sustituye una copia útil por una respuesta de error.
        if (!resp.ok) return (await (await caches.open(VERSION)).match(url.href)) || resp;
        try { await (await caches.open(VERSION)).put(url.href, resp.clone()); }
        catch (_) { /* La red sigue siendo utilizable si la caché no cabe. */ }
        return resp;
      })
      .catch(respaldo)
  );
});
