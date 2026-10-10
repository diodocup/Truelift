// Utilidades de prueba del escritorio: carga los scripts clásicos en el
// mismo «realm» (como hace el navegador) y fabrica datos y ZIP sintéticos.
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';

const dir = new URL('../', import.meta.url);
const cargados = new Set();
export function cargar(...archivos){
  for (const a of archivos){
    if (cargados.has(a)) continue;
    const codigo = fs.readFileSync(new URL(a, dir), 'utf8');
    const nombre = { 'importar.js': 'ImportarJSON', 'zip-seguro.js': 'ZipSeguro',
                     'fotos.js': 'FotosTL', 'almacen.js': 'Almacen' }[a];
    vm.runInThisContext(`${codigo}\n;globalThis.${nombre} = ${nombre};`, { filename: a });
    cargados.add(a);
  }
  return globalThis;
}

// ---------- JSON sintético ----------
export function sesion(fecha, dia, entradas, extra = {}){
  return { fecha, dia, variante: 'hombre_doble', dias: '4', semana: 1,
           estadoCompuerta: 'verde', estadoSemaforo: 'verde', descarga: false,
           rendimiento: 'normal', rawSessionPct: 0, netDailyPerformancePct: 0,
           duracionMin: 60, entradas, ...extra };
}
export function entrada(ejercicio, kg, reps, rir, extra = {}){
  return { slot: 0, ejercicio, kg, reps, rir, obs: '', ...extra };
}
export function copiaSintetica({ dias = 6, desde = '2026-08-03', medidas = true, fotos = [] } = {}){
  const logs = [];
  const base = new Date(desde + 'T00:00:00Z');
  for (let i = 0; i < dias; i++){
    const d = new Date(+base + i * 3 * 86400000).toISOString().slice(0, 10);
    logs.push(sesion(`${d}T18:30:00.000`, i % 2 ? 'Día 2' : 'Día 1', [
      entrada('Press banca', 60 + i, [8, 8, 7], [2, 2, 1]),
      entrada('Dominadas', 0, [6, 5, null], [2, 1, null]),
    ]));
  }
  logs.push({ fecha: `${desde}T07:00:00.000`, tipo: 'cardio', nombre: 'Correr', duracion: 30, intensidad: 6 });
  const raw = {
    sexo: 'hombre', sistema: 'doble', dias: '4', unidadPeso: 'kg', pesoCorporal: 78,
    fechaNacimiento: '1990-05-01', fechaUltimaCopia: '2026-07-01',
    planMod: [{ id: 'linea_1', dia: 'Día 1', orden: 0, patron: 'Empuje horizontal', grupo: 'Pectoral',
                ejercicio: 'Press banca', series: 3, reps: '6-10', rir: '2' }],
    logs,
    readinessDiario: [{ fecha: desde, sueno: 3, animo: 4 }],
    nutricion: { schemaVersion: 3, pesajes: [{ fecha: desde, pesoKg: 78.4, enmascarado: false }] },
  };
  if (medidas) raw.medidas = { schemaVersion: 1,
    registros: [{ fecha: desde, sitio: 'cintura', cm: 84 }], fotos };
  return raw;
}

// ---------- ZIP sintético ----------
const tablaCrc = (() => { const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t; })();
export function crc32(b){ let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tablaCrc[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

/* archivos: [{ nombre, datos: Uint8Array|string, metodo?: 0|8, crcFalso?, realFalso? }] */
export function crearZip(archivos){
  const loc = [], cen = []; let off = 0;
  const u16 = v => Buffer.from([v & 255, (v >> 8) & 255]);
  const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
  for (const a of archivos){
    const datos = Buffer.from(typeof a.datos === 'string' ? Buffer.from(a.datos) : a.datos);
    const metodo = a.metodo ?? 8;
    const cmp = metodo === 8 ? zlib.deflateRawSync(datos) : datos;
    const nom = Buffer.from(a.nombre, 'utf8');
    const crc = a.crcFalso ?? crc32(datos);
    const real = a.realFalso ?? datos.length;
    const cab = Buffer.concat([u32(0x04034B50), u16(20), u16(0x0800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(cmp.length), u32(real), u16(nom.length), u16(0), nom]);
    loc.push(cab, cmp);
    cen.push(Buffer.concat([u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(metodo), u16(0), u16(0),
      u32(crc), u32(cmp.length), u32(real), u16(nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nom]));
    off += cab.length + cmp.length;
  }
  const dirC = Buffer.concat(cen);
  const fin = Buffer.concat([u32(0x06054B50), u16(0), u16(0), u16(archivos.length), u16(archivos.length),
    u32(dirC.length), u32(off), u16(0)]);
  return new Uint8Array(Buffer.concat([...loc, dirC, fin]));
}

// JPEG mínimo sintético (solo firma + relleno determinista): basta para
// la detección por firma; las pruebas de navegador usan JPEG reales.
export function jpegFalso(semilla, tam = 200){
  const b = new Uint8Array(tam);
  b[0] = 0xFF; b[1] = 0xD8; b[2] = 0xFF; b[3] = 0xE0;
  for (let i = 4; i < tam; i++) b[i] = (i * 31 + semilla * 17) & 255;
  return b;
}
