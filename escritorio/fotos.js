'use strict';
/* ================================================================
   TrueLift Escritorio — fotos.js
   Asociación de las imágenes del ZIP de fotos con su ficha (fecha,
   pose, peso) y plan de importación. Sin DOM: se prueba en Node.

   Prioridad de la ficha (CONTRATO_DATOS.md §5):
     1. índice `medidas.fotos` de la copia JSON vigente (estado del
        móvil, con sus correcciones de fecha y pose);
     2. `medidas.json` dentro del ZIP, para lo que la copia no conoce;
     3. el nombre, solo con el patrón EXACTO del móvil
        (fichaDesdeNombreFoto en lib/medidas/modelos.dart).
   La ficha se resuelve al LEER, no se congela al importar: una copia
   JSON nueva corrige fechas y poses sin tocar las imágenes.
   Depende de ImportarJSON (importar.js) para fechas y nombres.
   ================================================================ */

const FotosTL = {

  INDICE: 'medidas.json',
  PATRON: /^foto_(\d{4})(\d{2})(\d{2})_([a-z]+)(?:_\d+)?\.jpg$/,
  POSES: ['frente', 'perfil', 'espalda'],
  EXTENSIONES: /\.(jpe?g|png|webp)$/i,

  /* Espejo de fichaDesdeNombreFoto: fecha real y pose conocida o null. */
  fichaDesdeNombre(nombre){
    const m = this.PATRON.exec(String(nombre || ''));
    if (!m) return null;
    const fecha = ImportarJSON.dia(`${m[1]}-${m[2]}-${m[3]}`);
    if (!fecha || !this.POSES.includes(m[4])) return null;
    return { fecha, pose: m[4] };
  },

  /* Índice de medidas/fotos (bloque `medidas` de la copia o medidas.json
     del ZIP) → { fotos: Map(archivo → ficha), registros[], descartadas }.
     Mismo filtro tolerante que EstadoMedidas.fromJson. Una pose
     desconocida se lee como «frente», igual que PoseFoto.porClave. */
  leerIndice(obj){
    const fotos = new Map(), registros = [];
    let descartadas = 0;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    (Array.isArray(obj.fotos) ? obj.fotos : []).forEach(f => {
      const fecha = f && ImportarJSON.dia(f.fecha);
      if (!fecha || !ImportarJSON.archivoValido(f.archivo)){ descartadas++; return; }
      const poseOk = this.POSES.includes(f.pose);
      fotos.set(f.archivo, {
        archivo: f.archivo, fecha,
        pose: poseOk ? f.pose : 'frente', poseDesconocida: !poseOk,
        pesoKg: ImportarJSON.esNum(f.pesoKg) ? f.pesoKg : null,
      });
    });
    (Array.isArray(obj.registros) ? obj.registros : []).forEach(r => {
      const fecha = r && ImportarJSON.dia(r.fecha);
      if (!fecha || !ImportarJSON.SITIOS.includes(r.sitio) || !ImportarJSON.esNum(r.cm) ||
          r.cm < 10 || r.cm > 300){ descartadas++; return; }
      registros.push({ fecha, sitio: r.sitio, cm: r.cm });
    });
    return { fotos, registros, descartadas };
  },

  /* Tipo real por la firma del archivo (no por la extensión). */
  tipoImagen(b){
    if (!b || b.length < 12) return null;
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    return null;
  },

  /* Separa las entradas del ZIP en índice, imágenes candidatas e
     ignoradas (con motivo). */
  clasificarEntradas(entradas){
    let indice = null;
    const imagenes = [], ignoradas = [];
    for (const ent of entradas){
      const n = ent.nombre;
      if (n === this.INDICE){ indice = ent; continue; }
      if (n.startsWith('__MACOSX/')){ ignoradas.push({ nombre: n, motivo: 'metadatos del sistema' }); continue; }
      if (n.includes('/')){ ignoradas.push({ nombre: n, motivo: 'está dentro de una carpeta; la app solo lee la raíz del ZIP' }); continue; }
      if (n.startsWith('.')){ ignoradas.push({ nombre: n, motivo: 'archivo oculto del sistema' }); continue; }
      if (!this.EXTENSIONES.test(n)){ ignoradas.push({ nombre: n, motivo: 'no es una imagen admitida' }); continue; }
      if (!ImportarJSON.archivoValido(n)){ ignoradas.push({ nombre: n, motivo: 'nombre no válido' }); continue; }
      imagenes.push(ent);
    }
    return { indice, imagenes, ignoradas };
  },

  igualFicha(a, b){
    return a.fecha === b.fecha && a.pose === b.pose;
  },

  /* Ficha de un archivo según las prioridades. `indiceJson` es null si no
     hay copia JSON o si la copia no trae bloque `medidas` (anterior al
     módulo): entonces nada queda «fuera de la copia». */
  asociar(archivo, { indiceJson = null, metaZip = null } = {}){
    const deJson = indiceJson ? indiceJson.fotos.get(archivo) : null;
    if (deJson){
      const discrepancia = (metaZip && !this.igualFicha(deJson, metaZip))
        ? { zip: { fecha: metaZip.fecha, pose: metaZip.pose } } : null;
      return { ficha: deJson, fuente: 'json', fueraDeCopia: false, discrepancia };
    }
    const fueraDeCopia = !!indiceJson;
    if (metaZip) return { ficha: metaZip, fuente: 'zip', fueraDeCopia, discrepancia: null };
    const porNombre = this.fichaDesdeNombre(archivo);
    if (porNombre) return { ficha: { archivo, ...porNombre, pesoKg: null }, fuente: 'nombre', fueraDeCopia, discrepancia: null };
    return { ficha: null, fuente: null, fueraDeCopia, discrepancia: null };
  },

  /* Decide qué hacer con cada imagen ya leída del ZIP.
     candidatas: [{ nombre, sha256, tipo }] (tipo null = no es imagen válida)
     existentes: Map(archivo → { sha256 }) del espacio de destino.
     Devuelve { items[], cuentas } con estado por imagen:
       nueva · duplicada · conflicto · fueraDeCopia · sinAsociacion · noValida */
  planificar({ candidatas, indiceJson = null, indiceZip = null, existentes = new Map() }){
    const items = [];
    const cuentas = { nueva: 0, duplicada: 0, conflicto: 0, fueraDeCopia: 0, sinAsociacion: 0, noValida: 0, discrepancias: 0 };
    for (const c of candidatas){
      const metaZip = indiceZip ? (indiceZip.fotos.get(c.nombre) || null) : null;
      const a = this.asociar(c.nombre, { indiceJson, metaZip });
      const item = { nombre: c.nombre, sha256: c.sha256, tipo: c.tipo, bytes: c.bytes,
                     metaZip, fuente: a.fuente, ficha: a.ficha, discrepancia: a.discrepancia };
      if (a.discrepancia) cuentas.discrepancias++;
      const ya = existentes.get(c.nombre);
      if (!c.tipo) item.estado = 'noValida';
      else if (ya && ya.sha256 === c.sha256) item.estado = 'duplicada';
      else if (!a.ficha) item.estado = 'sinAsociacion';
      else if (ya) item.estado = 'conflicto';
      else if (a.fueraDeCopia) item.estado = 'fueraDeCopia';
      else item.estado = 'nueva';
      cuentas[item.estado]++;
      items.push(item);
    }
    return { items, cuentas };
  },

  /* Medidas del índice del ZIP que no coinciden con la copia JSON (otro
     valor o día/sitio que la copia no tiene). Se informan; manda la copia. */
  registrosDistintos(indiceJson, indiceZip){
    if (!indiceJson || !indiceZip) return 0;
    const deJson = new Map(indiceJson.registros.map(r => [`${r.fecha}|${r.sitio}`, r.cm]));
    return indiceZip.registros.filter(r => deJson.get(`${r.fecha}|${r.sitio}`) !== r.cm).length;
  },

  /* Galería efectiva de un espacio: fotos con imagen guardada y fotos del
     índice cuya imagen falta. Ordenada por fecha, pose y archivo. */
  resolver({ indiceJson = null, guardadas = [] }){
    const out = [];
    const vistas = new Set();
    for (const g of guardadas){
      vistas.add(g.archivo);
      const a = this.asociar(g.archivo, { indiceJson, metaZip: g.metaZip || null });
      if (!a.ficha) continue; // no debería ocurrir: no se guardan sin ficha
      out.push({ ...a.ficha, archivo: g.archivo, fuente: a.fuente, fueraDeCopia: a.fueraDeCopia,
                 discrepancia: a.discrepancia, tieneImagen: true });
    }
    if (indiceJson){
      indiceJson.fotos.forEach((f, archivo) => {
        if (vistas.has(archivo)) return;
        out.push({ ...f, fuente: 'json', fueraDeCopia: false, discrepancia: null, tieneImagen: false });
      });
    }
    const orden = { frente: 0, perfil: 1, espalda: 2 };
    out.sort((x, y) => x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1
      : (orden[x.pose] - orden[y.pose]) || (x.archivo < y.archivo ? -1 : 1));
    return out;
  },
};
