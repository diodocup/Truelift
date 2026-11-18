// Superseries y drop sets en el planificador y el Excel del Coach.
// Ejecutar con: node --test tests/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = fs.existsSync(new URL('../planner.js', import.meta.url))
  ? new URL('../', import.meta.url)
  : new URL('./', import.meta.url);

function cargarPlanner(store = { clientes: [], ejerciciosCoach: [] }, extras = {}) {
  const sandbox = {
    console,
    State: { store },
    Store: { guardar: () => true },
    Vistas: {},
    CAT_GRUPO_DE: { 'Press banca': 'Pectoral' },
    CAT_LISTAS: { 'Empuje horizontal': ['Press banca'], Aislamiento: [] },
    CAT_PATRON_GRUPO: { 'Empuje horizontal': 'Pectoral', Aislamiento: 'Otros' },
    CAT_PATRONES: ['Empuje horizontal', 'Aislamiento'],
    patronVigente: p => p,
    OBJETIVOS_GRUPO: {}, ORDEN_GRUPOS: [],
    clienteActivo: () => null, datosActivos: () => null,
    render: () => {}, abrirModal: () => {}, cerrarModal: () => {}, esc: String,
    $: () => null, XLSX: { MAX_DIAS: 5, MAX_FILAS: 10 },
    V: {},
    ...extras,
  };
  vm.createContext(sandbox);
  const codigo = fs.readFileSync(new URL('motor.js', appDir), 'utf8') + '\n;' + fs.readFileSync(new URL('planner.js', appDir), 'utf8');
  vm.runInContext(`${codigo}\n;globalThis.__Planner = Planner;`, sandbox);
  return sandbox.__Planner;
}

function cargarXlsx() {
  const sandbox = { console, atob: globalThis.atob, TextEncoder, TextDecoder };
  vm.createContext(sandbox);
  const codigo = fs.readFileSync(new URL('xlsx.js', appDir), 'utf8');
  vm.runInContext(`${codigo}\n;globalThis.__XLSX = XLSX;`, sandbox);
  return sandbox.__XLSX;
}

test('la fila vacía trae las claves nuevas con sus valores por defecto', () => {
  const planner = cargarPlanner();
  const f = planner.filaVacia();
  assert.equal(f.dropSet, false);
  assert.equal(f.dropPct, 15);
  assert.equal(f.superConAnterior, false);
});

test('los enlaces antiguos son cadenas contiguas y se numeran por día', () => {
  const planner = cargarPlanner();
  const filas = [
    { superConAnterior: false },
    { superConAnterior: true },  // 2.ª con 1.ª → grupo 1
    { superConAnterior: false },
    { superConAnterior: true },  // 4.ª con 3.ª → grupo 2
    { superConAnterior: false },
  ];
  assert.deepEqual(planner._gruposSuperserie(filas), [1, 1, 2, 2, 0]);
  // El enlace de la primera fila del día se ignora.
  assert.deepEqual(planner._gruposSuperserie([{ superConAnterior: true }]), [0]);
});

test('analiza avisa de drop sets de 1 serie y de la exclusión con T+B', () => {
  const planner = cargarPlanner();
  const rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 1,
        repsMin: 8, repsMax: 12, rir: 2, descanso: 2, dropSet: true },
      { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
        repsMin: 8, repsMax: 12, rir: 2, descanso: 2,
        topBack: true, dropSet: true },
    ] },
    { nombre: 'Día 2', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
        repsMin: 8, repsMax: 12, rir: 2, descanso: 2 },
    ] },
  ] };
  const an = planner.analiza(rutina, null);
  assert.ok(an.avisos.some(a => a.nivel === 'ambar' && /drop set necesita al menos 2/.test(a.txt)));
  assert.ok(an.avisos.some(a => a.nivel === 'rojo' && /excluyentes/.test(a.txt)));
});

test('el Excel escribe K/L/M y la lectura reconstruye los enlaces', () => {
  const xlsx = cargarXlsx();
  const filas = [
    { patron: 'Empuje horizontal', ejercicio: 'A', series: 3, rir: 2,
      repsMin: 8, repsMax: 12, descanso: 2, superConAnterior: false },
    { patron: 'Empuje horizontal', ejercicio: 'B', series: 3, rir: 2,
      repsMin: 8, repsMax: 12, descanso: 2, superConAnterior: true },
    { patron: 'Empuje horizontal', ejercicio: 'C', series: 3, rir: 2,
      repsMin: 8, repsMax: 12, descanso: 2, dropSet: true, dropPct: 20 },
  ];
  const xml = xlsx._sheetDataDia('Día 1', filas, 'doble');
  // Cabeceras nuevas presentes.
  assert.match(xml, /Superserie \(nº\)/);
  assert.match(xml, /Drop set \(sí\/no\)/);
  assert.match(xml, /% drop/);
  // K4 y K5 llevan el número 1 (grupo A+B); C no lleva K pero sí L/M.
  assert.match(xml, /r="K4"[^>]*>[\s\S]*?<x:v>1<\/x:v>/);
  assert.match(xml, /r="K5"[^>]*>[\s\S]*?<x:v>1<\/x:v>/);
  assert.doesNotMatch(xml, /r="K6"/);
  assert.match(xml, /r="L6"/);
  assert.match(xml, /r="M6"[^>]*>[\s\S]*?<x:v>20<\/x:v>/);
});

test('un drop set exporta un único objetivo de reps (E, sin F), también en doble', () => {
  const xlsx = cargarXlsx();
  const filas = [
    { patron: 'Empuje horizontal', ejercicio: 'A', series: 3, rir: 2,
      repsMin: 12, repsMax: null, descanso: 2, dropSet: true, dropPct: 20 },
    { patron: 'Empuje horizontal', ejercicio: 'B', series: 3, rir: 2,
      repsMin: 8, repsMax: 12, descanso: 2 },
  ];
  const xml = xlsx._sheetDataDia('Día 1', filas, 'doble');
  assert.match(xml, /r="E4"[^>]*>[\s\S]*?<x:v>12<\/x:v>/);
  assert.doesNotMatch(xml, /r="F4"/);
  assert.match(xml, /r="F5"/);
});

test('drop set: un número de reps, no un rango (activar, quitar, sanear y avisos)', () => {
  const planner = cargarPlanner();
  // Sanear (Excel o borrador antiguo): en doble se queda el extremo alto.
  const filas = [
    { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
      repsMin: 8, repsMax: 12, rir: 2, descanso: 2, dropSet: true },
  ];
  planner._sanearModalidades(filas, 'doble');
  assert.equal(filas[0].repsMin, 12);
  assert.equal(filas[0].repsMax, null);
  // En simple manda el número objetivo (reps mín).
  const simple = [{ repsMin: 8, repsMax: 12, dropSet: true }];
  planner._sanearModalidades(simple, 'simple');
  assert.equal(simple[0].repsMin, 8);
  assert.equal(simple[0].repsMax, null);
  // Quitarlo en doble devuelve un rango que acaba en la cifra.
  planner._quitarDrop(filas[0], 'doble');
  assert.equal(filas[0].dropSet, false);
  assert.equal(filas[0].repsMin, 8);
  assert.equal(filas[0].repsMax, 12);
  // En doble, un drop set sin reps máx no es un aviso.
  const rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
        repsMin: 12, repsMax: null, rir: 2, descanso: 2, dropSet: true },
    ] },
    { nombre: 'Día 2', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
        repsMin: 8, repsMax: 12, rir: 2, descanso: 2 },
    ] },
  ] };
  const an = planner.analiza(rutina, null);
  assert.ok(!an.avisos.some(a => /faltan las reps máx/.test(a.txt)));
});

test('un drop set marcado a la vez que T+B no escribe L/M (manda T+B)', () => {
  const xlsx = cargarXlsx();
  const filas = [
    { patron: 'Empuje horizontal', ejercicio: 'A', series: 3, rir: 2,
      repsMin: 8, repsMax: 12, descanso: 2,
      topBack: true, backoffPct: 15, rirBack: 1, dropSet: true, dropPct: 20 },
  ];
  const xml = xlsx._sheetDataDia('Día 1', filas, 'doble');
  assert.match(xml, /r="H4"/);
  assert.doesNotMatch(xml, /r="L4"/);
});

test('desdePlanMod conserva las claves nuevas del JSON de la app', () => {
  const xlsx = cargarXlsx();
  const r = xlsx.desdePlanMod([
    { dia: 'Torso', orden: 1, ejercicio: 'A', patron: 'Empuje horizontal',
      series: 3, reps: '8-12', rir: '2' },
    { dia: 'Torso', orden: 2, ejercicio: 'B', patron: 'Empuje horizontal',
      series: 3, reps: '8-12', rir: '2', superConAnterior: true },
    { dia: 'Torso', orden: 3, ejercicio: 'C', patron: 'Empuje horizontal',
      series: 3, reps: '8-12', rir: '2', dropSet: true, dropPct: 25 },
  ], 'doble');
  const filas = r.dias[0].filas;
  assert.equal(filas[0].superConAnterior, false);
  assert.equal(filas[1].superConAnterior, true);
  assert.equal(filas[2].dropSet, true);
  assert.equal(filas[2].dropPct, 25);
});

test('la duración estimada de un drop set solo cuenta un descanso', () => {
  const planner = cargarPlanner();
  const fila = (extra = {}) => ({
    patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 4,
    repsMin: 8, repsMax: 12, rir: 2, descanso: 3, ...extra,
  });
  const dur = f => planner.analiza({ sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [f] },
    { nombre: 'Día 2', filas: [fila()] },
  ] }, null).porDia[0].durMin;
  assert.ok(dur(fila({ dropSet: true })) < dur(fila()));
});

/* ---- Exclusión de las tres modalidades (superserie ↔ T+B / drop set) ----
   Una fila tiene UNA modalidad de carga por serie y una superserie solo
   enlaza filas a series rectas. Manda la modalidad de la fila y se suelta el
   enlace, igual que en la app. */

test('_sanearModalidades: el drop set sale de sus series alternas y T+B se queda', () => {
  const planner = cargarPlanner();
  // Enlaces antiguos: las cuatro filas forman una cadena (un grupo).
  const filas = [
    { topBack: true, dropSet: false, superConAnterior: false },
    { topBack: false, dropSet: false, superConAnterior: true },  // T+B sí cabe
    { topBack: false, dropSet: true, superConAnterior: true },   // drop set: sale
    { topBack: false, dropSet: false, superConAnterior: true },  // sigue en el grupo
  ];
  planner._sanearModalidades(filas);
  assert.deepEqual(planner._gruposSuperserie(filas), [1, 1, 0, 1]);
  assert.deepEqual(filas.map(f => f.superConAnterior), [false, true, false, false]);
  // Las modalidades de la fila se conservan: solo sale del grupo la que no cabe.
  assert.equal(filas[0].topBack, true);
  assert.equal(filas[2].dropSet, true);
});

test('_sanearModalidades respeta una superserie de series rectas', () => {
  const planner = cargarPlanner();
  const filas = [
    { topBack: false, dropSet: false, superConAnterior: false },
    { topBack: false, dropSet: false, superConAnterior: true },
    { topBack: false, dropSet: false, superConAnterior: true },
  ];
  planner._sanearModalidades(filas);
  assert.deepEqual(planner._gruposSuperserie(filas), [1, 1, 1]);
  // Y T+B con drop set en la misma fila deja solo T+B.
  const una = [{ topBack: true, dropSet: true, superConAnterior: false }];
  planner._sanearModalidades(una);
  assert.deepEqual([una[0].topBack, una[0].dropSet], [true, false]);
});

test('reordenar dentro del día rehace la exclusión', () => {
  const planner = cargarPlanner();
  planner.rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [
      { ejercicio: 'A', superConAnterior: false, topBack: false, dropSet: false },
      { ejercicio: 'B', superConAnterior: true, topBack: false, dropSet: false },
      { ejercicio: 'C', superConAnterior: false, topBack: true, dropSet: false },
    ] },
  ] };
  // C (top+back) se cuela entre A y B: A y B siguen alternando aunque ya
  // no vayan seguidas (el grupo se hace donde está A).
  assert.equal(planner._reordenarEnDia(0, 2, 1), true);
  const filas = planner.rutina.dias[0].filas;
  assert.deepEqual(filas.map(f => f.ejercicio), ['A', 'C', 'B']);
  assert.equal(filas[2].superConAnterior, false);
  assert.deepEqual(planner._gruposSuperserie(filas), [1, 0, 1]);
});

test('analiza avisa en rojo de unas series alternas con drop set, no con T+B', () => {
  const planner = cargarPlanner();
  const fila = (extra = {}) => ({
    patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
    repsMin: 8, repsMax: 12, rir: 2, descanso: 2, ...extra,
  });
  const rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [fila({ topBack: true }), fila({ superConAnterior: true })] },
    { nombre: 'Día 2', filas: [fila({ grupoAlterno: 1, dropSet: true }), fila(), fila({ grupoAlterno: 1 })] },
  ] };
  const an = planner.analiza(rutina, null);
  const rojos = an.avisos.filter(a => a.nivel === 'rojo' && /series alternas/.test(a.txt));
  assert.equal(rojos.length, 1);
  assert.match(rojos[0].txt, /^Día 2/);
});

test('exportar rompe el enlace que quede sobre una fila con carga por serie', async () => {
  let exportada = null;
  const planner = cargarPlanner(undefined, {
    XLSX: { MAX_DIAS: 5, MAX_FILAS: 10, descargar: async r => { exportada = r; } },
  });
  const fila = (ejercicio, extra = {}) => ({
    patron: 'Empuje horizontal', ejercicio, series: 3, rir: 2,
    repsMin: 8, repsMax: 12, descanso: 2,
    topBack: false, backoffPct: 15, rirBack: 2,
    dropSet: false, dropPct: 15, superConAnterior: false, ...extra,
  });
  planner.rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [
      fila('Press banca', { dropSet: true }),
      fila('', {}),                                  // incompleta: se cae
      fila('Press banca', { superConAnterior: true }),
    ] },
    { nombre: 'Día 2', filas: [fila('Press banca')] },
  ] };
  await planner.exportar();
  assert.ok(exportada, 'la exportación no llegó a XLSX.descargar');
  const filas = exportada.dias[0].filas;
  assert.equal(filas.length, 2);
  // Al caerse la fila de en medio, la última queda pegada al drop set: el
  // enlace se rompe en vez de viajar al Excel.
  assert.equal(filas[1].superConAnterior, false);
});

test('series alternas: grupos no consecutivos por número, también en el Excel', () => {
  const planner = cargarPlanner();
  const filas = [{ grupoAlterno: 3 }, { grupoAlterno: 0 }, { grupoAlterno: 3 }, { grupoAlterno: 7 }];
  // Se cuentan por la posición del primero; un número con una fila no vale.
  assert.deepEqual(planner._gruposSuperserie(filas), [1, 0, 1, 0]);
  // «Alternar con» cualquier fila del día, y quitarla.
  const dia = [{ ejercicio: 'A' }, { ejercicio: 'B', dropSet: true }, { ejercicio: 'C' }];
  planner.aplicarCampo(dia, 2, 'alternarCon', '0', 'doble');
  assert.deepEqual(planner._gruposSuperserie(dia), [1, 0, 1]);
  planner.aplicarCampo(dia, 1, 'alternarCon', '2', 'doble');
  assert.equal(dia[1].dropSet, false, 'alternar quita el drop set');
  assert.deepEqual(planner._gruposSuperserie(dia), [1, 1, 1]);
  planner.aplicarCampo(dia, 0, 'alternarCon', '', 'doble');
  assert.deepEqual(planner._gruposSuperserie(dia), [0, 1, 1]);
  const xlsx = cargarXlsx();
  const xml = xlsx._sheetDataDia('Día 1', [
    { patron: 'P', ejercicio: 'A', series: 3, grupoAlterno: 4 },
    { patron: 'P', ejercicio: 'B', series: 3, grupoAlterno: 0 },
    { patron: 'P', ejercicio: 'C', series: 3, grupoAlterno: 4 },
  ], 'doble');
  assert.match(xml, /r="K4"[^>]*>[\s\S]*?<x:v>1<\/x:v>/);
  assert.doesNotMatch(xml, /r="K5"/);
  assert.match(xml, /r="K6"[^>]*>[\s\S]*?<x:v>1<\/x:v>/);
});
