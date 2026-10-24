// Vídeo de progreso del escritorio (video.js): mismo plan que la app
// (lib/medidas/video_progreso.dart): duraciones, fotogramas, fundido,
// límites, «una por mes», rótulos, encuadre, banda sonora, igualar luz,
// zonas pixeladas y la tarjeta de la sección.
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

const estado = (extra = {}) => ({ pose: null, quitadas: new Set(), h: 1.5, t: 1.0, formato: 'vertical', rotulos: true, igualar: true, grises: false, musica: false,
  censura: new Map(), grabando: false, segundo: 0, url: null, nombre: null, error: null, ...extra });

test('tarjeta: pose con más fotos, lista numerada y quitar fotos', () => {
  const galeria = [...mensuales(3), foto('2024-05-01', { pose: 'perfil' }), foto('2024-06-01', { tieneImagen: false })];
  const st = estado();
  let html = V.html(galeria, st);
  assert.equal(st.pose, 'frente');
  assert.match(html, /Fotos · 3 de 4/);
  assert.match(html, /imagen no importada/);
  assert.match(html, /Dura 7 s/);
  assert.match(html, /id="videoLienzo" width="1080" height="1440"/);
  st.quitadas.add(galeria[1].archivo);
  html = V.html(galeria, st);
  assert.match(html, /Fotos · 2 de 4/);
  assert.match(html, /<span class="video-num">–<\/span>/);
  assert.match(V.html(galeria, estado({ formato: 'historia' })), /height="1920"/);
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

test('banda sonora: cabe según cuándo llega la última foto', () => {
  assert.equal(V.encajeMusica(1, 1.5, 1), 'corto');
  assert.equal(V.encajeMusica(2, 1.5, 1), 'corto');
  assert.equal(V.encajeMusica(3, 1.5, 1), 'cabe');
  assert.equal(V.encajeMusica(7, 1.5, 1), 'cabe');
  assert.equal(V.encajeMusica(8, 1.5, 1), 'largo');
  // Sin pedirla, o sin caber, el plan es el de siempre.
  const sin = V.plan({ fotos: mensuales(3) });
  assert.equal(sin.conMusica, false);
  assert.equal(sin.extraInicio + sin.extraFinal, 0);
  const largo = V.plan({ fotos: mensuales(12), musica: true });
  assert.equal(largo.conMusica, false);
  assert.equal(largo.duracion, 12 * 1.5 + 11 * 1.0);
});

test('banda sonora: el drop cae en el fotograma en que la última foto ya está entera', () => {
  const fps = V.FPS, compas = V.BSO.segundosCompas, drop = V.BSO.compasesHastaDrop * compas;
  let probados = 0;
  for (let n = 3; n <= 7; n++){
    for (const [h, t] of [[1.5, 1.0], [0.8, 0.4], [2.0, 0.6]]){
      const p = V.plan({ fotos: mensuales(n), segundosFoto: h, segundosTransicion: t, musica: true });
      if (!p.conMusica) continue;
      probados++;
      const llegada = p.extraInicio + (n - 1) * (p.fh + p.ft);
      assert.equal(V.momento(p, llegada - 1).siguiente, n - 1);
      assert.deepEqual(V.momento(p, llegada), { foto: n - 1, siguiente: null, mezcla: 0 });
      assert.ok(Math.abs(p.inicioMusica + llegada / fps - drop) < 1e-9);
      // Entra en un primer tiempo de compás y la primera foto se alarga
      // menos de un compás.
      const compases = p.inicioMusica / compas;
      assert.ok(Math.abs(compases - Math.round(compases)) * compas < 0.5 / fps + 1e-9);
      assert.ok(p.extraInicio < compas * fps);
      // Acaba con la música.
      assert.ok(Math.abs((p.fotogramas - llegada) / fps - V.BSO.compasesTrasDrop * compas) <= 0.5 / fps);
      // La primera foto se ve desde el principio.
      assert.deepEqual(V.momento(p, 0), { foto: 0, siguiente: null, mezcla: 0 });
      assert.equal(V.momento(p, p.extraInicio + p.fh).siguiente, 1);
    }
  }
  assert.ok(probados >= 10);
});

test('banda sonora: «Ajustar» deja tiempos con los que cabe', () => {
  for (const n of [2, 3, 8, 12, 20, 25]){
    const t = V.tiemposParaMusica(n, 1.5, 1.0);
    assert.ok(t, `${n} fotos`);
    assert.equal(V.encajeMusica(n, t.foto, t.transicion), 'cabe', `${n} fotos`);
  }
  assert.equal(V.tiemposParaMusica(1, 1.5, 1.0), null);
  assert.deepEqual(V.tiemposParaMusica(4, 1.5, 1.0), { foto: 1.5, transicion: 1.0 });
  assert.equal(V.tiemposParaMusica(30, 1.5, 1.0), null);
});

test('banda sonora: se carga la primera pista que el navegador sabe leer', async () => {
  const pedidas = [];
  const b = await V.cargarMusica(async url => { pedidas.push(url); return url.endsWith('.webm') ? 'datos' : null; }, async d => ({ decodificado: d }));
  assert.deepEqual(b, { decodificado: 'datos' });
  assert.deepEqual(pedidas, V.BSO.archivos);
  assert.equal(await V.cargarMusica(async () => { throw new Error('sin red'); }, async d => d), null);
  // Con música, grabación con su códec de audio.
  assert.equal(V.tipoGrabacion(t => t.startsWith('video/mp4'), true), 'video/mp4;codecs=avc1,mp4a.40.2');
  assert.equal(V.tipoGrabacion(t => t.startsWith('video/webm'), true), 'video/webm;codecs=vp9,opus');
});

test('tarjeta: música TrueLift con casilla si cabe y «Ajustar» si no', () => {
  const cabe = V.html(mensuales(4), estado({ musica: true }));
  assert.match(cabe, /id="videoMusica" checked/);
  assert.match(cabe, /El momento fuerte llega con tu última foto/);
  const largo = V.html(mensuales(12), estado({ musica: true }));
  assert.doesNotMatch(largo, /id="videoMusica"/);
  assert.match(largo, /data-accion="video-musica-ajustar"/);
  assert.match(largo, /tiene que ser más corto/);
  const corto = V.html(mensuales(2), estado({ musica: true }));
  assert.match(corto, /tiene que durar algo más/);
  const una = V.html(mensuales(1), estado({ musica: true }));
  assert.match(una, /Añade más fotos/);
  assert.doesNotMatch(una, /video-musica-ajustar/);
  // Con música dura lo que la pista desde que entra (más que sin ella).
  assert.ok(V.plan({ fotos: mensuales(4), musica: true }).duracion > V.plan({ fotos: mensuales(4) }).duracion);
  // Los textos no hablan del algoritmo.
  for (const h of [cabe, largo, corto, una]){
    const fila = /id="videoMusicaFila">([\s\S]*?)<\/div>/.exec(h)[1].replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(fila, /\d/);
  }
});

const luz = (extra = {}) => ({ r: 120, g: 110, b: 100, luz: 112, bajo: 20, alto: 220, ...extra });

test('igualar luz: matriz de la app hacia la primera foto, con topes', () => {
  assert.equal(V.matrizIgualacion(luz(), luz()), null);
  // Más oscura y con menos recorrido: se estira hacia la referencia.
  const m = V.matrizIgualacion(luz(), luz({ bajo: 10, alto: 110, r: 60, g: 55, b: 50, luz: 56 }));
  assert.ok(m[0] > 1 && m[6] > 1 && m[12] > 1);
  assert.ok(m[0] <= 1.8 * 1.25 + 1e-9);
  // Casi uniforme: nada honesto que hacer.
  assert.equal(V.matrizIgualacion(luz(), luz({ bajo: 100, alto: 110 })), null);
  // La primera va tal cual; las demás, hacia ella; con grises, desaturadas.
  const fotos = [foto('2026-01-01', { analisis: luz() }), foto('2026-02-01', { analisis: luz({ bajo: 10, alto: 110 }) })];
  const p = V.plan({ fotos });
  assert.equal(V.filtro(p, 0), null);
  assert.ok(V.filtro(p, 1));
  assert.equal(V.filtro(V.plan({ fotos, igualarLuz: false }), 1), null);
  const g = V.filtro(V.plan({ fotos, igualarLuz: false, grises: true }), 1);
  assert.deepEqual(g, V.GRISES);
  const gi = V.filtro(V.plan({ fotos, grises: true }), 1);
  assert.equal(gi[0], gi[5]); assert.equal(gi[1], gi[6]);
  // Aplicar la matriz a píxeles (Uint8ClampedArray recorta como la GPU).
  const px = new Uint8ClampedArray([100, 150, 200, 255, 250, 250, 250, 255]);
  V.aplicarMatriz(px, [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -50, 0, 0, 0, 1, 0]);
  assert.deepEqual([...px], [200, 150, 150, 255, 255, 250, 200, 255]);
});

test('igualar luz: medida de la región central y lectura de la copia', () => {
  // 10 × 10: borde negro y centro gris 128 → se mide solo el centro.
  const rgba = new Uint8ClampedArray(10 * 10 * 4);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++){
    const i = (y * 10 + x) * 4, dentro = x >= 1 && x < 9 && y >= 1 && y < 9;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = dentro ? 128 : 0; rgba[i + 3] = 255;
  }
  const a = V.estadisticos(rgba, 10, 10);
  assert.equal(a.r, 128); assert.equal(a.bajo, 128); assert.equal(a.alto, 128);
  assert.ok(Math.abs(a.luz - 128) < 1e-9);
  const { FotosTL } = globalThis;
  assert.deepEqual(FotosTL.leerAnalisis({ v: 1, r: 1, g: 2, b: 3, luz: 2, bajo: 0, alto: 9, quemados: 0, negros: 0, nitidez: 4 }),
    { r: 1, g: 2, b: 3, luz: 2, bajo: 0, alto: 9 });
  assert.equal(FotosTL.leerAnalisis({ v: 2, r: 1, g: 2, b: 3, luz: 2, bajo: 0, alto: 9 }), null);
  assert.equal(FotosTL.leerAnalisis({ v: 1, r: 1, g: 2, b: 3, luz: 2, bajo: 10, alto: 9 }), null);
  assert.equal(FotosTL.leerAnalisis({ v: 1, r: 300, g: 2, b: 3, luz: 2, bajo: 0, alto: 9 }), null);
  const ind = FotosTL.leerIndice({ fotos: [{ archivo: 'foto_20260101_frente.jpg', fecha: '2026-01-01', pose: 'frente', analisis: { v: 1, r: 1, g: 2, b: 3, luz: 2, bajo: 0, alto: 9 } }] });
  assert.equal(ind.fotos.get('foto_20260101_frente.jpg').analisis.alto, 9);
});

test('zonas pixeladas: topes, inversa del encuadre y traslado', () => {
  const encuadre = { escala: 1.4, dx: 0.1, dy: -0.07, giro: 0.3, espejo: true };
  const p = V.aplicar(encuadre, 37, 120, 300, 400), q = V.deshacer(encuadre, p.x, p.y, 300, 400);
  assert.ok(Math.abs(q.x - 37) < 1e-9 && Math.abs(q.y - 120) < 1e-9);
  assert.deepEqual(V.acotarZona({ cx: -1, cy: 3, radio: 9 }), { cx: 0, cy: 1, radio: 0.5 });
  assert.deepEqual(V.acotarZona({ cx: NaN, cy: 0.5, radio: 0 }), { cx: 0.5, cy: 0.5, radio: 0.04 });
  const z = { cx: 0.4, cy: 0.3, radio: 0.1 };
  const t = V.trasladarZona(z, null, encuadre), enPantalla = V.aplicar(encuadre, t.cx * 3, t.cy * 4, 3, 4);
  assert.ok(Math.abs(enPantalla.x - 1.2) < 1e-9 && Math.abs(enPantalla.y - 1.2) < 1e-9);
  assert.ok(Math.abs(t.radio * encuadre.escala - 0.1) < 1e-9);
  const igual = V.trasladarZona(z, null, null);
  assert.ok(Math.abs(igual.cx - 0.4) < 1e-9 && Math.abs(igual.cy - 0.3) < 1e-9 && Math.abs(igual.radio - 0.1) < 1e-9);
  // La de encima si se solapan; -1 fuera.
  const zonas = [{ cx: 0.5, cy: 0.5, radio: 0.2 }, { cx: 0.55, cy: 0.5, radio: 0.1 }];
  assert.equal(V.zonaEn(zonas, 165, 200, 300, 400), 1);
  assert.equal(V.zonaEn(zonas, 100, 200, 300, 400), 0);
  assert.equal(V.zonaEn(zonas, 5, 5, 300, 400), -1);
});

test('tarjeta: igualar luz, blanco y negro, pixelar y avisos', () => {
  const galeria = [foto('2026-01-01'), foto('2026-02-01', { ajuste: { escala: 1.1, dx: 0, dy: 0, giro: 0, espejo: false } }), foto('2026-03-01'), foto('2026-04-01', { tieneImagen: false })];
  const st = estado();
  st.censura.set(galeria[0].archivo, [{ cx: 0.5, cy: 0.2, radio: 0.1 }]);
  const html = V.html(galeria, st);
  assert.match(html, /id="videoIgualar" checked/);
  assert.match(html, /id="videoGrises">/);
  assert.match(html, /data-video-pixelar="foto_20260101_frente.jpg"/);
  assert.match(html, /· pixelada/);
  assert.match(html, /· encuadrada/);
  assert.match(html, /Una foto sin encuadrar/);
  assert.match(html, /Una foto sin imagen importada no entra/);
  assert.doesNotMatch(html, /data-video-pixelar="foto_20260401_frente.jpg"/);
  const pix = V.htmlPixelar(galeria[0], true);
  assert.match(pix, /id="pixelarLienzo"/);
  assert.match(pix, /data-accion="pixelar-todas"/);
  assert.doesNotMatch(V.htmlPixelar(galeria[0], false), /pixelar-todas/);
  // Grabando no se toca nada.
  assert.match(V.html(galeria, estado({ grabando: true })), /id="videoIgualar" checked disabled/);
});

test('decodificación: el ancho de salida y, con zoom, hasta el doble', () => {
  assert.equal(V.anchoDecodificacion(1080, 1), 1080);
  assert.equal(V.anchoDecodificacion(1080, 0.6), 1080);
  assert.equal(V.anchoDecodificacion(1080, 1.5), 1620);
  assert.equal(V.anchoDecodificacion(1080, 3), 2160);
  assert.equal(V.anchoDecodificacion(1080, undefined), 1080);
});
