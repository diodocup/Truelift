// Escritorio al día con la app (App-PRO, 12-18/11/2026): series alternas,
// entrenamiento corto, sesión extra, vuelta escalonada tras un parón, noches
// con «Enfermo» fuera de la referencia de VFC y FC en reposo. Datos
// sintéticos sobre copiaRica.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js', 'canonico.js', 'planner.js');
const G = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'comparacion.js', 'vistas.js', 'informe.js', 'senales.js',
  'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/temporada.js', 'entrenador/planificador.js');
const { Analisis, VistasEsc, Motor, VFC, FCReposo, normalizar } = G;
const resumen = { ultimoRegistro: '2026-07-02', ultimoEntreno: '2026-07-02', primerRegistro: '2026-06-01' };
const SENT = 'Sentadilla con barra';

// ---------------------------------------------------------------
// Entrenamiento corto y sesión extra
// ---------------------------------------------------------------

test('motor: la sesión corta y la extra no se evalúan, como molestias', () => {
  assert.equal(Motor.noEvaluable(Motor.entrada({ ejercicio: 'X', kg: 50, reps: [8], sesionCorta: true })), true);
  assert.equal(Motor.noEvaluable(Motor.entrada({ ejercicio: 'X', kg: 50, reps: [8], extra: true })), true);
  assert.equal(Motor.noEvaluable(Motor.entrada({ ejercicio: 'X', kg: 50, reps: [8] })), false);
  assert.equal(Motor.nivelSesionCorta({ sesionCorta: 'expres' }), 'expres');
  assert.equal(Motor.nivelSesionCorta({ sesionCorta: 'corta' }), 'corta');
  assert.equal(Motor.nivelSesionCorta({ sesionCorta: true }), null);
  assert.equal(Motor.nivelSesionCorta({}), null);
});

test('una sesión corta no gasta intento, no fija marca y se señala en el visor', () => {
  const raw = copiaRica();
  const linea = raw.planMod.find(p => p.ejercicio === SENT);
  const objetivo = Motor.objetivoLinea(linea, raw.sistema, raw);
  const antes = Motor.oportunidades(raw, SENT, linea.dia, objetivo).length;
  // La última sesión de pierna, reducida a «Corta» y con una marca enorme.
  const l = raw.logs[8];
  l.sesionCorta = 'corta';
  l.entradas = l.entradas.map(e => ({ ...e, sesionCorta: true }));
  l.entradas[0] = { ...l.entradas[0], kg: 200, reps: [10, 10, 10] };
  assert.equal(Motor.oportunidades(raw, SENT, linea.dia, objetivo).length, antes - 1);
  const M = Analisis.preparar(raw, resumen);
  const ej = M.ejercicios.get(SENT);
  assert.ok(ej.marca.valor < 200, 'la sesión corta no fija marca');
  const p = ej.puntos.find(x => x.sesion.indice === 8);
  assert.equal(p.evaluable, false);
  assert.equal(Analisis.motivoNoComparable(p), 'corta');
  const s = M.sesiones.find(x => x.indice === 8);
  const html = VistasEsc.detalleSesionHtml(M, 8);
  assert.match(html, /Sesión corta/);
  assert.match(html, /no para tu progresión/);
  assert.ok(s.entradas.every(e => e.corta));
});

test('la sesión extra suma su volumen en la semana en que se hizo', () => {
  const raw = copiaRica();
  const base = Analisis.volumen(Analisis.preparar(raw, resumen)).cubos;
  raw.sesionesExtra = [{ tipo: 'extra', fecha: '2026-06-30T19:00:00.000', variante: 'otra', dias: '9',
    entradas: [{ ejercicio: SENT, kg: 90, reps: [8, 8, 8], rir: [2, 2, 2], extra: true }] }];
  const con = Analisis.volumen(Analisis.preparar(raw, resumen)).cubos;
  const total = cs => cs.reduce((a, c) => a + [...c.series.values()].reduce((x, y) => x + y, 0), 0);
  assert.ok(total(con) > total(base), 'suma series');
  assert.deepEqual(con.map(c => c.cambioRutina), base.map(c => c.cambioRutina), 'no marca cambio de rutina');
  assert.deepEqual(con.map(c => c.sesiones), base.map(c => c.sesiones), 'no cuenta como sesión de la rutina');
});

// ---------------------------------------------------------------
// Vuelta escalonada tras un parón
// ---------------------------------------------------------------

test('vuelta escalonada: fallar con la carga reducida no gasta intento; cumplir sí cuenta', () => {
  const raw = copiaRica();
  const linea = raw.planMod.find(p => p.ejercicio === SENT);
  const objetivo = Motor.objetivoLinea(linea, raw.sistema, raw);
  const antes = Motor.oportunidades(raw, SENT, linea.dia, objetivo);
  const e = raw.logs[8].entradas[0];
  assert.equal(antes[0].completo, false, 'la última sesión no cumple');
  e.rampaParon = { marca: 110, inicio: 95, pasos: 2 };
  e.kg = 95;
  const op = Motor.oportunidades(raw, SENT, linea.dia, objetivo);
  assert.equal(op.length, antes.length - 1);
  assert.ok(Motor.rampaEnCurso(Motor.entrada(e)));
  // Con la marca recuperada ya no es rampa.
  assert.equal(Motor.rampaEnCurso(Motor.entrada({ ...e, kg: 110 })), null);
  // Una rampa corrupta se ignora.
  assert.equal(Motor.entrada({ ...e, rampaParon: { marca: 90, inicio: 95, pasos: 2 } }).rampaParon, null);
  assert.match(VistasEsc.detalleSesionHtml(Analisis.preparar(raw, resumen), 8), /Vuelta tras un parón/);
});

// ---------------------------------------------------------------
// Series alternas
// ---------------------------------------------------------------

test('series alternas: grupos por número aunque no vayan seguidos y conversión del enlace antiguo', () => {
  const plan = [
    { dia: 'A', orden: 1, grupoAlterno: 2, superConAnterior: false },
    { dia: 'A', orden: 2, grupoAlterno: 0, superConAnterior: false },
    { dia: 'A', orden: 3, grupoAlterno: 2, superConAnterior: false },
    { dia: 'B', orden: 1, superConAnterior: false },
    { dia: 'B', orden: 2, superConAnterior: true },
    { dia: 'B', orden: 3, superConAnterior: true, restPause: true },
  ];
  const g = Motor.saGruposPlan(plan);
  assert.deepEqual(plan.map(p => g.get(p)), [1, 0, 1, 1, 1, 0]);
  assert.equal(plan[3].grupoAlterno, undefined, 'no toca la copia');
  assert.deepEqual(Motor.saOrden([{ grupoAlterno: 1 }, { grupoAlterno: 0 }, { grupoAlterno: 1 }]), [0, 2, 1]);
});

test('Mi rutina y las sesiones hablan de series alternas', () => {
  const raw = copiaRica();
  const torso = raw.planMod.filter(p => p.dia === 'Torso');
  torso.forEach(p => { p.grupoAlterno = 0; p.superConAnterior = false; });
  // El curl va en rest-pause: no cabe en un grupo y sale de él.
  torso[2].grupoAlterno = 4; assert.equal(Motor.saGruposPlan(raw.planMod).get(torso[2]), 0);
  torso[2].restPause = false;
  torso[0].grupoAlterno = 4; torso[0].topBack = true;
  raw.logs[7].entradas[0].superserie = 1;
  const M = Analisis.preparar(raw, resumen);
  const html = VistasEsc.rutina(M);
  assert.equal((html.match(/Series alternas 1/g) || []).length, 2);
  assert.doesNotMatch(html, /Superserie/);
  assert.match(VistasEsc.detalleSesionHtml(M, 7), /Series alternas 1/);
});

// ---------------------------------------------------------------
// VFC y FC en reposo
// ---------------------------------------------------------------

test('las noches con «Enfermo» quedan fuera de la referencia de VFC y FC en reposo', () => {
  const dia = n => `2026-06-${String(n).padStart(2, '0')}`;
  const readinessDiario = Array.from({ length: 20 }, (_, i) => ({ fecha: dia(i + 1), vfc: 60, fcReposo: 52,
    ...(i >= 17 ? { enfermo: true, vfc: 40, fcReposo: 60 } : {}) }));
  const d = normalizar({ logs: [], readinessDiario });
  assert.equal(VFC.validas(d.readiness).length, 17);
  assert.equal(FCReposo.validas(d.readiness).length, 17);
  assert.ok(VFC.validas(d.readiness).every(v => v.vfc === 60));
  assert.equal(G.nocheFueraDeReferencia({ enfermo: true }), true);
  assert.equal(G.nocheFueraDeReferencia({ vfcDescartada: true }), true);
  assert.equal(G.nocheFueraDeReferencia({}), false);
});
