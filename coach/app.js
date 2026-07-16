'use strict';
/* ================================================================
   TrueLift Coach — app.js
   Estado global, importación de JSON, multi-cliente,
   selector de fechas y enrutado de vistas.
   ================================================================ */

const State = {
  store: Store.cargar(),
  tab: 'cartera',
  modoRango: 'bloque',
  desdeCustom: null,
  hastaCustom: null,
  ejercicioSel: null,
  buscaEj: '',
  serie1: null, // id de serie o null (→ por defecto). Ver catalogoSeries()
  serie2: null, // id de serie, '' (ninguna) o null (→ por defecto)
  mostrarFcReposo: false,
};
// Migra copias antiguas y recupera ejercicios personalizados de los JSON que
// ya estuvieran guardados en la cartera.
Planner.prepararBiblioteca();
const normCache = new Map(); // clienteId → datos normalizados

function clienteActivo(){
  return State.store.clientes.find(c => c.id === State.store.clienteActivoId) || null;
}
function datosActivos(){
  const c = clienteActivo();
  if (!c) return null;
  if (!normCache.has(c.id)) normCache.set(c.id, normalizar(c.datos));
  return normCache.get(c.id);
}

// ---------- Rango de fechas ----------
function calcularRango(datos){
  return calcularRangoDe(datos, State.modoRango, State.desdeCustom, State.hastaCustom);
}
function calcularRangoDe(datos, modo, desdeCustomStr = null, hastaCustomStr = null){
  const hoy = soloDia(new Date());
  const fechas = [
    ...datos.fuerza.map(s => s.fecha),
    ...datos.cardio.map(s => s.fecha),
    ...datos.readiness.map(r => r.fecha),
  ];
  const minDato = fechas.length ? soloDia(new Date(Math.min(...fechas))) : hoy;
  const maxDato = fechas.length ? soloDia(new Date(Math.max(...fechas))) : hoy;
  const hasta = maxDato > hoy ? maxDato : hoy;

  switch (modo){
    case '7':      return { desde: new Date(+hasta - 6 * 86400000), hasta };
    case '28':     return { desde: new Date(+hasta - 27 * 86400000), hasta };
    case 'todo':   return { desde: minDato, hasta };
    case 'custom': {
      const d = desdeCustomStr ? parseFecha(desdeCustomStr) : minDato;
      const h = hastaCustomStr ? parseFecha(hastaCustomStr) : hasta;
      return d <= h ? { desde: d, hasta: h } : { desde: h, hasta: d };
    }
    case 'bloque':
    default:
      return { desde: datos.perfil.bloqueInicio ? soloDia(datos.perfil.bloqueInicio) : minDato, hasta };
  }
}

function diasDesdeImport(c){
  const f = parseFecha(c.fechaImportacion);
  return f ? Math.max(0, diasEntre(f, new Date())) : null;
}

// ---------- Cartera ----------
function renderCartera(){
  const filas = State.store.clientes.map(c => {
    if (!normCache.has(c.id)) normCache.set(c.id, normalizar(c.datos));
    const datos = normCache.get(c.id);
    const { desde, hasta } = calcularRangoDe(datos, 'bloque');
    const ctx = {
      datos, perfil: datos.perfil, desde, hasta,
      fuerzaR: datos.fuerza.filter(s => enRango(s.fecha, desde, hasta)),
      cardioR: datos.cardio.filter(s => enRango(s.fecha, desde, hasta)),
      readinessR: datos.readiness.filter(r => enRango(r.fecha, desde, hasta)),
      ejercicioSel: null, buscaEj: '', nombreCliente: c.nombre,
    };
    const alertas = Vistas._alertas(ctx);
    const rojas = alertas.filter(a => a.nivel === 'rojo').length;
    const ambar = alertas.filter(a => a.nivel === 'ambar').length;
    const ad = Metricas.adherencia(ctx.fuerzaR, desde, hasta, datos.perfil.diasSemana);
    const dImp = diasDesdeImport(c);
    const ultima = datos.fuerza.length ? datos.fuerza[datos.fuerza.length - 1].fecha : null;
    const estado = (rojas || (dImp ?? 0) > 14) ? 'rojo'
                 : (ambar || (dImp ?? 0) > 7) ? 'ambar' : 'verde';
    return { id: c.id, nombre: c.nombre, notas: c.notas, estado,
             ultimaSesion: ultima, diasImport: dImp, ad, rojas, ambar };
  });
  // Primero quien más atención necesita
  const score = f => f.rojas * 100 + f.ambar * 10 + ((f.diasImport ?? 0) > 7 ? 50 : 0);
  filas.sort((a,b) => score(b) - score(a));
  return Vistas.cartera(filas);
}
function enRango(fecha, desde, hasta){
  const d = soloDia(fecha);
  return d >= soloDia(desde) && d <= soloDia(hasta);
}

// ---------- Contexto de vistas ----------
function construirCtx(){
  const c = clienteActivo();
  const datos = datosActivos();
  const { desde, hasta } = calcularRango(datos);
  return {
    datos, perfil: datos.perfil, desde, hasta,
    fuerzaR: datos.fuerza.filter(s => enRango(s.fecha, desde, hasta)),
    cardioR: datos.cardio.filter(s => enRango(s.fecha, desde, hasta)),
    readinessR: datos.readiness.filter(r => enRango(r.fecha, desde, hasta)),
    ejercicioSel: State.ejercicioSel,
    buscaEj: State.buscaEj,
    nombreCliente: c.nombre,
  };
}

// ---------- Render ----------
function render(){
  const cont = $('#contenido');

  actualizarSelCliente();

  // El planificador funciona incluso sin clientes (borrador general)
  if (State.tab === 'planificador'){
    const c = clienteActivo();
    const ctx = c ? construirCtx() : null;
    $('#rangoTexto').textContent = ctx ? `${fmtFecha(ctx.desde)} — ${fmtFecha(ctx.hasta)}` : '';
    cont.innerHTML = Planner.render(ctx);
    Planner.bind();
    return;
  }

  if (!State.store.clientes.length){
    cont.innerHTML = `<div class="estado-vacio">
      <img src="media/banner.png" alt="TrueLift" class="vacio-banner">
      <div class="big">Sin clientes todavía</div>
      <p>Importa el archivo JSON que tu cliente exporta desde TrueLift<br>(Ajustes → Copia de seguridad) y te envía.</p>
      <button class="btn pri" id="btnImportarVacio">+ Importar JSON</button>
      <p class="muted" style="margin-top:14px;font-size:13px">También puedes arrastrar el archivo a esta ventana.</p>
    </div>`;
    $('#rangoTexto').textContent = '';
    const b = $('#btnImportarVacio');
    if (b) b.addEventListener('click', () => $('#fileInput').click());
    return;
  }

  if (State.tab === 'cartera'){
    $('#rangoTexto').textContent = '';
    cont.innerHTML = renderCartera();
    return;
  }

  let c = clienteActivo();
  if (!c){
    State.store.clienteActivoId = State.store.clientes[0].id;
    c = clienteActivo();
    actualizarSelCliente();
  }

  const ctx = construirCtx();
  $('#rangoTexto').textContent = `${fmtFecha(ctx.desde)} — ${fmtFecha(ctx.hasta)}`;

  // Aviso de frescura: la copia importada es antigua
  let banner = '';
  const dImp = diasDesdeImport(c);
  if (dImp != null && dImp > 7){
    banner = `<div class="alerta ${dImp > 14 ? 'rojo' : 'ambar'}" style="margin-bottom:14px">
      <span class="tag">Datos antiguos</span>
      <span>La copia de <b>${esc(c.nombre)}</b> se importó ${dImp === 1 ? 'hace 1 día' : `hace ${dImp} días`}.
      Pídele una copia nueva desde TrueLift para asesorar con datos al día.</span></div>`;
  }

  // Preservar el scroll (de la ventana y de la lista de ejercicios) entre renders
  const scrollY = window.scrollY;
  const listaEj = document.querySelector('.ej-lista');
  const scrollLista = listaEj ? listaEj.scrollTop : null;

  cont.innerHTML = banner + Vistas[State.tab](ctx);

  window.scrollTo(0, scrollY);
  if (scrollLista != null){
    const l2 = document.querySelector('.ej-lista');
    if (l2) l2.scrollTop = scrollLista;
  }

  // Bindings de los selectores de series (Resumen)
  const selS1 = $('#selSerie1');
  if (selS1){
    selS1.addEventListener('change', () => { State.serie1 = selS1.value; render(); });
  }
  const selS2 = $('#selSerie2');
  if (selS2){
    selS2.addEventListener('change', () => { State.serie2 = selS2.value; render(); });
  }

  // Botón para superponer/ocultar la FC en reposo en la gráfica de VFC.
  const btnFcReposo = $('#btnToggleFcReposo');
  if (btnFcReposo){
    btnFcReposo.addEventListener('click', () => {
      State.mostrarFcReposo = !State.mostrarFcReposo;
      render();
    });
  }

  // Bindings específicos de la vista Ejercicios
  const busca = $('#buscaEj');
  if (busca){
    busca.addEventListener('input', () => {
      State.buscaEj = busca.value;
      const pos = busca.selectionStart;
      render();
      const b2 = $('#buscaEj');
      if (b2){ b2.focus(); b2.setSelectionRange(pos, pos); }
    });
  }
}

function actualizarSelCliente(){
  const sel = $('#selCliente');
  const cs = State.store.clientes;
  sel.innerHTML = cs.length
    ? cs.map(c => `<option value="${esc(c.id)}" ${c.id === State.store.clienteActivoId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')
    : '<option value="">— sin clientes —</option>';
  sel.disabled = !cs.length;
}

// ---------- Modal ----------
function abrirModal(html){
  $('#modalCaja').innerHTML = html;
  $('#modal').classList.remove('oculto');
}
function cerrarModal(){ $('#modal').classList.add('oculto'); }

// ---------- Copia de seguridad del entrenador ----------
function descargarBackup(){
  const data = { tipo: 'tlcoach-backup', version: 1,
                 exportado: new Date().toISOString(), store: State.store };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `truelift_coach_copia_${fmtISO(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function modalRestaurar(raw){
  const n = (raw.store?.clientes || []).length;
  abrirModal(`<h2>Restaurar copia del entrenador</h2>
    <p>El archivo contiene <b>${n}</b> cliente${n === 1 ? '' : 's'}${raw.exportado ? `, exportado el ${fmtFecha(parseFecha(raw.exportado))}` : ''}.</p>
    <p class="muted" style="font-size:13px">"Combinar" añade los clientes del archivo y actualiza los que ya existan, sin borrar nada.
    "Reemplazar todo" sustituye tu cartera actual por la del archivo.</p>
    <div class="mod-acciones">
      <button class="btn sec" onclick="cerrarModal()">Cancelar</button>
      <button class="btn sec" id="bkCombinar">Combinar</button>
      <button class="btn peligro" id="bkReemplazar">Reemplazar todo</button>
    </div>`);
  $('#bkReemplazar').addEventListener('click', () => {
    State.store = raw.store;
    if (!Array.isArray(State.store.clientes)) State.store.clientes = [];
    Planner.prepararBiblioteca();
    if (!State.store.clientes.find(c => c.id === State.store.clienteActivoId))
      State.store.clienteActivoId = State.store.clientes[0]?.id ?? null;
    normCache.clear();
    if (Store.guardar(State.store)){ cerrarModal(); render(); }
  });
  $('#bkCombinar').addEventListener('click', () => {
    (raw.store?.clientes || []).forEach(nc => {
      const ex = State.store.clientes.find(c => c.id === nc.id);
      if (ex){ Object.assign(ex, nc); normCache.delete(nc.id); }
      else State.store.clientes.push(nc);
    });
    Planner._fusionarBiblioteca(raw.store?.ejerciciosCoach || []);
    Planner.prepararBiblioteca();
    if (Store.guardar(State.store)){ cerrarModal(); render(); }
  });
}

// ---------- Importación ----------
function leerArchivo(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let raw;
    try { raw = JSON.parse(reader.result); }
    catch (e) {
      abrirModal(`<h2>Archivo no válido</h2>
        <p>El archivo no es un JSON válido. Pide al cliente que vuelva a exportar la copia desde TrueLift.</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
      return;
    }
    // Copia de seguridad del entrenador (exportada desde esta app)
    if (raw && raw.tipo === 'tlcoach-backup' && raw.store && Array.isArray(raw.store.clientes)){
      modalRestaurar(raw);
      return;
    }
    if (!pareceTrueLift(raw)){
      abrirModal(`<h2>No parece un archivo de TrueLift</h2>
        <p>El JSON no contiene entrenamientos (<code>logs</code>) ni rutina (<code>planMod</code>). Comprueba que es la copia de seguridad correcta.</p>
        <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Entendido</button></div>`);
      return;
    }
    modalImportar(raw, file.name);
  };
  reader.readAsText(file);
}

function modalImportar(raw, nombreArchivo){
  const sugerido = (nombreArchivo || 'Cliente')
    .replace(/\.json$/i, '').replace(/copia[_ ]?(truelift|pruebas)?[_ ]?/i, '')
    .replace(/[_-]+/g, ' ').trim() || 'Cliente';
  const nFuerza = (raw.logs || []).filter(l => l && l.tipo !== 'cardio').length;
  const nuevosEj = Planner.nuevosDesdeJson(raw).length;
  const existentes = State.store.clientes;

  abrirModal(`<h2>Importar copia de TrueLift</h2>
    <p class="muted">${nFuerza} sesiones de fuerza · ${(raw.logs || []).length - nFuerza} de cardio · ${(raw.readinessDiario || []).length} cuestionarios${nuevosEj ? ` · <b>${nuevosEj} ejercicio${nuevosEj === 1 ? '' : 's'} nuevo${nuevosEj === 1 ? '' : 's'} para la biblioteca</b>` : ''}</p>
    <div class="mod-fila">
      <label><input type="radio" name="impModo" value="nuevo" checked> Cliente nuevo:</label>
      <input type="text" id="impNombre" value="${esc(sugerido)}">
    </div>
    ${existentes.length ? `<div class="mod-fila">
      <label><input type="radio" name="impModo" value="actualizar"> Actualizar existente:</label>
      <select id="impExistente">${existentes.map(c =>
        `<option value="${esc(c.id)}" ${c.id === State.store.clienteActivoId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
    </div>` : ''}
    <div class="mod-acciones">
      <button class="btn sec" onclick="cerrarModal()">Cancelar</button>
      <button class="btn pri" id="impConfirmar">Importar</button>
    </div>`);

  $('#impConfirmar').addEventListener('click', () => {
    const modo = document.querySelector('input[name="impModo"]:checked').value;
    if (modo === 'nuevo'){
      const nombre = $('#impNombre').value.trim() || 'Cliente';
      const nuevo = { id: uuid(), nombre, notas: '', fechaImportacion: new Date().toISOString(), datos: raw };
      State.store.clientes.push(nuevo);
      State.store.clienteActivoId = nuevo.id;
    } else {
      const id = $('#impExistente').value;
      const cli = State.store.clientes.find(c => c.id === id);
      if (cli){
        cli.datos = raw;
        cli.fechaImportacion = new Date().toISOString();
        normCache.delete(id);
        State.store.clienteActivoId = id;
      }
    }
    Planner.sincronizarDesdeJson(raw);
    if (Store.guardar(State.store)){
      State.ejercicioSel = null;
      cerrarModal();
      render();
    }
  });
}

// ---------- Gestión de clientes ----------
function modalClientes(){
  const cs = State.store.clientes;
  abrirModal(`<h2>Clientes</h2>
    ${cs.length ? cs.map(c => `
      <div class="cli-fila" data-id="${esc(c.id)}">
        <input type="text" class="cliNombre" value="${esc(c.nombre)}" title="Renombrar">
        <span class="muted" style="font-size:12px">importado ${fmtFecha(parseFecha(c.fechaImportacion))}</span>
        <button class="btn sec cliUsar">Usar</button>
        <button class="btn peligro cliBorrar">Eliminar</button>
        <textarea class="notas cliNotas" placeholder="Notas del entrenador sobre este cliente…">${esc(c.notas || '')}</textarea>
      </div>`).join('') : '<p class="muted">No hay clientes. Importa un JSON para empezar.</p>'}
    <div class="mod-fila" style="margin-top:14px;border-top:1px solid var(--borde);padding-top:12px">
      <button class="btn sec" id="bkExportar">Exportar copia del entrenador</button>
      <span class="muted" style="font-size:12px;flex:1">Descarga toda tu cartera (clientes y notas).
      Para restaurarla en otro navegador u ordenador, impórtala con "+ Importar JSON".</span>
    </div>
    <div class="mod-acciones"><button class="btn pri" onclick="cerrarModal()">Cerrar</button></div>`);

  $('#bkExportar').addEventListener('click', descargarBackup);

  $$('#modalCaja .cli-fila').forEach(fila => {
    const id = fila.dataset.id;
    const cli = State.store.clientes.find(c => c.id === id);
    fila.querySelector('.cliNombre').addEventListener('change', ev => {
      cli.nombre = ev.target.value.trim() || cli.nombre;
      Store.guardar(State.store); actualizarSelCliente(); render();
    });
    fila.querySelector('.cliNotas').addEventListener('change', ev => {
      cli.notas = ev.target.value;
      Store.guardar(State.store);
    });
    fila.querySelector('.cliUsar').addEventListener('click', () => {
      State.store.clienteActivoId = id;
      State.ejercicioSel = null;
      Store.guardar(State.store); cerrarModal(); render();
    });
    fila.querySelector('.cliBorrar').addEventListener('click', () => {
      if (!confirm(`¿Eliminar a "${cli.nombre}" y todos sus datos importados?`)) return;
      State.store.clientes = State.store.clientes.filter(c => c.id !== id);
      normCache.delete(id);
      if (State.store.clienteActivoId === id)
        State.store.clienteActivoId = State.store.clientes[0]?.id ?? null;
      Store.guardar(State.store); modalClientes(); actualizarSelCliente(); render();
    });
  });
}

// ---------- Eventos globales ----------
function setTab(nombre){
  State.tab = nombre;
  $$('#tabs button').forEach(x => x.classList.toggle('activa', x.dataset.tab === nombre));
  render();
}

function init(){
  // Pestañas
  $$('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // Cliente activo
  $('#selCliente').addEventListener('change', ev => {
    State.store.clienteActivoId = ev.target.value;
    State.ejercicioSel = null;
    Store.guardar(State.store);
    render();
  });

  // Rango de fechas
  $('#selRango').addEventListener('change', ev => {
    State.modoRango = ev.target.value;
    $('#rangoCustom').classList.toggle('oculto', State.modoRango !== 'custom');
    if (State.modoRango === 'custom'){
      const datos = datosActivos();
      if (datos){
        const r = (() => { const m = State.modoRango; State.modoRango = 'todo';
                           const rr = calcularRango(datos); State.modoRango = m; return rr; })();
        if (!State.desdeCustom) { State.desdeCustom = fmtISO(r.desde); $('#fDesde').value = State.desdeCustom; }
        if (!State.hastaCustom) { State.hastaCustom = fmtISO(r.hasta); $('#fHasta').value = State.hastaCustom; }
      }
    }
    render();
  });
  $('#fDesde').addEventListener('change', ev => { State.desdeCustom = ev.target.value; render(); });
  $('#fHasta').addEventListener('change', ev => { State.hastaCustom = ev.target.value; render(); });

  // Importación
  $('#btnImportar').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', ev => {
    leerArchivo(ev.target.files[0]);
    ev.target.value = '';
  });

  // Arrastrar y soltar
  let dragN = 0;
  document.addEventListener('dragenter', ev => {
    if (ev.dataTransfer?.types?.includes('Files')){ dragN++; $('#dropzone').classList.remove('oculto'); }
  });
  document.addEventListener('dragleave', () => { if (--dragN <= 0){ dragN = 0; $('#dropzone').classList.add('oculto'); } });
  document.addEventListener('dragover', ev => ev.preventDefault());
  document.addEventListener('drop', ev => {
    ev.preventDefault(); dragN = 0; $('#dropzone').classList.add('oculto');
    leerArchivo(ev.dataTransfer.files[0]);
  });

  // Clientes e informe
  $('#btnClientes').addEventListener('click', modalClientes);
  $('#btnImprimir').addEventListener('click', () => {
    if (!clienteActivo()) return;
    $('#informe').innerHTML = Vistas.informe(construirCtx());
    document.body.classList.add('imprimiendo');
    setTimeout(() => window.print(), 80);
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('imprimiendo');
    $('#informe').innerHTML = '';
  });

  // Modal: cerrar al pulsar el fondo
  $('#modal').addEventListener('click', ev => { if (ev.target.id === 'modal') cerrarModal(); });

  // Delegados: abrir cliente desde la cartera y selección de ejercicio
  $('#contenido').addEventListener('click', ev => {
    const abrir = ev.target.closest('[data-abrir]');
    if (abrir){
      State.store.clienteActivoId = abrir.dataset.abrir;
      State.ejercicioSel = null;
      Store.guardar(State.store);
      setTab('resumen');
      return;
    }
    const item = ev.target.closest('.ej-item');
    if (item){ State.ejercicioSel = item.dataset.ej; render(); }

    // Abrir el planificador desde la vista Rutina
    const abrirPln = ev.target.closest('#btnAbrirPlanificador');
    if (abrirPln){
      const c = clienteActivo();
      // Si el cliente aún no tiene borrador, partir de su rutina activa
      if (c && (!c.rutinaCoach || !c.rutinaCoach.rutina) &&
          Array.isArray(c.datos.planMod) && c.datos.planMod.length){
        c.rutinaCoach = {
          rutina: XLSX.desdePlanMod(c.datos.planMod, c.datos.sistema),
          actualizado: new Date().toISOString(),
        };
        Store.guardar(State.store);
      }
      setTab('planificador');
    }
  });

  initTooltipGraficas();
  render();
}

/* Tooltip que sigue al cursor sobre cualquier punto/barra de las gráficas.
   Cada elemento con [data-tt] muestra su texto (fecha · valor). */
function initTooltipGraficas(){
  let tip = document.getElementById('chartTip');
  if (!tip){
    tip = document.createElement('div');
    tip.id = 'chartTip';
    document.body.appendChild(tip);
  }
  const mostrar = (el, x, y) => {
    tip.textContent = el.getAttribute('data-tt');
    tip.style.display = 'block';
    const m = 14, r = tip.getBoundingClientRect();
    let px = x + m, py = y + m;
    if (px + r.width > window.innerWidth) px = x - m - r.width;
    if (py + r.height > window.innerHeight) py = y - m - r.height;
    tip.style.left = Math.max(4, px) + 'px';
    tip.style.top  = Math.max(4, py) + 'px';
  };
  const ocultar = () => { tip.style.display = 'none'; };
  document.addEventListener('mousemove', ev => {
    const el = ev.target.closest ? ev.target.closest('[data-tt]') : null;
    if (el) mostrar(el, ev.clientX, ev.clientY);
    else if (tip.style.display === 'block') ocultar();
  });
  document.addEventListener('mouseleave', ocultar);
  // Táctil: mostrar al tocar un punto
  document.addEventListener('touchstart', ev => {
    const t = ev.target.closest ? ev.target.closest('[data-tt]') : null;
    if (t){ const p = ev.touches[0]; mostrar(t, p.clientX, p.clientY); }
    else ocultar();
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
