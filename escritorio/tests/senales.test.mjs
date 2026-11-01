// Semáforo de VFC y FC en reposo (App-PRO semaforo_senales_nocturnas_test,
// 29 y 31/10/2026) sobre escritorio/senales.js. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarCoach, cargar } from './comun.mjs';

cargarCoach('motor.js', 'data.js');
const { Senales } = cargar('senales.js');
const ref = new Date(2026, 9, 31);
/* 40 noches normales (VFC 60 ± 2, FC 50 ± 1) y, al final, `ultimas`. */
function noches(ultimas = []){
  const R = [];
  for (let i = 0; i < 40; i++) R.push({ fecha: new Date(2026, 8, 1 + i), vfc: 60 + (i % 3) - 1, fcReposo: 50 + (i % 2) });
  ultimas.forEach((u, k) => R.push({ fecha: new Date(2026, 9, 31 - ultimas.length + 1 + k), ...u }));
  return R;
}
const raw = { vfcActiva: true, readinessActivo: true, saludActiva: true };
const perfil = { vfcActiva: true, vfcBandaMin: null };
const luces = (R, r = raw) => Senales.preparar(r, R, perfil, ref);

test('en banda: las dos a favor', () => {
  const a = luces(noches([{ vfc: 60, fcReposo: 50 }]));
  assert.deepEqual([a.vfc.estado, a.fc.estado], ['aFavor', 'aFavor']);
});

test('una noche baja de VFC con la FC normal: vigilando, la FC no lo confirma', () => {
  const a = luces(noches([{ vfc: 52, fcReposo: 50 }]));
  assert.equal(a.vfc.estado, 'vigilando');
  assert.equal(a.vfc.matiz, 'otraNoConfirma');
  assert.equal(a.fc.estado, 'aFavor');
});

test('VFC baja y FC alta la misma noche: las dos frenan juntas', () => {
  const a = luces(noches([{ vfc: 52, fcReposo: 56 }]));
  assert.deepEqual([a.vfc.estado, a.vfc.matiz, a.fc.estado, a.fc.matiz], ['frena', 'conLaOtra', 'frena', 'conLaOtra']);
});

test('tres noches seguidas de VFC baja: frena por sostenida', () => {
  const a = luces(noches([{ vfc: 52, fcReposo: 51 }, { vfc: 52, fcReposo: 51 }, { vfc: 52, fcReposo: 51 }]));
  assert.equal(a.vfc.estado, 'frena');
});

test('FC sola: una noche muy alta vigila (31/10); tres seguidas frenan', () => {
  assert.equal(luces(noches([{ vfc: 60, fcReposo: 60 }])).fc.estado, 'vigilando');
  const a = luces(noches([{ vfc: 60, fcReposo: 56 }, { vfc: 60, fcReposo: 56 }, { vfc: 60, fcReposo: 56 }]));
  assert.deepEqual([a.fc.estado, a.fc.matiz], ['frena', 'sostenida']);
});

test('sin datos suficientes, sin noche reciente o apagada', () => {
  const pocas = [{ fecha: new Date(2026, 9, 30), vfc: 60, fcReposo: 50 }];
  assert.equal(luces(pocas).vfc.estado, 'aprendiendo');
  assert.equal(luces(pocas).fc.estado, 'aprendiendo');
  const vieja = noches().filter(r => r.fecha < new Date(2026, 9, 20));
  assert.equal(luces(vieja).vfc.estado, 'sinNoche');
  assert.equal(luces(noches(), { vfcActiva: false }).vfc.estado, 'inactiva');
  assert.equal(Senales.texto({ estado: 'frena', matiz: 'conLaOtra' }, true).segunda, 'Junto con la FC en reposo');
});
