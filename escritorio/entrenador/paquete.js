/* Plan de entrenador: construir, firmar y verificar el paquete.
 *
 * Contrato: escritorio/CONTRATO_PLAN_ENTRENADOR.md (idéntico en App-PRO).
 * Este archivo es puro: no toca el DOM ni el almacén, solo WebCrypto
 * (`crypto.subtle`, algoritmo Ed25519) y TextEncoder/TextDecoder, así que se
 * carga igual en el navegador (a demanda, en el modo entrenador) y en Node
 * para las pruebas.
 *
 * La app verifica con su propio código Dart (lib/plan_entrenador/). Los dos
 * lados se mantienen de acuerdo con los vectores dorados de
 * tests/fixtures/plan-entrenador/: si una regla cambia aquí y no allí, las
 * pruebas de uno de los dos repositorios se ponen en rojo.
 */
'use strict';

const PaqueteEntrenador = (() => {
  const FORMATO = 'truelift-plan-entrenador';
  // Versión más alta que se sabe leer. Un plan se emite con la más baja que
  // lo describe (versionDe): sin datos del cliente sigue siendo v1, que leen
  // todas las versiones de la app.
  const V = 2;
  const TAM_MAX = 256 * 1024;
  const PREFIJO_FIRMA = 'truelift-plan-entrenador:v1\n';

  // Límites de §3 del contrato. Los de temporada son los de
  // ConstantesNutricion en la app (planBloquesMax, planHorizonteMaxSemanas):
  // los vectores «7 bloques» y «horizonte excesivo» detectan si se separan.
  const LIMITES = Object.freeze({
    diasMin: 2, diasMax: 5,
    filasPorDiaMax: 10,
    seriesMin: 1, seriesMax: 10,
    textoMax: 80, notaMax: 2000,
    descansoMaxMin: 15,
    pctMin: 5, pctMax: 30,
    superserieMax: 99,
    pausaRpMin: 10, pausaRpMax: 50,
    ejerciciosPropiosMax: 200, secundariosMax: 10,
    bloquesMax: 6, horizonteMaxSemanas: 78,
    // Datos de partida del cliente (v2): los rangos que la app admite a mano
    // (pesaje, stepper de altura y registro de % graso).
    pesoMinKg: 40, pesoMaxKg: 150, alturaMinCm: 130, alturaMaxCm: 220, grasaMinPct: 3, grasaMaxPct: 60,
  });
  const CLAVES_DATOS = Object.freeze(['sexo', 'pesoKg', 'alturaCm', 'grasaPct']);

  const ERRORES = Object.freeze(['noEsUnPlan', 'esUnaCopia', 'versionNoSoportada',
    'firmaInvalida', 'claveDesconocida', 'contenidoInvalido', 'caducado', 'demasiadoGrande']);

  const enc = new TextEncoder();

  // ---------- base64url sin relleno ----------
  const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64url(bytes){
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < b.length; i += 3){
      const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      s += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
      if (i + 1 < b.length) s += ALFABETO[(n >> 6) & 63];
      if (i + 2 < b.length) s += ALFABETO[n & 63];
    }
    return s;
  }
  /** Decodifica base64url SIN relleno. Devuelve null si no lo es. */
  function desdeB64url(s){
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
    const out = new Uint8Array(Math.floor(s.length * 3 / 4));
    let o = 0;
    for (let i = 0; i < s.length; i += 4){
      const c = [0, 1, 2, 3].map(k => (i + k < s.length ? ALFABETO.indexOf(s[i + k]) : 0));
      const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
      out[o++] = (n >> 16) & 255;
      if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
      if (i + 3 < s.length) out[o++] = n & 255;
    }
    return out;
  }
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

  function concat(a, b){
    const r = new Uint8Array(a.length + b.length);
    r.set(a, 0); r.set(b, a.length);
    return r;
  }
  const mensajeAFirmar = bytesCarga => concat(enc.encode(PREFIJO_FIRMA), bytesCarga);

  /** Id de una clave pública: 8 primeros bytes de su SHA-256, en hex. */
  async function idDeClave(publicaCruda){
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', publicaCruda));
    return hex(h.subarray(0, 8));
  }

  // ---------- Validación de la carga (§3, pasos 5–7) ----------
  const esObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const esEntero = v => typeof v === 'number' && Number.isInteger(v);
  const esNum = v => typeof v === 'number' && Number.isFinite(v);
  const largo = s => [...s].length;

  function fechaValida(s){
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [a, m, d] = s.split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1, d));
    return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
  }

  class Invalido extends Error {}
  function exige(cond, detalle){ if (!cond) throw new Invalido(detalle); }

  function soloClaves(obj, permitidas, donde){
    for (const k of Object.keys(obj)) exige(permitidas.includes(k), `${donde}: clave no admitida «${k}»`);
  }
  function texto(v, donde, { min = 0, max = LIMITES.textoMax } = {}){
    exige(typeof v === 'string', `${donde}: debe ser texto`);
    exige(largo(v) <= max, `${donde}: más de ${max} caracteres`);
    if (min > 0) exige(v.trim().length > 0, `${donde}: vacío`);
  }
  function enteroEn(v, a, b, donde){
    exige(esEntero(v), `${donde}: debe ser un entero`);
    exige(v >= a && v <= b, `${donde}: fuera de rango (${a}–${b})`);
  }
  function opcional(obj, k, f){ if (Object.prototype.hasOwnProperty.call(obj, k)) f(obj[k]); }

  function validarFila(f, donde){
    exige(esObj(f), `${donde}: debe ser un objeto`);
    soloClaves(f, ['patron', 'ejercicio', 'series', 'reps', 'rir', 'descanso', 'topBack', 'backoffPct',
      'rirBack', 'dropSet', 'dropPct', 'superserie', 'restPause', 'pausaRpSeg',
      'seriesLibres', 'repsSeries', 'rirSeries'], donde);
    texto(f.patron, `${donde}.patron`);
    texto(f.ejercicio, `${donde}.ejercicio`, { min: 1 });
    enteroEn(f.series, LIMITES.seriesMin, LIMITES.seriesMax, `${donde}.series`);
    texto(f.reps, `${donde}.reps`);
    texto(f.rir, `${donde}.rir`);
    opcional(f, 'descanso', v => exige(esNum(v) && v > 0 && v <= LIMITES.descansoMaxMin, `${donde}.descanso: fuera de rango`));
    for (const k of ['topBack', 'dropSet', 'restPause', 'seriesLibres']) opcional(f, k, v => exige(typeof v === 'boolean', `${donde}.${k}: debe ser booleano`));
    for (const k of ['backoffPct', 'dropPct']) opcional(f, k, v => enteroEn(v, LIMITES.pctMin, LIMITES.pctMax, `${donde}.${k}`));
    opcional(f, 'rirBack', v => texto(v, `${donde}.rirBack`));
    opcional(f, 'superserie', v => enteroEn(v, 0, LIMITES.superserieMax, `${donde}.superserie`));
    opcional(f, 'pausaRpSeg', v => enteroEn(v, LIMITES.pausaRpMin, LIMITES.pausaRpMax, `${donde}.pausaRpSeg`));
    // Series libres: reps y RIR de cada serie, en orden (como mucho tantas
    // como series admite una fila; las que falten copian la última).
    for (const k of ['repsSeries', 'rirSeries']) opcional(f, k, v => {
      exige(Array.isArray(v) && v.length <= LIMITES.seriesMax, `${donde}.${k}: lista de hasta ${LIMITES.seriesMax}`);
      v.forEach((x, i) => texto(x, `${donde}.${k}[${i}]`, { min: 1 }));
    });
  }

  function validarEjercicioPropio(e, donde){
    exige(esObj(e), `${donde}: debe ser un objeto`);
    soloClaves(e, ['nombre', 'grupo', 'patron', 'secundarios', 'prioridad', 'nota', 'descanso', 'porTiempo'], donde);
    texto(e.nombre, `${donde}.nombre`, { min: 1 });
    for (const k of ['grupo', 'patron', 'prioridad', 'descanso']) opcional(e, k, v => texto(v, `${donde}.${k}`));
    opcional(e, 'nota', v => texto(v, `${donde}.nota`, { max: LIMITES.notaMax }));
    opcional(e, 'porTiempo', v => exige(typeof v === 'boolean', `${donde}.porTiempo: debe ser booleano`));
    opcional(e, 'secundarios', v => {
      exige(Array.isArray(v) && v.length <= LIMITES.secundariosMax, `${donde}.secundarios: lista de hasta ${LIMITES.secundariosMax}`);
      v.forEach((s, i) => texto(s, `${donde}.secundarios[${i}]`, { min: 1 }));
    });
  }

  function validarRutina(r){
    exige(esObj(r), 'rutina: debe ser un objeto');
    soloClaves(r, ['nombre', 'sistema', 'dias', 'ejercicios'], 'rutina');
    texto(r.nombre, 'rutina.nombre');
    exige(r.sistema === 'simple' || r.sistema === 'doble', 'rutina.sistema: «simple» o «doble»');
    exige(Array.isArray(r.dias), 'rutina.dias: debe ser una lista');
    exige(r.dias.length >= LIMITES.diasMin && r.dias.length <= LIMITES.diasMax,
      `rutina.dias: entre ${LIMITES.diasMin} y ${LIMITES.diasMax} días`);
    r.dias.forEach((d, i) => {
      const donde = `rutina.dias[${i}]`;
      exige(esObj(d), `${donde}: debe ser un objeto`);
      soloClaves(d, ['nombre', 'ejercicios'], donde);
      texto(d.nombre, `${donde}.nombre`);
      exige(Array.isArray(d.ejercicios) && d.ejercicios.length >= 1 && d.ejercicios.length <= LIMITES.filasPorDiaMax,
        `${donde}.ejercicios: entre 1 y ${LIMITES.filasPorDiaMax}`);
      d.ejercicios.forEach((f, j) => validarFila(f, `${donde}.ejercicios[${j}]`));
    });
    opcional(r, 'ejercicios', v => {
      exige(Array.isArray(v) && v.length <= LIMITES.ejerciciosPropiosMax,
        `rutina.ejercicios: lista de hasta ${LIMITES.ejerciciosPropiosMax}`);
      v.forEach((e, i) => validarEjercicioPropio(e, `rutina.ejercicios[${i}]`));
    });
  }

  function validarTemporada(t){
    exige(esObj(t), 'temporada: debe ser un objeto');
    soloClaves(t, ['bloques'], 'temporada');
    exige(Array.isArray(t.bloques), 'temporada.bloques: debe ser una lista');
    exige(t.bloques.length >= 1 && t.bloques.length <= LIMITES.bloquesMax,
      `temporada.bloques: entre 1 y ${LIMITES.bloquesMax}`);
    let total = 0, previo = null;
    t.bloques.forEach((b, i) => {
      const donde = `temporada.bloques[${i}]`;
      exige(esObj(b), `${donde}: debe ser un objeto`);
      soloClaves(b, ['tipo', 'semanas', 'tasaPctSemana'], donde);
      exige(['BULK', 'BRIDGE', 'CUT'].includes(b.tipo), `${donde}.tipo: BULK, BRIDGE o CUT`);
      exige(esEntero(b.semanas) && b.semanas >= 1, `${donde}.semanas: entero ≥ 1`);
      exige(esNum(b.tasaPctSemana), `${donde}.tasaPctSemana: debe ser un número`);
      const t2 = b.tasaPctSemana;
      exige(b.tipo === 'CUT' ? t2 < 0 : b.tipo === 'BULK' ? t2 > 0 : t2 === 0,
        `${donde}.tasaPctSemana: signo incoherente con ${b.tipo}`);
      exige(b.tipo !== previo, `${donde}: dos bloques seguidos del mismo tipo`);
      previo = b.tipo;
      total += b.semanas;
    });
    exige(total <= LIMITES.horizonteMaxSemanas, `temporada: más de ${LIMITES.horizonteMaxSemanas} semanas en total`);
  }

  function validarDatos(d){
    exige(esObj(d), 'cliente.datos: debe ser un objeto');
    soloClaves(d, CLAVES_DATOS, 'cliente.datos');
    exige(Object.keys(d).length >= 1, 'cliente.datos: vacío');
    opcional(d, 'sexo', v => exige(v === 'hombre' || v === 'mujer', 'cliente.datos.sexo: «hombre» o «mujer»'));
    const enRango = (k, a, b) => opcional(d, k, v => exige(esNum(v) && v >= a && v <= b, `cliente.datos.${k}: número entre ${a} y ${b}`));
    enRango('pesoKg', LIMITES.pesoMinKg, LIMITES.pesoMaxKg);
    enRango('alturaCm', LIMITES.alturaMinCm, LIMITES.alturaMaxCm);
    enRango('grasaPct', LIMITES.grasaMinPct, LIMITES.grasaMaxPct);
  }

  /** Versión mínima que describe la carga: v2 solo si lleva datos del cliente. */
  const versionDe = c => (esObj(c) && esObj(c.cliente) && 'datos' in c.cliente ? 2 : 1);

  /**
   * Valida una carga ya analizada. `hoy` es `AAAA-MM-DD`; `v`, la versión del
   * sobre (la v1 no admite datos del cliente).
   * Devuelve null si vale, o `{ error, detalle }`.
   */
  function validarCarga(c, { hoy, v = V } = {}){
    try {
      exige(esObj(c), 'la carga debe ser un objeto');
      soloClaves(c, ['id', 'emitido', 'caduca', 'entrenador', 'cliente', 'nota', 'rutina', 'temporada'], 'carga');
      exige(typeof c.id === 'string' && /^pe_[0-9a-z-]{1,64}$/.test(c.id), 'id: «pe_» y 1–64 caracteres [0-9a-z-]');
      exige(fechaValida(c.emitido), 'emitido: fecha AAAA-MM-DD');
      opcional(c, 'caduca', v => exige(fechaValida(v), 'caduca: fecha AAAA-MM-DD'));
      for (const k of ['entrenador', 'cliente']){
        exige(esObj(c[k]), `${k}: debe ser un objeto`);
        soloClaves(c[k], k === 'cliente' && v >= 2 ? ['nombre', 'datos'] : ['nombre'], k);
        texto(c[k].nombre, `${k}.nombre`, { min: 1 });
      }
      opcional(c.cliente, 'datos', validarDatos);
      opcional(c, 'nota', v => texto(v, 'nota', { max: LIMITES.notaMax }));
      exige('rutina' in c || 'temporada' in c, 'falta la rutina y la temporada');
      opcional(c, 'rutina', validarRutina);
      opcional(c, 'temporada', validarTemporada);
    } catch (e){
      if (e instanceof Invalido) return { error: 'contenidoInvalido', detalle: e.message };
      throw e;
    }
    if (c.caduca && hoy && c.caduca < hoy) return { error: 'caducado', detalle: `caducó el ${c.caduca}` };
    return null;
  }

  // ---------- Verificar (§4) ----------
  /**
   * Verifica un archivo de paquete.
   * - `entrada`: Uint8Array con los bytes del archivo, o su texto.
   * - `claves`: `{ id: clavePublicaBase64url }` aceptadas.
   * - `hoy`: `AAAA-MM-DD`; por defecto, la fecha local.
   * Devuelve `{ ok: true, carga, bytesCarga, clave }` o `{ ok: false, error, detalle }`.
   */
  async function verificar(entrada, { claves = {}, hoy = hoyLocal() } = {}){
    const mal = (error, detalle = '') => ({ ok: false, error, detalle });
    const bytes = typeof entrada === 'string' ? enc.encode(entrada) : new Uint8Array(entrada);
    // 1
    if (bytes.length > TAM_MAX) return mal('demasiadoGrande');
    let sobre;
    try { sobre = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return mal('noEsUnPlan', 'no es JSON'); }
    if (!esObj(sobre)) return mal('noEsUnPlan', 'no es un objeto');
    // 2
    if (sobre.formato !== FORMATO){
      if (!('formato' in sobre) && ('logs' in sobre || 'sexo' in sobre)) return mal('esUnaCopia');
      return mal('noEsUnPlan', 'formato ajeno');
    }
    // 3
    if (!esEntero(sobre.v) || sobre.v < 1) return mal('noEsUnPlan', 'versión no válida');
    if (sobre.v > V) return mal('versionNoSoportada');
    // 4
    if (typeof sobre.clave !== 'string' || !Object.prototype.hasOwnProperty.call(claves, sobre.clave)) {
      return mal('claveDesconocida');
    }
    const publica = desdeB64url(claves[sobre.clave]);
    const bytesCarga = desdeB64url(sobre.carga);
    const firma = desdeB64url(sobre.firma);
    if (!bytesCarga || !firma || firma.length !== 64 || !publica || publica.length !== 32) {
      return mal('firmaInvalida', 'codificación');
    }
    let valida = false;
    try {
      const k = await crypto.subtle.importKey('raw', publica, { name: 'Ed25519' }, false, ['verify']);
      valida = await crypto.subtle.verify({ name: 'Ed25519' }, k, firma, mensajeAFirmar(bytesCarga));
    } catch { valida = false; }
    if (!valida) return mal('firmaInvalida');
    // 5–7
    let carga;
    try { carga = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytesCarga)); }
    catch { return mal('contenidoInvalido', 'la carga no es JSON'); }
    const err = validarCarga(carga, { hoy, v: sobre.v });
    if (err) return mal(err.error, err.detalle);
    return { ok: true, carga, bytesCarga, clave: sobre.clave };
  }

  function hoyLocal(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------- Construir y firmar ----------
  /**
   * Ordena la carga con el orden del contrato y quita lo que no va.
   * `id` y `emitido` se rellenan si faltan.
   */
  function construirCarga({ id, emitido, caduca, entrenador, cliente, nota, rutina, temporada }){
    const c = {
      id: id || `pe_${crypto.randomUUID()}`,
      emitido: emitido || hoyLocal(),
    };
    if (caduca) c.caduca = caduca;
    c.entrenador = { nombre: entrenador?.nombre ?? entrenador };
    c.cliente = { nombre: cliente?.nombre ?? cliente };
    // Datos de partida del cliente (v2): solo los que vienen, en orden fijo.
    const d = cliente?.datos;
    if (esObj(d)){
      const datos = {};
      for (const k of CLAVES_DATOS) if (d[k] != null && d[k] !== '') datos[k] = d[k];
      if (Object.keys(datos).length) c.cliente.datos = datos;
    }
    if (nota) c.nota = nota;
    if (rutina) c.rutina = rutina;
    if (temporada) c.temporada = temporada;
    return c;
  }

  /** Firma bytes de carga ya serializados y monta el sobre (texto). */
  async function firmarBytes(bytesCarga, { clavePrivada, idClave, v = 1 }){
    const firma = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, clavePrivada, mensajeAFirmar(bytesCarga)));
    return JSON.stringify({ formato: FORMATO, v, clave: idClave, carga: b64url(bytesCarga), firma: b64url(firma) }, null, 1) + '\n';
  }

  /**
   * Valida la carga, la serializa y la firma. Lanza si la carga no vale.
   * Devuelve el texto del archivo.
   */
  async function firmar(carga, { clavePrivada, idClave, hoy }){
    const v = versionDe(carga);
    const err = validarCarga(carga, { hoy, v });
    if (err) throw new Error(`Paquete no válido (${err.error}): ${err.detalle}`);
    return firmarBytes(enc.encode(JSON.stringify(carga)), { clavePrivada, idClave, v });
  }

  /**
   * Firma y, ANTES de entregar nada, verifica el resultado con la clave
   * pública: si la verificación propia falla, lanza y no hay archivo.
   * Devuelve `{ texto, nombreArchivo, sha256 }`.
   */
  async function emitir(carga, { clavePrivada, idClave, clavePublica, hoy = hoyLocal() }){
    const texto = await firmar(carga, { clavePrivada, idClave, hoy });
    const r = await verificar(texto, { claves: { [idClave]: clavePublica }, hoy });
    if (!r.ok) throw new Error(`La verificación del paquete recién firmado ha fallado (${r.error}).`);
    const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
    return { texto, nombreArchivo: nombreArchivo(carga.cliente.nombre, carga.emitido), sha256: hex(sha) };
  }

  /** `plan_truelift_<cliente>_<AAAA-MM-DD>.json` */
  function nombreArchivo(cliente, fecha){
    const slug = String(cliente || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'cliente';
    return `plan_truelift_${slug}_${fecha}.json`;
  }

  /** Importa una semilla Ed25519 de 32 bytes como clave privada (PKCS#8). */
  async function importarSemilla(semilla, extraible = false){
    const pkcs8 = concat(new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20]), semilla);
    return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, extraible, ['sign']);
  }

  return Object.freeze({
    FORMATO, V, TAM_MAX, PREFIJO_FIRMA, LIMITES, ERRORES,
    b64url, desdeB64url, hex, idDeClave, mensajeAFirmar,
    CLAVES_DATOS, versionDe, validarCarga, verificar, construirCarga, firmar, firmarBytes, emitir, nombreArchivo, importarSemilla, hoyLocal,
  });
})();
