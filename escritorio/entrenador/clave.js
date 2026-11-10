/* Modo entrenador: archivo de clave privada.
 *
 * Lee el archivo `clave_entrenador_<id>.json` que produce
 * `tool/entrenador_claves.mjs generar` (App-PRO), lo descifra con la
 * contraseña y devuelve la clave privada Ed25519 como CryptoKey NO
 * extraíble. Formato: CONTRATO_PLAN_ENTRENADOR.md §5.
 *
 * - La contraseña y los bytes PKCS#8 en claro solo viven dentro de
 *   `desbloquear`: los bytes se sobrescriben con ceros en cuanto se importa
 *   la clave, y ningún mensaje de error los incluye.
 * - Antes de dar la clave por buena se firma un mensaje de prueba y se
 *   verifica con la pública del archivo: una privada que no corresponda a su
 *   pública (archivo manipulado) no llega a firmar ningún paquete.
 *
 * Puro (WebCrypto + PaqueteEntrenador): se carga a demanda en el navegador y
 * en Node para las pruebas. Depende de entrenador/paquete.js.
 */
'use strict';

const ClaveEntrenador = (() => {
  const P = PaqueteEntrenador;
  const FORMATO = 'truelift-clave-entrenador';
  const V = 1;
  const ITER_MIN = 600000;
  // Un archivo con millones de iteraciones colgaría la pestaña: se rechaza.
  const ITER_MAX = 10000000;
  const TAM_MAX = 16 * 1024;
  const enc = new TextEncoder();

  class ErrorClave extends Error {
    constructor(codigo, mensaje){ super(mensaje); this.codigo = codigo; }
  }
  const MENSAJES = {
    noEsClave: 'Este archivo no es un archivo de clave de entrenador de TrueLift.',
    noSoportado: 'Este archivo de clave es de una versión más reciente. Actualiza la página.',
    danado: 'El archivo de clave está dañado o se ha modificado.',
    contrasena: 'La contraseña no es correcta (o el archivo de clave está dañado).',
    navegador: 'Este navegador no admite las firmas que usa el modo entrenador. Usa una versión reciente de Chrome, Edge, Firefox o Safari.',
  };
  const fallo = codigo => new ErrorClave(codigo, MENSAJES[codigo]);

  const esObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function bytes(v, largo){
    const b = P.desdeB64url(v);
    return b && (largo == null || b.length === largo) ? b : null;
  }

  /** ¿Admite el navegador Ed25519 en WebCrypto? */
  async function soportado(){
    try {
      if (!globalThis.crypto || !crypto.subtle) return false;
      // Pública de la RFC 8032 §7.1, prueba 1.
      const pub = new Uint8Array('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'.match(/../g).map(x => parseInt(x, 16)));
      await crypto.subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
      return true;
    } catch { return false; }
  }

  /**
   * Analiza el texto del archivo de clave sin descifrarlo. Lanza ErrorClave
   * (`noEsClave`, `noSoportado`, `danado`). Devuelve los campos en bytes.
   */
  function leer(texto){
    if (typeof texto !== 'string' || texto.length > TAM_MAX) throw fallo('noEsClave');
    let o;
    try { o = JSON.parse(texto); } catch { throw fallo('noEsClave'); }
    if (!esObj(o) || o.formato !== FORMATO) throw fallo('noEsClave');
    if (!Number.isInteger(o.v) || o.v < 1) throw fallo('noEsClave');
    if (o.v > V) throw fallo('noSoportado');
    if (typeof o.id !== 'string' || !/^[0-9a-f]{16}$/.test(o.id)) throw fallo('danado');
    const publica = bytes(o.publica, 32);
    if (!publica || !esObj(o.kdf) || !esObj(o.cifrado)) throw fallo('danado');
    if (o.kdf.alg !== 'PBKDF2-SHA-256' || o.cifrado.alg !== 'AES-256-GCM') throw fallo('noSoportado');
    const it = o.kdf.iteraciones;
    if (!Number.isInteger(it) || it < ITER_MIN || it > ITER_MAX) throw fallo('danado');
    const sal = bytes(o.kdf.sal, 16), iv = bytes(o.cifrado.iv, 12), datos = bytes(o.cifrado.datos);
    if (!sal || !iv || !datos || datos.length < 17) throw fallo('danado');
    return { id: o.id, publica, publicaTexto: o.publica, iteraciones: it, sal, iv, datos };
  }

  /**
   * Descifra el archivo con la contraseña. Devuelve
   * `{ id, publica: <base64url>, privada: CryptoKey no extraíble }`.
   * Lanza ErrorClave con `codigo` y un mensaje para la persona.
   */
  async function desbloquear(texto, contrasena){
    if (!await soportado()) throw fallo('navegador');
    const k = leer(texto);
    // El id es el de la pública: un archivo con los dos cambiados de sitio
    // firmaría paquetes que la app atribuiría a otra clave.
    if (await P.idDeClave(k.publica) !== k.id) throw fallo('danado');
    const base = await crypto.subtle.importKey('raw', enc.encode(String(contrasena ?? '')), 'PBKDF2', false, ['deriveKey']);
    const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: k.sal, iterations: k.iteraciones },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let pkcs8;
    try {
      pkcs8 = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: k.iv, additionalData: enc.encode(`${FORMATO}:v1:${k.id}`) }, aes, k.datos));
    } catch { throw fallo('contrasena'); }
    let privada;
    try { privada = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']); }
    catch { throw fallo('danado'); }
    finally { pkcs8.fill(0); }
    if (!await comprobar(privada, k.publica)) throw fallo('danado');
    return { id: k.id, publica: k.publicaTexto, privada };
  }

  /** Firma un mensaje al azar y lo verifica con la pública. */
  async function comprobar(privada, publica){
    try {
      const msg = crypto.getRandomValues(new Uint8Array(32));
      const firma = await crypto.subtle.sign({ name: 'Ed25519' }, privada, msg);
      const pub = await crypto.subtle.importKey('raw', typeof publica === 'string' ? P.desdeB64url(publica) : publica,
        { name: 'Ed25519' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'Ed25519' }, pub, firma, msg);
    } catch { return false; }
  }

  return Object.freeze({ FORMATO, V, ITER_MIN, ITER_MAX, TAM_MAX, MENSAJES, ErrorClave, soportado, leer, desbloquear, comprobar });
})();
