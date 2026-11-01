// Cambios de App-PRO del 21/10 al 01/11/2026 que afectan a lo que se consulta
// en el escritorio. Cada caso reproduce el criterio de la prueba de la app
// citada, con datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarCoach, cargar } from './comun.mjs';

const { Motor, normalizar } = cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const { Analisis, ImportarJSON } = cargar('importar.js', 'analisis.js');

// --- rango_tras_paso_atras_test.dart: «Sentadilla» 8-12 en doble.
const estado = (logs, extra = {}) => ({ sexo: 'hombre', sistema: 'doble', dias: '3', logs,
  planMod: [{ dia: 'Pierna 1', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps', ejercicio: 'Sentadilla', series: 3, reps: '8-12', rir: '2' }], ...extra });
const log = (kg, reps, entrada = {}, fecha = '2026-10-01T10:00:00.000') => ({ fecha, variante: 'hombre_doble', dias: '3', dia: 'Pierna 1',
  estadoCompuerta: 'verde', entradas: [{ ejercicio: 'Sentadilla', kg, reps, rir: [2, 2, 2], ...entrada }] });

test('rango subido tras el paso atrás: cada sesión se juzga con el objetivo que tenía ese día', () => {
  // 12 reps con +2 de extra no cumplen (el objetivo de ese día era 14).
  const s = estado([log(90, [12, 12, 12], { repsExtra: 2, prescripcion: { reps: '8-12' } })]);
  const op = Motor.oportunidades(s, 'Sentadilla', 'Pierna 1', 12);
  assert.equal(op[0].extra, 2);
  assert.equal(op[0].completo, false);
  assert.equal(Motor.intentosConsumidos(s, 'Sentadilla', 'Pierna 1', 12), 1);
  // Con 14 sí cumple.
  assert.equal(Motor.oportunidades(estado([log(90, [14, 14, 14], { repsExtra: 2 })]), 'Sentadilla', 'Pierna 1', 12)[0].completo, true);
  // Sin la clave (copias anteriores) nada cambia.
  assert.equal(Motor.oportunidades(estado([log(90, [12, 12, 12])]), 'Sentadilla', 'Pierna 1', 12)[0].completo, true);
});

test('rango subido: editar el rango de la línea a mano cierra el episodio', () => {
  const s = estado([log(90, [12, 12, 12], { repsExtra: 2, prescripcion: { reps: '6-10' } })]);
  assert.equal(Motor.oportunidades(s, 'Sentadilla', 'Pierna 1', 12)[0].extra, 0);
  assert.equal(Motor.repsConExtra('8-12', 2), '10-14');
  assert.equal(Motor.repsConExtra('8', 0), '8');
});

test('rango subido: la ficha cuenta el objetivo de hoy mientras no se logra', () => {
  const raw = estado([log(90, [12, 12, 12], { repsExtra: 2, estancamientoTrasPasoAtras: true })], { planModKey: 'hombre_doble|3' });
  const M = Analisis.preparar(raw, ImportarJSON.resumen(raw));
  const st = M.ejercicios.get('Sentadilla').estados[0];
  assert.equal(st.repsExtra, 2);
  assert.equal(st.repsHoy, '10-14');
  assert.equal(st.trasPasoAtras, true);
});

test('cardio duplicado (cardio_duplicado_test): la repetición manual del reloj no cuenta', () => {
  const raw = { sexo: 'hombre', sistema: 'doble', dias: '3', logs: [
    { fecha: '2026-10-20T08:00:00.000', tipo: 'cardio', nombre: 'Entrenamiento', duracion: 40, origen: 'reloj', saludId: 'hc-1' },
    { fecha: '2026-10-20T19:00:00.000', tipo: 'cardio', nombre: 'Correr', duracion: 42, duplicadaDe: 'hc-1' },
    { fecha: '2026-10-21T19:00:00.000', tipo: 'cardio', nombre: 'Bici', duracion: 30 },
  ] };
  assert.equal(Motor.esCardioDuplicado(raw.logs[1]), true);
  assert.equal(Motor.esCardioDuplicado(raw.logs[0]), false);
  assert.equal(normalizar(raw).cardio.length, 2);
  assert.equal(ImportarJSON.resumen(raw).sesionesCardio, 2);
});

test('volumen: series quitadas por la autorregulación (volumen_historico seriesPlan)', () => {
  const info = n => ({ 'Press banca': { grupo: 'Pectoral', patron: 'Empuje horizontal', secundarios: ['Tríceps'] } })[n] || null;
  const logs = [
    // Entrada nueva: el plan pedía 4 y el día dejó 2 casillas.
    { fecha: '2026-10-05T10:00:00', variante: 'a', dias: '3', dia: 'Torso', entradas: [{ ejercicio: 'Press banca', reps: [8, 8], seriesPlan: 4 }] },
    // Entrada antigua en descarga, sin seriesPlan: se mide contra la rutina de hoy.
    { fecha: '2026-10-06T10:00:00', variante: 'a', dias: '3', dia: 'Torso', descarga: true, entradas: [{ ejercicio: 'Press banca', reps: [8, 8, 8] }] },
    // Entrada antigua normal: sin recorte reconocible.
    { fecha: '2026-10-07T10:00:00', variante: 'a', dias: '3', dia: 'Torso', entradas: [{ ejercicio: 'Press banca', reps: [8, 8] }] },
  ];
  const nominalHoy = Motor.nominalDePlan([{ dia: 'Torso', ejercicio: 'Press banca', series: 5 }]);
  const [c] = Motor.volumenReal({ logs, info, hoy: new Date(2026, 9, 11), gran: 'semana', nominalHoy });
  assert.equal(c.series.get('Pectoral'), 7);
  assert.equal(c.recortes.get('Pectoral'), 2 + 2);
  assert.equal(c.recortes.get('Tríceps'), 2);
  assert.equal(Motor.recorteSemanal(c, 'Pectoral'), 4);
  assert.equal(Motor.recorteSemanal(c), 6);
});

test('nombre del usuario (nombre_usuario_test): limpio, recortado y opcional', () => {
  assert.equal(Analisis.nombreUsuario('  Ana   María '), 'Ana María');
  assert.equal(Analisis.nombreUsuario('   '), null);
  assert.equal(Analisis.nombreUsuario(undefined), null);
  assert.equal(Analisis.nombreUsuario('x'.repeat(40)).length, 30);
});
