// Plan de entrenador: paquete.js contra el contrato y los vectores dorados
// (CONTRATO_PLAN_ENTRENADOR.md, PLAN_ENTRENADOR.md §8.1 y §8.3 de App-PRO).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cargar } from './comun.mjs';

const { PaqueteEntrenador: P } = cargar('entrenador/paquete.js');
const DIR = new URL('./fixtures/plan-entrenador/', import.meta.url);
const manifiesto = JSON.parse(fs.readFileSync(new URL('MANIFIESTO.json', DIR), 'utf8'));
const clavePruebas = JSON.parse(fs.readFileSync(new URL('CLAVE_PRUEBAS.json', DIR), 'utf8'));
const CLAVES = { [clavePruebas.id]: clavePruebas.publica };
const hexA = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));

test('RFC 8032 §7.1: WebCrypto Ed25519 da las firmas de la norma', async () => {
  const casos = [
    ['9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', '',
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'],
    ['4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
      '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c', '72',
      '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00'],
    ['c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7',
      'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025', 'af82',
      '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a'],
  ];
  for (const [sk, pk, msg, sig] of casos){
    const privada = await P.importarSemilla(hexA(sk), true);
    const jwk = await crypto.subtle.exportKey('jwk', privada);
    assert.equal(P.hex(P.desdeB64url(jwk.x)), pk);
    const firma = new Uint8Array(await crypto.subtle.sign('Ed25519', privada, hexA(msg)));
    assert.equal(P.hex(firma), sig);
    const publica = await crypto.subtle.importKey('raw', hexA(pk), 'Ed25519', false, ['verify']);
    assert.ok(await crypto.subtle.verify('Ed25519', publica, hexA(sig), hexA(msg)));
  }
});

test('base64url sin relleno: ida y vuelta y rechazos', () => {
  for (let n = 0; n < 70; n++){
    const b = crypto.randomBytes(n);
    const s = P.b64url(b);
    assert.equal(s, Buffer.from(b).toString('base64url'));
    assert.deepEqual(Buffer.from(P.desdeB64url(s)), b);
  }
  for (const malo of ['ab=', 'a+b', 'a/b', 'abcde', 'á', 3, null]) assert.equal(P.desdeB64url(malo), null, String(malo));
});

test('id de clave: 8 primeros bytes del SHA-256 de la pública, en hex', async () => {
  const pub = P.desdeB64url(clavePruebas.publica);
  assert.equal(await P.idDeClave(pub), crypto.createHash('sha256').update(pub).digest('hex').slice(0, 16));
  assert.equal(clavePruebas.id.length, 16);
});

test('vectores dorados: cada archivo coincide con su SHA-256 del manifiesto', () => {
  const enDisco = fs.readdirSync(DIR).filter(a => a !== 'MANIFIESTO.json').sort();
  assert.deepEqual(enDisco, manifiesto.archivos.map(a => a.archivo).sort());
  for (const { archivo, sha256 } of manifiesto.archivos){
    const h = crypto.createHash('sha256').update(fs.readFileSync(new URL(archivo, DIR))).digest('hex');
    assert.equal(h, sha256, archivo);
  }
});

test('vectores dorados: el verificador da exactamente el resultado esperado', async () => {
  const vectores = manifiesto.archivos.filter(a => a.esperado !== null);
  assert.ok(vectores.length >= 27);
  for (const { archivo, esperado } of vectores){
    const r = await P.verificar(fs.readFileSync(new URL(archivo, DIR)), { claves: CLAVES, hoy: manifiesto.hoy });
    assert.equal(r.ok ? 'valido' : r.error, esperado, `${archivo}: ${r.detalle || ''}`);
  }
});

test('vectores dorados: regenerarlos da los mismos bytes', () => {
  const salida = execFileSync(process.execPath, [new URL('./generar-vectores-plan-entrenador.mjs', import.meta.url).pathname, '--comprobar'],
    { encoding: 'utf8' });
  assert.match(salida, /al día/);
});

test('sin claves aceptadas, ningún paquete pasa (mapa vacío)', async () => {
  const r = await P.verificar(fs.readFileSync(new URL('v01_solo_rutina.json', DIR)), { claves: {}, hoy: manifiesto.hoy });
  assert.deepEqual([r.ok, r.error], [false, 'claveDesconocida']);
});

test('caducidad: se puede importar hasta el día de caducidad inclusive', async () => {
  const privada = await P.importarSemilla(P.desdeB64url(clavePruebas.semilla));
  const c = P.construirCarga({ id: 'pe_caduca', emitido: '2026-11-01', caduca: '2026-11-10',
    entrenador: 'E', cliente: 'C', temporada: { bloques: [{ tipo: 'BRIDGE', semanas: 2, tasaPctSemana: 0 }] } });
  const texto = await P.firmar(c, { clavePrivada: privada, idClave: clavePruebas.id, hoy: '2026-11-10' });
  assert.equal((await P.verificar(texto, { claves: CLAVES, hoy: '2026-11-10' })).ok, true);
  assert.equal((await P.verificar(texto, { claves: CLAVES, hoy: '2026-11-11' })).error, 'caducado');
});

test('emitir: firma, verifica lo firmado y nombra el archivo', async () => {
  const privada = await P.importarSemilla(P.desdeB64url(clavePruebas.semilla));
  const c = P.construirCarga({ entrenador: { nombre: 'Ana' }, cliente: { nombre: 'José María Núñez' }, emitido: '2026-11-10',
    rutina: JSON.parse(new TextDecoder().decode(P.desdeB64url(JSON.parse(fs.readFileSync(new URL('v01_solo_rutina.json', DIR), 'utf8')).carga))).rutina });
  assert.match(c.id, /^pe_[0-9a-f-]{36}$/);
  const r = await P.emitir(c, { clavePrivada: privada, idClave: clavePruebas.id, clavePublica: clavePruebas.publica, hoy: '2026-11-10' });
  assert.equal(r.nombreArchivo, 'plan_truelift_jose_maria_nunez_2026-11-10.json');
  assert.equal(r.sha256.length, 64);
  const v = await P.verificar(r.texto, { claves: CLAVES, hoy: '2026-11-10' });
  assert.equal(v.ok, true);
  assert.deepEqual(v.carga, c);
  // Con la pública de otra clave, la verificación propia falla y no hay archivo.
  await assert.rejects(P.emitir(c, { clavePrivada: privada, idClave: clavePruebas.id,
    clavePublica: clavePruebas.otraClave.publica, hoy: '2026-11-10' }), /verificación/);
});

test('firmar se niega a firmar una carga que la app rechazaría', async () => {
  const privada = await P.importarSemilla(P.desdeB64url(clavePruebas.semilla));
  const c = P.construirCarga({ entrenador: 'E', cliente: 'C', emitido: '2026-11-10' });
  await assert.rejects(P.firmar(c, { clavePrivada: privada, idClave: clavePruebas.id }), /contenidoInvalido/);
});

test('validarCarga: tipos estrictos y claves no admitidas', () => {
  const ok = { id: 'pe_x', emitido: '2026-11-10', entrenador: { nombre: 'E' }, cliente: { nombre: 'C' },
    temporada: { bloques: [{ tipo: 'CUT', semanas: 4, tasaPctSemana: -0.5 }] } };
  assert.equal(P.validarCarga(ok), null);
  const malos = [
    { ...ok, extra: 1 },
    { ...ok, emitido: '2026-02-30' },
    { ...ok, cliente: { nombre: '   ' } },
    { ...ok, nota: 'x'.repeat(2001) },
    { ...ok, temporada: { bloques: [{ tipo: 'CUT', semanas: 4, tasaPctSemana: '-0.5' }] } },
    { ...ok, temporada: { bloques: [{ tipo: 'BRIDGE', semanas: 4, tasaPctSemana: 0.1 }] } },
    { ...ok, temporada: { bloques: [{ tipo: 'CUT', semanas: 1.5, tasaPctSemana: -0.5 }] } },
  ];
  for (const m of malos) assert.equal(P.validarCarga(m)?.error, 'contenidoInvalido', JSON.stringify(m).slice(0, 120));
  // 80 caracteres sí; 81 no (contados como puntos de código).
  assert.equal(P.validarCarga({ ...ok, cliente: { nombre: 'ñ'.repeat(80) } }), null);
  assert.equal(P.validarCarga({ ...ok, cliente: { nombre: '💪'.repeat(81) } })?.error, 'contenidoInvalido');
});

// Con App-PRO al lado (../App-PRO), los dos repositorios deben llevar el mismo
// contrato y los mismos vectores dorados, byte a byte.
const APP = new URL('../../../App-PRO/', import.meta.url);
test('App-PRO al lado: mismo contrato y mismos vectores', { skip: !fs.existsSync(APP) && 'sin App-PRO al lado' }, () => {
  const contrato = a => fs.readFileSync(a, 'utf8');
  assert.equal(contrato(new URL('CONTRATO_PLAN_ENTRENADOR.md', APP)),
    contrato(new URL('../CONTRATO_PLAN_ENTRENADOR.md', import.meta.url)));
  const suyos = new URL('test/fixtures/plan_entrenador/', APP);
  const nombres = fs.readdirSync(DIR).sort();
  assert.deepEqual(fs.readdirSync(suyos).sort(), nombres);
  for (const n of nombres) assert.ok(fs.readFileSync(new URL(n, suyos)).equals(fs.readFileSync(new URL(n, DIR))), n);
});
