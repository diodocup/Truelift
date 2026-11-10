'use strict';
/* ================================================================
   TrueLift Escritorio — entrenador/modo.js
   Controlador del modo entrenador (PLAN_ENTRENADOR.md §7, App-PRO).

   - Se carga a demanda (app.js · cargarModoEntrenador) solo si se abre
     `#entrenador` o si este navegador ya tiene una clave guardada. Un
     usuario normal no descarga nada de esto.
   - La clave privada vive en IndexedDB (`meta`, clave 'entrenador:clave')
     como CryptoKey NO extraíble. La contraseña no se guarda nunca.
   - Un cliente es un espacio. Sus borradores y el registro de planes
     emitidos van en el almacén 'entrenador' (IndexedDB v3), por espacio.
   - Cada cambio se guarda en una transacción; si falla, lo de pantalla
     vuelve a lo guardado y se dice (como el planificador retirado).
   ================================================================ */

const EntrenadorModo = (() => {

const PL = PlanificadorEntrenador;
const P = PaqueteEntrenador;
const V = EntrenadorVista;
const META_CLAVE = 'entrenador:clave';
const metaActivo = id => `entBorradorActivo:${id}`;
let A = null;            // API de app.js
const S = {
  listo: false, soportado: null, clave: null,
  error: null, errorDesbloqueo: null, desbloqueando: false, errorEmision: null,
  espacioId: null, registros: [], activoId: null, pilas: new Map(), foco: null, otros: [],
};
const ahoraISO = () => new Date().toISOString();
const $id = id => document.getElementById(id);

// ---------- carga ----------
async function iniciar(api){
  A = api;
  S.soportado = await ClaveEntrenador.soportado();
  bind();
  S.listo = true;
}

/* Tras cada carga del estado de app.js (cambio de espacio, importación,
   otra pestaña). */
async function cargar(){
  const m = await Almacen.leer('meta', META_CLAVE);
  S.clave = m && m.valor && m.valor.privada ? m.valor : null;
  const esp = A.E.espacio;
  if ((esp?.id || null) !== S.espacioId){ S.pilas = new Map(); S.error = null; }
  S.espacioId = esp?.id || null;
  S.registros = esp ? await Almacen.todos('entrenador', esp.id) : [];
  S.activoId = esp ? (await Almacen.leer('meta', metaActivo(esp.id)))?.valor || null : null;
  pestana();
}

/* Pestaña «Entrenador» en la barra lateral, solo con la clave puesta. */
function pestana(){
  const tabs = document.getElementById('tabs');
  if (!tabs) return;
  let b = tabs.querySelector('[data-seccion="entrenador"]');
  let g = tabs.querySelector('.ent-grupo');
  if (!S.clave){ b?.remove(); g?.remove(); return; }
  if (b) return;
  g = document.createElement('span'); g.className = 'tabs-grupo ent-grupo'; g.textContent = 'Entrenador';
  b = document.createElement('button');
  b.type = 'button'; b.dataset.seccion = 'entrenador'; b.className = 'ent-pestana';
  b.innerHTML = '<svg class="tab-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg><span class="tab-txt">Clientes y planes</span>';
  tabs.append(g, b);
  if (A.E.seccion === 'entrenador'){ b.classList.add('activa'); b.setAttribute('aria-current', 'page'); }
}

// ---------- estado derivado ----------
const borradores = () => S.registros.map(r => PL.leerBorrador(r)).filter(Boolean).sort((a, b) => a.creado < b.creado ? -1 : 1);
const emitidos = () => S.registros.filter(r => r && r.tipo === 'emitido').sort((a, b) => a.fecha < b.fecha ? 1 : -1);
function borradorActivo(){
  const l = borradores();
  return l.find(b => b.id === S.activoId) || l[l.length - 1] || null;
}
function pilaDe(id){
  if (!S.pilas.has(id)) S.pilas.set(id, { deshacer: [], rehacer: [] });
  return S.pilas.get(id);
}
function ctx(){
  const b = borradorActivo();
  const p = b ? pilaDe(b.id) : { deshacer: [], rehacer: [] };
  return { E: A.E, raw: A.E.raw, inst: A.E.inst, copia: PL.rutinaCopia(A.E.raw), borrador: b, borradores: borradores(),
           emitidos: emitidos(), pila: { deshacer: p.deshacer.length, rehacer: p.rehacer.length }, error: S.error,
           nombreEntrenador: S.clave?.nombre || '', errorEmision: S.errorEmision };
}

// ---------- HTML ----------
function html(){
  if (!S.clave) return V.desbloqueo({ soportado: S.soportado, error: S.errorDesbloqueo, ocupado: S.desbloqueando });
  return V.seccion(ctx());
}
/* Tras pintar: el foco vuelve al control equivalente. */
function tras(){
  const id = S.foco;
  S.foco = null;
  if (!id) return;
  const el = $id(id);
  if (el && !el.disabled) el.focus({ preventScroll: false });
}

// ---------- escrituras ----------
/* Guarda (o borra) registros en UNA transacción. Si falla, lo de pantalla
   vuelve a lo último guardado y se dice. */
async function guardar({ put = [], del = [], activo, foco = null, msg = null, hecho = null }){
  const esp = A.E.espacio;
  const ops = [...put.map(r => ({ almacen: 'entrenador', put: r })), ...del.map(id => ({ almacen: 'entrenador', del: id }))];
  if (activo !== undefined) ops.push({ almacen: 'meta', put: { clave: metaActivo(esp.id), valor: activo } });
  try { await Almacen.escribir(ops); }
  catch (e) {
    S.error = Almacen.esErrorCuota(e)
      ? 'No hay espacio en el navegador para guardar el cambio. Lo anterior sigue intacto. Libera espacio (por ejemplo, borrando un cliente que ya no lleves) y vuelve a intentarlo.'
      : `El último cambio no se ha guardado (${e && e.message ? e.message : e}); lo anterior sigue intacto.`;
    A.render(); document.querySelector('#contenido .alerta[role="alert"]')?.scrollIntoView({ block: 'nearest' });
    A.anunciar('No se ha guardado el cambio');
    return false;
  }
  S.error = null;
  S.registros = [...S.registros.filter(r => !del.includes(r.id) && !put.some(p => p.id === r.id)), ...put];
  if (activo !== undefined) S.activoId = activo;
  if (hecho) hecho();
  A.avisarOtras();
  S.foco = foco;
  A.render();
  if (msg) A.anunciar(msg);
  return true;
}

async function editar(op, foco){
  const b = borradorActivo();
  if (!b) return;
  const r = PL.editar(b.rutina, op);
  if (!r) return;
  const p = pilaDe(b.id);
  await guardar({ put: [{ ...b, rutina: r, actualizado: ahoraISO() }], foco,
    hecho: () => { p.deshacer.push(b.rutina); if (p.deshacer.length > PL.MAX_DESHACER) p.deshacer.shift(); p.rehacer = []; } });
}

const crear = (b, msg) => guardar({ put: [b], activo: b.id, foco: 'entEmitir', msg });

function nombreNuevo(base){
  const usados = new Set(borradores().map(b => b.nombre));
  let n = base, i = 2;
  while (usados.has(n)) n = `${base} (${i++})`;
  return n;
}

// ---------- desbloqueo y salida ----------
async function desbloquear(){
  const archivo = $id('entArchivoClave')?.files?.[0];
  const pass = $id('entContrasena')?.value ?? '';
  if (!archivo){ S.errorDesbloqueo = 'Elige tu archivo de clave.'; S.foco = 'entArchivoClave'; A.render(); return; }
  if (archivo.size > ClaveEntrenador.TAM_MAX){ S.errorDesbloqueo = ClaveEntrenador.MENSAJES.noEsClave; A.render(); return; }
  S.desbloqueando = true; S.errorDesbloqueo = null;
  const texto = await archivo.text();
  A.render();
  let k;
  try { k = await ClaveEntrenador.desbloquear(texto, pass); }
  catch (e) {
    S.desbloqueando = false;
    S.errorDesbloqueo = e instanceof ClaveEntrenador.ErrorClave ? e.message : 'No se pudo desbloquear la clave.';
    S.foco = 'entContrasena';
    A.render();
    A.anunciar('No se ha desbloqueado el modo entrenador');
    return;
  }
  const valor = { id: k.id, publica: k.publica, privada: k.privada, nombre: '', desde: ahoraISO() };
  try { await Almacen.escribir([{ almacen: 'meta', put: { clave: META_CLAVE, valor } }]); }
  catch (e) {
    S.desbloqueando = false;
    S.errorDesbloqueo = `No se pudo guardar la clave en este navegador (${e && e.name ? e.name : 'error'}).`;
    A.render();
    return;
  }
  S.desbloqueando = false;
  S.clave = valor;
  pestana();
  A.avisarOtras();
  A.irA('entrenador', { foco: true });
  A.anunciar('Modo entrenador desbloqueado');
}

function pedirSalir(){
  A.abrirModal(`<h2 id="modalTitulo">Salir del modo entrenador</h2>
    <p>Se borra tu clave de este navegador y desaparece esta sección. Para volver necesitarás el archivo de clave y su contraseña.</p>
    <p class="muted" style="font-size:13px">Tus clientes, borradores y el registro de planes emitidos se quedan en este navegador.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar" autofocus>Cancelar</button>
      <button class="btn peligro" type="button" data-ent-accion="salir-ok">Salir y borrar la clave</button></div>`);
}
async function salir(){
  A.cerrarModal();
  try { await Almacen.escribir([{ almacen: 'meta', del: META_CLAVE }]); }
  catch (e) { A.modalMensaje('No se pudo borrar la clave', `<p>${esc(e.message || String(e))}</p>`); return; }
  S.clave = null;
  pestana();
  A.avisarOtras();
  history.replaceState(null, '', location.pathname + location.search);
  A.irA(A.E.inst ? 'resumen' : 'datos', { historial: false });
  A.anunciar('Has salido del modo entrenador; la clave se ha borrado de este navegador');
}

// ---------- clientes ----------
function leerFormFicha(){
  const v = id => $id(id)?.value ?? '';
  return { nombre: v('entFNombre').trim().slice(0, 60),
    ficha: PL.leerFicha({ sexo: v('entFSexo'), pesoKg: v('entFPeso'), alturaCm: v('entFAltura'), grasaPct: v('entFGrasa'),
                          experiencia: v('entFExp'), dias: v('entFDias'), notas: v('entFNotas') }) };
}
async function guardarFicha(nuevo){
  const { nombre, ficha } = leerFormFicha();
  if (!nombre){ $id('entFNombre')?.focus(); A.anunciar('Escribe el nombre del cliente'); return; }
  const esp = nuevo
    ? { id: uuid(), nombre, creado: ahoraISO(), instantaneaId: null, instantaneaAnteriorId: null, ficha }
    : { ...A.E.espacio, nombre, ficha };
  const ops = [{ almacen: 'espacios', put: esp }];
  if (nuevo) ops.push({ almacen: 'meta', put: { clave: 'espacioActivo', valor: esp.id } });
  try { await Almacen.escribir(ops); }
  catch (e) { A.modalMensaje('No se ha guardado', `<p>${esc(e.message || String(e))}</p><p>No se ha cambiado nada.</p>`); return; }
  A.cerrarModal();
  A.avisarOtras();
  await A.recargar();
  A.anunciar(nuevo ? `Cliente «${nombre}» creado` : 'Ficha guardada');
}
async function abrirCliente(id){
  try { await Almacen.escribir([{ almacen: 'meta', put: { clave: 'espacioActivo', valor: id } }]); }
  catch (e) { A.modalMensaje('No se pudo abrir el cliente', `<p>${esc(e.message || String(e))}</p>`); return; }
  await A.recargar();
  A.anunciar(`Cliente abierto: ${A.E.espacio?.nombre || ''}`);
}

// ---------- emitir ----------
async function emitir(){
  const b = borradorActivo();
  if (!b || !S.clave) return;
  const nombre = ($id('entNombreEntrenador')?.value || '').trim();
  const nota = ($id('entNota')?.value || '').trim();
  const L = P.LIMITES;
  if (!nombre || [...nombre].length > L.textoMax){
    S.errorEmision = 'Escribe tu nombre: el cliente lo verá en el plan.';
    A.abrirModal(V.confirmarEmision(ctx()), { ancho: true });
    $id('entNota').value = nota;
    S.errorEmision = null;
    return;
  }
  const cliente = [...String(A.E.espacio.nombre).trim()].slice(0, L.textoMax).join('') || 'Cliente';
  const sim = PL.simular(b.rutina, A.E.raw, { nombre: b.nombre });
  const carga = P.construirCarga({ entrenador: nombre, cliente, nota: [...nota].slice(0, L.notaMax).join(''), rutina: sim.paquete });
  let r;
  try { r = await P.emitir(carga, { clavePrivada: S.clave.privada, idClave: S.clave.id, clavePublica: S.clave.publica }); }
  catch (e) {
    A.cerrarModal();
    A.modalMensaje('No se ha emitido el plan', `<p>${esc(e && e.message ? e.message : String(e))}</p><p><b>No se ha descargado nada.</b></p>`);
    return;
  }
  const registro = { id: carga.id, tipo: 'emitido', espacioId: A.E.espacio.id, fecha: ahoraISO(), emitido: carga.emitido,
    archivo: r.nombreArchivo, sha256: r.sha256, borradorId: b.id, borradorNombre: b.nombre, entrenador: nombre, cliente,
    conNota: !!carga.nota, rutina: { sistema: sim.sistema, dias: sim.dias.length, firma: PL.firma(sim.normal) } };
  A.cerrarModal();
  // Se descarga aunque no se pueda anotar: el archivo ya está verificado.
  descargar(r.texto, r.nombreArchivo);
  S.clave = { ...S.clave, nombre };
  let anotado = true;
  try { await Almacen.escribir([{ almacen: 'meta', put: { clave: META_CLAVE, valor: S.clave } }]); } catch (_) { /* solo el nombre recordado */ }
  anotado = await guardar({ put: [registro], foco: 'entEmitir' });
  A.anunciar(anotado ? `Plan descargado: ${r.nombreArchivo}. Envíaselo a ${cliente}.` : `Plan descargado: ${r.nombreArchivo}, pero no se pudo anotar en el registro.`);
}
function descargar(texto, nombre){
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- acciones ----------
async function accion(nombre, el){
  const b = borradorActivo();
  const d = el ? Number(el.dataset.d) : NaN, f = el ? Number(el.dataset.f) : NaN;
  const esp = A.E.espacio;
  switch (nombre){
    case 'salir': pedirSalir(); return;
    case 'salir-ok': await salir(); return;
    case 'cliente-copia': A.importarClienteNuevo(); return;
    case 'cliente-nuevo': A.abrirModal(V.fichaForm({ nuevo: true }), { ancho: true }); return;
    case 'cliente-abrir': await abrirCliente(el.dataset.espacio); return;
    case 'ficha-editar': if (esp) A.abrirModal(V.fichaForm({ nombre: esp.nombre, ficha: esp.ficha }), { ancho: true }); return;
    case 'ficha-guardar': await guardarFicha(el.dataset.nuevo === '1'); return;
    case 'nuevo-copia': {
      const origen = PL.origenCopia(A.E.raw, A.E.inst);
      if (!origen || !esp) return;
      if (!$('#modal').classList.contains('oculto')) A.cerrarModal();
      await crear(PL.nuevoBorrador({ espacioId: esp.id, nombre: nombreNuevo(`Desde su copia (${VistasEsc.F.dia(A.E.inst?.resumen?.ultimoRegistro)})`),
        rutina: origen.rutina, origen }), 'Borrador creado desde la rutina de su copia');
      return;
    }
    case 'nuevo-blanco':
      if (esp) await crear(PL.nuevoBorrador({ espacioId: esp.id, nombre: nombreNuevo('Rutina nueva'), rutina: PL.rutinaVacia(), origen: { tipo: 'blanco' } }), 'Borrador en blanco creado');
      return;
    case 'nuevo-otro': {
      const todos = (await Almacen.todos('entrenador')).filter(r => r && r.tipo === 'borrador' && r.espacioId !== esp?.id);
      const nombres = new Map(A.E.espacios.map(s => [s.id, s.nombre]));
      const grupos = [...new Set(todos.map(r => r.espacioId))].filter(id => nombres.has(id))
        .map(id => ({ cliente: nombres.get(id), borradores: todos.filter(r => r.espacioId === id).map(r => PL.leerBorrador(r)).filter(Boolean) }));
      S.otros = todos;
      A.abrirModal(V.elegirOtro(grupos));
      return;
    }
    case 'nuevo-otro-ok': {
      const id = $id('entOtro')?.value;
      const src = PL.leerBorrador((S.otros || []).find(r => r.id === id));
      A.cerrarModal();
      if (!src || !esp) return;
      const de = A.E.espacios.find(s => s.id === src.espacioId)?.nombre || 'otro cliente';
      await crear(PL.nuevoBorrador({ espacioId: esp.id, nombre: nombreNuevo(`${src.nombre} (de ${de})`.slice(0, 80)), rutina: src.rutina,
        origen: { tipo: 'borrador', deEspacio: src.espacioId, deBorrador: src.id, rutina: src.rutina } }), `Borrador creado a partir de «${src.nombre}»`);
      return;
    }
    case 'duplicar':
      if (b) await crear(PL.nuevoBorrador({ espacioId: esp.id, nombre: nombreNuevo(`${b.nombre} (copia)`), rutina: b.rutina, origen: PL.clonar(b.origen) }), 'Borrador duplicado');
      return;
    case 'renombrar':
      if (!b) return;
      A.abrirModal(`<h2 id="modalTitulo">Renombrar borrador</h2>
        <label for="entNombreBorrador">Nombre (lo verá el cliente como nombre de la rutina)</label><input id="entNombreBorrador" type="text" maxlength="80" value="${esc(b.nombre)}" style="width:100%" autofocus>
        <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
          <button class="btn pri" type="button" data-ent-accion="renombrar-ok">Guardar</button></div>`);
      return;
    case 'renombrar-ok': {
      const v = ($id('entNombreBorrador')?.value || '').trim();
      A.cerrarModal();
      if (b && v) await guardar({ put: [{ ...b, nombre: v.slice(0, 80), actualizado: ahoraISO() }], foco: 'entEmitir', msg: 'Borrador renombrado' });
      return;
    }
    case 'eliminar':
      if (!b) return;
      A.abrirModal(`<h2 id="modalTitulo">Eliminar «${esc(b.nombre)}»</h2>
        <p>Se borra este borrador de este navegador. Los planes que ya hayas emitido no cambian.</p>
        <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar" autofocus>Cancelar</button>
          <button class="btn peligro" type="button" data-ent-accion="eliminar-ok">Eliminar borrador</button></div>`);
      return;
    case 'eliminar-ok': {
      A.cerrarModal();
      if (!b) return;
      const resto = borradores().filter(x => x.id !== b.id);
      if (await guardar({ del: [b.id], activo: resto.length ? resto[resto.length - 1].id : null, msg: 'Borrador eliminado' })) S.pilas.delete(b.id);
      return;
    }
    case 'deshacer': case 'rehacer': {
      if (!b) return;
      const p = pilaDe(b.id);
      const [de, a] = nombre === 'deshacer' ? [p.deshacer, p.rehacer] : [p.rehacer, p.deshacer];
      if (!de.length) return;
      await guardar({ put: [{ ...b, rutina: de[de.length - 1], actualizado: ahoraISO() }], foco: nombre === 'deshacer' ? 'entDeshacer' : 'entRehacer',
                      msg: nombre === 'deshacer' ? 'Cambio deshecho' : 'Cambio rehecho', hecho: () => { de.pop(); a.push(b.rutina); } });
      return;
    }
    case 'partida': {
      if (!b) return;
      const p = pilaDe(b.id);
      await guardar({ put: [{ ...b, rutina: PL.clonar(b.origen.rutina), actualizado: ahoraISO() }], foco: 'entDeshacer', msg: 'Recuperada la rutina de partida. Puedes deshacerlo.',
                      hecho: () => { p.deshacer.push(b.rutina); p.rehacer = []; } });
      return;
    }
    case 'rebasar': {
      if (!b) return;
      const origen = PL.origenCopia(A.E.raw, A.E.inst) || { ...b.origen, tipo: 'blanco' };
      await guardar({ put: [{ ...b, origen, actualizado: ahoraISO() }], foco: 'entEmitir', msg: 'Borrador conservado; ahora se compara con su rutina actual' });
      return;
    }
    case 'emitir': {
      if (!b) return;
      const av = PL.avisos(b.rutina, A.E.raw, { nombre: b.nombre });
      if (av.bloquea){
        A.modalMensaje('Aún no se puede emitir', `<p>La app no podría aplicar este borrador:</p><ul class="lista-plana">${av.avisos.filter(a => a.nivel === 'rojo').map(a => `<li>${esc(a.txt)}</li>`).join('')}</ul>`);
        return;
      }
      A.abrirModal(V.confirmarEmision(ctx()), { ancho: true });
      return;
    }
    case 'emitir-confirmar': {
      if (el) el.disabled = true;
      await emitir();
      return;
    }
    case 'fila-nueva': await editar({ tipo: 'addFila', d }, `ent-${d}-${b ? b.rutina.dias[d].filas.length : 0}-ejercicio`); return;
    case 'fila-arriba': await editar({ tipo: 'moverFila', d, f, delta: -1 }, f - 1 > 0 ? `ent-${d}-${f - 1}-arriba` : `ent-${d}-${f - 1}-abajo`); return;
    case 'fila-abajo': {
      const ult = b ? b.rutina.dias[d].filas.length - 1 : 0;
      await editar({ tipo: 'moverFila', d, f, delta: 1 }, f + 1 < ult ? `ent-${d}-${f + 1}-abajo` : `ent-${d}-${f + 1}-arriba`);
      return;
    }
    case 'fila-quitar': {
      const n = b ? b.rutina.dias[d].filas.length : 0;
      await editar({ tipo: 'delFila', d, f }, n > 1 ? `ent-${d}-${Math.min(f, n - 2)}-ejercicio` : `ent-${d}-nueva`);
      A.anunciar('Ejercicio quitado. Puedes deshacerlo.');
      return;
    }
    case 'dia-nuevo': await editar({ tipo: 'addDia' }, `ent-${b ? b.rutina.dias.length : 0}-nombre`); return;
    case 'dia-antes': await editar({ tipo: 'moverDia', d, delta: -1 }, `ent-${d - 1}-nombre`); return;
    case 'dia-despues': await editar({ tipo: 'moverDia', d, delta: 1 }, `ent-${d + 1}-nombre`); return;
    case 'dia-quitar': await editar({ tipo: 'delDia', d }, `ent-${Math.max(0, d - 1)}-nombre`); A.anunciar('Día quitado. Puedes deshacerlo.'); return;
  }
}

async function cambio(el){
  const tipo = el.dataset.ent;
  if (tipo === 'borrador'){ await guardar({ activo: el.value, foco: 'entSelBorrador', msg: 'Borrador cambiado' }); return; }
  if (!borradorActivo()) return;
  if (tipo === 'sistema') await editar({ tipo: 'sistema', valor: el.value }, 'entSistema');
  else if (tipo === 'nombreDia') await editar({ tipo: 'nombreDia', d: Number(el.dataset.d), valor: el.value }, el.id);
  else if (tipo === 'campo'){
    const valor = el.type === 'checkbox' ? el.checked : el.value;
    await editar({ tipo: 'campo', d: Number(el.dataset.d), f: Number(el.dataset.f), k: el.dataset.k, valor }, el.id);
  }
}

function bind(){
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-ent-accion]');
    if (a && !a.disabled) accion(a.dataset.entAccion, a);
  });
  document.addEventListener('change', ev => {
    if (ev.target.dataset && ev.target.dataset.ent && A.E.seccion === 'entrenador') cambio(ev.target);
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id === 'entDesbloqueo'){ ev.preventDefault(); desbloquear(); }
    else if (ev.target.id === 'entFicha') ev.preventDefault();
  });
  // Deshacer / rehacer (fuera de los campos de texto, donde Ctrl + Z
  // deshace lo que se está escribiendo).
  document.addEventListener('keydown', ev => {
    if (A.E.seccion !== 'entrenador' || !S.clave || !(ev.ctrlKey || ev.metaKey) || ev.altKey || !$('#modal').classList.contains('oculto')) return;
    const t = ev.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(t.type)))) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey){ ev.preventDefault(); accion('deshacer'); }
    else if (k === 'y' || (k === 'z' && ev.shiftKey)){ ev.preventDefault(); accion('rehacer'); }
  });
}

return { iniciar, cargar, html, tras, get listo(){ return S.listo; }, get desbloqueado(){ return !!S.clave; } };
})();
