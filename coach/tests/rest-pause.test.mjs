// Rest-pause en el planificador y el Excel del Coach (portado de
// App-PRO/web-truelift/coach/tests/rest-pause.test.mjs) y bloque de
// biblioteca con la columna AD (ejercicio por tiempo).
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
  const codigo = fs.readFileSync(new URL('planner.js', appDir), 'utf8');
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

const filaBase = (extra = {}) => ({
  patron: 'Empuje horizontal', ejercicio: 'Press banca', series: 3,
  repsMin: 20, repsMax: 25, rir: 2, descanso: 2, ...extra,
});

test('la fila vacía trae rest-pause apagado y 20 s de pausa', () => {
  const planner = cargarPlanner();
  const f = planner.filaVacia();
  assert.equal(f.restPause, false);
  assert.equal(f.pausaRpSeg, 20);
});

test('_sanearModalidades: el rest-pause cede ante T+B y drop set', () => {
  const planner = cargarPlanner();
  const filas = planner._sanearModalidades([
    { topBack: true, restPause: true },
    { dropSet: true, restPause: true },
    { restPause: true },
  ]);
  assert.equal(filas[0].restPause, false);
  assert.equal(filas[1].restPause, false);
  assert.equal(filas[2].restPause, true);
});

test('_sanearModalidades suelta la superserie si hay rest-pause a algún lado', () => {
  const planner = cargarPlanner();
  const filas = planner._sanearModalidades([
    { restPause: true, superConAnterior: false },
    { superConAnterior: true },               // choca con la 1.ª
    { superConAnterior: false },
    { restPause: true, superConAnterior: true }, // choca consigo misma
  ]);
  assert.equal(filas[1].superConAnterior, false);
  assert.equal(filas[3].superConAnterior, false);
});

test('analiza avisa de rest-pause de 1 serie, de la exclusión y de la superserie', () => {
  const planner = cargarPlanner();
  const rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [
      filaBase({ series: 1, restPause: true }),
      filaBase({ topBack: true, restPause: true }),
      filaBase({ restPause: true }),
      filaBase({ superConAnterior: true }),
    ] },
    { nombre: 'Día 2', filas: [filaBase()] },
  ] };
  const an = planner.analiza(rutina, null);
  assert.ok(an.avisos.some(a => a.nivel === 'ambar' && /rest-pause necesita al menos 2/.test(a.txt)));
  assert.ok(an.avisos.some(a => a.nivel === 'rojo' && /rest-pause no se combina/.test(a.txt)));
  assert.ok(an.avisos.some(a => a.nivel === 'rojo' && /superserie va a series rectas/.test(a.txt)));
});

test('la duración estimada de un rest-pause solo cuenta la pausa corta', () => {
  const planner = cargarPlanner();
  const dur = f => planner.analiza({ sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [f] },
    { nombre: 'Día 2', filas: [filaBase()] },
  ] }, null).porDia[0].durMin;
  assert.ok(dur(filaBase({ restPause: true, pausaRpSeg: 20 })) < dur(filaBase()));
  assert.ok(dur(filaBase({ restPause: true, pausaRpSeg: 20 })) <
            dur(filaBase({ restPause: true, pausaRpSeg: 50 })));
});

test('el Excel escribe N/O y no los escribe si manda T+B', () => {
  const xlsx = cargarXlsx();
  const xml = xlsx._sheetDataDia('Día 1', [
    filaBase({ restPause: true, pausaRpSeg: 30 }),
    filaBase({ topBack: true, backoffPct: 15, rirBack: 1, restPause: true }),
  ], 'doble');
  assert.match(xml, /Rest-pause \(sí\/no\)/);
  assert.match(xml, /Pausa RP \(s\)/);
  assert.match(xml, /r="N4"/);
  assert.match(xml, /r="O4"[^>]*>[\s\S]*?<x:v>30<\/x:v>/);
  assert.doesNotMatch(xml, /r="N5"/);
});

test('desdePlanMod conserva el rest-pause del JSON de la app', () => {
  const xlsx = cargarXlsx();
  const r = xlsx.desdePlanMod([
    { dia: 'Torso', orden: 1, ejercicio: 'A', patron: 'Empuje horizontal',
      series: 3, reps: '20-25', rir: '0', restPause: true, pausaRpSeg: 40 },
    { dia: 'Torso', orden: 2, ejercicio: 'B', patron: 'Empuje horizontal',
      series: 3, reps: '8-12', rir: '2' },
  ], 'doble');
  const filas = r.dias[0].filas;
  assert.equal(filas[0].restPause, true);
  assert.equal(filas[0].pausaRpSeg, 40);
  assert.equal(filas[1].restPause, false);
  assert.equal(filas[1].pausaRpSeg, 20);
});

test('la biblioteca del Excel escribe y lee AD solo para ejercicios por tiempo', () => {
  const xlsx = cargarXlsx();
  const hoja = '<x:worksheet><x:dimension ref="A1"/><x:sheetData><x:row r="1"><x:c r="A1"/></x:row></x:sheetData></x:worksheet>';
  const xml = xlsx._reemplazarBiblioteca(hoja, [
    { nombre: 'Plancha con peso', grupo: 'Core', patron: 'Core', secundarios: [], porTiempo: true },
    { nombre: 'Curl raro', grupo: 'Bíceps', patron: 'Aislamiento', secundarios: ['Antebrazo'] },
  ]);
  assert.match(xml, /r="AD102"[^>]*><x:is><x:t xml:space="preserve">1</);
  assert.doesNotMatch(xml, /r="AD103"/);
  assert.match(xml, /ref="A1:AD103"/);
  // Lectura: el mismo mapa de celdas que produce _celdas().
  const celdas = new Map();
  for (const m of xml.matchAll(/<x:c r="([A-Z]+\d+)"[^>]*><x:is><x:t[^>]*>([^<]*)</g)) celdas.set(m[1], m[2].replaceAll('&quot;', '"'));
  const bib = xlsx._leerBiblioteca(celdas);
  assert.equal(bib.length, 2);
  assert.equal(bib[0].porTiempo, true);
  assert.equal('porTiempo' in bib[1], false);
  assert.deepEqual([...bib[1].secundarios], ['Antebrazo']);
});

test('prepararExportacion no muta la rutina y conserva secundarios y tiempo de los ejercicios propios', () => {
  const planner = cargarPlanner({ clientes: [], ejerciciosCoach: [
    { nombre: 'Curl raro', patron: 'Aislamiento', grupo: 'Bíceps', grupo2: 'Antebrazo', grupo3: null },
  ] });
  const rutina = { sistema: 'doble', dias: [
    { nombre: 'Día 1', filas: [filaBase({ restPause: true, topBack: true }), { patron: '', ejercicio: '' },
      filaBase({ patron: 'Aislamiento', ejercicio: 'Curl raro', superConAnterior: true })] },
    { nombre: 'Día 2', filas: [filaBase({ patron: 'Aislamiento', ejercicio: 'Plancha con peso' })] },
  ] };
  const antes = JSON.stringify(rutina);
  const { rutina: r, dias } = planner.prepararExportacion(rutina, {
    ejerciciosUsuario: [{ nombre: 'Plancha con peso', patron: 'Aislamiento', grupo: 'Core', porTiempo: true }] });
  assert.equal(JSON.stringify(rutina), antes);
  assert.equal(dias, 2);
  assert.equal(r.dias[0].filas.length, 2);
  assert.equal(r.dias[0].filas[0].restPause, false);       // manda T+B
  assert.equal(r.dias[0].filas[1].superConAnterior, false); // vecina con modalidad
  const curl = r.biblioteca.find(e => e.nombre === 'Curl raro');
  assert.deepEqual([...curl.secundarios], ['Antebrazo']);
  const plancha = r.biblioteca.find(e => e.nombre === 'Plancha con peso');
  assert.equal(plancha.porTiempo, true);
});

test('planner.js se puede cargar sin la tabla de vistas del Coach', () => {
  const planner = cargarPlanner(undefined, { Vistas: undefined });
  assert.equal(typeof planner._sanearModalidades, 'function');
});
