import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargarVFC() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('data.js', appDir), 'utf8')}
     ;globalThis.__VFC = VFC;`,
    sandbox,
  );
  return sandbox.__VFC;
}

const dia = i => new Date(2026, 0, 1 + i);
const iso = i => `2026-${String(dia(i).getMonth() + 1).padStart(2, '0')}-${String(dia(i).getDate()).padStart(2, '0')}`;
const noche = i => ({ fecha: dia(i), vfc: 70 + (i % 5), vfcDescartada: false });

/* Quien mide todas las noches 40 días y luego pasa a noche sí, noche no:
   la ventana de 7 días le deja 4 noches, no 7. Exigir las 7 cortaba la media
   y el umbral en la última noche seguida, y la gráfica quedaba sin curvas
   desde ahí (la app sí las pinta). */
function historicoConHuecos() {
  const seguidas = Array.from({ length: 40 }, (_, i) => noche(i));
  const salteadas = [];
  for (let i = 40; i < 80; i += 2) salteadas.push(noche(i));
  return [...seguidas, ...salteadas];
}

test('la tendencia de VFC sigue con huecos: no exige medir las 7 noches', () => {
  const VFC = cargarVFC();
  const R = historicoConHuecos();
  const serie = VFC.tendenciaSerie(R);
  const validas = VFC.validas(R);

  // Llega hasta la última noche medida, no hasta la última noche seguida.
  assert.equal(serie.has(validas.at(-1).clave), true);
  assert.equal(serie.has(iso(78)), true);
  assert.equal(serie.has(iso(40)), true);   // primera noche tras el hueco

  // La media de esa noche es la de las noches medidas en su ventana de 7 días
  // (78, 76, 74 y 72), no la de 7 noches inventadas.
  const ventana = [72, 74, 76, 78].map(i => noche(i).vfc);
  assert.equal(serie.get(iso(78)).media7, ventana.reduce((a, b) => a + b, 0) / ventana.length);
});

test('con menos de 3 noches en la ventana no hay tendencia', () => {
  const VFC = cargarVFC();
  // 20 noches seguidas de base y luego una suelta cada 10 días: su ventana
  // de 7 días contiene una sola noche, que no describe ninguna tendencia.
  const R = [...Array.from({ length: 20 }, (_, i) => noche(i)), noche(30), noche(40)];
  const serie = VFC.tendenciaSerie(R);

  assert.equal(serie.has(iso(30)), false);
  assert.equal(serie.has(iso(40)), false);
  assert.equal(serie.has(iso(19)), true);
});

test('medir todas las noches da la media de las 7', () => {
  const VFC = cargarVFC();
  const R = Array.from({ length: 30 }, (_, i) => noche(i));
  const serie = VFC.tendenciaSerie(R);
  const ventana = [23, 24, 25, 26, 27, 28, 29].map(i => noche(i).vfc);

  assert.equal(serie.get(iso(29)).media7, ventana.reduce((a, b) => a + b, 0) / ventana.length);
});
