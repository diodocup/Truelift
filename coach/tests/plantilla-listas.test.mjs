// La plantilla embebida se completa al exportar: instrucciones de las
// modalidades nuevas y desplegables con todo el catálogo.
//
// La plantilla (plantilla.js) es un archivo fijo con las listas y las
// instrucciones del día que se creó: no explicaba las columnas K (superserie)
// y L/M (drop set) ni conoce los ejercicios que el catálogo y el entrenador
// han ido sumando. Estas pruebas van contra la plantilla REAL embebida.
// Ejecutar con: node --test tests/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = fs.existsSync(new URL('../xlsx.js', import.meta.url))
  ? new URL('../', import.meta.url)
  : new URL('./', import.meta.url);

/** XLSX + la plantilla embebida, en el mismo contexto. */
function cargar() {
  const sandbox = { console, atob: globalThis.atob, TextEncoder, TextDecoder };
  vm.createContext(sandbox);
  for (const archivo of ['plantilla.js', 'xlsx.js']) {
    vm.runInContext(fs.readFileSync(new URL(archivo, appDir), 'utf8'), sandbox);
  }
  vm.runInContext(
    ';globalThis.__XLSX = XLSX; globalThis.__PLANTILLA = PLANTILLA_XLSX;',
    sandbox);
  const XLSX = sandbox.__XLSX;
  const dec = new TextDecoder('utf-8');
  const xml = (ruta) => dec.decode(XLSX._b64aBytes(sandbox.__PLANTILLA[ruta]));
  return { XLSX, xml };
}

/** Catálogo del Coach (patrón → ejercicios), leído de catalogo.js. */
function catalogo() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('catalogo.js', appDir), 'utf8')}
     ;globalThis.__LISTAS = CAT_LISTAS;`,
    sandbox);
  return sandbox.__LISTAS;
}

/** Textos de una columna entre dos filas (ambas incluidas). */
function valores(XLSX, xmlHoja, col, desde, hasta) {
  const celdas = XLSX._celdasConTexto(xmlHoja);
  const out = [];
  for (let f = desde; f <= hasta; f++) out.push(celdas[col + f]?.texto ?? '');
  return out;
}

test('la plantilla embebida solo documentaba el top+back', () => {
  const { xml } = cargar();
  const ins = xml('xl/worksheets/sheet1.xml');
  assert.match(ins, /8\) TOP\+BACK/);
  assert.equal(/columna K/.test(ins), false);
  assert.equal(/DROP SET/.test(ins), false);
});

test('al exportar se añade la explicación de superserie y drop set', () => {
  const { XLSX, xml } = cargar();
  const completada = XLSX._completarInstrucciones(xml('xl/worksheets/sheet1.xml'));
  for (const linea of XLSX.INSTRUCCIONES_MODALIDADES) {
    // El XML lleva el texto escapado (las comillas de «"sí"» incluidas).
    assert.ok(completada.includes(XLSX._escXml(linea)), `falta: ${linea}`);
  }
  // Debajo de las que ya traía la plantilla y sin duplicarse al repetir.
  assert.match(completada, /8\) TOP\+BACK/);
  assert.match(completada, /r="A20"/);
  assert.equal(XLSX._completarInstrucciones(completada), completada);
});

test('la columna L (drop set) estrena su desplegable sí/no', () => {
  const { XLSX, xml } = cargar();
  const dia = xml('xl/worksheets/sheet2.xml');
  // La plantilla embebida solo trae el desplegable de H (top+back).
  assert.equal(dia.includes('"L4:L13"'), false);
  const completada = XLSX._completarValidacionDrop(dia);
  assert.match(completada, /sqref="L4:L13"/);
  assert.match(completada, /<x:dataValidations count="11"/);
  assert.equal(XLSX._completarValidacionDrop(completada), completada);
});

test('la plantilla embebida se había quedado corta de ejercicios', () => {
  const { XLSX, xml } = cargar();
  const rangos = XLSX._rangosConNombre(xml('xl/workbook.xml'));
  const core = rangos['Core'];
  const lista = valores(XLSX, xml('xl/worksheets/sheet7.xml'),
    core.col, core.desde, core.hasta);
  // «Hollow hold» está en el catálogo del Coach pero no en la plantilla.
  assert.equal(lista.includes('Hollow hold'), false);
  assert.ok(catalogo()['Core'].includes('Hollow hold'));
});

test('el catálogo entero entra en los desplegables del Excel exportado', () => {
  const { XLSX, xml } = cargar();
  const listasPorPatron = catalogo();
  const rutina = {
    sistema: 'doble',
    listasPorPatron,
    dias: [{ nombre: 'Día 1', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Hollow hold' },
    ] }],
    // Personalizado del entrenador: tampoco lo conoce la plantilla.
    biblioteca: [{ nombre: 'Press casero del coach', grupo: 'Pectoral',
                   patron: 'Empuje horizontal' }],
  };
  const completadas = XLSX._completarListas(
    xml('xl/worksheets/sheet7.xml'), xml('xl/workbook.xml'),
    XLSX._ejerciciosPorPatron(rutina));
  assert.ok(completadas.anadidos > 0);

  const rangos = XLSX._rangosConNombre(completadas.workbook);
  const fallos = [];
  for (const [patron, ejercicios] of Object.entries(listasPorPatron)) {
    const r = rangos[patron.replaceAll(' ', '_')];
    if (!r) { fallos.push(`${patron}: sin rango`); continue; }
    const lista = valores(XLSX, completadas.listas, r.col, r.desde, r.hasta);
    for (const e of ejercicios) {
      if (!lista.includes(e)) fallos.push(`${patron}: ${e}`);
    }
    if (lista.includes('')) fallos.push(`${patron}: hueco en el rango`);
    if (new Set(lista).size !== lista.length) fallos.push(`${patron}: repetido`);
  }
  assert.deepEqual(fallos, []);

  // El personalizado del entrenador también se puede elegir.
  const eh = rangos['Empuje_horizontal'];
  assert.ok(valores(XLSX, completadas.listas, eh.col, eh.desde, eh.hasta)
    .includes('Press casero del coach'));
});

test('es aditivo: conserva la curación de la plantilla y no repite', () => {
  const { XLSX, xml } = cargar();
  const listas0 = xml('xl/worksheets/sheet7.xml');
  const wb0 = xml('xl/workbook.xml');
  const antes = XLSX._rangosConNombre(wb0)['Punto_débil_opcional'];
  const listaAntes = valores(XLSX, listas0, antes.col, antes.desde, antes.hasta);

  const porPatron = XLSX._ejerciciosPorPatron({ listasPorPatron: catalogo() });
  const una = XLSX._completarListas(listas0, wb0, porPatron);
  const despues = XLSX._rangosConNombre(una.workbook)['Punto_débil_opcional'];
  const listaDespues = valores(XLSX, una.listas,
    despues.col, despues.desde, despues.hasta);
  // «Punto débil opcional» ofrece a propósito aislamientos de otro patrón:
  // siguen ahí, en el mismo orden y los primeros.
  assert.deepEqual(listaDespues.slice(0, listaAntes.length), listaAntes);

  // Y pasarlo dos veces no cambia nada.
  const dos = XLSX._completarListas(una.listas, una.workbook, porPatron);
  assert.equal(dos.anadidos, 0);
  assert.equal(dos.listas, una.listas);
  assert.equal(dos.workbook, una.workbook);
});
