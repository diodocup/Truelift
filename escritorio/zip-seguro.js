'use strict';
/* ================================================================
   TrueLift Escritorio — zip-seguro.js
   Lector de ZIP para el archivo de fotos que exporta la app.

   A diferencia de XLSX._unzip (pensado para un Excel generado por
   nosotros), aquí el archivo llega de fuera y puede ser enorme,
   estar dañado o ser malicioso:

   - Lee el directorio central con Blob.slice: no carga el ZIP entero.
   - Límites de nº de entradas, tamaño por entrada, total descomprimido
     y relación de compresión (bombas de descompresión).
   - Rutas inseguras (absolutas, «..», «\», caracteres de control) se
     marcan y nunca se extraen.
   - Descompresión en flujo con corte al superar el tamaño declarado.
   - Verifica el CRC-32 de cada entrada extraída.
   - Cancelable con AbortSignal.
   - Sin ZIP64 ni cifrado: la app nunca los produce (paquete Dart
     `archive`, DEFLATE, muy por debajo de 4 GiB).
   ================================================================ */

const ZipSeguro = {

  LIMITES: {
    bytesArchivo: 1024 * 1024 * 1024,        // 1 GiB comprimido
    entradas: 5000,
    bytesEntrada: 40 * 1024 * 1024,          // 40 MiB por archivo extraído
    bytesTotal: 2 * 1024 * 1024 * 1024,      // 2 GiB descomprimido en total
    ratio: 200,                              // descomprimido / comprimido
    bytesIndice: 16 * 1024 * 1024,           // medidas.json
  },

  _crcTabla: null,
  crc32(buf, crc = 0){
    if (!this._crcTabla){
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++){
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      this._crcTabla = t;
    }
    let c = (crc ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < buf.length; i++) c = this._crcTabla[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },

  error(codigo, mensaje){
    const e = new Error(mensaje);
    e.codigo = codigo;
    return e;
  },

  async _leer(blob, desde, hasta){
    return new Uint8Array(await blob.slice(desde, hasta).arrayBuffer());
  },

  /* Motivo por el que un nombre de entrada no es seguro, o null.
     Los nombres en subcarpetas no son inseguros, pero la app solo lee la
     raíz del ZIP: se informan aparte (ver `listar`). */
  rutaInsegura(nombre){
    if (!nombre) return 'nombre vacío';
    if (/[\u0000-\u001f\u007f]/.test(nombre)) return 'caracteres de control';
    if (nombre.includes('\\')) return 'barra invertida';
    if (nombre.startsWith('/') || /^[a-zA-Z]:/.test(nombre)) return 'ruta absoluta';
    if (nombre.split('/').some(s => s === '..')) return 'sale de la carpeta';
    if (nombre.length > 255) return 'nombre demasiado largo';
    return null;
  },

  /* Lee el directorio central. Devuelve { entradas[], problemas[] }.
     Lanza si el archivo no es un ZIP legible o supera los límites
     globales. Cada entrada: { nombre, metodo, cmp, real, crc, offset,
     flags, carpeta, insegura }. */
  async listar(blob){
    const L = this.LIMITES;
    const tam = blob.size;
    if (tam > L.bytesArchivo) throw this.error('grande', 'El ZIP supera el tamaño máximo admitido (1 GB).');
    if (tam < 22) throw this.error('corrupto', 'El archivo no es un ZIP válido.');

    // Fin de directorio central: últimos 22 bytes + comentario (≤ 65535).
    const ini = Math.max(0, tam - 22 - 65535);
    const cola = await this._leer(blob, ini, tam);
    const dvc = new DataView(cola.buffer, cola.byteOffset, cola.byteLength);
    let e = cola.length - 22;
    while (e >= 0 && dvc.getUint32(e, true) !== 0x06054B50) e--;
    if (e < 0) throw this.error('corrupto', 'El archivo no es un ZIP válido o está incompleto.');
    const disco = dvc.getUint16(e + 4, true);
    const nTotal = dvc.getUint16(e + 10, true);
    const tamDir = dvc.getUint32(e + 12, true);
    const offDir = dvc.getUint32(e + 16, true);
    if (disco !== 0) throw this.error('corrupto', 'Los ZIP divididos en varias partes no se admiten.');
    if (nTotal === 0xFFFF || offDir === 0xFFFFFFFF || tamDir === 0xFFFFFFFF)
      throw this.error('zip64', 'Este ZIP usa un formato extendido que la app no genera.');
    if (nTotal > L.entradas) throw this.error('entradas', `El ZIP tiene demasiados archivos (${nTotal}; máximo ${L.entradas}).`);
    if (offDir + tamDir > tam) throw this.error('corrupto', 'El ZIP está dañado (directorio fuera del archivo).');

    const dir = await this._leer(blob, offDir, offDir + tamDir);
    const dv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    const dec = new TextDecoder('utf-8', { fatal: false });
    const entradas = [], problemas = [];
    let p = 0, declaradoTotal = 0;
    for (let i = 0; i < nTotal; i++){
      if (p + 46 > dir.length || dv.getUint32(p, true) !== 0x02014B50)
        throw this.error('corrupto', 'El ZIP está dañado (directorio central ilegible).');
      const flags = dv.getUint16(p + 8, true);
      const metodo = dv.getUint16(p + 10, true);
      const crc = dv.getUint32(p + 16, true);
      const cmp = dv.getUint32(p + 20, true);
      const real = dv.getUint32(p + 24, true);
      const nomLen = dv.getUint16(p + 28, true);
      const extLen = dv.getUint16(p + 30, true);
      const comLen = dv.getUint16(p + 32, true);
      const offset = dv.getUint32(p + 42, true);
      if (p + 46 + nomLen > dir.length) throw this.error('corrupto', 'El ZIP está dañado.');
      const nombre = dec.decode(dir.subarray(p + 46, p + 46 + nomLen));
      p += 46 + nomLen + extLen + comLen;

      const ent = { nombre, metodo, cmp, real, crc, offset, flags,
                    carpeta: nombre.endsWith('/'), insegura: this.rutaInsegura(nombre) };
      if (ent.carpeta) continue;
      if (ent.insegura){ problemas.push({ nombre, motivo: `ruta no segura (${ent.insegura})` }); continue; }
      if (cmp === 0xFFFFFFFF || real === 0xFFFFFFFF || offset === 0xFFFFFFFF){
        problemas.push({ nombre, motivo: 'formato extendido no admitido' }); continue;
      }
      if (flags & 1){ problemas.push({ nombre, motivo: 'cifrado' }); continue; }
      if (metodo !== 0 && metodo !== 8){ problemas.push({ nombre, motivo: `compresión no admitida (${metodo})` }); continue; }
      if (real > L.bytesEntrada){ problemas.push({ nombre, motivo: 'demasiado grande' }); continue; }
      if (cmp > 0 && real / cmp > L.ratio){ problemas.push({ nombre, motivo: 'compresión sospechosa' }); continue; }
      if (metodo === 0 && cmp !== real){ problemas.push({ nombre, motivo: 'tamaños incoherentes' }); continue; }
      if (offset + 30 + cmp > tam){ problemas.push({ nombre, motivo: 'datos fuera del archivo' }); continue; }
      declaradoTotal += real;
      entradas.push(ent);
    }
    if (declaradoTotal > L.bytesTotal)
      throw this.error('grande', 'El contenido descomprimido del ZIP supera el máximo admitido.');
    return { entradas, problemas, bytesDeclarados: declaradoTotal };
  },

  /* Extrae una entrada → Uint8Array. Verifica tamaño y CRC. */
  async extraer(blob, ent, { signal = null } = {}){
    if (signal && signal.aborted) throw this.error('cancelado', 'Cancelado.');
    const cab = await this._leer(blob, ent.offset, ent.offset + 30);
    const dv = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
    if (cab.length < 30 || dv.getUint32(0, true) !== 0x04034B50)
      throw this.error('corrupto', 'cabecera local dañada');
    const ini = ent.offset + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
    if (ini + ent.cmp > blob.size) throw this.error('corrupto', 'datos incompletos');
    const trozo = blob.slice(ini, ini + ent.cmp);

    let datos;
    if (ent.metodo === 0){
      datos = new Uint8Array(await trozo.arrayBuffer());
    } else {
      if (typeof DecompressionStream === 'undefined')
        throw this.error('soporte', 'Este navegador no puede descomprimir ZIP. Usa una versión reciente de Chrome, Edge, Firefox o Safari.');
      const lector = trozo.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const partes = [];
      let total = 0;
      try {
        for (;;){
          if (signal && signal.aborted) throw this.error('cancelado', 'Cancelado.');
          const { done, value } = await lector.read();
          if (done) break;
          total += value.length;
          // Nunca más de lo declarado: corta las bombas antes de llenar memoria.
          if (total > ent.real) throw this.error('corrupto', 'tamaño real distinto del declarado');
          partes.push(value);
        }
      } catch (e) {
        try { await lector.cancel(); } catch (_) { /* ya cerrado */ }
        if (e && e.codigo) throw e;
        throw this.error('corrupto', 'datos comprimidos dañados');
      }
      datos = new Uint8Array(total);
      let o = 0;
      for (const p of partes){ datos.set(p, o); o += p.length; }
    }
    if (datos.length !== ent.real) throw this.error('corrupto', 'tamaño real distinto del declarado');
    if (this.crc32(datos) !== ent.crc) throw this.error('corrupto', 'el contenido no supera la comprobación de integridad');
    return datos;
  },
};
