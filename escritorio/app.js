'use strict';
/* ================================================================
   TrueLift Escritorio — app.js
   Interfaz: importación de la copia JSON y del ZIP de fotos con vista
   previa y decisión explícita, persistencia local, navegación entre
   las secciones personales y «Mis datos». El cálculo vive en
   analisis.js (sobre ../coach/motor.js) y el HTML de las secciones en
   vistas.js. Estado del trabajo: escritorio/PLAN.md.

   Reutiliza de ../coach/data.js: esc, $, $$, parseFecha, MESES,
   DIAS_SEM, diasEntre, uuid. Todo se encierra en una IIFE para no
   chocar con los nombres globales del Coach.
   ================================================================ */

(() => {

const E = {
  espacios: [], espacio: null, inst: null, raw: null, rawError: null,
  indiceJson: null, fotosMeta: [], galeria: [], importaciones: [],
  seccion: 'datos', ocupado: false, abort: null, P: null,
  urls: new Set(), urlModal: null, obs: null, canal: null,
  estimacion: null, persistido: null, origenModal: null, sinConexion: null,
  M: null, errorModelo: null, fisica: null, espacioFisica: null,
  fis: { pose: null, a: null, b: null, modo: 'lado', corte: 50, opacidad: 50, encuadres: {}, dirty: false, sitio: null, galeriaPose: 'todas', pagina: 0 },
  st: { sub: null, ejercicio: null, busca: '', verTodas: false, compA: null, compB: null, periodos: null, informe: null },
  // Informe (fase 7): la selección del periodo se guarda por espacio; las
  // fotos elegidas viven solo en memoria y empiezan siempre vacías.
  inf: { conFotos: false, fotos: new Set(), error: null, borrador: null }, espacioInforme: null,
  // Planificador (fase 6): borradores del espacio, el activo y, solo en
  // memoria, las pilas de deshacer/rehacer de cada borrador.
  rut: { borradores: [], activoId: null, pilas: new Map(), error: null, foco: null },
};
const PL = Planificador;

const SECCIONES = {
  resumen: 'Mi resumen', entrenamiento: 'Entrenamiento', fisica: 'Evolución física',
  recuperacion: 'Recuperación', rutina: 'Mi rutina', informes: 'Informes', datos: 'Mis datos',
};
const POSE_TXT = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };
const FUENTE_TXT = {
  json: null,
  zip: 'Datos del índice del ZIP',
  nombre: 'Fecha y pose deducidas del nombre',
};

// ---------- formato ----------
const fmtDia = iso => { const d = iso ? parseFecha(iso) : null;
  return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—'; };
const fmtMomento = ts => { const d = ts ? new Date(ts) : null;
  if (!d || isNaN(d)) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`; };
const fmtBytes = n => n == null ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB`
  : n < 1073741824 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${(n / 1073741824).toFixed(2).replace('.', ',')} GB`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const hace = iso => {
  if (!iso) return null;
  const d = diasEntre(parseFecha(iso), new Date());
  return d <= 0 ? 'hoy' : d === 1 ? 'hace 1 día' : `hace ${d} días`;
};

function anunciar(txt){ const v = $('#vivo'); if (v){ v.textContent = ''; setTimeout(() => { v.textContent = txt; }, 30); } }

// ---------- modal accesible ----------
function abrirModal(html, { ancho = false, bloqueado = false } = {}){
  const m = $('#modal'), caja = $('#modalCaja');
  if (m.classList.contains('oculto')) E.origenModal = document.activeElement;
  caja.classList.toggle('ancho', ancho);
  caja.dataset.bloqueado = bloqueado ? '1' : '';
  caja.innerHTML = html;
  m.classList.remove('oculto');
  marcarDesplazables();
  const foco = caja.querySelector('[autofocus]') || caja.querySelector('h2') || caja;
  if (foco === caja || foco.tagName === 'H2') foco.setAttribute('tabindex', '-1');
  foco.focus();
}
function cerrarModal(){
  if (E.urlModal){ URL.revokeObjectURL(E.urlModal); E.urlModal = null; }
  $('#modal').classList.add('oculto');
  $('#modalCaja').innerHTML = '';
  if (E.origenModal && document.contains(E.origenModal)) E.origenModal.focus();
  E.origenModal = null;
}
function modalMensaje(titulo, cuerpoHtml){
  abrirModal(`<h2 id="modalTitulo">${esc(titulo)}</h2>${cuerpoHtml}
    <div class="mod-acciones"><button class="btn pri" type="button" data-accion="cerrar" autofocus>Entendido</button></div>`);
}

// ---------- carga del estado guardado ----------
async function cargarEstado(){
  E.espacios = (await Almacen.todos('espacios')).sort((a, b) => a.creado < b.creado ? -1 : 1);
  const meta = await Almacen.leer('meta', 'espacioActivo');
  const id = meta && E.espacios.some(e => e.id === meta.valor) ? meta.valor : (E.espacios[0]?.id ?? null);
  E.espacio = E.espacios.find(e => e.id === id) || null;
  E.inst = null; E.raw = null; E.rawError = null; E.indiceJson = null;
  E.fotosMeta = []; E.galeria = []; E.importaciones = []; E.M = null; E.errorModelo = null;
  if (E.espacio){
    if (E.espacio.instantaneaId){
      E.inst = await Almacen.leer('instantaneas', E.espacio.instantaneaId);
      // Se vuelve a parsear el texto original cada vez: el archivo guardado
      // nunca se modifica al calcular.
      try { E.raw = E.inst ? JSON.parse(E.inst.texto) : null; }
      catch (e) { E.rawError = 'La copia guardada no se puede leer.'; }
    }
    if (E.raw && E.raw.medidas && typeof E.raw.medidas === 'object' && !Array.isArray(E.raw.medidas))
      E.indiceJson = FotosTL.leerIndice(E.raw.medidas);
    E.fotosMeta = await Almacen.todos('fotos', E.espacio.id);
    E.galeria = FotosTL.resolver({ indiceJson: E.indiceJson, indiceZip: FotosTL.leerIndice(E.espacio.indiceZip), guardadas: E.fotosMeta });
    E.importaciones = (await Almacen.todos('importaciones', E.espacio.id)).sort((a, b) => b.id - a.id);
    // Modelo de análisis: se recalcula desde el texto original en cada carga.
    if (E.raw){
      try { E.M = Analisis.preparar(E.raw, E.inst.resumen); }
      catch (e) { E.errorModelo = e && e.message ? e.message : String(e); console.error(e); }
    }
  }
  E.fisica = Evolucion.preparar(E.raw, E.espacio?.indiceZip);
  const espacioId = E.espacio?.id || null;
  if (espacioId !== E.espacioFisica){
    Object.assign(E.fis, { pose: null, a: null, b: null, encuadres: {}, dirty: false, sitio: null, galeriaPose: 'todas', pagina: 0 });
    E.espacioFisica = espacioId;
  }
  if (!E.fis.dirty) E.fis.encuadres = espacioId ? (await Almacen.leer('meta', `encuadres:${espacioId}`))?.valor || {} : {};
  E.st.periodos = E.espacio ? (await Almacen.leer('meta', `periodos:${E.espacio.id}`))?.valor || null : null;
  E.st.informe = E.espacio ? (await Almacen.leer('meta', `informe:${E.espacio.id}`))?.valor || null : null;
  if (espacioId !== E.espacioInforme){ E.inf = { conFotos: false, fotos: new Set(), error: null, borrador: null }; E.espacioInforme = espacioId; }
  // Borradores de rutina: cuelgan del espacio, no de la copia; actualizar la
  // copia no los toca.
  E.rut.borradores = E.espacio
    ? (await Almacen.todos('borradores', E.espacio.id)).map(b => PL.leerBorrador(b)).filter(Boolean).sort((a, b) => a.creado < b.creado ? -1 : 1)
    : [];
  E.rut.activoId = E.espacio ? (await Almacen.leer('meta', `borradorActivo:${E.espacio.id}`))?.valor || null : null;
  E.estimacion = await Almacen.estimacion();
  E.persistido = await Almacen.persistido();
}

// ---------- recepción de archivos ----------
function recibirArchivos(lista){
  if (E.ocupado) return;
  const files = [...(lista || [])];
  if (!files.length) return;
  let json = null, zip = null;
  const rechazados = [];
  for (const f of files){
    const n = f.name.toLowerCase();
    if (n.endsWith('.json')){ if (json) rechazados.push({ nombre: f.name, motivo: 'solo se importa una copia JSON a la vez' }); else json = f; }
    else if (n.endsWith('.zip')){ if (zip) rechazados.push({ nombre: f.name, motivo: 'solo se importa un ZIP de fotos a la vez' }); else zip = f; }
    else rechazados.push({ nombre: f.name, motivo: 'no es una copia JSON ni un ZIP de fotos' });
  }
  if (!json && !zip){
    modalMensaje('Archivo no admitido', `<p>Importa la copia de seguridad (<code>.json</code>) o el ZIP de fotos (<code>.zip</code>) que exporta TrueLift desde Ajustes → Copia de seguridad.</p>
      ${listaHtml(rechazados.map(r => `<code>${esc(r.nombre)}</code>: ${esc(r.motivo)}`))}`);
    return;
  }
  prepararImportacion({ json, zip, rechazados });
}

function listaHtml(items, max = 12){
  if (!items.length) return '';
  const extra = items.length > max ? `<li class="muted">y ${items.length - max} más</li>` : '';
  return `<ul class="lista-plana">${items.slice(0, max).map(i => `<li>${i}</li>`).join('')}${extra}</ul>`;
}

function modalProgreso(texto, frac = null){
  const caja = $('#modalCaja');
  const barra = caja.querySelector('.progreso i');
  if (barra && caja.dataset.bloqueado === '1'){
    caja.querySelector('[data-progreso-texto]').textContent = texto;
    if (frac != null) barra.style.width = `${Math.round(frac * 100)}%`;
    return;
  }
  abrirModal(`<h2 id="modalTitulo">Preparando la importación</h2>
    <p data-progreso-texto>${esc(texto)}</p>
    <div class="progreso" role="progressbar" aria-label="Progreso"><i style="width:${frac == null ? 0 : Math.round(frac * 100)}%"></i></div>
    <p class="muted" style="font-size:12px">Hasta que confirmes no se guarda nada.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cancelar-proceso" autofocus>Cancelar</button></div>`,
    { bloqueado: true });
}

async function sha256Bytes(u8){
  const h = await crypto.subtle.digest('SHA-256', u8);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function crearMiniatura(blob){
  const bmp = await createImageBitmap(blob);
  try {
    const lado = 360, k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    let mini;
    if (typeof OffscreenCanvas !== 'undefined'){
      const c = new OffscreenCanvas(w, h);
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      mini = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    } else {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      mini = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.8));
    }
    return { blob: mini, ancho: bmp.width, alto: bmp.height };
  } finally { bmp.close(); }
}

function cancelado(signal){
  if (signal.aborted) throw ZipSeguro.error('cancelado', 'Cancelado.');
}

async function procesarZip(file, signal){
  const Z = { nombreArchivo: file.name, bytes: file.size, error: null, problemas: [], ignoradas: [],
              indice: null, indiceRaw: null, indiceError: null, candidatas: [], duplicadosEnZip: [] };
  let lista;
  try { lista = await ZipSeguro.listar(file); }
  catch (e) { if (e && e.codigo){ Z.error = e.message; return Z; } throw e; }
  Z.problemas = lista.problemas;
  const cl = FotosTL.clasificarEntradas(lista.entradas);
  Z.ignoradas = cl.ignoradas;
  if (cl.indice){
    try {
      if (cl.indice.real > ZipSeguro.LIMITES.bytesIndice) throw new Error('índice demasiado grande');
      const b = await ZipSeguro.extraer(file, cl.indice, { signal });
      const obj = JSON.parse(new TextDecoder().decode(b));
      Z.indice = FotosTL.leerIndice(obj);
      if (!Z.indice) throw new Error('formato no reconocido');
      Z.indiceRaw = obj;
    } catch (e) {
      if (e && e.codigo === 'cancelado') throw e;
      Z.indice = null; Z.indiceRaw = null;
      Z.indiceError = 'El índice del ZIP (medidas.json) no se pudo leer; las fotos se asocian por la copia de datos o por su nombre.';
    }
  }
  const vistos = new Set();
  let total = 0;
  const n = cl.imagenes.length;
  for (let i = 0; i < n; i++){
    cancelado(signal);
    const ent = cl.imagenes[i];
    modalProgreso(`Revisando fotos: ${i + 1} de ${n}`, n ? (i + 1) / n : 1);
    if (vistos.has(ent.nombre)){ Z.duplicadosEnZip.push(ent.nombre); continue; }
    vistos.add(ent.nombre);
    let datos;
    try { datos = await ZipSeguro.extraer(file, ent, { signal }); }
    catch (e) {
      if (e && e.codigo === 'cancelado') throw e;
      Z.candidatas.push({ nombre: ent.nombre, sha256: null, tipo: null, motivo: `archivo dañado (${e.message})` });
      continue;
    }
    total += datos.length;
    if (total > ZipSeguro.LIMITES.bytesTotal) throw ZipSeguro.error('grande', 'El contenido del ZIP supera el máximo admitido.');
    const sha = await sha256Bytes(datos);
    const tipo = FotosTL.tipoImagen(datos);
    if (!tipo){ Z.candidatas.push({ nombre: ent.nombre, sha256: sha, tipo: null, motivo: 'no es una imagen JPEG, PNG o WebP' }); continue; }
    const blob = new Blob([datos], { type: tipo });
    let mini;
    try { mini = await crearMiniatura(blob); }
    catch (_) { Z.candidatas.push({ nombre: ent.nombre, sha256: sha, tipo: null, motivo: 'imagen dañada o ilegible' }); continue; }
    Z.candidatas.push({ nombre: ent.nombre, sha256: sha, tipo, bytes: datos.length, blob,
                        mini: mini.blob, ancho: mini.ancho, alto: mini.alto });
  }
  return Z;
}

async function prepararImportacion({ json, zip, rechazados = [] }){
  E.ocupado = true;
  const ac = new AbortController();
  E.abort = ac;
  modalProgreso('Leyendo archivos…');
  try {
    const P = { json: null, zip: null, rechazados, destino: null, comp: null,
                nombreNuevo: E.espacios.length ? `Espacio ${E.espacios.length + 1}` : 'Mis datos',
                op: { sustituir: false, incluirFuera: false, retroceso: false } };
    if (json){
      const texto = json.size > ImportarJSON.LIMITE_BYTES ? null : await json.text();
      cancelado(ac.signal);
      P.json = texto == null
        ? { ok: false, errores: ['El archivo es demasiado grande para ser una copia de TrueLift.'], avisos: [], nombreArchivo: json.name }
        : await ImportarJSON.analizar(texto, { nombreArchivo: json.name, bytes: json.size });
      if (P.json.ok) P.json.texto = texto;
    }
    if (zip) P.zip = await procesarZip(zip, ac.signal);
    cancelado(ac.signal);

    if (P.json && P.json.ok && E.raw)
      P.comp = ImportarJSON.comparar(E.raw, P.json.raw, { shaActual: E.inst.sha256, shaNuevo: P.json.sha256 });
    const hayDatos = !!(E.espacio && (E.inst || E.fotosMeta.length));
    if (!E.espacio) P.destino = 'nuevo';
    else if (!(P.json && P.json.ok)) P.destino = 'actualizar';
    else if (P.comp && P.comp.identica) P.destino = 'actualizar';
    else if (!hayDatos) P.destino = 'actualizar';
    else P.destino = null;   // decisión explícita
    P.destinoFijo = P.destino !== null;
    E.P = P;
    E.ocupado = false;
    mostrarPrevia();
  } catch (e) {
    E.ocupado = false;
    E.P = null;
    if (e && e.codigo === 'cancelado'){
      modalMensaje('Importación cancelada', '<p>No se ha guardado nada.</p>');
      anunciar('Importación cancelada');
    } else {
      modalMensaje('No se pudo preparar la importación', `<p>${esc(e && e.message ? e.message : String(e))}</p><p class="muted">No se ha guardado nada.</p>`);
    }
  } finally { E.abort = null; }
}

// ---------- plan de fotos según el destino ----------
function planFotos(P){
  if (!P.zip || P.zip.error || !P.destino) return null;
  const actualiza = P.destino === 'actualizar' && E.espacio;
  let rawFinal = null;
  if (P.json && P.json.ok) rawFinal = P.json.raw;
  else if (actualiza) rawFinal = E.raw;
  const md = rawFinal && rawFinal.medidas;
  const indiceJson = (md && typeof md === 'object' && !Array.isArray(md)) ? FotosTL.leerIndice(md) : null;
  const existentes = actualiza ? new Map(E.fotosMeta.map(f => [f.archivo, f])) : new Map();
  const plan = FotosTL.planificar({ candidatas: P.zip.candidatas, indiceJson, indiceZip: P.zip.indice, existentes });
  plan.indiceJson = indiceJson;
  plan.registrosDistintos = FotosTL.registrosDistintos(indiceJson, P.zip.indice);
  const enZip = new Set(P.zip.candidatas.map(c => c.nombre));
  plan.indiceSinImagen = P.zip.indice ? [...P.zip.indice.fotos.keys()].filter(a => !enZip.has(a)).length : 0;
  plan.aGuardar = plan.items.filter(i => i.estado === 'nueva' ||
    (i.estado === 'conflicto' && P.op.sustituir) || (i.estado === 'fueraDeCopia' && P.op.incluirFuera));
  return plan;
}

function jsonAplicable(P){
  return !!(P.json && P.json.ok && !(P.destino === 'actualizar' && P.comp && P.comp.identica));
}

// ---------- vista previa ----------
function mostrarPrevia(){
  const P = E.P;
  if (!P) return;
  const partes = [];
  const necesitaDestino = !P.destinoFijo;

  // --- datos ---
  if (P.json){
    partes.push(`<h3>Datos de entrenamiento</h3>`);
    if (!P.json.ok){
      partes.push(`<div class="alerta rojo"><span class="tag">No válido</span><span>${P.json.errores.map(esc).join('<br>')}</span></div>
        <p class="muted" style="font-size:13px"><code>${esc(P.json.nombreArchivo)}</code> no se importará.</p>`);
    } else {
      const r = P.json.resumen;
      partes.push(`<p class="muted" style="font-size:13px"><code>${esc(P.json.nombreArchivo)}</code> · ${fmtBytes(P.json.bytes)}</p>
        <div class="cifras">
          ${cifra(r.primerRegistro ? `${fmtDia(r.primerRegistro)}` : '—', 'primer registro')}
          ${cifra(r.ultimoRegistro ? fmtDia(r.ultimoRegistro) : '—', 'último registro')}
          ${cifra(r.ultimoEntreno ? fmtDia(r.ultimoEntreno) : '—', 'último entrenamiento')}
          ${cifra(r.sesionesFuerza, 'sesiones de fuerza')}
          ${cifra(r.sesionesCardio, 'sesiones de cardio')}
          ${cifra(r.pesajes, 'pesajes')}
          ${cifra(r.cuestionarios, 'cuestionarios diarios')}
          ${cifra(r.diasReloj, 'días con datos del reloj')}
          ${cifra(r.fechasMedidas, 'días con medidas')}
          ${cifra(r.fotosIndice, 'fotos registradas')}
          ${cifra(r.lineasRutina, 'ejercicios en tu rutina')}
        </div>
        <p class="muted" style="font-size:12.5px">La copia no indica cuándo se exportó${r.fechaNombreArchivo
          ? `; el nombre del archivo sugiere el ${fmtDia(r.fechaNombreArchivo)} (no verificado)` : ''}.
          ${r.unidadPeso === 'lb' ? ' En el móvil usas libras; los datos se guardan en kg y aquí se verán en kg.' : ''}
          ${!r.tieneBloqueMedidas ? ' Es de una versión de la app anterior a las medidas y fotos: no trae ese registro.' : ''}</p>
        ${calidadHtml(P.json.calidad)}`);
      if (P.comp) partes.push(comparacionHtml(P.comp));
    }
  }

  // --- destino ---
  if (necesitaDestino){
    partes.push(`<h3>¿Dónde guardar esta copia?</h3>
      <p style="font-size:13px">La copia no incluye un identificador de persona, así que el escritorio no puede saber si es tuya. ${personaHtml(P.comp)}</p>
      <label class="opcion"><input type="radio" name="destino" value="actualizar" ${P.destino === 'actualizar' ? 'checked' : ''}>
        <span><b>Actualizar «${esc(E.espacio.nombre)}»</b><small>Sustituye la copia actual por esta. La actual se conserva para poder volver a ella. Tus fotos no se tocan.</small></span></label>
      <label class="opcion"><input type="radio" name="destino" value="nuevo" ${P.destino === 'nuevo' ? 'checked' : ''}>
        <span><b>Crear un espacio personal nuevo</b><small>Para otra persona o para empezar de cero. Sus datos y fotos quedan separados.</small></span></label>
      ${P.destino === 'nuevo' ? `<div class="mod-fila"><label for="nombreNuevo">Nombre del espacio</label><input type="text" id="nombreNuevo" value="${esc(P.nombreNuevo)}" maxlength="60"></div>` : ''}`);
  } else if (P.destino === 'actualizar' && E.espacio && (P.json && P.json.ok || P.zip)){
    partes.push(`<p class="muted" style="font-size:13px">Se guardará en «${esc(E.espacio.nombre)}».</p>`);
  }

  // --- retroceso ---
  if (P.comp && P.comp.retroceso && P.destino === 'actualizar' && jsonAplicable(P)){
    partes.push(`<label class="opcion"><input type="checkbox" data-op="retroceso" ${P.op.retroceso ? 'checked' : ''}>
      <span><b>Usar esta copia aunque parezca más antigua</b><small>Podrás volver a la copia actual desde «Mis datos».</small></span></label>`);
  }

  // --- fotos ---
  if (P.zip) partes.push(fotosPreviaHtml(P));

  if (P.rechazados.length)
    partes.push(`<h3>Archivos no admitidos</h3>${listaHtml(P.rechazados.map(r => `<code>${esc(r.nombre)}</code>: ${esc(r.motivo)}`))}`);

  const est = estadoConfirmacion(P);
  abrirModal(`<h2 id="modalTitulo">Revisa la importación</h2>
    ${partes.join('')}
    ${est.nota ? `<p class="muted" style="font-size:13px">${esc(est.nota)}</p>` : ''}
    <div class="mod-acciones">
      <button class="btn sec" type="button" data-accion="descartar">Cancelar</button>
      <button class="btn pri" type="button" data-accion="confirmar" ${est.puede ? '' : 'disabled'}>${esc(est.texto)}</button>
    </div>`, { ancho: true });
}

function cifra(valor, etiqueta, aviso = false){
  return `<div class="cifra${aviso ? ' aviso' : ''}"><b>${typeof valor === 'number' ? valor.toLocaleString('es-ES') : esc(valor)}</b><span>${esc(etiqueta)}</span></div>`;
}

function calidadHtml(c){
  if (!c) return '';
  const avisos = [];
  if (c.invalidos) avisos.push(`<b>${plural(c.invalidos, 'valor no válido', 'valores no válidos')}</b>: se ignoran igual que en la app.`);
  if (c.registrosDescartados) avisos.push(`${plural(c.registrosDescartados, 'registro no se puede leer', 'registros no se pueden leer')} y no se mostrará${c.registrosDescartados === 1 ? '' : 'n'}.`);
  const info = [];
  if (c.seriesSinAnotar) info.push(`${plural(c.seriesSinAnotar, 'serie quedó sin anotar', 'series quedaron sin anotar')} (se tratan como dato ausente, no como cero).`);
  if (c.cargasCero) info.push(`${plural(c.cargasCero, 'ejercicio con carga 0', 'ejercicios con carga 0')} (habitual en ejercicios con tu peso corporal).`);
  if (!avisos.length && !info.length) return '';
  return `${avisos.length ? `<div class="alerta ambar"><span class="tag">Revisar</span><span>${avisos.join(' ')}</span></div>` : ''}
    ${c.ejemplos && c.ejemplos.length ? `<details class="detalle"><summary>Ver ejemplos</summary>${listaHtml(c.ejemplos.map(e => `<code>${esc(e.ruta)}</code>: ${esc(e.motivo)}`))}</details>` : ''}
    ${info.length ? `<p class="muted" style="font-size:12.5px">${info.join(' ')}</p>` : ''}`;
}

function comparacionHtml(c){
  if (c.identica)
    return `<div class="alerta azul"><span class="tag">Sin cambios</span><span>Esta copia es idéntica a la que ya tienes guardada. No se cambiará nada.</span></div>`;
  const out = [`<p style="font-size:13px">Frente a tus datos actuales: <b>${plural(c.nuevas, 'sesión nueva', 'sesiones nuevas')}</b>${c.faltan ? ` y <b>${plural(c.faltan, 'sesión', 'sesiones')}</b> que esta copia no tiene` : ''}. Último registro: ${fmtDia(c.ultimoActual)} → ${fmtDia(c.ultimoNuevo)}.</p>`];
  if (c.retroceso)
    out.push(`<div class="alerta rojo"><span class="tag">Copia más antigua</span><span>Esta copia ${c.terminaAntes ? `termina el ${fmtDia(c.ultimoNuevo)}, antes que la actual (${fmtDia(c.ultimoActual)})` : 'no añade nada y le faltan sesiones'}. Si la usas para actualizar, ${plural(c.faltan, 'sesión dejará', 'sesiones dejarán')} de verse aquí.</span></div>`);
  else if (c.faltan)
    out.push(`<div class="alerta ambar"><span class="tag">Revisar</span><span>${plural(c.faltan, 'sesión de tu copia actual no está', 'sesiones de tu copia actual no están')} en esta. Puede que las borraras en el móvil.</span></div>`);
  return out.join('');
}

function personaHtml(c){
  if (!c) return '';
  return {
    probable: 'La mayoría de tus sesiones actuales también están en esta copia.',
    sin_relacion: 'Ninguna sesión coincide con tus datos actuales: podría ser de otra persona o de otra instalación.',
    distinta: 'Algunos datos de la app (como la fecha de nacimiento) no coinciden con tus datos actuales.',
    incierta: 'No hay datos suficientes para saber si es la misma persona.',
  }[c.persona] || '';
}

function fotosPreviaHtml(P){
  const Z = P.zip;
  const out = [`<h3>Fotos</h3><p class="muted" style="font-size:13px"><code>${esc(Z.nombreArchivo)}</code> · ${fmtBytes(Z.bytes)}</p>`];
  if (Z.error){
    out.push(`<div class="alerta rojo"><span class="tag">No válido</span><span>${esc(Z.error)} No se importará ninguna foto.</span></div>`);
    return out.join('');
  }
  out.push(Z.indice
    ? `<p style="font-size:13px">El ZIP trae su índice de fotos.</p>`
    : `<p style="font-size:13px">El ZIP no trae índice (exportación antigua o sin él): las fotos se asocian por tu copia de datos o, si no aparecen en ella, por su nombre.</p>`);
  if (Z.indiceError) out.push(`<div class="alerta ambar"><span class="tag">Índice</span><span>${esc(Z.indiceError)}</span></div>`);
  const plan = planFotos(P);
  if (!plan){
    out.push(`<p class="muted" style="font-size:13px">Elige dónde guardar la copia para ver qué fotos se importarán.</p>`);
    return out.join('');
  }
  const c = plan.cuentas;
  const guardar = plan.aGuardar.length;
  out.push(`<div class="cifras">
    ${cifra(guardar, 'se guardarán')}
    ${cifra(c.duplicada, 'ya estaban (no se duplican)')}
    ${c.conflicto ? cifra(c.conflicto, 'mismo nombre, imagen distinta', true) : ''}
    ${c.fueraDeCopia ? cifra(c.fueraDeCopia, 'no figuran en tu copia de datos', true) : ''}
    ${c.sinAsociacion ? cifra(c.sinAsociacion, 'sin fecha ni pose', true) : ''}
    ${c.noValida ? cifra(c.noValida, 'no válidas', true) : ''}
  </div>`);
  const por = estado => plan.items.filter(i => i.estado === estado);
  if (c.conflicto){
    out.push(`<label class="opcion"><input type="checkbox" data-op="sustituir" ${P.op.sustituir ? 'checked' : ''}>
      <span><b>Sustituir ${plural(c.conflicto, 'foto', 'fotos')} por la versión del ZIP</b><small>Ya tienes guardada una imagen con el mismo nombre pero distinto contenido. Si no marcas esto, se conserva la que ya tienes.</small></span></label>
      <details class="detalle"><summary>Ver nombres</summary>${listaHtml(por('conflicto').map(i => `<code>${esc(i.nombre)}</code>`))}</details>`);
  }
  if (c.fueraDeCopia){
    out.push(`<label class="opcion"><input type="checkbox" data-op="incluirFuera" ${P.op.incluirFuera ? 'checked' : ''}>
      <span><b>Incluir también ${plural(c.fueraDeCopia, 'foto que no figura', 'fotos que no figuran')} en tu copia de datos</b><small>Puede que las borraras en el móvil después de exportar este ZIP. Si las incluyes, se marcarán como tales.</small></span></label>
      <details class="detalle"><summary>Ver nombres</summary>${listaHtml(por('fueraDeCopia').map(i => `<code>${esc(i.nombre)}</code> · ${fmtDia(i.ficha && i.ficha.fecha)}`))}</details>`);
  }
  const notas = [];
  if (c.discrepancias) notas.push(`${plural(c.discrepancias, 'foto tiene', 'fotos tienen')} otra fecha o pose en el índice del ZIP; se usa la de tu copia de datos, que recoge las correcciones hechas en el móvil.`);
  if (plan.registrosDistintos) notas.push(`El índice del ZIP trae ${plural(plan.registrosDistintos, 'medida distinta', 'medidas distintas')} de tu copia de datos; se usan las de la copia.`);
  if (plan.indiceSinImagen) notas.push(`El índice del ZIP menciona ${plural(plan.indiceSinImagen, 'foto que no viene', 'fotos que no vienen')} en el archivo.`);
  const pendientes = plan.indiceJson ? [...plan.indiceJson.fotos.keys()].filter(a =>
    !E.fotosMeta.some(f => f.archivo === a && P.destino === 'actualizar') && !plan.aGuardar.some(i => i.nombre === a)).length : 0;
  if (pendientes) notas.push(`${plural(pendientes, 'foto de tu copia de datos seguirá', 'fotos de tu copia de datos seguirán')} sin imagen: se mostrará${pendientes === 1 ? '' : 'n'} como pendiente${pendientes === 1 ? '' : 's'}.`);
  if (notas.length) out.push(`<ul class="lista-plana" style="font-size:13px">${notas.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`);
  const ignor = [
    ...Z.problemas.map(p => `<code>${esc(p.nombre)}</code>: ${esc(p.motivo)}`),
    ...Z.ignoradas.map(p => `<code>${esc(p.nombre)}</code>: ${esc(p.motivo)}`),
    ...Z.duplicadosEnZip.map(n => `<code>${esc(n)}</code>: repetido dentro del ZIP`),
    ...por('sinAsociacion').map(i => `<code>${esc(i.nombre)}</code>: sin fecha ni pose (no está en ningún índice y su nombre no es de TrueLift)`),
    ...por('noValida').map(i => `<code>${esc(i.nombre)}</code>: ${esc((Z.candidatas.find(x => x.nombre === i.nombre) || {}).motivo || 'no válida')}`),
  ];
  if (ignor.length) out.push(`<details class="detalle"><summary>${plural(ignor.length, 'archivo no se importará', 'archivos no se importarán')}</summary>${listaHtml(ignor, 50)}</details>`);
  if (guardar){
    const bytes = plan.aGuardar.reduce((s, i) => { const k = P.zip.candidatas.find(x => x.nombre === i.nombre); return s + (k ? k.blob.size + k.mini.size : 0); }, 0);
    out.push(`<p class="muted" style="font-size:12.5px">Ocupará unos ${fmtBytes(bytes)} en este navegador${E.estimacion && E.estimacion.libre != null ? ` (disponibles: ${fmtBytes(E.estimacion.libre)})` : ''}.</p>`);
  }
  return out.join('');
}

function estadoConfirmacion(P){
  const jsonOk = !!(P.json && P.json.ok);
  const zipOk = !!(P.zip && !P.zip.error);
  if (!P.destino) return { puede: false, texto: 'Importar', nota: 'Elige dónde guardar la copia.' };
  if (P.comp && P.comp.retroceso && P.destino === 'actualizar' && jsonAplicable(P) && !P.op.retroceso)
    return { puede: false, texto: 'Importar', nota: 'Confirma que quieres usar una copia más antigua.' };
  const plan = planFotos(P);
  const hayFotos = !!(plan && plan.aGuardar.length);
  const hayJson = jsonAplicable(P);
  if (!hayJson && !hayFotos){
    return { puede: false, texto: 'Importar', nota: (jsonOk || zipOk) ? 'No hay nada nuevo que guardar.' : '' };
  }
  const texto = hayJson && hayFotos ? 'Importar datos y fotos' : hayJson ? 'Importar datos' : `Importar ${plural(plan.aGuardar.length, 'foto', 'fotos')}`;
  const nota = (P.json && !P.json.ok && hayFotos) ? 'La copia de datos no es válida: solo se importarán las fotos.' : '';
  return { puede: true, texto, nota };
}

// ---------- confirmación: escritura atómica ----------
async function confirmarImportacion(){
  const P = E.P;
  if (!P || E.ocupado) return;
  const est = estadoConfirmacion(P);
  if (!est.puede) return;
  E.ocupado = true;
  const ahora = new Date().toISOString();
  const nuevo = P.destino === 'nuevo' || !E.espacio;
  const espacio = nuevo
    ? { id: uuid(), nombre: (P.nombreNuevo || '').trim() || 'Mis datos', creado: ahora,
        instantaneaId: null, instantaneaAnteriorId: null }
    : { ...E.espacio };
  const ops = [];
  const registro = { espacioId: espacio.id, fecha: ahora, archivos: [], datos: null, fotos: null };
  let bytes = 0;

  if (jsonAplicable(P)){
    const inst = { id: uuid(), espacioId: espacio.id, texto: P.json.texto, sha256: P.json.sha256,
                   bytes: P.json.bytes, nombreArchivo: P.json.nombreArchivo, importadoEn: ahora,
                   resumen: P.json.resumen };
    ops.push({ almacen: 'instantaneas', put: inst });
    // Se guardan dos instantáneas: la vigente y la anterior.
    if (espacio.instantaneaAnteriorId) ops.push({ almacen: 'instantaneas', del: espacio.instantaneaAnteriorId });
    espacio.instantaneaAnteriorId = espacio.instantaneaId;
    espacio.instantaneaId = inst.id;
    bytes += P.json.texto.length * 2;
    registro.archivos.push(P.json.nombreArchivo);
    registro.datos = { sesionesFuerza: P.json.resumen.sesionesFuerza, ultimoRegistro: P.json.resumen.ultimoRegistro,
                       nuevas: P.comp ? P.comp.nuevas : null, faltan: P.comp ? P.comp.faltan : null,
                       retroceso: !!(P.comp && P.comp.retroceso) };
  }

  const plan = planFotos(P);
  if (plan && plan.aGuardar.length){
    for (const it of plan.aGuardar){
      const k = P.zip.candidatas.find(x => x.nombre === it.nombre);
      ops.push({ almacen: 'fotos', put: {
        espacioId: espacio.id, archivo: it.nombre, sha256: k.sha256, bytes: k.bytes, tipo: k.tipo,
        ancho: k.ancho, alto: k.alto, importadoEn: ahora, zip: P.zip.nombreArchivo,
        metaZip: it.metaZip ? { fecha: it.metaZip.fecha, pose: it.metaZip.pose, pesoKg: it.metaZip.pesoKg } : null,
        fueraDeCopiaAlImportar: it.estado === 'fueraDeCopia' } });
      ops.push({ almacen: 'imagenes', put: { espacioId: espacio.id, archivo: it.nombre, blob: k.blob } });
      ops.push({ almacen: 'miniaturas', put: { espacioId: espacio.id, archivo: it.nombre, blob: k.mini } });
      bytes += k.blob.size + k.mini.size;
    }
  }
  if (P.zip && !P.zip.error){
    registro.archivos.push(P.zip.nombreArchivo);
    registro.fotos = { guardadas: plan ? plan.aGuardar.length : 0, ...(plan ? plan.cuentas : {}) };
    if (P.zip.indiceRaw){
      espacio.indiceZip = P.zip.indiceRaw;
      espacio.indiceZipArchivo = P.zip.nombreArchivo;
      espacio.indiceZipImportado = ahora;
    }
  }
  ops.push({ almacen: 'espacios', put: espacio });
  ops.push({ almacen: 'meta', put: { clave: 'espacioActivo', valor: espacio.id } });
  ops.push({ almacen: 'importaciones', put: registro });

  modalProgreso('Guardando…', 1);
  try {
    if (Almacen.modo === 'persistente' && (await Almacen.cabe(bytes)) === false)
      throw Object.assign(new Error('No hay espacio suficiente en este navegador.'), { name: 'QuotaExceededError' });
    await Almacen.escribir(ops);
  } catch (e) {
    E.ocupado = false;
    const cuota = Almacen.esErrorCuota(e);
    modalMensaje(cuota ? 'No hay espacio suficiente' : 'No se pudo guardar',
      `<p>${cuota ? 'El navegador no tiene sitio para guardar esta importación.' : esc(e && e.message ? e.message : String(e))}</p>
       <p><b>No se ha guardado nada</b>: tus datos anteriores siguen como estaban.</p>
       ${cuota ? '<p class="muted" style="font-size:13px">Puedes liberar espacio borrando otro espacio personal desde «Mis datos», o importar solo la copia de datos sin las fotos.</p>' : ''}`);
    return;
  }
  E.P = null;
  E.ocupado = false;
  if (E.canal) E.canal.postMessage({ tipo: 'cambio' });
  await cargarEstado();
  irA('datos', { foco: false });
  const piezas = [];
  if (registro.datos) piezas.push('datos de entrenamiento actualizados');
  if (registro.fotos && registro.fotos.guardadas) piezas.push(plural(registro.fotos.guardadas, 'foto guardada', 'fotos guardadas'));
  modalMensaje('Importación completada', `<p>${esc(piezas.join(' y ') || 'Hecho')}${nuevo ? ` en el espacio «${esc(espacio.nombre)}»` : ''}.</p>
    <p class="muted" style="font-size:13px">Recuerda conservar tus archivos originales: este navegador no es una copia de seguridad.</p>`);
  anunciar('Importación completada');
}

// ---------- Mis datos ----------
function renderDatos(){
  if (!E.espacio) return renderBienvenida();
  const out = ['<div class="cabecera-seccion"><h1>Mis datos</h1></div>'];
  out.push(`<div class="grid cols2" style="align-items:start">${tarjetaDatos()}${tarjetaAlmacen()}</div>`);
  out.push(tarjetaFotos('resumen'));
  out.push(tarjetaHistorial());
  return out.join('');
}

function renderBienvenida(){
  return `<section class="bienvenida">
    <h1>Tu entrenamiento, en grande</h1>
    <p>Consulta en el ordenador tu evolución en TrueLift: entrenamientos, ejercicios, peso, medidas y fotos.
       Tus archivos se leen y se guardan solo en este navegador.</p>
    <ol class="pasos">
      <li>En la app, ve a <b>Ajustes → Copia de seguridad</b> y exporta tu <b>copia de seguridad</b> (archivo <code>.json</code>).</li>
      <li>Si quieres ver tus fotos de progreso, exporta también las <b>fotos</b> (archivo <code>.zip</code>). Es opcional.</li>
      <li>Pasa los archivos al ordenador e impórtalos aquí, juntos o por separado.</li>
    </ol>
    <div class="fila-botones">
      <button class="btn pri" type="button" data-accion="importar-datos">Importar datos de TrueLift</button>
      <button class="btn sec" type="button" data-accion="importar-fotos">Importar fotos de TrueLift</button>
    </div>
    <p class="muted" style="font-size:13px;margin-top:12px">También puedes arrastrar los archivos a esta ventana.</p>
  </section>`;
}

function tarjetaDatos(){
  const inst = E.inst;
  if (!inst) return `<div class="card"><h2>Datos de entrenamiento</h2>
    <p>Aún no has importado tu copia de datos en este espacio.</p>
    <div class="fila-botones"><button class="btn pri" type="button" data-accion="importar-datos">Importar datos de TrueLift</button></div></div>`;
  if (E.rawError) return `<div class="card"><h2>Datos de entrenamiento</h2>
    <div class="alerta rojo"><span class="tag">Error</span><span>${esc(E.rawError)}</span></div>
    ${E.espacio.instantaneaAnteriorId ? '<button class="btn sec" type="button" data-accion="volver-anterior">Volver a la copia anterior</button>' : ''}</div>`;
  const r = inst.resumen;
  const antig = hace(r.ultimoRegistro);
  return `<div class="card"><h2>Datos de entrenamiento</h2>
    <div class="kv"><span>Archivo</span><b class="mono-peq">${esc(inst.nombreArchivo || '—')}</b></div>
    <div class="kv"><span>Importado</span><b>${fmtMomento(inst.importadoEn)}</b></div>
    <div class="kv"><span>Periodo</span><b>${fmtDia(r.primerRegistro)} — ${fmtDia(r.ultimoRegistro)}</b></div>
    <div class="kv"><span>Último entrenamiento</span><b>${fmtDia(r.ultimoEntreno)}</b></div>
    <div class="kv"><span>Último registro</span><b>${fmtDia(r.ultimoRegistro)}${antig ? ` <span class="muted">(${antig})</span>` : ''}</b></div>
    <div class="cifras">
      ${cifra(r.sesionesFuerza, 'sesiones de fuerza')}
      ${cifra(r.sesionesCardio, 'sesiones de cardio')}
      ${cifra(r.pesajes, 'pesajes')}
      ${cifra(r.fechasMedidas, 'días con medidas')}
    </div>
    <p class="muted" style="font-size:12.5px">La fecha de exportación no viaja en la copia: «último registro» es lo más reciente que contiene.${r.unidadPeso === 'lb' ? ' En el móvil usas libras; aquí los pesos se muestran en kg.' : ''}</p>
    <div class="fila-botones">
      <button class="btn sec" type="button" data-accion="importar-datos">Actualizar con una copia nueva</button>
      ${E.espacio.instantaneaAnteriorId ? '<button class="btn sec" type="button" data-accion="volver-anterior">Volver a la copia anterior</button>' : ''}
    </div></div>`;
}

function tarjetaAlmacen(){
  const e = E.estimacion || {};
  const temporal = Almacen.modo === 'temporal';
  return `<div class="card"><h2>Almacenamiento en este navegador</h2>
    ${temporal ? `<div class="alerta rojo"><span class="tag">Modo temporal</span><span>${esc(Almacen.motivoTemporal || '')} Lo que importes desaparecerá al cerrar la pestaña.</span></div>` : ''}
    <div class="kv"><span>Espacio usado</span><b>${fmtBytes(e.uso)}${e.cuota != null ? ` <span class="muted">de ${fmtBytes(e.cuota)}</span>` : ''}</b></div>
    <div class="kv"><span>Conservación</span><b>${temporal ? 'solo mientras la pestaña esté abierta'
      : E.persistido ? 'persistente' : 'el navegador podría liberarlo si se queda sin espacio'}</b></div>
    ${!temporal && E.persistido === false ? '<button class="btn sec" type="button" data-accion="persistir">Pedir conservación persistente</button>' : ''}
    <div class="kv"><span>Sin conexión</span><b>${{ listo: 'esta página ya se puede abrir sin conexión en este navegador',
      preparando: 'preparándose…', 'tras-recargar': 'disponible la próxima vez que abras la página', no: 'no disponible (abre la página desde la web, no como archivo)' }[E.sinConexion] || '—'}</b></div>
    <p class="muted" style="font-size:12.5px">Guardar aquí es cómodo, pero no es una copia de seguridad: borrar los datos del navegador lo elimina. Conserva tus archivos JSON y ZIP originales.</p>
    <div class="mod-fila"><label for="selEspacio">Espacio personal</label>
      <select id="selEspacio">${E.espacios.map(s => `<option value="${esc(s.id)}" ${s.id === E.espacio.id ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>
      <button class="btn sec" type="button" data-accion="renombrar">Renombrar</button></div>
    <div class="fila-botones">
      <button class="btn peligro" type="button" data-accion="borrar-espacio">Borrar este espacio</button>
      <button class="btn peligro" type="button" data-accion="borrar-todo">Borrar todos los datos del escritorio</button>
    </div></div>`;
}

/* modo 'galeria' (Evolución física): todas las fotos por fecha.
   modo 'resumen' (Mis datos): recuentos y solo las fotos con alguna
   incidencia (sin imagen, deducidas del nombre, fuera de la copia). */
function tarjetaFotos(modo = 'galeria'){
  const g = E.galeria;
  const con = g.filter(f => f.tieneImagen).length;
  const pend = g.length - con;
  const nombre = g.filter(f => f.tieneImagen && f.fuente === 'nombre').length;
  const fuera = g.filter(f => f.fueraDeCopia).length;
  const disc = g.filter(f => f.discrepancia).length;
  if (!g.length){
    return `<div class="card"><h2>Fotos de progreso</h2>
      <p>${E.indiceJson ? 'Tu copia de datos no tiene fotos registradas.' : 'No hay fotos en este espacio.'}
      Puedes importar el ZIP que exporta la app desde Ajustes → Copia de seguridad → Exportar fotos.</p>
      <div class="fila-botones"><button class="btn sec" type="button" data-accion="importar-fotos">Importar fotos de TrueLift</button></div></div>`;
  }
  const filtradas = modo === 'resumen' ? g.filter(f => !f.tieneImagen || f.fuente === 'nombre' || f.fueraDeCopia) : g.filter(f => E.fis.galeriaPose === 'todas' || f.pose === E.fis.galeriaPose);
  const porPagina = 48, paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  E.fis.pagina = Math.min(E.fis.pagina, paginas - 1);
  const visibles = modo === 'resumen' ? filtradas : filtradas.slice().reverse().slice(E.fis.pagina * porPagina, (E.fis.pagina + 1) * porPagina);
  const porDia = new Map();
  visibles.forEach(f => { if (!porDia.has(f.fecha)) porDia.set(f.fecha, []); porDia.get(f.fecha).push(f); });
  const dias = [...porDia.keys()].sort().reverse();
  return `<div class="card"><h2>Fotos de progreso</h2>
    <div class="cifras">
      ${cifra(con, 'con imagen')}
      ${pend ? cifra(pend, 'sin imagen importada', true) : ''}
      ${nombre ? cifra(nombre, 'fecha deducida del nombre', true) : ''}
      ${fuera ? cifra(fuera, 'no figuran en tu copia', true) : ''}
      ${disc ? cifra(disc, 'con otra ficha en el ZIP') : ''}
    </div>
    ${pend ? '<p class="muted" style="font-size:12.5px">Las fotos sin imagen están registradas en tu copia de datos, pero su archivo no se ha importado. Importa el ZIP de fotos para verlas; sus datos no se borran.</p>' : ''}
    <div class="fila-botones"><button class="btn sec" type="button" data-accion="importar-fotos">Importar fotos de TrueLift</button>
      ${modo === 'resumen' ? '<button class="btn sec" type="button" data-ir="fisica">Ver la galería</button>' : ''}</div>
    ${modo === 'galeria' ? `<div class="foto-filtro"><label for="galeriaPose">Filtrar galería por pose <select id="galeriaPose">${[['todas', 'Todas'], ...Object.entries(POSE_TXT)].map(([k, txt]) => `<option value="${k}"${E.fis.galeriaPose === k ? ' selected' : ''}>${txt}</option>`).join('')}</select></label><span>${filtradas.length} fotos · Página ${E.fis.pagina + 1} de ${paginas}</span><button class="btn sec" type="button" data-pagina-fotos="-1"${E.fis.pagina === 0 ? ' disabled' : ''}>Anterior</button><button class="btn sec" type="button" data-pagina-fotos="1"${E.fis.pagina >= paginas - 1 ? ' disabled' : ''}>Siguiente</button></div>${filtradas.length ? '' : '<p class="muted">No hay fotos de esta pose.</p>'}` : ''}
    ${modo === 'resumen' && visibles.length ? '<h3 class="sub-h">Fotos que conviene revisar</h3>' : ''}
    ${dias.map(d => `<section class="galeria-dia"><h3>${fmtDia(d)}</h3><div class="galeria">
      ${porDia.get(d).map(fotoHtml).join('')}</div></section>`).join('')}
  </div>`;
}

function fotoHtml(f){
  const pose = POSE_TXT[f.pose] || f.pose;
  const chips = [];
  if (!f.tieneImagen) chips.push('<span class="chip gris">Falta la imagen</span>');
  if (f.fuente && FUENTE_TXT[f.fuente]) chips.push(`<span class="chip ambar" title="${esc(FUENTE_TXT[f.fuente])}">${f.fuente === 'nombre' ? 'Deducida del nombre' : 'Índice del ZIP'}</span>`);
  if (f.fueraDeCopia) chips.push('<span class="chip ambar">No figura en tu copia</span>');
  const peso = f.pesoKg != null ? ` · ${fmtNum(f.pesoKg)} kg` : '';
  const alt = `${pose}, ${fmtDia(f.fecha)}`;
  if (!f.tieneImagen){
    return `<figure class="foto"><div class="marco"><div class="hueco">Imagen no importada</div></div>
      <figcaption><b>${esc(pose)}</b><span class="muted">${esc(peso.replace(' · ', ''))}</span>${chips.join('')}</figcaption></figure>`;
  }
  return `<figure class="foto"><button type="button" data-ver="${esc(f.archivo)}" aria-label="Ver foto: ${esc(alt)}">
    <div class="marco"><img data-mini="${esc(f.archivo)}" alt="${esc(alt)}"></div></button>
    <figcaption><b>${esc(pose)}</b><span class="muted">${esc(peso.replace(' · ', ''))}</span>${chips.join('')}</figcaption></figure>`;
}

function tarjetaHistorial(){
  if (!E.importaciones.length) return '';
  const fila = r => {
    const que = [];
    if (r.datos) que.push(`datos (${plural(r.datos.sesionesFuerza, 'sesión', 'sesiones')}${r.datos.nuevas != null ? `, +${r.datos.nuevas} nuevas` : ''}${r.datos.retroceso ? ', copia más antigua' : ''})`);
    if (r.fotos) que.push(`fotos (${r.fotos.guardadas} guardadas${r.fotos.duplicada ? `, ${r.fotos.duplicada} ya estaban` : ''})`);
    if (r.restaurada) que.push('vuelta a la copia anterior');
    return `<tr><td class="num">${fmtMomento(r.fecha)}</td><td>${esc(que.join(' · ') || '—')}</td><td class="mono-peq">${(r.archivos || []).map(esc).join('<br>')}</td></tr>`;
  };
  return `<div class="card"><h2>Historial de importaciones</h2><div class="tabla-scroll"><table>
    <thead><tr><th>Fecha</th><th>Qué se importó</th><th>Archivos</th></tr></thead>
    <tbody>${E.importaciones.slice(0, 20).map(fila).join('')}</tbody></table></div></div>`;
}

function fisicaFotosHtml(){
  return FisicaVista.comparador(E.galeria, E.fisica, E.raw, E.fis) + tarjetaFotos('galeria');
}
function actualizarOutput(i){
  const out = document.querySelector(`output[for="${i.id}"]`);
  if (out) out.textContent = i.value;
}
function aplicarEncuadres(){
  $$('[data-original]').forEach(m => {
    const enc = Evolucion.encuadre(E.fis.encuadres[m.dataset.original]);
    const img = m.querySelector('img');
    if (img) img.style.transform = `translate(${enc.x}%, ${enc.y}%) scale(${enc.zoom})`;
  });
}
function activarOriginales(){
  const espacioId = E.espacio?.id;
  $$('[data-original]').forEach(async marco => {
    try {
      const archivo = marco.dataset.original;
      const reg = await Almacen.leer('imagenes', [espacioId, archivo]);
      if (!document.contains(marco) || E.espacio?.id !== espacioId) return;
      if (!reg){ marco.textContent = 'Imagen no disponible. Importa de nuevo el ZIP.'; return; }
      const url = URL.createObjectURL(reg.blob); E.urls.add(url);
      const img = document.createElement('img');
      const f = E.galeria.find(f => f.archivo === archivo);
      img.alt = `${POSE_TXT[f.pose]}, ${fmtDia(f.fecha)}, foto ${marco.dataset.lado.toUpperCase()}`;
      img.onload = () => { if (document.contains(marco)){ marco.replaceChildren(img); aplicarEncuadres(); } };
      img.onerror = () => { if (document.contains(marco)) marco.textContent = 'Imagen ilegible. Importa de nuevo el ZIP.'; URL.revokeObjectURL(url); E.urls.delete(url); };
      img.src = url;
    } catch (_) { if (document.contains(marco)) marco.textContent = 'No se pudo cargar. Vuelve a seleccionar la foto o importa el ZIP.'; }
  });
}

// ---------- miniaturas con carga diferida ----------
function liberarUrls(){
  E.urls.forEach(u => URL.revokeObjectURL(u));
  E.urls.clear();
  if (E.obs){ E.obs.disconnect(); E.obs = null; }
}
function activarMiniaturas(){
  const imgs = $$('img[data-mini]');
  if (!imgs.length) return;
  const cargar = async img => {
    const archivo = img.dataset.mini;
    const espacioId = E.espacio && E.espacio.id;
    const reg = await Almacen.leer('miniaturas', [espacioId, archivo]);
    if (!reg || !document.contains(img)) return;
    const url = URL.createObjectURL(reg.blob);
    E.urls.add(url);
    img.src = url;
  };
  if (typeof IntersectionObserver === 'undefined'){ imgs.forEach(cargar); return; }
  E.obs = new IntersectionObserver(ents => ents.forEach(en => {
    if (!en.isIntersecting) return;
    E.obs.unobserve(en.target);
    cargar(en.target);
  }), { rootMargin: '300px' });
  imgs.forEach(i => E.obs.observe(i));
}

async function verFoto(archivo){
  const f = E.galeria.find(x => x.archivo === archivo);
  const reg = await Almacen.leer('imagenes', [E.espacio.id, archivo]);
  if (!f || !reg) return;
  if (E.urlModal) URL.revokeObjectURL(E.urlModal);
  E.urlModal = URL.createObjectURL(reg.blob);
  const pose = POSE_TXT[f.pose] || f.pose;
  abrirModal(`<h2 id="modalTitulo">${esc(pose)} · ${fmtDia(f.fecha)}</h2>
    <img class="foto-grande" src="${E.urlModal}" alt="${esc(`${pose}, ${fmtDia(f.fecha)}`)}">
    <p class="muted mono-peq" style="margin-top:8px">${esc(archivo)}${f.pesoKg != null ? ` · ${fmtNum(f.pesoKg)} kg` : ''}</p>
    ${FisicaVista.contexto(f, E.fisica, E.raw)}
    ${E.fisica.sitios.length ? FisicaVista.asociaciones(f, f, E.fisica) : ''}
    ${f.discrepancia ? `<p class="muted" style="font-size:12.5px">El índice del ZIP la fechaba el ${fmtDia(f.discrepancia.zip.fecha)} (${esc(POSE_TXT[f.discrepancia.zip.pose] || '')}); se usa la ficha corregida de tu copia de datos.</p>` : ''}
    ${f.fuente === 'nombre' ? '<p class="muted" style="font-size:12.5px">Fecha y pose deducidas del nombre del archivo: ningún índice la describe.</p>' : ''}
    <div class="mod-acciones"><button class="btn pri" type="button" data-accion="cerrar" autofocus>Cerrar</button></div>`, { ancho: true });
}

// ---------- acciones de «Mis datos» ----------
async function volverAnterior(){
  const esp = E.espacio;
  if (!esp || !esp.instantaneaAnteriorId) return;
  const ant = await Almacen.leer('instantaneas', esp.instantaneaAnteriorId);
  if (!ant) return;
  abrirModal(`<h2 id="modalTitulo">Volver a la copia anterior</h2>
    <p>Se usará <code>${esc(ant.nombreArchivo || '')}</code>, importada el ${fmtMomento(ant.importadoEn)} (último registro: ${fmtDia(ant.resumen && ant.resumen.ultimoRegistro)}).</p>
    <p class="muted" style="font-size:13px">La copia actual pasa a ser la anterior, así que puedes deshacerlo. Tus fotos no cambian.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-accion="confirmar-anterior" autofocus>Volver a la anterior</button></div>`);
}
async function confirmarAnterior(){
  const esp = { ...E.espacio };
  [esp.instantaneaId, esp.instantaneaAnteriorId] = [esp.instantaneaAnteriorId, esp.instantaneaId];
  await guardarSimple([{ almacen: 'espacios', put: esp },
    { almacen: 'importaciones', put: { espacioId: esp.id, fecha: new Date().toISOString(), restaurada: true, archivos: [] } }],
    'Has vuelto a la copia anterior.');
}

async function guardarSimple(ops, ok){
  try { await Almacen.escribir(ops); }
  catch (e) { modalMensaje('No se pudo guardar', `<p>${esc(e.message || String(e))}</p><p>No se ha cambiado nada.</p>`); return false; }
  if (E.canal) E.canal.postMessage({ tipo: 'cambio' });
  await cargarEstado();
  cerrarModal();
  render();
  if (ok) anunciar(ok);
  return true;
}

function pedirBorrarEspacio(){
  const r = E.inst ? E.inst.resumen : null;
  abrirModal(`<h2 id="modalTitulo">Borrar «${esc(E.espacio.nombre)}»</h2>
    <p>Se borrarán de este navegador su copia de datos${r ? ` (${plural(r.sesionesFuerza, 'sesión', 'sesiones')})` : ''}, sus ${plural(E.fotosMeta.length, 'foto', 'fotos')} y su historial de importaciones.</p>
    <p>Tus archivos JSON y ZIP originales no se tocan: podrás volver a importarlos.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar" autofocus>Cancelar</button>
      <button class="btn peligro" type="button" data-accion="confirmar-borrar-espacio">Borrar espacio</button></div>`);
}
async function borrarEspacio(){
  const id = E.espacio.id;
  const resto = E.espacios.filter(s => s.id !== id);
  const ops = Almacen.opsBorrarEspacio(id);
  ops.push({ almacen: 'meta', del: `periodos:${id}` });
  ops.push(resto.length ? { almacen: 'meta', put: { clave: 'espacioActivo', valor: resto[0].id } }
                        : { almacen: 'meta', del: 'espacioActivo' });
  liberarUrls();
  await guardarSimple(ops, 'Espacio borrado.');
}
function pedirBorrarTodo(){
  abrirModal(`<h2 id="modalTitulo">Borrar todos los datos del escritorio</h2>
    <p>Se borrarán de este navegador todos los espacios personales, sus copias, fotos e historial.</p>
    <p>No afecta a la app del móvil, a tus archivos originales ni a la herramienta TrueLift Coach.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar" autofocus>Cancelar</button>
      <button class="btn peligro" type="button" data-accion="confirmar-borrar-todo">Borrar todo</button></div>`);
}
async function borrarTodo(){
  liberarUrls();
  try { await Almacen.borrarTodo(); }
  catch (e) { modalMensaje('No se pudo borrar', `<p>${esc(e.message || String(e))}</p>`); return; }
  await Almacen.abrir();
  if (E.canal) E.canal.postMessage({ tipo: 'cambio' });
  await cargarEstado();
  cerrarModal();
  render();
  anunciar('Datos borrados');
}
function pedirRenombrar(){
  abrirModal(`<h2 id="modalTitulo">Renombrar espacio</h2>
    <div class="mod-fila"><label for="nuevoNombre">Nombre</label><input type="text" id="nuevoNombre" maxlength="60" value="${esc(E.espacio.nombre)}" autofocus></div>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-accion="confirmar-renombrar">Guardar</button></div>`);
}

// ---------- render ----------
/* Destino «seccion[:apartado]». La sección y el apartado viajan en el
   hash (#entrenamiento/ejercicios/Press%20banca) para que Atrás y Adelante
   del navegador funcionen y una recarga vuelva al mismo sitio. */
function irA(destino, { foco = true, historial = true } = {}){
  // Solo los dos primeros separadores parten: el nombre de un ejercicio
  // puede llevar «:» o «/».
  const m = String(destino || '').match(/^([^:/]*)(?:[:/]([^:/]*)(?:[:/](.*))?)?$/) || [];
  const [sec, sub] = [m[1], m[2]];
  const resto = m[3] != null && m[3] !== '' ? [m[3]] : [];
  if (!SECCIONES[sec]) return;
  const cambiaSec = sec !== E.seccion;
  if (cambiaSec || sub !== E.st.sub) E.st.verTodas = false;
  E.st.sub = sub || null;
  const ejercicio = resto.length ? (() => { try { return decodeURIComponent(resto[0]); } catch (_) { return resto[0]; } })() : null;
  // Las sesiones elegidas para comparar son de un ejercicio concreto.
  if (ejercicio !== E.st.ejercicio){ E.st.compA = null; E.st.compB = null; }
  E.st.ejercicio = ejercicio;
  if (historial){
    const h = '#' + [sec, sub, E.st.ejercicio && encodeURIComponent(E.st.ejercicio)].filter(Boolean).join('/');
    if (location.hash !== h) history.pushState(null, '', h);
  }
  setSeccion(sec, foco);
}

function setSeccion(s, foco = true){
  E.seccion = s;
  $$('#tabs button').forEach(b => {
    const activa = b.dataset.seccion === s;
    b.classList.toggle('activa', activa);
    if (activa) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  render();
  document.title = `${SECCIONES[s]} · TrueLift Escritorio`;
  if (foco) $('#contenido').focus({ preventScroll: true });
}

function render(){
  liberarUrls();
  $('#espacioActual').textContent = E.espacio && E.espacios.length > 1 ? E.espacio.nombre : '';
  const aviso = [];
  if (Almacen.modo === 'temporal')
    aviso.push(`<div class="alerta rojo"><span class="tag">Modo temporal</span><span>No se puede guardar en este navegador: lo que importes se perderá al cerrar la pestaña.</span></div>`);
  $('#avisoGlobal').innerHTML = aviso.join('');
  const cont = $('#contenido');
  if (E.seccion === 'datos' || !E.espacio){
    cont.innerHTML = renderDatos();
    activarMiniaturas();
    return;
  }
  cont.innerHTML = renderSeccion();
  activarMiniaturas();
  activarOriginales();
  activarFotosInforme();
  marcarDesplazables();
  rutRestaurarFoco();
}

/* Una tabla más ancha que su caja se desplaza con el teclado: su caja recibe
   el foco y se anuncia como región con el nombre de la tabla. Solo las que
   desbordan, para no añadir paradas de tabulación inútiles. */
function marcarDesplazables(){
  $$('.tabla-scroll').forEach(c => {
    const desborda = c.scrollWidth > c.clientWidth + 1;
    if (desborda && !c.hasAttribute('tabindex')){
      c.setAttribute('tabindex', '0'); c.setAttribute('role', 'region');
      c.setAttribute('aria-label', `${c.querySelector('caption')?.textContent || 'Tabla'} (desplazable)`);
    } else if (!desborda && c.getAttribute('role') === 'region'){
      c.removeAttribute('tabindex'); c.removeAttribute('role'); c.removeAttribute('aria-label');
    }
  });
}

function sinCopiaHtml(){
  return `<section class="card"><h2>${esc(SECCIONES[E.seccion])}</h2>
    <p>${E.rawError || E.errorModelo
      ? `No se pudo leer tu copia de datos${E.errorModelo ? ` (${esc(E.errorModelo)})` : ''}. Revisa «Mis datos».`
      : 'Para ver esta sección importa tu copia de datos de TrueLift (el archivo <code>.json</code>). Las fotos solas no traen tus entrenamientos.'}</p>
    <div class="fila-botones"><button class="btn pri" type="button" data-accion="importar-datos">Importar datos de TrueLift</button>
      <button class="btn sec" type="button" data-ir="datos">Ir a Mis datos</button></div></section>`;
}

function renderSeccion(){
  const M = E.M;
  if (E.seccion === 'fisica' && !M){
    return `<div class="cabecera-seccion"><h1>Evolución física</h1></div>${sinCopiaHtml()}${fisicaFotosHtml()}${VistasEsc.contornos(E.fisica, E.fis)}`;
  }
  if (!M) return sinCopiaHtml();
  const ctx = { inst: E.inst, galeriaHtml: fisicaFotosHtml, fisica: E.fisica, fis: E.fis };
  switch (E.seccion){
    case 'resumen': return VistasEsc.resumen(M, ctx);
    case 'entrenamiento': return VistasEsc.entrenamiento(M, E.st);
    case 'fisica': return VistasEsc.fisica(M, ctx);
    case 'recuperacion': return VistasEsc.recuperacion(M);
    case 'rutina': return RutinaVista.html(rutCtx());
    case 'informes': return InformeVista.seccion(M, { sel: E.st.informe, error: E.inf.error, fisica: E.fisica, galeria: E.galeria, inst: E.inst, st: E.inf });
  }
  return '';
}

function verSesion(indice){
  const html = E.M && VistasEsc.detalleSesionHtml(E.M, indice);
  if (!html) return;
  abrirModal(`${html}<div class="mod-acciones"><button class="btn pri" type="button" data-accion="cerrar" autofocus>Cerrar</button></div>`, { ancho: true });
}

/* Tooltip de las gráficas (mismo comportamiento que en el Coach). */
function initTooltip(){
  const tip = document.createElement('div');
  tip.id = 'chartTip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  const ocultar = () => { tip.style.display = 'none'; };
  document.addEventListener('mousemove', ev => {
    const el = ev.target.closest ? ev.target.closest('[data-tt]') : null;
    if (!el){ if (tip.style.display === 'block') ocultar(); return; }
    tip.textContent = el.getAttribute('data-tt');
    tip.style.display = 'block';
    const m = 14, r = tip.getBoundingClientRect();
    let x = ev.clientX + m, y = ev.clientY + m;
    if (x + r.width > window.innerWidth) x = ev.clientX - m - r.width;
    if (y + r.height > window.innerHeight) y = ev.clientY - m - r.height;
    tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
  });
  document.addEventListener('mouseleave', ocultar);
}

// ---------- Mi rutina: borradores (fase 6) ----------
function borradorActivo(){
  return E.rut.borradores.find(b => b.id === E.rut.activoId) || E.rut.borradores[E.rut.borradores.length - 1] || null;
}
function pilaDe(id){
  if (!E.rut.pilas.has(id)) E.rut.pilas.set(id, { deshacer: [], rehacer: [] });
  return E.rut.pilas.get(id);
}
function rutCtx(){
  const b = borradorActivo();
  const p = b ? pilaDe(b.id) : { deshacer: [], rehacer: [] };
  return { M: E.M, raw: E.raw, rawExport: PL.rawConBiblioteca(E.raw, b), inst: E.inst, movil: PL.rutinaMovil(E.raw), borrador: b, borradores: E.rut.borradores,
           pila: { deshacer: p.deshacer.length, rehacer: p.rehacer.length }, error: E.rut.error };
}
const ahoraISO = () => new Date().toISOString();

/* Guarda (o borra) borradores en UNA transacción. Si falla, el estado en
   pantalla vuelve a lo último guardado y se dice. */
async function rutGuardar({ put = [], del = [], activo, foco = null, msg = null, hecho = null }){
  const ops = [...put.map(b => ({ almacen: 'borradores', put: b })), ...del.map(id => ({ almacen: 'borradores', del: id }))];
  if (activo !== undefined) ops.push({ almacen: 'meta', put: { clave: `borradorActivo:${E.espacio.id}`, valor: activo } });
  try { await Almacen.escribir(ops); }
  catch (e) {
    E.rut.error = Almacen.esErrorCuota(e)
      ? 'No hay espacio en el navegador para guardar el borrador. El último cambio no se ha guardado; lo anterior sigue intacto. Libera espacio (por ejemplo, borrando un espacio que no uses) y vuelve a intentarlo.'
      : `El último cambio no se ha guardado (${e && e.message ? e.message : e}); lo anterior sigue intacto.`;
    render(); $('.alerta[role="alert"]')?.scrollIntoView({ block: 'nearest' });
    anunciar('No se ha guardado el cambio');
    return false;
  }
  E.rut.error = null;
  const lista = E.rut.borradores.filter(b => !del.includes(b.id) && !put.some(p => p.id === b.id));
  E.rut.borradores = [...lista, ...put].sort((a, b) => a.creado < b.creado ? -1 : 1);
  if (activo !== undefined) E.rut.activoId = activo;
  if (hecho) hecho();
  if (E.canal) E.canal.postMessage({ tipo: 'cambio' });
  E.rut.foco = foco;
  render();
  if (msg) anunciar(msg);
  return true;
}

async function rutEditar(op, foco){
  const b = borradorActivo();
  if (!b) return;
  const r = PL.editar(b.rutina, op);
  if (!r) return;
  const p = pilaDe(b.id);
  await rutGuardar({ put: [{ ...b, rutina: r, actualizado: ahoraISO() }], foco,
    hecho: () => { p.deshacer.push(b.rutina); if (p.deshacer.length > PL.MAX_DESHACER) p.deshacer.shift(); p.rehacer = []; } });
}

async function rutCrear(b, msg){
  await rutGuardar({ put: [b], activo: b.id, foco: 'rutExportar', msg });
}

function nombreNuevo(base){
  const usados = new Set(E.rut.borradores.map(b => b.nombre));
  let n = base, i = 2;
  while (usados.has(n)) n = `${base} (${i++})`;
  return n;
}

async function rutAccion(nombre, el){
  const b = borradorActivo();
  const d = el ? Number(el.dataset.d) : NaN, f = el ? Number(el.dataset.f) : NaN;
  switch (nombre){
    case 'nuevo-movil': {
      const m = PL.rutinaMovil(E.raw);
      if (!m) return;
      if (!$('#modal').classList.contains('oculto')) cerrarModal();
      await rutCrear(PL.nuevoBorrador({ espacioId: E.espacio.id, nombre: nombreNuevo(`Desde el móvil (${VistasEsc.F.dia(E.inst?.resumen?.ultimoRegistro)})`),
        rutina: m.rutina, origen: { tipo: 'movil', firma: PL.firma(m.normal), normal: m.normal, rutina: m.rutina,
          instantaneaId: E.inst?.id || null, desde: E.inst?.resumen?.ultimoRegistro || null } }), 'Borrador creado desde la rutina del móvil');
      return;
    }
    case 'nuevo-blanco':
      await rutCrear(PL.nuevoBorrador({ espacioId: E.espacio.id, nombre: nombreNuevo('Rutina nueva'), rutina: PL.rutinaVacia(), origen: { tipo: 'blanco' } }), 'Borrador en blanco creado');
      return;
    case 'abrir-excel': $('#rutExcel')?.click(); return;
    case 'duplicar':
      if (b) await rutCrear(PL.nuevoBorrador({ espacioId: E.espacio.id, nombre: nombreNuevo(`${b.nombre} (copia)`), rutina: b.rutina,
        origen: { ...PL.clonar(b.origen) } }), 'Borrador duplicado');
      return;
    case 'renombrar':
      if (!b) return;
      abrirModal(`<h2 id="modalTitulo">Renombrar borrador</h2>
        <label for="rutNombre">Nombre</label><input id="rutNombre" type="text" maxlength="80" value="${esc(b.nombre)}" style="width:100%" autofocus>
        <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
          <button class="btn pri" type="button" data-rut-accion="renombrar-ok">Guardar</button></div>`);
      return;
    case 'renombrar-ok': {
      const v = ($('#rutNombre')?.value || '').trim();
      cerrarModal();
      if (b && v) await rutGuardar({ put: [{ ...b, nombre: v.slice(0, 80), actualizado: ahoraISO() }], foco: 'rutExportar', msg: 'Borrador renombrado' });
      return;
    }
    case 'eliminar':
      if (!b) return;
      abrirModal(`<h2 id="modalTitulo">Eliminar «${esc(b.nombre)}»</h2>
        <p>Se borra este borrador de este navegador. No afecta a tu móvil ni a los Excel que ya hayas exportado.</p>
        <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar" autofocus>Cancelar</button>
          <button class="btn peligro" type="button" data-rut-accion="eliminar-ok">Eliminar borrador</button></div>`);
      return;
    case 'eliminar-ok': {
      cerrarModal();
      if (!b) return;
      const resto = E.rut.borradores.filter(x => x.id !== b.id);
      if (await rutGuardar({ del: [b.id], activo: resto.length ? resto[resto.length - 1].id : null, msg: 'Borrador eliminado' })) E.rut.pilas.delete(b.id);
      return;
    }
    case 'deshacer': case 'rehacer': {
      if (!b) return;
      const p = pilaDe(b.id);
      const [de, a] = nombre === 'deshacer' ? [p.deshacer, p.rehacer] : [p.rehacer, p.deshacer];
      if (!de.length) return;
      const r = de[de.length - 1];
      await rutGuardar({ put: [{ ...b, rutina: r, actualizado: ahoraISO() }], foco: nombre === 'deshacer' ? 'rutDeshacer' : 'rutRehacer',
                         msg: nombre === 'deshacer' ? 'Cambio deshecho' : 'Cambio rehecho', hecho: () => { de.pop(); a.push(b.rutina); } });
      return;
    }
    case 'partida': {
      if (!b) return;
      const p = pilaDe(b.id);
      await rutGuardar({ put: [{ ...b, rutina: PL.clonar(b.origen.rutina), actualizado: ahoraISO() }], foco: 'rutDeshacer', msg: 'Recuperada la rutina de partida. Puedes deshacerlo.',
                         hecho: () => { p.deshacer.push(b.rutina); p.rehacer = []; } });
      return;
    }
    case 'rebasar': {
      const m = PL.rutinaMovil(E.raw);
      if (!b) return;
      const origen = m ? { tipo: 'movil', firma: PL.firma(m.normal), normal: m.normal, rutina: m.rutina, instantaneaId: E.inst?.id || null, desde: E.inst?.resumen?.ultimoRegistro || null }
                       : { ...b.origen, tipo: 'copia' };
      await rutGuardar({ put: [{ ...b, origen, actualizado: ahoraISO() }], foco: 'rutExportar', msg: 'Borrador conservado; ahora se compara con la rutina actual del móvil' });
      return;
    }
    case 'exportar': {
      if (!b) return;
      const av = PL.avisos(b.rutina, E.raw);
      if (av.bloquea){
        modalMensaje('Aún no se puede exportar', `<p>La app no podría leer este borrador:</p>${listaHtml(av.avisos.filter(a => a.nivel === 'rojo').map(a => esc(a.txt)))}`);
        return;
      }
      abrirModal(RutinaVista.confirmarExportacion(rutCtx()), { ancho: true });
      return;
    }
    case 'exportar-confirmar': await rutExportar(); return;
    case 'fila-nueva': await rutEditar({ tipo: 'addFila', d }, `rut-${d}-${b ? b.rutina.dias[d].filas.length : 0}-ejercicio`); return;
    case 'fila-arriba': await rutEditar({ tipo: 'moverFila', d, f, delta: -1 }, f - 1 > 0 ? `rut-${d}-${f - 1}-arriba` : `rut-${d}-${f - 1}-abajo`); return;
    case 'fila-abajo': {
      const ult = b ? b.rutina.dias[d].filas.length - 1 : 0;
      await rutEditar({ tipo: 'moverFila', d, f, delta: 1 }, f + 1 < ult ? `rut-${d}-${f + 1}-abajo` : `rut-${d}-${f + 1}-arriba`);
      return;
    }
    case 'fila-quitar': {
      const n = b ? b.rutina.dias[d].filas.length : 0;
      await rutEditar({ tipo: 'delFila', d, f }, n > 1 ? `rut-${d}-${Math.min(f, n - 2)}-ejercicio` : `rut-${d}-nueva`);
      anunciar('Ejercicio quitado. Puedes deshacerlo.');
      return;
    }
    case 'dia-nuevo': await rutEditar({ tipo: 'addDia' }, `rut-${b ? b.rutina.dias.length : 0}-nombre`); return;
    case 'dia-antes': await rutEditar({ tipo: 'moverDia', d, delta: -1 }, `rut-${d - 1}-nombre`); return;
    case 'dia-despues': await rutEditar({ tipo: 'moverDia', d, delta: 1 }, `rut-${d + 1}-nombre`); return;
    case 'dia-quitar': await rutEditar({ tipo: 'delDia', d }, `rut-${Math.max(0, d - 1)}-nombre`); anunciar('Día quitado. Puedes deshacerlo.'); return;
  }
}

async function rutCambio(el){
  const b = borradorActivo();
  const tipo = el.dataset.rut;
  if (el.id === 'rutExcel'){
    const file = el.files && el.files[0];
    el.value = '';
    if (file) await rutAbrirExcel(file);
    return;
  }
  if (tipo === 'borrador'){
    await rutGuardar({ activo: el.value, foco: 'rutSelBorrador', msg: 'Borrador cambiado' });
    return;
  }
  if (!b) return;
  if (tipo === 'sistema') await rutEditar({ tipo: 'sistema', valor: el.value }, 'rutSistema');
  else if (tipo === 'nombreDia') await rutEditar({ tipo: 'nombreDia', d: Number(el.dataset.d), valor: el.value }, el.id);
  else if (tipo === 'campo'){
    const valor = el.type === 'checkbox' ? el.checked : el.value;
    await rutEditar({ tipo: 'campo', d: Number(el.dataset.d), f: Number(el.dataset.f), k: el.dataset.k, valor }, el.id);
  }
}

const MAX_EXCEL = 5 * 1024 * 1024;
async function rutAbrirExcel(file){
  if (file.size > MAX_EXCEL){ modalMensaje('Archivo demasiado grande', '<p>Un Excel de rutina de TrueLift ocupa unos pocos KB. Elige el archivo que exporta la app o este escritorio.</p>'); return; }
  let rutina;
  try { rutina = await XLSX.leerRutina(await file.arrayBuffer()); }
  catch (e) { modalMensaje('No se pudo leer el Excel', `<p>${esc(e.message || String(e))}</p><p>Usa un Excel de rutina exportado por la app o por este escritorio.</p>`); return; }
  const nombre = file.name.replace(/\.xlsx$/i, '').slice(0, 80) || 'Rutina de Excel';
  const b = PL.nuevoBorrador({ espacioId: E.espacio.id, nombre: nombreNuevo(nombre), rutina, origen: { tipo: 'excel', archivo: file.name } });
  // Ejercicios propios que trae el archivo (bloque de biblioteca de la app):
  // se guardan con el borrador para volver a exportarlos con sus datos.
  if (Array.isArray(rutina.biblioteca) && rutina.biblioteca.length) b.bibliotecaExcel = rutina.biblioteca;
  await rutCrear(b, `Borrador creado desde ${file.name}`);
}

async function rutExportar(){
  const b = borradorActivo();
  if (!b) return;
  const raw = PL.rawConBiblioteca(E.raw, b);
  const sim = PL.comoLaApp(b.rutina, raw);
  let bytes;
  try { bytes = await XLSX.escribirRutina(sim.exportable); }
  catch (e) { cerrarModal(); modalMensaje('No se pudo generar el Excel', `<p>${esc(e.message || String(e))}</p>`); return; }
  const archivo = PL.nombreArchivo(b);
  const exp = { fecha: ahoraISO(), archivo, firma: PL.firma(sim.normal), bytes: bytes.length, dias: sim.dias.length, sistema: sim.sistema };
  cerrarModal();
  const guardado = await rutGuardar({ put: [{ ...b, exportaciones: [...b.exportaciones, exp].slice(-20) }], foco: 'rutExportar' });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = archivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  anunciar(guardado ? `Excel descargado: ${archivo}. Tu móvil no cambia hasta que lo importes allí.` : `Excel descargado: ${archivo}, pero no se pudo anotar la exportación.`);
}

/* Tras pintar Mi rutina, el foco vuelve al control equivalente. */
function rutRestaurarFoco(){
  const id = E.rut.foco;
  E.rut.foco = null;
  if (!id || E.seccion !== 'rutina') return;
  const el = document.getElementById(id);
  if (el && !el.disabled) el.focus({ preventScroll: false });
}

// ---------- Informes (fase 7) ----------
/* Fotos elegidas para el informe: originales (calidad de impresión), con
   sus object URLs registradas para liberarlas al cambiar de vista. */
function activarFotosInforme(){
  const espacioId = E.espacio?.id;
  $$('[data-inf-foto]').forEach(async marco => {
    const fin = estado => { marco.dataset.estado = estado; };
    try {
      const archivo = marco.dataset.infFoto;
      const reg = await Almacen.leer('imagenes', [espacioId, archivo]);
      if (!document.contains(marco) || E.espacio?.id !== espacioId) return;
      if (!reg){ marco.textContent = 'Imagen no disponible'; fin('error'); return; }
      const url = URL.createObjectURL(reg.blob); E.urls.add(url);
      const f = E.galeria.find(x => x.archivo === archivo);
      const img = document.createElement('img');
      img.alt = f ? `${POSE_TXT[f.pose] || f.pose}, ${fmtDia(f.fecha)}` : archivo;
      img.onload = () => { if (document.contains(marco)){ marco.replaceChildren(img); fin('lista'); } };
      img.onerror = () => { if (document.contains(marco)){ marco.textContent = 'Imagen ilegible'; fin('error'); } };
      img.src = url;
    } catch (_) { if (document.contains(marco)){ marco.textContent = 'No se pudo cargar'; fin('error'); } }
  });
}

function selInformeDe(form){
  const d = new FormData(form);
  return d.get('tipo') === 'fechas' ? { tipo: 'fechas', desde: d.get('desde') || '', hasta: d.get('hasta') || '' }
    : { tipo: 'mes', mes: d.get('mes') || '' };
}

async function verInforme(form){
  const sel = selInformeDe(form);
  try { Informe.rango(sel); }
  catch (e) { E.inf.error = e.message; E.inf.borrador = sel; render(); $('#formInforme button[type="submit"]')?.focus(); return; }
  E.inf.error = null; E.inf.borrador = null;
  if (await guardarSimple([{ almacen: 'meta', put: { clave: `informe:${E.espacio.id}`, valor: sel } }], 'Informe actualizado')){
    const t = $('#informeTitulo');
    if (t){ t.setAttribute('tabindex', '-1'); t.focus(); }
  }
}

async function imprimirInforme(){
  const doc = $('.informe-doc');
  if (!doc) return;
  // Las fotos elegidas deben estar cargadas antes de abrir la impresión.
  const t0 = Date.now();
  while ([...doc.querySelectorAll('[data-inf-foto]')].some(m => !m.dataset.estado) && Date.now() - t0 < 8000)
    await new Promise(ok => setTimeout(ok, 50));
  let r = null;
  try { r = Informe.rango(E.st.informe || Informe.defecto(E.M)); } catch (_) { /* título por defecto */ }
  const titulo = document.title;
  // El título es el nombre que propone el navegador al guardar en PDF.
  if (r) document.title = r.tipo === 'mes' ? `Informe TrueLift ${fmtISO(r.desde).slice(0, 7)}` : `Informe TrueLift ${fmtISO(r.desde)} a ${fmtISO(r.hasta)}`;
  const restaurar = () => { document.title = titulo; window.removeEventListener('afterprint', restaurar); };
  window.addEventListener('afterprint', restaurar);
  window.print();
}

async function compararConAnterior(){
  let r;
  try { r = Informe.rango(E.st.informe || Informe.defecto(E.M)); } catch (_) { return; }
  const a = Informe.anterior(r);
  const valor = { a: { desde: fmtISO(a.desde), hasta: fmtISO(a.hasta) }, b: { desde: fmtISO(r.desde), hasta: fmtISO(r.hasta) } };
  if (await guardarSimple([{ almacen: 'meta', put: { clave: `periodos:${E.espacio.id}`, valor } }], 'Periodos preparados para comparar'))
    irA('entrenamiento:comparar');
}

// ---------- eventos ----------
function trampaFoco(ev){
  const m = $('#modal');
  if (m.classList.contains('oculto')) return;
  const caja = $('#modalCaja');
  if (ev.key === 'Escape'){
    ev.preventDefault();
    if (caja.dataset.bloqueado === '1'){ if (E.abort) E.abort.abort(); return; }
    if (E.P){ E.P = null; }
    cerrarModal();
    return;
  }
  if (ev.key !== 'Tab') return;
  const f = [...caja.querySelectorAll('button:not([disabled]),input,select,textarea,a[href],summary,[tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const primero = f[0], ultimo = f[f.length - 1];
  if (ev.shiftKey && document.activeElement === primero){ ev.preventDefault(); ultimo.focus(); }
  else if (!ev.shiftKey && document.activeElement === ultimo){ ev.preventDefault(); primero.focus(); }
  else if (!caja.contains(document.activeElement)){ ev.preventDefault(); primero.focus(); }
}

async function accion(nombre, el){
  switch (nombre){
    case 'cerrar': cerrarModal(); break;
    case 'guardar-encuadres': {
      try {
        await Almacen.escribir([{ almacen: 'meta', put: { clave: `encuadres:${E.espacio.id}`, valor: E.fis.encuadres } }]);
        E.fis.dirty = false;
        $('#estadoEncuadres').textContent = Almacen.modo === 'temporal' ? 'Modo temporal: se perderán al cerrar' : 'Encuadres guardados';
        anunciar('Encuadres guardados');
      } catch (e) { modalMensaje('No se guardaron los encuadres', `<p>${esc(e.message || String(e))}. Las fotos originales siguen intactas.</p>`); }
      break;
    }
    case 'imprimir-informe': await imprimirInforme(); break;
    case 'informe-comparar': await compararConAnterior(); break;
    case 'importar-datos': $('#inputDatos').click(); break;
    case 'importar-fotos': $('#inputFotos').click(); break;
    case 'cancelar-proceso': if (E.abort) E.abort.abort(); break;
    case 'descartar': E.P = null; cerrarModal(); anunciar('Importación descartada; no se ha guardado nada'); break;
    case 'confirmar': await confirmarImportacion(); break;
    case 'volver-anterior': await volverAnterior(); break;
    case 'confirmar-anterior': await confirmarAnterior(); break;
    case 'borrar-espacio': pedirBorrarEspacio(); break;
    case 'confirmar-borrar-espacio': await borrarEspacio(); break;
    case 'borrar-todo': pedirBorrarTodo(); break;
    case 'confirmar-borrar-todo': await borrarTodo(); break;
    case 'renombrar': pedirRenombrar(); break;
    case 'confirmar-renombrar': {
      const v = ($('#nuevoNombre').value || '').trim();
      if (v) await guardarSimple([{ almacen: 'espacios', put: { ...E.espacio, nombre: v } }], 'Espacio renombrado.');
      break;
    }
    case 'persistir': {
      const ok = await Almacen.pedirPersistencia();
      E.persistido = await Almacen.persistido();
      render();
      anunciar(ok ? 'El navegador conservará estos datos.' : 'El navegador no ha concedido la conservación persistente.');
      break;
    }
  }
}

function init(){
  $$('#tabs button').forEach(b => b.addEventListener('click', () => irA(b.dataset.seccion)));
  $('#btnImportarDatos').addEventListener('click', () => $('#inputDatos').click());
  $('#btnImportarFotos').addEventListener('click', () => $('#inputFotos').click());
  // El selector de datos admite elegir la copia JSON y el ZIP a la vez.
  $('#inputDatos').setAttribute('accept', '.json,.zip,application/json,application/zip');
  ['#inputDatos', '#inputFotos'].forEach(s => $(s).addEventListener('change', ev => {
    const files = [...ev.target.files];
    ev.target.value = '';
    recibirArchivos(files);
  }));

  document.addEventListener('click', ev => {
    const ra = ev.target.closest('[data-rut-accion]');
    if (ra && !ra.disabled){ rutAccion(ra.dataset.rutAccion, ra); return; }
    const a = ev.target.closest('[data-accion]');
    if (a && !a.disabled){ accion(a.dataset.accion, a); return; }
    const ir = ev.target.closest('[data-ir]');
    if (ir){
      if (!$('#modal').classList.contains('oculto')) cerrarModal();
      irA(ir.dataset.ir); return;
    }
    const ses = ev.target.closest('[data-sesion]');
    if (ses){ verSesion(Number(ses.dataset.sesion)); return; }
    const ej = ev.target.closest('[data-ejercicio]');
    if (ej){
      if (!$('#modal').classList.contains('oculto')) cerrarModal();
      irA(`entrenamiento:ejercicios:${encodeURIComponent(ej.dataset.ejercicio)}`); return;
    }
    const av = ev.target.closest('[data-accion-vista]');
    if (av && av.dataset.accionVista === 'periodos-defecto'){
      if (E.M) guardarSimple([{ almacen: 'meta', put: { clave: `periodos:${E.espacio.id}`, valor: Comparacion.defecto(E.M) } }], 'Periodos restaurados');
      return;
    }
    if (av && av.dataset.accionVista === 'ver-todas'){ E.st.verTodas = true; render(); return; }
    const mf = ev.target.closest('[data-modo-foto]');
    if (mf){ E.fis.modo = mf.dataset.modoFoto; render(); $(`[data-modo-foto="${E.fis.modo}"]`)?.focus(); return; }
    const rest = ev.target.closest('[data-restaurar-foto]');
    if (rest){
      const archivo = rest.dataset.restaurarFoto; E.fis.encuadres[archivo] = Evolucion.encuadre(); E.fis.dirty = true;
      document.querySelectorAll('input[data-enc]').forEach(i => { if (i.dataset.archivo === archivo){ i.value = E.fis.encuadres[archivo][i.dataset.enc]; actualizarOutput(i); } });
      aplicarEncuadres(); $('#estadoEncuadres').textContent = 'Ajustes sin guardar'; return;
    }
    const pag = ev.target.closest('[data-pagina-fotos]');
    if (pag && !pag.disabled){ E.fis.pagina += Number(pag.dataset.paginaFotos); render(); $('#galeriaPose')?.focus(); return; }
    const ver = ev.target.closest('[data-ver]');
    if (ver){ verFoto(ver.dataset.ver); return; }
  });
  $('#modal').addEventListener('change', ev => {
    const P = E.P;
    if (!P) return;
    if (ev.target.name === 'destino'){ P.destino = ev.target.value; mostrarPrevia(); }
    else if (ev.target.dataset.op){ P.op[ev.target.dataset.op] = ev.target.checked; mostrarPrevia(); }
  });
  $('#modal').addEventListener('input', ev => {
    if (E.P && ev.target.id === 'nombreNuevo') E.P.nombreNuevo = ev.target.value;
  });
  // Buscador de ejercicios: se filtra al escribir sin perder el foco.
  $('#contenido').addEventListener('input', ev => {
    const i = ev.target;
    if (i.dataset.enc){
      const archivo = i.dataset.archivo;
      E.fis.encuadres[archivo] = Evolucion.encuadre({ ...Evolucion.encuadre(E.fis.encuadres[archivo]), [i.dataset.enc]: Number(i.value) });
      E.fis.dirty = true; aplicarEncuadres(); actualizarOutput(i); $('#estadoEncuadres').textContent = 'Ajustes sin guardar'; return;
    }
    if (i.id === 'fotoCorte' || i.id === 'fotoOpacidad'){
      E.fis[i.id === 'fotoCorte' ? 'corte' : 'opacidad'] = Number(i.value);
      const c = $('.comparador-lienzo');
      c?.style.setProperty(i.id === 'fotoCorte' ? '--corte' : '--opacidad', i.id === 'fotoCorte' ? `${i.value}%` : Number(i.value) / 100);
      actualizarOutput(i); return;
    }
    if (ev.target.id !== 'buscaEj') return;
    E.st.busca = ev.target.value;
    const pos = ev.target.selectionStart;
    render();
    const b = $('#buscaEj');
    if (b){ b.focus(); try { b.setSelectionRange(pos, pos); } catch (_) { /* tipo search */ } }
  });
  $('#contenido').addEventListener('submit', async ev => {
    if (ev.target.id === 'formInforme'){ ev.preventDefault(); await verInforme(ev.target); return; }
    if (ev.target.id !== 'compararPeriodos') return;
    ev.preventDefault();
    const datos = new FormData(ev.target);
    const valor = Object.fromEntries(['a', 'b'].map(k => [k, { desde: datos.get(`${k}-desde`), hasta: datos.get(`${k}-hasta`) }]));
    try { Comparacion.comparar(E.M, valor); }
    catch (e) { modalMensaje('Revisa los periodos', `<p>${esc(e.message)}</p>`); return; }
    const guardado = await guardarSimple([{ almacen: 'meta', put: { clave: `periodos:${E.espacio.id}`, valor } }], 'Comparación actualizada');
    if (guardado) $('#compararPeriodos button[type="submit"]')?.focus();
  });
  $('#contenido').addEventListener('change', async ev => {
    if (ev.target.dataset.rut || ev.target.id === 'rutExcel'){ await rutCambio(ev.target); return; }
    // Informe: el tipo de periodo activa sus campos sin repintar.
    if (ev.target.name === 'tipo' && ev.target.form?.id === 'formInforme'){
      const mes = ev.target.value === 'mes';
      $('#informeMes').disabled = !mes; $('#informeDesde').disabled = mes; $('#informeHasta').disabled = mes;
      return;
    }
    if (ev.target.id === 'informeConFotos'){
      E.inf.conFotos = ev.target.checked; render(); $('#informeConFotos')?.focus();
      anunciar(E.inf.conFotos ? 'Elige las fotos que quieres añadir' : 'El informe sale sin fotos'); return;
    }
    if (ev.target.dataset.infElegir != null){
      const id = ev.target.id;
      // La selección es lo marcado en pantalla (solo fotos del periodo).
      E.inf.fotos = new Set($$('[data-inf-elegir]').filter(i => i.checked).map(i => i.dataset.infElegir).slice(0, Informe.MAX_FOTOS));
      render(); document.getElementById(id)?.focus();
      anunciar(ev.target.checked ? 'Foto añadida al informe' : 'Foto quitada del informe'); return;
    }
    const idFis = ev.target.id;
    if (['compPose', 'compFotoA', 'compFotoB', 'contornoSitio', 'galeriaPose'].includes(idFis)){
      const valor = ev.target.value;
      if (idFis === 'compPose'){ E.fis.pose = valor; E.fis.a = null; E.fis.b = null; }
      else if (idFis === 'compFotoA') E.fis.a = valor;
      else if (idFis === 'compFotoB') E.fis.b = valor;
      else if (idFis === 'contornoSitio') E.fis.sitio = valor;
      else { E.fis.galeriaPose = valor; E.fis.pagina = 0; }
      render(); $(`#${idFis}`)?.focus(); anunciar('Evolución física actualizada'); return;
    }
    // Comparar dos sesiones de la ficha: se vuelve a pintar y el foco sigue
    // en el mismo selector.
    if (ev.target.id === 'compA' || ev.target.id === 'compB'){
      const id = ev.target.id;
      const a = $('#compA'), b = $('#compB');
      E.st.compA = Number(a.value); E.st.compB = Number(b.value);
      render();
      const sel = $(`#${id}`);
      if (sel) sel.focus();
      anunciar('Comparación actualizada');
      return;
    }
    if (ev.target.id === 'selEspacio'){
      await guardarSimple([{ almacen: 'meta', put: { clave: 'espacioActivo', valor: ev.target.value } }], 'Espacio cambiado.');
    }
  });
  document.addEventListener('keydown', trampaFoco);
  // Deshacer / rehacer del borrador (fuera de los campos de texto, donde
  // Ctrl + Z deshace lo que se está escribiendo).
  document.addEventListener('keydown', ev => {
    if (E.seccion !== 'rutina' || !(ev.ctrlKey || ev.metaKey) || ev.altKey || !$('#modal').classList.contains('oculto')) return;
    const t = ev.target;
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(t.type)))) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' && !ev.shiftKey){ ev.preventDefault(); rutAccion('deshacer'); }
    else if (k === 'y' || (k === 'z' && ev.shiftKey)){ ev.preventDefault(); rutAccion('rehacer'); }
  });
  // Atajos: Alt + 1…7 para las secciones (sin modal abierto).
  const orden = Object.keys(SECCIONES);
  document.addEventListener('keydown', ev => {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || !$('#modal').classList.contains('oculto')) return;
    const n = Number(ev.key);
    if (n >= 1 && n <= orden.length){ ev.preventDefault(); irA(orden[n - 1]); }
  });
  window.addEventListener('hashchange', () => irA(location.hash.slice(1) || (E.inst ? 'resumen' : 'datos'), { historial: false, foco: false }));
  initTooltip();

  // Arrastrar y soltar (JSON, ZIP o los dos).
  let n = 0;
  document.addEventListener('dragenter', ev => {
    if (ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files')){ n++; $('#dropzone').classList.remove('oculto'); }
  });
  document.addEventListener('dragleave', () => { if (--n <= 0){ n = 0; $('#dropzone').classList.add('oculto'); } });
  document.addEventListener('dragover', ev => ev.preventDefault());
  document.addEventListener('drop', ev => {
    ev.preventDefault(); n = 0; $('#dropzone').classList.add('oculto');
    recibirArchivos(ev.dataTransfer && ev.dataTransfer.files);
  });

  // Otras pestañas del escritorio: si importan, esta se refresca.
  if (typeof BroadcastChannel !== 'undefined'){
    E.canal = new BroadcastChannel('truelift-escritorio');
    E.canal.onmessage = async ev => {
      if (ev.data && ev.data.tipo === 'cambio' && !E.ocupado && !E.P){ await cargarEstado(); render(); }
    };
  }
  Almacen.alCambiarVersion = () => {
    $('#avisoGlobal').innerHTML = '<div class="alerta ambar"><span class="tag">Actualización</span><span>Se ha abierto una versión más reciente del escritorio en otra pestaña. Recarga esta página.</span></div>';
  };
  window.addEventListener('pagehide', () => { liberarUrls(); if (E.urlModal) URL.revokeObjectURL(E.urlModal); });
  let tRes = null;
  window.addEventListener('resize', () => { clearTimeout(tRes); tRes = setTimeout(marcarDesplazables, 150); });
  // Las tablas de los desplegables solo tienen ancho al abrirse.
  document.addEventListener('toggle', ev => { if (ev.target.open) marcarDesplazables(); }, true);

  arrancar();
}

async function arrancar(){
  $('#contenido').innerHTML = '<p class="muted" style="padding:24px">Cargando…</p>';
  await Almacen.abrir();
  try { await cargarEstado(); }
  catch (e) {
    $('#contenido').innerHTML = `<div class="alerta rojo"><span class="tag">Error</span><span>No se pudieron leer los datos guardados: ${esc(e.message || String(e))}</span></div>`;
    return;
  }
  // Con datos se abre el resumen (o la sección del enlace); sin ellos, el
  // estado vacío con los pasos para importar.
  const h = location.hash.slice(1);
  irA(h && SECCIONES[h.split('/')[0]] ? h : (E.inst ? 'resumen' : 'datos'), { foco: false, historial: false });
  document.documentElement.dataset.listo = '1';
  registrarSinConexion();
}

/* Caché de los archivos de la página para abrirla sin conexión (sw.js).
   Solo por http(s): desde un archivo local el navegador no lo permite. */
function registrarSinConexion(){
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)){ E.sinConexion = 'no'; return; }
  E.sinConexion = navigator.serviceWorker.controller ? 'listo' : 'preparando';
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    const antes = E.sinConexion;
    E.sinConexion = navigator.serviceWorker.controller ? 'listo' : 'tras-recargar';
    if (antes !== E.sinConexion && E.seccion === 'datos') render();
  }).catch(() => { E.sinConexion = 'no'; if (E.seccion === 'datos') render(); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { E.sinConexion = 'listo'; if (E.seccion === 'datos') render(); });
}

// Para las pruebas automáticas (estado de solo lectura).
window.Escritorio = { estado: E, recargar: async () => { await cargarEstado(); render(); } };

document.addEventListener('DOMContentLoaded', init);
})();
