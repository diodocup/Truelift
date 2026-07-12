'use strict';
/* ================================================================
   TrueLift Coach — xlsx.js
   Lectura y escritura del Excel de rutina de TrueLift
   (mi_rutina_truelift.xlsx) sin dependencias externas.

   - Lectura: unzip propio (STORE y DEFLATE vía DecompressionStream,
     disponible en Chrome/Edge) + DOMParser. Tolera archivos
     reguardados por Excel/LibreOffice (sharedStrings, otros estilos).
   - Escritura: parchea las hojas de la plantilla embebida
     (plantilla.js) y re-empaqueta en zip STORE. El resultado conserva
     validaciones, rangos con nombre y estilos de la plantilla oficial,
     por lo que es importable en la app TrueLift y editable en Excel.

   Modelo de rutina usado por el planificador:
   { sistema: 'simple'|'doble',
     dias: [ { nombre, filas: [ { patron, ejercicio, series, rir,
               repsMin, repsMax, descanso, topBack, backoffPct,
               rirBack } ] } ] }
   ================================================================ */

const XLSX = {

  MAX_FILAS: 10,   // filas 4..13 de cada hoja Día
  MAX_DIAS: 5,

  // ============================ ZIP ============================

  _crcTable: (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++){
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })(),

  _crc32(buf){
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++)
      c = this._crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },

  /* Empaqueta {nombre → Uint8Array} en un zip sin compresión (STORE). */
  _zip(files){
    const enc = new TextEncoder();
    const locals = [], centrals = [];
    let offset = 0;
    const u16 = v => [v & 255, (v >> 8) & 255];
    const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];

    for (const [name, data] of Object.entries(files)){
      const nameB = enc.encode(name);
      const crc = this._crc32(data);
      const head = new Uint8Array([
        0x50,0x4B,0x03,0x04, ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0x21),                       // hora/fecha fijas
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameB.length), ...u16(0),
      ]);
      locals.push(head, nameB, data);
      centrals.push(new Uint8Array([
        0x50,0x4B,0x01,0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ]), nameB);
      offset += head.length + nameB.length + data.length;
    }
    const cdStart = offset;
    let cdLen = 0;
    centrals.forEach(b => cdLen += b.length);
    const n = Object.keys(files).length;
    const eocd = new Uint8Array([
      0x50,0x4B,0x05,0x06, ...u16(0), ...u16(0), ...u16(n), ...u16(n),
      ...u32(cdLen), ...u32(cdStart), ...u16(0),
    ]);
    const total = offset + cdLen + eocd.length;
    const out = new Uint8Array(total);
    let p = 0;
    [...locals, ...centrals, eocd].forEach(b => { out.set(b, p); p += b.length; });
    return out;
  },

  /* Descomprime un zip → Map(nombre → Uint8Array). Async por DEFLATE. */
  async _unzip(buf){
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    // EOCD: buscar firma desde el final
    let e = buf.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054B50) e--;
    if (e < 0) throw new Error('No es un archivo zip/xlsx válido.');
    const nEntradas = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);          // inicio del directorio central
    const dec = new TextDecoder();
    const out = new Map();
    for (let i = 0; i < nEntradas; i++){
      if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('Zip corrupto.');
      const metodo = dv.getUint16(p + 10, true);
      const tamCmp = dv.getUint32(p + 20, true);
      const nomLen = dv.getUint16(p + 28, true);
      const extLen = dv.getUint16(p + 30, true);
      const comLen = dv.getUint16(p + 32, true);
      const lhOff = dv.getUint32(p + 42, true);
      const nombre = dec.decode(buf.subarray(p + 46, p + 46 + nomLen));
      // cabecera local: nombre/extra pueden diferir en longitud
      const lNomLen = dv.getUint16(lhOff + 26, true);
      const lExtLen = dv.getUint16(lhOff + 28, true);
      const dataOff = lhOff + 30 + lNomLen + lExtLen;
      const datos = buf.subarray(dataOff, dataOff + tamCmp);
      if (metodo === 0){
        out.set(nombre, datos);
      } else if (metodo === 8){
        if (typeof DecompressionStream === 'undefined')
          throw new Error('Este navegador no soporta descompresión (usa Chrome o Edge).');
        const ds = new DecompressionStream('deflate-raw');
        const resp = new Response(new Blob([datos]).stream().pipeThrough(ds));
        out.set(nombre, new Uint8Array(await resp.arrayBuffer()));
      } else {
        throw new Error(`Método de compresión no soportado (${metodo}).`);
      }
      p += 46 + nomLen + extLen + comLen;
    }
    return out;
  },

  // ====================== LECTURA DE RUTINA ======================

  _xml(bytes){
    let texto = new TextDecoder('utf-8').decode(bytes);
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML ilegible en el xlsx.');
    return doc;
  },

  _hijos(el, nombre){
    return [...el.children].filter(c => c.localName === nombre);
  },
  _busca(el, nombre){
    return [...el.getElementsByTagName('*')].filter(c => c.localName === nombre);
  },

  /* Valor de una celda <c> según su tipo (inlineStr, s, str, n). */
  _valorCelda(c, shared){
    const t = c.getAttribute('t');
    if (t === 'inlineStr'){
      const is = this._busca(c, 'is')[0];
      return is ? is.textContent : '';
    }
    const v = this._busca(c, 'v')[0];
    if (!v) return null;
    if (t === 's') return shared[parseInt(v.textContent, 10)] ?? '';
    if (t === 'str' || t === 'b') return v.textContent;
    const n = parseFloat(v.textContent);
    return isNaN(n) ? v.textContent : n;
  },

  /* Mapa "A4" → valor de una hoja. */
  _celdas(doc, shared){
    const out = new Map();
    this._busca(doc.documentElement, 'c').forEach(c => {
      const r = c.getAttribute('r');
      if (!r) return;
      const v = this._valorCelda(c, shared);
      if (v !== null && v !== '') out.set(r, v);
    });
    return out;
  },

  /* Lee un archivo .xlsx (ArrayBuffer) → modelo de rutina.
     Lanza Error con mensaje en castellano si no es una plantilla válida. */
  async leerRutina(arrayBuffer){
    const files = await this._unzip(new Uint8Array(arrayBuffer));
    const leer = nombre => {
      const b = files.get(nombre) || files.get('/' + nombre);
      return b ? this._xml(b) : null;
    };

    const wb = leer('xl/workbook.xml');
    if (!wb) throw new Error('El archivo no contiene xl/workbook.xml: no es un xlsx.');

    // sharedStrings (por si el archivo fue reguardado con Excel)
    let shared = [];
    const ssDoc = leer('xl/sharedStrings.xml');
    if (ssDoc) shared = this._busca(ssDoc.documentElement, 'si').map(si => si.textContent);

    // nombre de hoja → archivo, vía rels
    const rels = leer('xl/_rels/workbook.xml.rels');
    const relMap = new Map();
    if (rels) this._busca(rels.documentElement, 'Relationship').forEach(r =>
      relMap.set(r.getAttribute('Id'), r.getAttribute('Target')));
    const hojas = new Map();
    this._busca(wb.documentElement, 'sheet').forEach(s => {
      const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
               || s.getAttribute('r:id');
      let target = relMap.get(rid) || '';
      target = target.replace(/^\//, '');
      if (target && !target.startsWith('xl/')) target = 'xl/' + target;
      hojas.set(s.getAttribute('name'), target);
    });

    // Sistema (Instrucciones B3)
    let sistema = 'doble';
    const instr = hojas.has('Instrucciones') ? leer(hojas.get('Instrucciones')) : null;
    if (instr){
      const v = this._celdas(instr, shared).get('B3');
      if (typeof v === 'string' && /simple/i.test(v)) sistema = 'simple';
    }

    // Hojas Día 1..5
    const dias = [];
    for (let d = 1; d <= this.MAX_DIAS; d++){
      const nombreHoja = `Día ${d}`;
      if (!hojas.has(nombreHoja)) continue;
      const doc = leer(hojas.get(nombreHoja));
      if (!doc) continue;
      const celdas = this._celdas(doc, shared);
      const filas = [];
      for (let r = 4; r < 4 + this.MAX_FILAS; r++){
        const g = col => celdas.get(col + r);
        const patron = String(g('A') ?? '').trim();
        const ejercicio = String(g('B') ?? '').trim();
        if (!patron || patron === '(Ninguno)' || !ejercicio) continue;
        const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        filas.push({
          patron, ejercicio,
          series: num(g('C')), rir: num(g('D')),
          repsMin: num(g('E')), repsMax: num(g('F')),
          descanso: num(g('G')),
          topBack: /^s[ií]/i.test(String(g('H') ?? '')),
          backoffPct: num(g('I')), rirBack: num(g('J')),
        });
      }
      if (filas.length || celdas.get('B1'))
        dias.push({ nombre: String(celdas.get('B1') ?? nombreHoja).trim() || nombreHoja, filas });
    }

    const conFilas = dias.filter(d => d.filas.length);
    if (!conFilas.length)
      throw new Error('El Excel no contiene ejercicios en las hojas Día 1–5. ¿Es la plantilla de TrueLift?');
    return { sistema, dias: conFilas };
  },

  // ===================== ESCRITURA DE RUTINA =====================

  _escXml(s){
    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  },

  _celdaTexto(ref, estilo, valor){
    return `<x:c r="${ref}" s="${estilo}" t="inlineStr"><x:is><x:t xml:space="preserve">${this._escXml(valor)}</x:t></x:is></x:c>`;
  },
  _celdaNum(ref, estilo, valor){
    return `<x:c r="${ref}" s="${estilo}"><x:v>${valor}</x:v></x:c>`;
  },

  /* Regenera el <x:sheetData> de una hoja Día con el contenido dado. */
  _sheetDataDia(nombreDia, filas, sistema){
    const CAB = ['Patrón','Ejercicio','Series','RIR','Reps mín / objetivo',
                 'Reps máx (solo doble)','Descanso (min)','Top+Back (sí/no)','% back-off','RIR back'];
    const COLS = ['A','B','C','D','E','F','G','H','I','J'];
    let xml = `<x:row r="1">${this._celdaTexto('A1', 2, 'Nombre del día/sesión:')}${this._celdaTexto('B1', 3, nombreDia)}</x:row>`;
    xml += `<x:row r="3">${CAB.map((t, i) => this._celdaTexto(COLS[i] + 3, 4, t)).join('')}</x:row>`;
    for (let i = 0; i < this.MAX_FILAS; i++){
      const r = 4 + i, f = filas[i];
      if (!f){ xml += `<x:row r="${r}" />`; continue; }
      let c = this._celdaTexto('A' + r, 5, f.patron)
            + this._celdaTexto('B' + r, 5, f.ejercicio);
      const n = (col, v) => { if (v != null && !isNaN(v)) c += this._celdaNum(col + r, 5, v); };
      n('C', f.series); n('D', f.rir); n('E', f.repsMin);
      if (sistema === 'doble') n('F', f.repsMax);
      n('G', f.descanso);
      if (f.topBack){
        c += this._celdaTexto('H' + r, 5, 'sí');
        n('I', f.backoffPct); n('J', f.rirBack);
      }
      xml += `<x:row r="${r}">${c}</x:row>`;
    }
    return xml;
  },

  _reemplazaSheetData(xmlHoja, nuevoInterior){
    const ini = xmlHoja.indexOf('<x:sheetData>');
    const fin = xmlHoja.indexOf('</x:sheetData>');
    if (ini < 0 || fin < 0) throw new Error('Plantilla embebida corrupta (sheetData).');
    return xmlHoja.slice(0, ini + '<x:sheetData>'.length) + nuevoInterior + xmlHoja.slice(fin);
  },

  _b64aBytes(b64){
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  /* Genera el xlsx (Uint8Array) a partir del modelo de rutina,
     parcheando la plantilla oficial embebida. */
  escribirRutina(rutina){
    const enc = new TextEncoder();
    const dec = new TextDecoder('utf-8');
    const files = {};
    for (const [nombre, b64] of Object.entries(PLANTILLA_XLSX))
      files[nombre] = this._b64aBytes(b64);

    // Instrucciones (sheet1): sistema en B3
    {
      let xml = dec.decode(files['xl/worksheets/sheet1.xml']);
      xml = xml.replace(
        /(<x:c r="B3"[^>]*>\s*<x:is>\s*<x:t[^>]*>)[^<]*(<\/x:t>)/,
        `$1${rutina.sistema === 'simple' ? 'simple' : 'doble'}$2`);
      files['xl/worksheets/sheet1.xml'] = enc.encode(xml);
    }

    // Día 1..5 (sheet2..6)
    for (let d = 0; d < this.MAX_DIAS; d++){
      const entrada = `xl/worksheets/sheet${d + 2}.xml`;
      const dia = rutina.dias[d];
      const interior = this._sheetDataDia(
        dia ? dia.nombre : `Día ${d + 1}`,
        dia ? dia.filas : [],
        rutina.sistema);
      const xml = this._reemplazaSheetData(dec.decode(files[entrada]), interior);
      files[entrada] = enc.encode(xml);
    }

    return this._zip(files);
  },

  /* Descarga la rutina como archivo xlsx. */
  descargar(rutina, nombreArchivo){
    const bytes = this.escribirRutina(rutina);
    const blob = new Blob([bytes],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo || 'mi_rutina_truelift.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // ============ CONVERSIÓN planMod (JSON TrueLift) → modelo ============

  /* planMod: [{dia, orden, patron, grupo, ejercicio, series, reps, rir,
     descansoMin, topBack, backoffPct, rirBack}] */
  desdePlanMod(planMod, sistema){
    const dias = [];
    const porDia = new Map();
    (planMod || []).forEach(p => {
      const d = p.dia ?? '—';
      if (!porDia.has(d)){ porDia.set(d, []); dias.push(d); }
      porDia.get(d).push(p);
    });
    const parseReps = reps => {
      const m = String(reps ?? '').match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
      if (!m) return { repsMin: null, repsMax: null };
      return { repsMin: parseInt(m[1], 10), repsMax: m[2] ? parseInt(m[2], 10) : null };
    };
    return {
      sistema: sistema === 'simple' ? 'simple' : 'doble',
      dias: dias.slice(0, this.MAX_DIAS).map(d => ({
        nombre: d,
        filas: porDia.get(d)
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          .slice(0, this.MAX_FILAS)
          .map(p => {
            const { repsMin, repsMax } = parseReps(p.reps);
            const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
            return {
              patron: p.patron ?? '', ejercicio: p.ejercicio ?? '',
              series: num(p.series), rir: num(p.rir),
              repsMin, repsMax,
              descanso: num(p.descansoMin),
              topBack: p.topBack === true,
              backoffPct: num(p.backoffPct), rirBack: num(p.rirBack),
            };
          }),
      })),
    };
  },
};
