import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = fs.existsSync(new URL('../planner.js', import.meta.url))
  ? new URL('../', import.meta.url)
  : new URL('./', import.meta.url);

function cargarPlanner(store = { clientes: [], ejerciciosCoach: [] }) {
  const sandbox = {
    console,
    State: { store },
    Store: { guardar: () => true },
    Vistas: {},
    CAT_GRUPO_DE: { 'Press banca': 'Pectoral' },
    CAT_LISTAS: { 'Empuje horizontal': ['Press banca'], Aislamiento: [] },
    CAT_PATRON_GRUPO: { 'Empuje horizontal': 'Pectoral', Aislamiento: 'Otros' },
    CAT_PATRONES: ['Empuje horizontal', 'Aislamiento'],
    OBJETIVOS_GRUPO: {}, ORDEN_GRUPOS: [],
    clienteActivo: () => null, datosActivos: () => null,
    render: () => {}, abrirModal: () => {}, cerrarModal: () => {}, esc: String,
    $: () => null, XLSX: { MAX_DIAS: 5, MAX_FILAS: 10 },
    V: {},
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

test('el JSON añade ejercicios nuevos a la biblioteca sin duplicados', () => {
  const store = { clientes: [], ejerciciosCoach: [] };
  const planner = cargarPlanner(store);
  const raw = {
    ejerciciosUsuario: [{
      nombre: 'Press unilateral en landmine', patron: 'Empuje horizontal',
      grupo: 'Pectoral', secundarios: ['Hombro'], prioridad: 'Añadido por ti',
    }],
    planMod: [
      { ejercicio: 'Press banca', patron: 'Empuje horizontal', grupo: 'Pectoral' },
      { ejercicio: 'Press unilateral en landmine', patron: 'Empuje horizontal', grupo: 'Pectoral' },
    ],
    logs: [{ entradas: [{ ejercicio: 'Press unilateral en landmine' }] }],
  };
  assert.equal(planner.nuevosDesdeJson(raw).length, 1);
  planner.sincronizarDesdeJson(raw);
  planner.sincronizarDesdeJson(raw);
  assert.equal(store.ejerciciosCoach.length, 1);
  assert.equal(store.ejerciciosCoach[0].grupo2, 'Hombro');
});

test('el Excel incluye solo personalizados del cliente o usados en la rutina', () => {
  const store = { clientes: [], ejerciciosCoach: [
    { nombre: 'Ejercicio cliente A', patron: 'Aislamiento', grupo: 'Bíceps' },
    { nombre: 'Ejercicio usado', patron: 'Aislamiento', grupo: 'Tríceps' },
    { nombre: 'Ejercicio de otro cliente', patron: 'Aislamiento', grupo: 'Gemelo' },
  ] };
  const planner = cargarPlanner(store);
  const rutina = { dias: [{ filas: [
    { ejercicio: 'Press banca', patron: 'Empuje horizontal' },
    { ejercicio: 'Ejercicio usado', patron: 'Aislamiento' },
  ] }] };
  const raw = { ejerciciosUsuario: [{
    nombre: 'Ejercicio cliente A', patron: 'Aislamiento', grupo: 'Bíceps',
  }] };
  assert.deepEqual(
    Array.from(planner.bibliotecaParaExcel(rutina, raw), e => e.nombre).sort(),
    ['Ejercicio cliente A', 'Ejercicio usado']);
});

test('Listas conserva una sola marca y elimina el catálogo heredado', () => {
  const xlsx = cargarXlsx();
  const xml = '<x:worksheet><x:dimension ref="A1:AC271"/><x:sheetData>'
    + '<x:row r="1"><x:c r="A1"/></x:row>'
    + '<x:row r="101"><x:c r="W101"/></x:row>'
    + '<x:row r="102"><x:c r="W102"/></x:row>'
    + '<x:row r="271"><x:c r="W271"/></x:row>'
    + '</x:sheetData></x:worksheet>';
  const out = xlsx._reemplazarBiblioteca(xml, [{
    nombre: 'Nuevo ejercicio', grupo: 'Tríceps', patron: 'Aislamiento',
    secundarios: [], prioridad: 'Añadido por ti', nota: '', descanso: '',
  }]);
  assert.equal((out.match(/TRUELIFT_EXERCISES_V1/g) || []).length, 1);
  assert.match(out, /r="102"/);
  assert.match(out, /Nuevo ejercicio/);
  assert.doesNotMatch(out, /r="271"/);
  assert.match(out, /ref="A1:AC102"/);
});

test('sin personalizados conserva la marca y no inventa W102', () => {
  const xlsx = cargarXlsx();
  const xml = '<x:worksheet><x:sheetData><x:row r="1"/></x:sheetData></x:worksheet>';
  const out = xlsx._reemplazarBiblioteca(xml, []);
  assert.match(out, /TRUELIFT_EXERCISES_V1/);
  assert.doesNotMatch(out, /W102/);
});

test('el planificador reordena ejercicios dentro del mismo día', () => {
  const planner = cargarPlanner();
  planner.rutina = { sistema: 'doble', dias: [{ nombre: 'Día 1', filas: [
    { ejercicio: 'A' }, { ejercicio: 'B' }, { ejercicio: 'C' },
  ] }] };
  assert.equal(planner._reordenarEnDia(0, 0, 2), true);
  assert.deepEqual(Array.from(planner.rutina.dias[0].filas, f => f.ejercicio), ['B', 'C', 'A']);
  assert.equal(planner._reordenarEnDia(0, 2, 2), false);
});

test('el planificador usa arrastre y los nuevos nombres de importación y exportación', () => {
  const codigo = fs.readFileSync(new URL('planner.js', appDir), 'utf8');
  assert.match(codigo, /class="pln-drag"/);
  assert.match(codigo, /addEventListener\('pointerdown'/);
  assert.match(codigo, /addEventListener\('pointermove'/);
  assert.doesNotMatch(codigo, /class="btn-mini pln-mover"/);
  assert.match(codigo, />Importar rutina<\/button>/);
  assert.match(codigo, />Exportar rutina para App smartphone TrueLift<\/button>/);
});
