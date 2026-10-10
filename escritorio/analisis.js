'use strict';
/* ================================================================
   TrueLift Escritorio — analisis.js
   Modelo personal de una copia JSON: sesiones, ejercicios, estado de
   progresión, valoración, volumen y contexto. Solo cálculo, sin DOM.

   Reglas: ../coach/motor.js (portadas del móvil). Normalización,
   nutrición, VFC y FC en reposo: ../coach/data.js y nutricion.js.
   Las definiciones y sus diferencias con el móvil están en
   escritorio/METRICAS.md.

   Nada de lo que hay aquí muta la copia: se trabaja sobre el objeto
   recién parseado del texto original guardado.
   ================================================================ */

const Analisis = {

  /* Fecha de referencia: el último registro de la copia. La copia no dice
     cuándo se exportó, así que «hoy» para la persona es lo último que
     anotó; todo lo que depende de una ventana de días se mide desde ahí. */
  referencia(resumen){
    const d = resumen && resumen.ultimoRegistro ? parseFecha(resumen.ultimoRegistro) : null;
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) : null;
  },

  preparar(raw, resumen){
    const ref = this.referencia(resumen) || new Date();
    const datos = normalizar(raw, { hoy: ref });
    const pc = typeof raw.pesoCorporal === 'number' && raw.pesoCorporal > 0 ? raw.pesoCorporal : null;
    const combo = `${raw.sexo}_${raw.sistema}|${raw.dias}`;
    const planMod = Array.isArray(raw.planMod) ? raw.planMod.filter(p => p && typeof p === 'object') : [];
    // La rutina guardada en la copia es la que usa el móvil cuando es de su
    // combinación actual (y la persona tiene PRO, que el escritorio no lee).
    const planConocido = planMod.length > 0 && raw.planModKey === combo;
    const M = {
      raw, ref, datos, pc, combo, planMod, planConocido,
      descarga: raw.modoDescarga === true,
      sistema: raw.sistema === 'simple' ? 'simple' : 'doble',
      rutinaActual: Motor.rutinaKeyActual(raw),
      primerRegistro: resumen && resumen.primerRegistro ? parseFecha(resumen.primerRegistro) : null,
    };
    M.sesiones = this.sesiones(M);
    M.ejercicios = this.ejercicios(M);
    M.valoracion = this.valoracion(M);
    M.recuperacion = this.recuperacion(M);
    return M;
  },

  // ---------------------------------------------------------------
  // Sesiones de fuerza (orden cronológico) con sus métricas guardadas
  // ---------------------------------------------------------------
  sesiones(M){
    const logs = Array.isArray(M.raw.logs) ? M.raw.logs : [];
    const out = [];
    logs.forEach((l, indice) => {
      if (!l || typeof l !== 'object' || Motor.esCardio(l)) return;
      const fecha = parseFecha(l.fecha);
      if (!fecha) return;
      const entradas = Motor.entradasDe(l);
      out.push({
        indice, l, fecha, dia: typeof l.dia === 'string' ? l.dia : '—', entradas,
        rutina: Motor.rutinaKeyDeLog(l),
        deRutinaActual: Motor.esLogDeRutinaActual(l, M.raw),
        descarga: l.descarga === true,
        semaforo: Motor.estadoSemaforo(l),
        bruto: Motor.rawPctGrafica(l), neto: Motor.netPctGrafica(l),
        sinBase: l.displayBaselinePoint === true,
        veredicto: Motor.veredictoDeLog(l, Motor._num(l.tolPctAtSave) ?? 3),
        volumenBajo: l.volumenBajo === true,
        duracionMin: Motor._num(l.duracionMin), duracionAnomala: l.duracionAnomala === true,
        rpe: Motor._num(l.sessionRpe),
        series: entradas.reduce((s, e) => s + (e.noDisponible ? 0 : Motor.seriesHechas(e)), 0),
      });
    });
    out.sort((a, b) => a.fecha - b.fecha || a.indice - b.indice);
    // Cambio de rutina: la identidad variante|días|revisión cambia respecto a
    // la sesión anterior. Es un dato de la copia, no una deducción.
    out.forEach((s, i) => { s.cambioRutina = i > 0 && s.rutina !== out[i - 1].rutina; });
    return out;
  },

  // ---------------------------------------------------------------
  // Ejercicios: historial por entrada y estado de progresión
  // ---------------------------------------------------------------
  ejercicios(M){
    const mapa = new Map();
    M.sesiones.forEach(s => {
      s.entradas.forEach((e, pos) => {
        if (!e.ejercicio) return;
        let ej = mapa.get(e.ejercicio);
        if (!ej){
          ej = { nombre: e.ejercicio, porTiempo: Motor.esPorTiempo(e.ejercicio, M.raw),
                 pesoCorporal: Motor.esPesoCorporal(e.ejercicio), asistido: Motor.esAsistido(e.ejercicio),
                 puntos: [], marca: null };
          mapa.set(e.ejercicio, ej);
        }
        ej.puntos.push(this.punto(M, s, e, pos, ej));
      });
    });
    mapa.forEach(ej => {
      // Marcas: misma regla que el móvil; se anota qué sesión la superó.
      let mejor = null;
      ej.puntos.forEach(p => {
        if (p.e1rmMarca == null) return;
        if (mejor == null || p.e1rmMarca > mejor.valor){
          p.superaMarca = mejor != null;
          mejor = { valor: p.e1rmMarca, fecha: p.fecha, punto: p };
        }
      });
      ej.marca = mejor;
      const hechos = ej.puntos.filter(p => p.hechas > 0);
      ej.sesiones = hechos.length;
      ej.ultimo = hechos.length ? hechos[hechos.length - 1] : null;
      ej.primero = hechos.length ? hechos[0] : null;
      ej.lineas = M.planConocido ? M.planMod.filter(l => Motor.nombreVigente(l.ejercicio) === ej.nombre) : [];
      ej.grupo = this.info(M, ej.nombre)?.grupo || (ej.lineas[0] && ej.lineas[0].grupo) || null;
      ej.estados = this.estados(M, ej);
    });
    return mapa;
  },

  punto(M, s, e, pos, ej){
    const hechas = e.noDisponible ? 0 : Motor.seriesHechas(e);
    const mejor = ej.porTiempo ? null : Motor.mejorSerie(e, M.pc, { cap: null });
    const puedeMarca = !ej.porTiempo && Motor.puedeFijarMarca(s.l, e);
    const marca = puedeMarca ? Motor.mejorSerie(e, M.pc, { cap: Motor.CAP_REPS_E1RM }) : null;
    const kgDistintos = new Set(e.kgSets.filter(k => k != null)).size > 1;
    return {
      fecha: s.fecha, dia: s.dia, sesion: s, e, pos, hechas,
      repsTot: e.reps.reduce((a, r) => a + (r == null ? 0 : r), 0),
      cargaTop: e.kg,                                          // lo que teclea el usuario (lastre en peso corporal)
      cargaVista: Motor.cargaOrientada(e.ejercicio, e.kg),     // asistencia en positivo
      // e1RM: sin carga efectiva no hay estimación (peso corporal sin peso de perfil).
      e1rm: (ej.pesoCorporal && M.pc == null) ? null : (mejor ? mejor.e1rm : null),
      e1rmMenosFiable: !!(mejor && mejor.menosFiable),
      e1rmMarca: (ej.pesoCorporal && M.pc == null) ? null : (marca ? marca.e1rm : null),
      mejor: (ej.pesoCorporal && M.pc == null) ? null : mejor,
      marcaSerie: (ej.pesoCorporal && M.pc == null) ? null : marca,
      noVerde: Motor.estadoDeEntrada(s.l, e) !== 'verde',
      evaluable: !e.noDisponible && !Motor.noEvaluable(e) && !s.descarga,
      topBack: kgDistintos && !e.dropSet,
      superaMarca: false,
    };
  },

  /* Estado de progresión por línea de la rutina actual, con el contador de
     intentos del móvil. Fuera de la rutina actual (o si la copia no trae la
     rutina en uso) solo se describe; nunca se declara un estancamiento. */
  estados(M, ej){
    if (ej.porTiempo) return [{ tipo: 'porTiempo' }];
    if (!ej.lineas.length) return [{ tipo: M.planConocido ? 'fueraDeRutina' : 'rutinaDesconocida' }];
    return ej.lineas.map(linea => {
      const dia = linea.dia;
      const objetivo = Motor.objetivoLinea(linea, M.raw.sistema, M.raw);
      const base = { dia, objetivo, reps: linea.reps, max: Motor.intentosMax(M.raw.fasePeso) };
      if (objetivo == null) return { ...base, tipo: 'sinObjetivo' };
      const op = Motor.oportunidades(M.raw, ej.nombre, dia, objetivo, { max: base.max + 5 });
      const consumidos = Motor.sesionesEstancadas(op.map(o => o.kg), op.map(o => o.completo));
      const recurrente = op.length && op[0].entrada.estancamientoRecurrente;
      // `op` son las oportunidades que cuentan, de la más reciente a la más
      // antigua; las `consumidos` primeras forman la racha del contador.
      const r = { ...base, consumidos, oportunidades: op.length, ultima: op[0] || null, recurrente: !!recurrente,
                  descarga: M.descarga, op };
      if (!op.length) return { ...r, tipo: 'sinOportunidades' };
      if (op[0].completo) return { ...r, tipo: 'objetivoCumplido' };
      if (consumidos >= base.max) return { ...r, tipo: 'intentosAgotados' };
      return { ...r, tipo: 'enCurso' };
    });
  },

  /* Grupo, patrón y secundarios de un ejercicio, como `infoDe` del móvil:
     biblioteca de la app (catálogo) y, después, ejercicios propios. */
  info(M, nombre){
    if (typeof CAT_FICHA === 'object' && CAT_FICHA[nombre]) return CAT_FICHA[nombre];
    const propio = (Array.isArray(M.raw.ejerciciosUsuario) ? M.raw.ejerciciosUsuario : [])
      .find(e => e && e.nombre === nombre);
    if (propio) return { grupo: propio.grupo, patron: propio.patron,
                         secundarios: Array.isArray(propio.secundarios) ? propio.secundarios : [] };
    return null;
  },

  // ---------------------------------------------------------------
  // Valoración del progreso (misma regla que la tarjeta de Progreso)
  // ---------------------------------------------------------------
  valoracion(M){
    const pts = Motor.puntosValoracion(M.raw.logs, M.ref);
    const { tol, guardada } = Motor.tolerancia(M.raw, M.ref);
    const tendencia = M.descarga ? null : Motor.tendenciaValoracion(pts.map(p => p.pct), tol);
    const ventana = pts.slice(-Motor.VALORACION_VENTANA);
    return { tendencia, tol, tolGuardada: guardada, puntos: pts, ventana, descarga: M.descarga,
             altos: ventana.filter(p => p.pct >= tol).length, bajos: ventana.filter(p => p.pct <= -tol).length };
  },

  ESTADO_BAJO: 70,
  /* Días con «estado para entrenar» bajo en los 14 días previos a la
     referencia (recuperacionValoracion). Solo si el cuestionario está activo. */
  recuperacion(M, ref = M.ref){
    const activo = M.raw.readinessActivo === true;
    const desde = +ref - 14 * 86400000;
    let bajos = 0, registrados = 0;
    (Array.isArray(M.raw.readinessDiario) ? M.raw.readinessDiario : []).forEach(r => {
      if (!r || typeof r.estadoEntrenar !== 'number') return;
      const f = parseFecha(r.fecha);
      if (!f || +f < desde || +f > +ref) return;
      registrados++;
      if (r.estadoEntrenar < this.ESTADO_BAJO) bajos++;
    });
    let lectura = 'sinDato';
    if (activo && registrados >= 4){
      const k = bajos / registrados;
      lectura = k >= 0.5 ? 'cargada' : k <= 0.25 ? 'buena' : 'sinDato';
    }
    return { activo, bajos, registrados, lectura, desde: new Date(desde), hasta: ref };
  },

  // ---------------------------------------------------------------
  // Volumen real por grupo y semana
  // ---------------------------------------------------------------
  volumen(M, { gran = 'semana', desde = null } = {}){
    const sinGrupo = new Set();
    const info = n => { const i = this.info(M, n); if (!i) sinGrupo.add(n); return i; };
    const cubos = Motor.volumenReal({ logs: M.raw.logs, info, hoy: M.ref, gran, desde });
    return { cubos, sinGrupo: [...sinGrupo] };
  },

  /* Series planificadas por grupo y días que se trabaja cada grupo, con el
     mismo reparto que el volumen real (primario ×1, secundarios ×0,5). */
  volumenPlan(M, lineas){
    const series = new Map(), dias = new Map();
    lineas.forEach(l => {
      const n = Math.max(0, Motor._int(l.series) ?? 0);
      const e = Motor.entrada({ ejercicio: l.ejercicio, reps: new Array(n).fill(1) });
      const v = Motor.seriesPorGrupo(e, nombre => this.info(M, nombre) ||
        (l.grupo ? { grupo: l.grupo, patron: l.patron, secundarios: [] } : null));
      if (!v) return;
      v.forEach((x, g) => {
        series.set(g, (series.get(g) || 0) + x);
        if (x >= 1){ if (!dias.has(g)) dias.set(g, new Set()); dias.get(g).add(l.dia); }
      });
    });
    return { series, dias: new Map([...dias].map(([g, s]) => [g, s.size])) };
  },

  // ---------------------------------------------------------------
  // Fase 3 — resumen personal y ficha por ejercicio.
  // Reglas deterministas; definiciones en escritorio/METRICAS.md §Fase 3.
  // ---------------------------------------------------------------

  /* Ventana de las lecturas del resumen: las cuatro semanas que terminan en
     el último registro (la misma que la valoración de la app). */
  VENTANA_DIAS: 28,
  /* Una lectura de ejercicio se convierte en conclusión solo si no depende
     de una única sesión: hacen falta varios puntos comparables y que las dos
     últimas sesiones queden del mismo lado que el arranque. */
  MIN_PUNTOS_FIRME: 4,

  _dias(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); },
  _lunes(d){ const x = soloDia(d); return this._dias(x, -((x.getDay() + 6) % 7)); },
  _pct(n, dec = 1){ return n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n), dec)} %`; },
  _kg(n, dec = 1){ return n == null ? '—' : `${fmtNum(n, dec)} kg`; },
  _n(n, uno, varios){ return `${n} ${n === 1 ? uno : varios}`; },
  /* Serie elegida por una estimación, tal como se anotó: «80 kg × 8 @2»;
     en peso corporal se dice si es lastre o asistencia. */
  serieTxt(e, m){
    if (!m) return '—';
    const kg = Motor.cargaOrientada(e.ejercicio, Motor.kgSerie(e, m.serie));
    const carga = Motor.esAsistido(e.ejercicio) ? `asistencia ${fmtNum(kg, 2)} kg`
      : Motor.esPesoCorporal(e.ejercicio) ? (kg ? `lastre ${fmtNum(kg, 2)} kg` : 'peso corporal') : `${fmtNum(kg, 2)} kg`;
    return `${carga} × ${m.reps} @${m.rir}`;
  },
  _lista(xs){ return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`; },

  // ---------- constancia ----------
  /* Rutina en vigor una semana (lunes-domingo). La copia no guarda la
     planificación pasada, pero cada sesión anota su rutina (variante, días
     por semana y revisión). Se da por conocida si la última sesión anterior
     a la semana, las de la semana y la primera posterior son de la misma
     rutina; tras la última sesión rige la rutina actual solo si es esa misma.
     Si no, lo previsto queda sin calcular. */
  planSemana(M, lunes, domingo, dentro){
    const ses = M.sesiones;
    let prev = null, next = null;
    for (const s of ses){
      const d = +soloDia(s.fecha);
      if (d < +lunes) prev = s;
      else if (d > +domingo && !next) next = s;
    }
    if (!prev) return { conocido: false, motivo: 'inicio' };
    const claves = new Set([prev.rutina, ...dentro.map(s => s.rutina)]);
    if (next) claves.add(next.rutina);
    else {
      if (ses[ses.length - 1].rutina !== M.rutinaActual) return { conocido: false, motivo: 'cambioRutina' };
      claves.add(M.rutinaActual);
    }
    if (claves.size !== 1) return { conocido: false, motivo: 'cambioRutina' };
    const rutina = [...claves][0];
    const dias = parseInt(rutina.split('|')[1], 10);
    if (!(dias >= 1 && dias <= 7)) return { conocido: false, motivo: 'sinDias' };
    return { conocido: true, previstas: dias, rutina };
  },

  /* Semanas completas previas al último registro (y, aparte, la semana en
     curso si el último registro no es domingo). */
  constancia(M, { semanas = 4 } = {}){
    const ref = soloDia(M.ref);
    const lunesRef = this._lunes(ref);
    const enCurso = +ref < +this._dias(lunesRef, 6);
    const desplaz = enCurso ? 1 : 0;
    const filas = [];
    const semana = (lunes, parcial) => {
      const domingo = this._dias(lunes, 6);
      const hasta = parcial ? ref : domingo;
      const dentro = M.sesiones.filter(s => { const d = +soloDia(s.fecha); return d >= +lunes && d <= +hasta; });
      const plan = parcial ? { conocido: false, motivo: 'enCurso' } : this.planSemana(M, lunes, domingo, dentro);
      return { inicio: lunes, fin: domingo, hasta, parcial, sesiones: dentro.length,
               dias: new Set(dentro.map(s => fmtISO(s.fecha))).size, descarga: dentro.some(s => s.descarga),
               previstas: plan.conocido ? plan.previstas : null, motivo: plan.motivo || null, indices: dentro.map(s => s.indice) };
    };
    for (let k = semanas - 1 + desplaz; k >= desplaz; k--) filas.push(semana(this._dias(lunesRef, -7 * k), false));
    const actual = enCurso ? semana(lunesRef, true) : null;
    const conocidas = filas.filter(f => f.previstas != null);
    return { semanas: filas, actual, conocidas: conocidas.length,
             hechas: conocidas.reduce((a, f) => a + f.dias, 0), previstas: conocidas.reduce((a, f) => a + f.previstas, 0),
             desde: filas[0].inicio, hasta: filas[filas.length - 1].fin };
  },

  // ---------- ejercicios comparables ----------
  /* Configuración de series: dos sesiones solo se comparan si se hicieron
     con la misma modalidad (normal, top + back-off, drop set, rest-pause). */
  configuracion(p){
    return p.e.dropSet ? 'drop' : p.e.restPause ? 'restPause' : p.topBack ? 'topBack' : 'normal';
  },
  MODALIDAD_TXT: { normal: 'series normales', topBack: 'top + back-off', drop: 'drop set', restPause: 'rest-pause' },

  /* Motivo por el que una sesión del ejercicio no entra en la comparación
     (null si entra). Mismas exclusiones que las marcas de la app, más la
     descarga, que en una comparación de nivel no es una sesión normal. */
  motivoNoComparable(p){
    if (p.hechas <= 0) return 'sinSeries';
    if (p.sesion.descarga) return 'descarga';
    if (p.e.molestias) return 'molestias';
    if (p.e.sustitucion) return 'cambioDia';
    if (p.noVerde) return 'noVerde';
    if (p.e1rmMarca == null) return 'sinEstimacion';
    return null;
  },
  MOTIVO_TXT: { sinSeries: 'sin series anotadas', descarga: 'descarga', molestias: 'con molestias', cambioDia: 'cambio de un día',
                noVerde: 'día ámbar o rojo', sinEstimacion: 'sin estimación posible', otraConfig: 'otra modalidad de series' },

  /* Evolución del 1RM estimado de un ejercicio en [desde, hasta]: puntos
     comparables con la modalidad de la sesión válida más reciente; extremos y
     cortes del informe mensual de la app. */
  evolucionEjercicio(M, ej, desde, hasta){
    const a = +soloDia(desde), b = +soloDia(hasta);
    const enPeriodo = ej.puntos.filter(p => { const d = +soloDia(p.fecha); return d >= a && d <= b; });
    const excluidos = {};
    const validos = [];
    enPeriodo.forEach(p => {
      const m = this.motivoNoComparable(p);
      if (m) excluidos[m] = (excluidos[m] || 0) + 1; else validos.push(p);
    });
    const config = validos.length ? this.configuracion(validos[validos.length - 1]) : null;
    const puntos = validos.filter(p => {
      if (this.configuracion(p) === config) return true;
      excluidos.otraConfig = (excluidos.otraConfig || 0) + 1;
      return false;
    });
    const serie = puntos.map(p => p.e1rmMarca);
    const [inicio, fin] = Motor.extremosComparables(serie);
    const deltaPct = inicio != null && fin != null && inicio > 0 ? (fin - inicio) / inicio * 100 : null;
    const lectura = deltaPct == null ? 'insuficiente' : Motor.lecturaProgreso(deltaPct);
    const n = serie.length;
    // «Firme»: no depende de una sola sesión.
    const firme = n >= this.MIN_PUNTOS_FIRME && (
      lectura === 'baja' ? serie[n - 1] < inicio && serie[n - 2] < inicio
      : lectura === 'sube' ? serie[n - 1] > inicio && serie[n - 2] > inicio : false);
    return { ej, nombre: ej.nombre, desde: new Date(a), hasta: new Date(b), puntos, excluidos, config,
             inicio, fin, deltaPct, lectura, firme, n, enPeriodo: enPeriodo.filter(p => p.hechas > 0).length,
             cambioRutina: new Set(puntos.map(p => p.sesion.rutina)).size > 1,
             seriesDistintas: new Set(puntos.map(p => p.hechas)).size > 1 };
  },

  comparables(M, { dias = this.VENTANA_DIAS } = {}){
    const hasta = soloDia(M.ref), desde = this._dias(hasta, -(dias - 1));
    const out = [];
    M.ejercicios.forEach(ej => {
      if (ej.porTiempo) return;
      const ev = this.evolucionEjercicio(M, ej, desde, hasta);
      if (ev.enPeriodo) out.push(ev);
    });
    const orden = { baja: 0, sube: 1, sinCambios: 2, insuficiente: 3 };
    return out.sort((x, y) => orden[x.lectura] - orden[y.lectura] ||
      (x.deltaPct == null || y.deltaPct == null ? 0 : (x.lectura === 'baja' ? x.deltaPct - y.deltaPct : y.deltaPct - x.deltaPct)) ||
      x.nombre.localeCompare(y.nombre));
  },

  // ---------- ficha: series, marcas y comparación ----------
  /* Series de una entrada tal como se anotaron: carga de cada serie (asistencia
     en positivo), reps, RIR y papel de la serie. */
  seriesDe(e){
    const out = [];
    for (let s = 0; s < e.reps.length; s++){
      const kg = Motor.kgSerie(e, s);
      out.push({ n: s + 1, kg: Motor.cargaOrientada(e.ejercicio, kg), reps: e.reps[s], rir: s < e.rir.length ? e.rir[s] : null,
                 papel: e.dropSet && s > 0 ? 'drop' : e.restPause && s > 0 ? 'pausa' : !Motor.esSerieTop(e, s) ? 'back' : 'top' });
    }
    return out;
  },

  /* Historial de marcas válidas: cada sesión que superó la mejor marca
     anterior (la primera fija la referencia). */
  marcas(ej){
    const out = [];
    let mejor = null;
    ej.puntos.forEach(p => {
      if (p.e1rmMarca == null) return;
      if (mejor == null || p.e1rmMarca > mejor){
        out.push({ p, valor: p.e1rmMarca, anterior: mejor, serie: p.marcaSerie });
        mejor = p.e1rmMarca;
      }
    });
    return out;
  },

  /* Comparación de dos sesiones de un ejercicio, con los avisos de lo que
     las hace no equivalentes. `a` es la anterior y `b` la posterior. */
  compararSesiones(M, ej, indiceA, indiceB){
    let a = ej.puntos.find(p => p.sesion.indice === indiceA), b = ej.puntos.find(p => p.sesion.indice === indiceB);
    if (!a || !b) return null;
    if (+a.fecha > +b.fecha) [a, b] = [b, a];
    const avisos = [];
    const ca = this.configuracion(a), cb = this.configuracion(b);
    if (ca !== cb) avisos.push(`Modalidad distinta (${this.MODALIDAD_TXT[ca]} frente a ${this.MODALIDAD_TXT[cb]}): las cifras no son equivalentes.`);
    if (a.hechas !== b.hechas) avisos.push(`Número de series distinto (${a.hechas} y ${b.hechas}): no compares repeticiones totales ni tonelaje.`);
    if (a.sesion.rutina !== b.sesion.rutina) avisos.push('Son de rutinas distintas: el objetivo de repeticiones o el orden pueden haber cambiado.');
    else if (a.dia !== b.dia) avisos.push('Son de días distintos de la rutina.');
    [[a, 'La primera'], [b, 'La segunda']].forEach(([p, quien]) => {
      const m = this.motivoNoComparable(p);
      if (m && m !== 'sinEstimacion') avisos.push(`${quien} sesión no es una sesión normal (${this.MOTIVO_TXT[m]}).`);
      if (Motor.incompleta(p.e)) avisos.push(`${quien} sesión tiene series sin anotar.`);
    });
    if (ej.porTiempo) avisos.push('Se mide en segundos: no hay 1RM estimado.');
    const compatible = ca === cb && !ej.porTiempo;
    const e1 = p => p.mejor ? p.mejor.e1rm : null;
    const delta = compatible && e1(a) != null && e1(b) != null ? (e1(b) - e1(a)) / e1(a) * 100 : null;
    return { a, b, avisos, compatible, deltaE1rm: delta, seriesA: this.seriesDe(a.e), seriesB: this.seriesDe(b.e),
             dias: diasEntre(a.fecha, b.fecha) };
  },

  // ---------- peso y recuperación ----------
  /* Peso tendencia al último registro y hace cuatro semanas (sin
     extrapolar: solo puntos del filtro de la app ya calculados). */
  peso(M){
    const N = M.datos.nut;
    if (!N || !N.pesajes || !N.pesajes.length) return null;
    const ref = soloDia(M.ref), desde = this._dias(ref, -this.VENTANA_DIAS);
    const pts = N.serie && !N.serie.vacia ? N.serie.puntos.filter(p => p.tendenciaKg > 0 && +p.fecha <= +ref) : [];
    const actual = pts.length ? pts[pts.length - 1] : null;
    const previo = [...pts].reverse().find(p => +p.fecha <= +desde) || null;
    const pesajesVentana = N.pesajes.filter(p => +p.fecha > +desde && +p.fecha <= +ref).length;
    return { actual, previo, cambioKg: actual && previo && pesajesVentana >= 2 ? actual.tendenciaKg - previo.tendenciaKg : null,
             pesajesVentana, fase: N.fase || null, tasaReal: N.pesajes.length > 1 ? N.tasaPctSemana : null,
             diasEnFase: N.diasEnFase ?? null, ultimoPesaje: N.pesajes[N.pesajes.length - 1] };
  },

  /* Cambios de recuperación: la lectura de la app ahora y en las dos
     semanas anteriores, y las noches con la VFC baja de forma sostenida
     (misma regla que la app) en la última semana. */
  cambiosRecuperacion(M){
    const ahora = M.recuperacion;
    const antes = this.recuperacion(M, new Date(+M.ref - 14 * 86400000));
    const R = M.datos.readiness;
    const ref = soloDia(M.ref), desde7 = this._dias(ref, -6);
    let vfcBaja = [];
    try {
      const bajas = VFC.tendenciaBajaFechas(R);
      const serie = VFC.tendenciaSerie(R);
      vfcBaja = VFC.validas(R).filter(v => bajas.has(v.clave) && +v.fecha >= +desde7 && +v.fecha <= +ref)
        .map(v => ({ fecha: v.fecha, vfc: v.vfc, ...serie.get(v.clave) }));
    } catch (_) { vfcBaja = []; }
    return { ahora, antes, vfcBaja, desde7 };
  },

  // ---------- conclusiones del resumen ----------
  /* Candidatas ordenadas por prioridad (1 = más importante). Cada una lleva
     observación, periodo, datos que la respaldan, limitaciones y enlace al
     detalle. Solo se muestran las tres primeras. */
  conclusiones(M){
    const c = [];
    const sesionDe = log => M.sesiones.find(s => s.l === log) || null;
    const hasta = soloDia(M.ref), desde = this._dias(hasta, -(this.VENTANA_DIAS - 1));

    // 1 · Valoración del progreso (regla de la app).
    const v = M.valoracion;
    if (!v.descarga && v.tendencia){
      const n = v.ventana.length;
      const T = {
        cae: [1, 'rojo', 'Tu rendimiento reciente queda por debajo de tu nivel', `En ${this._n(n, 'sesión', 'sesiones')}, varias quedaron por debajo de tu nivel reciente en su día de la rutina.`],
        mejora: [4, 'verde', 'Tu rendimiento reciente va por encima de tu nivel', `En ${this._n(n, 'sesión', 'sesiones')}, varias superaron tu nivel reciente en su día de la rutina.`],
        mixta: [5, 'ambar', 'Rendimiento reciente irregular', `En ${this._n(n, 'sesión', 'sesiones')} hubo días por encima y por debajo de tu nivel.`],
        sostiene: [6, 'gris', 'Rendimiento reciente en tu nivel', `Tus últimas ${this._n(n, 'sesión', 'sesiones')} se mantienen en tu nivel reciente.`],
      }[v.tendencia];
      c.push({ id: 'valoracion', prioridad: T[0], tono: T[1], titulo: T[2], texto: T[3],
        periodo: { desde: v.ventana[0].fecha, hasta: v.ventana[n - 1].fecha },
        datos: { cabecera: ['Fecha', 'Sesión', 'Rendimiento frente a tu nivel'],
                 filas: v.ventana.map(p => { const s = sesionDe(p.log); return { fecha: p.fecha, indice: s ? s.indice : null, celdas: [String(p.log.dia || '—'), this._pct(p.pct)] }; }) },
        limitaciones: ['Es la misma lectura que la tarjeta de valoración de Progreso en la app, con tus datos hasta el último registro.',
          'Cada cifra es el rendimiento que la app guardó al terminar la sesión; no explica por qué una sesión fue mejor o peor.'],
        enlace: { destino: 'entrenamiento:rendimiento', texto: 'Ver rendimiento por sesión' } });
    }

    // 2 · Intentos agotados (contador de la app).
    const comp = this.comparables(M);
    const agotados = [];
    M.ejercicios.forEach(ej => ej.estados.forEach(st => { if (st.tipo === 'intentosAgotados') agotados.push({ ej, st }); }));
    if (agotados.length){
      const filas = [];
      agotados.forEach(({ ej, st }) => st.op.slice(0, st.consumidos).forEach(o => {
        const s = sesionDe(M.raw.logs[o.indice]);
        filas.push({ fecha: s ? s.fecha : parseFecha(o.fecha), indice: s ? s.indice : null, celdas: [ej.nombre, String(st.dia),
          this._kg(Motor.cargaOrientada(ej.nombre, o.kg), 2), Motor.repsTop(o.entrada).map(r => r == null ? '·' : r).join(' / '), String(st.reps)] });
      }));
      filas.sort((x, y) => +x.fecha - +y.fecha);
      const nombres = [...new Set(agotados.map(x => x.ej.nombre))];
      // Si además su 1RM estimado baja de forma clara, se dice aquí y no se
      // repite como conclusión aparte.
      const tambienBaja = comp.filter(x => x.lectura === 'baja' && x.firme && nombres.includes(x.nombre));
      c.push({ id: 'intentos', prioridad: 1, tono: 'ambar',
        titulo: nombres.length === 1 ? `Intentos agotados en ${nombres[0]}` : `Intentos agotados en ${nombres.length} ejercicios`,
        texto: `Con la misma carga no has llegado al objetivo de repeticiones en las sesiones que cuentan para tu progresión: ${this._lista(nombres)}.` +
          (tambienBaja.length ? ` Su 1RM estimado de las últimas semanas también baja: ${this._lista(tambienBaja.map(x => `${x.nombre} (${this._pct(x.deltaPct)})`))}.` : ''),
        periodo: { desde: filas[0].fecha, hasta: filas[filas.length - 1].fecha },
        datos: { cabecera: ['Fecha', 'Ejercicio', 'Día', 'Carga', 'Reps de las series principales', 'Objetivo'], filas },
        limitaciones: ['Es el mismo recuento que la app para tu rutina actual. Lo que se hace después con la carga lo decide la app según tu fase; aquí no se reproduce.',
          ...(M.descarga ? ['Estás en descarga: mientras dure, la app no cuenta intentos.'] : [])],
        enlace: { destino: `entrenamiento:ejercicios:${encodeURIComponent(nombres[0])}`, texto: nombres.length === 1 ? 'Ver la ficha del ejercicio' : `Ver la ficha de ${nombres[0]}` } });
    }

    // 3 · Recuperación: lectura de la app y VFC baja sostenida.
    const rc = this.cambiosRecuperacion(M);
    if (rc.ahora.lectura === 'cargada' || (rc.ahora.lectura === 'buena' && rc.antes.lectura === 'cargada')){
      const cargada = rc.ahora.lectura === 'cargada';
      const filas = M.datos.readiness.filter(r => r.estadoEntrenar != null && +r.fecha >= +soloDia(rc.ahora.desde) && +r.fecha <= +M.ref)
        .map(r => ({ fecha: r.fecha, indice: null, celdas: [String(Math.round(r.estadoEntrenar)), r.estadoEntrenar < this.ESTADO_BAJO ? 'Bajo' : 'Normal o alto'] }));
      c.push({ id: 'recuperacion', prioridad: cargada ? 2 : 5, tono: cargada ? 'ambar' : 'verde',
        titulo: cargada ? 'Muchos días con el estado para entrenar bajo' : 'Tu estado para entrenar ha mejorado',
        texto: cargada
          ? `${rc.ahora.bajos} de ${this._n(rc.ahora.registrados, 'día registrado', 'días registrados')} tuvieron el estado para entrenar bajo${rc.antes.lectura === 'buena' ? ', cuando en el periodo anterior la mayoría fue bueno' : ''}.`
          : `En el periodo anterior muchos días tuvieron el estado bajo; ahora la mayoría es bueno (${rc.ahora.bajos} de ${rc.ahora.registrados} bajos).`,
        periodo: { desde: rc.ahora.desde, hasta: M.ref },
        datos: { cabecera: ['Fecha', 'Estado para entrenar', 'Lectura'], filas },
        limitaciones: ['Sale del cuestionario diario de la app: depende de cómo respondas cada día.', 'Describe tu estado; no es una valoración médica.'],
        enlace: { destino: 'recuperacion', texto: 'Ver recuperación' } });
    }
    if (rc.vfcBaja.length){
      c.push({ id: 'vfc', prioridad: 2, tono: 'ambar', titulo: 'Tu VFC lleva varias noches por debajo de tu referencia',
        texto: `${this._n(rc.vfcBaja.length, 'noche reciente', 'noches recientes')} con la media de VFC por debajo de tu umbral de forma sostenida, con la misma regla que la app.`,
        periodo: { desde: rc.vfcBaja[0].fecha, hasta: rc.vfcBaja[rc.vfcBaja.length - 1].fecha },
        datos: { cabecera: ['Noche', 'VFC (ms)', 'Media 7 días', 'Umbral'], filas: rc.vfcBaja.map(x => ({ fecha: x.fecha, indice: null,
          celdas: [fmtNum(x.vfc, 0), x.media7 != null ? fmtNum(x.media7, 1) : '—', x.umbral != null ? fmtNum(x.umbral, 1) : '—'] })) },
        limitaciones: ['La VFC cambia con el sueño, el alcohol, el estrés o una enfermedad: indica cansancio, no su causa.', 'Describe una señal; no es una valoración médica.'],
        enlace: { destino: 'recuperacion', texto: 'Ver recuperación' } });
    }

    // 4 · Ejercicios comparables con el 1RM estimado a la baja o al alza
    // (sin repetir los que ya salen por intentos agotados).
    const yaDichos = new Set(agotados.map(x => x.ej.nombre));
    const conclusionEj = (lectura, prioridad, tono, titulo1, tituloN, texto) => {
      const lista = comp.filter(x => x.lectura === lectura && x.firme && !yaDichos.has(x.nombre)).slice(0, 3);
      if (!lista.length) return;
      const filas = [];
      lista.forEach(x => x.puntos.forEach(p => filas.push({ fecha: p.fecha, indice: p.sesion.indice, celdas: [x.nombre,
        this.serieTxt(p.e, p.marcaSerie),
        this._kg(p.e1rmMarca)] })));
      filas.sort((a, b) => +a.fecha - +b.fecha);
      const lim = ['El 1RM es una estimación a partir de tus series, no una prueba de máximo.',
        'Solo se comparan sesiones normales de cada ejercicio (en verde, sin descarga, sin molestias, sin cambios de un día) y con la misma modalidad de series.',
        'Describe un cambio; no explica su causa (descanso, nutrición, técnica u orden de los ejercicios pueden influir).'];
      if (lista.some(x => x.cambioRutina)) lim.push('Incluye sesiones de rutinas distintas.');
      if (lectura === 'baja' && lista.some(x => x.ej.estados.some(st => st.tipo === 'objetivoCumplido')))
        lim.push('Que el 1RM estimado baje no contradice un objetivo de repeticiones cumplido: son medidas distintas.');
      c.push({ id: `ejercicios-${lectura}`, prioridad, tono,
        titulo: lista.length === 1 ? `${titulo1} en ${lista[0].nombre}` : `${tituloN} en ${lista.length} ejercicios`,
        texto: texto(lista),
        periodo: { desde: filas[0].fecha, hasta: filas[filas.length - 1].fecha },
        datos: { cabecera: ['Fecha', 'Ejercicio', 'Serie que da la estimación', '1RM estimado'], filas },
        limitaciones: lim,
        enlace: { destino: `entrenamiento:ejercicios:${encodeURIComponent(lista[0].nombre)}`, texto: lista.length === 1 ? 'Ver la ficha del ejercicio' : `Ver la ficha de ${lista[0].nombre}` } });
    };
    conclusionEj('baja', 3, 'ambar', '1RM estimado a la baja', '1RM estimado a la baja',
      l => `Comparando el principio y el final de las últimas semanas: ${this._lista(l.map(x => `${x.nombre} (${this._pct(x.deltaPct)}, ${this._n(x.n, 'sesión', 'sesiones')})`))}.`);

    // 5 · Constancia con la rutina de cada semana.
    const k = this.constancia(M);
    if (k.conocidas >= 2){
      const cumple = k.hechas >= k.previstas;
      c.push({ id: 'constancia', prioridad: cumple ? 5 : 3, tono: cumple ? 'verde' : 'ambar',
        titulo: cumple ? 'Has entrenado los días previstos' : `Entrenaste ${k.hechas} de ${k.previstas} días previstos`,
        texto: `En ${this._n(k.conocidas, 'semana completa', 'semanas completas')} con la rutina conocida entrenaste ${this._n(k.hechas, 'día', 'días')} de ${k.previstas} previstos por tu rutina de entonces.`,
        periodo: { desde: k.desde, hasta: k.hasta },
        datos: { cabecera: ['Semana', 'Días con sesión', 'Previstos'], filas: k.semanas.map(f => ({ fecha: f.inicio, indice: null, semana: true,
          celdas: [String(f.dias), f.previstas != null ? String(f.previstas) : 'sin calcular'] })) },
        limitaciones: ['Lo previsto sale de los días por semana de la rutina con la que entrenabas cada semana. Las semanas en las que no se puede saber qué rutina tenías no se cuentan.',
          'La copia no guarda vacaciones ni pausas planificadas.'],
        enlace: { destino: 'entrenamiento:sesiones', texto: 'Ver mis sesiones' } });
    }

    // 6 · Nuevas marcas en la ventana.
    const nuevas = [];
    M.ejercicios.forEach(ej => this.marcas(ej).forEach(m => {
      if (m.anterior != null && +soloDia(m.p.fecha) >= +desde && +m.p.fecha <= +M.ref) nuevas.push({ ej, m });
    }));
    if (nuevas.length){
      const nombres = [...new Set(nuevas.map(x => x.ej.nombre))];
      c.push({ id: 'marcas', prioridad: 4, tono: 'verde',
        titulo: nombres.length === 1 ? `Nueva mejor marca en ${nombres[0]}` : `Nuevas mejores marcas en ${nombres.length} ejercicios`,
        texto: `Tu 1RM estimado superó tu mejor marca anterior en ${this._lista(nombres)}.`,
        periodo: { desde, hasta },
        datos: { cabecera: ['Fecha', 'Ejercicio', 'Serie', '1RM estimado', 'Marca anterior'], filas: nuevas.sort((a, b) => +a.m.p.fecha - +b.m.p.fecha).map(({ ej, m }) => ({
          fecha: m.p.fecha, indice: m.p.sesion.indice, celdas: [ej.nombre,
            this.serieTxt(m.p.e, m.serie),
            this._kg(m.valor), this._kg(m.anterior)] })) },
        limitaciones: ['Mismas reglas de marca que la app: solo cuentan los ejercicios entrenados en verde, sin molestias ni cambios de un día.',
          'El 1RM es una estimación, no una prueba de máximo.'],
        enlace: { destino: `entrenamiento:ejercicios:${encodeURIComponent(nombres[0])}`, texto: nombres.length === 1 ? 'Ver la ficha del ejercicio' : `Ver la ficha de ${nombres[0]}` } });
    }
    conclusionEj('sube', 4.5, 'verde', '1RM estimado al alza', '1RM estimado al alza',
      l => `Comparando el principio y el final de las últimas semanas: ${this._lista(l.map(x => `${x.nombre} (${this._pct(x.deltaPct)}, ${this._n(x.n, 'sesión', 'sesiones')})`))}.`);

    return c.sort((a, b) => a.prioridad - b.prioridad);
  },

  // ---------------------------------------------------------------
  // Utilidades de periodo
  // ---------------------------------------------------------------
  /* Sesiones en [desde, hasta] (fechas, ambos incluidos por día). */
  enPeriodo(lista, desde, hasta){
    const a = +soloDia(desde), b = +soloDia(hasta);
    return lista.filter(x => { const d = +soloDia(x.fecha); return d >= a && d <= b; });
  },
};
