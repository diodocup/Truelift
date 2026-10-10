'use strict';
/* ================================================================
   TrueLift Escritorio — periodos.js
   Fase 4: comparación entre dos periodos o bloques. Solo cálculo,
   sin DOM. Se apoya en el modelo de analisis.js y en las reglas de
   ../coach/motor.js; no introduce métricas nuevas, solo las agrega
   por periodo. Definiciones: escritorio/METRICAS.md §Fase 4.

   Principios:
   - Un periodo es un rango de días [desde, hasta], ambos incluidos,
     recortado a los días que cubre la copia (del primer registro al
     último). Fuera de ese rango no hay datos, no ceros.
   - Las medias semanales salen solo de semanas completas (lunes a
     domingo dentro del periodo); los días de semanas parciales se
     cuentan aparte y no se proyectan.
   - Diferencia = B − A, sin tono: describe, no elige un ganador.
   - Los bloques solo se ofrecen si la copia los identifica: tramos
     consecutivos de sesiones con la misma rutina anotada, y fases de
     nutrición guardadas por la app.
   ================================================================ */

const Periodos = {

  /* Por debajo de estas cantidades se avisa de muestra pequeña o no se
     calcula una diferencia (no se enseñan en los textos). */
  MIN_SESIONES_MUESTRA: 4,
  MIN_COMPARABLES: 2,
  // Duración válida de una sesión: la misma que usa el reloj de sesión de la
  // app (lib/app_state.dart, tiempo estimado): con dato, no anómala y de al
  // menos 15 minutos.
  DURACION_MIN: 15,

  _d(x){ if (!x) return null; const d = x instanceof Date ? x : parseFecha(x); return d && !isNaN(d) ? soloDia(d) : null; },
  _mas(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); },
  _media(xs){ return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; },
  _dentro(fecha, P){ const d = +soloDia(fecha); return d >= +P.desde && d <= +P.hasta; },

  // ---------------------------------------------------------------
  // Límites de los datos y normalización de un periodo
  // ---------------------------------------------------------------
  limites(M){
    const ultimo = soloDia(M.ref);
    let primero = this._d(M.primerRegistro);
    if (!primero && M.sesiones.length) primero = soloDia(M.sesiones[0].fecha);
    return { primero: primero || ultimo, ultimo };
  },

  /* Valida y recorta un periodo pedido. Devuelve el periodo efectivo con
     su duración, o `error` ('fecha' | 'orden' | 'fuera'). */
  periodo(M, pedido){
    const L = this.limites(M);
    const desde = this._d(pedido && pedido.desde), hasta = this._d(pedido && pedido.hasta);
    if (!desde || !hasta) return { error: 'fecha', pedido };
    if (+desde > +hasta) return { error: 'orden', pedido: { desde, hasta } };
    if (+hasta < +L.primero || +desde > +L.ultimo) return { error: 'fuera', pedido: { desde, hasta }, limites: L };
    const d = +desde < +L.primero ? L.primero : desde;
    const h = +hasta > +L.ultimo ? L.ultimo : hasta;
    return { desde: d, hasta: h, pedido: { desde, hasta }, recortado: +d !== +desde || +h !== +hasta,
             dias: diasEntre(d, h) + 1, limites: L };
  },

  /* Semanas lunes-domingo enteras dentro del periodo y tramos parciales. */
  semanas(P){
    const completas = [], parciales = [];
    const desfase = (P.desde.getDay() + 6) % 7;            // 0 = lunes
    let lunes = desfase === 0 ? P.desde : this._mas(P.desde, 7 - desfase);
    if (+lunes > +P.desde){
      const fin = +this._mas(lunes, -1) < +P.hasta ? this._mas(lunes, -1) : P.hasta;
      parciales.push({ inicio: P.desde, fin, dias: diasEntre(P.desde, fin) + 1 });
    }
    while (+lunes <= +P.hasta){
      const domingo = this._mas(lunes, 6);
      if (+domingo <= +P.hasta) completas.push({ inicio: lunes, fin: domingo });
      else parciales.push({ inicio: lunes, fin: P.hasta, dias: diasEntre(lunes, P.hasta) + 1 });
      lunes = this._mas(lunes, 7);
    }
    return { completas, parciales };
  },

  // ---------------------------------------------------------------
  // Bloques identificables y sugerencias de comparación
  // ---------------------------------------------------------------
  /* Tramos consecutivos de sesiones con la misma identidad de rutina
     (variante|días|revisión). Van de la primera a la última sesión del
     tramo: la copia no dice qué día exacto se cambió de rutina. El último
     tramo llega hasta el último registro solo si sigue siendo la rutina
     actual. */
  bloquesRutina(M){
    const out = [];
    M.sesiones.forEach(s => {
      const b = out[out.length - 1];
      if (b && b.clave === s.rutina){ b.hasta = soloDia(s.fecha); b.sesiones++; if (!b.diasRutina.includes(s.dia)) b.diasRutina.push(s.dia); }
      else out.push({ tipo: 'rutina', clave: s.rutina, desde: soloDia(s.fecha), hasta: soloDia(s.fecha), sesiones: 1, diasRutina: [s.dia] });
    });
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.clave === M.rutinaActual) ultimo.hasta = soloDia(M.ref);
    const vistas = new Map();
    out.forEach((b, i) => {
      b.id = `r${i}`;
      const n = parseInt(String(b.clave).split('|')[1], 10);
      const base = `${n >= 1 && n <= 7 ? `Rutina de ${n} días` : 'Rutina'} (${b.diasRutina.slice(0, 4).join(', ')}${b.diasRutina.length > 4 ? '…' : ''})`;
      // La misma descripción con otra identidad (otra revisión): se numera.
      const k = vistas.get(base) || 0;
      vistas.set(base, k + 1);
      b.etiqueta = k ? `${base} · versión ${k + 1}` : base;
      b.actual = i === out.length - 1 && b.clave === M.rutinaActual;
    });
    return out;
  },

  FASE_TXT: { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' },
  /* Fases de nutrición guardadas por la app (cerradas y la actual). */
  fasesNutricion(M){
    const n = M.datos.nutricion;
    if (!n || !n.presente) return [];
    const L = this.limites(M);
    const lista = [...(n.fasesCerradas || []), ...(n.fase ? [n.fase] : [])].filter(f => f && f.inicio);
    lista.sort((a, b) => a.inicio - b.inicio);
    return lista.map((f, i) => {
      // Una fase sin fin termina donde empieza la siguiente o en el último
      // registro (la actual).
      const sig = lista[i + 1];
      let fin = f.fin ? soloDia(f.fin) : sig ? this._mas(soloDia(sig.inicio), -1) : L.ultimo;
      if (+fin > +L.ultimo) fin = L.ultimo;
      return { tipo: 'fase', id: `f${i}`, faseTipo: f.tipo, desde: soloDia(f.inicio), hasta: fin,
               tasaObjetivo: f.tasaObjetivoPctSemana, actual: f === n.fase,
               etiqueta: `${this.FASE_TXT[f.tipo] || 'Fase'} de nutrición${f === n.fase ? ' (actual)' : ''}` };
    }).filter(f => +f.hasta >= +f.desde);
  },

  bloques(M){
    return [...this.bloquesRutina(M), ...this.fasesNutricion(M)];
  },

  /* Parejas propuestas. La primera es la predeterminada: las cuatro
     últimas semanas completas frente a las cuatro anteriores. */
  sugerencias(M){
    const L = this.limites(M), out = [];
    const domingo = L.ultimo.getDay() === 0 ? L.ultimo : this._mas(L.ultimo, -L.ultimo.getDay());
    const B = { desde: this._mas(domingo, -27), hasta: domingo }, A = { desde: this._mas(domingo, -55), hasta: this._mas(domingo, -28) };
    if (+A.hasta >= +L.primero) out.push({ id: 'semanas', etiqueta: 'Tus últimas 4 semanas completas frente a las 4 anteriores', A, B });
    // Último mes natural completo frente al anterior.
    const finMes = new Date(L.ultimo.getFullYear(), L.ultimo.getMonth() + 1, 0);
    const mB = +finMes === +L.ultimo ? L.ultimo.getMonth() : L.ultimo.getMonth() - 1;
    const BM = { desde: new Date(L.ultimo.getFullYear(), mB, 1), hasta: new Date(L.ultimo.getFullYear(), mB + 1, 0) };
    const AM = { desde: new Date(L.ultimo.getFullYear(), mB - 1, 1), hasta: new Date(L.ultimo.getFullYear(), mB, 0) };
    if (+AM.hasta >= +L.primero) out.push({ id: 'meses', etiqueta: 'Tu último mes completo frente al anterior', A: AM, B: BM });
    const r = this.bloquesRutina(M);
    if (r.length >= 2) out.push({ id: 'rutinas', etiqueta: 'Tus dos últimas rutinas', A: r[r.length - 2], B: r[r.length - 1] });
    const f = this.fasesNutricion(M);
    if (f.length >= 2) out.push({ id: 'fases', etiqueta: 'Tus dos últimas fases de nutrición', A: f[f.length - 2], B: f[f.length - 1] });
    return out;
  },

  /* Selección por defecto: la primera sugerencia; con menos de dos meses
     de datos, la primera y la segunda mitad de lo que cubre la copia. */
  predeterminada(M){
    const s = this.sugerencias(M)[0];
    if (s) return { A: { desde: s.A.desde, hasta: s.A.hasta }, B: { desde: s.B.desde, hasta: s.B.hasta } };
    const L = this.limites(M);
    const mitad = Math.floor((diasEntre(L.primero, L.ultimo) + 1) / 2);
    if (mitad < 1) return { A: { desde: L.primero, hasta: L.ultimo }, B: { desde: L.primero, hasta: L.ultimo } };
    return { A: { desde: L.primero, hasta: this._mas(L.primero, mitad - 1) }, B: { desde: this._mas(L.primero, mitad), hasta: L.ultimo } };
  },

  /* Selección en la dirección de la página: «AAAA-MM-DD_AAAA-MM-DD_…». */
  aTexto(sel){
    if (!sel || !sel.A || !sel.B) return '';
    const f = d => { const x = this._d(d); return x ? fmtISO(x) : ''; };
    return [f(sel.A.desde), f(sel.A.hasta), f(sel.B.desde), f(sel.B.hasta)].join('_');
  },
  deTexto(txt){
    const m = String(txt || '').match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
    if (!m) return null;
    const d = s => this._d(s);
    if (![m[1], m[2], m[3], m[4]].every(d)) return null;
    return { A: { desde: d(m[1]), hasta: d(m[2]) }, B: { desde: d(m[3]), hasta: d(m[4]) } };
  },

  // ---------------------------------------------------------------
  // Medidas de un periodo
  // ---------------------------------------------------------------
  /* Series por grupo de una lista de sesiones, con el reparto de la app. */
  seriesGrupos(M, sesiones, sinGrupo = null){
    const tot = new Map(Motor.GRUPOS_VOLUMEN.map(g => [g, 0]));
    const info = n => { const i = Analisis.info(M, n); if (!i && sinGrupo) sinGrupo.add(n); return i; };
    sesiones.forEach(s => s.entradas.forEach(e => {
      const v = Motor.seriesPorGrupo(e, info);
      if (v) v.forEach((x, g) => tot.set(g, tot.get(g) + x));
    }));
    return tot;
  },

  duracionValida(s){ return s.duracionMin != null && !s.duracionAnomala && s.duracionMin >= this.DURACION_MIN; },

  medir(M, P){
    const ses = Analisis.enPeriodo(M.sesiones, P.desde, P.hasta);
    const sem = this.semanas(P);
    const sinGrupo = new Set();

    // --- frecuencia, constancia y volumen por semana completa ---
    const filas = [];
    const fila = (w, parcial) => {
      const dentro = Analisis.enPeriodo(ses, w.inicio, w.fin);
      const plan = parcial ? { conocido: false, motivo: 'parcial' } : Analisis.planSemana(M, w.inicio, w.fin, dentro);
      const series = this.seriesGrupos(M, dentro, sinGrupo);
      return { inicio: w.inicio, fin: w.fin, parcial, dias: parcial ? w.dias : 7, sesiones: dentro.length,
               diasSesion: new Set(dentro.map(s => fmtISO(s.fecha))).size,
               previstas: plan.conocido ? plan.previstas : null, motivo: plan.motivo || null,
               descarga: dentro.some(s => s.descarga), series,
               seriesTotal: [...series.values()].reduce((a, b) => a + b, 0) };
    };
    [...sem.completas.map(w => fila(w, false)), ...sem.parciales.map(w => fila(w, true))]
      .sort((a, b) => a.inicio - b.inicio).forEach(f => filas.push(f));
    const completas = filas.filter(f => !f.parcial), parciales = filas.filter(f => f.parcial);
    const nc = completas.length;
    const conocidas = completas.filter(f => f.previstas != null);
    const porGrupo = new Map(Motor.GRUPOS_VOLUMEN.map(g => [g,
      nc ? completas.reduce((a, f) => a + f.series.get(g), 0) / nc : null]));
    const totalGrupos = this.seriesGrupos(M, ses);

    // --- tiempo de entrenamiento ---
    const durValidas = ses.filter(s => this.duracionValida(s)).map(s => s.duracionMin);

    // --- rendimiento guardado por la app ---
    const conRend = ses.filter(s => !s.descarga && !s.sinBase && s.bruto != null);
    const conNeto = ses.filter(s => !s.descarga && s.neto != null);
    const veredictos = {};
    ses.filter(s => !s.descarga && s.veredicto).forEach(s => { veredictos[s.veredicto] = (veredictos[s.veredicto] || 0) + 1; });

    // --- contexto de las sesiones ---
    const rutinas = [...new Set(ses.map(s => s.rutina))];
    const cardio = (M.datos.cardio || []).filter(c => c.fecha && this._dentro(c.fecha, P)).length;

    return {
      P, dias: P.dias, semanasCompletas: nc,
      diasParciales: parciales.reduce((a, f) => a + f.dias, 0), sesionesParciales: parciales.reduce((a, f) => a + f.sesiones, 0),
      semanas: filas,
      sesiones: ses.length, indices: ses.map(s => s.indice), cardio,
      diasSesion: new Set(ses.map(s => fmtISO(s.fecha))).size,
      sesionesPorSemana: nc ? completas.reduce((a, f) => a + f.sesiones, 0) / nc : null,
      diasPorSemana: nc ? completas.reduce((a, f) => a + f.diasSesion, 0) / nc : null,
      constancia: { semanas: conocidas.length, hechas: conocidas.reduce((a, f) => a + f.diasSesion, 0),
                    previstas: conocidas.reduce((a, f) => a + f.previstas, 0) },
      descargas: ses.filter(s => s.descarga).length,
      seriesPorSemana: nc ? completas.reduce((a, f) => a + f.seriesTotal, 0) / nc : null,
      porGrupo, totalGrupos, seriesTotal: [...totalGrupos.values()].reduce((a, b) => a + b, 0), sinGrupo: [...sinGrupo],
      duracion: { media: this._media(durValidas), n: durValidas.length, sinDato: ses.length - durValidas.length,
                  total: durValidas.reduce((a, b) => a + b, 0) },
      rendimiento: { bruto: this._media(conRend.map(s => s.bruto)), nBruto: conRend.length,
                     neto: this._media(conNeto.map(s => s.neto)), nNeto: conNeto.length, veredictos },
      rutinas, cambioRutina: ses.some((s, i) => i > 0 && s.cambioRutina),
      molestias: ses.filter(s => s.entradas.some(e => e.molestias)).length,
      noVerdes: ses.filter(s => !s.descarga && s.semaforo !== 'verde').length,
      peso: this.peso(M, P), contornos: this.contornos(M, P), composicion: this.composicion(M, P),
      nutricion: this.nutricion(M, P), recuperacion: this.recuperacion(M, P),
    };
  },

  /* Peso tendencia de la app en el primer y el último pesaje del periodo.
     Sin pesajes suficientes no hay cambio; nunca se extrapola. */
  peso(M, P){
    const N = M.datos.nut;
    if (!N || !N.pesajes || !N.pesajes.length) return null;
    const pes = N.pesajes.filter(p => this._dentro(p.fecha, P));
    const tend = p => {
      if (!N.serie || N.serie.vacia) return null;
      const t = N.serie.puntos[N.serie.indice.get(p.clave)];
      return t && t.tendenciaKg > 0 ? t.tendenciaKg : null;
    };
    const conT = pes.filter(p => tend(p) != null);
    const ini = conT[0] || null, fin = conT.length ? conT[conT.length - 1] : null;
    const span = ini && fin ? diasEntre(ini.fecha, fin.fecha) : 0;
    const cambio = conT.length >= 2 && span > 0 ? tend(fin) - tend(ini) : null;
    return { pesajes: pes.length, media: this._media(pes.map(p => p.pesoKg)),
             inicio: ini ? { fecha: ini.fecha, kg: tend(ini) } : null, fin: fin ? { fecha: fin.fecha, kg: tend(fin) } : null,
             cambio, span, porSemana: cambio != null && span >= 7 ? cambio / (span / 7) : null };
  },

  SITIOS: ['cuello', 'hombros', 'pecho', 'biceps_izq', 'biceps_der', 'antebrazo_izq', 'antebrazo_der', 'cintura', 'abdomen',
           'cadera', 'muslo_izq', 'muslo_der', 'gemelo_izq', 'gemelo_der'],
  /* Contornos registrados dentro del periodo (mismas validaciones que la
     app: cm entre 10 y 300 y sitio conocido; uno por día y sitio). */
  contornos(M, P){
    const md = M.raw.medidas && typeof M.raw.medidas === 'object' ? M.raw.medidas : null;
    if (!md || !Array.isArray(md.registros)) return null;
    const por = new Map();
    md.registros.forEach(r => {
      if (!r || typeof r.cm !== 'number' || r.cm < 10 || r.cm > 300 || !this.SITIOS.includes(r.sitio)) return;
      const f = this._d(r.fecha);
      if (!f || !this._dentro(f, P)) return;
      if (!por.has(r.sitio)) por.set(r.sitio, new Map());
      const m = por.get(r.sitio), k = fmtISO(f);
      if (!m.has(k)) m.set(k, { fecha: f, cm: r.cm });
    });
    const out = new Map();
    por.forEach((m, sitio) => {
      const xs = [...m.values()].sort((a, b) => a.fecha - b.fecha);
      out.set(sitio, { n: xs.length, primera: xs[0], ultima: xs[xs.length - 1],
                       cambio: xs.length >= 2 ? xs[xs.length - 1].cm - xs[0].cm : null });
    });
    return out;
  },

  composicion(M, P){
    const N = M.datos.nut;
    if (!N || !N.mediciones || !N.mediciones.length) return null;
    const xs = N.mediciones.filter(m => this._dentro(m.fecha, P));
    if (!xs.length) return { n: 0 };
    return { n: xs.length, primera: xs[0], ultima: xs[xs.length - 1] };
  },

  RECO: { ADJUST: 'ajustes de calorías', HOLD: 'semanas sin cambios', REFEED: 'refeeds propuestos', LOWER_TARGET: 'bajadas del ritmo objetivo', END_PHASE: 'propuestas de cerrar la fase' },
  /* Contexto de nutrición: fases que se solapan con el periodo (días de
     cada una), refeeds y recomendaciones semanales que emitió la app. */
  nutricion(M, P){
    const n = M.datos.nutricion;
    if (!n || !n.presente) return null;
    const fases = this.fasesNutricion(M).map(f => {
      const a = +f.desde > +P.desde ? f.desde : P.desde, b = +f.hasta < +P.hasta ? f.hasta : P.hasta;
      return +a <= +b ? { tipo: f.faseTipo, etiqueta: this.FASE_TXT[f.faseTipo] || f.faseTipo, dias: diasEntre(a, b) + 1, tasaObjetivo: f.tasaObjetivo } : null;
    }).filter(Boolean);
    const recos = (n.recomendaciones || []).filter(r => r.fecha && this._dentro(r.fecha, P));
    const porTipo = {};
    recos.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1; });
    const ajustes = recos.filter(r => r.tipo === 'ADJUST' && r.ajusteKcalDia != null).map(r => r.ajusteKcalDia);
    return { activo: n.activo, fases, diasSinFase: P.dias - fases.reduce((a, f) => a + f.dias, 0),
             refeeds: (n.refeeds || []).filter(r => this._dentro(r.inicio, P)).length,
             recomendaciones: recos.length, porTipo, ajusteKcal: ajustes.length ? ajustes.reduce((a, b) => a + b, 0) : null };
  },

  /* Recuperación registrada: cuestionario, VFC, FC en reposo y reloj. Un
     día sin dato es un hueco: las medias solo usan días con dato. */
  recuperacion(M, P){
    const R = M.datos.readiness.filter(r => this._dentro(r.fecha, P));
    const est = R.filter(r => r.estadoEntrenar != null).map(r => r.estadoEntrenar);
    let vfc = [], fc = [];
    try { vfc = VFC.validas(M.datos.readiness).filter(v => this._dentro(v.fecha, P)).map(v => v.vfc); } catch (_) { vfc = []; }
    try { fc = FCReposo.validas(M.datos.readiness).filter(v => this._dentro(v.fecha, P)).map(v => v.fcReposo); } catch (_) { fc = []; }
    const S = (M.datos.salud || []).filter(d => this._dentro(d.fecha, P));
    const sueno = S.filter(d => d.sueno && d.sueno.total).map(d => d.sueno.total);
    const pasos = S.filter(d => d.pasos != null).map(d => d.pasos);
    return { cuestionarios: R.length, estadoN: est.length, estadoMedio: this._media(est),
             diasBajos: est.filter(x => x < Analisis.ESTADO_BAJO).length,
             vfc: this._media(vfc), nVfc: vfc.length, fc: this._media(fc), nFc: fc.length,
             suenoMin: this._media(sueno), nSueno: sueno.length, pasos: this._media(pasos), nPasos: pasos.length,
             enfermo: R.filter(r => r.enfermo).length };
  },

  // ---------------------------------------------------------------
  // Ejercicios comunes con rendimiento compatible
  // ---------------------------------------------------------------
  /* Para cada ejercicio con series en los dos periodos: sesiones
     comparables (mismas exclusiones que Mi resumen) con la misma modalidad
     de series en ambos; media del 1RM estimado de marca de cada periodo.
     Con pocas sesiones en alguno de los dos no se da diferencia. */
  ejercicios(M, PA, PB){
    const comunes = [], soloA = [], soloB = [], porTiempo = [];
    M.ejercicios.forEach(ej => {
      const en = P => ej.puntos.filter(p => p.hechas > 0 && this._dentro(p.fecha, P));
      const a = en(PA), b = en(PB);
      if (!a.length && !b.length) return;
      if (!a.length){ soloB.push(ej.nombre); return; }
      if (!b.length){ soloA.push(ej.nombre); return; }
      if (ej.porTiempo){ porTiempo.push(ej.nombre); return; }
      const va = a.filter(p => !Analisis.motivoNoComparable(p)), vb = b.filter(p => !Analisis.motivoNoComparable(p));
      // Modalidad de referencia: la de la última sesión válida de B (o de A).
      const ref = vb.length ? vb[vb.length - 1] : va.length ? va[va.length - 1] : null;
      const config = ref ? Analisis.configuracion(ref) : null;
      const pa = va.filter(p => Analisis.configuracion(p) === config), pb = vb.filter(p => Analisis.configuracion(p) === config);
      const ma = this._media(pa.map(p => p.e1rmMarca)), mb = this._media(pb.map(p => p.e1rmMarca));
      const avisos = [];
      if (config && ((va.length && !pa.length) || (vb.length && !pb.length))) avisos.push('modalidad');
      const ra = new Set(a.map(p => p.sesion.rutina)), rb = new Set(b.map(p => p.sesion.rutina));
      if (![...ra].some(k => rb.has(k))) avisos.push('rutina');
      if (ej.pesoCorporal) avisos.push('pesoCorporal');
      const suficiente = pa.length >= this.MIN_COMPARABLES && pb.length >= this.MIN_COMPARABLES;
      if (!suficiente) avisos.push('muestra');
      const deltaPct = suficiente && ma > 0 ? (mb - ma) / ma * 100 : null;
      comunes.push({ ej, nombre: ej.nombre, sesionesA: a.length, sesionesB: b.length, nA: pa.length, nB: pb.length,
                     config, mediaA: ma, mediaB: mb, mejorA: pa.length ? Math.max(...pa.map(p => p.e1rmMarca)) : null,
                     mejorB: pb.length ? Math.max(...pb.map(p => p.e1rmMarca)) : null,
                     deltaPct, lectura: deltaPct == null ? 'insuficiente' : Motor.lecturaProgreso(deltaPct),
                     puntosA: pa, puntosB: pb, avisos });
    });
    const orden = (x, y) => x.localeCompare(y);
    comunes.sort((x, y) => (x.deltaPct == null) - (y.deltaPct == null) || orden(x.nombre, y.nombre));
    return { comunes, soloA: soloA.sort(orden), soloB: soloB.sort(orden), porTiempo: porTiempo.sort(orden) };
  },

  // ---------------------------------------------------------------
  // Comparación completa y diferencias de contexto
  // ---------------------------------------------------------------
  comparar(M, selA, selB){
    const PA = this.periodo(M, selA), PB = this.periodo(M, selB);
    if (PA.error || PB.error) return { error: true, PA, PB };
    const A = this.medir(M, PA), B = this.medir(M, PB);
    const ejercicios = this.ejercicios(M, PA, PB);
    const avisos = [];
    const av = (id, texto) => avisos.push({ id, texto });
    if (+PA.desde <= +PB.hasta && +PB.desde <= +PA.hasta)
      av('solape', 'Los dos periodos se solapan: los días comunes cuentan en los dos.');
    if (PA.dias !== PB.dias)
      av('duracion', `Los periodos no duran lo mismo (${PA.dias} y ${PB.dias} días). Compara las cifras por semana; los totales no son equivalentes.`);
    [[PA, 'A'], [PB, 'B']].forEach(([P, x]) => {
      if (P.recortado) av(`recorte${x}`, `El periodo ${x} se ha ajustado a los días que cubre tu copia.`);
    });
    [[A, 'A'], [B, 'B']].forEach(([m, x]) => {
      if (!m.semanasCompletas) av(`semanas${x}`, `El periodo ${x} no contiene ninguna semana completa de lunes a domingo: no hay medias semanales.`);
      if (m.sesiones < this.MIN_SESIONES_MUESTRA) av(`muestra${x}`, `El periodo ${x} tiene pocas sesiones de fuerza: cualquier diferencia es poco representativa.`);
      if (m.cambioRutina) av(`cambio${x}`, `Dentro del periodo ${x} cambiaste de rutina.`);
    });
    const comunR = A.rutinas.some(k => B.rutinas.includes(k));
    if (A.rutinas.length && B.rutinas.length && !comunR)
      av('rutinas', 'Entrenaste con rutinas distintas en cada periodo: el objetivo de repeticiones, el orden y los ejercicios pueden haber cambiado.');
    if ((A.descargas > 0) !== (B.descargas > 0))
      av('descarga', `Solo el periodo ${A.descargas ? 'A' : 'B'} incluye sesiones de descarga.`);
    const fasesTxt = m => (m.nutricion ? m.nutricion.fases.map(f => f.tipo) : []).sort().join(',');
    if (A.nutricion && B.nutricion && fasesTxt(A) !== fasesTxt(B))
      av('fases', 'La fase de nutrición no es la misma en los dos periodos.');
    if ((A.recuperacion.cuestionarios > 0) !== (B.recuperacion.cuestionarios > 0))
      av('cuestionario', `Solo el periodo ${A.recuperacion.cuestionarios ? 'A' : 'B'} tiene cuestionarios diarios.`);
    return { PA, PB, A, B, ejercicios, avisos };
  },
};
