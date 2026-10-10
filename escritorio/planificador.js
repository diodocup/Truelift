'use strict';
/* ================================================================
   TrueLift Escritorio — planificador.js
   Modelo del planificador personal (fase 6). Solo cálculo, sin DOM.

   - El editor trabaja sobre el modelo de rutina del planificador del
     Coach ({sistema, dias:[{nombre, filas:[…]}]}) y reutiliza sus reglas
     (../coach/planner.js: modalidades, superseries, limpieza para
     exportar, biblioteca) y su Excel (../coach/xlsx.js).
   - Tres cosas distintas que la interfaz no debe confundir:
       · rutina del móvil: la que trae la copia JSON importada (consulta);
       · borrador: lo que se edita aquí, guardado aparte en el navegador;
       · archivo exportado: el Excel generado. Exportar NO aplica nada:
         el móvil solo cambia cuando la persona importa ese Excel allí.
   - `comoLaApp` reproduce lo que hace el importador del móvil
     (rutina_excel.dart + AppState.importarRutina) con el Excel que se
     va a exportar, para comparar con la rutina del móvil sin suponer.
   Definiciones y fuentes: escritorio/PLANIFICADOR.md.
   ================================================================ */

const Planificador = {

  VERSION_BORRADOR: 1,
  MAX_DESHACER: 50,
  MIN_DIAS: 2,

  // ---------------------------------------------------------------
  // Reglas compartidas con el Coach
  // ---------------------------------------------------------------

  /* Planner del Coach con la biblioteca de ESTA persona (sus ejercicios
     creados en la app) en lugar de la del entrenador. No toca su estado. */
  reglas(raw){
    const P = Object.create(Planner);
    const propios = (Array.isArray(raw && raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [])
      .map(e => Planner._normalizarEjercicio(e, {}, 'json')).filter(Boolean);
    P.ejerciciosCoach = () => propios;
    return P;
  },

  clonar(x){ return JSON.parse(JSON.stringify(x)); },

  /* Copia con los ejercicios propios que trajo un Excel abierto como
     borrador (bloque de biblioteca de la app) y que tu copia no tiene: así
     el Excel exportado los vuelve a llevar con sus datos. Solo para
     exportar; los avisos siguen usando tu biblioteca real. */
  rawConBiblioteca(raw, borrador){
    const extra = Array.isArray(borrador && borrador.bibliotecaExcel) ? borrador.bibliotecaExcel : [];
    if (!extra.length) return raw;
    const propios = Array.isArray(raw && raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [];
    const ya = new Set(propios.map(e => Planner._claveEjercicio(e && e.nombre)));
    const nuevos = extra.filter(e => e && e.nombre && !ya.has(Planner._claveEjercicio(e.nombre)) && !Planner._esEjercicioBase(e.nombre));
    return nuevos.length ? { ...raw, ejerciciosUsuario: [...propios, ...nuevos] } : raw;
  },

  rutinaVacia(){ return Planner.rutinaVacia(); },
  filaVacia(){ return Planner.filaVacia(); },

  /* Deja una rutina leída (copia, Excel, borrador antiguo) en la forma que
     espera el editor: claves por defecto, patrones vigentes y modalidades
     saneadas. Devuelve una copia. */
  normalizarRutina(rutina){
    const r = this.clonar(rutina || this.rutinaVacia());
    r.sistema = r.sistema === 'simple' ? 'simple' : 'doble';
    r.dias = (Array.isArray(r.dias) ? r.dias : []).slice(0, XLSX.MAX_DIAS).map((d, i) => ({
      nombre: String(d && d.nombre != null ? d.nombre : `Día ${i + 1}`),
      filas: (Array.isArray(d && d.filas) ? d.filas : []).slice(0, XLSX.MAX_FILAS)
        .map(f => {
          // Sin dato en los parámetros de las modalidades valen los de la app
          // (15 %, RIR 2, 20 s): así se ven al activarlas y se exportan igual.
          const fila = { ...this.filaVacia(), ...f };
          for (const k of ['backoffPct', 'rirBack', 'dropPct', 'pausaRpSeg']) if (fila[k] == null) fila[k] = this.filaVacia()[k];
          return fila;
        }),
    }));
    r.dias.forEach(d => { Planner._patronesVigentes(d.filas); Planner._sanearModalidades(d.filas); });
    return r;
  },

  // ---------------------------------------------------------------
  // Rutina del móvil (copia JSON)
  // ---------------------------------------------------------------

  /* Sistema de la rutina guardada: el de su clave («sexo_sistema|días») si
     la trae; si no, el ajuste actual. */
  _sistemaPlan(raw){
    const m = /^[^_|]+_(simple|doble)\|/.exec(String(raw.planModKey || ''));
    return m ? m[1] : (raw.sistema === 'simple' ? 'simple' : 'doble');
  },

  /* La rutina personalizada de la copia, en el modelo del editor, con su
     contexto: si es la de la combinación actual y si el móvil la tiene «a
     prueba» (importada y sin confirmar). null si la copia no trae rutina
     personalizada (se usa una prefijada de la app, que no viaja). */
  rutinaMovil(raw){
    const plan = Array.isArray(raw && raw.planMod) ? raw.planMod.filter(p => p && typeof p === 'object') : [];
    if (!plan.length) return null;
    const sistema = this._sistemaPlan(raw);
    const rutina = this.normalizarRutina(XLSX.desdePlanMod(plan, sistema));
    const combo = `${raw.sexo}_${raw.sistema}|${raw.dias}`;
    // El Excel admite 5 días y 10 ejercicios por día: lo que no cabe no se
    // puede editar aquí sin perderlo, y se avisa.
    const porDia = new Map();
    plan.forEach(p => porDia.set(String(p.dia ?? '—'), (porDia.get(String(p.dia ?? '—')) || 0) + 1));
    const recortada = porDia.size > XLSX.MAX_DIAS || [...porDia.values()].some(n => n > XLSX.MAX_FILAS);
    const pend = raw.importPendiente && typeof raw.importPendiente === 'object' ? raw.importPendiente : null;
    return {
      rutina,
      normal: this.normalDePlanMod(plan, sistema),
      vigente: raw.planModKey === combo,
      recortada,
      aPrueba: pend ? { nombre: typeof pend.nombre === 'string' ? pend.nombre : '', origen: typeof pend.origen === 'string' ? pend.origen : '' } : null,
    };
  },

  // ---------------------------------------------------------------
  // Forma canónica para comparar (lo que de verdad usa el móvil)
  // ---------------------------------------------------------------

  _ent(v){ const m = /\d+/.exec(String(v ?? '')); return m ? parseInt(m[0], 10) : null; },
  _pausa(seg){ if (seg == null || seg <= 0) return 20; return Math.min(50, Math.max(10, Math.round(seg / 10) * 10)); },
  _nombreEj(n){ const s = String(n ?? '').trim(); return typeof Motor === 'object' ? Motor.nombreVigente(s) : s; },

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
        return { nombre: d, lineas: ls.map((l, i) => ({ ...this._linea(l), superserie: i > 0 && l.superConAnterior === true && !this._conModo(l) && !this._conModo(ls[i - 1]) })) };
      }),
    };
  },
  _conModo(l){ return !!(l && (l.topBack || l.dropSet || l.restPause)); },

  /* Lo que el móvil construirá al importar el Excel que exporta este
     borrador: misma limpieza que el exportador (Planner.prepararExportacion)
     y las mismas lecturas y valores por defecto del importador de la app
     (rutina_excel.dart: C/D/E/F/G…O, días sin ejercicios fuera, nombres de
     día vacíos o repetidos, reps «mín-máx» con máx > mín, porcentajes
     acotados, pausa del rest-pause a la rejilla de 10 s y saneo final de
     modalidades). Devuelve también las filas que la app reinterpreta. */
  comoLaApp(rutina, raw){
    const { rutina: r } = this.reglas(raw).prepararExportacion(this.normalizarRutina(rutina), raw);
    const sistema = r.sistema === 'simple' ? 'simple' : 'doble';
    const notas = [];
    const usados = r.dias.filter(d => d.filas.length);
    const nombres = new Set();
    const dias = usados.map((d, di) => {
      let nombre = this._canon(d.nombre);
      if (!nombre){ nombre = `Día ${di + 1}`; notas.push({ dia: d.nombre, txt: `Un día sin nombre se llamará «${nombre}» en la app.` }); }
      if (nombres.has(nombre)){
        const nuevo = `${nombre} (${di + 1})`;
        notas.push({ dia: nombre, txt: `Hay dos días llamados «${nombre}»: la app llamará al segundo «${nuevo}».` });
        nombre = nuevo;
      }
      nombres.add(nombre);
      const ss = XLSX._numerosSuperserie(d.filas);
      const lineas = d.filas.slice(0, XLSX.MAX_FILAS).map((f, i) => {
        const ej = this._canon(f.ejercicio);
        const series = this._ent(f.series) ?? 3;
        if (this._ent(f.series) == null) notas.push({ dia: nombre, ej, txt: `${ej}: sin series; la app usará ${series}.` });
        const repMin = this._ent(f.repsMin) ?? 8;
        if (this._ent(f.repsMin) == null) notas.push({ dia: nombre, ej, txt: `${ej}: sin repeticiones; la app usará ${repMin}.` });
        let reps = `${repMin}`;
        if (sistema === 'doble'){
          const repMax = this._ent(f.repsMax) ?? repMin;
          const max = repMax > repMin ? repMax : repMin + 2;
          if (max !== repMax || this._ent(f.repsMax) == null)
            notas.push({ dia: nombre, ej, txt: `${ej}: en progresión doble el máximo debe superar al mínimo; la app usará ${repMin}–${max}.` });
          reps = `${repMin}-${max}`;
        }
        const tb = !!f.topBack, drop = !!f.dropSet && !tb, rp = !!f.restPause && !tb && !f.dropSet;
        const linea = {
          ejercicio: ej, series, reps, rir: `${this._ent(f.rir) ?? 2}`,
          descansoMin: typeof f.descanso === 'number' && isFinite(f.descanso) ? f.descanso : null,
          topBack: tb, backoffPct: Math.min(30, Math.max(5, this._ent(f.backoffPct) ?? 15)), rirBack: `${this._ent(f.rirBack) ?? 2}`,
          dropSet: drop, dropPct: Math.min(30, Math.max(5, this._ent(f.dropPct) ?? 15)),
          restPause: rp, pausaRpSeg: this._pausa(this._ent(f.pausaRpSeg) ?? 20),
          superConAnterior: ss[i] !== 0 && i > 0 && ss[i - 1] === ss[i],
        };
        if (rp && typeof f.pausaRpSeg === 'number' && this._pausa(this._ent(f.pausaRpSeg)) !== f.pausaRpSeg)
          notas.push({ dia: nombre, ej, txt: `${ej}: la pausa del rest-pause se ajustará a ${linea.pausaRpSeg} s.` });
        return linea;
      });
      // Saneo final de la app (AppState._sanearModalidades).
      lineas.forEach((l, i) => {
        if (l.topBack && l.dropSet) l.dropSet = false;
        if (l.restPause && (l.topBack || l.dropSet)) l.restPause = false;
        if (l.superConAnterior && i > 0 && (this._conModo(l) || this._conModo(lineas[i - 1]))) l.superConAnterior = false;
      });
      return { nombre, lineas };
    });
    return {
      sistema, dias, notas, biblioteca: r.biblioteca, exportable: r,
      normal: { sistema, dias: dias.map(d => ({ nombre: d.nombre, lineas: d.lineas.map(l => this._linea(l)) })) },
    };
  },

  /* I18n.canonical de la app (mapa de canonico.js): la app guarda los
     nombres en castellano aunque el Excel llegue traducido. */
  _canon(v){
    const s = String(v ?? '').trim();
    return typeof CANON_ES !== 'undefined' && CANON_ES[s] ? CANON_ES[s] : s;
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
        // Orden: los ejercicios comunes, ¿siguen en la misma secuencia?
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
     mismo reparto que la app (Analisis.volumenPlan → Motor.seriesPorGrupo),
     suponiendo una pasada por cada día de la rutina. Los ejercicios que no
     están en el catálogo ni en tu biblioteca no suman (se enumeran). */
  grupos(M, normal){
    if (!normal) return null;
    const lineas = [];
    normal.dias.forEach(d => d.lineas.forEach(l => lineas.push({ dia: d.nombre, ejercicio: l.ejercicio, series: l.series })));
    const vp = Analisis.volumenPlan(M, lineas);
    const sinGrupo = [...new Set(lineas.filter(l => !Analisis.info(M, l.ejercicio)).map(l => l.ejercicio))];
    return { series: vp.series, dias: vp.dias, sinGrupo, totalSeries: lineas.reduce((s, l) => s + (l.series || 0), 0), numDias: normal.dias.length };
  },

  resumenGrupos(M, A, B){
    const ga = this.grupos(M, A), gb = this.grupos(M, B);
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
  // Avisos antes de exportar y lectura de la progresión en la app
  // ---------------------------------------------------------------

  /* {bloquea, avisos:[{nivel:'rojo'|'ambar'|'azul', txt, dia?}]}. `bloquea`
     impide exportar (el importador del móvil la rechazaría). */
  avisos(rutina, raw){
    const avisos = [];
    const add = (nivel, txt, dia = null) => avisos.push({ nivel, txt, dia });
    const R = this.normalizarRutina(rutina);
    const P = this.reglas(raw);
    const conocidos = new Set((P.ejerciciosCoach() || []).map(e => P._claveEjercicio(e.nombre)));
    R.dias.forEach((d, di) => {
      const nombreDia = String(d.nombre || '').trim() || `Día ${di + 1}`;
      const vistos = new Set();
      d.filas.forEach(f => {
        if (!f.patron && !f.ejercicio) return;
        if (!f.ejercicio || !f.patron || f.patron === '(Ninguno)'){
          add('ambar', `${nombreDia}: hay una fila sin ${!f.ejercicio ? 'ejercicio' : 'patrón'}; no se exportará.`, di);
          return;
        }
        if (vistos.has(f.ejercicio)) add('azul', `${nombreDia}: «${f.ejercicio}» aparece dos veces en el mismo día.`, di);
        vistos.add(f.ejercicio);
        if (f.dropSet && (f.series || 0) < 2) add('ambar', `${nombreDia} · ${f.ejercicio}: un drop set necesita al menos 2 series.`, di);
        if (f.restPause && (f.series || 0) < 2) add('ambar', `${nombreDia} · ${f.ejercicio}: un rest-pause necesita al menos 2 series; con una sola la app lo hará como serie normal.`, di);
        if (f.restPause && Motor.esPorTiempo(f.ejercicio, raw))
          add('ambar', `${nombreDia} · ${f.ejercicio}: se mide por tiempo; la app no le aplica el rest-pause.`, di);
        if (!P._esEjercicioBase(f.ejercicio) && !conocidos.has(P._claveEjercicio(f.ejercicio)))
          add('azul', `${nombreDia} · «${f.ejercicio}» no está en el catálogo ni en tu biblioteca: la app lo añadirá como ejercicio nuevo y te pedirá confirmación. Revisa que el nombre sea exacto.`, di);
      });
      if (!d.filas.some(f => f.patron && f.ejercicio)) add('azul', `${nombreDia} no tiene ejercicios: la app no lo incluirá.`, di);
    });
    const sim = this.comoLaApp(R, raw);
    sim.notas.forEach(n => add('ambar', n.txt));
    const nDias = sim.dias.length;
    if (nDias < this.MIN_DIAS || nDias > XLSX.MAX_DIAS)
      add('rojo', `La app necesita entre ${this.MIN_DIAS} y ${XLSX.MAX_DIAS} días con ejercicios; ahora hay ${nDias}.`);
    const orden = { rojo: 0, ambar: 1, azul: 2 };
    avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return { bloquea: avisos.some(a => a.nivel === 'rojo'), avisos, sim };
  },

  /* Lo que dirá la app sobre las cargas al importar (ui.dart ·
     avisoProgresionImportacion → AppState.importacionConservaProgresion):
     con el mismo sistema y número de días, sigue proponiendo las cargas de
     los ejercicios que se repiten; si cambia, vuelve a empezar las cargas
     propuestas (historial y récords se conservan). Solo lo dice cuando hay
     sesiones de la rutina actual. null si no aplica. */
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
  // Borradores
  // ---------------------------------------------------------------

  /* origen: {tipo:'movil'|'excel'|'blanco'|'copia', rutina, firma?, archivo?,
     instantaneaId?, desde?} */
  nuevoBorrador({ espacioId, nombre, rutina, origen, ahora = new Date().toISOString(), id = null }){
    const r = this.normalizarRutina(rutina);
    return {
      id: id || `bor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      version: this.VERSION_BORRADOR, espacioId, nombre: String(nombre || 'Borrador').slice(0, 80),
      creado: ahora, actualizado: ahora, rutina: r,
      origen: { ...origen, rutina: this.normalizarRutina(origen && origen.rutina ? origen.rutina : r) },
      exportaciones: [],
    };
  },

  /* Borradores guardados por versiones anteriores o incompletos: se leen
     con valores por defecto, sin perder lo que traen. */
  leerBorrador(b){
    if (!b || typeof b !== 'object' || !b.id) return null;
    return { ...b, version: b.version || 1, nombre: String(b.nombre || 'Borrador'),
             rutina: this.normalizarRutina(b.rutina), origen: { tipo: 'blanco', ...(b.origen || {}), rutina: this.normalizarRutina(b.origen && b.origen.rutina ? b.origen.rutina : b.rutina) },
             exportaciones: Array.isArray(b.exportaciones) ? b.exportaciones : [] };
  },

  /* ¿Ha cambiado la rutina del móvil desde que se creó el borrador a partir
     de ella? Solo para borradores que salieron de la copia. */
  discrepancia(borrador, raw){
    if (!borrador || !borrador.origen || borrador.origen.tipo !== 'movil' || !borrador.origen.firma) return null;
    const movil = this.rutinaMovil(raw);
    const firmaActual = movil ? this.firma(movil.normal) : null;
    if (firmaActual === borrador.origen.firma) return null;
    const antes = borrador.origen.normal || this.normalDePlanModRutina(borrador.origen.rutina);
    return { movil, sinRutina: !movil, diff: movil ? this.diferencias(antes, movil.normal) : null };
  },

  /* Forma canónica de una rutina del modelo del editor que salió de la copia
     (se reconstruye con las mismas lecturas que planMod). */
  normalDePlanModRutina(rutina){
    const plan = [];
    (rutina.dias || []).forEach(d => (d.filas || []).forEach((f, i) => plan.push({
      dia: d.nombre, orden: i + 1, ejercicio: f.ejercicio, series: f.series,
      reps: f.repsMin == null ? '' : (f.repsMax != null && rutina.sistema !== 'simple' ? `${f.repsMin}-${f.repsMax}` : `${f.repsMin}`),
      rir: f.rir, descansoMin: f.descanso, topBack: f.topBack, backoffPct: f.backoffPct, rirBack: f.rirBack,
      dropSet: f.dropSet, dropPct: f.dropPct, superConAnterior: f.superConAnterior, restPause: f.restPause, pausaRpSeg: f.pausaRpSeg })));
    return this.normalDePlanMod(plan, rutina.sistema);
  },

  /* Estado de cada exportación frente a la copia importada:
     'aplicada' — la rutina de la copia coincide con lo exportado;
     'aPrueba'  — coincide, pero el móvil la tiene a prueba sin confirmar;
     'pendiente'— la copia es anterior a la exportación: no se puede saber;
     'distinta' — la copia es posterior y no la contiene. */
  estadoExportacion(exp, raw, inst){
    if (!exp) return null;
    const movil = this.rutinaMovil(raw);
    const firma = movil ? this.firma(movil.normal) : null;
    if (firma && firma === exp.firma) return movil.aPrueba ? 'aPrueba' : 'aplicada';
    const importada = inst && inst.importadoEn ? Date.parse(inst.importadoEn) : NaN;
    const exportada = Date.parse(exp.fecha);
    if (!isNaN(importada) && !isNaN(exportada) && importada > exportada) return 'distinta';
    return 'pendiente';
  },

  /* Nombre del archivo: sin caracteres problemáticos en Android/iOS. */
  nombreArchivo(borrador, ahora = new Date()){
    const p = n => String(n).padStart(2, '0');
    const base = String(borrador && borrador.nombre || 'rutina').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'rutina';
    return `mi_rutina_truelift_${base}_${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}.xlsx`;
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
          if (k) Planner.aplicarCampo(dia.filas, op.f, k, true);
          else { f.topBack = false; f.dropSet = false; f.restPause = false; }
        } else Planner.aplicarCampo(dia.filas, op.f, op.k, op.valor);
        // Ejercicio elegido sin patrón: el de su ficha del catálogo.
        const f = dia.filas[op.f];
        if (op.k === 'ejercicio' && !f.patron && typeof CAT_FICHA === 'object' && CAT_FICHA[f.ejercicio])
          f.patron = patronVigente(CAT_FICHA[f.ejercicio].patron, CAT_FICHA[f.ejercicio].grupo);
        Planner._sanearModalidades(dia.filas);
        return r;
      }
      case 'sistema': r.sistema = op.valor === 'simple' ? 'simple' : 'doble'; return r;
      case 'nombreDia': if (!dia) return null; dia.nombre = String(op.valor ?? '').trim().slice(0, 40) || `Día ${op.d + 1}`; return r;
      case 'addFila': if (!dia || dia.filas.length >= XLSX.MAX_FILAS) return null; dia.filas.push(this.filaVacia()); return r;
      case 'delFila': if (!dia || !dia.filas[op.f]) return null; dia.filas.splice(op.f, 1); Planner._sanearModalidades(dia.filas); return r;
      case 'moverFila': {
        if (!dia) return null;
        const to = op.f + op.delta;
        if (to < 0 || to >= dia.filas.length) return null;
        const [x] = dia.filas.splice(op.f, 1);
        dia.filas.splice(to, 0, x);
        Planner._sanearModalidades(dia.filas);
        return r;
      }
      case 'addDia':
        if (r.dias.length >= XLSX.MAX_DIAS) return null;
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

  /* Ejercicios que se pueden elegir para un patrón: catálogo de la app y tu
     biblioteca (ejercicios creados en el móvil). */
  opcionesEjercicio(patron, raw){
    const cat = (typeof CAT_LISTAS === 'object' && CAT_LISTAS[patron]) ? CAT_LISTAS[patron] : [];
    const propios = (Array.isArray(raw && raw.ejerciciosUsuario) ? raw.ejerciciosUsuario : [])
      .filter(e => e && e.nombre && (!patron || Planner._normalizarEjercicio(e, {}, 'json').patron === patron))
      .map(e => String(e.nombre).trim());
    return [...new Set([...cat, ...propios])];
  },
};
