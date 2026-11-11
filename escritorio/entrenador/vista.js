'use strict';
/* ================================================================
   TrueLift Escritorio — entrenador/vista.js
   HTML del modo entrenador (PLAN_ENTRENADOR.md §7, App-PRO): desbloqueo
   con el archivo de clave, clientes, ficha manual, editor de rutina
   (recuperado de rutina-vista.js, a4fd1ef^), avisos y emisión del
   paquete. Solo genera HTML: el estado y las escrituras viven en
   entrenador/modo.js y el cálculo en entrenador/planificador.js. Todo
   texto que viene de datos pasa por esc().
   ================================================================ */

const EntrenadorVista = (() => {

const PL = PlanificadorEntrenador;
const TE = TemporadaEntrenador;
const F = () => VistasEsc.F;
const tarjeta = (titulo, cuerpo, extra = '') => `<section class="card"${extra}><h2>${esc(titulo)}</h2>${cuerpo}</section>`;
const chip = (clase, texto, titulo = '') => `<span class="chip ${clase}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`;
const ayuda = (txt, titulo = 'Cómo funciona') => `<details class="detalle ayuda"><summary>${esc(titulo)}</summary>${txt}</details>`;
const btn = (accion, texto, { clase = 'sec', extra = '', des = false, titulo = '' } = {}) =>
  `<button type="button" class="btn ${clase}" data-ent-accion="${accion}"${des ? ' disabled' : ''}${titulo ? ` title="${esc(titulo)}"` : ''}${extra}>${texto}</button>`;
const SISTEMA = { simple: 'progresión simple', doble: 'progresión doble' };
const MODO = { normal: 'Series normales', topBack: 'Top set + back-off', drop: 'Drop set', rp: 'Rest-pause' };
const SEXO = { hombre: 'Hombre', mujer: 'Mujer' };
const EXPERIENCIA = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };
/* «Mujer · 63,5 kg · 166 cm · 24,5 % graso» (datos de partida del plan). */
const datosTxt = d => [d.sexo ? SEXO[d.sexo] : null, d.pesoKg != null ? `${fmtNum(d.pesoKg, 1)} kg` : null,
  d.alturaCm != null ? `${fmtNum(d.alturaCm, 0)} cm` : null, d.grasaPct != null ? `${fmtNum(d.grasaPct, 1)} % graso` : null].filter(Boolean).join(' · ');
const momento = iso => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '—';
  return `${F().dia(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const valorTxt = (campo, v) => {
  if (v == null) return campo === 'descanso' ? 'el de cada ejercicio' : '—';
  if (campo === 'modalidad') return MODO[v] || v;
  if (campo === 'superserie') return v ? 'sí' : 'no';
  if (campo === 'descanso') return `${fmtNum(v, 1)} min`;
  if (campo === 'pausaRpSeg') return `${v} s`;
  if (campo === 'backoffPct' || campo === 'dropPct') return `−${v} %`;
  return String(v);
};

// ---------------------------------------------------------------
// Desbloqueo
// ---------------------------------------------------------------
function desbloqueo(ctx){
  return `<div class="cabecera-seccion"><h1>Modo entrenador</h1></div>
  <section class="card ent-desbloqueo" aria-labelledby="entDesbTitulo">
    <h2 id="entDesbTitulo">Desbloquear con tu archivo de clave</h2>
    <p>Este apartado es solo para entrenadores de TrueLift. Con tu archivo de clave y su contraseña podrás preparar rutinas para tus clientes y enviárselas como un archivo firmado que importan en la app.</p>
    ${ctx.soportado === false ? `<div class="alerta rojo" role="alert"><span class="tag">Navegador</span><span>${esc(ClaveEntrenador.MENSAJES.navegador)}</span></div>` : ''}
    <form id="entDesbloqueo" novalidate>
      <label for="entArchivoClave">Archivo de clave (<code>clave_entrenador_….json</code>)
        <input type="file" id="entArchivoClave" accept=".json,application/json"></label>
      <label for="entContrasena">Contraseña
        <input type="password" id="entContrasena" autocomplete="current-password" spellcheck="false"></label>
      ${ctx.error ? `<div class="alerta rojo" role="alert"><span class="tag">No desbloqueado</span><span>${esc(ctx.error)}</span></div>` : ''}
      <div class="fila-botones"><button class="btn pri" type="submit"${ctx.soportado === false || ctx.ocupado ? ' disabled' : ''}>${ctx.ocupado ? 'Comprobando…' : 'Desbloquear'}</button></div>
    </form>
    <p class="muted" style="font-size:12.5px">La clave se guarda en este navegador de forma que no se puede volver a sacar de él, y la contraseña no se guarda. Para quitarla, usa «Salir del modo entrenador». No abras el modo entrenador en un ordenador que no sea tuyo.</p>
  </section>`;
}

// ---------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------
function clientes(ctx){
  const { E } = ctx;
  const filas = E.espacios.map(s => {
    const activo = E.espacio && s.id === E.espacio.id;
    const datos = s.instantaneaId ? (activo && E.inst ? `Copia hasta el ${esc(F().dia(E.inst.resumen?.ultimoRegistro))}` : 'Con copia') : s.ficha ? 'Ficha manual' : 'Sin datos';
    return [`${esc(s.nombre)}${activo ? ` ${chip('verde', 'Abierto')}` : ''}`, datos,
      activo ? '' : btn('cliente-abrir', `Abrir<span class="sr-only"> ${esc(s.nombre)}</span>`, { extra: ` data-espacio="${esc(s.id)}"` })];
  });
  return `<section class="card" aria-labelledby="entClientesTitulo"><h2 id="entClientesTitulo">Clientes</h2>
    ${filas.length ? VistasEsc.tabla(['Cliente', 'Datos', '<span class="sr-only">Abrir</span>'], filas, { caption: 'Clientes de este navegador', clase: 'ent-clientes' })
      : '<p class="muted">Aún no tienes clientes en este navegador.</p>'}
    <div class="fila-botones">
      ${btn('cliente-copia', 'Cliente nuevo con su copia', { clase: E.espacios.length ? 'sec' : 'pri' })}
      ${btn('cliente-nuevo', 'Cliente nuevo sin copia')}
    </div>
    <p class="muted" style="font-size:12.5px">Cada cliente es un espacio de este navegador. Con su copia de seguridad ves su historial en el resto de secciones y partes de su rutina; sin copia, rellenas una ficha que solo ves tú.</p>
  </section>`;
}

function ficha(ctx){
  const { E } = ctx;
  const esp = E.espacio;
  const f = esp.ficha ? PL.leerFicha(esp.ficha) : null;
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${v}</b></div>`;
  const filas = [];
  if (E.inst && E.raw){
    const r = E.inst.resumen || {};
    filas.push(kv('Copia', `${esc(E.inst.nombreArchivo || '—')} <span class="muted">(último registro: ${esc(F().dia(r.ultimoRegistro))})</span>`));
    filas.push(kv('Sesiones de fuerza', String(r.sesionesFuerza ?? '—')));
    if (E.raw.sexo) filas.push(kv('Sexo', esc(SEXO[E.raw.sexo] || E.raw.sexo)));
    if (typeof E.raw.pesoCorporal === 'number') filas.push(kv('Peso', `${fmtNum(E.raw.pesoCorporal, 1)} kg`));
    filas.push(kv('Rutina en su móvil', esc(`${SISTEMA[E.raw.sistema === 'simple' ? 'simple' : 'doble']} · ${E.raw.dias ?? '—'} días`)));
  } else if (E.rawError) {
    filas.push(`<div class="alerta rojo"><span class="tag">Error</span><span>${esc(E.rawError)}</span></div>`);
  }
  if (f){
    if (f.sexo) filas.push(kv('Sexo (ficha)', esc(SEXO[f.sexo])));
    if (f.pesoKg != null) filas.push(kv('Peso (ficha)', `${fmtNum(f.pesoKg, 1)} kg`));
    if (f.alturaCm != null) filas.push(kv('Altura', `${fmtNum(f.alturaCm, 0)} cm`));
    if (f.grasaPct != null) filas.push(kv('% graso estimado', `${fmtNum(f.grasaPct, 1)} %`));
    if (f.experiencia) filas.push(kv('Experiencia', esc(EXPERIENCIA[f.experiencia])));
    if (f.dias != null) filas.push(kv('Días disponibles', String(f.dias)));
    if (f.notas) filas.push(`<p class="muted" style="white-space:pre-wrap;font-size:13px">${esc(f.notas)}</p>`);
  }
  if (!filas.length) filas.push('<p class="muted">Sin datos todavía. Importa su copia o rellena su ficha.</p>');
  return `<section class="card" aria-labelledby="entFichaTitulo"><h2 id="entFichaTitulo">${esc(esp.nombre)}</h2>
    ${filas.join('')}
    <div class="fila-botones">
      <button class="btn sec" type="button" data-accion="importar-datos">${E.inst ? 'Actualizar con una copia nueva' : 'Importar su copia'}</button>
      ${btn('ficha-editar', f ? 'Editar ficha' : 'Rellenar ficha')}
      <button class="btn peligro" type="button" data-accion="borrar-espacio">Borrar cliente</button>
    </div>
    <p class="muted" style="font-size:12.5px">Lo que pongas en la ficha manda sobre su copia al proyectar la temporada. El sexo, el peso, la altura y el % graso viajan en su plan como punto de partida; la experiencia, los días y las notas solo los ves tú.</p></section>`;
}

/* Formulario del alta sin copia y de la ficha (modal). */
function fichaForm({ nombre = '', ficha = null, nuevo = false } = {}){
  const f = PL.leerFicha(ficha);
  const R = PL.rangosFicha();
  const op = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
  return `<h2 id="modalTitulo">${nuevo ? 'Cliente nuevo sin copia' : `Ficha de ${esc(nombre)}`}</h2>
    <form id="entFicha" class="ent-ficha" novalidate>
      <label class="ancho" for="entFNombre">Nombre del cliente (lo verá en su plan)
        <input id="entFNombre" type="text" maxlength="60" value="${esc(nombre)}" required autofocus></label>
      <label for="entFSexo">Sexo<select id="entFSexo">${op('', '—', f.sexo)}${op('hombre', 'Hombre', f.sexo)}${op('mujer', 'Mujer', f.sexo)}</select></label>
      <label for="entFPeso">Peso (kg)<input id="entFPeso" type="number" inputmode="decimal" min="${R.pesoKg[0]}" max="${R.pesoKg[1]}" step="0.1" value="${f.pesoKg ?? ''}"></label>
      <label for="entFAltura">Altura (cm)<input id="entFAltura" type="number" inputmode="numeric" min="${R.alturaCm[0]}" max="${R.alturaCm[1]}" step="1" value="${f.alturaCm ?? ''}"></label>
      <label for="entFGrasa">% graso estimado<input id="entFGrasa" type="number" inputmode="decimal" min="${R.grasaPct[0]}" max="${R.grasaPct[1]}" step="0.5" value="${f.grasaPct ?? ''}"></label>
      <label for="entFExp">Experiencia<select id="entFExp">${op('', '—', f.experiencia)}${Object.entries(EXPERIENCIA).map(([k, t]) => op(k, t, f.experiencia)).join('')}</select></label>
      <label for="entFDias">Días disponibles<select id="entFDias">${op('', '—', String(f.dias ?? ''))}${[2, 3, 4, 5, 6, 7].map(n => op(String(n), String(n), String(f.dias ?? ''))).join('')}</select></label>
      <label class="ancho" for="entFNotas">Notas<textarea id="entFNotas" maxlength="2000">${esc(f.notas)}</textarea></label>
    </form>
    <div class="alerta rojo" id="entFichaError" role="alert" hidden><span class="tag">Revisa</span><span></span></div>
    <p class="muted" style="font-size:12.5px">El sexo, el peso, la altura y el % graso son el punto de partida de su temporada aquí y viajan en su plan: la app se los propone al cliente, que puede cambiarlos. La experiencia, los días y las notas solo los ves tú, en este navegador.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-ent-accion="ficha-guardar"${nuevo ? ' data-nuevo="1"' : ''}>${nuevo ? 'Crear cliente' : 'Guardar ficha'}</button></div>`;
}

// ---------------------------------------------------------------
// Diferencias
// ---------------------------------------------------------------
function cambiosHtml(dif, { vacio = 'Sin cambios.' } = {}){
  if (!dif) return '';
  if (dif.iguales) return `<p class="muted">${esc(vacio)}</p>`;
  const out = [];
  if (dif.sistema) out.push(`<li>Sistema: ${esc(SISTEMA[dif.sistema.antes])} → <b>${esc(SISTEMA[dif.sistema.despues])}</b></li>`);
  if (dif.numDias) out.push(`<li>Días con ejercicios: ${dif.numDias.antes} → <b>${dif.numDias.despues}</b></li>`);
  const bloques = dif.dias.filter(d => d.estado !== 'igual').map(d => {
    const titulo = d.estado === 'nuevo' ? `Día ${d.indice + 1} nuevo: «${esc(d.despues)}»`
      : d.estado === 'quitado' ? `Día ${d.indice + 1} quitado: «${esc(d.antes)}»`
      : d.renombrado ? `Día ${d.indice + 1}: «${esc(d.antes)}» → «${esc(d.despues)}»` : `Día ${d.indice + 1}: «${esc(d.despues)}»`;
    const items = d.cambios.map(c => {
      if (c.tipo === 'nuevo') return `<li>${chip('verde', 'Nuevo')} ${esc(c.ejercicio)} · ${c.despues.series} × ${esc(c.despues.reps)}</li>`;
      if (c.tipo === 'quitado') return `<li>${chip('rojo', 'Quitado')} ${esc(c.ejercicio)}</li>`;
      return `<li>${chip('azul', 'Cambiado')} ${esc(c.ejercicio)}: ${c.campos.map(x => `${esc(x.txt)} ${esc(valorTxt(x.campo, x.antes))} → <b>${esc(valorTxt(x.campo, x.despues))}</b>`).join('; ')}</li>`;
    });
    if (d.ordenCambiado) items.push(`<li>${chip('gris', 'Orden')} Cambia el orden de los ejercicios.</li>`);
    return `<li><b>${titulo}</b>${items.length ? `<ul>${items.join('')}</ul>` : ''}</li>`;
  });
  return `<ul class="rut-cambios">${out.join('')}${bloques.join('')}</ul>`;
}

function gruposHtml(rg, conCopia){
  if (!rg || !rg.filas.length) return '<p class="muted">Sin series que repartir por grupo.</p>';
  const d = (v, dec = 1) => v == null || v === 0 ? '<span class="muted">=</span>' : `<b class="${v > 0 ? 'sube' : 'baja'}">${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v), dec)}</b>`;
  const sin = rg.despues && rg.despues.sinGrupo.length
    ? `<p class="muted" style="font-size:12.5px">No suman a ningún grupo porque no están en el catálogo ni en la biblioteca del cliente: ${rg.despues.sinGrupo.map(esc).join(', ')}.</p>` : '';
  if (!conCopia){
    return VistasEsc.tabla(['Grupo', 'Series por semana', 'Días'], rg.filas.map(f => [esc(f.grupo), fmtNum(f.seriesDespues ?? 0, 1), String(f.diasDespues ?? 0)]),
      { caption: 'Series semanales y días por grupo del borrador' }) + sin;
  }
  const filas = rg.filas.map(f => [esc(f.grupo), fmtNum(f.seriesAntes ?? 0, 1), fmtNum(f.seriesDespues ?? 0, 1), d(f.dSeries),
    String(f.diasAntes ?? 0), String(f.diasDespues ?? 0), d(f.dDias, 0)]);
  return VistasEsc.tabla(['Grupo', 'Series ahora', 'Series borrador', 'Diferencia', 'Días ahora', 'Días borrador', 'Diferencia'], filas,
    { caption: 'Series semanales y días por grupo: rutina de su copia frente al borrador' }) + sin;
}

// ---------------------------------------------------------------
// Editor
// ---------------------------------------------------------------
function campoNum(id, d, f, k, v, min, max, etiqueta, ancho = 'n2'){
  return `<label class="rut-campo ${ancho}" for="${id}"><span>${esc(etiqueta)}</span>
    <input id="${id}" type="number" inputmode="numeric" data-ent="campo" data-d="${d}" data-f="${f}" data-k="${k}" value="${v ?? ''}" min="${min}" max="${max}" step="1"></label>`;
}

function fila(rutina, d, i, f, ss, ctx){
  const id = k => `ent-${d}-${i}-${k}`;
  const modo = f.topBack ? 'topBack' : f.dropSet ? 'drop' : f.restPause ? 'rp' : 'normal';
  const ant = i > 0 ? rutina.dias[d].filas[i - 1] : null;
  const enSS = ss[i] > 0;
  const ssChoca = modo !== 'normal' || (ant && (ant.topBack || ant.dropSet || ant.restPause));
  const listaId = `ent-lista-${(CAT_PATRONES.indexOf(f.patron) + 1) || 0}`;
  ctx.listas.add(f.patron || '');
  const nombre = f.ejercicio || 'ejercicio sin elegir';
  const params = modo === 'topBack'
    ? campoNum(id('backoffPct'), d, i, 'backoffPct', f.backoffPct, 5, 30, '% menos en back-offs') + campoNum(id('rirBack'), d, i, 'rirBack', f.rirBack, 0, 6, 'RIR back-offs')
    : modo === 'drop' ? campoNum(id('dropPct'), d, i, 'dropPct', f.dropPct, 5, 30, '% menos en cada drop')
    : modo === 'rp' ? `<label class="rut-campo n3" for="${id('pausaRpSeg')}"><span>Pausa entre series</span><select id="${id('pausaRpSeg')}" data-ent="campo" data-d="${d}" data-f="${i}" data-k="pausaRpSeg">
        ${[10, 20, 30, 40, 50].map(v => `<option value="${v}"${v === (f.pausaRpSeg || 20) ? ' selected' : ''}>${v} s</option>`).join('')}</select></label>` : '';
  const ssTitulo = ssChoca ? 'Una superserie va a series normales: quita la modalidad de esta fila y de la anterior.' : 'Alterna sus series con el ejercicio anterior (A1→B1→A2…).';
  return `<li class="rut-fila${enSS ? ' en-ss' : ''}" data-d="${d}" data-f="${i}" aria-label="${esc(rutina.dias[d].nombre)}, ejercicio ${i + 1}: ${esc(nombre)}">
    <div class="rut-fila-cab">
      <span class="rut-num" aria-hidden="true">${i + 1}</span>
      <label class="rut-campo ej" for="${id('ejercicio')}"><span>Ejercicio</span>
        <input id="${id('ejercicio')}" type="text" maxlength="80" list="${listaId}" autocomplete="off" data-ent="campo" data-d="${d}" data-f="${i}" data-k="ejercicio" value="${esc(f.ejercicio || '')}" placeholder="Escribe o elige"></label>
      <span class="rut-mover">
        <button type="button" class="btn-mini" id="${id('arriba')}" data-ent-accion="fila-arriba" data-d="${d}" data-f="${i}" aria-label="Subir ${esc(nombre)}"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn-mini" id="${id('abajo')}" data-ent-accion="fila-abajo" data-d="${d}" data-f="${i}" aria-label="Bajar ${esc(nombre)}"${i === rutina.dias[d].filas.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn-mini peligro" id="${id('quitar')}" data-ent-accion="fila-quitar" data-d="${d}" data-f="${i}" aria-label="Quitar ${esc(nombre)}">✕</button>
      </span>
    </div>
    <div class="rut-fila-campos">
      ${DibujosEsc.grande(f.ejercicio, { clase: 'ej-dibujo-rut' })}
      <label class="rut-campo pat" for="${id('patron')}"><span>Patrón</span><select id="${id('patron')}" data-ent="campo" data-d="${d}" data-f="${i}" data-k="patron">
        ${CAT_PATRONES.map(p => { const v = p === '(Ninguno)' ? '' : p; return `<option value="${esc(v)}"${v === (f.patron || '') ? ' selected' : ''}>${esc(p)}</option>`; }).join('')}
        ${f.patron && !CAT_PATRONES.includes(f.patron) ? `<option value="${esc(f.patron)}" selected>${esc(f.patron)}</option>` : ''}</select></label>
      ${campoNum(id('series'), d, i, 'series', f.series, 1, 10, 'Series')}
      ${campoNum(id('repsMin'), d, i, 'repsMin', f.repsMin, 1, modo === 'rp' ? 60 : 30, modo === 'rp' ? (rutina.sistema === 'doble' ? 'Reps totales mín' : 'Reps totales') : modo === 'drop' ? 'Reps 1.ª serie' : rutina.sistema === 'doble' ? 'Reps mín' : 'Reps')}
      ${rutina.sistema === 'doble' && modo !== 'drop' ? campoNum(id('repsMax'), d, i, 'repsMax', f.repsMax, 1, modo === 'rp' ? 60 : 30, modo === 'rp' ? 'Reps totales máx' : 'Reps máx') : ''}
      ${modo === 'rp' ? '<span class="rut-campo n2 rut-fijo"><span>RIR</span><b title="En rest-pause todas las series van al fallo">al fallo</b></span>' : campoNum(id('rir'), d, i, 'rir', f.rir, 0, 6, 'RIR')}
      <label class="rut-campo n3" for="${id('descanso')}"><span>Descanso</span><select id="${id('descanso')}" title="Por defecto: el descanso que la app propone para ese ejercicio" data-ent="campo" data-d="${d}" data-f="${i}" data-k="descanso">
        <option value=""${f.descanso == null ? ' selected' : ''}>Por defecto</option>
        ${CAT_DESCANSOS.map(v => `<option value="${v}"${v === f.descanso ? ' selected' : ''}>${fmtNum(v, 1)} min</option>`).join('')}
        ${f.descanso != null && !CAT_DESCANSOS.includes(f.descanso) ? `<option value="${f.descanso}" selected>${fmtNum(f.descanso, 2)} min</option>` : ''}</select></label>
      <label class="rut-campo n4" for="${id('modalidad')}"><span>Modalidad</span><select id="${id('modalidad')}" data-ent="campo" data-d="${d}" data-f="${i}" data-k="modalidad"${enSS ? ' disabled title="En una superserie se entrena a series normales: quita la superserie para usar otra modalidad."' : ''}>
        ${Object.entries(MODO).map(([k, t]) => `<option value="${k}"${k === modo ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${params}
      ${i > 0 ? `<label class="rut-ss" for="${id('superConAnterior')}" title="${esc(ssTitulo)}"><input id="${id('superConAnterior')}" type="checkbox" data-ent="campo" data-d="${d}" data-f="${i}" data-k="superConAnterior"${f.superConAnterior && !ssChoca ? ' checked' : ''}${ssChoca ? ' disabled' : ''}> Superserie con el anterior</label>` : ''}
    </div>
    ${enSS ? `<p class="rut-meta">${chip('azul', `Superserie ${ss[i]}`)}</p>` : ''}
  </li>`;
}

function editor(ctx){
  const r = ctx.borrador.rutina;
  ctx.listas = new Set();
  const dias = r.dias.map((dia, d) => {
    const ss = Planner._gruposSuperserie(dia.filas);
    const series = dia.filas.reduce((s, f) => s + (f.ejercicio ? Number(f.series) || 0 : 0), 0);
    const nEj = dia.filas.filter(f => f.ejercicio).length;
    return `<section class="card rut-dia" aria-labelledby="ent-dia-${d}-titulo">
      <div class="rut-dia-cab">
        <h3 id="ent-dia-${d}-titulo" class="sr-only">Día ${d + 1}: ${esc(dia.nombre)}</h3>
        <label class="rut-campo nombre" for="ent-${d}-nombre"><span>Día ${d + 1}</span>
          <input id="ent-${d}-nombre" type="text" maxlength="40" data-ent="nombreDia" data-d="${d}" value="${esc(dia.nombre)}"></label>
        <span class="rut-mover">
          <button type="button" class="btn-mini" id="ent-${d}-diaIzq" data-ent-accion="dia-antes" data-d="${d}" aria-label="Mover ${esc(dia.nombre)} antes"${d === 0 ? ' disabled' : ''}>←</button>
          <button type="button" class="btn-mini" id="ent-${d}-diaDer" data-ent-accion="dia-despues" data-d="${d}" aria-label="Mover ${esc(dia.nombre)} después"${d === r.dias.length - 1 ? ' disabled' : ''}>→</button>
          <button type="button" class="btn-mini peligro" id="ent-${d}-diaQuitar" data-ent-accion="dia-quitar" data-d="${d}" aria-label="Quitar ${esc(dia.nombre)}"${r.dias.length <= 1 ? ' disabled' : ''}>✕</button>
        </span>
      </div>
      <p class="muted rut-dia-resumen">${nEj} ${nEj === 1 ? 'ejercicio' : 'ejercicios'} · ${series} series</p>
      <ol class="rut-filas">${dia.filas.map((f, i) => fila(r, d, i, f, ss, ctx)).join('')}</ol>
      ${dia.filas.length < PL.MAX_FILAS ? btn('fila-nueva', '+ Ejercicio', { extra: ` data-d="${d}" id="ent-${d}-nueva"` }) : '<p class="muted" style="font-size:12px">Máximo de ejercicios por día que admite la app.</p>'}
    </section>`;
  }).join('');
  const listas = [...ctx.listas].map(p => {
    const idx = (CAT_PATRONES.indexOf(p) + 1) || 0;
    const ops = p ? PL.opcionesEjercicio(p, ctx.raw) : [...new Set([...Object.keys(CAT_FICHA), ...PL.opcionesEjercicio('', ctx.raw)])].sort((a, b) => a.localeCompare(b, 'es'));
    return `<datalist id="ent-lista-${idx}">${ops.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>`;
  }).join('');
  return `<div class="rut-dias">${dias}</div>${listas}
    ${r.dias.length < PL.MAX_DIAS ? `<div class="fila-botones">${btn('dia-nuevo', `+ Día (${r.dias.length}/${PL.MAX_DIAS})`, { extra: ' id="ent-dia-nuevo"' })}</div>` : ''}`;
}

// ---------------------------------------------------------------
// Rutina del cliente: borradores, editor, análisis
// ---------------------------------------------------------------
function rutina(ctx){
  const { copia, borrador, borradores, pila } = ctx;
  const out = [];
  if (copia && copia.recortada)
    out.push('<div class="alerta ambar"><span class="tag">Revisar</span><span>La rutina de su copia tiene más días o más ejercicios por día de los que admite un plan. Un borrador hecho a partir de ella no los incluirá.</span></div>');
  const dis = borrador ? PL.discrepancia(borrador, ctx.raw) : null;
  if (dis){
    out.push(`<section class="card alerta-card" role="region" aria-label="La rutina de su copia ha cambiado">
      <div class="alerta ambar"><span class="tag">Copia nueva</span><span>${dis.sinRutina
        ? 'Su copia más reciente ya no trae la rutina de la que partió este borrador.'
        : 'La rutina de su copia más reciente no es la misma de la que partió este borrador. El borrador no se ha tocado.'}</span></div>
      ${dis.diff ? `<details class="detalle" open><summary>Qué cambió en su móvil desde que empezaste el borrador</summary>${cambiosHtml(dis.diff)}</details>` : ''}
      <div class="fila-botones">
        ${btn('rebasar', 'Mantener el borrador y compararlo con su rutina actual')}
        ${copia ? btn('nuevo-copia', 'Crear otro borrador desde su rutina actual') : ''}
      </div></section>`);
  }
  const sel = borradores.length > 1
    ? `<label class="rut-campo nombre" for="entSelBorrador"><span>Borrador</span><select id="entSelBorrador" data-ent="borrador">
        ${borradores.map(b => `<option value="${esc(b.id)}"${borrador && b.id === borrador.id ? ' selected' : ''}>${esc(b.nombre)}</option>`).join('')}</select></label>` : '';
  out.push(`<section class="card rut-barra" aria-labelledby="entRutinaTitulo"><h2 id="entRutinaTitulo">Plan para ${esc(ctx.E.espacio.nombre)}</h2>
    <div class="fila-botones">${sel}
      ${copia ? btn('nuevo-copia', 'Nuevo borrador desde su rutina', { clase: borrador ? 'sec' : 'pri' }) : ''}
      ${btn('nuevo-blanco', 'Nuevo en blanco', { clase: !borrador && !copia ? 'pri' : 'sec' })}
      ${btn('nuevo-otro', 'Desde un borrador de otro cliente…')}
      ${borrador ? btn('duplicar', 'Duplicar') + btn('renombrar', 'Renombrar') + btn('eliminar', 'Eliminar', { clase: 'peligro' }) : ''}
    </div>
    ${borrador ? `<div class="fila-botones">
      ${btn('deshacer', 'Deshacer', { des: !pila.deshacer, titulo: 'Ctrl + Z fuera de un campo de texto', extra: ' id="entDeshacer"' })}
      ${btn('rehacer', 'Rehacer', { des: !pila.rehacer, titulo: 'Ctrl + Y fuera de un campo de texto', extra: ' id="entRehacer"' })}
      ${btn('partida', 'Volver a la rutina de partida', { titulo: 'Recupera la rutina con la que empezaste este borrador. Se puede deshacer.' })}
      <label class="rut-ss ent-incluir" for="entIncluirRutina"><input id="entIncluirRutina" type="checkbox" data-ent="incluirRutina"${borrador.incluirRutina ? ' checked' : ''}> Incluir la rutina en el plan</label>
      <label class="rut-campo n4" for="entSistema"><span>Sistema</span><select id="entSistema" data-ent="sistema"${borrador.incluirRutina ? '' : ' disabled'}>
        <option value="doble"${borrador.rutina.sistema === 'doble' ? ' selected' : ''}>Progresión doble</option>
        <option value="simple"${borrador.rutina.sistema === 'simple' ? ' selected' : ''}>Progresión simple</option></select></label>
      <span class="spacer"></span>
      ${btn('emitir', 'Emitir plan para el cliente', { clase: 'pri', extra: ' id="entEmitir"' })}
    </div>
    <p class="muted" style="font-size:12.5px">Guardado en este navegador ${esc(momento(borrador.actualizado))}.</p>` : ''}
  </section>`);
  if (!borrador){
    out.push(`<p class="muted">${copia ? 'Empieza un borrador desde la rutina que tiene ahora en su móvil, en blanco o desde el borrador de otro cliente.' : 'Su copia no trae una rutina personalizada: empieza en blanco o desde el borrador de otro cliente.'}</p>`);
    return out.join('');
  }
  if (!borrador.incluirRutina){
    out.push(`<section class="card" id="entSinRutina" aria-labelledby="entSinRutinaTitulo"><h2 id="entSinRutinaTitulo">Rutina</h2>
      <p>Este plan no lleva rutina: el cliente conservará la que tiene en su móvil. Marca «Incluir la rutina en el plan» para editarla y enviarla.</p></section>`);
    return out.join('');
  }
  out.push(editor(ctx));
  const av = PL.avisos(borrador.rutina, ctx.raw, { nombre: borrador.nombre });
  const sim = av.sim;
  const dif = copia ? PL.diferencias(copia.normal, sim.normal) : null;
  const rg = PL.resumenGrupos(ctx.raw, copia ? copia.normal : null, sim.normal);
  const prog = PL.progresion(ctx.raw, sim);
  out.push(`<div class="grid cols2 rut-analisis">
    ${tarjeta('Cambios frente a la rutina de su copia', copia
      ? cambiosHtml(dif, { vacio: 'El borrador es igual que la rutina de su copia.' })
      : '<p class="muted">No hay una rutina de su copia con la que comparar.</p>', ' id="entCambios"')}
    ${tarjeta('Avisos antes de emitir', av.avisos.length
      ? av.avisos.map(a => `<div class="alerta ${a.nivel}"><span class="tag">${a.nivel === 'rojo' ? 'Impide emitir' : a.nivel === 'ambar' ? 'Revisa' : 'Nota'}</span><span>${esc(a.txt)}</span></div>`).join('')
      : '<p class="muted">Sin avisos: la app aplicará este borrador tal cual.</p>', ' id="entAvisos"')}
  </div>`);
  out.push(tarjeta('Series por grupo muscular y semana', gruposHtml(rg, !!copia) +
    ayuda('<p class="muted">Mismo reparto que la pestaña de volumen de la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. Se cuenta una pasada por cada día de la rutina.</p>', 'Cómo leer esto')));
  if (prog) out.push(tarjeta('Sus cargas al aplicar esta rutina', prog.conserva
    ? '<p>Mantiene el sistema de progresión y el número de días: en los ejercicios que se repitan, la app seguirá proponiéndole los pesos que ya venía usando.</p>'
    : `<p>Cambia ${[!prog.mismosDias ? `el número de días (${esc(prog.diasAntes)} → ${sim.dias.length})` : '', !prog.mismoSistema ? `el sistema (${esc(SISTEMA[prog.sistemaAntes])} → ${esc(SISTEMA[sim.sistema])})` : ''].filter(Boolean).join(' y ')}: la app volverá a proponerle las cargas desde el principio. Su historial y sus récords se conservan.</p>`));
  return out.join('');
}

const ESTADO_EMITIDO = {
  sinCopia: ['gris', 'Sin copia'], aPrueba: ['azul', 'Rutina a prueba'], aplicado: ['verde', 'Aplicado'],
  pendiente: ['ambar', 'Temporada pendiente'], descartado: ['rojo', 'Descartado'], sustituido: ['gris', 'Sustituido'],
  copiaAnterior: ['gris', 'Copia anterior'], caducado: ['ambar', 'Caducado'], sinRastro: ['gris', 'Sin rastro'],
};
const RUTINA_APP = { aplicada: 'rutina confirmada', aPrueba: 'rutina a prueba', descartada: 'rutina descartada' };
const TEMPORADA_APP = { aplicada: 'temporada aplicada', pendiente: 'temporada aún sin aplicar', descartada: 'temporada descartada' };

/* Qué pasó con un plan emitido, según la copia más reciente del cliente. */
function estadoHtml(e, ctx){
  const st = TE.estadoEmitido(e, ctx.raw, { fechaCopia: ctx.fechaCopia, hoy: ctx.hoy });
  const [cl, txt] = ESTADO_EMITIDO[st.estado];
  const cuando = st.aplicadoEn ? ` el ${esc(F().dia(st.aplicadoEn))}` : '';
  const detalle = {
    sinCopia: 'Importa una copia suya para saberlo.',
    aPrueba: `Lo importó${cuando}; aún no ha confirmado la rutina.`,
    aplicado: `Lo importó${cuando}.`,
    pendiente: `Lo importó${cuando}; aún no ha aplicado la temporada.`,
    descartado: `Lo importó${cuando} y lo descartó.`,
    sustituido: `Lo importó${cuando}; después importó otro plan.`,
    copiaAnterior: 'Su copia es anterior a este plan.',
    caducado: 'No consta que lo importase y ya no se puede importar.',
    sinRastro: 'Su copia no muestra que lo haya importado.',
  }[st.estado];
  const partes = [st.rutina ? RUTINA_APP[st.rutina] : '', st.temporada ? TEMPORADA_APP[st.temporada] : ''].filter(Boolean);
  return `${chip(cl, txt)}<br><span class="muted">${detalle}${partes.length && ['aplicado', 'pendiente', 'descartado', 'aPrueba'].includes(st.estado) ? ` (${esc(partes.join(', '))})` : ''}</span>`;
}

function emitidos(ctx){
  const lista = ctx.emitidos;
  if (!lista.length) return '';
  const filas = lista.map(e => {
    const lleva = [e.rutina ? `Rutina: ${esc(SISTEMA[e.rutina.sistema] || '')} · ${e.rutina.dias ?? '—'} días` : '',
      e.temporada ? `Temporada: ${F().plural(e.temporada.bloques.length, 'bloque', 'bloques')} · ${e.temporada.semanas} semanas` : ''].filter(Boolean);
    return [esc(momento(e.fecha)),
      `${esc(e.borradorNombre || '—')}<br><span class="muted">${lleva.join('<br>') || '—'}</span>`,
      e.caduca ? esc(F().dia(e.caduca)) : '<span class="muted">Sin límite</span>',
      estadoHtml(e, ctx),
      `<code>${esc(e.archivo)}</code><br><code class="muted" title="SHA-256 del archivo">${esc(String(e.sha256 || '').slice(0, 16))}…</code>`];
  });
  return tarjeta('Planes emitidos', VistasEsc.tabla(['Fecha', 'Plan', 'Importable hasta', 'En su copia', 'Archivo'], filas, { caption: 'Planes emitidos para este cliente', clase: 'ent-emitidos' }) +
    '<p class="muted" style="font-size:12.5px">«En su copia» sale de la copia de seguridad más reciente que hayas importado de este cliente: para saber si ha aplicado un plan, pídele una copia nueva. Una revisión es otro plan: edita el borrador (o crea uno desde su copia más reciente) y vuelve a emitir.</p>', ' id="entEmitidos"');
}

// ---------------------------------------------------------------
// Temporada
// ---------------------------------------------------------------
/* Chip de la duración: hacia dónde se sale (como el semáforo de la app). */
const DURACION = { ambar: { corta: 'Algo corto', larga: 'Algo largo' }, rojo: { corta: 'Muy corto', larga: 'Muy largo' } };
const ritmoTxt = tasa => tasa === 0 ? 'mantener el peso' : `${F().signo(tasa, 2)} / semana`;

function datosHtml(d){
  if (!d) return '';
  const de = k => d.origen[k] === 'ficha' ? ' <span class="muted">(ficha)</span>' : '';
  const partes = [];
  if (d.pesoKg != null) partes.push(`${esc(F().kg(d.pesoKg))}${de('peso')}`);
  if (d.grasaPct != null) partes.push(`${esc(F().num(d.grasaPct, 1))} % graso${de('grasa')}`);
  if (d.perfil.alturaCm != null) partes.push(`${esc(F().num(d.perfil.alturaCm, 0))} cm${de('altura')}`);
  const faltan = { peso: 'peso', grasa: '% graso', altura: 'altura', sexo: 'sexo' };
  return `<p class="ent-partida"><b>Datos del cliente:</b> ${partes.length ? partes.join(' · ') : '<span class="muted">ninguno</span>'}${d.faltan.length ? ` <span class="muted">· falta: ${esc(d.faltan.map(k => faltan[k]).join(', '))}</span>` : ''}</p>`;
}

function bloqueHtml(b, n, an){
  const id = k => `ent-t-${b.i}-${k}`;
  const p = b.proyeccion;
  const dur = DURACION[b.duracion] && b.motivoDuracion ? [b.duracion, DURACION[b.duracion][b.motivoDuracion]] : null;
  const libres = PaqueteEntrenador.LIMITES.horizonteMaxSemanas - an.totalSemanas + b.semanas;
  const chips = [dur ? chip(dur[0], dur[1]) : '',
    b.ajuste ? chip('ambar', b.ajuste === 'baja' ? 'La app bajará el ritmo' : 'La app subirá el ritmo') : ''].filter(Boolean).join(' ');
  return `<li class="ent-bloque" data-i="${b.i}" aria-label="Bloque ${b.i + 1}: ${esc(b.nombre)}, ${b.semanas} semanas">
    <div class="rut-fila-cab">
      <span class="rut-num" aria-hidden="true">${b.i + 1}</span>
      <label class="rut-campo n3" for="${id('tipo')}"><span>Tipo</span><select id="${id('tipo')}" data-ent="bloque" data-i="${b.i}" data-k="tipo">
        ${TE.TIPOS.map(t => `<option value="${t}"${t === b.tipo ? ' selected' : ''}>${esc(TE.NOMBRE[t])}</option>`).join('')}</select></label>
      <label class="rut-campo n2" for="${id('semanas')}"><span>Semanas</span><input id="${id('semanas')}" type="number" inputmode="numeric" min="1" max="${libres}" step="1" data-ent="bloque" data-i="${b.i}" data-k="semanas" value="${b.semanas}"></label>
      ${b.tipo === 'BRIDGE'
        ? '<span class="rut-campo n3 rut-fijo"><span>Ritmo</span><b>mantener el peso</b></span>'
        : `<label class="rut-campo n3" for="${id('ritmo')}"><span title="Porcentaje del peso por semana">Ritmo (% / sem)</span><input id="${id('ritmo')}" type="number" inputmode="decimal" min="${TE.RITMO_MIN}" max="${TE.RITMO_MAX}" step="${TE.RITMO_PASO}" data-ent="bloque" data-i="${b.i}" data-k="ritmo" value="${Math.abs(b.tasa)}"></label>`}
      <span class="rut-mover">
        <button type="button" class="btn-mini" id="${id('arriba')}" data-ent-accion="bloque-arriba" data-i="${b.i}" aria-label="Subir el bloque ${b.i + 1}"${b.i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn-mini" id="${id('abajo')}" data-ent-accion="bloque-abajo" data-i="${b.i}" aria-label="Bajar el bloque ${b.i + 1}"${b.i === n - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn-mini peligro" id="${id('quitar')}" data-ent-accion="bloque-quitar" data-i="${b.i}" aria-label="Quitar el bloque ${b.i + 1}">✕</button>
      </span>
    </div>
    <p class="rut-meta ent-bloque-meta">${esc(F().corta(b.inicio))} – ${esc(F().dia(b.fin))}${b.tipo === 'BRIDGE' ? ' · mantener el peso' : ` · ${esc(ritmoTxt(b.tasa))}`}${p ? ` · al final: <b>${esc(F().kg(p.pesoFinKg))}</b> y <b>${esc(F().num(p.grasaFinPct, 1))} %</b> graso` : ''}${chips ? `<br>${chips}` : ''}</p>
  </li>`;
}

/* Línea de tiempo y gráficas de la temporada, como el planificador de la
   app: un segmento por bloque con el color de su tipo, la inicial y el borde
   de su semáforo (LineaTiempoPlan), y la curva diaria de peso, masa magra y
   masa grasa con una raya en el comienzo de cada bloque (_PintorPlan). */
const COLOR_TIPO = { BULK: TL.lima, CUT: TL.azul, BRIDGE: TL.txt3 };
function graficaTemporada(an){
  const total = an.bloques.reduce((s, b) => s + b.semanas, 0);
  const SEM = { verde: 'sin avisos', ambar: 'conviene revisarlo', rojo: 'fuera de lo habitual' };
  const segmentos = an.bloques.map(b => `<span class="ent-lt-seg tipo-${b.tipo.toLowerCase()} borde-${b.color}" style="flex-grow:${b.semanas}"
      title="${esc(`${b.nombre}: ${F().plural(b.semanas, 'semana', 'semanas')}, ${b.tipo === 'BRIDGE' ? 'mantener el peso' : ritmoTxt(b.tasaApp)} · ${SEM[b.color]}`)}"><b aria-hidden="true">${esc(b.nombre[0])}</b></span>`).join('');
  const rotulos = an.bloques.map(b => `<span><i class="ent-lt-punto tipo-${b.tipo.toLowerCase()}" aria-hidden="true"></i>${esc(b.nombre)} hasta el ${esc(F().corta(b.fin))}</span>`).join('');
  const linea = `<div class="ent-linea-tiempo" role="img" aria-label="${esc(`Temporada de ${F().plural(total, 'semana', 'semanas')}: ${an.bloques.map(b => `${b.nombre} ${F().plural(b.semanas, 'semana', 'semanas')}`).join(', ')}`)}">${segmentos}</div>
    <p class="ent-lt-rotulos">${rotulos}</p>`;
  const c = an.curva;
  if (!c) return linea;
  const marcas = an.bloques.slice(1).map(b => ({ x: b.inicio, color: TL.txt4, label: `Empieza ${b.nombre.toLowerCase()}`, tipo: 'cambio de bloque' }));
  const serie = k => c.puntos.map(x => ({ x: x.fecha, y: Math.round(x[k] * 100) / 100 }));
  const peso = Charts.lineas({ series: [{ nombre: 'Peso', color: TL.lima, puntos: serie('pesoKg'), unidad: 'kg', sinPuntos: true }], marcas, w: 960, h: 220 });
  const masas = Charts.lineas({ series: [
    { nombre: 'Masa magra', color: TL.azul, puntos: serie('magraKg'), unidad: 'kg', sinPuntos: true },
    { nombre: 'Masa grasa', color: TL.ambar, puntos: serie('grasaKg'), unidad: 'kg', sinPuntos: true, eje: 'der' },
  ], marcas, w: 960, h: 200 });
  return `${linea}
    <div class="ent-graficas" id="entGraficaTemporada">
      ${VistasEsc.grafica(peso, 'Peso proyectado a lo largo de la temporada', '')}
      ${VistasEsc.grafica(masas, 'Masa magra (eje izquierdo) y masa grasa (eje derecho) proyectadas a lo largo de la temporada', '')}
    </div>
    ${ayuda('La misma proyección que verá el cliente en el planificador de la app si la aplica hoy, con los ritmos que la app le dejará. Las rayas verticales marcan el comienzo de cada bloque. Es una estimación: el reparto entre masa magra y grasa depende de su entrenamiento, su descanso y su punto de partida.')}`;
}

function temporada(ctx){
  const b = ctx.borrador, an = ctx.temporada, d = ctx.datos;
  const cab = `<h2 id="entTemporadaTitulo">Temporada de nutrición</h2>`;
  if (!b.temporada || !an){
    const deCopia = d && d.planCopia ? TE.desdePlanCopia(d.planCopia, ctx.hoy) : null;
    const ultima = ctx.emitidos.find(e => e.temporada && e.temporada.bloques && e.temporada.bloques.length);
    return `<section class="card ent-temporada" id="entTemporada" aria-labelledby="entTemporadaTitulo">${cab}
      <p>${b.temporada ? '' : 'Este plan no lleva temporada. '}Puedes añadirle una: bloques de definición, volumen o normocalórica, cada uno con su duración y su ritmo. El cliente la recibe como una propuesta y la aplica desde la pestaña Nutrición de la app.</p>
      <div class="fila-botones">
        ${btn('temporada-nueva', 'Añadir una temporada', { clase: b.incluirRutina ? 'sec' : 'pri', extra: ' id="entTemporadaNueva"' })}
        ${deCopia ? btn('temporada-copia', 'Partir de la temporada que tiene en la app', { extra: ' id="entTemporadaCopia"' }) : ''}
        ${ultima ? btn('temporada-emitida', 'Partir de la del último plan emitido', { extra: ` data-emitido="${esc(ultima.id)}"` }) : ''}
      </div></section>`;
  }
  const L = PaqueteEntrenador.LIMITES;
  const n = an.bloques.length;
  const puedeAnadir = n < L.bloquesMax && an.totalSemanas < L.horizonteMaxSemanas;
  const pr = an.proyeccion;
  const out = [`<section class="card ent-temporada" id="entTemporada" aria-labelledby="entTemporadaTitulo">${cab}
    ${datosHtml(d)}
    ${pr ? `<div class="cifras">
      ${`<div class="cifra"><b>${esc(F().kg(pr.pesoPartidaKg))}</b><span>${esc(`al aplicarla · ${F().num(pr.grasaPartidaPct, 1)} % graso`)}</span></div>`}
      ${`<div class="cifra"><b>${esc(F().kg(pr.pesoFinKg))}</b><span>${esc(`al final · ${F().num(pr.grasaFinPct, 1)} % graso`)}</span></div>`}
      ${`<div class="cifra"><b>${esc(String(an.totalSemanas))}</b><span>${esc(`semanas · hasta el ${F().dia(an.fin)}`)}</span></div>`}
    </div>` : `<p class="muted">${esc(F().plural(an.totalSemanas, 'semana', 'semanas'))} en ${esc(F().plural(n, 'bloque', 'bloques'))}, hasta el ${esc(F().dia(an.fin))} si la aplica hoy.</p>`}
    ${graficaTemporada(an)}
    <ol class="rut-filas ent-bloques">${an.bloques.map(x => bloqueHtml(x, n, an)).join('')}</ol>
    ${ctx.notaTemporada ? `<div class="alerta ambar" id="entNotaTemporada"><span class="tag">Ajustado</span><span>${esc(ctx.notaTemporada)}</span></div>` : ''}
    <div class="fila-botones">
      ${btn('bloque-nuevo', `+ Bloque (${n}/${L.bloquesMax})`, { des: !puedeAnadir, extra: ' id="ent-t-nuevo"', titulo: puedeAnadir ? '' : `Hasta ${L.bloquesMax} bloques y ${L.horizonteMaxSemanas} semanas en total` })}
      <span class="spacer"></span>
      ${btn('temporada-quitar', 'Quitar la temporada del plan', { clase: 'peligro', extra: ' id="entTemporadaQuitar"' })}
    </div>
    <p class="muted" style="font-size:12.5px">La app ancla la temporada al día en que el cliente la aplica y ajusta cada ritmo a sus datos reales de ese día. Las fechas y la proyección de aquí suponen que la aplica hoy, con los datos de su ficha y, lo que falte, de su copia.</p>
  </section>`];
  out.push(tarjeta('Avisos de la temporada', an.avisos.length
    ? an.avisos.map(a => `<div class="alerta ${a.nivel}"><span class="tag">${a.nivel === 'rojo' ? 'Impide emitir' : a.nivel === 'ambar' ? 'Revisa' : 'Nota'}</span><span>${esc(a.txt)}</span></div>`).join('')
    : '<p class="muted">Sin avisos: la app aplicará esta temporada tal cual.</p>', ' id="entAvisosTemporada"'));
  return out.join('');
}

// ---------------------------------------------------------------
// Página
// ---------------------------------------------------------------
function seccion(ctx){
  const out = [`<div class="cabecera-seccion"><h1>Entrenador</h1>
    <button class="btn sec" type="button" data-ent-accion="salir" id="entSalir">Salir del modo entrenador</button></div>`];
  if (ctx.error) out.push(`<div class="alerta rojo" role="alert"><span class="tag">No guardado</span><span>${esc(ctx.error)}</span></div>`);
  out.push(clientes(ctx));
  if (!ctx.E.espacio) return out.join('');
  out.push(ficha(ctx));
  out.push(rutina(ctx));
  if (ctx.borrador) out.push(temporada(ctx));
  out.push(emitidos(ctx));
  out.push(ayuda(`<ul class="lista-plana">
    <li><b>Borrador:</b> lo que preparas aquí, guardado solo en este navegador. Puedes tener varios por cliente; importar una copia nueva no los toca.</li>
    <li><b>Plan emitido:</b> un archivo firmado con tu clave, con la rutina, la temporada o las dos. Envíaselo al cliente por WhatsApp o correo; lo importa en la app desde la bienvenida o desde las herramientas de su rutina.</li>
    <li>La app le enseña el plan antes de aplicarlo y, si ya tenía una rutina, la deja a prueba hasta que la confirme. La temporada le llega como una propuesta que aplica desde Nutrición.</li>
    <li><b>Importable hasta:</b> pasada esa fecha la app rechaza el archivo y tendrás que emitirle otro.</li>
    <li>Para saber si lo aplicó, pídele una copia de seguridad nueva e impórtala aquí.</li>
  </ul>`));
  return out.join('');
}

/* Contenido del diálogo de emisión. */
function confirmarEmision(ctx){
  const { borrador, copia } = ctx;
  const sim = borrador.incluirRutina ? PL.simular(borrador.rutina, ctx.raw, { nombre: borrador.nombre }) : null;
  const dif = sim && copia ? PL.diferencias(copia.normal, sim.normal) : null;
  const t = TE.paquete(borrador.temporada);
  const datos = PL.datosPaquete(ctx.E.espacio.ficha);
  const L = PaqueteEntrenador.LIMITES;
  const hoy = TE.iso(ctx.hoy || new Date());
  const manana = TE.iso(new Date((ctx.hoy || new Date()).getFullYear(), (ctx.hoy || new Date()).getMonth(), (ctx.hoy || new Date()).getDate() + 1));
  const lleva = [
    sim ? `<li>Rutina «${esc(borrador.nombre)}»: ${sim.dias.length} días, ${esc(SISTEMA[sim.sistema])}.</li>` : '<li>Sin rutina: el cliente conserva la suya.</li>',
    t ? `<li>Temporada: ${t.bloques.map(x => `${esc(TE.NOMBRE[x.tipo])} ${x.semanas} sem`).join(' → ')} (${TE.totalSemanas(t)} semanas).</li>` : '<li>Sin temporada.</li>',
    datos ? `<li>Datos de partida (de su ficha): ${esc(datosTxt(datos))}. La app se los propone; el cliente puede cambiarlos.</li>` : '<li>Sin datos de partida: la app usará los que el cliente tenga en su móvil.</li>',
  ];
  return `<h2 id="modalTitulo">Emitir plan para ${esc(ctx.E.espacio.nombre)}</h2>
    <ul class="lista-plana ent-lleva">${lleva.join('')}</ul>
    <p>Se firmará con tu clave y se descargará un archivo <code>.json</code> para enviárselo.</p>
    ${dif ? `<details class="detalle"${dif.iguales ? '' : ' open'}><summary>Cambios frente a la rutina de su copia</summary>${cambiosHtml(dif, { vacio: 'Igual que la rutina de su copia.' })}</details>` : ''}
    <div class="mod-fila"><label for="entNombreEntrenador">Tu nombre (lo verá el cliente)</label>
      <input id="entNombreEntrenador" type="text" maxlength="${L.textoMax}" value="${esc(ctx.nombreEntrenador || '')}" autocomplete="name" autofocus></div>
    <div class="mod-fila"><label for="entNota">Nota para el cliente (opcional)</label>
      <textarea id="entNota" class="ent-nota" maxlength="${L.notaMax}" placeholder="Cómo empezar, en qué fijarse…"></textarea></div>
    <div class="mod-fila ent-caducidad"><label class="rut-ss" for="entCaduca"><input id="entCaduca" type="checkbox" data-ent="caduca" checked> Fecha límite para importarlo</label>
      <input id="entCaducaFecha" type="date" min="${manana}" value="${TE.caducidadDefecto(ctx.hoy || new Date())}" aria-label="Importable hasta">
      <p class="muted" style="font-size:12.5px;margin:4px 0 0">Pasada esa fecha la app rechaza el archivo y tendrías que emitirle otro. Por defecto, ${TE.CADUCIDAD_DIAS} días desde hoy (${esc(F().dia(hoy))}).</p></div>
    ${ctx.errorEmision ? `<div class="alerta rojo" role="alert"><span class="tag">Revisa</span><span>${esc(ctx.errorEmision)}</span></div>` : ''}
    <p class="muted" style="font-size:12.5px">El archivo solo lleva tu nombre, el del cliente, la nota${sim ? ', la rutina' : ''}${t ? ', la temporada' : ''}${datos ? ', sus datos de partida' : ''} y la fecha límite. Su historial, sus notas y el resto de su ficha no salen de este navegador.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-ent-accion="emitir-confirmar" id="entEmitirConfirmar">Firmar y descargar</button></div>`;
}

/* Elegir el borrador de otro cliente como plantilla. */
function elegirOtro(grupos){
  if (!grupos.length) return `<h2 id="modalTitulo">Desde un borrador de otro cliente</h2>
    <p>No hay borradores de otros clientes en este navegador.</p>
    <div class="mod-acciones"><button class="btn pri" type="button" data-accion="cerrar" autofocus>Entendido</button></div>`;
  return `<h2 id="modalTitulo">Desde un borrador de otro cliente</h2>
    <div class="mod-fila"><label for="entOtro">Borrador</label><select id="entOtro" autofocus>
      ${grupos.map(g => `<optgroup label="${esc(g.cliente)}">${g.borradores.map(b => `<option value="${esc(b.id)}">${esc(b.nombre)} · ${esc(momento(b.actualizado))}</option>`).join('')}</optgroup>`).join('')}
    </select></div>
    <p class="muted" style="font-size:12.5px">Se copia la rutina; el borrador del otro cliente no cambia.</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-ent-accion="nuevo-otro-ok">Crear borrador</button></div>`;
}

return { desbloqueo, seccion, fichaForm, confirmarEmision, elegirOtro, cambiosHtml };
})();
