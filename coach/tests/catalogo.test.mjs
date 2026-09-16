// El catálogo del Coach es una COPIA de la biblioteca de ejercicios de la app
// (la genera tool/coach_generar_catalogo.py del repo de TrueLift). Se quedó
// una vez con 194 ejercicios mientras la app ya servía 364, y el Planificador
// trató los que faltaban como ejercicios inventados por el entrenador: grupo
// muscular adivinado a partir del patrón, sin ficha y marcados como «añadido
// por ti» en el Excel que se exporta al cliente.
//
// Estas pruebas no pueden comprobar que la copia esté al día (el repo de la
// app no está aquí), pero sí que sea coherente consigo misma y con los
// dibujos que la acompañan, que es lo que se rompe al regenerarla a medias.
// Ejecutar con: node --test "tests/*.test.mjs"
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = fs.existsSync(new URL('../catalogo.js', import.meta.url))
  ? new URL('../', import.meta.url)
  : new URL('./', import.meta.url);

function catalogo() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('catalogo.js', appDir), 'utf8')}
     ;globalThis.__CAT = { CAT_FICHA, CAT_LISTAS, CAT_PATRONES, CAT_GRUPO_DE,
                           CAT_DIBUJOS, ORDEN_GRUPOS, OBJETIVOS_GRUPO,
                           imagenEjercicio, fichaEjercicio };`,
    sandbox);
  return sandbox.__CAT;
}

const dibujos = () => fs.readdirSync(new URL('media/ejercicios/', appDir))
  .filter(f => f.endsWith('.webp'))
  .map(f => f.normalize('NFC'));

test('todo ejercicio con ficha se puede elegir en algún patrón', () => {
  const { CAT_FICHA, CAT_LISTAS } = catalogo();
  const elegibles = new Set(Object.values(CAT_LISTAS).flat());
  const sueltos = Object.keys(CAT_FICHA).filter(n => !elegibles.has(n));
  assert.deepEqual(sueltos, [], 'ejercicios con ficha fuera de los desplegables');
});

test('todo ejercicio de un desplegable tiene ficha y grupo', () => {
  const { CAT_FICHA, CAT_LISTAS, CAT_GRUPO_DE, ORDEN_GRUPOS } = catalogo();
  const fallos = [];
  for (const [patron, lista] of Object.entries(CAT_LISTAS)) {
    for (const n of lista) {
      const f = CAT_FICHA[n];
      if (!f) { fallos.push(`${patron}: «${n}» sin ficha`); continue; }
      if (CAT_GRUPO_DE[n] !== f.grupo) fallos.push(`${patron}: «${n}» grupo descuadrado`);
      if (!ORDEN_GRUPOS.includes(f.grupo)) fallos.push(`${patron}: «${n}» grupo desconocido (${f.grupo})`);
    }
  }
  assert.deepEqual(fallos, []);
});

test('el patrón de cada ficha es uno de los del desplegable de PATRÓN', () => {
  // La plantilla usa «Aislamiento Aductores» como subrango de «Aislamiento»:
  // si se colase como patrón, el Planificador ofrecería un patrón fantasma.
  const { CAT_FICHA, CAT_PATRONES } = catalogo();
  const validos = new Set(CAT_PATRONES.filter(p => p !== '(Ninguno)'));
  const malos = Object.entries(CAT_FICHA)
    .filter(([, f]) => !validos.has(f.patron)).map(([n, f]) => `${n} → ${f.patron}`);
  assert.deepEqual(malos, []);
});

test('cada dibujo anunciado en la ficha está en media/ejercicios/', () => {
  const { CAT_FICHA } = catalogo();
  const enDisco = new Set(dibujos());
  const faltan = Object.entries(CAT_FICHA)
    .filter(([, f]) => f.img && !enDisco.has(`${f.img.normalize('NFC')}.webp`))
    .map(([n]) => n);
  assert.deepEqual(faltan, [], 'fichas que prometen un dibujo que no existe');
});

test('no quedan dibujos huérfanos de ejercicios que ya no están', () => {
  const { CAT_FICHA } = catalogo();
  const usados = new Set(Object.values(CAT_FICHA)
    .filter(f => f.img).map(f => `${f.img.normalize('NFC')}.webp`));
  const sobran = dibujos().filter(f => !usados.has(f));
  assert.deepEqual(sobran, []);
});

test('imagenEjercicio codifica la ruta y calla ante lo que no conoce', () => {
  const { imagenEjercicio, fichaEjercicio, CAT_DIBUJOS } = catalogo();
  const ruta = imagenEjercicio('Press banca con barra');
  assert.equal(ruta, `${CAT_DIBUJOS}Press%20banca%20con%20barra.webp`);
  // El nombre lleva una barra, que no vale en un archivo: la app renombra el
  // dibujo y la ficha guarda ese nombre, no el del ejercicio.
  assert.equal(imagenEjercicio('Pec deck / polea cruzada'),
    `${CAT_DIBUJOS}Pec%20deck%20-%20polea%20cruzada.webp`);
  // Un ejercicio del entrenador no tiene dibujo ni ficha, y eso no es un error.
  assert.equal(imagenEjercicio('Press casero del coach'), null);
  assert.equal(fichaEjercicio('Press casero del coach'), null);
});

test('los objetivos de volumen cubren todos los grupos de la biblioteca', () => {
  const { CAT_FICHA, OBJETIVOS_GRUPO } = catalogo();
  const grupos = [...new Set(Object.values(CAT_FICHA).map(f => f.grupo))];
  const huecos = grupos.filter(g => !OBJETIVOS_GRUPO[g]);
  assert.deepEqual(huecos, []);
});
