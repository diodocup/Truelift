// Fase 7: la caché sin conexión (sw.js) cubre todo lo que carga la página
// y solo gestiona sus propias cachés.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../', import.meta.url);
const leer = f => fs.readFileSync(new URL(f, dir), 'utf8');

test('sw.js precachea cada script, hoja y fuente que usa index.html', () => {
  const html = leer('index.html'), sw = leer('sw.js');
  const lista = new Set([...sw.matchAll(/'([^']+\.(?:js|css|png|woff2|html))'/g)].map(m => m[1]));
  const usados = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|png|woff2))"/g)].map(m => m[1]);
  assert.ok(usados.length > 20);
  for (const u of usados) assert.ok(lista.has(u), `falta en sw.js: ${u}`);
  for (const f of ['archivo-latin-ext', 'jetbrainsmono-latin-ext']) assert.ok(lista.has(`../fonts/${f}.woff2`), f);
  // Cada archivo de la lista existe (una errata haría fallar la instalación).
  for (const f of lista) if (f !== 'sw.js') assert.ok(fs.existsSync(new URL(f, dir)), `no existe: ${f}`);
});

test('las dos herramientas solo borran sus propias cachés al activarse', () => {
  assert.match(leer('sw.js'), /k\.startsWith\(PREFIJO\) && k !== VERSION/);
  assert.match(fs.readFileSync(new URL('../coach/sw.js', dir), 'utf8'), /k\.startsWith\('tlcoach-'\) && k !== VERSION/);
});
