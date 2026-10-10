'use strict';
/* ================================================================
   TrueLift Escritorio — informe.js (fase 7)
   Informe de un mes o de unas fechas: constancia, progresión
   verificable, evolución física, volumen, recuperación, cambios,
   limitaciones y aspectos que revisar. Solo cálculo, sin DOM.

   No hay reglas nuevas: reutiliza el periodo y el contexto de la
   comparación (comparacion.js), la evolución por ejercicio, marcas,
   estados y exclusiones de analisis.js y las medidas de evolucion.js.
   Todo lo que no se puede respaldar con los registros se declara como
   dato insuficiente. Definiciones: escritorio/METRICAS.md §Fase 7.
   ================================================================ */

const Informe = (() => {

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const sumar = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dentro = (f, p) => !!f && +soloDia(f) >= +p.desde && +soloDia(f) <= +p.hasta;
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const lista = v => Array.isArray(v) ? v : [];
const iso = d => fmtISO(d);
const MAX_FOTOS = 6;

// ---------------------------------------------------------------
// Selección del periodo
// ---------------------------------------------------------------
/* Meses que tocan los registros de la copia, del más reciente al más
   antiguo. `completo` = el mes termina antes o el mismo día que el
   último registro (si no, sus últimos días no tienen datos). */
function meses(M){
  const cob = Comparacion.cobertura(M);
  if (!cob.desde) return [];
  const out = [];
  for (let d = new Date(cob.hasta.getFullYear(), cob.hasta.getMonth(), 1); +d >= +new Date(cob.desde.getFullYear(), cob.desde.getMonth(), 1);
       d = new Date(d.getFullYear(), d.getMonth() - 1, 1)){
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    out.push({ valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      texto: `${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`, desde: d, hasta: fin, completo: +fin <= +cob.hasta });
  }
  return out;
}

/* Por defecto, el último mes natural completo; si la copia no llega a
   cubrir uno, el mes del último registro. */
function defecto(M){
  const ms = meses(M);
  const m = ms.find(x => x.completo) || ms[0];
  return m ? { tipo: 'mes', mes: m.valor } : { tipo: 'mes', mes: null };
}

/* Valida una selección y devuelve el intervalo. Lanza Error con un mensaje
   para la persona si no es válida. */
function rango(sel){
  if (!sel || (sel.tipo !== 'mes' && sel.tipo !== 'fechas')) throw new Error('Elige un mes o unas fechas.');
  if (sel.tipo === 'mes'){
    const m = /^(\d{4})-(\d{2})$/.exec(sel.mes || '');
    if (!m || +m[2] < 1 || +m[2] > 12) throw new Error('Elige un mes de la lista.');
    const desde = new Date(+m[1], +m[2] - 1, 1), hasta = new Date(+m[1], +m[2], 0);
    return { tipo: 'mes', desde, hasta, dias: Comparacion.dias(desde, hasta) + 1, titulo: `${MESES_LARGOS[desde.getMonth()]} de ${desde.getFullYear()}` };
  }
  const desde = Comparacion.fecha(sel.desde), hasta = Comparacion.fecha(sel.hasta);
  if (!desde || !hasta) throw new Error('Introduce una fecha de inicio y una de final válidas.');
  if (+desde > +hasta) throw new Error('La fecha de inicio debe ser anterior o igual a la final.');
  const dias = Comparacion.dias(desde, hasta) + 1;
  if (dias > 3660) throw new Error('Elige un periodo de hasta diez años.');
  return { tipo: 'fechas', desde, hasta, dias, titulo: null };
}

/* Periodo inmediatamente anterior de la misma duración (para abrirlo en
   «Comparar periodos»). En un mes, el mes natural anterior. */
function anterior(r){
  if (r.tipo === 'mes'){
    const desde = new Date(r.desde.getFullYear(), r.desde.getMonth() - 1, 1);
    return { desde, hasta: new Date(desde.getFullYear(), desde.getMonth() + 1, 0) };
  }
  const hasta = sumar(r.desde, -1);
  return { desde: sumar(hasta, -(r.dias - 1)), hasta };
}

// ---------------------------------------------------------------
// Bloques del informe
// ---------------------------------------------------------------
function constancia(M, P){
  const cardio = lista(M.datos.cardio).filter(c => dentro(c.fecha, P));
  const minCardio = cardio.reduce((s, c) => s + (num(c.duracion) > 0 ? c.duracion : 0), 0);
  const conPlan = P.completas.filter(s => s.previstas != null);
  return {
    sesiones: P.sesiones.length,
    dias: new Set(P.sesiones.map(s => iso(s.fecha))).size,
    semanas: P.semanas.map(s => ({ desde: s.desde, hasta: s.hasta, completa: s.completa, sesiones: s.sesiones, dias: s.dias,
      previstas: s.previstas, indices: s.indices })),
    completas: P.completas.length, parciales: P.parciales.length,
    frecuencia: P.frecuencia, diasSemana: P.diasSemana,
    conocidas: P.conocidas, previstas: P.previstas, hechasConPlan: P.hechasConPlan,
    pordebajo: conPlan.filter(s => s.dias < s.previstas),
    descarga: P.descarga, duracion: P.duracion,
    cardio: cardio.length, minCardio: cardio.some(c => num(c.duracion) > 0) ? minCardio : null,
    rutinas: P.rutinas,
  };
}

const VEREDICTOS = ['bueno', 'normal', 'flojo', 'muy flojo'];
function progresion(M, P){
  const ejercicios = [], porTiempo = [];
  M.ejercicios.forEach(ej => {
    const hechas = ej.puntos.filter(p => p.hechas > 0 && dentro(p.fecha, P));
    if (!hechas.length) return;
    if (ej.porTiempo){ porTiempo.push({ nombre: ej.nombre, sesiones: new Set(hechas.map(p => p.sesion.indice)).size }); return; }
    ejercicios.push(Analisis.evolucionEjercicio(M, ej, P.desde, P.hasta));
  });
  const orden = { baja: 0, sube: 1, sinCambios: 2, insuficiente: 3 };
  ejercicios.sort((x, y) => orden[x.lectura] - orden[y.lectura] || y.n - x.n || x.nombre.localeCompare(y.nombre));
  const marcas = [];
  M.ejercicios.forEach(ej => Analisis.marcas(ej).forEach(m => {
    if (m.anterior != null && dentro(m.p.fecha, P)) marcas.push({ nombre: ej.nombre, fecha: m.p.fecha, indice: m.p.sesion.indice,
      valor: m.valor, anterior: m.anterior, serie: Analisis.serieTxt(m.p.e, m.serie) });
  }));
  marcas.sort((a, b) => +a.fecha - +b.fecha || a.nombre.localeCompare(b.nombre));
  // Valoración que la app guardó en cada sesión (no se recalcula).
  const veredictos = Object.fromEntries(VEREDICTOS.map(v => [v, 0]));
  let sinVeredicto = 0;
  P.sesiones.forEach(s => { if (s.descarga) return; if (veredictos[s.veredicto] != null) veredictos[s.veredicto]++; else sinVeredicto++; });
  return { ejercicios, porTiempo, marcas, veredictos, sinVeredicto,
    firmes: ejercicios.filter(x => x.firme), orientativas: ejercicios.filter(x => x.lectura !== 'insuficiente' && !x.firme),
    insuficientes: ejercicios.filter(x => x.lectura === 'insuficiente') };
}

function fisica(M, P, ctxP, modelo, galeria){
  const N = M.datos.nut;
  // Peso: pesajes del periodo (deduplicados como en la comparación) y peso
  // tendencia de la app en el primer y el último pesaje del periodo, sin
  // extrapolar fuera de los días pesados.
  const peso = ctxP.peso;
  let tendencia = null;
  if (N && N.serie && !N.serie.vacia && N.pesajes){
    const del = N.pesajes.filter(p => dentro(p.fecha, P) && p.pesoKg > 0);
    const punto = p => { const i = N.serie.indice.get(p.clave); const q = i != null ? N.serie.puntos[i] : null; return q && q.tendenciaKg > 0 ? { fecha: q.fecha, kg: q.tendenciaKg } : null; };
    if (del.length){
      const a = punto(del[0]), b = punto(del[del.length - 1]);
      tendencia = { inicio: a, fin: b, cambioKg: a && b && iso(a.fecha) !== iso(b.fecha) ? b.kg - a.kg : null,
        serie: del.map(p => ({ fecha: p.fecha, pesoKg: p.pesoKg, enmascarado: !!p.enmascarado, tendenciaKg: punto(p)?.kg ?? null })) };
      // Resumen por semana (lunes a domingo) para periodos largos.
      const semanas = new Map();
      tendencia.serie.forEach(x => { const l = Analisis._lunes(x.fecha), k = iso(l);
        if (!semanas.has(k)) semanas.set(k, { desde: l, xs: [] }); semanas.get(k).xs.push(x); });
      tendencia.semanas = [...semanas.values()].map(w => {
        const st = Comparacion.estadistica(w.xs.map(x => ({ fecha: x.fecha, valor: x.pesoKg })));
        const u = [...w.xs].reverse().find(x => x.tendenciaKg != null);
        return { desde: w.desde, hasta: sumar(w.desde, 6), n: w.xs.length, mediana: st.mediana, tendenciaKg: u ? u.tendenciaKg : null, fechaTendencia: u ? u.fecha : null };
      });
    }
  }
  // Contornos: primera y última medida dentro del periodo, con sus fechas
  // reales. No se arrastran medidas de fuera ni se usan las contradictorias.
  const desde = iso(P.desde), hasta = iso(P.hasta);
  const enP = (modelo?.registros || []).filter(r => r.fecha >= desde && r.fecha <= hasta);
  const contornos = (modelo?.sitios || []).map(sitio => {
    const rs = enP.filter(r => r.sitio === sitio && !r.conflicto && num(r.cm) != null);
    if (!rs.length) return null;
    const a = rs[0], b = rs[rs.length - 1];
    return { sitio, nombre: VistasNombreSitio(sitio), n: rs.length, inicio: a, fin: b, cambioCm: a.fecha !== b.fecha ? b.cm - a.cm : null };
  }).filter(Boolean);
  const conflictos = enP.filter(r => r.conflicto).length;
  const composicion = N ? lista(N.mediciones).filter(m => dentro(m.fecha, P)) : [];
  const fotos = lista(galeria).filter(f => f.fecha >= desde && f.fecha <= hasta);
  return {
    peso, tendencia, fases: ctxP.fases, contornos, conflictos, fuenteContornos: modelo?.fuente || null, composicion,
    fotos: { total: fotos.length, conImagen: fotos.filter(f => f.tieneImagen).length, sinImagen: fotos.filter(f => !f.tieneImagen).length,
      poses: [...new Set(fotos.map(f => f.pose))] },
  };
}
const VistasNombreSitio = s => Comparacion.sitios[s] || s;

function volumen(M, P){
  const grupos = Motor.GRUPOS_VOLUMEN.filter(g => P.semanas.some(s => s.volumen.has(g)));
  return {
    grupos: grupos.map(g => ({ grupo: g, media: P.completas.length ? P.volumen.get(g) || 0 : null,
      parcial: P.parciales.reduce((n, s) => n + (s.volumen.get(g) || 0), 0) })),
    seriesTotales: P.sesiones.reduce((n, s) => n + s.series, 0),
    completas: P.completas.length, parciales: P.parciales.length, sinGrupo: P.sinGrupo,
  };
}

function recuperacion(M, P, ctxP){
  const r = M.datos.readiness.filter(x => dentro(x.fecha, P) && num(x.estadoEntrenar) != null);
  return { activo: M.raw.readinessActivo === true, estado: ctxP.estado, vfc: ctxP.vfc, fc: ctxP.fc,
    bajos: r.filter(x => x.estadoEntrenar < Analisis.ESTADO_BAJO).length, registrados: new Set(r.map(x => iso(x.fecha))).size };
}

const MODALIDAD = { sube: 'al alza', baja: 'a la baja' };
const rutinaTxt = key => {
  if (!key || key === 'Sin identidad histórica') return 'una rutina sin identificar';
  const [variante, dias, revision] = key.split('|');
  const tipo = variante.endsWith('_doble') ? 'rutina doble' : variante.endsWith('_simple') ? 'rutina simple' : 'rutina';
  return `${tipo} de ${dias} días (versión ${revision})`;
};

/* Cambios relevantes del periodo, en orden cronológico. Solo hechos de la
   copia: cambios de rutina, descargas, marcas, lecturas firmes del 1RM
   estimado, fases de nutrición, molestias y ejercicios cambiados o no hechos. */
function cambios(M, P, prog, fis){
  const c = [];
  P.sesiones.forEach(s => {
    if (s.cambioRutina) c.push({ fecha: s.fecha, tipo: 'rutina', indice: s.indice,
      texto: `Primera sesión registrada con otra rutina: ${rutinaTxt(Comparacion.identidad(s.l))}.` });
  });
  const desc = P.sesiones.filter(s => s.descarga);
  if (desc.length) c.push({ fecha: desc[0].fecha, tipo: 'descarga', indice: desc[0].indice,
    texto: desc.length === 1 ? 'Sesión de descarga.' : `${desc.length} sesiones de descarga (desde esta fecha).` });
  // Una línea por ejercicio: la última marca del periodo y cuántas hubo.
  const porNombre = new Map();
  prog.marcas.forEach(m => { if (!porNombre.has(m.nombre)) porNombre.set(m.nombre, []); porNombre.get(m.nombre).push(m); });
  porNombre.forEach((ms, nombre) => { const u = ms[ms.length - 1];
    c.push({ fecha: u.fecha, tipo: 'marca', indice: u.indice, ejercicio: nombre,
      texto: ms.length === 1 ? `Nueva mejor marca estimada en ${nombre}: ${fmtNum(u.valor, 1)} kg (antes ${fmtNum(u.anterior, 1)} kg).`
        : `${ms.length} nuevas mejores marcas estimadas en ${nombre}; la última, ${fmtNum(u.valor, 1)} kg (antes del periodo, ${fmtNum(ms[0].anterior, 1)} kg).` }); });
  prog.firmes.forEach(x => c.push({ fecha: x.puntos[x.puntos.length - 1].fecha, tipo: `e1rm-${x.lectura}`, ejercicio: x.nombre,
    texto: `1RM estimado ${MODALIDAD[x.lectura]} en ${x.nombre}: de ${fmtNum(x.inicio, 1)} a ${fmtNum(x.fin, 1)} kg en ${x.n} sesiones comparables.` }));
  fis.fases.forEach(f => {
    const T = { DEFICIT: 'déficit', SURPLUS: 'superávit', MAINTENANCE: 'mantenimiento' }[f.tipo] || 'nutrición';
    if (f.inicio && dentro(f.inicio, P)) c.push({ fecha: soloDia(f.inicio), tipo: 'fase', texto: `Empieza una fase de ${T}.` });
    if (f.fin && dentro(f.fin, P)) c.push({ fecha: soloDia(f.fin), tipo: 'fase', texto: `Termina la fase de ${T}.` });
  });
  const porEj = (pred) => {
    const m = new Map();
    P.sesiones.forEach(s => s.entradas.forEach(e => { if (pred(e)){ if (!m.has(e.ejercicio)) m.set(e.ejercicio, []); m.get(e.ejercicio).push(s); } }));
    return m;
  };
  porEj(e => e.molestias).forEach((ss, nombre) => c.push({ fecha: ss[0].fecha, tipo: 'molestias', indice: ss[0].indice, ejercicio: nombre,
    texto: `Molestias registradas en ${nombre} (${ss.length === 1 ? '1 sesión' : `${ss.length} sesiones`}).` }));
  const sust = P.sesiones.filter(s => s.entradas.some(e => e.sustitucion));
  if (sust.length) c.push({ fecha: sust[0].fecha, tipo: 'sustitucion', indice: sust[0].indice,
    texto: `${sust.length === 1 ? 'Una sesión' : `${sust.length} sesiones`} con algún ejercicio cambiado solo ese día.` });
  const noHechos = P.sesiones.filter(s => s.entradas.some(e => e.noDisponible));
  if (noHechos.length) c.push({ fecha: noHechos[0].fecha, tipo: 'noHecho', indice: noHechos[0].indice,
    texto: `${noHechos.length === 1 ? 'Una sesión' : `${noHechos.length} sesiones`} con algún ejercicio marcado como no realizado.` });
  return c.sort((a, b) => +a.fecha - +b.fecha);
}

/* Datos insuficientes y limitaciones de este informe concreto. */
function limitaciones(M, r, P, cob, k, prog, fis, vol, rec){
  const l = [];
  if (!cob.desde || +r.hasta < +cob.desde) l.push('El periodo es anterior a tu primer registro: no hay datos que resumir.');
  else {
    if (+r.desde < +cob.desde) l.push(`Tu primer registro es del ${fmtFechaLarga(cob.desde)}: los días anteriores del periodo no tienen datos.`);
    if (+r.hasta > +cob.hasta) l.push(`Tus datos llegan hasta el ${fmtFechaLarga(cob.hasta)}: los días posteriores del periodo aún no tienen registros. Exporta una copia más reciente para completarlo.`);
  }
  if (!k.completas) l.push('No hay ninguna semana completa (de lunes a domingo) dentro del periodo con datos: no se calculan medias semanales.');
  if (k.completas && !k.conocidas) l.push('No se puede saber qué rutina tenías en estas semanas, así que no se calculan días previstos.');
  if (prog.insuficientes.length) l.push(`Ejercicios sin sesiones comparables suficientes para describir su evolución: ${listaTxt(prog.insuficientes.map(x => x.nombre))}.`);
  if (prog.orientativas.length) l.push(`Lectura solo orientativa (pocas sesiones comparables): ${listaTxt(prog.orientativas.map(x => x.nombre))}.`);
  if (prog.ejercicios.some(x => x.ej.pesoCorporal)) l.push('En los ejercicios con tu peso corporal el 1RM estimado usa tu peso de perfil actual, también en sesiones antiguas.');
  if (!fis.peso.n) l.push('No hay pesajes en el periodo.');
  if (!fis.contornos.length) l.push('No hay contornos medidos en el periodo.');
  if (vol.sinGrupo.length) l.push(`Ejercicios sin grupo muscular reconocido (sus series no se reparten por grupo): ${listaTxt(vol.sinGrupo)}.`);
  if (!rec.activo && !rec.registrados) l.push('El cuestionario diario no está activo: no hay datos de estado para entrenar.');
  l.push('El 1RM es una estimación a partir de tus series, no una prueba de máximo. Las composiciones corporales también son estimaciones.');
  l.push('El informe describe tus registros; no explica sus causas ni sustituye la opinión de un profesional de la salud.');
  return l;
}

/* Aspectos que revisar: señales de los propios registros, sin
   recomendaciones de carga ni médicas. Cada uno enlaza a su detalle. */
function revisar(M, r, P, k, prog, fis, rec){
  const x = [];
  const incluyeRef = +r.hasta >= +soloDia(M.ref) && +r.desde <= +soloDia(M.ref);
  prog.firmes.filter(e => e.lectura === 'baja').forEach(e => x.push({ texto: `El 1RM estimado de ${e.nombre} baja en el periodo. Revisa sus sesiones y su estado de progresión.`,
    destino: `entrenamiento:ejercicios:${encodeURIComponent(e.nombre)}` }));
  if (incluyeRef){
    const agot = [];
    M.ejercicios.forEach(ej => ej.estados.forEach(st => { if (st.tipo === 'intentosAgotados') agot.push(`${ej.nombre} (${st.dia})`); }));
    if (agot.length) x.push({ texto: `A fecha de tu último registro, la app cuenta los intentos agotados en ${listaTxt(agot)}. Lo que se hace después con la carga lo decide la app.`,
      destino: 'entrenamiento:ejercicios' });
    const rc = Analisis.cambiosRecuperacion(M);
    if (rc.ahora.lectura === 'cargada') x.push({ texto: 'En las últimas semanas registradas muchos días tuvieron el estado para entrenar bajo.', destino: 'recuperacion' });
    if (rc.vfcBaja.length) x.push({ texto: 'Tu VFC lleva varias noches recientes por debajo de tu referencia.', destino: 'recuperacion' });
  }
  if (k.pordebajo.length) x.push({ texto: `${k.pordebajo.length === 1 ? 'Una semana' : `${k.pordebajo.length} semanas`} con menos días de entrenamiento que los previstos por tu rutina de entonces.`,
    destino: 'entrenamiento:sesiones' });
  const molestias = new Set();
  P.sesiones.forEach(s => s.entradas.forEach(e => { if (e.molestias) molestias.add(e.ejercicio); }));
  if (molestias.size) x.push({ texto: `Registraste molestias en ${listaTxt([...molestias])}. Revisa en qué sesiones aparecen.`, destino: 'entrenamiento:sesiones' });
  if (fis.fotos.sinImagen) x.push({ texto: `${fis.fotos.sinImagen === 1 ? 'Una foto del periodo está registrada' : `${fis.fotos.sinImagen} fotos del periodo están registradas`} sin imagen importada.`, destino: 'fisica' });
  if (fis.conflictos) x.push({ texto: 'Algunos contornos del periodo tienen valores contradictorios el mismo día y no se usan.', destino: 'fisica' });
  return x;
}

function listaTxt(xs){ return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`; }
function fmtFechaLarga(d){ return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`; }

// ---------------------------------------------------------------
// Informe completo
// ---------------------------------------------------------------
/* `opciones.fisica`: modelo de Evolucion; `opciones.galeria`: fotos
   resueltas (solo se cuentan; las imágenes se añaden aparte y solo por
   elección expresa). */
function generar(M, sel, { fisica: modelo = null, galeria = [] } = {}){
  const r = rango(sel);
  const cob = Comparacion.cobertura(M);
  const P = Comparacion.periodo(M, { desde: r.desde, hasta: r.hasta, dias: r.dias }, cob);
  const ctxP = Comparacion.contexto(M, P);
  const k = constancia(M, P);
  const prog = progresion(M, P);
  const fis = fisica(M, P, ctxP, modelo || Evolucion.preparar(M.raw), galeria);
  const vol = volumen(M, P);
  const rec = recuperacion(M, P, ctxP);
  const hayDatos = !!(P.sesiones.length || fis.peso.n || fis.contornos.length || rec.registrados || k.cardio || fis.composicion.length || fis.fotos.total);
  return {
    periodo: r, cobertura: cob, ref: M.ref, hayDatos,
    constancia: k, progresion: prog, fisica: fis, volumen: vol, recuperacion: rec,
    cambios: cambios(M, P, prog, fis),
    limitaciones: limitaciones(M, r, P, cob, k, prog, fis, vol, rec),
    revisar: revisar(M, r, P, k, prog, fis, rec),
    anterior: anterior(r),
  };
}

/* Fotos que se pueden añadir al informe: las del periodo con imagen
   importada. La selección es siempre explícita y limitada. */
function fotosElegibles(galeria, r){
  const desde = iso(r.desde), hasta = iso(r.hasta);
  return lista(galeria).filter(f => f.tieneImagen && f.fecha >= desde && f.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || FotosTL.POSES.indexOf(a.pose) - FotosTL.POSES.indexOf(b.pose));
}

return { meses, defecto, rango, anterior, generar, fotosElegibles, MAX_FOTOS, MESES_LARGOS, fmtFechaLarga, rutinaTxt };
})();
