// Equivalencia de coach/motor.js con el motor de la app móvil.
// Cada caso reproduce una prueba de App-PRO/test/*.dart (citada) con sus
// mismos datos de entrada y su mismo resultado esperado. Datos sintéticos.
// Ejecutar con: node --test escritorio/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarCoach } from './comun.mjs';

const { Motor } = cargarCoach('motor.js');
const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// --- estancamiento_test.dart: AppData con «Sentadilla» 8-12 en sistema doble.
function estado(extra = {}){
  return { sexo: 'hombre', sistema: 'doble', dias: '3', logs: [],
    planMod: [{ dia: 'Pierna 1', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps',
                ejercicio: 'Sentadilla', series: 3, reps: '8-12', rir: '2' }], ...extra };
}
function log({ kg, reps, rir = [2, 2, 2], dia = 'Pierna 1', descarga = false,
               estadoCompuerta = 'verde', modulada = false, fecha = '2026-01-01T10:00:00.000', extra = {} }){
  return { fecha, variante: 'hombre_doble', dias: '3', dia, descarga, estadoCompuerta,
    entradas: [{ ejercicio: 'Sentadilla', kg, reps, rir, ...(modulada ? { modulada: true } : {}), ...extra }] };
}
const restantes = s => Motor.intentosMax(s.fasePeso) - Motor.intentosConsumidos(s, 'Sentadilla', 'Pierna 1', 12);

test('sesionesEstancadas: casos de la función pura (estancamiento_test)', () => {
  assert.equal(Motor.sesionesEstancadas([100, 100, 100], [false, false, false]), 3);
  assert.equal(Motor.sesionesEstancadas([100, 95, 95], [false, false, false]), 1);
  assert.equal(Motor.sesionesEstancadas([100, 100, 100, 100, 100], [false, false, true, false, false]), 2);
  assert.equal(Motor.sesionesEstancadas([100, 100], [true, false]), 0);
  assert.equal(Motor.sesionesEstancadas([null], [false]), 0);
});

test('intentos por fase de peso', () => {
  assert.equal(Motor.intentosMax(undefined), 4);
  assert.equal(Motor.intentosMax('normo'), 4);
  assert.equal(Motor.intentosMax('deficit'), 5);
  assert.equal(Motor.intentosMax('superavit'), 3);
});

test('objetivo de la línea: doble → último número, simple → primero', () => {
  assert.equal(Motor.objetivoLinea({ ejercicio: 'Sentadilla', reps: '8-12' }, 'doble'), 12);
  assert.equal(Motor.objetivoLinea({ ejercicio: 'Sentadilla', reps: '8-12' }, 'simple'), 8);
  assert.equal(Motor.objetivoLinea({ ejercicio: 'Plancha frontal', reps: '30' }, 'doble'), null);
  assert.equal(Motor.objetivoLinea({ ejercicio: 'X', reps: 'al fallo' }, 'doble'), null);
});

test('4 fallos con el mismo kg agotan los 4 intentos; 3 dejan 1', () => {
  const s = estado();
  for (let i = 0; i < 3; i++) s.logs.push(log({ kg: 100, reps: [10, 10, 9] }));
  assert.equal(restantes(s), 1);
  s.logs.push(log({ kg: 100, reps: [10, 10, 9] }));
  assert.equal(restantes(s), 0);
});

test('una sesión completada intercalada corta la racha', () => {
  const s = estado();
  s.logs.push(log({ kg: 100, reps: [10, 10, 9] }), log({ kg: 100, reps: [10, 10, 9] }),
              log({ kg: 100, reps: [12, 12, 12] }), log({ kg: 100, reps: [10, 10, 9] }));
  assert.equal(Motor.intentosConsumidos(s, 'Sentadilla', 'Pierna 1', 12), 1);
});

test('descargas: no consumen ni rompen la racha', () => {
  const s = estado();
  for (let i = 0; i < 3; i++) s.logs.push(log({ kg: 100, reps: [10, 10, 9], descarga: true }));
  assert.equal(restantes(s), 4);
  const t = estado();
  t.logs.push(log({ kg: 100, reps: [10, 10, 9] }), log({ kg: 90, reps: [8, 8, 8], descarga: true }),
              log({ kg: 100, reps: [10, 10, 9] }));
  assert.equal(restantes(t), 2);
});

test('sesión a medias no gasta intento; entera sí (sesion_a_medias_test)', () => {
  const s = estado();
  s.logs.push(log({ kg: 100, reps: [10, 10, 10] }), log({ kg: 100, reps: [10, 10, 10], fecha: '2026-01-01T11:00:00.000' }));
  const antes = restantes(s);
  s.logs.push(log({ kg: 100, reps: [10, 10, null], fecha: '2026-01-01T12:00:00.000' }));
  assert.equal(restantes(s), antes);
  s.logs.pop();
  s.logs.push(log({ kg: 100, reps: [10, 10, 10], fecha: '2026-01-01T12:00:00.000' }));
  assert.equal(restantes(s), antes - 1);
});

test('molestias y cambio solo por hoy no gastan intento', () => {
  for (const marca of ['molestias', 'sustitucion']){
    const s = estado();
    for (let i = 0; i < 3; i++) s.logs.push(log({ kg: 100, reps: [8, 8, 8], extra: { [marca]: true } }));
    assert.equal(restantes(s), 4, marca);
  }
});

test('ámbar sin marca por ejercicio no cuenta; con progresionPausada=false sí', () => {
  const s = estado();
  s.logs.push(log({ kg: 100, reps: [10, 10, 9], estadoCompuerta: 'ambar' }));
  assert.equal(restantes(s), 4);
  s.logs.push(log({ kg: 100, reps: [10, 10, 9], estadoCompuerta: 'ambar', extra: { progresionPausada: false } }));
  assert.equal(restantes(s), 3);
  s.logs.push(log({ kg: 100, reps: [10, 10, 9], modulada: true }));
  assert.equal(restantes(s), 3, 'modulada no cuenta');
});

test('entrada neutra: un fallo se ignora, un éxito corta la racha', () => {
  const s = estado();
  s.logs.push(log({ kg: 100, reps: [10, 10, 9] }), log({ kg: 100, reps: [10, 10, 9], extra: { neutra: true } }));
  assert.equal(restantes(s), 3);
  s.logs.push(log({ kg: 100, reps: [12, 12, 12], extra: { neutra: true } }));
  assert.equal(restantes(s), 4);
});

test('otra rutina (variante, días o revisión) no cuenta', () => {
  const s = estado({ rutinaRevision: 1 });
  for (let i = 0; i < 3; i++) s.logs.push(log({ kg: 100, reps: [10, 10, 9] }));
  assert.equal(restantes(s), 4, 'revisión 0 frente a la actual 1');
  s.logs.forEach(l => { l.rutinaRevision = 1; });
  assert.equal(restantes(s), 1);
});

test('rest-pause: el contador lee la suma (rest_pause_test)', () => {
  const s = { sexo: 'hombre', sistema: 'doble', dias: '3', logs: [], planMod: [
    { dia: 'Torso 1', orden: 1, patron: 'Flexión de codo', grupo: 'Bíceps', ejercicio: 'Curl bíceps',
      series: 3, reps: '20-25', rir: '2', restPause: true }] };
  const l = (reps, fecha) => ({ fecha, variante: 'hombre_doble', dias: '3', dia: 'Torso 1',
    entradas: [{ ejercicio: 'Curl bíceps', kg: 20, reps, rir: [0, 0, 0], restPause: true }] });
  s.logs.push(l([10, 7, 5], '2026-01-01T10:00:00'));
  assert.equal(Motor.intentosConsumidos(s, 'Curl bíceps', 'Torso 1', 25), 1);
  s.logs.push(l([12, 8, 5], '2026-01-03T10:00:00'));
  assert.equal(Motor.intentosConsumidos(s, 'Curl bíceps', 'Torso 1', 25), 0);
  assert.equal(Motor.repsObjetivoCumplido([11, 8, 6], 25, true), true);
  assert.equal(Motor.repsObjetivoCumplido([12, 7, 5], 25, true), false);
  assert.equal(Motor.repsObjetivoCumplido([11, 8, 6], 25, false), false);
});

test('top + back-off: solo las series top fijan el objetivo', () => {
  const s = estado();
  // back-offs a 85 kg con pocas reps: la top a 100 cumple 12.
  s.logs.push(log({ kg: 100, reps: [12, 6, 6], extra: { kgSets: [100, 85, 85] } }));
  assert.equal(Motor.intentosConsumidos(s, 'Sentadilla', 'Pierna 1', 12), 0);
  // back-off sin anotar no invalida la oportunidad; top vacía sí.
  const e = Motor.entrada({ ejercicio: 'Sentadilla', kg: 100, kgSets: [100, 85], reps: [10, null] });
  assert.equal(Motor.oportunidadCompleta(e), true);
  assert.equal(Motor.oportunidadCompleta(Motor.entrada({ ejercicio: 'S', kg: 100, reps: [null, null] })), false);
});

test('carga efectiva (dominada_lastre_test y dominada_asistida_test)', () => {
  cerca(Motor.cargaEfectiva('Dominada agarre prono', 20, 80), 100);
  cerca(Motor.cargaEfectiva('Dominada agarre prono', 0, 80), 80);
  cerca(Motor.cargaEfectiva('Dominada agarre prono', -10, 80), 70);
  cerca(Motor.cargaEfectiva('Sentadilla con barra', 100, 80), 100);
  cerca(Motor.cargaEfectiva('Dominada asistida en máquina', 36, 80), 44);
  cerca(Motor.cargaEfectiva('Dominada asistida en máquina', -36, 80), 44);
  cerca(Motor.cargaEfectiva('Dominada con banda elástica', 36, 80), 44);
  cerca(Motor.cargaEfectiva('Dominada con banda elástica', -36, 80), 44);
  cerca(Motor.cargaEfectiva('Fondos en máquina', 40, 80), 40);
  assert.equal(Motor.cargaOrientada('Dominada asistida en máquina', -36), 36);
});

test('mejor marca: carga efectiva, Epley con RIR, drops fuera, solo verde y evaluable', () => {
  const ses = (kg, extra = {}, entradaExtra = {}) => ({ fecha: '2026-01-01T10:00:00', variante: 'hombre_doble', dias: '3',
    estadoCompuerta: 'verde', ...extra, entradas: [{ ejercicio: 'Dominada agarre prono', kg, reps: [12], rir: [2], ...entradaExtra }] });
  cerca(Motor.mejorMarca([ses(20)], 'Dominada agarre prono', 80), 100 * (1 + 14 / 30));
  cerca(Motor.mejorMarca([ses(0)], 'Dominada agarre prono', 80), 80 * (1 + 14 / 30));
  assert.equal(Motor.mejorMarca([ses(20, { estadoCompuerta: 'ambar' })], 'Dominada agarre prono', 80), null);
  assert.equal(Motor.mejorMarca([ses(20, { estadoSemaforo: 'rojo', estadoCompuerta: 'verde' })], 'Dominada agarre prono', 80), null);
  cerca(Motor.mejorMarca([ses(20, { estadoCompuerta: 'ambar' }, { estadoEjercicio: 'verde' })], 'Dominada agarre prono', 80), 100 * (1 + 14 / 30));
  assert.equal(Motor.mejorMarca([ses(20, {}, { molestias: true })], 'Dominada agarre prono', 80), null);
  assert.equal(Motor.mejorMarca([ses(20, {}, { sustitucion: true })], 'Dominada agarre prono', 80), null);
  // drop_set_test: solo la primera serie.
  const drop = [{ fecha: '2026-01-01', variante: 'v', dias: '3', entradas: [{ ejercicio: 'Press banca', kg: 100,
    kgSets: [100, 90, 80], reps: [5, 30, 30], rir: [2, 0, 0], dropSet: true }] }];
  cerca(Motor.mejorMarca(drop, 'Press banca', 80), 100 * (1 + 7 / 30));
});

test('e1RM: tope de 18 reps efectivas en marcas, sin tope en la gráfica', () => {
  cerca(Motor.e1rmEpley(50, 20, 2), 50 * (1 + 18 / 30));
  cerca(Motor.e1rmEpley(50, 20, 2, null), 50 * (1 + 22 / 30));
  const e = Motor.entrada({ ejercicio: 'Curl', kg: 20, reps: [20], rir: [2] });
  assert.equal(Motor.mejorSerie(e, 80, { cap: null }).menosFiable, true);
  assert.equal(Motor.mejorSerie(Motor.entrada({ ejercicio: 'Curl', kg: 20, reps: [18], rir: [3] }), 80).menosFiable, false);
});

test('nombres fusionados se leen con el nombre vigente', () => {
  assert.equal(Motor.entrada({ ejercicio: 'Face pull en polea' }).ejercicio, 'Face pull con cuerda alto');
});

test('valoración: tendencia con los umbrales de la gráfica (valoracion_progreso_test)', () => {
  assert.equal(Motor.tendenciaValoracion([4, 4], 3), null);
  assert.equal(Motor.tendenciaValoracion([], 3), null);
  assert.equal(Motor.tendenciaValoracion([0, 3, 1, 5], 3), 'mejora');
  assert.equal(Motor.tendenciaValoracion([-4, 0, -3], 3), 'cae');
  assert.equal(Motor.tendenciaValoracion([-4, 1, 4, 0], 3), 'mixta');
  assert.equal(Motor.tendenciaValoracion([1, -1, 2, 0], 3), 'sostiene');
  assert.equal(Motor.tendenciaValoracion([1, -4, 2, 0], 3), 'sostiene');
  assert.equal(Motor.tendenciaValoracion([-5, -5, 0, 1, 0, 2], 3), 'sostiene');
});

test('valoración: puntos sin descargas, sin huecos de base y dentro de 28 días', () => {
  const ref = new Date(2026, 0, 31, 12);
  const logs = [
    { fecha: '2025-12-20T10:00:00', rawSessionPct: 9 },          // fuera de la ventana
    { fecha: '2026-01-10T10:00:00', rawSessionPct: 0, displayBaselinePoint: true },
    { fecha: '2026-01-12T10:00:00', rawSessionPct: 5, descarga: true },
    { fecha: '2026-01-14T10:00:00', rendimientoPct: 104 },      // formato antiguo
    { fecha: '2026-01-16T10:00:00', rawSessionPct: -1 },
    { fecha: '2026-01-18T10:00:00', tipo: 'cardio' },
    { fecha: '2026-01-20T10:00:00', rawSessionPct: 3.5 },
  ];
  assert.deepEqual(Motor.puntosValoracion(logs, ref).map(p => p.pct), [4, -1, 3.5]);
});

test('rendimiento de gráfica: hueco donde no había base', () => {
  assert.equal(Motor.rawPctGrafica({ rawSessionPct: 0, displayBaselinePoint: true }), null);
  assert.equal(Motor.rawPctGrafica({ rawSessionPct: 0 }), 0);
  assert.equal(Motor.rawPctGrafica({ rendimientoPct: 97 }), -3);
  assert.equal(Motor.rawPctGrafica({ rendimiento: 'buena' }), 4);
  assert.equal(Motor.netPctGrafica({ netDailyPerformancePct: 0, netDisplayBaselinePoint: true }), null);
  assert.equal(Motor.veredictoDeLog({ netDailyPerformancePct: -7, tolPctAtSave: 3 }, 4), 'muy flojo');
  assert.equal(Motor.veredictoDeLog({ verdictAtSave: 'bueno', netDailyPerformancePct: -7 }, 3), 'bueno');
});

test('tolerancia: la congelada al guardar manda; sin ella, la de la fase', () => {
  const ref = new Date(2026, 1, 1);
  assert.deepEqual(Motor.tolerancia({ logs: [{ fecha: '2026-01-05', tolPctAtSave: 2.5 }] }, ref), { tol: 2.5, guardada: true });
  assert.equal(Motor.tolerancia({ logs: [], fasePeso: 'deficit', faseInicio: '2025-12-01' }, ref).tol, 2);
  assert.equal(Motor.tolerancia({ logs: [], fasePeso: 'superavit', faseInicio: '2026-01-25' }, ref).tol, 3.5);
  assert.equal(Motor.tolerancia({ logs: [], fasePeso: 'normo', fasePrevia: 'deficit', faseInicio: '2026-01-25' }, ref).tol, 2.5);
});

test('volumen real: series hechas, secundarios a media, isquios/glúteo, no disponibles fuera', () => {
  const fichas = {
    'Peso muerto rumano': { grupo: 'Isquios/glúteo', patron: 'Bisagra', secundarios: ['Isquios/glúteo', 'Espalda'] },
    'Hip thrust': { grupo: 'Isquios/glúteo', patron: 'Glúteo', secundarios: ['Isquios/glúteo'] },
    'Press banca': { grupo: 'Pectoral', patron: 'Empuje horizontal', secundarios: ['Tríceps', 'Hombro'] },
    'Aductores en máquina': { grupo: 'Isquios/glúteo', patron: 'Aislamiento', secundarios: [] },
  };
  const info = n => fichas[n] || null;
  const logs = [{ fecha: '2026-01-05T10:00:00', variante: 'a', dias: '3', entradas: [
    { ejercicio: 'Peso muerto rumano', reps: [8, 8, null] },
    { ejercicio: 'Hip thrust', reps: [10, 10, 10] },
    { ejercicio: 'Press banca', reps: [8, 8, 8, 8], noDisponible: true },
    { ejercicio: 'Aductores en máquina', reps: [12, 12] },
    { ejercicio: 'Inventado', reps: [10] },
    { ejercicio: 'Press banca', rir: [2, 2] },
  ] }, { fecha: '2026-01-14T10:00:00', variante: 'b', dias: '3', entradas: [{ ejercicio: 'Press banca', reps: [8] }] }];
  const cubos = Motor.volumenReal({ logs, info, hoy: new Date(2026, 0, 15), gran: 'semana' });
  assert.equal(cubos.length, 2);
  const c = cubos[0];
  assert.equal(c.series.get('Isquios'), 2 + 1.5);  // RDL 2 + autosecundario del hip thrust
  assert.equal(c.series.get('Glúteo'), 3 + 1);     // hip thrust 3 + autosecundario del RDL
  assert.equal(c.series.get('Espalda'), 1);
  assert.equal(c.series.get('Pectoral'), 2);       // series con RIR en entrada antigua sin reps
  assert.equal(c.series.get('Tríceps'), 1);
  assert.equal(cubos[1].cambioRutina, true);
  assert.equal(cubos[1].enCurso, true);
  assert.equal(cubos[1].dias, 4);
  assert.equal(Motor.tasaSemanal(cubos[1], 'Pectoral'), 1, 'menos de 7 días: tal cual, sin proyectar');
});
