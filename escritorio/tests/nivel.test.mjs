// Nivel de fuerza global (coach/motor.js ↔ lib/nivel_fuerza.dart) y la
// tarjeta «Tu nivel» de Mi resumen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargar, cargarCoach, sesion, entrada } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const G = cargar('analisis.js', 'vistas.js');
const { Analisis, VistasEsc, Motor } = G;

const HOY = new Date(2026, 9, 23);
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
// Una serie de 1 rep a RIR 0: e1RM = kg · (1 + 1/30).
const e1 = (ejercicio, e1rm, extra = {}) => entrada(ejercicio, e1rm / (1 + 1 / 30), [1], [0], extra);
const copia = (entradas, { extraLog = {}, ...perfil } = {}) => ({
  sexo: 'hombre', sistema: 'doble', dias: '4', pesoCorporal: 100, sexoUsuario: 'hombre', ...perfil,
  logs: [sesion('2026-10-01T18:00:00.000', 'Día 1', entradas, extraLog)],
});
const clas = (raw) => Motor.clasificacionesNivel(raw, HOY);

test('puntuación continua igual que nivel_fuerza_test.dart', () => {
  const sent = Motor.definicionNivelDe('Sentadilla con barra').hombre;
  cerca(Motor.puntuacionNivel(40 / 80, sent), 0.5 / 0.75);
  cerca(Motor.puntuacionNivel(100 / 80, sent), 2);
  cerca(Motor.puntuacionNivel(2.75, sent), 5.5);   // Élite I y medio
  cerca(Motor.puntuacionNivel(3.0, sent), 6);      // Élite II
  cerca(Motor.puntuacionNivel(10, sent), 9);       // techo: Élite V
  assert.equal(Motor.definicionNivelDe('Dominada asistida en máquina').ejercicio, 'Dominada agarre prono');
  assert.equal(Motor.definicionNivelDe('Prensa 45°'), null);
  cerca(Motor.factorEdadNivel(null), 1);
  cerca(Motor.factorEdadNivel(45), 0.945);
});

test('nivel global: media de puntuaciones con mínimo de ejercicios y patrones', () => {
  const ents = [e1('Sentadilla con barra', 137.5), e1('Sentadilla frontal con barra', 112.5), e1('Press banca con barra', 100)];
  const g = Motor.nivelGlobal(clas(copia(ents)));
  cerca(g.puntuacion, 2.5);
  assert.equal(g.nombre, 'Novato');
  assert.equal(g.siguiente, 'Intermedio');
  assert.equal(g.patrones, 2);
  assert.equal(Motor.nivelGlobal(clas(copia(ents.slice(0, 2)))), null);
});

test('misma compuerta que las marcas de la app', () => {
  const ents = [e1('Sentadilla con barra', 200)];
  assert.equal(clas(copia(ents, { extraLog: { estadoSemaforo: 'ambar' } })).length, 0);
  assert.equal(clas(copia(ents, { extraLog: { origen: 'hevy' } })).length, 0);
  assert.equal(clas(copia([e1('Sentadilla con barra', 200, { molestias: true })])).length, 0);
  assert.equal(clas(copia([e1('Sentadilla con barra', 200, { estadoEjercicio: 'verde' })], { extraLog: { estadoSemaforo: 'ambar' } })).length, 1);
});

test('sexo declarado, edad y carga total en dominadas', () => {
  const ents = [e1('Sentadilla con barra', 100)];
  assert.equal(clas(copia(ents, { pesoCorporal: 80 }))[0].indice, 1);                       // 1,25× hombre: Novato
  assert.equal(clas(copia(ents, { pesoCorporal: 80, sexoUsuario: 'mujer' }))[0].indice, 2); // mujer: Intermedio
  // `sexo` es el reparto de la rutina, no el sexo del usuario.
  assert.equal(clas(copia(ents, { pesoCorporal: 80, sexo: 'mujer', sexoUsuario: undefined }))[0].indice, 1);
  const joven = clas(copia(ents, { pesoCorporal: 80 }))[0].puntuacion;
  const mayor = clas(copia(ents, { pesoCorporal: 80, fechaNacimiento: '1956-01-01' }))[0].puntuacion;
  assert.ok(mayor > joven);
  const dom = clas(copia([entrada('Dominada asistida en máquina', 20, [1], [0])], { pesoCorporal: 80 }))[0];
  cerca(dom.e1rm, 60 * (1 + 1 / 30));
});

test('Mi resumen pinta «Tu nivel» con el color del nivel y el progreso', () => {
  const raw = copia([e1('Sentadilla con barra', 137.5), e1('Sentadilla frontal con barra', 112.5), e1('Press banca con barra', 100)]);
  const M = Analisis.preparar(raw, { ultimoRegistro: '2026-10-01' });
  const html = VistasEsc.resumen(M, { inst: { resumen: { ultimoRegistro: '2026-10-01', ultimoEntreno: '2026-10-01' }, importadoEn: +HOY } });
  assert.match(html, /<h2 id="kpi-nivel">Tu nivel<\/h2>/);
  assert.match(html, /class="nivel-nombre nivel-t1">Novato</);
  assert.match(html, /Progreso hacia Intermedio: 50 %/);
  assert.equal((html.match(/class="nivel-tramo"/g) || []).length, 5);
});

test('sin nivel global, la tarjeta lo explica sin cifras', () => {
  const M = Analisis.preparar(copia([e1('Sentadilla con barra', 137.5)]), { ultimoRegistro: '2026-10-01' });
  const html = VistasEsc.resumen(M, { inst: { resumen: { ultimoRegistro: '2026-10-01', ultimoEntreno: '2026-10-01' }, importadoEn: +HOY } });
  const tarjeta = html.match(/<article[^>]*kpi-nivel[\s\S]*?<\/article>|<article[^>]*aria-labelledby="kpi-nivel"[\s\S]*?<\/article>/)[0];
  assert.doesNotMatch(tarjeta.replace(/<[^>]*>/g, ''), /\d/);
  assert.match(tarjeta, /aparecerá/);
});

// Si App-PRO está al lado, la tabla de umbrales debe ser la de la app.
const raiz = process.env.APP_PRO_DIR || new URL('../../../App-PRO/', import.meta.url).pathname;
let dart = null; try { dart = fs.readFileSync(`${raiz}/lib/nivel_fuerza.dart`, 'utf8'); } catch (_) { /* sin App-PRO */ }
test('umbrales iguales a nivel_fuerza.dart', { skip: dart ? false : 'App-PRO no está disponible junto a este repositorio' }, () => {
  const tabla = dart.slice(dart.indexOf('nivelesEjercicios = ['), dart.indexOf('];', dart.indexOf('nivelesEjercicios = [')));
  const defs = [...tabla.matchAll(/NivelEjercicioDef\(\s*'([^']+)',\s*'([^']+)',\s*\[([^\]]+)\],\s*\[([^\]]+)\](?:,\s*alias:\s*\[([^\]]*)\])?/g)]
    .map(m => ({ ejercicio: m[1], patron: m[2], hombre: m[3].split(',').map(Number), mujer: m[4].split(',').map(Number),
                 alias: m[5] ? [...m[5].matchAll(/'([^']+)'/g)].map(x => x[1]) : [] }));
  assert.equal(defs.length, Motor.NIVEL_EJERCICIOS.length);
  assert.deepEqual(JSON.parse(JSON.stringify(Motor.NIVEL_EJERCICIOS)), defs);
  const edad = [...dart.slice(dart.indexOf('factorEdadTabla')).split('];')[0].matchAll(/\((\d+),\s*([\d.]+)\)/g)].map(m => [+m[1], +m[2]]);
  assert.deepEqual(Motor.NIVEL_FACTOR_EDAD, edad);
});

test('la ficha del Coach lee el sexo declarado, no el reparto de la rutina', () => {
  assert.equal(G.normalizar({ sexo: 'mujer', sexoUsuario: 'hombre', logs: [] }).perfil.sexo, 'hombre');
  assert.equal(G.normalizar({ sexo: 'hombre', sexoUsuario: 'mujer', logs: [] }).perfil.sexo, 'mujer');
  assert.equal(G.normalizar({ sexo: 'mujer', logs: [] }).perfil.sexo, null);
});
