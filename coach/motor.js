'use strict';
/* ================================================================
   TrueLift — motor.js
   Reglas del motor de la app móvil portadas a JS, para que la web
   lea el historial con las MISMAS definiciones que el móvil.

   Fuente: App-PRO lib/app_state.dart (EntryLog, SessionLog, AppState),
   lib/valoracion_progreso.dart y lib/volumen_historico.dart. Cada
   función cita la suya. Si allí cambia una regla, aquí también: la
   prueba escritorio/tests/motor-sincronia.test.mjs compara las listas
   de nombres con el código de la app cuando el repositorio está al
   lado.

   Solo funciones puras sobre los mapas crudos de la copia JSON (los
   mismos que guarda el móvil): no muta nada, no lee la fecha de hoy
   (la recibe), no depende del DOM.
   ================================================================ */

const Motor = {

  // ---------------------------------------------------------------
  // Nombres (lib/models.dart)
  // ---------------------------------------------------------------

  /* `ejerciciosFusionados`: ejercicios retirados por duplicados. El móvil
     traduce el nombre al leer el historial para que la progresión siga en
     el que queda. */
  FUSIONADOS: {
    'Face pull en polea': 'Face pull con cuerda alto',
    'Face pull suave en polea': 'Face pull con cuerda alto',
  },
  nombreVigente(nombre){
    const n = typeof nombre === 'string' ? nombre : '';
    return this.FUSIONADOS[n] || n;
  },

  // ---------------------------------------------------------------
  // Material y carga efectiva (AppState._esPesoCorporal, _esAsistido,
  // lastreCanonico, cargaEfectiva)
  // ---------------------------------------------------------------

  MAQUINAS_CARGA_PROPIA: ['fondos en máquina'],
  PESO_CORPORAL_EXACTOS: [
    'puente de glúteo', 'crunch', 'crunch con peso', 'crunch bicicleta',
    'crunch bicicleta con piernas elevadas', 'crunch oblicuo',
    'crunch en banco declinado', 'crunch en banco declinado con peso',
    'jackknife sit-up', 'jackknife en suspensión', 'v-up', 'sit-up',
    'sit-up con peso', 'tijeras abdominales', 'toques al talón',
    'toque de pies', 'aleteo de piernas', 'rodillas al codo',
    'elevación de piernas tumbado', 'elevación de rodillas tumbado',
    'elevación de rodillas colgado', 'elevación de piernas en paralelas',
    'toes to bar', 'hollow rock', 'dragon flag', 'front lever raise',
    'toques de hombro en plancha', 'giro ruso con peso corporal',
    'aperturas en suspensión', 'curl en suspensión',
    'extensión de tríceps en suspensión', 'elevación frontal en suspensión',
    'remo invertido en suspensión', 'sentadilla en suspensión',
    'hiperextensión inversa', 'glute ham raise',
    'puente de glúteo a una pierna', 'patada de glúteo en cuadrupedia',
    'almeja tumbado de lado', 'sentadilla pistol', 'sentadilla pistol con apoyo',
  ],
  ASISTIDOS_EXACTOS: ['dominada con banda elástica'],
  POR_TIEMPO: [
    'plancha frontal', 'plancha lateral', 'plancha con peso', 'hollow hold',
    'superman', 'paseo del granjero con mancuernas', 'plancha inversa',
    'l-sit', 'front lever', 'pino contra pared',
    'sentadilla isométrica en pared', 'paseo del granjero unilateral con mancuerna',
  ],

  esPesoCorporal(nombre){
    const n = String(nombre || '').toLowerCase();
    if (this.MAQUINAS_CARGA_PROPIA.includes(n)) return false;
    if (this.PESO_CORPORAL_EXACTOS.includes(n)) return true;
    return n.includes('dominad') || n.includes('fondo') || n.includes('flexion') ||
           n.includes('flexión') || n.includes('peso corporal');
  },
  esAsistido(nombre){
    if (!this.esPesoCorporal(nombre)) return false;
    const n = String(nombre || '').toLowerCase();
    if (this.ASISTIDOS_EXACTOS.includes(n)) return true;
    return n.includes('asistid') || n.includes('asistenc');
  },
  /* Ejercicios por tiempo: los de la app y los propios marcados `porTiempo`
     en `ejerciciosUsuario`. Sus «reps» son segundos y quedan fuera de e1RM,
     rendimiento y estancamiento. */
  esPorTiempo(nombre, raw = null){
    const n = String(nombre || '').toLowerCase();
    if (this.POR_TIEMPO.includes(n)) return true;
    const propios = raw && Array.isArray(raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [];
    return propios.some(e => e && e.porTiempo === true && String(e.nombre || '').toLowerCase() === n);
  },
  lastreCanonico(nombre, kg){ return this.esAsistido(nombre) && kg > 0 ? -kg : kg; },
  /* Peso corporal + lastre (asistencia restada) en ejercicios de peso
     corporal; el kg tal cual en el resto. OJO: el móvil usa SIEMPRE el peso
     corporal ACTUAL del perfil (`pesoCorporal`), también para sesiones
     antiguas; aquí igual, para dar sus mismas cifras. */
  cargaEfectiva(nombre, kg, pesoCorporal){
    return this.esPesoCorporal(nombre) ? (pesoCorporal || 0) + this.lastreCanonico(nombre, kg) : kg;
  },
  /* Número que ve y teclea el usuario (la asistencia en positivo). */
  cargaOrientada(nombre, kg){
    if (kg == null || !this.esAsistido(nombre)) return kg;
    const v = -kg; return v === 0 ? 0 : v;
  },

  // ---------------------------------------------------------------
  // Lectura de una entrada (EntryLog). Mismas tolerancias que el móvil:
  // un número no numérico es null, nunca un 0.
  // ---------------------------------------------------------------

  _int(v){ return typeof v === 'number' && isFinite(v) ? Math.trunc(v) : null; },
  _num(v){ return typeof v === 'number' && isFinite(v) ? v : null; },

  entrada(e){
    const raw = e && typeof e === 'object' ? e : {};
    const ints = v => Array.isArray(v) ? v.map(x => this._int(x)) : [];
    const plan = typeof raw.ejercicioPlan === 'string' && raw.ejercicioPlan.trim()
      ? this.nombreVigente(raw.ejercicioPlan.trim()) : null;
    const estado = ['verde', 'ambar', 'rojo'].includes(raw.estadoEjercicio) ? raw.estadoEjercicio : null;
    return {
      raw,
      ejercicio: this.nombreVigente(raw.ejercicio == null ? '' : String(raw.ejercicio)),
      kg: this._num(raw.kg),
      reps: ints(raw.reps),
      rir: ints(raw.rir),
      kgSets: Array.isArray(raw.kgSets) ? raw.kgSets.map(x => this._num(x)) : [],
      modulada: raw.modulada === true,
      moduladaRegistrada: typeof raw.modulada === 'boolean',
      progresionPausada: raw.progresionPausada === true,
      progresionPausadaRegistrada: typeof raw.progresionPausada === 'boolean',
      estadoEjercicio: estado,
      neutra: raw.neutra === true,
      noDisponible: raw.noDisponible === true,
      molestias: raw.molestias === true,
      sustitucion: raw.sustitucion === true,
      ejercicioPlan: plan,
      dropSet: raw.dropSet === true,
      restPause: raw.restPause === true,
      superserie: this._int(raw.superserie),
      estancamientoRecurrente: raw.estancamientoRecurrente === true,
    };
  },
  noEvaluable(e){ return e.molestias || e.sustitucion; },
  soloPrimeraSerie(e){ return e.dropSet || e.restPause; },
  kgSerie(e, s){
    const k = s >= 0 && s < e.kgSets.length ? e.kgSets[s] : null;
    return k != null ? k : e.kg;
  },
  esSerieTop(e, s){
    const base = e.kg, propio = this.kgSerie(e, s);
    if (base == null || propio == null) return true;
    return Math.abs(propio - base) < 0.001;
  },
  repsTop(e){ return e.reps.filter((_, s) => this.esSerieTop(e, s)); },
  incompleta(e){ return e.reps.some(r => r == null) && e.reps.some(r => r != null); },
  oportunidadCompleta(e){ const t = this.repsTop(e); return t.length > 0 && t.every(r => r != null); },
  /* Series hechas = series con reps anotadas; sin `reps`, las de RIR
     anotado (volumen_historico.dart `_seriesHechas`). */
  seriesHechas(e){
    const conReps = e.reps.filter(r => r != null).length;
    if (conReps > 0 || e.reps.length) return conReps;
    return e.rir.filter(r => r != null).length;
  },

  // ---------------------------------------------------------------
  // Sesión (SessionLog)
  // ---------------------------------------------------------------

  esCardio(l){ return !!l && l.tipo === 'cardio'; },
  /* estadoSemaforoDeLog: el global congelado y, si falta, la compuerta;
     cualquier otro valor cuenta como verde. */
  estadoSemaforo(l){
    const v = l.estadoSemaforo ?? l.estadoCompuerta;
    return v === 'rojo' ? 'rojo' : v === 'ambar' ? 'ambar' : 'verde';
  },
  estadoDeEntrada(l, e){ return e.estadoEjercicio || this.estadoSemaforo(l); },
  cuentaParaRecordsEntrada(l, e){ return this.estadoDeEntrada(l, e) === 'verde'; },
  entradasDe(l){
    return Array.isArray(l && l.entradas) ? l.entradas.filter(x => x && typeof x === 'object').map(x => this.entrada(x)) : [];
  },
  /* Identidad de rutina de una sesión: variante|días|revisión
     (rutinaKeyDeLog). Es lo que separa de verdad un bloque de otro. */
  rutinaKeyDeLog(l){
    const rev = this._int(l.rutinaRevision) ?? 0;
    return `${l.variante}|${l.dias}|${rev}`;
  },
  rutinaKeyActual(raw){
    const rev = this._int(raw.rutinaRevision) ?? 0;
    return `${raw.sexo}_${raw.sistema}|${raw.dias}|${rev}`;
  },
  esLogDeRutinaActual(l, raw){
    return !this.esCardio(l) && l.variante === `${raw.sexo}_${raw.sistema}` &&
           l.dias === raw.dias && (this._int(l.rutinaRevision) ?? 0) === (this._int(raw.rutinaRevision) ?? 0);
  },

  // ---------------------------------------------------------------
  // e1RM (AppState.e1rmEpley y sus usos)
  // ---------------------------------------------------------------

  /* Reps efectivas (reps + RIR) a partir de las cuales Epley se vuelve poco
     fiable. Las MARCAS y la progresión topan ahí; la gráfica de Progreso
     enseña la estimación sin tope y avisa cuando las reps lo superan. */
  CAP_REPS_E1RM: 18,
  e1rmEpley(kg, reps, rir, cap = 18){
    const eff = reps + rir;
    return kg * (1 + (cap == null || eff <= cap ? eff : cap) / 30);
  },
  e1rmMenosFiable(reps){ return reps > 18; },

  /* Mejor e1RM de las series de una entrada (`_mejorE1rmEntrada`): drops y
     series tras la pausa fuera, carga efectiva, RIR ausente = 0. `cap` 18
     para marcas; null para la gráfica de Progreso. Devuelve también la
     serie elegida. */
  mejorSerie(e, pesoCorporal, { cap = 18 } = {}){
    let mejor = null;
    for (let s = 0; s < e.reps.length; s++){
      if (this.soloPrimeraSerie(e) && s > 0) continue;
      const r = e.reps[s];
      if (r == null) continue;
      const kg = this.kgSerie(e, s);
      if (kg == null) continue;
      const base = this.cargaEfectiva(e.ejercicio, kg, pesoCorporal);
      if (base <= 0) continue;
      const rr = s < e.rir.length && e.rir[s] != null ? e.rir[s] : 0;
      const v = this.e1rmEpley(base, r, rr, cap);
      if (!mejor || v > mejor.e1rm) mejor = { e1rm: v, serie: s, carga: base, reps: r, rir: rr, menosFiable: this.e1rmMenosFiable(r) };
    }
    return mejor;
  },

  /* ¿La entrada puede fijar una marca personal? (`mejorMarca`): sesión de
     fuerza, ejercicio entrenado en verde, evaluable. */
  puedeFijarMarca(l, e){
    return !this.esCardio(l) && this.cuentaParaRecordsEntrada(l, e) && !this.noEvaluable(e);
  },

  /* Mejor marca de un ejercicio en todo el historial (AppState.mejorMarca). */
  mejorMarca(logs, ejercicio, pesoCorporal){
    let best = null;
    (logs || []).forEach(l => {
      if (!l || this.esCardio(l)) return;
      this.entradasDe(l).forEach(e => {
        if (e.ejercicio !== ejercicio || !this.puedeFijarMarca(l, e)) return;
        const m = this.mejorSerie(e, pesoCorporal, { cap: this.CAP_REPS_E1RM });
        if (m && (best == null || m.e1rm > best)) best = m.e1rm;
      });
    });
    return best;
  },

  // ---------------------------------------------------------------
  // Estancamiento (AppState._sesionesEstancadoEjercicio)
  // ---------------------------------------------------------------

  /* sesionesEstancadas: racha desde la más reciente con el mismo kg sin
     cumplir el objetivo. */
  sesionesEstancadas(kgs, completadas){
    if (!kgs.length || kgs[0] == null) return 0;
    const ref = kgs[0];
    let n = 0;
    for (let i = 0; i < kgs.length; i++){
      if (kgs[i] !== ref || completadas[i]) break;
      n++;
    }
    return n;
  },
  /* Intentos por fase de peso: déficit 5, superávit 3, el resto 4. */
  intentosMax(fasePeso){ return fasePeso === 'deficit' ? 5 : fasePeso === 'superavit' ? 3 : 4; },
  restPauseLinea(linea, raw = null){
    return !!linea && linea.restPause === true && (this._int(linea.series) ?? 0) >= 2 &&
           !this.esPorTiempo(linea.ejercicio, raw);
  },
  /* Objetivo de reps de una línea: simple → primer número; doble → el
     último. Null en ejercicios por tiempo o sin número. */
  objetivoLinea(linea, sistema, raw = null){
    if (!linea || this.esPorTiempo(linea.ejercicio, raw)) return null;
    const nums = (String(linea.reps ?? '').match(/\d+/g) || []).map(Number);
    if (!nums.length) return null;
    return sistema === 'simple' ? nums[0] : nums[nums.length - 1];
  },
  seriesProgresion(reps, total){
    if (!total) return reps;
    if (!reps.length) return [];
    return [reps.some(r => r == null) ? null : reps.reduce((a, r) => a + r, 0)];
  },
  repsObjetivoCumplido(reps, objetivo, total = false){
    const p = this.seriesProgresion(reps, total);
    return p.length > 0 && p.every(r => r != null && r >= objetivo);
  },

  /* Oportunidades válidas de cumplir el objetivo para (ejercicio, día) en la
     rutina actual, de la más reciente a la más antigua, con las mismas
     exclusiones que el móvil. Recorre `logs` en su ORDEN DE ARCHIVO, como
     el móvil (no por fecha). Devuelve también la fecha de cada una. */
  oportunidades(raw, ejercicio, dia, objetivo, { max = Infinity } = {}){
    const logs = Array.isArray(raw.logs) ? raw.logs : [];
    const linea = (Array.isArray(raw.planMod) ? raw.planMod : [])
      .find(p => p && p.ejercicio === ejercicio && (dia == null || p.dia === dia));
    const total = this.restPauseLinea(linea, raw);
    const out = [];
    for (let i = logs.length - 1; i >= 0 && out.length < max; i--){
      const l = logs[i];
      if (!l || typeof l !== 'object' || !this.esLogDeRutinaActual(l, raw)) continue;
      if (dia != null && l.dia !== dia) continue;
      if (l.descarga === true) continue;
      const e = this.entradasDe(l).find(x => x.ejercicio === ejercicio);
      if (!e || e.noDisponible) continue;
      if (e.progresionPausada || e.modulada || this.noEvaluable(e)) continue;
      if (!this.oportunidadCompleta(e)) continue;
      const marca = e.progresionPausadaRegistrada || e.moduladaRegistrada;
      if (!marca && this.estadoSemaforo(l) !== 'verde') continue;
      const completo = this.repsObjetivoCumplido(this.repsTop(e), objetivo, total);
      if (e.neutra && !completo) continue;
      out.push({ kg: e.kg, completo, fecha: l.fecha, indice: i, entrada: e });
    }
    return out;
  },
  intentosConsumidos(raw, ejercicio, dia, objetivo){
    const op = this.oportunidades(raw, ejercicio, dia, objetivo, { max: this.intentosMax(raw.fasePeso) + 5 });
    return this.sesionesEstancadas(op.map(o => o.kg), op.map(o => o.completo));
  },

  // ---------------------------------------------------------------
  // Rendimiento de sesión (progreso_screen `_rawPctDeLog`, valoración)
  // ---------------------------------------------------------------

  /* Bruto en ±% (0 = tu nivel). Formato antiguo `rendimientoPct` (100 =
     nivel) y, sin cifra, el veredicto de texto. */
  rawPctDeLog(l){
    const raw = this._num(l.rawSessionPct);
    if (raw != null) return raw;
    const pct = this._num(l.rendimientoPct);
    if (pct != null) return pct - 100;
    if (typeof l.rendimiento === 'string') return l.rendimiento === 'buena' ? 4 : l.rendimiento === 'floja' ? -4 : 0;
    return null;
  },
  /* Para gráficas: las sesiones guardadas sin base comparable llevan 0 % por
     convenio y se dejan como hueco (`displayBaselinePoint`). */
  rawPctGrafica(l){ return l.displayBaselinePoint === true ? null : this.rawPctDeLog(l); },
  netPctGrafica(l){ return l.netDisplayBaselinePoint === true ? null : this._num(l.netDailyPerformancePct); },
  netVerdict(net, tol){
    if (net >= tol) return 'bueno';
    if (net <= -2 * tol) return 'muy flojo';
    if (net <= -tol) return 'flojo';
    return 'normal';
  },
  /* Veredicto guardado; si falta, el del neto con la tolerancia guardada o la
     dada; si no, la palabra antigua. */
  veredictoDeLog(l, tolActual){
    if (typeof l.verdictAtSave === 'string') return l.verdictAtSave;
    const net = this._num(l.netDailyPerformancePct);
    if (net != null) return this.netVerdict(net, this._num(l.tolPctAtSave) ?? tolActual);
    const r = l.rendimiento;
    if (typeof r === 'string') return r === 'buena' ? 'bueno' : r === 'floja' ? 'flojo' : 'normal';
    return null;
  },

  // ---------------------------------------------------------------
  // Valoración del progreso (lib/valoracion_progreso.dart)
  // ---------------------------------------------------------------

  VALORACION_VENTANA: 4,
  VALORACION_MIN: 3,
  VALORACION_DIAS: 28,
  /* mejora | sostiene | cae | mixta | null (< 3 sesiones). */
  tendenciaValoracion(pct, tol){
    if (pct.length < this.VALORACION_MIN) return null;
    const v = pct.length > this.VALORACION_VENTANA ? pct.slice(-this.VALORACION_VENTANA) : pct;
    let altos = 0, bajos = 0;
    v.forEach(x => { if (x >= tol) altos++; if (x <= -tol) bajos++; });
    if (altos > 0 && bajos > 0) return 'mixta';
    if (altos >= 2) return 'mejora';
    if (bajos >= 2) return 'cae';
    return 'sostiene';
  },
  /* Sesiones que entran en la valoración: las de los 28 días previos a
     `ref` (incluida), sin descargas ni puntos sin base, con bruto. */
  puntosValoracion(logs, ref){
    const fin = +ref, ini = fin - this.VALORACION_DIAS * 86400000;
    const pts = [];
    (logs || []).forEach(l => {
      if (!l || this.esCardio(l) || l.descarga === true || l.displayBaselinePoint === true) return;
      const f = this._fecha(l.fecha);
      if (!f || +f < ini || +f > fin) return;
      const raw = this._num(l.rawSessionPct), ant = this._num(l.rendimientoPct);
      const v = raw ?? (ant == null ? null : ant - 100);
      if (v == null) return;
      pts.push({ fecha: f, pct: v, log: l });
    });
    return pts.sort((a, b) => a.fecha - b.fecha);
  },
  /* Tolerancia del día de referencia: la congelada en la sesión evaluable
     más reciente; sin ella, la de la fase (`_caidaPct`, 2–4 %). */
  tolerancia(raw, ref){
    const logs = (raw.logs || []).filter(l => l && !this.esCardio(l) && this._num(l.tolPctAtSave) != null && this._fecha(l.fecha) && this._fecha(l.fecha) <= ref)
      .sort((a, b) => this._fecha(a.fecha) - this._fecha(b.fecha));
    if (logs.length) return { tol: logs[logs.length - 1].tolPctAtSave, guardada: true };
    return { tol: 3 + this.faseK(raw, ref), guardada: false };
  },
  semanasEnFase(raw, ref){
    const d = this._fecha(raw.faseInicio);
    if (!d) return 0;
    const dias = Math.floor((ref - d) / 86400000);
    return dias < 0 ? 0 : Math.floor(dias / 7);
  },
  faseK(raw, ref){
    const sem = this.semanasEnFase(raw, ref);
    if (raw.fasePeso === 'deficit') return sem >= 3 ? -1 : -0.5;
    if (raw.fasePeso === 'superavit') return sem >= 3 ? 1 : 0.5;
    if (sem < 3){
      if (raw.fasePrevia === 'deficit') return -0.5;
      if (raw.fasePrevia === 'superavit') return 0.5;
    }
    return 0;
  },

  // ---------------------------------------------------------------
  // Volumen real por grupo (lib/volumen_historico.dart)
  // ---------------------------------------------------------------

  SIN_VOLUMEN_MUSCULAR: ['Aductores en máquina'],
  PATRONES_ISQUIOS: ['Bisagra', 'Flexión de rodilla'],
  GRUPOS_VOLUMEN: ['Pectoral', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteo', 'Gemelo', 'Core'],

  /* Series efectivas por grupo de una entrada: primario ×1, secundarios
     ×0,5 y «Isquios/glúteo» partido por patrón. `info(nombre)` →
     {grupo, patron, secundarios} o null (ejercicio irreconocible: no se
     inventa). Devuelve Map(grupo → series) o null. */
  seriesPorGrupo(e, info){
    if (e.noDisponible || this.SIN_VOLUMEN_MUSCULAR.includes(e.ejercicio)) return null;
    const n = this.seriesHechas(e);
    if (n <= 0) return null;
    const ej = info(e.ejercicio);
    if (!ej) return null;
    const vol = new Map();
    const suma = (g, v) => { if (this.GRUPOS_VOLUMEN.includes(g)) vol.set(g, (vol.get(g) || 0) + v); };
    const esIG = ej.grupo === 'Isquios/glúteo';
    const esIsq = this.PATRONES_ISQUIOS.includes(ej.patron);
    if (esIG) suma(esIsq ? 'Isquios' : 'Glúteo', n); else suma(ej.grupo, n);
    (ej.secundarios || []).forEach(sec => {
      if (sec === 'Isquios/glúteo') suma(esIG ? (esIsq ? 'Glúteo' : 'Isquios') : 'Glúteo', n * 0.5);
      else suma(sec, n * 0.5);
    });
    return vol;
  },

  /* Cubos semanales (lunes a domingo) o mensuales desde la primera sesión de
     fuerza (o `desde`) hasta `hoy`, con las series por grupo SIN
     normalizar. `tasa(cubo, g)` da la media semanal: los cubos de menos de
     siete días se enseñan tal cual (no se proyectan). */
  volumenReal({ logs, info, hoy, gran = 'semana', desde = null }){
    const dia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const sumar = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const ses = (logs || []).filter(l => l && !this.esCardio(l) && this._fecha(l.fecha))
      .map(l => ({ l, f: this._fecha(l.fecha) })).sort((a, b) => a.f - b.f);
    if (!ses.length) return [];
    const primer = dia(ses[0].f), ultimo = dia(hoy);
    let ini = desde ? dia(desde) : primer;
    if (ini < primer) ini = primer;
    if (ultimo < ini) return [];
    const iniCubo = d => gran === 'semana' ? sumar(dia(d), -((d.getDay() + 6) % 7)) : new Date(d.getFullYear(), d.getMonth(), 1);
    const sig = d => gran === 'semana' ? sumar(d, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const cubos = [], idx = new Map(), finEx = sumar(ultimo, 1);
    for (let d = iniCubo(ini); d <= ultimo; d = sig(d)){
      const f = sig(d), a = d < ini ? ini : d, b = f > finEx ? finEx : f;
      idx.set(+d, cubos.length);
      cubos.push({ inicio: d, finExclusivo: f, dias: Math.round((b - a) / 86400000), enCurso: f > finEx,
                   series: new Map(this.GRUPOS_VOLUMEN.map(g => [g, 0])), cambioRutina: false, sesiones: 0 });
    }
    let ant = null;
    ses.forEach(({ l, f }) => {
      const r = `${l.variante ?? ''}|${l.dias ?? ''}`;
      const estrena = ant != null && r !== ant;
      ant = r;
      const d = dia(f);
      if (d < ini || d > ultimo) return;
      const c = cubos[idx.get(+iniCubo(d))];
      if (!c) return;
      if (estrena) c.cambioRutina = true;
      c.sesiones++;
      this.entradasDe(l).forEach(e => {
        const v = this.seriesPorGrupo(e, info);
        if (v) v.forEach((n, g) => c.series.set(g, c.series.get(g) + n));
      });
    });
    return cubos;
  },
  tasaSemanal(cubo, grupo = null){
    if (cubo.dias <= 0) return 0;
    const n = grupo ? (cubo.series.get(grupo) || 0) : [...cubo.series.values()].reduce((a, b) => a + b, 0);
    return n * 7 / (cubo.dias < 7 ? 7 : cubo.dias);
  },

  // ---------------------------------------------------------------
  // Fechas: día local del propio texto (DiaLocal / parseFecha).
  // ---------------------------------------------------------------
  _fecha(s){
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d) ? null : d;
  },
};
