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
      const r = { ...base, consumidos, oportunidades: op.length, ultima: op[0] || null, recurrente: !!recurrente,
                  descarga: M.descarga };
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

  /* Días con «estado para entrenar» bajo en los 14 días previos a la
     referencia (recuperacionValoracion). Solo si el cuestionario está activo. */
  recuperacion(M){
    const activo = M.raw.readinessActivo === true;
    const desde = +M.ref - 14 * 86400000;
    let bajos = 0, registrados = 0;
    (Array.isArray(M.raw.readinessDiario) ? M.raw.readinessDiario : []).forEach(r => {
      if (!r || typeof r.estadoEntrenar !== 'number') return;
      const f = parseFecha(r.fecha);
      if (!f || +f < desde || +f > +M.ref) return;
      registrados++;
      if (r.estadoEntrenar < 70) bajos++;
    });
    let lectura = 'sinDato';
    if (activo && registrados >= 4){
      const k = bajos / registrados;
      lectura = k >= 0.5 ? 'cargada' : k <= 0.25 ? 'buena' : 'sinDato';
    }
    return { activo, bajos, registrados, lectura };
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
  // Utilidades de periodo
  // ---------------------------------------------------------------
  /* Sesiones en [desde, hasta] (fechas, ambos incluidos por día). */
  enPeriodo(lista, desde, hasta){
    const a = +soloDia(desde), b = +soloDia(hasta);
    return lista.filter(x => { const d = +soloDia(x.fecha); return d >= a && d <= b; });
  },
};
