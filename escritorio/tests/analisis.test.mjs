// Modelo personal (analisis.js) y vistas (vistas.js) con datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const G = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'vistas.js');
const { Analisis, VistasEsc, Motor } = G;

const resumen = { ultimoRegistro: '2026-07-02', ultimoEntreno: '2026-07-02', primerRegistro: '2026-06-01' };

test('referencia: último registro, fin del día', () => {
  const r = Analisis.referencia(resumen);
  assert.equal(r.getFullYear(), 2026); assert.equal(r.getMonth(), 6); assert.equal(r.getDate(), 2); assert.equal(r.getHours(), 23);
});

test('no muta la copia', () => {
  const raw = copiaRica(); const antes = JSON.stringify(raw);
  Analisis.preparar(raw, resumen);
  assert.equal(JSON.stringify(raw), antes);
});

test('sesiones: cambio de rutina por revisión, sin base y marcas guardadas', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  assert.equal(M.sesiones.length, 9);
  assert.equal(M.planConocido, true);
  assert.deepEqual(M.sesiones.map(s => s.cambioRutina), [false, true, false, false, false, false, false, false, false]);
  assert.equal(M.sesiones[1].bruto, null, 'sin base: hueco');
  assert.equal(M.sesiones[1].sinBase, true);
  assert.equal(M.sesiones[3].veredicto, 'bueno');
  assert.equal(M.sesiones[5].semaforo, 'ambar');
  assert.equal(M.sesiones[8].series, 3, 'el ejercicio no realizado no suma series');
});

test('estado de progresión coherente con el contador del móvil', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  const est = n => M.ejercicios.get(n).estados[0];
  // Press banca: 06-08 (8,8,7) 06-15 (9,8,8) 06-22 ámbar sin marca → no cuenta; 06-29 descarga.
  // Objetivo 10: dos fallos con 80 kg.
  assert.equal(est('Press banca con barra').tipo, 'enCurso');
  assert.equal(est('Press banca con barra').consumidos, 2);
  // Sentadilla: 06-10, 06-24, 07-01 fallos con 100 (la de molestias no cuenta).
  assert.equal(est('Sentadilla con barra').consumidos, 3);
  // Rest-pause: suma 23, 26 (cumple), 25 (ámbar, no cuenta) → objetivo cumplido.
  assert.equal(est('Curl de bíceps con barra').tipo, 'objetivoCumplido');
  // Dominada asistida: kg distinto entre sesiones → racha 1.
  assert.equal(est('Dominada asistida en máquina').consumidos, 1);
  // Fuera de la rutina: sin valoración.
  assert.equal(est('Press inclinado con mancuernas').tipo, 'fueraDeRutina');
  assert.equal(est('Extensión de cuádriceps').tipo, 'fueraDeRutina');
});

test('sin la rutina en uso no se valora la progresión', () => {
  const raw = copiaRica(); raw.planModKey = 'hombre_doble|4';
  const M = Analisis.preparar(raw, resumen);
  assert.equal(M.planConocido, false);
  assert.equal(M.ejercicios.get('Press banca con barra').estados[0].tipo, 'rutinaDesconocida');
});

test('marcas: carga efectiva en asistidos, sin días ámbar, sin molestias, drop solo primera serie', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  const dom = M.ejercicios.get('Dominada asistida en máquina');
  // Mejor: 80 − 25 = 55 kg × (1 + 12/30)
  assert.ok(Math.abs(dom.marca.valor - 55 * (1 + 12 / 30)) < 1e-9);
  const press = M.ejercicios.get('Press banca con barra');
  // La sesión ámbar (9,9,8 a 80) no fija marca: la mejor es la de 06-15 (9 reps + 2 RIR) o la de 06-01 a 70 (10+2).
  assert.ok(Math.abs(press.marca.valor - 80 * (1 + 11 / 30)) < 1e-9);
  assert.equal(M.ejercicios.get('Sentadilla con barra').puntos.find(p => p.e.molestias).e1rmMarca, null);
  const ext = M.ejercicios.get('Extensión de cuádriceps');
  assert.ok(Math.abs(ext.marca.valor - 40 * (1 + 12 / 30)) < 1e-9);
  assert.equal(Motor.mejorMarca(copiaRica().logs, 'Press banca con barra', 80), press.marca.valor);
});

test('valoración: misma ventana y regla que Progreso', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  // En 28 días antes del 02-07: 06-10 1.2, 06-15 3.5, 06-17 −5, 06-22 3.1, 06-24 4, 07-01 −0.5 (06-08 sin base, 06-29 descarga)
  assert.deepEqual(M.valoracion.puntos.map(p => p.pct), [1.2, 3.5, -5, 3.1, 4, -0.5]);
  assert.equal(M.valoracion.tendencia, 'mixta');
  assert.equal(M.valoracion.tol, 3);
});

test('recuperación: días con estado bajo en las dos semanas previas', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  const { activo, bajos, registrados, lectura } = M.recuperacion;
  assert.deepEqual({ activo, bajos, registrados, lectura }, { activo: true, bajos: 1, registrados: 5, lectura: 'buena' });
});

test('volumen planificado con el reparto del móvil', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  const vp = Analisis.volumenPlan(M, M.planMod);
  assert.equal(vp.series.get('Pectoral'), 3);
  assert.equal(vp.dias.get('Pectoral'), 1);
  assert.ok(vp.series.get('Bíceps') >= 3);
});

test('vistas: se generan sin errores y escapan el texto importado', () => {
  const M = Analisis.preparar(copiaRica(), resumen);
  const ctx = { inst: { resumen, importadoEn: '2026-07-03T10:00:00Z' }, galeriaHtml: () => '' };
  const html = [VistasEsc.resumen(M, ctx), VistasEsc.entrenamiento(M, { sub: 'sesiones' }),
    VistasEsc.entrenamiento(M, { sub: 'ejercicios' }), VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: 'Sentadilla con barra' }),
    VistasEsc.entrenamiento(M, { sub: 'rendimiento' }), VistasEsc.entrenamiento(M, { sub: 'volumen' }),
    VistasEsc.fisica(M, ctx), VistasEsc.recuperacion(M), VistasEsc.rutina(M), VistasEsc.informes(M),
    VistasEsc.detalleSesionHtml(M, 4)].join('\n');
  assert.ok(!html.includes('<b>molesta</b>'), 'la nota no se interpreta como HTML');
  assert.ok(html.includes('Rodilla &lt;b&gt;molesta&lt;/b&gt;'));
  assert.ok(!/undefined|NaN/.test(html.replace(/data-tt="[^"]*"/g, '')), 'sin undefined ni NaN');
  assert.ok(html.includes('Rendimiento irregular'));
  assert.ok(html.includes('Buscando el objetivo (2 de 4 intentos)'));
  assert.ok(!/cliente|entrenador|cartera/i.test(html), 'sin lenguaje del Coach');
});

test('copia mínima (solo ajustes) y antigua sin claves nuevas', () => {
  const r0 = { ultimoRegistro: null };
  const M0 = Analisis.preparar({ sexo: 'mujer', sistema: 'simple', dias: '3' }, r0);
  assert.equal(M0.sesiones.length, 0);
  assert.equal(M0.valoracion.tendencia, null);
  const ctx = { inst: { resumen: r0, importadoEn: '2026-07-03T10:00:00Z' }, galeriaHtml: () => '' };
  for (const h of [VistasEsc.resumen(M0, ctx), VistasEsc.entrenamiento(M0, {}), VistasEsc.fisica(M0, ctx), VistasEsc.recuperacion(M0), VistasEsc.rutina(M0)])
    assert.ok(!/undefined|NaN/.test(h));
  // Formato antiguo: rendimientoPct base 100, sin estadoSemaforo ni rutinaRevision.
  const viejo = { sexo: 'hombre', sistema: 'doble', dias: '3', logs: [
    { fecha: '2026-01-01T10:00:00', dia: 'A', variante: 'hombre_doble', dias: '3', rendimientoPct: 103, entradas: [{ ejercicio: 'Press banca', kg: 60, reps: [8, 8], rir: [2, 2] }] }] };
  const M1 = Analisis.preparar(viejo, { ultimoRegistro: '2026-01-01' });
  assert.equal(M1.sesiones[0].bruto, 3);
  assert.equal(M1.sesiones[0].semaforo, 'verde');
});
