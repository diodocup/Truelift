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

  // Biblioteca embebida por la app TrueLift en la hoja «Listas» (zona
  // reservada que no interfiere con validaciones ni estilos). Debe
  // coincidir con rutina_excel.dart / rutina_screen.dart de la app:
  //   marca en W101; datos desde la fila 102, columnas
  //   W nombre · X grupo · Y patrón · Z secundarios(JSON) ·
  //   AA prioridad · AB nota · AC descanso.
  MARCA_BIBLIOTECA: 'TRUELIFT_EXERCISES_V1',
  FILA_BIBLIOTECA: 101,
  COLS_BIBLIOTECA: ['W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'],

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

  /* Comprime con DEFLATE crudo (método 8) usando la API nativa del navegador,
     la misma familia que _unzip usa para leer. Devuelve null si no hay soporte
     (entonces _zip recurre a STORE para ese archivo). */
  async _deflateRaw(data){
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('deflate-raw');
    const resp = new Response(new Blob([data]).stream().pipeThrough(cs));
    return new Uint8Array(await resp.arrayBuffer());
  },

  /* Empaqueta {nombre → Uint8Array} en un zip. Usa DEFLATE (método 8), igual
     que los .xlsx que genera la app TrueLift: su importador (paquete «excel»)
     espera esa compresión; los archivos STORE le hacían fallar con
     «Damaged Excel file: styles». Async por la compresión nativa. */
  async _zip(files){
    const enc = new TextEncoder();
    const locals = [], centrals = [];
    let offset = 0;
    const u16 = v => [v & 255, (v >> 8) & 255];
    const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];

    for (const [name, data] of Object.entries(files)){
      const nameB = enc.encode(name);
      const crc = this._crc32(data);            // CRC-32 siempre sobre el original
      let contenido = await this._deflateRaw(data);
      let metodo = 8;
      if (!contenido){ contenido = data; metodo = 0; } // sin soporte: STORE
      const head = new Uint8Array([
        0x50,0x4B,0x03,0x04, ...u16(20), ...u16(0x0800), ...u16(metodo),
        ...u16(0), ...u16(0x21),                       // hora/fecha fijas
        ...u32(crc), ...u32(contenido.length), ...u32(data.length),
        ...u16(nameB.length), ...u16(0),
      ]);
      locals.push(head, nameB, contenido);
      centrals.push(new Uint8Array([
        0x50,0x4B,0x01,0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(metodo),
        ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(contenido.length), ...u32(data.length),
        ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ]), nameB);
      offset += head.length + nameB.length + contenido.length;
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

  /* Castellano canónico de un valor leído del Excel. La app exporta
     traducido cuando el móvil está en inglés (hojas «Day 1..5»,
     ejercicios y grupos en inglés); esto replica I18n.canonical de la
     app usando el mapa generado en canonico.js. Tolera que el script
     no esté cargado (p. ej. en pruebas). */
  _canon(v){
    const s = String(v ?? '').trim();
    if (typeof CANON_ES !== 'undefined' && CANON_ES[s]) return CANON_ES[s];
    return s;
  },

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

  /* Lee la biblioteca embebida (TRUELIFT_EXERCISES_V1) del mapa de celdas de
     la hoja «Listas». Devuelve [] si el archivo no la incluye (plantillas
     creadas fuera de la app o versiones antiguas). Formato de cada registro:
     { nombre, grupo, patron, secundarios:[], prioridad, nota, descanso }. */
  _leerBiblioteca(celdas){
    const [cNom, cGru, cPat, cSec, cPri, cNot, cDes] = this.COLS_BIBLIOTECA;
    const fila = this.FILA_BIBLIOTECA;
    if (String(celdas.get(cNom + fila) ?? '').trim() !== this.MARCA_BIBLIOTECA)
      return [];
    const out = [];
    for (let r = fila + 1; r < fila + 10000; r++){
      const nombre = String(celdas.get(cNom + r) ?? '').trim();
      if (!nombre) break;
      let secundarios = [];
      const raw = celdas.get(cSec + r);
      if (raw != null){
        try {
          const d = JSON.parse(raw);
          if (Array.isArray(d))
            secundarios = d.map(x => String(x).trim()).filter(Boolean);
        } catch (_){ /* bloque parcial: no impide leer el resto */ }
      }
      out.push({
        nombre: this._canon(nombre),
        grupo: this._canon(celdas.get(cGru + r)),
        patron: this._canon(celdas.get(cPat + r)),
        secundarios: secundarios.map(s => this._canon(s)),
        prioridad: this._canon(celdas.get(cPri + r)),
        nota: this._canon(celdas.get(cNot + r)),
        descanso: this._canon(celdas.get(cDes + r)),
      });
    }
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

    // Sistema (Instrucciones/Instructions B3; la app exporta en inglés
    // cuando el móvil está en ese idioma)
    let sistema = 'doble';
    const hojaInstr = hojas.get('Instrucciones') ?? hojas.get('Instructions');
    const instr = hojaInstr ? leer(hojaInstr) : null;
    if (instr){
      const v = this._celdas(instr, shared).get('B3');
      if (typeof v === 'string' && /simple/i.test(v)) sistema = 'simple';
    }

    // Hojas Día 1..5 (o Day 1..5 en exportaciones en inglés)
    const dias = [];
    for (let d = 1; d <= this.MAX_DIAS; d++){
      const rutaHoja = hojas.get(`Día ${d}`) ?? hojas.get(`Day ${d}`);
      if (!rutaHoja) continue;
      const doc = leer(rutaHoja);
      if (!doc) continue;
      const celdas = this._celdas(doc, shared);
      const filas = [];
      for (let r = 4; r < 4 + this.MAX_FILAS; r++){
        const g = col => celdas.get(col + r);
        const patron = this._canon(g('A'));
        const ejercicio = this._canon(g('B'));
        if (!patron || patron === '(Ninguno)' || patron === '(None)' || !ejercicio) continue;
        const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        filas.push({
          patron, ejercicio,
          series: num(g('C')), rir: num(g('D')),
          repsMin: num(g('E')), repsMax: num(g('F')),
          descanso: num(g('G')),
          // «sí» (es), «yes» (en), «sim» (pt) o 1; igual que la app (s/y/1)
          topBack: /^\s*(s|y|1)/i.test(String(g('H') ?? '')),
          backoffPct: num(g('I')), rirBack: num(g('J')),
        });
      }
      const nombreDia = `Día ${d}`;
      if (filas.length || celdas.get('B1'))
        dias.push({ nombre: this._canon(celdas.get('B1')) || nombreDia, filas });
    }

    const conFilas = dias.filter(d => d.filas.length);
    if (!conFilas.length)
      throw new Error('El Excel no contiene ejercicios en las hojas Día 1–5. ¿Es la plantilla de TrueLift?');

    // Biblioteca embebida por la app (opcional): permite recuperar los
    // ejercicios personalizados del cliente con sus metadatos.
    let biblioteca = [];
    const nomListas = hojas.has('Listas') ? 'Listas'
                    : (hojas.has('Lists') ? 'Lists' : null);
    if (nomListas){
      const docL = leer(hojas.get(nomListas));
      if (docL) biblioteca = this._leerBiblioteca(this._celdas(docL, shared));
    }

    return { sistema, dias: conFilas, biblioteca };
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

  /* Celda de texto SIN estilo, tal y como escribe la app en el bloque de
     biblioteca (rutina_screen.dart · _celdaInline). */
  _celdaBiblioteca(ref, valor){
    return `<x:c r="${ref}" t="inlineStr"><x:is><x:t xml:space="preserve">${this._escXml(valor)}</x:t></x:is></x:c>`;
  },

  /* Sustituye el bloque privado de la hoja «Listas». La plantilla anterior del
     Coach contenía en W101:AC todo el catálogo base y la app lo interpretaba
     como ejercicios creados por el usuario. Se conservan únicamente las filas
     1..100 y se escribe la marca más los personalizados relevantes. */
  _reemplazarBiblioteca(xmlHoja, ejercicios){
    const ini = xmlHoja.indexOf('<x:sheetData>');
    const fin = xmlHoja.indexOf('</x:sheetData>');
    if (ini < 0 || fin < 0)
      throw new Error('Plantilla embebida corrupta (Listas/sheetData).');
    const interior = xmlHoja.slice(ini + '<x:sheetData>'.length, fin);
    const filasBase = [];
    const reFila = /<x:row\b(?=[^>]*\br="(\d+)")[^>]*(?:\/>|>[\s\S]*?<\/x:row>)/g;
    let coincidencia;
    while ((coincidencia = reFila.exec(interior))){
      if (parseInt(coincidencia[1], 10) < this.FILA_BIBLIOTECA)
        filasBase.push(coincidencia[0]);
    }

    const [cNom, cGru, cPat, cSec, cPri, cNot, cDes] = this.COLS_BIBLIOTECA;
    const marca = this.FILA_BIBLIOTECA;
    const filas = [...filasBase,
      `<x:row r="${marca}">${this._celdaBiblioteca(cNom + marca, this.MARCA_BIBLIOTECA)}</x:row>`];
    let r = marca + 1;
    const vistos = new Set();
    for (const e of (Array.isArray(ejercicios) ? ejercicios : [])){
      const nombre = String(e.nombre ?? '').trim();
      const clave = nombre.toLocaleLowerCase('es').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!nombre || vistos.has(clave)) continue;
      vistos.add(clave);
      const sec = Array.isArray(e.secundarios) && e.secundarios.length
        ? e.secundarios.filter(Boolean)
        : [e.grupo2, e.grupo3].filter(Boolean);
      let celdas = this._celdaBiblioteca(cNom + r, nombre)
                 + this._celdaBiblioteca(cGru + r, String(e.grupo ?? ''))
                 + this._celdaBiblioteca(cPat + r, String(e.patron ?? ''))
                 + this._celdaBiblioteca(cSec + r, JSON.stringify(sec))
                 + this._celdaBiblioteca(cPri + r, String(e.prioridad ?? ''))
                 + this._celdaBiblioteca(cNot + r, String(e.nota ?? ''))
                 + this._celdaBiblioteca(cDes + r, String(e.descanso ?? ''));
      filas.push(`<x:row r="${r}">${celdas}</x:row>`);
      r++;
    }
    let salida = xmlHoja.slice(0, ini + '<x:sheetData>'.length)
      + filas.join('') + xmlHoja.slice(fin);
    salida = salida.replace(/(<x:dimension\b[^>]*\bref=")[^"]*(")/,
      `$1A1:AC${r - 1}$2`);
    return salida;
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
  async escribirRutina(rutina){
    const enc = new TextEncoder();
    const dec = new TextDecoder('utf-8');
    const files = {};
    for (const [nombre, b64] of Object.entries(PLANTILLA_XLSX))
      files[nombre] = this._b64aBytes(b64);

    // Los Target del rels de la plantilla son absolutos ("/xl/styles.xml").
    // El importador de la app (paquete «excel» de Dart) resuelve cada ruta
    // como 'xl/' + Target, así que con rutas absolutas no encuentra los
    // estilos y falla con «Damage Excel file: styles». Se normalizan a
    // relativos, la forma estándar que aceptan Excel y todos los lectores.
    {
      const ruta = 'xl/_rels/workbook.xml.rels';
      if (files[ruta]){
        const xml = dec.decode(files[ruta]).replaceAll('Target="/xl/', 'Target="');
        files[ruta] = enc.encode(xml);
      }
    }

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

    // Listas: el contrato exige siempre una única marca en W101; aunque no
    // haya personalizados se limpia cualquier bloque heredado de la plantilla.
    {
      const rutaListas = this._rutaHoja(files, dec, 'Listas')
                      || this._rutaHoja(files, dec, 'Lists');
      if (rutaListas && files[rutaListas]){
        const xml = this._reemplazarBiblioteca(
          dec.decode(files[rutaListas]), rutina.biblioteca || []);
        files[rutaListas] = enc.encode(xml);
      }
    }

    return await this._zip(files);
  },

  /* Resuelve el nombre de una hoja → ruta del worksheet dentro del zip,
     leyendo workbook.xml y sus relaciones (sin depender del orden). */
  _rutaHoja(files, dec, nombreHoja){
    const wb = files['xl/workbook.xml'];
    const rels = files['xl/_rels/workbook.xml.rels'];
    if (!wb || !rels) return null;
    const wbTxt = dec.decode(wb), relsTxt = dec.decode(rels);
    const destino = {};
    for (const m of relsTxt.matchAll(/<Relationship\b[^>]*>/g)){
      const id = /Id="([^"]+)"/.exec(m[0])?.[1];
      const tgt = /Target="([^"]+)"/.exec(m[0])?.[1];
      if (id && tgt) destino[id] = tgt;
    }
    for (const m of wbTxt.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*\/?>/g)){
      const name = /name="([^"]*)"/.exec(m[0])?.[1];
      if (name !== nombreHoja) continue;
      const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
      let tgt = rid ? destino[rid] : null;
      if (!tgt) return null;
      tgt = tgt.replace(/^\//, '');
      if (!tgt.startsWith('xl/')) tgt = 'xl/' + tgt;
      return tgt;
    }
    return null;
  },

  /* Descarga la rutina como archivo xlsx. */
  async descargar(rutina, nombreArchivo){
    const bytes = await this.escribirRutina(rutina);
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
