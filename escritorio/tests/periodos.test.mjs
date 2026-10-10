// Fase 4: comparación entre periodos y bloques. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaFase3, diaFase3, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const G = cargar('analisis.js', 'periodos.js', 'vistas.js');
const { Analisis, Periodos, VistasEsc } = G;

const ref9 = { ultimoRegistro: diaFase3(9, 4), primerRegistro: diaFase3(0, 0) };
const preparar = (raw = copiaFase3(), r = ref9) => Analisis.preparar(raw, r);
const D = (y, m, d) => new Date(y, m - 1, d);
const iso = d => G.fmtISO(d);

test('semanas: completas de lunes a domingo y tramos parciales aparte', () => {
  // Miércoles 5-ago a martes 25-ago-2026.
  const s = Periodos.semanas({ desde: D(2026, 8, 5), hasta: D(2026, 8, 25) });
  assert.deepEqual(s.completas.map(w => [iso(w.inicio), iso(w.fin)]), [['2026-08-10', '2026-08-16'], ['2026-08-17', '2026-08-23']]);
  assert.deepEqual(s.parciales.map(w => [iso(w.inicio), iso(w.fin), w.dias]), [['2026-08-05', '2026-08-09', 5], ['2026-08-24', '2026-08-25', 2]]);
  // Un periodo de tres días dentro de una semana: solo un tramo parcial.
  const c = Periodos.semanas({ desde: D(2026, 8, 5), hasta: D(2026, 8, 7) });
  assert.equal(c.completas.length, 0);
  assert.deepEqual(c.parciales.map(w => w.dias), [3]);
});

test('periodo: valida el orden, recorta a los días de la copia y rechaza lo que queda fuera', () => {
  const M = preparar();
  assert.equal(Periodos.periodo(M, { desde: D(2026, 9, 10), hasta: D(2026, 9, 1) }).error, 'orden');
  assert.equal(Periodos.periodo(M, { desde: null, hasta: D(2026, 9, 1) }).error, 'fecha');
  assert.equal(Periodos.periodo(M, { desde: D(2026, 11, 1), hasta: D(2026, 11, 30) }).error, 'fuera');
  const p = Periodos.periodo(M, { desde: D(2026, 7, 20), hasta: D(2026, 12, 31) });
  assert.equal(p.recortado, true);
  assert.equal(iso(p.desde), '2026-08-03'); assert.equal(iso(p.hasta), diaFase3(9, 4));
  assert.equal(p.dias, 68);
});

test('bloques: tramos de rutina según las propias sesiones y sugerencias', () => {
  const M = preparar();
  const r = Periodos.bloquesRutina(M);
  assert.equal(r.length, 2);
  assert.equal(r[0].etiqueta, 'Rutina de 4 días (Día 1, Día 2, Día 3, Día 4)');
  assert.deepEqual([iso(r[0].desde), iso(r[0].hasta)], ['2026-08-03', '2026-08-28']);
  assert.equal(r[1].etiqueta, 'Rutina de 3 días (Día A, Día B, Día C)');
  assert.equal(iso(r[1].hasta), diaFase3(9, 4), 'la rutina actual llega al último registro');
  assert.equal(r[1].actual, true);
  // Si después de la última sesión cambió la rutina, el tramo acaba en la última sesión.
  const r2 = Periodos.bloquesRutina(preparar({ ...copiaFase3(), rutinaRevision: 3 }, { ...ref9, ultimoRegistro: '2026-10-12' }));
  assert.equal(iso(r2[1].hasta), diaFase3(9, 4));
  assert.equal(r2[1].actual, false);
  // Sugerencias: semanas completas (el último registro es viernes) y meses naturales.
  const s = Object.fromEntries(Periodos.sugerencias(M).map(x => [x.id, x]));
  assert.deepEqual([iso(s.semanas.A.desde), iso(s.semanas.A.hasta), iso(s.semanas.B.desde), iso(s.semanas.B.hasta)],
    ['2026-08-10', '2026-09-06', '2026-09-07', '2026-10-04']);
  assert.deepEqual([iso(s.meses.A.desde), iso(s.meses.A.hasta), iso(s.meses.B.desde), iso(s.meses.B.hasta)],
    ['2026-08-01', '2026-08-31', '2026-09-01', '2026-09-30']);
  assert.ok(s.rutinas && !s.fases);
  const pred = Periodos.predeterminada(M);
  assert.equal(iso(pred.B.hasta), '2026-10-04');
});

test('selección en la dirección: ida y vuelta, y texto inválido', () => {
  const sel = { A: { desde: D(2026, 8, 3), hasta: D(2026, 8, 28) }, B: { desde: D(2026, 8, 31), hasta: D(2026, 10, 9) } };
  const t = Periodos.aTexto(sel);
  assert.equal(t, '2026-08-03_2026-08-28_2026-08-31_2026-10-09');
  const v = Periodos.deTexto(t);
  assert.equal(Periodos.aTexto(v), t);
  assert.equal(Periodos.deTexto('2026-08-03_2026-02-30_x'), null);
  assert.equal(Periodos.deTexto('<script>'), null);
});

test('comparar dos rutinas de distinta duración: medias por semana completa y contexto', () => {
  const M = preparar();
  const [ra, rb] = Periodos.bloquesRutina(M);
  const C = Periodos.comparar(M, ra, rb);
  const { A, B } = C;
  assert.equal(A.dias, 26); assert.equal(B.dias, 40);
  // A: tres semanas completas (4 sesiones) y la última, de descarga, parcial.
  assert.equal(A.semanasCompletas, 3); assert.equal(A.diasParciales, 5); assert.equal(A.sesionesParciales, 4);
  assert.equal(A.sesiones, 16); assert.equal(A.sesionesPorSemana, 4);
  // B: cinco semanas completas (una sin el día B) y el tramo final en curso.
  assert.equal(B.semanasCompletas, 5); assert.equal(B.sesionesPorSemana, 14 / 5);
  assert.equal(B.diasParciales, 5); assert.equal(B.sesionesParciales, 3);
  // Constancia: solo semanas con la rutina conocida (ni la primera de la
  // copia ni la del cambio).
  assert.deepEqual(A.constancia, { semanas: 2, hechas: 8, previstas: 8 });
  assert.deepEqual(B.constancia, { semanas: 4, hechas: 11, previstas: 12 });
  // Volumen por semana completa con el reparto de la app (press: pectoral ×1).
  assert.equal(A.porGrupo.get('Pectoral'), 12);
  assert.equal(B.porGrupo.get('Pectoral'), 3);
  assert.equal(A.descargas, 4); assert.equal(B.descargas, 0);
  const ids = C.avisos.map(a => a.id);
  for (const id of ['duracion', 'rutinas', 'descarga']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('solape'));
  assert.ok(ids.includes('cuestionario'), 'solo B tiene cuestionarios');
  // Cero frente a ausente: sin cuestionarios en A no hay media (no es 0).
  assert.equal(A.recuperacion.cuestionarios, 0); assert.equal(A.recuperacion.estadoMedio, null);
  assert.ok(B.recuperacion.estadoMedio > 0);
  assert.equal(A.peso.pesajes, 0); assert.equal(A.peso.cambio, null); assert.equal(A.peso.inicio, null);
});

test('ejercicios comunes: solo sesiones comparables, misma modalidad y sin emparejar ejercicios distintos', () => {
  const M = preparar();
  const [ra, rb] = Periodos.bloquesRutina(M);
  const E = Periodos.comparar(M, ra, rb).ejercicios;
  assert.deepEqual(E.comunes.map(x => x.nombre), ['Press banca con barra']);
  assert.deepEqual(E.soloB, ['Curl de bíceps con barra', 'Remo con barra', 'Sentadilla con barra']);
  assert.deepEqual(E.soloA, []);
  const p = E.comunes[0];
  // A: las doce sesiones normales (la semana de descarga no entra).
  assert.equal(p.sesionesA, 16); assert.equal(p.nA, 12);
  assert.ok(Math.abs(p.mediaA - 75 * (1 + 12 / 30)) < 1e-9);
  assert.equal(p.nB, 6);
  assert.ok(p.avisos.includes('rutina'));
  assert.ok(p.deltaPct != null);
  // Curl: drop set en un periodo y series normales en otro → sin diferencia.
  const sem = Periodos.comparar(M, { desde: D(2026, 9, 7), hasta: D(2026, 10, 4) }, { desde: D(2026, 10, 5), hasta: D(2026, 10, 9) });
  const curl = sem.ejercicios.comunes.find(x => x.nombre === 'Curl de bíceps con barra');
  assert.equal(curl.config, 'normal');
  assert.equal(curl.nA, 0); assert.equal(curl.deltaPct, null);
  assert.ok(curl.avisos.includes('modalidad') && curl.avisos.includes('muestra'));
});

test('muestra pequeña, solape y descanso: avisos sin conclusiones', () => {
  const M = preparar();
  // B: un solo día con una sesión; A solapa con B.
  const C = Periodos.comparar(M, { desde: D(2026, 9, 1), hasta: D(2026, 10, 2) }, { desde: D(2026, 10, 2), hasta: D(2026, 10, 2) });
  const ids = C.avisos.map(a => a.id);
  for (const id of ['solape', 'muestraB', 'semanasB', 'duracion']) assert.ok(ids.includes(id), id);
  assert.equal(C.B.sesionesPorSemana, null, 'sin semanas completas no hay media semanal');
  assert.equal(C.B.porGrupo.get('Espalda'), null);
  assert.ok(C.ejercicios.comunes.every(x => x.deltaPct == null), 'una sola sesión no da diferencia');
});

test('fases de nutrición: bloques guardados por la app, solape por días y recomendaciones', () => {
  const raw = copiaFase3();
  raw.nutricion.fasesCerradas = [{ id: 'f1', tipo: 'DEFICIT', inicio: '2026-08-03', fin: '2026-09-06', tasaObjetivoPctSemana: -0.5 }];
  raw.nutricion.faseActual = { id: 'f2', tipo: 'MAINTENANCE', inicio: '2026-09-07' };
  raw.nutricion.recomendaciones = [
    { fecha: '2026-08-17', faseId: 'f1', tipo: 'ADJUST', ajusteKcalDia: -100 },
    { fecha: '2026-08-24', faseId: 'f1', tipo: 'HOLD' },
    { fecha: '2026-08-31', faseId: 'f1', tipo: 'ADJUST', ajusteKcalDia: -50 },
    { fecha: '2026-09-14', faseId: 'f2', tipo: 'HOLD' }];
  raw.nutricion.refeeds = [{ inicio: '2026-08-29', dias: 2 }];
  const M = preparar(raw);
  const f = Periodos.fasesNutricion(M);
  assert.deepEqual(f.map(x => [x.faseTipo, iso(x.desde), iso(x.hasta), x.actual]),
    [['DEFICIT', '2026-08-03', '2026-09-06', false], ['MAINTENANCE', '2026-09-07', diaFase3(9, 4), true]]);
  const sug = Periodos.sugerencias(M).find(s => s.id === 'fases');
  assert.ok(sug);
  const C = Periodos.comparar(M, sug.A, sug.B);
  assert.deepEqual(C.A.nutricion.fases.map(x => [x.tipo, x.dias]), [['DEFICIT', 35]]);
  assert.equal(C.A.nutricion.ajusteKcal, -150);
  assert.deepEqual(C.A.nutricion.porTipo, { ADJUST: 2, HOLD: 1 });
  assert.equal(C.A.nutricion.refeeds, 1);
  assert.equal(C.B.nutricion.ajusteKcal, null, 'sin ajustes no es «0 kcal»');
  assert.ok(C.avisos.some(a => a.id === 'fases'));
  // Un periodo que cruza las dos fases las cuenta por días.
  const X = Periodos.comparar(M, { desde: D(2026, 9, 1), hasta: D(2026, 9, 13) }, sug.B);
  assert.deepEqual(X.A.nutricion.fases.map(x => [x.tipo, x.dias]), [['DEFICIT', 6], ['MAINTENANCE', 7]]);
});

test('peso, contornos y duración: sin extrapolar y solo con datos válidos', () => {
  const raw = copiaFase3();
  raw.medidas = { schemaVersion: 1, fotos: [], registros: [
    { fecha: '2026-09-08', sitio: 'cintura', cm: 84 }, { fecha: '2026-09-30', sitio: 'cintura', cm: 83 },
    { fecha: '2026-08-10', sitio: 'cintura', cm: 85 }, { fecha: '2026-08-10', sitio: 'pecho', cm: 5 }] };
  // Una duración anómala y otra corta no cuentan para la media.
  raw.logs[raw.logs.length - 1].duracionAnomala = true;
  raw.logs[raw.logs.length - 2].duracionMin = 10;
  const M = preparar(raw);
  const C = Periodos.comparar(M, { desde: D(2026, 8, 3), hasta: D(2026, 8, 30) }, { desde: D(2026, 9, 7), hasta: D(2026, 10, 9) });
  assert.equal(C.A.contornos.get('cintura').n, 1); assert.equal(C.A.contornos.get('cintura').cambio, null);
  assert.ok(!C.A.contornos.has('pecho'), 'un contorno fuera de rango no se usa');
  assert.equal(C.B.contornos.get('cintura').cambio, -1);
  assert.equal(C.B.peso.pesajes, 20);
  assert.ok(C.B.peso.cambio < 0 && C.B.peso.porSemana < 0);
  assert.equal(C.B.duracion.n, C.B.sesiones - 2);
  assert.equal(C.B.duracion.media, 60);
});

test('vista: diferencias sin ganador, escape, estados de error y ayudas sin cifras', () => {
  const raw = copiaFase3();
  raw.logs[0].entradas[0].ejercicio = 'Press <img src=x onerror=alert(1)>';
  const M = preparar(raw);
  const [ra, rb] = Periodos.bloquesRutina(M);
  const html = VistasEsc.entrenamiento(M, { sub: 'comparar', periodos: { A: ra, B: rb } });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/undefined|NaN|Infinity/.test(html));
  for (const t of ['Elige los periodos', 'Periodos comparados', 'Frecuencia, constancia y rendimiento', 'Series por grupo muscular',
    'Ejercicios en los dos periodos', 'Peso y medidas', 'Recuperación registrada', 'Diferencia (B − A)', 'Semana a semana'])
    assert.ok(html.includes(t), t);
  assert.ok(!/mejor periodo|ganador|gracias a|debido a|provoc[óo] /i.test(html.replace(/no indica cuál es mejor ni qué las provocó/, '')));
  assert.ok(html.includes('no comparable'), 'los totales de periodos de distinta duración no se restan');
  assert.ok(html.includes('selected'), 'el bloque elegido aparece seleccionado');
  const ayudas = [...html.matchAll(/<details class="detalle ayuda">([\s\S]*?)<\/details>/g)].map(m => m[1]);
  assert.ok(ayudas.length >= 5);
  for (const a of ayudas) assert.doesNotMatch(a.replace(/1RM|% graso/g, ''), /\d|%/, `ayuda con cifras: ${a.slice(0, 80)}`);
  // Periodo mal elegido: se explica y no se calcula nada.
  const mal = VistasEsc.compararPeriodos(M, { periodos: { A: { desde: D(2026, 9, 10), hasta: D(2026, 9, 1) }, B: rb } });
  assert.match(mal, /posterior a «hasta»/);
  assert.ok(!mal.includes('Periodos comparados'));
  // Sin selección: la predeterminada.
  assert.ok(VistasEsc.compararPeriodos(M, {}).includes('Tus últimas 4 semanas completas frente a las 4 anteriores'));
});

test('copias mínimas y antiguas: la comparación no falla', () => {
  const ctxM = (raw, r) => Analisis.preparar(raw, r);
  const vacia = ctxM({ sexo: 'hombre', dias: '3', logs: [] }, { ultimoRegistro: null });
  assert.match(VistasEsc.compararPeriodos(vacia, {}), /no tiene registros/);
  const rica = ctxM(copiaRica(), { ultimoRegistro: '2026-07-02', primerRegistro: '2026-06-01' });
  const html = VistasEsc.compararPeriodos(rica, {});
  assert.ok(!/undefined|NaN/.test(html));
  assert.ok(html.includes('Periodos comparados'));
  // Una sola sesión antigua sin rutina anotada.
  const antigua = ctxM({ sexo: 'hombre', dias: '3', logs: [{ fecha: '2025-01-10T10:00:00', dia: 'Día 1',
    entradas: [{ ejercicio: 'Press banca con barra', kg: 60, reps: [8, 8], rir: [2, 2] }] }] }, { ultimoRegistro: '2025-01-10' });
  const h2 = VistasEsc.compararPeriodos(antigua, {});
  assert.ok(!/undefined|NaN/.test(h2));
});
