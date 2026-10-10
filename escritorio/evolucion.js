'use strict';
/* Evolución física: funciones puras. Reglas verificadas en App-PRO
   lib/medidas/modelos.dart (vigenteEn, compararContornos, tendenciaDe).
   Las medidas pertenecen a la instantánea; jamás se fusionan con el ZIP.
   Un ZIP solo aporta contornos cuando el JSON no tiene módulo de medidas. */
const Evolucion = {
  DIAS_ARRASTRE: 30,
  MIN_PUNTOS: 3,
  MIN_DIAS: 21,
  dias(a, b){
    const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
    return Math.round((utc(b) - utc(a)) / 86400000);
  },
  preparar(raw = null, indiceZip = null){
    const tieneJSON = !!(raw?.medidas && typeof raw.medidas === 'object' && !Array.isArray(raw.medidas));
    const indice = FotosTL.leerIndice(tieneJSON ? raw.medidas : indiceZip);
    const grupos = new Map();
    for (const r of indice?.registros || []){
      const k = `${r.fecha}|${r.sitio}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    }
    const registros = [], conflictos = [];
    let repetidos = 0;
    grupos.forEach(rs => {
      const r = { ...rs[0] };
      if (rs.some(x => x.cm !== r.cm)){
        conflictos.push({ fecha: r.fecha, sitio: r.sitio });
        r.cm = null; r.conflicto = true;
      }
      repetidos += rs.length - 1;
      registros.push(r);
    });
    registros.sort((a, b) => a.fecha.localeCompare(b.fecha) || ImportarJSON.SITIOS.indexOf(a.sitio) - ImportarJSON.SITIOS.indexOf(b.sitio));
    return { registros, conflictos, repetidos, descartadas: indice?.descartadas || 0,
      fuente: tieneJSON ? 'json' : indice ? 'zip' : null,
      sitios: ImportarJSON.SITIOS.filter(s => registros.some(r => r.sitio === s)) };
  },
  vigenteEn(modelo, fecha, sitio){
    let mejor = null;
    for (const r of modelo.registros){
      if (r.fecha > fecha) break;
      if (r.sitio === sitio) mejor = r;
    }
    if (!mejor) return { registro: null, motivo: 'sin medida anterior' };
    const dias = this.dias(mejor.fecha, fecha);
    if (dias > this.DIAS_ARRASTRE) return { registro: null, motivo: 'medida demasiado antigua' };
    // Las exportaciones normales tienen un registro por día/sitio. Si una
    // copia manipulada tiene valores contradictorios, no elegir uno ni
    // ocultar el conflicto usando otra medida más vieja.
    if (mejor.conflicto) return { registro: null, motivo: 'registros contradictorios' };
    return { registro: mejor, dias, motivo: null };
  },
  compararContornos(modelo, desde, hasta){
    if (!desde || !hasta || hasta <= desde) return [];
    const salida = [];
    for (const sitio of modelo.sitios){
      const a = this.vigenteEn(modelo, desde, sitio).registro;
      const b = this.vigenteEn(modelo, hasta, sitio).registro;
      if (!a || !b || a.fecha === b.fecha) continue;
      salida.push({ sitio, desde: a, hasta: b, deltaCm: b.cm - a.cm });
    }
    return salida.sort((a, b) => a.sitio === 'cintura' ? -1 : b.sitio === 'cintura' ? 1 : Math.abs(b.deltaCm) - Math.abs(a.deltaCm));
  },
  tendenciaDe(serie){
    if (serie.length < this.MIN_PUNTOS || this.dias(serie[0].fecha, serie.at(-1).fecha) < this.MIN_DIAS) return null;
    const origen = serie[0].fecha;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const r of serie){ const x = this.dias(origen, r.fecha); sx += x; sy += r.cm; sxx += x * x; sxy += x * r.cm; }
    const n = serie.length, den = n * sxx - sx * sx;
    if (!den) return null;
    const pendiente = (n * sxy - sx * sy) / den;
    return { origen, pendienteCmPorDia: pendiente, interceptoCm: (sy - pendiente * sx) / n,
      cmPorMes: pendiente * 30.44 };
  },
  faseEn(raw, fecha){
    const n = raw?.nutricion;
    if (!n || !fecha) return null;
    const tipos = { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' };
    const candidatas = [];
    for (const [f, actual] of [...(Array.isArray(n.fasesCerradas) ? n.fasesCerradas.map(f => [f, false]) : []), [n.fase, true]]){
      if (!f || !tipos[f.tipo]) continue;
      const inicio = ImportarJSON.dia(f.inicio), fin = ImportarJSON.dia(f.fin);
      // Una fase cerrada sin fin no permite reconstruir su duración.
      if (!inicio || (!actual || f.estado === 'CLOSED') && !fin || f.fin != null && !fin || fin && fin < inicio) continue;
      if (fecha < inicio || fin && fecha > fin) continue;
      candidatas.push({ tipo: f.tipo, texto: tipos[f.tipo], inicio, fin });
    }
    // Fases solapadas son ambiguas. No proyectar la fasePeso actual al pasado.
    return candidatas.length === 1 ? candidatas[0] : null;
  },
  emparejar(galeria, seleccion = {}){
    const poses = FotosTL.POSES;
    const pose = poses.includes(seleccion.pose) ? seleccion.pose
      : poses.reduce((mejor, p) => galeria.filter(f => f.pose === p && f.tieneImagen).length > galeria.filter(f => f.pose === mejor && f.tieneImagen).length ? p : mejor, poses[0]);
    const pool = galeria.filter(f => f.pose === pose);
    const disponibles = pool.filter(f => f.tieneImagen);
    const a = pool.find(f => f.archivo === seleccion.a) || disponibles[0] || pool[0] || null;
    const b = pool.find(f => f.archivo === seleccion.b) || disponibles.findLast(f => f.archivo !== a?.archivo) || pool.findLast(f => f.archivo !== a?.archivo) || null;
    return { pose, pool, a, b, valida: !!(a && b && a.archivo !== b.archivo && a.tieneImagen && b.tieneImagen) };
  },
  encuadre(valor = {}){
    const numero = (n, defecto, min, max) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : defecto;
    return { zoom: numero(valor.zoom, 1, 1, 3), x: numero(valor.x, 0, -50, 50), y: numero(valor.y, 0, -50, 50) };
  },
};
