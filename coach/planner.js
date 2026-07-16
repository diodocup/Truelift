'use strict';
/* ================================================================
   TrueLift Coach — planner.js
   Pestaña "Planificador": creación y revisión de la rutina del
   cliente, con análisis de volumen/frecuencia (criterio en
   catalogo.js) y exportación al Excel compatible con TrueLift.

   El borrador se guarda automáticamente en el cliente activo
   (cli.rutinaCoach) o, si no hay clientes, en store.borradorGeneral;
   viaja con la copia de seguridad del entrenador.
   ================================================================ */

const Planner = {

  // ---------- Modelo y persistencia ----------
  filaVacia(){
    return { patron: '', ejercicio: '', series: 3, rir: 1,
             repsMin: null, repsMax: null, descanso: 2,
             topBack: false, backoffPct: 15, rirBack: 2 };
  },
  rutinaVacia(){
    return { sistema: 'doble',
             dias: [1, 2, 3].map(n => ({ nombre: `Día ${n}`, filas: [this.filaVacia()] })) };
  },

  _contenedor(){
    const c = clienteActivo();
    if (c){
      if (!c.rutinaCoach) c.rutinaCoach = { rutina: null, actualizado: null };
      return c.rutinaCoach;
    }
    if (!State.store.borradorGeneral) State.store.borradorGeneral = { rutina: null, actualizado: null };
    return State.store.borradorGeneral;
  },
  get rutina(){
    const cont = this._contenedor();
    if (!cont.rutina) cont.rutina = this.rutinaVacia();
    return cont.rutina;
  },
  set rutina(r){
    const cont = this._contenedor();
    cont.rutina = r;
    cont.actualizado = new Date().toISOString();
  },
  guardar(){
    this._contenedor().actualizado = new Date().toISOString();
    Store.guardar(State.store);
  },

  // ---------- Biblioteca de ejercicios del entrenador ----------
  /* Ejercicios personalizados del entrenador: se guardan en el store y
     viajan en su copia de seguridad. Formato: { nombre, patron, grupo }. */
  ejerciciosCoach(){ return State.store.ejerciciosCoach || []; },
  _claveEjercicio(valor){
    return String(valor ?? '').trim().toLocaleLowerCase('es')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  },
  _clavesCatalogo(){
    if (!this.__clavesCatalogo){
      const nombres = new Set(Object.keys(CAT_GRUPO_DE));
      Object.values(CAT_LISTAS).forEach(lista => lista.forEach(n => nombres.add(n)));
      this.__clavesCatalogo = new Set([...nombres].map(n => this._claveEjercicio(n)));
    }
    return this.__clavesCatalogo;
  },
  _esEjercicioBase(nombre){ return this._clavesCatalogo().has(this._claveEjercicio(nombre)); },
  _listaMeta(valor){
    if (Array.isArray(valor)) return valor.map(v => String(v).trim()).filter(Boolean);
    if (typeof valor !== 'string' || !valor.trim()) return [];
    try {
      const lista = JSON.parse(valor);
      if (Array.isArray(lista)) return lista.map(v => String(v).trim()).filter(Boolean);
    } catch (_) { /* formato antiguo separado por comas */ }
    return valor.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
  },
  _normalizarEjercicio(valor, fallback = {}, fuente = 'json'){
    const e = valor && typeof valor === 'object' && !Array.isArray(valor)
      ? valor : { nombre: valor };
    const primero = (claves, predeterminado = '') => {
      for (const k of claves){
        if (e[k] != null && String(e[k]).trim()) return e[k];
      }
      return predeterminado;
    };
    const nombre = String(primero(['nombre','ejercicio','name','exercise'], fallback.nombre || '')).trim();
    if (!nombre) return null;
    const secundarios = this._listaMeta(primero(
      ['secundarios','gruposSecundarios','musculosSecundarios','músculosSecundarios','secondaryMuscles'],
      fallback.secundarios || [fallback.grupo2, fallback.grupo3].filter(Boolean)));
    return {
      nombre,
      patron: String(primero(['patron','patrón','pattern'], fallback.patron || 'Aislamiento')).trim() || 'Aislamiento',
      grupo: String(primero(['grupo','grupoMuscular','musculo','músculo','muscleGroup'], fallback.grupo || 'Otros')).trim() || 'Otros',
      grupo2: secundarios[0] || null,
      grupo3: secundarios[1] || null,
      prioridad: String(primero(['prioridad','tipo','origen'], fallback.prioridad || 'Añadido por ti')).trim() || 'Añadido por ti',
      nota: String(primero(['nota','indicaciones','descripcion','descripción','notas'], fallback.nota || '')).trim(),
      descanso: String(primero(['descanso','descansoSugerido','rest'], fallback.descanso || '')).trim(),
      fuente,
    };
  },
  ejerciciosCoachDePatron(patron){
    return this.ejerciciosCoach()
      .filter(e => !patron || e.patron === patron)
      .map(e => e.nombre);
  },
  /* Grupos secundario y terciario de un ejercicio de la biblioteca del
     entrenador. Cada uno cuenta como media serie (0,5) en el volumen. */
  gruposSecundariosDe(ejercicio){
    const e = this.ejerciciosCoach().find(x => x.nombre === ejercicio);
    return e ? [e.grupo2, e.grupo3].filter(Boolean) : [];
  },
  FACTOR_SECUNDARIO: 0.5,

  /* Fusiona la biblioteca embebida en un Excel de la app con la del entrenador.
     Aditivo: no sobrescribe ejercicios ya existentes ni los del catálogo base.
     Conserva prioridad/nota/descanso de la app para poder re-exportarlos. */
  _fusionarBiblioteca(lista){
    if (!Array.isArray(lista) || !lista.length) return { nuevos: 0, actualizados: 0 };
    if (!State.store.ejerciciosCoach) State.store.ejerciciosCoach = [];
    const existentes = new Map(State.store.ejerciciosCoach.map(e =>
      [this._claveEjercicio(e.nombre), e]));
    let nuevos = 0, actualizados = 0;
    lista.forEach(valor => {
      const b = this._normalizarEjercicio(valor, valor, valor?.fuente || 'json');
      if (!b) return;
      const clave = this._claveEjercicio(b.nombre);
      // Ya está en la biblioteca del entrenador o es un ejercicio del catálogo
      // oficial de la plantilla: no hay nada que añadir.
      if (this._esEjercicioBase(b.nombre)) return;
      const anterior = existentes.get(clave);
      if (anterior){
        let cambio = false;
        for (const k of ['patron','grupo','grupo2','grupo3','prioridad','nota','descanso']){
          if (b[k] && !anterior[k]){ anterior[k] = b[k]; cambio = true; }
        }
        if (cambio) actualizados++;
        return;
      }
      const reg = {
        nombre: b.nombre,
        patron: b.patron,
        grupo: b.grupo,
        grupo2: b.grupo2,
        grupo3: b.grupo3,
      };
      // Metadatos exclusivos de la app: se guardan para un round-trip sin
      // pérdida, aunque el planner no los edite. Prioridad vacía →
      // «Importado», igual que hace la app al fusionar.
      reg.prioridad = b.prioridad || 'Importado';
      if (b.nota) reg.nota = b.nota;
      if (b.descanso) reg.descanso = b.descanso;
      State.store.ejerciciosCoach.push(reg);
      existentes.set(clave, reg);
      nuevos++;
    });
    State.store.ejerciciosCoach.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { nuevos, actualizados };
  },

  _ejerciciosDesdeJson(raw){
    const plan = Array.isArray(raw?.planMod) ? raw.planMod : [];
    const porNombre = new Map();
    plan.forEach(p => {
      const e = this._normalizarEjercicio(p, {}, 'plan');
      if (e) porNombre.set(this._claveEjercicio(e.nombre), e);
    });
    const candidatos = [];
    (Array.isArray(raw?.logs) ? raw.logs : []).forEach(log => {
      (Array.isArray(log?.entradas) ? log.entradas : []).forEach(entrada => {
        const nombre = String(entrada?.ejercicio || '').trim();
        if (!nombre) return;
        candidatos.push(this._normalizarEjercicio(
          entrada, porNombre.get(this._claveEjercicio(nombre)) || {}, 'log'));
      });
    });
    candidatos.push(...porNombre.values());
    (Array.isArray(raw?.ejerciciosUsuario) ? raw.ejerciciosUsuario : []).forEach(e =>
      candidatos.push(this._normalizarEjercicio(e, {}, 'json')));

    const prioridad = { log: 1, plan: 2, manual: 3, json: 4, excel: 4 };
    const mapa = new Map();
    candidatos.filter(Boolean).forEach(e => {
      if (this._esEjercicioBase(e.nombre)) return;
      const clave = this._claveEjercicio(e.nombre);
      const anterior = mapa.get(clave);
      if (!anterior || (prioridad[e.fuente] || 0) >= (prioridad[anterior.fuente] || 0))
        mapa.set(clave, { ...(anterior || {}), ...e });
    });
    return [...mapa.values()];
  },
  nuevosDesdeJson(raw){
    const existentes = new Set(this.ejerciciosCoach().map(e => this._claveEjercicio(e.nombre)));
    return this._ejerciciosDesdeJson(raw).filter(e => !existentes.has(this._claveEjercicio(e.nombre)));
  },
  sincronizarDesdeJson(raw){ return this._fusionarBiblioteca(this._ejerciciosDesdeJson(raw)); },
  prepararBiblioteca(){
    if (!Array.isArray(State.store.ejerciciosCoach)) State.store.ejerciciosCoach = [];
    (Array.isArray(State.store.clientes) ? State.store.clientes : []).forEach(c =>
      this.sincronizarDesdeJson(c?.datos));
  },

  /* Ejercicios usados en los días de una rutina importada que no existen ni
     en el catálogo base ni en la biblioteca del entrenador (excels antiguos
     sin bloque TRUELIFT_EXERCISES_V1, o filas con ejercicios sueltos). Se
     añaden con el grupo inferido del patrón, igual que hace la app, para que
     el entrenador se quede siempre con cualquier ejercicio adicional. */
  _fusionarEjerciciosDeRutina(rutina){
    if (!rutina || !Array.isArray(rutina.dias)) return;
    const candidatos = new Map();
    rutina.dias.forEach(d => (d.filas || []).forEach(f => {
      const nombre = String(f.ejercicio || '').trim();
      if (nombre && !candidatos.has(nombre))
        candidatos.set(nombre, {
          nombre,
          patron: String(f.patron || '').trim(),
          grupo: CAT_PATRON_GRUPO[f.patron] || 'Sin clasificar',
          prioridad: 'Importado',
        });
    }));
    this._fusionarBiblioteca([...candidatos.values()]);
  },

  /* Biblioteca del entrenador en el formato que la app incrusta en el Excel
     (marca TRUELIFT_EXERCISES_V1). Se adjunta a la rutina al exportar. */
  bibliotecaParaExcel(rutina, rawCliente){
    const candidatos = [];
    (Array.isArray(rawCliente?.ejerciciosUsuario) ? rawCliente.ejerciciosUsuario : []).forEach(e =>
      candidatos.push(this._normalizarEjercicio(e, {}, 'json')));
    (rutina?.dias || []).forEach(d => (d.filas || []).forEach(f => {
      if (!f.ejercicio || this._esEjercicioBase(f.ejercicio)) return;
      const clave = this._claveEjercicio(f.ejercicio);
      const guardado = this.ejerciciosCoach().find(e => this._claveEjercicio(e.nombre) === clave);
      candidatos.push(this._normalizarEjercicio(guardado || { nombre: f.ejercicio }, {
        nombre: f.ejercicio,
        patron: f.patron,
        grupo: CAT_PATRON_GRUPO[f.patron] || 'Otros',
      }, guardado ? 'manual' : 'plan'));
    }));
    const mapa = new Map();
    candidatos.filter(Boolean).forEach(e => mapa.set(this._claveEjercicio(e.nombre), e));
    return [...mapa.values()].map(e => ({
      nombre: e.nombre,
      grupo: e.grupo || '',
      patron: e.patron || '',
      secundarios: [e.grupo2, e.grupo3].filter(Boolean),
      prioridad: e.prioridad || 'Añadido por ti',
      nota: e.nota || '',
      descanso: e.descanso || '',
    }));
  },

  // ---------- Grupo muscular de un ejercicio ----------
  grupoDe(ejercicio, patron, datos){
    if (CAT_GRUPO_DE[ejercicio]) return CAT_GRUPO_DE[ejercicio];
    const propio = this.ejerciciosCoach().find(e => e.nombre === ejercicio);
    if (propio && propio.grupo) return propio.grupo;
    if (datos && datos.grupoDe.get(ejercicio)) return datos.grupoDe.get(ejercicio);
    return CAT_PATRON_GRUPO[patron] || 'Otros';
  },

  /* Objetivos vigentes: los de catalogo.js con los ajustes que el entrenador
     haya guardado desde la app (store.objetivosGrupo, viaja en su copia). */
  objetivos(){
    const base = {};
    Object.entries(OBJETIVOS_GRUPO).forEach(([g, o]) => base[g] = { ...o });
    Object.entries(State.store.objetivosGrupo || {}).forEach(([g, o]) => {
      base[g] = { ...(base[g] || { min: 0, max: 0, frec: 1 }), ...o };
    });
    return base;
  },

  modalObjetivos(){
    const OBJ = this.objetivos();
    const grupos = [...new Set([...ORDEN_GRUPOS, ...Object.keys(OBJ)])];
    const propios = !!State.store.objetivosGrupo;
    abrirModal(`<h2>Objetivos de volumen y frecuencia</h2>
      <p class="muted" style="font-size:13px">Series semanales (mín–máx) y frecuencia mínima (días/semana) por grupo muscular.
      Es tu criterio de entrenador para el semáforo del planificador: se guarda en esta app y en tu copia del entrenador; no cambia nada en la app del cliente.
      ${propios ? '<b>Ahora mismo usas objetivos propios.</b>' : 'Ahora mismo usas los valores por defecto.'}</p>
      <table>
        <thead><tr><th>Grupo</th><th class="num">Series mín</th><th class="num">Series máx</th><th class="num">Frec. mín</th></tr></thead>
        <tbody>${grupos.map(g => { const o = OBJ[g] || { min: 0, max: 0, frec: 1 }; return `<tr data-g="${esc(g)}">
          <td>${esc(g)}</td>
          <td class="num"><input type="number" class="obj-in" data-k="min" value="${o.min}" min="0" max="40" step="1" style="width:66px"></td>
          <td class="num"><input type="number" class="obj-in" data-k="max" value="${o.max}" min="0" max="40" step="1" style="width:66px"></td>
          <td class="num"><input type="number" class="obj-in" data-k="frec" value="${o.frec}" min="0" max="7" step="1" style="width:66px"></td>
        </tr>`; }).join('')}</tbody>
      </table>
      <div class="mod-acciones">
        <button class="btn sec" onclick="cerrarModal()">Cancelar</button>
        <button class="btn sec" id="objRestaurar" title="Vuelve a los valores por defecto de la app">Restaurar por defecto</button>
        <button class="btn pri" id="objGuardar">Guardar</button>
      </div>`);
    $('#objRestaurar').addEventListener('click', () => {
      delete State.store.objetivosGrupo;
      if (Store.guardar(State.store)){ cerrarModal(); render(); }
    });
    $('#objGuardar').addEventListener('click', () => {
      const out = {};
      let error = null;
      $$('#modalCaja tr[data-g]').forEach(tr => {
        const g = tr.dataset.g, o = {};
        tr.querySelectorAll('.obj-in').forEach(inp => {
          const v = parseFloat(inp.value);
          o[inp.dataset.k] = isNaN(v) || v < 0 ? 0 : v;
        });
        if (o.max < o.min) error = `${g}: el máximo (${o.max}) no puede ser menor que el mínimo (${o.min}).`;
        out[g] = o;
      });
      if (error){ alert(error); return; }
      State.store.objetivosGrupo = out;
      if (Store.guardar(State.store)){ cerrarModal(); render(); }
    });
  },

  // ---------- Biblioteca: crear/gestionar ejercicios propios ----------
  modalNuevoEjercicio(){
    const patrones = CAT_PATRONES.filter(p => p !== '(Ninguno)');
    const lib = this.ejerciciosCoach();
    const listaLib = lib.length
      ? `<table>
          <thead><tr><th>Ejercicio</th><th>Patrón</th><th>Grupo</th><th>Secundario</th><th>Terciario</th><th></th></tr></thead>
          <tbody>${lib.map((e, i) => `<tr>
            <td>${esc(e.nombre)}</td>
            <td class="muted">${esc(e.patron || '—')}</td>
            <td class="muted">${esc(e.grupo || '—')}</td>
            <td class="muted">${esc(e.grupo2 || '—')}</td>
            <td class="muted">${esc(e.grupo3 || '—')}</td>
            <td class="num"><button class="btn-mini peligro nej-del" data-i="${i}" title="Eliminar de la biblioteca">✕</button></td>
          </tr>`).join('')}</tbody>
        </table>`
      : '<div class="muted" style="font-size:13px">Todavía no has creado ejercicios propios.</div>';

    abrirModal(`<h2>Nuevo ejercicio</h2>
      <p class="muted" style="font-size:13px">Se guarda en la biblioteca del entrenador y viaja en tu copia de seguridad.
      Aparecerá en el desplegable de ejercicios del patrón elegido, para cualquier cliente.
      Recuerda que, para exportar a TrueLift, el ejercicio también debe existir en la app del cliente.</p>
      <div style="display:grid;gap:8px;max-width:440px;margin-bottom:6px">
        <label>Nombre del ejercicio
          <input type="text" id="nejNombre" placeholder="p. ej. Press horizontal en polea baja" style="width:100%">
        </label>
        <label>Patrón
          <select id="nejPatron" style="width:100%">
            ${patrones.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          </select>
        </label>
        <label>Grupo muscular (principal)
          <select id="nejGrupo" style="width:100%">
            ${ORDEN_GRUPOS.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          </select>
        </label>
        <label>Grupo secundario (opcional)
          <select id="nejGrupo2" style="width:100%">
            <option value="">— ninguno —</option>
            ${ORDEN_GRUPOS.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          </select>
        </label>
        <label>Grupo terciario (opcional)
          <select id="nejGrupo3" style="width:100%">
            <option value="">— ninguno —</option>
            ${ORDEN_GRUPOS.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="mod-acciones">
        <button class="btn sec" onclick="cerrarModal()">Cerrar</button>
        <button class="btn pri" id="nejGuardar">Guardar ejercicio</button>
      </div>
      <h3 style="margin-top:16px">Tu biblioteca (${lib.length})</h3>
      ${listaLib}`);

    // Sugerir grupo automáticamente según el patrón
    const selP = document.querySelector('#nejPatron');
    const selG = document.querySelector('#nejGrupo');
    const sugerir = () => { const g = CAT_PATRON_GRUPO[selP.value]; if (g) selG.value = g; };
    if (selP){ selP.addEventListener('change', sugerir); sugerir(); }

    document.querySelector('#nejGuardar').addEventListener('click', () => {
      const nombre = (document.querySelector('#nejNombre').value || '').trim();
      if (!nombre){ alert('Escribe el nombre del ejercicio.'); return; }
      const enCatalogo = !!CAT_GRUPO_DE[nombre] || Object.values(CAT_LISTAS).some(l => l.includes(nombre));
      if (enCatalogo){ alert('Ese ejercicio ya existe en el catálogo de la plantilla.'); return; }
      if (this.ejerciciosCoach().some(e => e.nombre.toLowerCase() === nombre.toLowerCase())){
        alert('Ese ejercicio ya está en tu biblioteca.'); return;
      }
      const grupo = selG.value;
      let grupo2 = document.querySelector('#nejGrupo2').value || null;
      let grupo3 = document.querySelector('#nejGrupo3').value || null;
      // Evitar duplicados entre principal/secundario/terciario
      if (grupo2 === grupo) grupo2 = null;
      if (grupo3 === grupo || grupo3 === grupo2) grupo3 = null;
      if (grupo3 && !grupo2){ grupo2 = grupo3; grupo3 = null; }
      if (!State.store.ejerciciosCoach) State.store.ejerciciosCoach = [];
      // Misma ficha que crea la app (agregarEjercicioBiblioteca): así el
      // ejercicio viaja por Excel a la app con los mismos metadatos.
      State.store.ejerciciosCoach.push({
        nombre, patron: selP.value, grupo, grupo2, grupo3,
        prioridad: 'Añadido por ti', nota: '', descanso: '',
      });
      if (Store.guardar(State.store)){ this.modalNuevoEjercicio(); render(); }
    });

    document.querySelectorAll('.nej-del').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.i;
      const e = this.ejerciciosCoach()[i];
      if (!e || !confirm(`¿Eliminar "${e.nombre}" de tu biblioteca?`)) return;
      State.store.ejerciciosCoach.splice(i, 1);
      if (Store.guardar(State.store)){ this.modalNuevoEjercicio(); render(); }
    }));
  },

  // ---------- Análisis de volumen y frecuencia ----------
  /* Devuelve { porGrupo, totalSeries, porDia, avisos } asumiendo que la
     rutina se ejecuta una vez por semana (planificación semanal de TrueLift). */
  analiza(rutina, ctx){
    const datos = ctx ? ctx.datos : null;
    const porGrupo = new Map();   // grupo → {series, dias:Set, ejercicios:Set}
    const porDia = [];
    const avisos = [];
    const add = (nivel, txt) => avisos.push({ nivel, txt });

    rutina.dias.forEach((d, di) => {
      let seriesDia = 0, durMin = 0, nEj = 0;
      const vistos = new Set();
      d.filas.forEach(f => {
        if (!f.patron && !f.ejercicio) return;
        if (!f.patron || f.patron === '(Ninguno)' || !f.ejercicio){
          add('ambar', `${d.nombre}: hay una fila incompleta (patrón y ejercicio son obligatorios); se ignorará al exportar.`);
          return;
        }
        nEj++;
        if (vistos.has(f.ejercicio))
          add('azul', `${d.nombre}: "${f.ejercicio}" está repetido en el mismo día.`);
        vistos.add(f.ejercicio);
        const s = f.series || 0;
        seriesDia += s;
        durMin += s * ((f.descanso || 2) + 0.8);
        const g = this.grupoDe(f.ejercicio, f.patron, datos);
        if (!porGrupo.has(g)) porGrupo.set(g, { series: 0, dias: new Set(), ejercicios: new Set() });
        const e = porGrupo.get(g);
        e.series += s; e.dias.add(di); e.ejercicios.add(f.ejercicio);
        // Grupos secundario y terciario: media serie cada uno
        this.gruposSecundariosDe(f.ejercicio).forEach(g2 => {
          if (!porGrupo.has(g2)) porGrupo.set(g2, { series: 0, dias: new Set(), ejercicios: new Set() });
          const e2 = porGrupo.get(g2);
          e2.series += s * this.FACTOR_SECUNDARIO; e2.dias.add(di); e2.ejercicios.add(f.ejercicio);
        });

        if (!f.series) add('ambar', `${d.nombre} · ${f.ejercicio}: faltan las series.`);
        if (f.repsMin == null) add('ambar', `${d.nombre} · ${f.ejercicio}: faltan las repeticiones.`);
        if (rutina.sistema === 'doble' && f.repsMin != null && f.repsMax != null && f.repsMax < f.repsMin)
          add('rojo', `${d.nombre} · ${f.ejercicio}: reps máx (${f.repsMax}) menor que reps mín (${f.repsMin}).`);
        if (rutina.sistema === 'doble' && f.repsMin != null && f.repsMax == null)
          add('ambar', `${d.nombre} · ${f.ejercicio}: en sistema doble faltan las reps máx.`);
        if (!CAT_LISTAS[f.patron])
          add('azul', `${d.nombre} · ${f.ejercicio}: el patrón "${f.patron}" no es de la plantilla; al exportar se ajustará si es posible.`);
        else if (this._esEjercicioBase(f.ejercicio) === false &&
                 !this.ejerciciosCoach().some(e => this._claveEjercicio(e.nombre) === this._claveEjercicio(f.ejercicio)))
          add('azul', `${d.nombre} · "${f.ejercicio}" no está aún en la biblioteca: se añadirá al Excel como ejercicio personalizado.`);
      });
      if (!nEj) add('ambar', `${d.nombre} está vacío; se exportará sin ejercicios.`);
      porDia.push({ nombre: d.nombre, nEj, series: seriesDia, durMin: Math.round(durMin) });
    });

    const nDias = rutina.dias.filter((d, i) => porDia[i].nEj > 0).length;
    if (nDias < 2) add('rojo', 'La plantilla de TrueLift requiere entre 2 y 5 días con ejercicios.');

    // Semáforo por grupo (objetivos vigentes: por defecto + ajustes del entrenador)
    const OBJ = this.objetivos();
    const filas = [];
    const grupos = [...new Set([...ORDEN_GRUPOS, ...porGrupo.keys()])];
    grupos.forEach(g => {
      const e = porGrupo.get(g) || { series: 0, dias: new Set(), ejercicios: new Set() };
      const obj = OBJ[g];
      let estadoSeries = 'gris', estadoFrec = 'gris';
      if (obj){
        const s = e.series;
        estadoSeries = (s >= obj.min && s <= obj.max) ? 'verde'
                     : (s >= obj.min * 0.75 && s <= obj.max * 1.25) ? 'ambar' : 'rojo';
        if (s === 0) estadoSeries = obj.min > 0 ? 'rojo' : 'gris';
        const fr = e.dias.size;
        estadoFrec = fr >= obj.frec ? 'verde' : (fr >= obj.frec - 1 && fr >= 1) ? 'ambar' : 'rojo';
        if (s === 0) estadoFrec = estadoSeries;
      }
      if (e.series > 0 || (obj && obj.min > 0))
        filas.push({ grupo: g, series: e.series, frec: e.dias.size,
                     nEj: e.ejercicios.size, obj, estadoSeries, estadoFrec });
    });

    return { porGrupo: filas, porDia,
             totalSeries: porDia.reduce((a, b) => a + b.series, 0), avisos };
  },

  /* Series ejecutadas de media semanal por grupo en el PERIODO SELECCIONADO
     (el selector de rango de la barra superior): total de series del rango
     dividido entre sus semanas naturales. */
  ejecutadoPorGrupo(ctx){
    if (!ctx || !ctx.fuerzaR.length) return null;
    const { fuerzaR, datos } = ctx;
    const nSem = Math.max(1, Math.round((diasEntre(ctx.desde, ctx.hasta) + 1) / 7 * 10) / 10);
    const tot = new Map();
    fuerzaR.forEach(s => s.entradas.forEach(e => {
      const g = this.grupoDe(e.ejercicio, '', datos);
      tot.set(g, (tot.get(g) || 0) + e.nSeries);
      // Grupos secundario y terciario: media serie cada uno
      this.gruposSecundariosDe(e.ejercicio).forEach(g2 =>
        tot.set(g2, (tot.get(g2) || 0) + e.nSeries * this.FACTOR_SECUNDARIO));
    }));
    const out = new Map();
    tot.forEach((v, g) => out.set(g, Math.round(v / nSem * 10) / 10));
    return { porGrupo: out, nSem };
  },

  /* Contexto de revisión por ejercicio: diagnóstico, RIR alto, molestias, última carga. */
  contextoEjercicios(ctx, rutina){
    const out = new Map();
    if (!ctx || !ctx.fuerzaR.length) return out;
    const nombres = new Set();
    rutina.dias.forEach(d => d.filas.forEach(f => { if (f.ejercicio) nombres.add(f.ejercicio); }));
    nombres.forEach(n => {
      const hist = Metricas.historicoEjercicio({ fuerza: ctx.fuerzaR }, n);
      if (!hist.length) return;
      const molestias = hist.filter(p => p.entrada.obs &&
        Metricas.PALABRAS_MOLESTIA.some(w => sinTildes(p.entrada.obs).includes(w))).length;
      out.set(n, {
        diag: Metricas.diagnostico(hist),
        rirAlto: Metricas.rirAltoSostenido(hist),
        molestias,
        ultKg: hist[hist.length - 1].kgR,
        sesiones: hist.length,
      });
    });
    return out;
  },

  // ---------- Acciones ----------
  cargarDesdePlan(){
    const datos = datosActivos();
    if (!datos || !datos.plan.length){
      abrirModal(`<h2>Sin rutina activa</h2><p>El JSON importado de este cliente no contiene rutina (planMod).</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
      return;
    }
    // Usar el planMod crudo del JSON (el normalizado no conserva topBack)
    const c = clienteActivo();
    const fuente = (c && Array.isArray(c.datos.planMod) && c.datos.planMod.length)
      ? { plan: c.datos.planMod, sistema: c.datos.sistema }
      : { plan: datos.plan, sistema: datos.perfil.sistema };
    this.rutina = XLSX.desdePlanMod(fuente.plan, fuente.sistema);
    this.guardar(); render();
  },

  async abrirExcel(file){
    if (!file) return;
    try {
      const rutina = await XLSX.leerRutina(await file.arrayBuffer());
      // Añade a la biblioteca del entrenador los ejercicios personalizados que
      // la app incrustó en el Excel (aditivo, sin pisar los existentes) y,
      // después, cualquier ejercicio usado en los días que siga siendo
      // desconocido (excels antiguos sin biblioteca embebida).
      this._fusionarBiblioteca(rutina.biblioteca);
      this._fusionarEjerciciosDeRutina(rutina);
      this.rutina = rutina;
      this.guardar(); render();
    } catch (err){
      abrirModal(`<h2>No se pudo leer el Excel</h2><p>${esc(err.message)}</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
    }
  },

  enBlanco(){
    if (!confirm('¿Descartar el borrador actual y empezar una rutina en blanco?')) return;
    this.rutina = this.rutinaVacia();
    this.guardar(); render();
  },

  /* Reordena una fila dentro de su mismo día. Los índices son posiciones
     finales, por lo que sirve tanto para arrastre como para pruebas. */
  _reordenarEnDia(dia, desde, destino){
    const filas = this.rutina.dias[dia]?.filas;
    if (!filas || desde < 0 || desde >= filas.length ||
        destino < 0 || destino >= filas.length || desde === destino) return false;
    const [movida] = filas.splice(desde, 1);
    filas.splice(destino, 0, movida);
    return true;
  },

  async exportar(){
    const r = JSON.parse(JSON.stringify(this.rutina));
    // Limpieza para exportar: filas completas y patrón compatible con la plantilla
    r.dias.forEach(d => {
      d.filas = d.filas.filter(f => f.patron && f.patron !== '(Ninguno)' && f.ejercicio);
      d.filas.forEach(f => {
        if (!CAT_PATRONES.includes(f.patron)){
          const alt = CAT_PATRONES.find(p => (CAT_LISTAS[p] || []).includes(f.ejercicio));
          if (alt) f.patron = alt;
        }
      });
    });
    const conFilas = r.dias.filter(d => d.filas.length);
    if (conFilas.length < 2){
      abrirModal(`<h2>Rutina incompleta</h2><p>TrueLift necesita entre 2 y 5 días con ejercicios (patrón y ejercicio rellenos). Ahora mismo hay ${conFilas.length}.</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
      return;
    }
    const c = clienteActivo();
    // Solo viajan los ejercicios personalizados de este cliente y los usados
    // en la rutina; no se filtra la biblioteca de otros clientes.
    r.biblioteca = this.bibliotecaParaExcel(r, c?.datos);
    const nombre = c ? '_' + c.nombre.trim().replace(/\s+/g, '_') : '';
    try {
      await XLSX.descargar(r, `mi_rutina_truelift${nombre}.xlsx`);
    } catch (err){
      abrirModal(`<h2>Error al exportar</h2><p>${esc(err.message)}</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
    }
  },

  // ---------- Render ----------
  _chipEstado(estado, txt, title = ''){
    return `<span class="chip ${estado}" ${title ? `title="${esc(title)}"` : ''}>${esc(txt)}</span>`;
  },

  _filaEditor(f, d, i, sistema, ctxEj){
    const listaCat = CAT_LISTAS[f.patron] || Object.keys(CAT_GRUPO_DE).sort((a, b) => a.localeCompare(b, 'es'));
    // Añadir los ejercicios de la biblioteca del entrenador del patrón elegido
    const listaCoach = this.ejerciciosCoachDePatron(f.patron).filter(n => !listaCat.includes(n));
    const lista = [...listaCat, ...listaCoach];
    // El ejercicio actual siempre debe aparecer aunque no esté en la lista del patrón
    const opciones = (f.ejercicio && !lista.includes(f.ejercicio)) ? [f.ejercicio, ...lista] : lista;
    const grupo = f.ejercicio ? this.grupoDe(f.ejercicio, f.patron, datosActivos()) : '';
    const rev = f.ejercicio ? ctxEj.get(f.ejercicio) : null;
    let chips = '';
    if (rev){
      if (rev.molestias) chips += this._chipEstado('rojo', `⚠ ${rev.molestias} molestia${rev.molestias > 1 ? 's' : ''}`, 'Observaciones con molestias en el rango');
      if (rev.diag.estado === 'estancado') chips += this._chipEstado('rojo', 'estancado', rev.diag.texto);
      else if (rev.diag.estado === 'progresando') chips += this._chipEstado('verde', 'progresando');
      if (rev.rirAlto) chips += this._chipEstado('azul', 'RIR alto', 'RIR medio ≥3 en las 2 últimas sesiones: puede subir carga');
      if (rev.ultKg != null) chips += `<span class="chip gris">últ. ${fmtNum(rev.ultKg, 2)} kg</span>`;
    }
    const numIn = (k, v, min, max, step, ancho, title) =>
      `<input type="number" class="pln-campo" data-d="${d}" data-f="${i}" data-k="${k}"
        value="${v ?? ''}" min="${min}" max="${max}" step="${step}" style="width:${ancho}px" title="${title}">`;

    return `<div class="pln-fila" data-d="${d}" data-f="${i}">
      <div class="pln-fila-linea">
        <span class="pln-drag" title="Pulsa y arrastra para cambiar el orden" aria-label="Arrastrar ejercicio ${i + 1}">⠿</span>
        <span class="muted pln-num">${i + 1}</span>
        <select class="pln-campo" data-d="${d}" data-f="${i}" data-k="patron" title="Patrón">
          ${CAT_PATRONES.map(p => `<option value="${esc(p === '(Ninguno)' ? '' : p)}" ${p === (f.patron || '(Ninguno)') ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          ${f.patron && !CAT_PATRONES.includes(f.patron) ? `<option value="${esc(f.patron)}" selected>${esc(f.patron)}</option>` : ''}
        </select>
        <span class="pln-ej">
          <select class="pln-campo" data-d="${d}" data-f="${i}" data-k="ejercicio" title="Ejercicio">
            <option value="" ${!f.ejercicio ? 'selected' : ''}>— elige ejercicio —</option>
            ${opciones.map(e => `<option value="${esc(e)}" ${e === f.ejercicio ? 'selected' : ''}>${esc(e)}</option>`).join('')}
            <option value="__otro__">✏ Escribir otro…</option>
          </select>
        </span>
        ${numIn('series', f.series, 1, 10, 1, 52, 'Series')}<span class="pln-x">×</span>
        ${numIn('repsMin', f.repsMin, 1, 30, 1, 52, 'Reps mín / objetivo')}
        ${sistema === 'doble' ? `<span class="pln-x">–</span>${numIn('repsMax', f.repsMax, 1, 30, 1, 52, 'Reps máx')}` : ''}
        <span class="pln-x">@RIR</span>${numIn('rir', f.rir, 0, 6, 1, 44, 'RIR objetivo')}
        <select class="pln-campo" data-d="${d}" data-f="${i}" data-k="descanso" title="Descanso (min)">
          ${CAT_DESCANSOS.map(v => `<option value="${v}" ${v === f.descanso ? 'selected' : ''}>${fmtNum(v, 1)}′</option>`).join('')}
        </select>
        <label class="pln-tb" title="Top set + back-offs: la 1.ª serie fija la progresión">
          <input type="checkbox" class="pln-campo" data-d="${d}" data-f="${i}" data-k="topBack" ${f.topBack ? 'checked' : ''}> T+B
        </label>
        ${f.topBack ? `<span class="pln-x">−</span>${numIn('backoffPct', f.backoffPct, 5, 30, 5, 48, '% de peso menos en los back-offs')}<span class="pln-x">% @RIR</span>${numIn('rirBack', f.rirBack, 0, 6, 1, 44, 'RIR de los back-offs')}` : ''}
        <span class="pln-acciones">
          <button class="btn-mini peligro pln-del-fila" data-d="${d}" data-f="${i}" title="Eliminar fila">✕</button>
        </span>
      </div>
      ${grupo || chips ? `<div class="pln-fila-meta">${grupo ? `<span class="muted">${esc(grupo)}</span>` : ''}${chips}</div>` : ''}
    </div>`;
  },

  render(ctx){
    const rutina = this.rutina;
    const cont = this._contenedor();
    const c = clienteActivo();
    const an = this.analiza(rutina, ctx);
    const ejec = this.ejecutadoPorGrupo(ctx);
    const ctxEj = this.contextoEjercicios(ctx, rutina);

    // --- Cabecera de acciones ---
    const destino = c ? `Borrador de <b>${esc(c.nombre)}</b>` : 'Borrador general (sin cliente)';
    const guardado = cont.actualizado
      ? `guardado ${fmtFecha(parseFecha(cont.actualizado))}` : 'sin guardar todavía';
    const cabecera = `
      <div class="card" style="margin-bottom:14px">
        <div class="pln-cab">
          <div>
            <h3 style="margin-bottom:2px">Planificador de rutina</h3>
            <span class="muted" style="font-size:12px">${destino} · ${guardado} · se guarda solo con cada cambio y viaja en la copia del entrenador</span>
          </div>
          <div class="pln-cab-botones">
            ${c ? '<button class="btn sec" id="plnCargarPlan" title="Parte de la rutina activa del JSON importado">Cargar rutina del cliente</button>' : ''}
            <button class="btn sec" id="plnAbrirExcel">Importar rutina</button>
            <input type="file" id="plnFile" accept=".xlsx" style="display:none">
            <button class="btn sec" id="plnBlanco">En blanco</button>
            <button class="btn sec" id="plnNuevoEj" title="Crea un ejercicio y guárdalo en tu biblioteca del entrenador">+ Nuevo ejercicio</button>
            <label class="pln-sistema">Sistema
              <select id="plnSistema">
                ${CAT_SISTEMAS.map(s => `<option value="${s}" ${s === rutina.sistema ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <button class="btn pri" id="plnExportar" title="Descarga la rutina para importarla en la app TrueLift del smartphone">Exportar rutina para App smartphone TrueLift</button>
          </div>
        </div>
      </div>`;

    // --- Editor por días ---
    const dias = rutina.dias.map((d, di) => `
      <div class="card pln-dia">
        <div class="pln-dia-cab">
          <input type="text" class="pln-nombre-dia" data-d="${di}" value="${esc(d.nombre)}" title="Nombre del día/sesión">
          <span class="muted" style="font-size:12px">${an.porDia[di].nEj} ej. · ${an.porDia[di].series} series · ~${an.porDia[di].durMin} min</span>
          <button class="btn-mini peligro pln-del-dia" data-d="${di}" title="Eliminar día">✕ día</button>
        </div>
        ${d.filas.map((f, i) => this._filaEditor(f, di, i, rutina.sistema, ctxEj)).join('')}
        ${d.filas.length < XLSX.MAX_FILAS ? `<button class="btn sec pln-add-fila" data-d="${di}" style="margin-top:6px">+ Ejercicio</button>` : ''}
      </div>`).join('');
    const addDia = rutina.dias.length < XLSX.MAX_DIAS
      ? `<button class="btn sec" id="plnAddDia" style="margin-bottom:14px">+ Añadir día (${rutina.dias.length}/${XLSX.MAX_DIAS})</button>` : '';

    // --- Análisis: volumen y frecuencia ---
    const filasVol = an.porGrupo.map(f => {
      const objTxt = f.obj ? `${f.obj.min}–${f.obj.max}` : '—';
      const frecTxt = f.obj ? `≥${f.obj.frec}` : '—';
      let dif = '';
      if (ejec && ejec.porGrupo.has(f.grupo)){
        const e = ejec.porGrupo.get(f.grupo);
        const delta = f.series ? Math.round((e - f.series) * 10) / 10 : null;
        dif = `${fmtNum(e, 1)}${delta != null && Math.abs(delta) >= 2 ? ` <span class="delta ${delta > 0 ? 'sube' : 'baja'}">(${delta > 0 ? '+' : ''}${fmtNum(delta, 1)})</span>` : ''}`;
      } else if (ejec) dif = '<span class="muted">—</span>';
      return `<tr>
        <td>${esc(f.grupo)}<div class="muted" style="font-size:11px">${f.nEj} ejercicio${f.nEj === 1 ? '' : 's'}</div></td>
        <td class="num"><span class="chip ${f.estadoSeries}">${Number.isInteger(f.series) ? f.series : fmtNum(f.series, 1)}</span> <span class="muted" style="font-size:11px">obj. ${objTxt}</span></td>
        <td class="num"><span class="chip ${f.estadoFrec}">${f.frec}×/sem</span> <span class="muted" style="font-size:11px">${frecTxt}</span></td>
        ${ejec ? `<td class="num">${dif}</td>` : ''}
      </tr>`;
    }).join('');
    const analisis = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
          <h3>Volumen y frecuencia semanal</h3>
          <button class="btn-mini" id="plnObjetivos" title="Edita tus objetivos de series y frecuencia por grupo">⚙ Objetivos${State.store.objetivosGrupo ? ' (propios)' : ''}</button>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:8px">
          Series planificadas por grupo y días/semana que se estimula, asumiendo una pasada semanal por los ${rutina.dias.length} días.
          El grupo secundario y el terciario de un ejercicio cuentan como media serie cada uno.
          Verde dentro del objetivo, ámbar hasta un 25% fuera, rojo más allá.
          ${ejec && ctx ? `La columna "Ejec. media" es la media semanal ejecutada en el periodo seleccionado arriba (${fmtFechaCorta(ctx.desde)} — ${fmtFechaCorta(ctx.hasta)}, ${fmtNum(ejec.nSem, 1)} sem).` : ''}
        </div>
        <table>
          <thead><tr><th>Grupo</th><th class="num">Series/sem</th><th class="num">Frecuencia</th>${ejec ? '<th class="num">Ejec. media</th>' : ''}</tr></thead>
          <tbody>${filasVol}</tbody>
        </table>
        <div class="kv" style="margin-top:8px"><span class="muted">Total semanal</span><b>${an.totalSeries} series · ${rutina.dias.length} días</b></div>
      </div>`;

    // --- Avisos ---
    const orden = { rojo: 0, ambar: 1, azul: 2 };
    const avisosHtml = `
      <div class="card">
        <h3>Avisos del planificador</h3>
        ${an.avisos.length
          ? an.avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]).map(a =>
              `<div class="alerta ${a.nivel}"><span class="tag">${a.nivel === 'rojo' ? 'Error' : a.nivel === 'ambar' ? 'Aviso' : 'Nota'}</span><span>${esc(a.txt)}</span></div>`).join('')
          : '<div class="muted">Sin avisos: la rutina está lista para exportar.</div>'}
        ${c && ctx && ctx.fuerzaR.length ? '' : '<div class="muted" style="font-size:12px;margin-top:8px">Sin datos de entrenamiento en el rango: no se muestra comparación con lo ejecutado ni contexto por ejercicio.</div>'}
      </div>`;

    return cabecera + dias + addDia + `<div class="grid cols2">${analisis}${avisosHtml}</div>`;
  },

  // ---------- Bindings ----------
  bind(){
    const cont = document.querySelector('#contenido');
    const r = this.rutina;
    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    cont.querySelectorAll('.pln-campo').forEach(el => el.addEventListener('change', () => {
      const { d, f, k } = el.dataset;
      const fila = r.dias[+d].filas[+f];
      if (k === 'topBack') fila.topBack = el.checked;
      else if (k === 'patron'){
        fila.patron = el.value;
        // si el ejercicio actual no encaja con el nuevo patrón, no lo borramos: aviso lo señalará
      }
      else if (k === 'ejercicio'){
        if (el.value === '__otro__'){
          const nuevo = window.prompt(
            'Nombre exacto del ejercicio (tal como existe en la app del cliente):',
            fila.ejercicio || '');
          if (nuevo != null && nuevo.trim()){
            fila.ejercicio = nuevo.trim();
            this._fusionarBiblioteca([{
              nombre: fila.ejercicio,
              patron: fila.patron,
              grupo: CAT_PATRON_GRUPO[fila.patron] || 'Otros',
              prioridad: 'Añadido por el coach',
              fuente: 'manual',
            }]);
          }
        } else fila.ejercicio = el.value;
      }
      else fila[k] = num(el.value);
      this.guardar(); render();
    }));

    cont.querySelectorAll('.pln-nombre-dia').forEach(el => el.addEventListener('change', () => {
      r.dias[+el.dataset.d].nombre = el.value.trim() || `Día ${+el.dataset.d + 1}`;
      this.guardar(); render();
    }));

    cont.querySelectorAll('.pln-add-fila').forEach(el => el.addEventListener('click', () => {
      r.dias[+el.dataset.d].filas.push(this.filaVacia());
      this.guardar(); render();
    }));
    cont.querySelectorAll('.pln-del-fila').forEach(el => el.addEventListener('click', () => {
      r.dias[+el.dataset.d].filas.splice(+el.dataset.f, 1);
      this.guardar(); render();
    }));
    const filasEditor = [...cont.querySelectorAll('.pln-fila')];
    const limpiarDestinos = () => filasEditor.forEach(fila => {
      fila.classList.remove('pln-drop-antes', 'pln-drop-despues');
    });
    const limpiarArrastre = () => filasEditor.forEach(fila => {
      fila.classList.remove('arrastrando', 'pln-drop-antes', 'pln-drop-despues');
    });
    const destinoEnPunto = (x, y, dia) => {
      const fila = document.elementFromPoint(x, y)?.closest('.pln-fila');
      if (!fila || +fila.dataset.d !== dia) return null;
      const rect = fila.getBoundingClientRect();
      return { fila, objetivo: +fila.dataset.f, despues: y >= rect.top + rect.height / 2 };
    };
    filasEditor.forEach(fila => {
      const asa = fila.querySelector('.pln-drag');
      const iniciar = id => {
        if (this._dragFila) return false;
        this._dragFila = { d: +fila.dataset.d, f: +fila.dataset.f, pointerId: id };
        this._dragDestino = null;
        fila.classList.add('arrastrando');
        return true;
      };
      const mover = (x, y, id) => {
        if (!this._dragFila || this._dragFila.pointerId !== id) return;
        const destino = destinoEnPunto(x, y, this._dragFila.d);
        this._dragDestino = destino;
        limpiarDestinos();
        if (destino)
          destino.fila.classList.add(destino.despues ? 'pln-drop-despues' : 'pln-drop-antes');
      };
      const soltar = (x, y, id) => {
        if (!this._dragFila || this._dragFila.pointerId !== id) return;
        const origen = this._dragFila.f;
        const dia = this._dragFila.d;
        const objetivo = destinoEnPunto(x, y, dia) || this._dragDestino;
        this._dragFila = null;
        this._dragDestino = null;
        limpiarArrastre();
        if (!objetivo) return;
        let destino = objetivo.objetivo + (objetivo.despues ? 1 : 0);
        if (origen < destino) destino--;
        if (this._reordenarEnDia(dia, origen, destino)){
          this.guardar();
          render();
        }
      };
      asa.addEventListener('pointerdown', ev => {
        if (ev.button != null && ev.button !== 0) return;
        const id = `p:${ev.pointerId}`;
        if (!iniciar(id)) return;
        ev.preventDefault();
        const alMoverPointer = e => mover(e.clientX, e.clientY, id);
        const alMoverMouse = e => mover(e.clientX, e.clientY, id);
        const quitar = () => {
          document.removeEventListener('pointermove', alMoverPointer);
          document.removeEventListener('mousemove', alMoverMouse);
          document.removeEventListener('pointerup', alSoltar);
          document.removeEventListener('mouseup', alSoltar);
          document.removeEventListener('pointercancel', alCancelar);
        };
        const alSoltar = e => {
          quitar();
          soltar(e.clientX, e.clientY, id);
        };
        const alCancelar = () => {
          quitar();
          if (this._dragFila?.pointerId === id){
            this._dragFila = null;
            this._dragDestino = null;
            limpiarArrastre();
          }
        };
        document.addEventListener('pointermove', alMoverPointer);
        document.addEventListener('mousemove', alMoverMouse);
        document.addEventListener('pointerup', alSoltar);
        document.addEventListener('mouseup', alSoltar);
        document.addEventListener('pointercancel', alCancelar);
      });

      // Respaldo de ratón para navegadores/entornos que no emiten Pointer Events.
      asa.addEventListener('mousedown', ev => {
        if (ev.button !== 0 || !iniciar('mouse')) return;
        ev.preventDefault();
        const alMover = e => mover(e.clientX, e.clientY, 'mouse');
        const alSoltar = e => {
          document.removeEventListener('mousemove', alMover);
          document.removeEventListener('mouseup', alSoltar);
          soltar(e.clientX, e.clientY, 'mouse');
        };
        document.addEventListener('mousemove', alMover);
        document.addEventListener('mouseup', alSoltar);
      });
    });

    const addDia = cont.querySelector('#plnAddDia');
    if (addDia) addDia.addEventListener('click', () => {
      r.dias.push({ nombre: `Día ${r.dias.length + 1}`, filas: [this.filaVacia()] });
      this.guardar(); render();
    });
    cont.querySelectorAll('.pln-del-dia').forEach(el => el.addEventListener('click', () => {
      if (!confirm(`¿Eliminar "${r.dias[+el.dataset.d].nombre}" y sus ejercicios?`)) return;
      r.dias.splice(+el.dataset.d, 1);
      this.guardar(); render();
    }));

    const sist = cont.querySelector('#plnSistema');
    if (sist) sist.addEventListener('change', () => { r.sistema = sist.value; this.guardar(); render(); });

    const cargar = cont.querySelector('#plnCargarPlan');
    if (cargar) cargar.addEventListener('click', () => {
      if (this._contenedor().actualizado &&
          !confirm('Esto sustituye el borrador actual por la rutina activa del cliente. ¿Continuar?')) return;
      this.cargarDesdePlan();
    });
    const abrir = cont.querySelector('#plnAbrirExcel');
    const file = cont.querySelector('#plnFile');
    if (abrir) abrir.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', ev => { this.abrirExcel(ev.target.files[0]); ev.target.value = ''; });
    const blanco = cont.querySelector('#plnBlanco');
    if (blanco) blanco.addEventListener('click', () => this.enBlanco());
    const nuevoEj = cont.querySelector('#plnNuevoEj');
    if (nuevoEj) nuevoEj.addEventListener('click', () => this.modalNuevoEjercicio());
    const exp = cont.querySelector('#plnExportar');
    if (exp) exp.addEventListener('click', () => this.exportar());
    const obj = cont.querySelector('#plnObjetivos');
    if (obj) obj.addEventListener('click', () => this.modalObjetivos());
  },
};

// Registrar como vista (app.js enruta State.tab → Vistas[tab])
Vistas.planificador = ctx => Planner.render(ctx);
