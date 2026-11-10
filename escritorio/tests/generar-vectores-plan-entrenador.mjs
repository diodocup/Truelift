// Genera los vectores dorados del plan de entrenador
// (CONTRATO_PLAN_ENTRENADOR.md §7) con la clave de PRUEBAS.
//
//   node escritorio/tests/generar-vectores-plan-entrenador.mjs [--comprobar]
//
// Escribe en escritorio/tests/fixtures/plan-entrenador/ los paquetes, la
// clave de pruebas y MANIFIESTO.json. Ed25519 es determinista, así que volver
// a generarlos da exactamente los mismos bytes: con --comprobar no escribe
// nada y falla si algún archivo en disco difiere de lo que se generaría.
//
// Los mismos archivos se copian tal cual a test/fixtures/plan_entrenador/ de
// App-PRO, que comprueba sus SHA-256 contra el manifiesto.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cargar } from './comun.mjs';

const { PaqueteEntrenador: P } = cargar('entrenador/paquete.js');
const DIR = new URL('./fixtures/plan-entrenador/', import.meta.url);
const HOY = '2026-11-10';
const comprobar = process.argv.includes('--comprobar');

// ---------- Claves de PRUEBAS (públicas a propósito) ----------
const semillaDe = texto => new Uint8Array(crypto.createHash('sha256').update(texto).digest());
async function parDesdeSemilla(semilla){
  const privada = await P.importarSemilla(semilla, true);
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', privada);
  const publica = P.desdeB64url(jwk.x);
  return { semilla, privada, publica, id: await P.idDeClave(publica) };
}
const pruebas = await parDesdeSemilla(semillaDe('truelift plan entrenador · clave de PRUEBAS · no usar en produccion'));
const otra = await parDesdeSemilla(semillaDe('truelift plan entrenador · OTRA clave de PRUEBAS · no usar en produccion'));

// ---------- Contenidos ----------
const fila = (patron, ejercicio, series, reps, rir, extra = {}) => ({ patron, ejercicio, series, reps, rir, ...extra });
const rutinaBase = () => ({
  nombre: 'Torso / Pierna',
  sistema: 'doble',
  dias: [
    { nombre: 'Torso 1', ejercicios: [
      fila('Empuje horizontal', 'Press banca con barra', 3, '6-8', '2', { descanso: 3 }),
      fila('Tirón horizontal', 'Remo con barra inclinado', 3, '8-10', '2'),
      fila('Empuje vertical', 'Press militar de pie con barra', 3, '8-10', '2'),
      fila('Tirón vertical', 'Dominada agarre prono', 3, '6-10', '2'),
    ] },
    { nombre: 'Pierna 1', ejercicios: [
      fila('Rodilla', 'Sentadilla con barra', 3, '6-8', '2', { descanso: 3 }),
      fila('Bisagra', 'Peso muerto rumano con barra', 3, '8-10', '2'),
      fila('Flexión de rodilla', 'Curl femoral tumbado', 3, '10-12', '1'),
      fila('Gemelo', 'Gemelo de pie', 3, '10-15', '1'),
    ] },
    { nombre: 'Torso 2', ejercicios: [
      fila('Empuje inclinado', 'Press inclinado con mancuernas', 3, '8-10', '2'),
      fila('Tirón horizontal', 'Remo Pendlay con barra', 3, '8-10', '2'),
      fila('Aislamiento', 'Elevación lateral en polea', 3, '12-15', '1'),
    ] },
    { nombre: 'Pierna 2', ejercicios: [
      fila('Rodilla', 'Prensa 45°', 3, '10-12', '2'),
      fila('Bisagra', 'Hiperextensión 45°', 3, '10-12', '2'),
      fila('Aislamiento', 'Extensión de cuádriceps', 3, '12-15', '1'),
    ] },
  ],
});
const rutinaModalidades = () => ({
  nombre: 'Full body con modalidades',
  sistema: 'simple',
  dias: [
    { nombre: 'Día A', ejercicios: [
      fila('Empuje horizontal', 'Press banca con barra', 4, '5-7', '2',
        { descanso: 3, topBack: true, backoffPct: 12, rirBack: '2' }),
      fila('Tirón horizontal', 'Remo en máquina Hammer TL', 3, '8-10', '2', { superserie: 1 }),
      fila('Empuje vertical', 'Press Arnold con mancuernas', 3, '8-10', '2', { superserie: 1 }),
      fila('Aislamiento', 'Curl en polea', 2, '10-12', '1', { dropSet: true, dropPct: 20 }),
    ] },
    { nombre: 'Día B', ejercicios: [
      fila('Rodilla', 'Sentadilla con barra', 3, '6-8', '2', { descanso: 2.5 }),
      fila('Aislamiento', 'Extensión de cuádriceps', 2, '12-15', '1', { restPause: true, pausaRpSeg: 15 }),
      fila('Core', 'Plancha con toalla TL', 3, '30-45', '2', { superserie: 0, topBack: false, dropSet: false, restPause: false }),
    ] },
  ],
  ejercicios: [
    { nombre: 'Remo en máquina Hammer TL', grupo: 'Espalda', patron: 'Tirón horizontal', secundarios: ['Bíceps'],
      prioridad: '', nota: 'Pecho apoyado en el respaldo.', descanso: '', porTiempo: false },
    { nombre: 'Plancha con toalla TL', grupo: 'Core', patron: 'Core', secundarios: [], prioridad: 'Importado',
      nota: '', descanso: '1', porTiempo: true },
  ],
});
const temporadaBase = () => ({ bloques: [
  { tipo: 'CUT', semanas: 12, tasaPctSemana: -0.5 },
  { tipo: 'BRIDGE', semanas: 4, tasaPctSemana: 0 },
  { tipo: 'BULK', semanas: 16, tasaPctSemana: 0.25 },
] });
const carga = (extra = {}) => ({
  id: 'pe_00000000-0000-4000-8000-000000000001',
  emitido: '2026-11-10',
  entrenador: { nombre: 'Entrenadora de pruebas' },
  cliente: { nombre: 'Cliente de pruebas' },
  nota: 'Plan de prueba: no es un plan real.',
  ...extra,
});

const enc = new TextEncoder();
const bytesDe = c => enc.encode(JSON.stringify(c));
const firmar = (c, par = pruebas, id = par.id) => P.firmarBytes(bytesDe(c), { clavePrivada: par.privada, idClave: id });
const sobre = (campos) => JSON.stringify({ formato: P.FORMATO, v: 1, ...campos }, null, 1) + '\n';

const vectores = [];
const v = (archivo, esperado, descripcion, texto) => vectores.push({ archivo, esperado, descripcion, texto });

// ---------- Válidos ----------
v('v01_solo_rutina.json', 'valido', 'Solo rutina', await firmar(carga({ rutina: rutinaBase() })));
v('v02_rutina_y_temporada.json', 'valido', 'Rutina y temporada, con caducidad lejana',
  await firmar(carga({ id: 'pe_00000000-0000-4000-8000-000000000002', caduca: '2099-12-31',
    rutina: rutinaBase(), temporada: temporadaBase() })));
v('v03_solo_temporada.json', 'valido', 'Solo temporada',
  await firmar(carga({ id: 'pe_00000000-0000-4000-8000-000000000003', nota: '', temporada: temporadaBase() })));
v('v04_modalidades_y_propios.json', 'valido', 'Cada modalidad y ejercicios propios',
  await firmar(carga({ id: 'pe_00000000-0000-4000-8000-000000000004', rutina: rutinaModalidades() })));
v('v05_revision.json', 'valido', 'Revisión del plan v01 (otro id, otra rutina, con temporada)',
  await firmar(carga({ id: 'pe_00000000-0000-4000-8000-000000000005', emitido: '2026-12-08',
    nota: 'Revisión: subimos una serie en los básicos.',
    rutina: (() => { const r = rutinaBase(); r.nombre = 'Torso / Pierna (revisión)';
      r.dias.forEach(d => { d.ejercicios[0].series = 4; }); return r; })(),
    temporada: { bloques: [{ tipo: 'BRIDGE', semanas: 2, tasaPctSemana: 0 }, { tipo: 'BULK', semanas: 12, tasaPctSemana: 0.25 }] } })));

// ---------- Sobre inválido ----------
const base = JSON.parse(await firmar(carga({ rutina: rutinaBase() })));
{
  const bytes = P.desdeB64url(base.carga);
  const i = bytes.indexOf(0x36); // primer «6» de la carga: cambia un dígito
  bytes[i] = 0x37;
  v('i01_byte_alterado.json', 'firmaInvalida', 'Un byte de la carga alterado', sobre({ clave: base.clave, carga: P.b64url(bytes), firma: base.firma }));
}
v('i02_firma_otra_clave.json', 'firmaInvalida', 'Firmado con otra clave pero declara la de pruebas',
  await firmar(carga({ rutina: rutinaBase() }), otra, pruebas.id));
v('i03_clave_desconocida.json', 'claveDesconocida', 'Firmado con una clave que la app no conoce',
  await firmar(carga({ rutina: rutinaBase() }), otra));
v('i04_firma_truncada.json', 'firmaInvalida', 'Firma truncada', sobre({ clave: base.clave, carga: base.carga, firma: base.firma.slice(0, 80) }));
v('i05_base64_mal_formado.json', 'firmaInvalida', 'Carga en base64 con relleno y caracteres ajenos',
  sobre({ clave: base.clave, carga: base.carga.slice(0, 40) + '+/' + base.carga.slice(42) + '==', firma: base.firma }));
v('i06_version_2.json', 'versionNoSoportada', 'Versión del sobre mayor que la soportada',
  JSON.stringify({ ...base, v: 2 }, null, 1) + '\n');
v('i07_formato_ajeno.json', 'noEsUnPlan', 'Otro formato', JSON.stringify({ ...base, formato: 'otra-cosa' }, null, 1) + '\n');
v('i08_copia_seguridad.json', 'esUnaCopia', 'Una copia de seguridad de la app',
  JSON.stringify({ sexo: 'hombre', sistema: 'doble', dias: '4', logs: [], fechaUltimaCopia: '2026-11-01' }, null, 1) + '\n');
v('i09_json_roto.json', 'noEsUnPlan', 'JSON roto', '{"formato": "truelift-plan-entrenador", "v": 1, "clave": \n');
v('i10_demasiado_grande.json', 'demasiadoGrande', 'Archivo de más de 256 KB',
  JSON.stringify({ ...base, relleno: 'x'.repeat(P.TAM_MAX) }) + '\n');

// ---------- Carga inválida (bien firmada) ----------
v('i11_caducado.json', 'caducado', 'Caducó antes de hoy',
  await firmar(carga({ emitido: '2025-12-01', caduca: '2026-01-01', rutina: rutinaBase() })));
const conRutina = mod => { const r = rutinaBase(); mod(r); return carga({ rutina: r }); };
v('i12_un_dia.json', 'contenidoInvalido', 'Un solo día', await firmar(conRutina(r => { r.dias = r.dias.slice(0, 1); })));
v('i13_seis_dias.json', 'contenidoInvalido', 'Seis días',
  await firmar(conRutina(r => { r.dias = [...r.dias, ...r.dias.slice(0, 2)].map((d, i) => ({ ...d, nombre: `Día ${i + 1}` })); })));
v('i14_once_ejercicios.json', 'contenidoInvalido', 'Once ejercicios en un día',
  await firmar(conRutina(r => { while (r.dias[0].ejercicios.length < 11) r.dias[0].ejercicios.push(fila('Aislamiento', 'Curl en polea', 2, '10-12', '1')); })));
v('i15_sistema_invalido.json', 'contenidoInvalido', 'Sistema de progresión inválido', await firmar(conRutina(r => { r.sistema = 'triple'; })));
v('i16_series_texto.json', 'contenidoInvalido', 'Series como texto', await firmar(conRutina(r => { r.dias[0].ejercicios[0].series = '3'; })));
const conTemporada = bloques => carga({ temporada: { bloques } });
v('i17_siete_bloques.json', 'contenidoInvalido', 'Siete bloques', await firmar(conTemporada(
  Array.from({ length: 7 }, (_, i) => i % 2 ? { tipo: 'BRIDGE', semanas: 2, tasaPctSemana: 0 } : { tipo: 'CUT', semanas: 4, tasaPctSemana: -0.5 }))));
v('i18_bloques_mismo_tipo.json', 'contenidoInvalido', 'Dos bloques seguidos del mismo tipo', await firmar(conTemporada([
  { tipo: 'CUT', semanas: 8, tasaPctSemana: -0.5 }, { tipo: 'CUT', semanas: 4, tasaPctSemana: -0.3 }])));
v('i19_tasa_signo.json', 'contenidoInvalido', 'Tasa con signo contrario al tipo', await firmar(conTemporada([
  { tipo: 'BULK', semanas: 8, tasaPctSemana: -0.25 }])));
v('i20_semanas_cero.json', 'contenidoInvalido', 'Bloque de cero semanas', await firmar(conTemporada([
  { tipo: 'CUT', semanas: 0, tasaPctSemana: -0.5 }])));
v('i21_horizonte_excesivo.json', 'contenidoInvalido', 'Más semanas en total que el horizonte máximo', await firmar(conTemporada([
  { tipo: 'CUT', semanas: 40, tasaPctSemana: -0.5 }, { tipo: 'BULK', semanas: 39, tasaPctSemana: 0.25 }])));
v('i22_sin_rutina_ni_temporada.json', 'contenidoInvalido', 'Ni rutina ni temporada', await firmar(carga()));

// ---------- Clave de pruebas ----------
const clave = JSON.stringify({
  aviso: 'CLAVE DE PRUEBAS. Es pública a propósito: solo firma los vectores dorados. Nunca debe figurar en lib/plan_entrenador/claves.dart.',
  id: pruebas.id,
  publica: P.b64url(pruebas.publica),
  semilla: P.b64url(pruebas.semilla),
  otraClave: { id: otra.id, publica: P.b64url(otra.publica) },
}, null, 2) + '\n';

// ---------- Manifiesto y escritura ----------
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const manifiesto = JSON.stringify({
  formato: 'truelift-plan-entrenador-vectores', v: 1,
  generador: 'escritorio/tests/generar-vectores-plan-entrenador.mjs',
  hoy: HOY,
  clavePruebas: 'CLAVE_PRUEBAS.json',
  archivos: [
    { archivo: 'CLAVE_PRUEBAS.json', sha256: sha(clave), esperado: null, descripcion: 'Clave de pruebas' },
    ...vectores.map(x => ({ archivo: x.archivo, sha256: sha(x.texto), esperado: x.esperado, descripcion: x.descripcion })),
  ],
}, null, 2) + '\n';

const salida = [['CLAVE_PRUEBAS.json', clave], ...vectores.map(x => [x.archivo, x.texto]), ['MANIFIESTO.json', manifiesto]];
if (comprobar){
  const distintos = salida.filter(([a, t]) => { try { return fs.readFileSync(new URL(a, DIR), 'utf8') !== t; } catch { return true; } });
  if (distintos.length){ console.error('Vectores desactualizados:', distintos.map(d => d[0]).join(', ')); process.exit(1); }
  console.log(`Vectores al día (${vectores.length}).`);
} else {
  fs.mkdirSync(DIR, { recursive: true });
  for (const [a, t] of salida) fs.writeFileSync(new URL(a, DIR), t);
  console.log(`Escritos ${vectores.length} vectores en ${DIR.pathname}`);
}
