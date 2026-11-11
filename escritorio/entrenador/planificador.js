'use strict';
/* ================================================================
   TrueLift Escritorio — entrenador/planificador.js
   Modelo del editor de rutina del modo entrenador. Solo cálculo, sin DOM.

   Recuperado del planificador personal retirado el 01/11/2026
   (`git show a4fd1ef^:escritorio/planificador.js`) y adaptado al plan de
   entrenador (PLAN_ENTRENADOR.md §7.3 de App-PRO):
   - Sale un paquete firmado, no un Excel: `paqueteRutina` construye la
     `rutina` del paquete (CONTRATO_PLAN_ENTRENADOR.md §3.2) con las mismas
     lecturas y valores por defecto que aplicaba el lector del Excel de la
     app, y `comoLaApp` reproduce `AppState.importarRutina` sobre ella. Así lo
     que el entrenador ve es lo que la app construirá.
   - Se conservan: borradores, deshacer (en app.js/modo.js), avisos, series
     por grupo y la comparación con la rutina de la copia del cliente.
   - Reutiliza las reglas del editor del Coach (../coach/planner.js:
     modalidades excluyentes, superseries, limpieza, biblioteca) sin tocar
     su estado: `reglas(raw)` usa la biblioteca del CLIENTE.
   ================================================================ */

const PlanificadorEntrenador = {

  VERSION_BORRADOR: 1,
  MAX_DESHACER: 50,
  MIN_DIAS: PaqueteEntrenador.LIMITES.diasMin,
  MAX_DIAS: PaqueteEntrenador.LIMITES.diasMax,
  MAX_FILAS: PaqueteEntrenador.LIMITES.filasPorDiaMax,

  // ---------------------------------------------------------------
  // Reglas compartidas con el Coach
  // ---------------------------------------------------------------

  /* Planner del Coach con la biblioteca del cliente (sus ejercicios creados
     en la app, de su copia) en lugar de la del Coach. No toca su estado. */
  reglas(raw){
    const P = Object.create(Planner);
    const propios = (Array.isArray(raw && raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [])
      .map(e => Planner._normalizarEjercicio(e, {}, 'json')).filter(Boolean);
    P.ejerciciosCoach = () => propios;
    return P;
  },

  clonar(x){ return JSON.parse(JSON.stringify(x)); },
  rutinaVacia(){ return Planner.rutinaVacia(); },
  filaVacia(){ return Planner.filaVacia(); },

  /* Deja una rutina (copia, borrador antiguo) en la forma que espera el
     editor: claves por defecto, patrones vigentes y modalidades saneadas.
     Devuelve una copia. */
  normalizarRutina(rutina){
    const r = this.clonar(rutina || this.rutinaVacia());
    r.sistema = r.sistema === 'simple' ? 'simple' : 'doble';
    r.dias = (Array.isArray(r.dias) ? r.dias : []).slice(0, this.MAX_DIAS).map((d, i) => ({
      nombre: String(d && d.nombre != null ? d.nombre : `Día ${i + 1}`),
      filas: (Array.isArray(d && d.filas) ? d.filas : []).slice(0, this.MAX_FILAS)
        .map(f => {
          // Sin dato en los parámetros de las modalidades valen los de la app
          // (15 %, RIR 2, 20 s): así se ven al activarlas y viajan igual.
          const fila = { ...this.filaVacia(), ...f };
          for (const k of ['backoffPct', 'rirBack', 'dropPct', 'pausaRpSeg']) if (fila[k] == null) fila[k] = this.filaVacia()[k];
          return fila;
        }),
    }));
    r.dias.forEach(d => { Planner._patronesVigentes(d.filas); Planner._sanearModalidades(d.filas, r.sistema); });
    return r;
  },

  // ---------------------------------------------------------------
  // Rutina de la copia del cliente
  // ---------------------------------------------------------------

  /* planMod de la app → modelo del editor (antes XLSX.desdePlanMod). */
  desdePlanMod(planMod, sistema){
    const dias = [], porDia = new Map();
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
    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    return {
      sistema: sistema === 'simple' ? 'simple' : 'doble',
      dias: dias.slice(0, this.MAX_DIAS).map(d => ({
        nombre: d,
        filas: porDia.get(d).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).slice(0, this.MAX_FILAS).map(p => ({
          patron: p.patron ?? '', ejercicio: p.ejercicio ?? '',
          series: num(p.series), rir: num(p.rir), ...parseReps(p.reps),
          descanso: num(p.descansoMin),
          topBack: p.topBack === true, backoffPct: num(p.backoffPct), rirBack: num(p.rirBack),
          dropSet: p.dropSet === true, dropPct: num(p.dropPct),
          superConAnterior: p.superConAnterior === true,
          restPause: p.restPause === true, pausaRpSeg: num(p.pausaRpSeg) || 20,
        })),
      })),
    };
  },

  /* Sistema de la rutina guardada: el de su clave («sexo_sistema|días» o
     «…|casaN») si la trae; si no, el ajuste actual. */
  _sistemaPlan(raw){
    const m = /^[^_|]+_(simple|doble)\|/.exec(String(raw.planModKey || ''));
    return m ? m[1] : (raw.sistema === 'simple' ? 'simple' : 'doble');
  },

  /* La rutina personalizada de la copia del cliente, en el modelo del
     editor, con su contexto: si es la de la combinación actual y si el
     móvil la tiene «a prueba». null si la copia no trae rutina
     personalizada (las prefijadas de la app no viajan en la copia). */
  rutinaCopia(raw){
    const plan = Array.isArray(raw && raw.planMod) ? raw.planMod.filter(p => p && typeof p === 'object') : [];
    if (!plan.length) return null;
    const sistema = this._sistemaPlan(raw);
    const rutina = this.normalizarRutina(this.desdePlanMod(plan, sistema));
    const porDia = new Map();
    plan.forEach(p => porDia.set(String(p.dia ?? '—'), (porDia.get(String(p.dia ?? '—')) || 0) + 1));
    const recortada = porDia.size > this.MAX_DIAS || [...porDia.values()].some(n => n > this.MAX_FILAS);
    const pend = raw.importPendiente && typeof raw.importPendiente === 'object' ? raw.importPendiente : null;
    return {
      rutina,
      normal: this.normalDePlanMod(plan, sistema),
      vigente: raw.planModKey === Motor.comboRutina(raw),
      recortada,
      aPrueba: pend ? { nombre: typeof pend.nombre === 'string' ? pend.nombre : '', origen: typeof pend.origen === 'string' ? pend.origen : '' } : null,
    };
  },

  // ---------------------------------------------------------------
  // Forma canónica para comparar (lo que de verdad usa el móvil)
  // ---------------------------------------------------------------

  _ent(v){ const m = /\d+/.exec(String(v ?? '')); return m ? parseInt(m[0], 10) : null; },
  /* LineaRutina.normalizarPausaRp de la app. */
  _pausa(seg){ if (seg == null || seg <= 0) return 20; return Math.min(50, Math.max(10, Math.round(seg / 10) * 10)); },
  _nombreEj(n){ const s = String(n ?? '').trim(); return typeof Motor === 'object' ? Motor.nombreVigente(s) : s; },
  _acotar(v, a, b){ return Math.min(b, Math.max(a, v)); },

  /* Una línea comparable. `l` usa las claves de LineaRutina de la app. */
  _linea(l){
    const modo = l.topBack ? 'topBack' : l.dropSet ? 'drop' : l.restPause ? 'rp' : 'normal';
    const out = {
      ejercicio: this._nombreEj(l.ejercicio),
      series: this._ent(l.series),
      reps: String(l.reps ?? '').replace(/\s+/g, ''),
      rir: modo === 'rp' ? null : this._ent(l.rir),
      descanso: typeof l.descansoMin === 'number' && isFinite(l.descansoMin) ? Math.round(l.descansoMin * 100) / 100 : null,
      modalidad: modo,
      superserie: !!l.superConAnterior,
    };
    if (modo === 'topBack'){ out.backoffPct = this._ent(l.backoffPct) ?? 15; out.rirBack = this._ent(l.rirBack) ?? 2; }
    if (modo === 'drop') out.dropPct = this._ent(l.dropPct) ?? 15;
    if (modo === 'rp') out.pausaRpSeg = this._pausa(this._ent(l.pausaRpSeg));
    return out;
  },

  /* planMod tal como lo guarda el móvil → {sistema, dias:[{nombre, lineas}]}.
     Días en orden de aparición; líneas por `orden`. */
  normalDePlanMod(plan, sistema){
    const dias = [], por = new Map();
    (plan || []).forEach(p => {
      const d = String(p.dia ?? '—');
      if (!por.has(d)){ por.set(d, []); dias.push(d); }
      por.get(d).push(p);
    });
    return {
      sistema: sistema === 'simple' ? 'simple' : 'doble',
      dias: dias.map(d => {
        const ls = por.get(d).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        return { nombre: d, lineas: ls.map((l, i) => ({ ...this._linea(this._dropComoLaApp(l, sistema)), superserie: i > 0 && l.superConAnterior === true && !this._conModo(l) && !this._conModo(ls[i - 1]) })) };
      }),
    };
  },
  _conModo(l){ return !!(l && (l.topBack || l.dropSet || l.restPause)); },
  /* Un drop set con rango la app lo deja en una sola cifra: la que abría la
     subida (en doble, el extremo alto). AppState._repsUnicasDropSet. */
  _dropComoLaApp(l, sistema){
    if (!l || !l.dropSet || l.topBack || (typeof Motor === 'object' && Motor.esPorTiempo(l.ejercicio))) return l;
    const nums = (String(l.reps ?? '').match(/\d+/g) || []).map(Number);
    if (nums.length < 2) return l;
    return { ...l, reps: `${sistema === 'simple' ? nums[0] : nums[nums.length - 1]}` };
  },

  /* I18n.canonical de la app (mapa de canonico.js): la app guarda los
     nombres en castellano. */
  _canon(v){
    const s = String(v ?? '').trim();
    return typeof CANON_ES !== 'undefined' && CANON_ES[s] ? CANON_ES[s] : s;
  },

  // ---------------------------------------------------------------
  // Paquete: borrador → `rutina` del paquete → lo que hará la app
  // ---------------------------------------------------------------

  /* `rutina` del paquete (contrato §3.2) a partir de un borrador: filas
     completas, modalidades saneadas, patrones vigentes y las mismas lecturas
     y valores por defecto que aplicaba el lector del Excel de la app
     (series 3, RIR 2, reps mín 8; en doble, máx > mín o mín + 2; drop set con
     un solo número; porcentajes acotados; pausa del rest-pause a la rejilla).
     Solo los días con ejercicios. Devuelve `{ rutina, notas }`; las notas
     dicen lo que se ha completado o ajustado. */
  paqueteRutina(rutina, raw, { nombre = '' } = {}){
    const P = this.reglas(raw);
    const { rutina: r } = P.prepararExportacion(this.normalizarRutina(rutina), raw);
    const sistema = r.sistema === 'simple' ? 'simple' : 'doble';
    const L = PaqueteEntrenador.LIMITES;
    const notas = [];
    const dias = r.dias.filter(d => d.filas.length).map((d, di) => {
      const nombreDia = String(d.nombre ?? '').trim() || `Día ${di + 1}`;
      const ss = Planner._gruposSuperserie(d.filas);
      const ejercicios = d.filas.slice(0, this.MAX_FILAS).map((f, i) => {
        const ej = this._canon(f.ejercicio);
        let series = this._ent(f.series) ?? 3;
        if (this._ent(f.series) == null) notas.push({ dia: nombreDia, ej, txt: `${ej}: sin series; la app usará ${series}.` });
        if (series < L.seriesMin || series > L.seriesMax){
          const n = this._acotar(series, L.seriesMin, L.seriesMax);
          notas.push({ dia: nombreDia, ej, txt: `${ej}: ${series} series no caben en un plan; irán ${n}.` });
          series = n;
        }
        const repMin = this._ent(f.repsMin) ?? 8;
        if (this._ent(f.repsMin) == null) notas.push({ dia: nombreDia, ej, txt: `${ej}: sin repeticiones; la app usará ${repMin}.` });
        const tb = !!f.topBack, drop = !!f.dropSet && !tb, rp = !!f.restPause && !tb && !drop;
        let reps = `${repMin}`;
        // Drop set: un único objetivo, también en doble; un rango conserva
        // su extremo alto (rutina_excel.dart).
        if (sistema === 'doble' && drop){
          const repMax = this._ent(f.repsMax);
          if (repMax != null && repMax > repMin) reps = `${repMax}`;
        } else if (sistema === 'doble'){
          const repMax = this._ent(f.repsMax) ?? repMin;
          const max = repMax > repMin ? repMax : repMin + 2;
          if (max !== repMax || this._ent(f.repsMax) == null)
            notas.push({ dia: nombreDia, ej, txt: `${ej}: en progresión doble el máximo debe superar al mínimo; la app usará ${repMin}–${max}.` });
          reps = `${repMin}-${max}`;
        }
        const fila = { patron: String(f.patron ?? ''), ejercicio: ej, series, reps, rir: `${this._ent(f.rir) ?? 2}` };
        if (typeof f.descanso === 'number' && isFinite(f.descanso)){
          if (f.descanso > 0 && f.descanso <= L.descansoMaxMin) fila.descanso = f.descanso;
          else notas.push({ dia: nombreDia, ej, txt: `${ej}: el descanso indicado no vale; la app usará el del ejercicio.` });
        }
        fila.topBack = tb;
        fila.backoffPct = this._acotar(this._ent(f.backoffPct) ?? 15, L.pctMin, L.pctMax);
        fila.rirBack = `${this._ent(f.rirBack) ?? 2}`;
        fila.dropSet = drop;
        fila.dropPct = this._acotar(this._ent(f.dropPct) ?? 15, L.pctMin, L.pctMax);
        fila.superserie = this._acotar(ss[i], 0, L.superserieMax);
        fila.restPause = rp;
        fila.pausaRpSeg = this._pausa(this._ent(f.pausaRpSeg) ?? 20);
        if (rp && typeof f.pausaRpSeg === 'number' && fila.pausaRpSeg !== f.pausaRpSeg)
          notas.push({ dia: nombreDia, ej, txt: `${ej}: la pausa del rest-pause se ajustará a ${fila.pausaRpSeg} s.` });
        return fila;
      });
      return { nombre: String(d.nombre ?? '').trim(), ejercicios };
    });
    // Solo los ejercicios propios que usa la rutina: los del cliente con su
    // ficha y los que no conoce la app, con la mínima (patrón y su grupo).
    const usados = new Set(dias.flatMap(d => d.ejercicios.map(e => P._claveEjercicio(e.ejercicio))));
    const ejercicios = r.biblioteca.filter(e => usados.has(P._claveEjercicio(e.nombre))).map(e => this._ejercicioPropio(e));
    const out = { nombre: String(nombre ?? '').trim().slice(0, L.textoMax), sistema, dias };
    if (ejercicios.length) out.ejercicios = ejercicios;
    return { rutina: out, notas };
  },

  /* Ficha de un ejercicio propio dentro de los límites del contrato. */
  _ejercicioPropio(e){
    const L = PaqueteEntrenador.LIMITES;
    const t = (v, max = L.textoMax) => [...String(v ?? '').trim()].slice(0, max).join('');
    const out = { nombre: t(e.nombre), grupo: t(e.grupo), patron: t(e.patron),
      secundarios: (Array.isArray(e.secundarios) ? e.secundarios : []).map(s => t(s)).filter(Boolean).slice(0, L.secundariosMax),
      prioridad: t(e.prioridad), nota: t(e.nota, L.notaMax), descanso: t(e.descanso) };
    if (e.porTiempo === true) out.porTiempo = true;
    return out;
  },

  /* Lo que construye `AppState.importarRutina` con la `rutina` de un
     paquete: días con ejercicios, nombres de día vacíos o repetidos,
     patrón del catálogo, porcentajes acotados, pausa a la rejilla,
     superseries por número y el saneo final de modalidades. Devuelve
     `{ sistema, dias:[{nombre, lineas}], notas, normal }`. */
  comoLaApp(paquete){
    const sistema = paquete.sistema === 'simple' ? 'simple' : 'doble';
    const notas = [];
    const nombres = new Set();
    const usados = (paquete.dias || []).filter(d => (d.ejercicios || []).length);
    const dias = usados.map((d, di) => {
      let nombre = String(d.nombre ?? '').trim();
      if (!nombre){ nombre = `Día ${di + 1}`; notas.push({ dia: nombre, txt: `Un día sin nombre se llamará «${nombre}» en la app.` }); }
      if (nombres.has(nombre)){
        const nuevo = `${nombre} (${di + 1})`;
        notas.push({ dia: nombre, txt: `Hay dos días llamados «${nombre}»: la app llamará al segundo «${nuevo}».` });
        nombre = nuevo;
      }
      nombres.add(nombre);
      let previa = 0;
      const lineas = d.ejercicios.map(e => {
        const ej = String(e.ejercicio).trim();
        const info = typeof CAT_FICHA === 'object' ? CAT_FICHA[ej] : null;
        const topBack = e.topBack === true;
        const superserie = e.superserie ?? 0;
        const l = {
          ejercicio: ej,
          patron: info ? patronVigente(info.patron, info.grupo) : patronVigente(e.patron ?? '', ''),
          series: e.series ?? 3, reps: e.reps ?? '', rir: e.rir ?? '',
          descansoMin: typeof e.descanso === 'number' ? e.descanso : null,
          topBack, backoffPct: this._acotar(e.backoffPct ?? 15, 5, 30), rirBack: e.rirBack ?? '2',
          dropSet: e.dropSet === true && !topBack, dropPct: this._acotar(e.dropPct ?? 15, 5, 30),
          superConAnterior: superserie !== 0 && superserie === previa,
          restPause: e.restPause === true, pausaRpSeg: this._pausa(e.pausaRpSeg),
        };
        previa = superserie;
        return l;
      });
      // Saneo final de la app (AppState._sanearModalidades).
      lineas.forEach((l, i) => {
        if (l.restPause && (l.topBack || l.dropSet)) l.restPause = false;
        Object.assign(l, this._dropComoLaApp(l, sistema));
        if (l.superConAnterior && i > 0 && (this._conModo(l) || this._conModo(lineas[i - 1]))) l.superConAnterior = false;
      });
      return { nombre, lineas };
    });
    return { sistema, dias, notas,
      normal: { sistema, dias: dias.map(d => ({ nombre: d.nombre, lineas: d.lineas.map(l => this._linea(l)) })) } };
  },

  /* Borrador → paquete y lo que hará la app con él, en un paso. */
  simular(rutina, raw, opciones = {}){
    const { rutina: paquete, notas } = this.paqueteRutina(rutina, raw, opciones);
    const sim = this.comoLaApp(paquete);
    return { ...sim, paquete, notas: [...notas, ...sim.notas] };
  },

  firma(normal){
    if (!normal) return null;
    return JSON.stringify({ s: normal.sistema, d: normal.dias.map(d => [d.nombre, d.lineas]) });
  },

  // ---------------------------------------------------------------
  // Comparación de dos rutinas (forma canónica)
  // ---------------------------------------------------------------

  CAMPOS: [
    ['series', 'Series'], ['reps', 'Repeticiones'], ['rir', 'RIR'], ['descanso', 'Descanso'],
    ['modalidad', 'Modalidad'], ['backoffPct', '% back-off'], ['rirBack', 'RIR back-off'],
    ['dropPct', '% drop'], ['pausaRpSeg', 'Pausa rest-pause'], ['superserie', 'Superserie con el anterior'],
  ],

  /* Diferencias de B respecto de A. Los días se emparejan por posición (la
     app numera los días en orden); los ejercicios de un día, por nombre y en
     orden de aparición si se repiten. No se deduce ninguna equivalencia
     entre ejercicios distintos. */
  diferencias(A, B){
    const out = { sistema: null, numDias: null, dias: [], iguales: true };
    if (!A || !B) return null;
    if (A.sistema !== B.sistema){ out.sistema = { antes: A.sistema, despues: B.sistema }; out.iguales = false; }
    if (A.dias.length !== B.dias.length){ out.numDias = { antes: A.dias.length, despues: B.dias.length }; out.iguales = false; }
    const n = Math.max(A.dias.length, B.dias.length);
    for (let i = 0; i < n; i++){
      const a = A.dias[i], b = B.dias[i];
      const d = { indice: i, antes: a ? a.nombre : null, despues: b ? b.nombre : null, cambios: [], ordenCambiado: false,
                  estado: !a ? 'nuevo' : !b ? 'quitado' : 'igual' };
      if (a && b){
        if (a.nombre !== b.nombre) d.renombrado = true;
        const usados = new Set();
        const pares = [];
        b.lineas.forEach((lb, jb) => {
          const ja = a.lineas.findIndex((la, k) => !usados.has(k) && la.ejercicio === lb.ejercicio);
          if (ja < 0){ d.cambios.push({ tipo: 'nuevo', ejercicio: lb.ejercicio, despues: lb }); return; }
          usados.add(ja);
          pares.push([ja, jb]);
          // En rest-pause no hay RIR (todo al fallo): el cambio de modalidad ya lo dice.
          const rp = a.lineas[ja].modalidad === 'rp' || lb.modalidad === 'rp';
          const campos = this.CAMPOS.filter(([k]) => !(rp && k === 'rir') && JSON.stringify(a.lineas[ja][k] ?? null) !== JSON.stringify(lb[k] ?? null))
            .map(([k, txt]) => ({ campo: k, txt, antes: a.lineas[ja][k] ?? null, despues: lb[k] ?? null }));
          if (campos.length) d.cambios.push({ tipo: 'cambiado', ejercicio: lb.ejercicio, campos, antes: a.lineas[ja], despues: lb });
        });
        a.lineas.forEach((la, ja) => { if (!usados.has(ja)) d.cambios.push({ tipo: 'quitado', ejercicio: la.ejercicio, antes: la }); });
        const seq = pares.slice().sort((x, y) => x[1] - y[1]).map(p => p[0]);
        d.ordenCambiado = seq.some((v, k) => k > 0 && v < seq[k - 1]);
        if (d.renombrado || d.cambios.length || d.ordenCambiado) d.estado = 'cambiado';
      } else if (b) b.lineas.forEach(l => d.cambios.push({ tipo: 'nuevo', ejercicio: l.ejercicio, despues: l }));
      else a.lineas.forEach(l => d.cambios.push({ tipo: 'quitado', ejercicio: l.ejercicio, antes: l }));
      if (d.estado !== 'igual') out.iguales = false;
      out.dias.push(d);
    }
    return out;
  },

  /* Series semanales por grupo y días en que se entrena cada grupo, con el
     mismo reparto que la app (Analisis.volumenPlan), una pasada por día. Los
     ejercicios fuera del catálogo y de la biblioteca del cliente no suman
     (se enumeran). `raw` puede ser null (cliente sin copia). */
  grupos(raw, normal){
    if (!normal) return null;
    const M = { raw: raw || {} };
    const lineas = [];
    normal.dias.forEach(d => d.lineas.forEach(l => lineas.push({ dia: d.nombre, ejercicio: l.ejercicio, series: l.series })));
    const vp = Analisis.volumenPlan(M, lineas);
    const sinGrupo = [...new Set(lineas.filter(l => !Analisis.info(M, l.ejercicio)).map(l => l.ejercicio))];
    return { series: vp.series, dias: vp.dias, sinGrupo, totalSeries: lineas.reduce((s, l) => s + (l.series || 0), 0), numDias: normal.dias.length };
  },

  resumenGrupos(raw, A, B){
    const ga = this.grupos(raw, A), gb = this.grupos(raw, B);
    const filas = Motor.GRUPOS_VOLUMEN.map(g => {
      const sa = ga ? ga.series.get(g) || 0 : null, sb = gb ? gb.series.get(g) || 0 : null;
      const da = ga ? ga.dias.get(g) || 0 : null, db = gb ? gb.dias.get(g) || 0 : null;
      return { grupo: g, seriesAntes: sa, seriesDespues: sb, diasAntes: da, diasDespues: db,
               dSeries: sa != null && sb != null ? Math.round((sb - sa) * 10) / 10 : null,
               dDias: da != null && db != null ? db - da : null };
    }).filter(f => f.seriesAntes || f.seriesDespues);
    return { filas, antes: ga, despues: gb };
  },

  // ---------------------------------------------------------------
  // Avisos antes de emitir y lectura de la progresión en la app
  // ---------------------------------------------------------------

  /* {bloquea, avisos:[{nivel:'rojo'|'ambar'|'azul', txt, dia?}], sim}.
     `bloquea` impide emitir (la app rechazaría el paquete). */
  avisos(rutina, raw, opciones = {}){
    const avisos = [];
    const add = (nivel, txt, dia = null) => avisos.push({ nivel, txt, dia });
    const R = this.normalizarRutina(rutina);
    const P = this.reglas(raw);
    const conocidos = new Set((P.ejerciciosCoach() || []).map(e => P._claveEjercicio(e.nombre)));
    const L = PaqueteEntrenador.LIMITES;
    R.dias.forEach((d, di) => {
      const nombreDia = String(d.nombre || '').trim() || `Día ${di + 1}`;
      const vistos = new Set();
      d.filas.forEach(f => {
        if (!f.patron && !f.ejercicio) return;
        if (!f.ejercicio || !f.patron || f.patron === '(Ninguno)'){
          add('ambar', `${nombreDia}: hay una fila sin ${!f.ejercicio ? 'ejercicio' : 'patrón'}; no se incluirá.`, di);
          return;
        }
        if ([...String(f.ejercicio)].length > L.textoMax) add('rojo', `${nombreDia}: el nombre «${String(f.ejercicio).slice(0, 30)}…» es demasiado largo.`, di);
        if (vistos.has(f.ejercicio)) add('azul', `${nombreDia}: «${f.ejercicio}» aparece dos veces en el mismo día.`, di);
        vistos.add(f.ejercicio);
        if (f.dropSet && (f.series || 0) < 2) add('ambar', `${nombreDia} · ${f.ejercicio}: un drop set necesita al menos 2 series.`, di);
        if (f.restPause && (f.series || 0) < 2) add('ambar', `${nombreDia} · ${f.ejercicio}: un rest-pause necesita al menos 2 series; con una sola la app lo hará como serie normal.`, di);
        if (f.restPause && Motor.esPorTiempo(f.ejercicio, raw))
          add('ambar', `${nombreDia} · ${f.ejercicio}: se mide por tiempo; la app no le aplica el rest-pause.`, di);
        if (!P._esEjercicioBase(f.ejercicio) && !conocidos.has(P._claveEjercicio(f.ejercicio)))
          add('azul', `${nombreDia} · «${f.ejercicio}» no está en el catálogo ni en la biblioteca del cliente: la app lo añadirá como ejercicio nuevo y le pedirá confirmación. Revisa que el nombre sea exacto.`, di);
      });
      if (!d.filas.some(f => f.patron && f.ejercicio)) add('azul', `${nombreDia} no tiene ejercicios: no se incluirá.`, di);
    });
    const sim = this.simular(R, raw, opciones);
    sim.notas.forEach(n => add('ambar', n.txt));
    const nDias = sim.dias.length;
    if (nDias < this.MIN_DIAS || nDias > this.MAX_DIAS)
      add('rojo', `La app necesita entre ${this.MIN_DIAS} y ${this.MAX_DIAS} días con ejercicios; ahora hay ${nDias}.`);
    else {
      // Red de seguridad: el paquete tiene que pasar la misma validación que
      // hará la app (contrato §3). Si no, no se emite.
      const err = PaqueteEntrenador.validarCarga({ id: 'pe_comprobacion', emitido: '2026-01-01',
        entrenador: { nombre: 'E' }, cliente: { nombre: 'C' }, rutina: sim.paquete });
      if (err) add('rojo', `La app no aceptaría esta rutina (${err.detalle}).`);
    }
    const orden = { rojo: 0, ambar: 1, azul: 2 };
    avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return { bloquea: avisos.some(a => a.nivel === 'rojo'), avisos, sim };
  },

  /* Lo que dirá la app sobre las cargas al aplicar (ui.dart ·
     avisoProgresionImportacion → AppState.importacionConservaProgresion):
     con el mismo sistema y número de días sigue proponiendo las cargas de
     los ejercicios que se repiten; si cambia, empiezan de nuevo (historial y
     récords se conservan). Solo si la copia trae sesiones de la rutina
     actual. null si no aplica. */
  progresion(raw, sim){
    if (!raw || !sim) return null;
    const hayLogs = Array.isArray(raw.logs) && raw.logs.some(l => l && typeof l === 'object' && Motor.esLogDeRutinaActual(l, raw));
    if (!hayLogs) return null;
    const mismoSistema = (raw.sistema === 'simple' ? 'simple' : 'doble') === sim.sistema;
    const mismosDias = String(raw.dias) === String(sim.dias.length);
    return { conserva: mismoSistema && mismosDias, mismoSistema, mismosDias,
             sistemaAntes: raw.sistema === 'simple' ? 'simple' : 'doble', diasAntes: String(raw.dias ?? '—') };
  },

  // ---------------------------------------------------------------
  // Borradores (almacén «entrenador», tipo 'borrador')
  // ---------------------------------------------------------------

  /* origen: {tipo:'copia'|'blanco'|'borrador', rutina, firma?, normal?,
     instantaneaId?, desde?, deEspacio?, deBorrador?}
     Un borrador es el plan entero: la rutina (que puede no ir en el plan,
     `incluirRutina: false`) y la temporada (null si no lleva;
     entrenador/temporada.js). */
  nuevoBorrador({ espacioId, nombre, rutina, origen, temporada = null, incluirRutina = true, ahora = new Date().toISOString(), id = null }){
    const r = this.normalizarRutina(rutina);
    return {
      id: id || `bor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'borrador', version: this.VERSION_BORRADOR, espacioId,
      nombre: String(nombre || 'Borrador').slice(0, 80),
      creado: ahora, actualizado: ahora, rutina: r,
      incluirRutina: incluirRutina !== false,
      temporada: TemporadaEntrenador.normalizar(temporada),
      origen: { tipo: 'blanco', ...origen, rutina: this.normalizarRutina(origen && origen.rutina ? origen.rutina : r) },
    };
  },

  /* Registros incompletos o de versiones anteriores: valores por defecto
     sin perder lo que traen. Los borradores de antes de la temporada
     (F3) llevan rutina y nada más. */
  leerBorrador(b){
    if (!b || typeof b !== 'object' || !b.id || b.tipo !== 'borrador') return null;
    return { ...b, version: b.version || 1, nombre: String(b.nombre || 'Borrador'),
             rutina: this.normalizarRutina(b.rutina),
             incluirRutina: b.incluirRutina !== false,
             temporada: TemporadaEntrenador.normalizar(b.temporada),
             origen: { tipo: 'blanco', ...(b.origen || {}), rutina: this.normalizarRutina(b.origen && b.origen.rutina ? b.origen.rutina : b.rutina) } };
  },

  /* Lo que se deshace y rehace: todo el contenido del plan. */
  contenido(b){
    return this.clonar({ rutina: b.rutina, incluirRutina: b.incluirRutina !== false, temporada: b.temporada || null });
  },

  /* ¿Ha cambiado la rutina de la copia desde que se creó el borrador a
     partir de ella? Solo para borradores que salieron de la copia. */
  discrepancia(borrador, raw){
    if (!borrador || !borrador.origen || borrador.origen.tipo !== 'copia' || !borrador.origen.firma) return null;
    const copia = this.rutinaCopia(raw);
    const firmaActual = copia ? this.firma(copia.normal) : null;
    if (firmaActual === borrador.origen.firma) return null;
    return { copia, sinRutina: !copia, diff: copia && borrador.origen.normal ? this.diferencias(borrador.origen.normal, copia.normal) : null };
  },

  /* Origen «copia» con la rutina de la copia vigente. */
  origenCopia(raw, inst){
    const c = this.rutinaCopia(raw);
    if (!c) return null;
    return { tipo: 'copia', firma: this.firma(c.normal), normal: c.normal, rutina: c.rutina,
             instantaneaId: inst?.id || null, desde: inst?.resumen?.ultimoRegistro || null };
  },

  // ---------------------------------------------------------------
  // Edición (operaciones puras sobre una copia; el llamante guarda)
  // ---------------------------------------------------------------

  /* op: {tipo, d, f, k, valor, delta} → nueva rutina, o null si no aplica. */
  editar(rutina, op){
    const r = this.clonar(rutina);
    const dia = r.dias[op.d];
    switch (op.tipo){
      case 'campo': {
        if (!dia || !dia.filas[op.f]) return null;
        if (op.k === 'modalidad'){
          for (const k of ['backoffPct', 'rirBack', 'dropPct', 'pausaRpSeg']) if (dia.filas[op.f][k] == null) dia.filas[op.f][k] = this.filaVacia()[k];
          const f = dia.filas[op.f];
          const k = { topBack: 'topBack', drop: 'dropSet', rp: 'restPause' }[op.valor];
          if (k) Planner.aplicarCampo(dia.filas, op.f, k, true, r.sistema);
          else { f.topBack = false; Planner._quitarDrop(f, r.sistema); f.restPause = false; }
        } else Planner.aplicarCampo(dia.filas, op.f, op.k, op.valor, r.sistema);
        // Ejercicio elegido sin patrón: el de su ficha del catálogo.
        const f = dia.filas[op.f];
        if (op.k === 'ejercicio' && !f.patron && typeof CAT_FICHA === 'object' && CAT_FICHA[f.ejercicio])
          f.patron = patronVigente(CAT_FICHA[f.ejercicio].patron, CAT_FICHA[f.ejercicio].grupo);
        Planner._sanearModalidades(dia.filas, r.sistema);
        return r;
      }
      case 'sistema': r.sistema = op.valor === 'simple' ? 'simple' : 'doble'; return r;
      case 'nombreDia': if (!dia) return null; dia.nombre = String(op.valor ?? '').trim().slice(0, 40) || `Día ${op.d + 1}`; return r;
      case 'addFila': if (!dia || dia.filas.length >= this.MAX_FILAS) return null; dia.filas.push(this.filaVacia()); return r;
      case 'delFila': if (!dia || !dia.filas[op.f]) return null; dia.filas.splice(op.f, 1); Planner._sanearModalidades(dia.filas, r.sistema); return r;
      case 'moverFila': {
        if (!dia) return null;
        const to = op.f + op.delta;
        if (to < 0 || to >= dia.filas.length) return null;
        const [x] = dia.filas.splice(op.f, 1);
        dia.filas.splice(to, 0, x);
        Planner._sanearModalidades(dia.filas, r.sistema);
        return r;
      }
      case 'addDia':
        if (r.dias.length >= this.MAX_DIAS) return null;
        r.dias.push({ nombre: `Día ${r.dias.length + 1}`, filas: [this.filaVacia()] });
        return r;
      case 'delDia': if (!dia || r.dias.length <= 1) return null; r.dias.splice(op.d, 1); return r;
      case 'moverDia': {
        const to = op.d + op.delta;
        if (!dia || to < 0 || to >= r.dias.length) return null;
        const [x] = r.dias.splice(op.d, 1);
        r.dias.splice(to, 0, x);
        return r;
      }
    }
    return null;
  },

  /* Ejercicios que se pueden elegir para un patrón: catálogo de la app y la
     biblioteca del cliente (ejercicios creados en su móvil). */
  opcionesEjercicio(patron, raw){
    const cat = (typeof CAT_LISTAS === 'object' && CAT_LISTAS[patron]) ? CAT_LISTAS[patron] : [];
    const propios = (Array.isArray(raw && raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [])
      .filter(e => e && e.nombre && (!patron || Planner._normalizarEjercicio(e, {}, 'json').patron === patron))
      .map(e => String(e.nombre).trim());
    return [...new Set([...cat, ...propios])];
  },

  // ---------------------------------------------------------------
  // Clientes sin copia: ficha manual (solo para el entrenador)
  // ---------------------------------------------------------------

  /* La ficha no viaja en el paquete (solo el nombre del cliente). */
  /* Rangos de la ficha: los que la app admite a mano y los del contrato
     (cliente.datos, v2), para que lo que viaja en el plan la app lo acepte. */
  rangosFicha(){
    const L = PaqueteEntrenador.LIMITES;
    return { pesoKg: [L.pesoMinKg, L.pesoMaxKg, 'El peso', 'kg'], alturaCm: [L.alturaMinCm, L.alturaMaxCm, 'La altura', 'cm'],
             grasaPct: [L.grasaMinPct, L.grasaMaxPct, 'El % graso', '%'] };
  },
  _numFicha(v){ return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); },
  /* Campos numéricos escritos pero fuera de rango: [{ campo, txt }]. */
  fueraDeRango(f){
    const o = f && typeof f === 'object' ? f : {};
    return Object.entries(this.rangosFicha()).filter(([k]) => String(o[k] ?? '').trim() !== '').flatMap(([k, [a, b, nombre, u]]) => {
      const n = this._numFicha(o[k]);
      return isFinite(n) && n >= a && n <= b ? [] : [{ campo: k, txt: `${nombre} tiene que estar entre ${a} y ${b} ${u}.` }];
    });
  },
  /* Lo que viaja en el plan (cliente.datos): sexo, peso, altura y % graso. */
  datosPaquete(ficha){
    if (!ficha) return null;
    const f = this.leerFicha(ficha);
    const d = {};
    if (f.sexo) d.sexo = f.sexo;
    for (const k of ['pesoKg', 'alturaCm', 'grasaPct']) if (f[k] != null) d[k] = f[k];
    return Object.keys(d).length ? d : null;
  },
  leerFicha(f){
    const o = f && typeof f === 'object' ? f : {};
    const R = this.rangosFicha();
    const num = (v, [a, b]) => { const n = this._numFicha(v); return isFinite(n) && n >= a && n <= b ? Math.round(n * 10) / 10 : null; };
    const txt = (v, max) => String(v ?? '').trim().slice(0, max);
    return {
      sexo: ['hombre', 'mujer'].includes(o.sexo) ? o.sexo : '',
      pesoKg: num(o.pesoKg, R.pesoKg), alturaCm: num(o.alturaCm, R.alturaCm), grasaPct: num(o.grasaPct, R.grasaPct),
      experiencia: ['principiante', 'intermedio', 'avanzado'].includes(o.experiencia) ? o.experiencia : '',
      dias: (() => { const n = parseInt(o.dias, 10); return n >= 2 && n <= 7 ? n : null; })(),
      notas: txt(o.notas, 2000),
    };
  },
};
