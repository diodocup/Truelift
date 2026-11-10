// Archivo de clave de entrenador CIFRADO con la clave de PRUEBAS
// (fixtures/plan-entrenador/CLAVE_PRUEBAS.json), con el mismo formato que
// escribe `tool/entrenador_claves.mjs generar` de App-PRO
// (CONTRATO_PLAN_ENTRENADOR.md §5). Se genera al vuelo: ningún archivo
// `clave_entrenador*.json` se guarda en el repositorio.
import fs from 'node:fs';
import { webcrypto as wc } from 'node:crypto';

export const CLAVE_PRUEBAS = JSON.parse(fs.readFileSync(new URL('./fixtures/plan-entrenador/CLAVE_PRUEBAS.json', import.meta.url), 'utf8'));
export const CONTRASENA_PRUEBAS = 'contraseña de pruebas 123';
const b64url = b => Buffer.from(b).toString('base64url');
const PKCS8_ED25519 = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

/** Texto del archivo de clave. `iteraciones` solo baja en pruebas que lo rechazan. */
export async function archivoClave({ contrasena = CONTRASENA_PRUEBAS, semilla = CLAVE_PRUEBAS.semilla,
  id = CLAVE_PRUEBAS.id, publica = CLAVE_PRUEBAS.publica, iteraciones = 600000 } = {}){
  const pkcs8 = new Uint8Array([...PKCS8_ED25519, ...Buffer.from(semilla, 'base64url')]);
  const sal = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const base = await wc.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey']);
  const aes = await wc.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const datos = new Uint8Array(await wc.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`truelift-clave-entrenador:v1:${id}`) }, aes, pkcs8));
  return JSON.stringify({ formato: 'truelift-clave-entrenador', v: 1, id, publica,
    kdf: { alg: 'PBKDF2-SHA-256', iteraciones, sal: b64url(sal) },
    cifrado: { alg: 'AES-256-GCM', iv: b64url(iv), datos: b64url(datos) } }, null, 2) + '\n';
}
