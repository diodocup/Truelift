// Series libres (App-PRO #297, 12/11/2026): cada serie con su objetivo de
// reps y de RIR, su peso y su progresión. Motor por serie (vista de la
// serie), visor del escritorio y modo entrenador. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js', 'canonico.js', 'planner.js');
const G = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'comparacion.js', 'vistas.js', 'informe.js',
  'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/temporada.js', 'entrenador/planificador.js');
const { Analisis, VistasEsc, Motor, PlanificadorEntrenador: PL, PaqueteEntrenador: P } = G;
const plain = x => JSON.parse(JSON.stringify(x));
const resumen = { ultimoRegistro: '2026-07-02', ultimoEntreno: '2026-07-02', primerRegistro: '2026-06-01' };

const LIBRES = { seriesLibres: true, repsSeries: ['5', '8-10', '10-12'], rirSeries: ['1', '2', '2'] };

/* copiaRica con el press banca en series libres: la sesión del 08/06 es de
   antes (series rectas a 80 kg) y las del 15/06 y 22/06, en series libres. */
function copiaLibres(){
  const raw = copiaRica();
  Object.assign(raw.planMod[0], LIBRES);
  raw.logs[3].entradas[0] = { ejercicio: 'Press banca con barra', kg: 100, kgSets: [100, 80, 60], reps: [5, 9, 12], rir: [1, 2, 2], obs: '', seriesLibres: true };
  Object.assign(raw.logs[5], { estadoSemaforo: 'verde', estadoCompuerta: 'verde' });
  raw.logs[5].entradas[0] = { ejercicio: 'Press banca con barra', kg: 102.5, kgSets: [102.5, 80, 62.5], reps: [4, 9, 10], rir: [1, 2, 2], obs: '', seriesLibres: true };
  return raw;
}

// ---------------------------------------------------------------
// Motor
// ---------------------------------------------------------------

test('objetivo por serie: el suyo en series libres y el de la línea si falta', () => {
  const l = { ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2', ...LIBRES };
  assert.deepEqual(plain(Motor.objetivosSeries(l)), [{ serie: 0, reps: '5', rir: '1' }, { serie: 1, reps: '8-10', rir: '2' }, { serie: 2, reps: '10-12', rir: '2' }]);
  assert.equal(Motor.repsDeSerie({ ...l, repsSeries: ['5', ' '] }, 1), '6-10');
  assert.equal(Motor.repsDeSerie({ ...l, seriesLibres: false }, 0), '6-10');
  assert.equal(Motor.esSeriesLibresLinea(l), true);
  assert.equal(Motor.esSeriesLibresLinea({ ...l, series: 1 }), false, 'necesita 2 series');
  assert.equal(Motor.esSeriesLibresLinea({ ...l, topBack: true }), false, 'cede ante top + back');
  assert.equal(Motor.esSeriesLibresLinea({ ...l, ejercicio: 'Plancha frontal' }), false, 'nunca por tiempo');
  const una = Motor.lineaDeSerieLibre(l, 2);
  assert.equal(una.reps, '10-12'); assert.equal(una.rir, '2'); assert.equal(una.series, 1);
  assert.equal(una.seriesLibres, false); assert.equal(una.repsSeries, undefined);
});

test('entrada de una serie: su peso, sus reps, su extra y su objetivo del día', () => {
  const cruda = { ejercicio: 'Press banca con barra', kg: 100, kgSets: [100, 80, 60], reps: [5, 9, 12], rir: [1, 2, 3], seriesLibres: true,
    repsExtra: 2, repsExtraSeries: [0, 2, 0], intentosTotalSeries: [4, 5, 4],
    prescripcion: { tecnica: 'libres', reps: '5', rir: '1', repsSeries: '5|8-10|10-12', rirSeries: '1|2|2' } };
  const s1 = Motor.entradaDeSerie(cruda, 1);
  assert.equal(s1.kg, 80); assert.deepEqual(s1.reps, [9]); assert.deepEqual(s1.rir, [2]);
  assert.equal(s1.repsExtra, 2); assert.equal(s1.intentosTotal, 5);
  assert.deepEqual(s1.prescripcion, { tecnica: 'recta', reps: '8-10', rir: '2' });
  for (const k of ['kgSets', 'seriesLibres', 'repsExtraSeries', 'intentosTotalSeries']) assert.equal(k in s1, false, k);
  assert.equal(Motor.entradaDeSerie(cruda, 0).repsExtra, undefined, 'sin extra en su serie');
  assert.equal(Motor.entradaDeSerie(cruda, 3), null, 'serie nueva: sin historial');
  // Una entrada de antes de las series libres se lee por su serie.
  const vieja = Motor.entradaDeSerie({ ejercicio: 'Press banca con barra', kg: 80, reps: [8, 8, 7], rir: [2, 2, 1], repsExtra: 2 }, 2);
  assert.equal(vieja.kg, 80); assert.deepEqual(vieja.reps, [7]); assert.equal(vieja.repsExtra, 2);
  // Todas las series son «top»: ninguna es un back-off.
  const e = Motor.entrada(cruda);
  assert.equal(e.seriesLibres, true);
  assert.deepEqual([0, 1, 2].map(s => Motor.esSerieTop(e, s)), [true, true, true]);
  assert.deepEqual(Motor.repsTop(e), [5, 9, 12]);
});

test('la vista de una serie no toca la copia y conserva el orden de las sesiones', () => {
  const raw = copiaLibres(); const antes = JSON.stringify(raw);
  const v = Motor.vistaSerieLibre(raw, raw.planMod[0], 1);
  assert.equal(JSON.stringify(raw), antes);
  assert.equal(v.logs.length, raw.logs.length);
  assert.equal(v.logs[3].entradas[0].kg, 80);
  assert.equal(v.logs[4], raw.logs[4], 'otro día: la misma sesión');
  assert.equal(v.planMod[0].reps, '8-10');
  assert.equal(v.planMod[1], raw.planMod[1]);
});

// ---------------------------------------------------------------
// Visor
// ---------------------------------------------------------------

test('estado: cada serie con su contador y el ejercicio buscando el objetivo', () => {
  const M = Analisis.preparar(copiaLibres(), resumen);
  const [st] = M.ejercicios.get('Press banca con barra').estados;
  assert.equal(st.libres, true);
  assert.equal(st.tipo, 'enCurso');
  assert.equal(st.series.length, 3);
  // Serie 1: 102,5 kg sin llegar a 5 tras subir. Serie 2: tres sesiones a
  // 80 kg sin llegar a 10 (la de antes de las series libres cuenta por su
  // serie). Serie 3: 62,5 kg sin llegar a 12 tras subir.
  assert.deepEqual(st.series.map(x => x.consumidos), [1, 3, 1]);
  assert.deepEqual(st.series.map(x => x.ultima.kg), [102.5, 80, 62.5]);
  assert.deepEqual(st.series.map(x => x.reps), ['5', '8-10', '10-12']);
  assert.equal(st.buscando, 3);
  const t = VistasEsc.estadoTexto(st);
  assert.equal(t.corto, 'Buscando el objetivo (3 de 3 series)');
  assert.doesNotMatch(t.largo, /\d/, 'sin cifras del algoritmo');
});

test('estado: agotado solo cuando lo están todas las series', () => {
  const raw = copiaLibres();
  raw.fasePeso = 'superavit';  // 3 intentos
  const M = Analisis.preparar(raw, resumen);
  const [st] = M.ejercicios.get('Press banca con barra').estados;
  assert.equal(st.series[1].tipo, 'intentosAgotados');
  assert.equal(st.tipo, 'enCurso');
  const ci = Analisis.conclusiones(M).find(c => c.id === 'intentos');
  assert.ok(!ci || !ci.datos.filas.some(f => f.celdas[0] === 'Press banca con barra'));
  // Con todas agotadas sí: se ve cada serie en los datos de la conclusión.
  const r2 = copiaLibres();
  r2.fasePeso = 'superavit';
  r2.planMod[0].repsSeries = ['12', '10', '15'];
  // Las tres sesiones con 80 kg en cada serie y sin llegar a su objetivo.
  for (const i of [3, 5]) Object.assign(r2.logs[i].entradas[0], { kg: 80, kgSets: [80, 80, 80] });
  const M2 = Analisis.preparar(r2, resumen);
  const [st2] = M2.ejercicios.get('Press banca con barra').estados;
  assert.equal(st2.tipo, 'intentosAgotados', JSON.stringify(st2.series.map(x => [x.tipo, x.consumidos])));
  const c = Analisis.conclusiones(M2).find(x => x.id === 'intentos');
  assert.ok(c);
  assert.ok(c.datos.filas.some(f => /serie 2/.test(f.celdas[1])));
});

test('sesiones, ficha y rutina enseñan las series libres', () => {
  const M = Analisis.preparar(copiaLibres(), resumen);
  const ej = M.ejercicios.get('Press banca con barra');
  const p = ej.puntos.find(x => x.e.seriesLibres);
  assert.equal(p.topBack, false, 'pesos distintos, pero no son back-offs');
  assert.equal(Analisis.configuracion(p), 'libres');
  assert.equal(Analisis.MODALIDAD_TXT.libres, 'series libres');
  assert.deepEqual(Analisis.seriesDe(p.e).map(s => s.papel), ['top', 'top', 'top']);
  const ficha = VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: 'Press banca con barra' });
  assert.match(ficha, /Series libres: 5 @1 · 8-10 @2 · 10-12 @2/);
  assert.match(ficha, /Estado de cada serie en Torso/);
  assert.match(ficha, /Torso · serie 2 · objetivo 8-10 reps/);
  assert.match(VistasEsc.detalleSesionHtml(M, M.sesiones.find(s => s.fecha.getDate() === 15).indice), /Series libres/);
  const rutina = VistasEsc.rutina(M);
  assert.match(rutina, /5 · 8-10 · 10-12/);
  assert.match(rutina, /1 · 2 · 2/);
  assert.match(rutina, /Series libres/);
});

// ---------------------------------------------------------------
// Modo entrenador
// ---------------------------------------------------------------

function copiaPlanLibres(){
  const raw = copiaRica();
  Object.assign(raw.planMod[0], LIBRES);
  raw.planMod[1].superConAnterior = true;  // compatible con la superserie
  return raw;
}
const carga = rutina => ({ id: 'pe_x', emitido: '2026-11-12', entrenador: { nombre: 'E' }, cliente: { nombre: 'C' }, rutina });

test('rutina de la copia: series libres en el editor y la misma rutina al simular la app', () => {
  const raw = copiaPlanLibres();
  const m = PL.rutinaCopia(raw);
  const f = m.rutina.dias[0].filas[0];
  assert.equal(f.seriesLibres, true);
  assert.deepEqual(plain(f.porSerie), [{ repsMin: 5, repsMax: null, rir: 1 }, { repsMin: 8, repsMax: 10, rir: 2 }, { repsMin: 10, repsMax: 12, rir: 2 }]);
  assert.equal(m.normal.dias[0].lineas[0].modalidad, 'libres');
  assert.deepEqual(m.normal.dias[0].lineas[0].repsSeries, ['5', '8-10', '10-12']);
  assert.equal(m.normal.dias[0].lineas[1].superserie, true, 'la superserie se conserva');
  // En doble, la serie de «5» no es un rango: el paquete lo completa y lo avisa.
  const sim = PL.simular(m.rutina, raw);
  const fila = sim.paquete.dias[0].ejercicios[0];
  assert.deepEqual(fila.repsSeries, ['5-7', '8-10', '10-12']);
  assert.deepEqual(fila.rirSeries, ['1', '2', '2']);
  assert.equal(fila.reps, '5-7'); assert.equal(fila.rir, '1');
  assert.equal(fila.seriesLibres, true);
  assert.equal(sim.paquete.dias[0].ejercicios[1].superserie, 1);
  assert.ok(sim.notas.some(n => /serie 1 irá a 5-7/.test(n.txt)));
  assert.equal(P.validarCarga(carga(sim.paquete)), null);
  // Con rangos en todas las series, la app construye exactamente la copia.
  raw.planMod[0].repsSeries = ['4-6', '8-10', '10-12'];
  const m2 = PL.rutinaCopia(raw);
  const sim2 = PL.simular(m2.rutina, raw);
  assert.deepEqual(sim2.notas, []);
  assert.equal(PL.firma(sim2.normal), PL.firma(m2.normal));
});

test('paquete: las claves de series libres solo viajan si la fila las usa', () => {
  const raw = copiaRica();
  const { rutina } = PL.paqueteRutina(PL.rutinaCopia(raw).rutina, raw);
  for (const d of rutina.dias) for (const e of d.ejercicios)
    for (const k of ['seriesLibres', 'repsSeries', 'rirSeries']) assert.equal(k in e, false, k);
});

test('validación del plan: listas de texto de hasta 10 y booleano', () => {
  const base = { patron: 'Empuje horizontal', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2' };
  const dia = e => ({ nombre: 'A', ejercicios: [e] });
  const r = e => carga({ nombre: '', sistema: 'doble', dias: [dia(e), dia(base)] });
  assert.equal(P.validarCarga(r({ ...base, seriesLibres: true, repsSeries: ['5', '8-10'], rirSeries: ['1', '2'] })), null);
  assert.ok(P.validarCarga(r({ ...base, seriesLibres: 'sí' })));
  assert.ok(P.validarCarga(r({ ...base, repsSeries: '5|8' })));
  assert.ok(P.validarCarga(r({ ...base, repsSeries: Array(11).fill('8') })));
  assert.ok(P.validarCarga(r({ ...base, rirSeries: ['1', ''] })));
});

test('editor: activar, cambiar series y objetivo de una serie, y exclusiones', () => {
  const raw = copiaRica();
  let r = PL.rutinaCopia(raw).rutina;
  const fila = () => r.dias[0].filas[0];
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'modalidad', valor: 'libres' });
  assert.equal(fila().seriesLibres, true);
  assert.deepEqual(plain(fila().porSerie), Array(3).fill({ repsMin: 6, repsMax: 10, rir: 2 }), 'cada serie parte de la fila');
  r = PL.editar(r, { tipo: 'serie', d: 0, f: 0, s: 2, k: 'repsMin', valor: '12' });
  r = PL.editar(r, { tipo: 'serie', d: 0, f: 0, s: 2, k: 'repsMax', valor: '15' });
  r = PL.editar(r, { tipo: 'serie', d: 0, f: 0, s: 0, k: 'rir', valor: '1' });
  assert.equal(fila().rir, 1, 'la fila copia la 1.ª serie');
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'series', valor: '4' });
  assert.deepEqual(plain(fila().porSerie[3]), { repsMin: 12, repsMax: 15, rir: 2 }, 'la nueva copia la última');
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'series', valor: '1' });
  assert.equal(fila().series, 2, 'al menos 2');
  assert.equal(fila().porSerie.length, 2);
  // Superserie con el siguiente: compatible.
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'superConAnterior', valor: true });
  assert.equal(r.dias[0].filas[1].superConAnterior, true);
  assert.equal(fila().seriesLibres, true);
  // Otra modalidad la sustituye.
  const tb = PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'modalidad', valor: 'topBack' });
  assert.equal(tb.dias[0].filas[0].seriesLibres, false);
  assert.deepEqual(tb.dias[0].filas[0].porSerie, []);
  assert.equal(tb.dias[0].filas[0].topBack, true);
  // Volver a series normales deja el objetivo de la 1.ª serie.
  const nor = PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'modalidad', valor: 'normal' });
  assert.equal(nor.dias[0].filas[0].seriesLibres, false);
  assert.equal(nor.dias[0].filas[0].rir, 1);
  // Un borrador con dos modalidades: ceden las series libres.
  const n = PL.normalizarRutina({ sistema: 'doble', dias: [{ nombre: 'A', filas: [{ ...fila(), topBack: true }] }] });
  assert.equal(n.dias[0].filas[0].seriesLibres, false);
});

test('comparación y avisos: cambios por serie y ejercicios por tiempo', () => {
  const raw = copiaPlanLibres();
  raw.planMod[0].repsSeries = ['4-6', '8-10', '10-12'];
  const m = PL.rutinaCopia(raw);
  let r = PL.editar(m.rutina, { tipo: 'serie', d: 0, f: 0, s: 1, k: 'repsMax', valor: '12' });
  const d = PL.diferencias(m.normal, PL.simular(r, raw).normal);
  const c = d.dias[0].cambios.find(x => x.ejercicio === 'Press banca con barra');
  assert.deepEqual(c.campos.map(x => x.campo), ['repsSeries']);
  assert.deepEqual(c.campos[0].despues, ['4-6', '8-12', '10-12']);
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'ejercicio', valor: 'Plancha frontal' });
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'modalidad', valor: 'libres' });
  const av = PL.avisos(r, raw);
  assert.ok(av.avisos.some(a => /no le aplica las series libres/.test(a.txt)));
});
