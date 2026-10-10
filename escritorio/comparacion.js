'use strict';
/* Fase 4: diferencias descriptivas entre intervalos. No reconstruye bloques
   ni atribuye causas. Reutiliza las exclusiones, cargas y series de Analisis
   y Motor. Fechas locales por componentes (también al cambiar la hora). */
const Comparacion = (() => {
const sitios = {
  cuello: 'Cuello', hombros: 'Hombros', pecho: 'Pecho', cintura: 'Cintura', abdomen: 'Abdomen', cadera: 'Cadera',
  biceps_izq: 'Bíceps izq.', biceps_der: 'Bíceps der.', antebrazo_izq: 'Antebrazo izq.', antebrazo_der: 'Antebrazo der.',
  muslo_izq: 'Muslo izq.', muslo_der: 'Muslo der.', gemelo_izq: 'Gemelo izq.', gemelo_der: 'Gemelo der.',
};
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const lista = v => Array.isArray(v) ? v : [];
const sumar = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dias = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
const dentro = (f, p) => f && +soloDia(f) >= +p.desde && +soloDia(f) <= +p.hasta;
function fecha(v){
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [a, m, d] = v.split('-').map(Number), f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d ? f : null;
}
function rango(v){
  const desde = fecha(v?.desde), hasta = fecha(v?.hasta);
  if (!desde || !hasta) throw new Error('Introduce las cuatro fechas válidas.');
  if (+desde > +hasta) throw new Error('El inicio de cada periodo debe ser anterior o igual a su final.');
  const n = dias(desde, hasta) + 1;
  if (n > 3660) throw new Error('Selecciona periodos de hasta diez años.');
  return { desde, hasta, dias: n };
}
function estadistica(filas){
  const puntos = filas.filter(f => num(f.valor) != null).sort((a, b) => a.fecha - b.fecha);
  const xs = puntos.map(f => f.valor).sort((a, b) => a - b), n = xs.length;
  return { n, mediana: n ? (n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2) : null,
    desde: puntos[0]?.fecha || null, hasta: puntos[n - 1]?.fecha || null, puntos };
}
/* Registros diarios repetidos iguales no aumentan la muestra. Valores
   contradictorios del mismo día se excluyen y se informan, sin elegir uno. */
function diarios(filas){
  const mapa = new Map();
  for (const f of filas){
    const k = fmtISO(f.fecha), prev = mapa.get(k);
    if (!prev) mapa.set(k, { ...f });
    else if (prev.valor !== f.valor) prev.conflicto = true;
  }
  const xs = [...mapa.values()];
  return { ...estadistica(xs.filter(f => !f.conflicto)), conflictos: xs.filter(f => f.conflicto).length };
}
function defecto(M){
  const ref = soloDia(M.ref), lunes = sumar(ref, -((ref.getDay() + 6) % 7));
  const fin = ref.getDay() === 0 ? ref : sumar(lunes, -1);
  return { a: { desde: fmtISO(sumar(fin, -55)), hasta: fmtISO(sumar(fin, -28)) },
    b: { desde: fmtISO(sumar(fin, -27)), hasta: fmtISO(fin) } };
}
function cobertura(M){
  const fechas = [...M.sesiones.map(s => s.fecha), ...M.datos.readiness.map(r => r.fecha),
    ...lista(M.datos.nutricion.pesajes).map(r => r.fecha),
    ...lista(M.raw.medidas?.registros).map(r => parseFecha(r?.fecha))].filter(Boolean);
  return { desde: fechas.length ? soloDia(new Date(fechas.reduce((min, f) => Math.min(min, +f), Infinity))) : null, hasta: soloDia(M.ref) };
}
function periodo(M, p, cob){
  const sesiones = M.sesiones.filter(s => dentro(s.fecha, p));
  const semanas = [];
  let lunes = sumar(p.desde, -((p.desde.getDay() + 6) % 7));
  for (; +lunes <= +p.hasta; lunes = sumar(lunes, 7)){
    const fin = sumar(lunes, 6), desde = new Date(Math.max(+lunes, +p.desde)), hasta = new Date(Math.min(+fin, +p.hasta));
    const completas = dias(desde, hasta) === 6 && cob.desde && +desde >= +cob.desde && +hasta <= +cob.hasta;
    const ss = sesiones.filter(s => dentro(s.fecha, { desde, hasta }));
    const plan = completas ? Analisis.planSemana(M, lunes, fin, ss) : null;
    const volumen = new Map(), sinGrupo = new Set();
    for (const s of ss) for (const e of s.entradas){
      const v = Motor.seriesPorGrupo(e, n => {
        const i = Analisis.info(M, n); if (!i) sinGrupo.add(n); return i;
      });
      if (v) v.forEach((n, g) => volumen.set(g, (volumen.get(g) || 0) + n));
    }
    semanas.push({ desde, hasta, completa: !!completas, sesiones: ss.length,
      dias: new Set(ss.map(s => fmtISO(s.fecha))).size, indices: ss.map(s => s.indice),
      previstas: plan?.conocido ? plan.previstas : null, volumen, sinGrupo: [...sinGrupo] });
  }
  const completas = semanas.filter(s => s.completa), parciales = semanas.filter(s => !s.completa);
  const conocidas = completas.filter(s => s.previstas != null);
  const volumen = new Map();
  completas.forEach(s => s.volumen.forEach((n, g) => volumen.set(g, (volumen.get(g) || 0) + n / completas.length)));
  const duracion = estadistica(sesiones.filter(s => !s.duracionAnomala && s.duracionMin > 0)
    .map(s => ({ fecha: s.fecha, valor: s.duracionMin, indice: s.indice })));
  return { ...p, sesiones, semanas, completas, parciales, volumen, duracion,
    sinGrupo: [...new Set(semanas.flatMap(s => s.sinGrupo))],
    frecuencia: completas.length ? completas.reduce((n, s) => n + s.sesiones, 0) / completas.length : null,
    diasSemana: completas.length ? completas.reduce((n, s) => n + s.dias, 0) / completas.length : null,
    conocidas: conocidas.length, previstas: conocidas.reduce((n, s) => n + s.previstas, 0),
    hechasConPlan: conocidas.reduce((n, s) => n + s.dias, 0),
    descarga: sesiones.filter(s => s.descarga).length,
    rutinas: [...new Set(sesiones.map(s => identidad(s.l) || 'Sin identidad histórica'))] };
}
/* No usar las claves con valores por defecto para inventar identidades. */
function identidad(l){
  return typeof l.variante === 'string' && l.variante.length && /^[1-7]$/.test(String(l.dias)) &&
    Number.isInteger(l.rutinaRevision) && l.rutinaRevision >= 0 ? Motor.rutinaKeyDeLog(l) : null;
}
function ejercicios(M, a, b){
  const comunes = [], soloA = [], soloB = [];
  M.ejercicios.forEach(ej => {
    const pa = ej.puntos.filter(p => p.hechas > 0 && dentro(p.fecha, a));
    const pb = ej.puntos.filter(p => p.hechas > 0 && dentro(p.fecha, b));
    if (!pa.length || !pb.length){ if (pa.length) soloA.push(ej.nombre); if (pb.length) soloB.push(ej.nombre); return; }
    const configs = [...new Set([...pa, ...pb].map(p => Analisis.configuracion(p)))];
    for (const config of configs){
      const parte = ps => {
        const xs = ps.filter(p => Analisis.configuracion(p) === config), excluidos = {};
        const validos = xs.filter(p => { const m = Analisis.motivoNoComparable(p); if (m) excluidos[m] = (excluidos[m] || 0) + 1; return !m; });
        // Un ejercicio repetido en una sesión no aumenta la muestra.
        const unicos = new Map(); validos.forEach(p => { if (!unicos.has(p.sesion.indice)) unicos.set(p.sesion.indice, p); });
        const puntos = [...unicos.values()];
        return { ...estadistica(puntos.map(p => ({ fecha: p.fecha, valor: p.e1rmMarca, indice: p.sesion.indice }))),
          puntos, excluidos, registradas: new Set(xs.map(p => p.sesion.indice)).size };
      };
      const A = parte(pa), B = parte(pb);
      const suficiente = A.n >= 2 && B.n >= 2 && !ej.pesoCorporal;
      comunes.push({ nombre: ej.nombre, config, a: A, b: B, pesoCorporal: ej.pesoCorporal,
        deltaPct: suficiente && A.mediana > 0 ? (B.mediana / A.mediana - 1) * 100 : null,
        seriesDistintas: new Set([...A.puntos, ...B.puntos].map(p => p.hechas)).size > 1,
        cambioRutina: new Set([...A.puntos, ...B.puntos].map(p => p.sesion.rutina)).size > 1 });
    }
  });
  return { comunes: comunes.sort((x, y) => x.nombre.localeCompare(y.nombre)), soloA, soloB };
}
function rendimiento(a, b){
  const grupos = new Map();
  const parte = (p, lado) => p.sesiones.forEach(s => {
    const id = identidad(s.l);
    if (!id || s.descarga || !s.l.dia) return;
    const clave = JSON.stringify([id, s.dia]);
    if (!grupos.has(clave)) grupos.set(clave, { rutina: id, dia: s.dia, a: [], b: [] });
    grupos.get(clave)[lado].push(s);
  });
  parte(a, 'a'); parte(b, 'b');
  const stat = (ss, tipo) => estadistica(ss.filter(s => tipo === 'neto' ? s.neto != null :
    s.bruto != null && (num(s.l.rawSessionPct) != null || num(s.l.rendimientoPct) != null))
    .map(s => ({ fecha: s.fecha, valor: s[tipo], indice: s.indice })));
  return [...grupos.values()].map(g => ({ ...g, brutoA: stat(g.a, 'bruto'), brutoB: stat(g.b, 'bruto'),
    netoA: stat(g.a, 'neto'), netoB: stat(g.b, 'neto') }));
}
function contexto(M, p){
  const nut = M.datos.nutricion;
  const peso = diarios(lista(nut.pesajes).filter(r => dentro(r.fecha, p) && r.pesoKg > 0).map(r => ({ fecha: r.fecha, valor: r.pesoKg })));
  const medidas = {};
  for (const [k, nombre] of Object.entries(sitios)){
    const filas = lista(M.raw.medidas?.registros).filter(r => r && r.sitio === k && num(r.cm) >= 10 && num(r.cm) <= 300)
      .map(r => ({ fecha: parseFecha(r.fecha), valor: r.cm })).filter(r => dentro(r.fecha, p));
    if (filas.length) medidas[k] = { nombre, ...diarios(filas) };
  }
  const r = M.datos.readiness.filter(r => dentro(r.fecha, p));
  const campo = (k, filtro) => diarios(r.filter(filtro).map(x => ({ fecha: x.fecha, valor: x[k] })));
  const estado = campo('estadoEntrenar', x => num(x.estadoEntrenar) != null && x.estadoEntrenar >= 0 && x.estadoEntrenar <= 100);
  const vfc = campo('vfc', x => x.vfc > 0 && !x.vfcDescartada);
  const fc = campo('fcReposo', x => x.fcReposo > 0);
  const fases = [...lista(nut.fasesCerradas), ...(nut.fase ? [nut.fase] : [])]
    .filter(f => f.inicio && +soloDia(f.inicio) <= +p.hasta && (!f.fin || +soloDia(f.fin) >= +p.desde));
  const recomendaciones = lista(nut.recomendaciones).filter(r => dentro(r.fecha, p));
  return { peso, medidas, estado, vfc, fc, fases, recomendaciones };
}
function comparar(M, valores){
  const ra = rango(valores?.a), rb = rango(valores?.b), cob = cobertura(M);
  const a = periodo(M, ra, cob), b = periodo(M, rb, cob);
  const avisos = [];
  if (+a.desde <= +b.hasta && +b.desde <= +a.hasta) avisos.push('Los periodos se solapan: comparten registros y no son muestras independientes.');
  if (a.dias !== b.dias) avisos.push('Los periodos duran distinto. Compara las medias de semanas completas; los totales solo describen cada periodo.');
  if (!cob.desde) avisos.push('La copia no contiene registros fechados para esta comparación.');
  else if ([a, b].some(p => +p.desde < +cob.desde || +p.hasta > +cob.hasta)) avisos.push('Parte de la selección queda fuera de los registros disponibles. Esas semanas no entran en las medias.');
  if (!a.completas.length || !b.completas.length) avisos.push('Faltan semanas completas en uno de los periodos: no se compara frecuencia ni volumen semanal.');
  if (a.sinGrupo.length || b.sinGrupo.length) avisos.push('Hay ejercicios sin grupo muscular reconocido: sus series no entran en el reparto por grupo.');
  return { a, b, cobertura: cob, avisos, ejercicios: ejercicios(M, a, b), rendimiento: rendimiento(a, b),
    contextoA: contexto(M, a), contextoB: contexto(M, b) };
}
return { comparar, defecto, rango, estadistica, sitios, dias };
})();
