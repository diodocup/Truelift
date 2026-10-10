// Las listas de nombres de coach/motor.js son copias de constantes de la app
// móvil. Si el repositorio App-PRO está junto a este (../App-PRO o
// APP_PRO_DIR), se comparan con el código fuente; si no, la prueba se omite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarCoach } from './comun.mjs';

const { Motor } = cargarCoach('motor.js');
const raiz = process.env.APP_PRO_DIR || new URL('../../../App-PRO/', import.meta.url).pathname;
const fuente = f => { try { return fs.readFileSync(`${raiz}/${f}`, 'utf8'); } catch (_) { return null; } };
const app = fuente('lib/app_state.dart');
const modelos = fuente('lib/models.dart');
const vol = fuente('lib/volumen_historico.dart');
const omitir = !app || !modelos || !vol ? 'App-PRO no está disponible junto a este repositorio' : false;

function conjunto(src, nombre){
  const m = src.match(new RegExp(`${nombre}\\s*=\\s*(?:<String>)?\\{([\\s\\S]*?)\\};`));
  assert.ok(m, `no se encontró ${nombre}`);
  return [...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
}

test('listas de material y ejercicios por tiempo iguales a app_state.dart', { skip: omitir }, () => {
  assert.deepEqual([...Motor.PESO_CORPORAL_EXACTOS].sort(), conjunto(app, '_pesoCorporalExactos'));
  assert.deepEqual([...Motor.MAQUINAS_CARGA_PROPIA].sort(), conjunto(app, '_maquinasDeCargaPropia'));
  assert.deepEqual([...Motor.ASISTIDOS_EXACTOS].sort(), conjunto(app, '_asistidosExactos'));
  assert.deepEqual([...Motor.POR_TIEMPO].sort(), conjunto(app, '_ejerciciosPorTiempo'));
  assert.match(app, /maxRepsEfectivasE1rmFiable = 18;/);
  assert.match(app, /'deficit' => 5,\s*'superavit' => 3,\s*_ => 4,/);
});

test('fusionados y volumen iguales a models.dart y volumen_historico.dart', { skip: omitir }, () => {
  const m = modelos.match(/ejerciciosFusionados = \{([\s\S]*?)\};/)[1];
  const pares = Object.fromEntries([...m.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(x => [x[1], x[2]]));
  assert.deepEqual(Motor.FUSIONADOS, pares);
  assert.deepEqual([...Motor.SIN_VOLUMEN_MUSCULAR].sort(), conjunto(vol, '_sinVolumenMuscular'));
  assert.deepEqual([...Motor.PATRONES_ISQUIOS].sort(), conjunto(vol, '_patronesIsquios'));
});
