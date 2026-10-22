// Vídeo de progreso del escritorio (video.js): mismo plan que la app
// (lib/medidas/video_progreso.dart): duraciones, fotogramas, fundido,
// límites, «una por mes», rótulos, encuadre y la tarjeta de la sección.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach } from './comun.mjs';
cargarCoach('data.js');
const { VideoTL: V } = cargar('importar.js', 'fotos.js', 'video.js');

const foto = (fecha, extra = {}) => ({ archivo: `foto_${fecha.replaceAll('-', '')}_frente.jpg`, fecha, pose: 'frente', pesoKg: null, ajuste: null, tieneImagen: true, ...extra });
const mensuales = n => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2024, i, 5)).toISOString().slice(0, 10);
  return foto(d);
});

test('duración n·h + (n−1)·t y fotogramas exactos, como en la app', () => {
  const d = (n, h, t) => V.plan({ fotos: mensuales(n), segundosFoto: h, segundosTransicion: t }).duracion;
  assert.ok(Math.abs(d(12, 0.5, 0.3) - 9.3) < 1e-9);
  assert.equal(d(12, 1.5, 1.0), 29);
  assert.equal(d(24, 1.5, 1.0), 59);
  const p = V.plan({ fotos: mensuales(24) });
  assert.equal(p.fh, 45); assert.equal(p.ft, 30);
  assert.equal(p.fotogramas, 24 * 45 + 23 * 30);
});

test('tiempos acotados, orden por fecha y una sola pose', () => {
  const p = V.plan({ fotos: mensuales(3).reverse(), segundosFoto: 0.1, segundosTransicion: 9 });
  assert.equal(p.segundosFoto, 0.4); assert.equal(p.segundosTransicion, 2);
  assert.deepEqual(p.fotos.map(f => f.fecha), ['2024-01-05', '2024-02-05', '2024-03-05']);
  assert.throws(() => V.plan({ fotos: [foto('2024-01-01'), foto('2024-02-01', { pose: 'espalda' })] }));
  assert.equal(V.plan({ fotos: [] }).cabe, false);
});

test('momento: bordes, pausa, mitad de la transición y fundido creciente', () => {
  const p = V.plan({ fotos: mensuales(3) });
  assert.deepEqual(V.momento(p, 0), { foto: 0, siguiente: null, mezcla: 0 });
  assert.deepEqual(V.momento(p, p.fotogramas - 1), { foto: 2, siguiente: null, mezcla: 0 });
  assert.deepEqual(V.momento(p, 44), { foto: 0, siguiente: null, mezcla: 0 });
  const mitad = V.momento(p, 45 + 15);
  assert.equal(mitad.siguiente, 1);
  assert.ok(Math.abs(mitad.mezcla - 0.5) < 0.06);
  let antes = 0;
  for (let j = 0; j < p.ft; j++){
    const m = V.momento(p, 45 + j);
    assert.ok(m.mezcla > antes && m.mezcla < 1);
    antes = m.mezcla;
  }
  assert.deepEqual(V.momento(p, 75), { foto: 1, siguiente: null, mezcla: 0 });
  assert.equal(V.suavizar(0.5), 0.5);
  assert.deepEqual(V.momentoEn(p, 2), V.momento(p, 60));
});

test('límites: máximo de fotos, «Más rápido» y «Una por mes»', () => {
  assert.equal(V.maximoFotos(1.5, 1.0), 24);
  assert.equal(V.maximoFotos(0.5, 0.3), 60);
  assert.equal(V.plan({ fotos: mensuales(24) }).cabe, true);
  assert.equal(V.plan({ fotos: mensuales(25) }).cabe, false);
  const r = V.tiemposQueCaben(36, 1.5, 1.0);
  assert.ok(V.plan({ fotos: mensuales(36), segundosFoto: r.foto, segundosTransicion: r.transicion }).cabe);
  assert.ok(r.foto < 1.5 && r.transicion < 1.0);
  assert.equal(V.tiemposQueCaben(61, 1.5, 1.0), null);
  const fotos = ['2026-01-10', '2026-01-25', '2026-02-02', '2026-02-11', '2026-02-27', '2026-03-09', '2026-03-20'].map(d => foto(d));
  assert.deepEqual(V.unaPorMes(fotos).map(f => f.fecha), ['2026-01-10', '2026-02-11', '2026-03-20']);
});

test('rótulo: orden, fecha, peso y cambio desde la primera con peso', () => {
  const p = V.plan({ fotos: [foto('2026-01-01', { pesoKg: 80 }), foto('2026-02-01'), foto('2026-03-01', { pesoKg: 77.9 })] });
  assert.deepEqual(V.rotulo(p, 0), { fecha: '01/01/2026', detalle: '1/3 · 80,0 kg' });
  assert.deepEqual(V.rotulo(p, 1), { fecha: '01/02/2026', detalle: '2/3' });
  assert.deepEqual(V.rotulo(p, 2), { fecha: '01/03/2026', detalle: '3/3 · 77,9 kg · −2,1 kg' });
});

test('encuadre: la matriz de AjusteFoto.coeficientes', () => {
  assert.deepEqual(V.matriz(null, 720, 960), [1, 0, 0, 1, 0, 0]);
  // Escala 2 sin giro: el centro queda quieto y se desplaza dx del ancho.
  const [a, b, c, d, e, f] = V.matriz({ escala: 2, dx: 0.1, dy: 0, giro: 0, espejo: false }, 100, 200);
  assert.deepEqual([a, b, c, d], [2, 0, -0, 2]);
  assert.equal(a * 50 + c * 100 + e, 50 + 10);
  assert.equal(b * 50 + d * 100 + f, 100);
  // Espejo: el borde izquierdo pasa al derecho.
  const m = V.matriz({ escala: 1, dx: 0, dy: 0, giro: 0, espejo: true }, 100, 200);
  assert.equal(m[0] * 0 + m[4], 100);
  const r = V.recorteCover(150, 180, 120, 160);
  assert.ok(Math.abs(r.w / r.h - 0.75) < 1e-9); assert.equal(r.h, 180);
});

test('grabación: MP4 si se puede; si no, WebM', () => {
  assert.equal(V.tipoGrabacion(t => t.startsWith('video/mp4')), 'video/mp4;codecs=avc1');
  assert.equal(V.tipoGrabacion(t => t === 'video/webm'), 'video/webm');
  assert.equal(V.tipoGrabacion(() => false), null);
  assert.equal(V.nombreArchivo('2026-10-22', 'video/mp4'), 'truelift_progreso_2026-10-22.mp4');
  assert.equal(V.nombreArchivo('2026-10-22', 'video/webm;codecs=vp9'), 'truelift_progreso_2026-10-22.webm');
  assert.equal(V.duracionTexto(29), '29 s');
  assert.equal(V.duracionTexto(99), '1 min 39 s');
  assert.equal(V.reloj(23.7), '0:23');
});

const estado = (extra = {}) => ({ pose: null, quitadas: new Set(), h: 1.5, t: 1.0, formato: 'vertical', rotulos: true, grabando: false, segundo: 0, url: null, nombre: null, error: null, ...extra });

test('tarjeta: pose con más fotos, lista numerada y quitar fotos', () => {
  const galeria = [...mensuales(3), foto('2024-05-01', { pose: 'perfil' }), foto('2024-06-01', { tieneImagen: false })];
  const st = estado();
  let html = V.html(galeria, st);
  assert.equal(st.pose, 'frente');
  assert.match(html, /Fotos · 3 de 4/);
  assert.match(html, /imagen no importada/);
  assert.match(html, /Dura 7 s/);
  assert.match(html, /id="videoLienzo" width="720" height="960"/);
  st.quitadas.add(galeria[1].archivo);
  html = V.html(galeria, st);
  assert.match(html, /Fotos · 2 de 4/);
  assert.match(html, /<span class="video-num">–<\/span>/);
  assert.match(V.html(galeria, estado({ formato: 'historia' })), /height="1280"/);
});

test('tarjeta: si no cabe propone salidas y no deja grabar', () => {
  const dosPorMes = Array.from({ length: 40 }, (_, i) => foto(new Date(Date.UTC(2024, Math.floor(i / 2), 3 + (i % 2) * 10)).toISOString().slice(0, 10)));
  const html = V.html(dosPorMes, estado());
  assert.match(html, /id="videoLimite"/);
  assert.match(html, /data-accion="video-una-por-mes"/);
  assert.match(html, /data-accion="video-mas-rapido"/);
  assert.match(html, /data-accion="video-grabar" disabled/);
  // La explicación no habla del algoritmo.
  const aviso = /<div class="alerta ambar" id="videoLimite"><span>([^<]*)</.exec(html)[1];
  assert.doesNotMatch(aviso, /\d/);
});

test('tarjeta: grabando enseña el tiempo y solo deja cancelar', () => {
  const html = V.html(mensuales(24), estado({ grabando: true, segundo: 23.4 }));
  assert.match(html, /Grabando… 0:23 de 0:59/);
  assert.match(html, /data-accion="video-cancelar"/);
  assert.doesNotMatch(html, /data-accion="video-grabar"/);
  const listo = V.html(mensuales(2), estado({ url: 'blob:x', nombre: 'truelift_progreso_2026-10-22.mp4' }));
  assert.match(listo, /download="truelift_progreso_2026-10-22.mp4"/);
});
