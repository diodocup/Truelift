'use strict';
/* ================================================================
   TrueLift Escritorio — rutina-vista.js
   HTML de «Mi rutina» (fase 6): estado de la rutina del móvil, del
   borrador y del archivo exportado; editor con todos los días a la
   vista; cambios frente a la rutina del móvil; avisos y exportación.
   Solo genera HTML: el estado y las escrituras viven en app.js y el
   cálculo en planificador.js. Todo texto importado pasa por esc().
   ================================================================ */

const RutinaVista = (() => {

const PL = Planificador;
const F = () => VistasEsc.F;
const tarjeta = (titulo, cuerpo, extra = '') => `<section class="card"${extra}><h3>${esc(titulo)}</h3>${cuerpo}</section>`;
const chip = (clase, texto, titulo = '') => `<span class="chip ${clase}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`;
const ayuda = (txt, titulo = 'Cómo funciona') => `<details class="detalle ayuda"><summary>${esc(titulo)}</summary>${txt}</details>`;
const btn = (accion, texto, { clase = 'sec', extra = '', des = false, titulo = '' } = {}) =>
  `<button type="button" class="btn ${clase}" data-rut-accion="${accion}"${des ? ' disabled' : ''}${titulo ? ` title="${esc(titulo)}"` : ''}${extra}>${texto}</button>`;
const SISTEMA = { simple: 'progresión simple', doble: 'progresión doble' };
const MODO = { normal: 'Series normales', topBack: 'Top set + back-off', drop: 'Drop set', rp: 'Rest-pause' };
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
const ESTADO_EXP = {
  aplicada: ['verde', 'En tu móvil', 'La copia importada después de exportarlo tiene esta misma rutina.'],
  aPrueba: ['ambar', 'A prueba en el móvil', 'La copia importada tiene esta rutina, pero la app la tiene a prueba: confírmala o descártala en el móvil.'],
  pendiente: ['gris', 'Sin comprobar', 'Tu copia de datos es anterior a la exportación. Importa una copia nueva del móvil para comprobar si la aplicaste.'],
  distinta: ['azul', 'No consta en el móvil', 'La copia importada después de exportarlo no contiene esta rutina: puede que no la hayas importado en la app o que la cambiaras allí.'],
};

// ---------------------------------------------------------------
// Estado: móvil · borrador · archivo exportado
// ---------------------------------------------------------------
function estado(ctx){
  const { M, movil, borrador, inst, sim } = ctx;
  const fechaCopia = inst && inst.resumen && inst.resumen.ultimoRegistro;
  const nDias = movil ? movil.normal.dias.length : 0;
  const caja1 = movil
    ? `<p><b>${esc(SISTEMA[movil.normal.sistema])} · ${nDias} días</b></p>
       <p class="muted">Según tu copia (último registro: ${F().dia(fechaCopia)}; importada ${momento(inst && inst.importadoEn)}).</p>
       ${movil.aPrueba ? chip('ambar', 'A prueba en el móvil', 'Importaste una rutina en la app y aún no la has confirmado ni descartado.') : ''}
       ${!movil.vigente ? chip('ambar', 'Puede no ser la que usas', 'Es de otra combinación de días o de sistema que la que tienes ahora en la app.') : ''}`
    : `<p><b>Sin rutina personalizada en tu copia</b></p><p class="muted">Si usas una rutina prefijada de la app, no viaja en la copia: puedes empezar un borrador en blanco o desde un Excel.</p>`;
  let caja2 = '<p><b>Ninguno</b></p><p class="muted">Crea un borrador para preparar cambios. Lo que edites aquí no cambia nada en el móvil.</p>';
  let caja3 = '<p><b>Ninguno</b></p><p class="muted">Exportar crea un Excel; el móvil solo cambia cuando lo importas allí.</p>';
  if (borrador){
    const dif = movil && sim ? PL.diferencias(movil.normal, sim.normal) : null;
    const nCambios = dif ? dif.dias.reduce((s, d) => s + d.cambios.length + (d.renombrado ? 1 : 0) + (d.ordenCambiado ? 1 : 0), 0) + (dif.sistema ? 1 : 0) : null;
    caja2 = `<p><b>${esc(borrador.nombre)}</b></p>
      <p class="muted">Guardado en este navegador ${momento(borrador.actualizado)}.${dif ? (dif.iguales ? ' Igual que la rutina del móvil.' : ` ${nCambios} ${nCambios === 1 ? 'cambio' : 'cambios'} frente a la rutina del móvil.`) : ''}</p>`;
    const exp = borrador.exportaciones[borrador.exportaciones.length - 1];
    if (exp){
      const st = PL.estadoExportacion(exp, ctx.raw, inst);
      const [cl, txt, largo] = ESTADO_EXP[st];
      const cambiadoDesde = sim && PL.firma(sim.normal) !== exp.firma;
      caja3 = `<p><b>${esc(exp.archivo)}</b></p><p class="muted">Exportado ${momento(exp.fecha)}.</p>
        <p>${chip(cl, txt, largo)}</p><p class="muted" style="font-size:12.5px">${esc(largo)}</p>
        ${cambiadoDesde ? `<p>${chip('ambar', 'Borrador cambiado después')}</p>` : ''}`;
    }
  }
  return `<section class="card rut-estado" aria-label="Estado de tu rutina">
    <div><h3>En tu móvil</h3>${caja1}</div>
    <div><h3>Borrador</h3>${caja2}</div>
    <div><h3>Archivo exportado</h3>${caja3}</div>
  </section>`;
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

function gruposHtml(rg){
  if (!rg || !rg.filas.length) return '<p class="muted">Sin series que repartir por grupo.</p>';
  const d = (v, dec = 1) => v == null || v === 0 ? '<span class="muted">=</span>' : `<b class="${v > 0 ? 'sube' : 'baja'}">${v > 0 ? '+' : '−'}${fmtNum(Math.abs(v), dec)}</b>`;
  const filas = rg.filas.map(f => [esc(f.grupo), fmtNum(f.seriesAntes ?? 0, 1), fmtNum(f.seriesDespues ?? 0, 1), d(f.dSeries),
    String(f.diasAntes ?? 0), String(f.diasDespues ?? 0), d(f.dDias, 0)]);
  const sin = rg.despues && rg.despues.sinGrupo.length
    ? `<p class="muted" style="font-size:12.5px">No suman a ningún grupo porque no están en el catálogo ni en tu biblioteca: ${rg.despues.sinGrupo.map(esc).join(', ')}.</p>` : '';
  return VistasEsc.tabla(['Grupo', 'Series ahora', 'Series borrador', 'Diferencia', 'Días ahora', 'Días borrador', 'Diferencia'], filas,
    { caption: 'Series semanales y días por grupo: rutina del móvil frente al borrador' }) + sin;
}

// ---------------------------------------------------------------
// Editor
// ---------------------------------------------------------------
function campoNum(id, d, f, k, v, min, max, etiqueta, ancho = 'n2'){
  return `<label class="rut-campo ${ancho}" for="${id}"><span>${esc(etiqueta)}</span>
    <input id="${id}" type="number" inputmode="numeric" data-rut="campo" data-d="${d}" data-f="${f}" data-k="${k}" value="${v ?? ''}" min="${min}" max="${max}" step="1"></label>`;
}

function fila(rutina, d, i, f, ss, ctx){
  const id = k => `rut-${d}-${i}-${k}`;
  const modo = f.topBack ? 'topBack' : f.dropSet ? 'drop' : f.restPause ? 'rp' : 'normal';
  const ant = i > 0 ? rutina.dias[d].filas[i - 1] : null;
  const enSS = ss[i] > 0;
  const ssChoca = modo !== 'normal' || (ant && (ant.topBack || ant.dropSet || ant.restPause));
  const listaId = `rut-lista-${(CAT_PATRONES.indexOf(f.patron) + 1) || 0}`;
  ctx.listas.add(f.patron || '');
  const nombre = f.ejercicio || 'ejercicio sin elegir';
  const params = modo === 'topBack'
    ? campoNum(id('backoffPct'), d, i, 'backoffPct', f.backoffPct, 5, 30, '% menos en back-offs') + campoNum(id('rirBack'), d, i, 'rirBack', f.rirBack, 0, 6, 'RIR back-offs')
    : modo === 'drop' ? campoNum(id('dropPct'), d, i, 'dropPct', f.dropPct, 5, 30, '% menos en cada drop')
    : modo === 'rp' ? `<label class="rut-campo n3" for="${id('pausaRpSeg')}"><span>Pausa entre series</span><select id="${id('pausaRpSeg')}" data-rut="campo" data-d="${d}" data-f="${i}" data-k="pausaRpSeg">
        ${[10, 20, 30, 40, 50].map(v => `<option value="${v}"${v === (f.pausaRpSeg || 20) ? ' selected' : ''}>${v} s</option>`).join('')}</select></label>` : '';
  const ssTitulo = ssChoca ? 'Una superserie va a series normales: quita la modalidad de esta fila y de la anterior.' : 'Alterna sus series con el ejercicio anterior (A1→B1→A2…).';
  return `<li class="rut-fila${enSS ? ' en-ss' : ''}" data-d="${d}" data-f="${i}" aria-label="${esc(rutina.dias[d].nombre)}, ejercicio ${i + 1}: ${esc(nombre)}">
    <div class="rut-fila-cab">
      <span class="rut-num" aria-hidden="true">${i + 1}</span>
      <label class="rut-campo ej" for="${id('ejercicio')}"><span>Ejercicio</span>
        <input id="${id('ejercicio')}" type="text" list="${listaId}" autocomplete="off" data-rut="campo" data-d="${d}" data-f="${i}" data-k="ejercicio" value="${esc(f.ejercicio || '')}" placeholder="Escribe o elige"></label>
      <span class="rut-mover">
        <button type="button" class="btn-mini" id="${id('arriba')}" data-rut-accion="fila-arriba" data-d="${d}" data-f="${i}" aria-label="Subir ${esc(nombre)}"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="btn-mini" id="${id('abajo')}" data-rut-accion="fila-abajo" data-d="${d}" data-f="${i}" aria-label="Bajar ${esc(nombre)}"${i === rutina.dias[d].filas.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="btn-mini peligro" id="${id('quitar')}" data-rut-accion="fila-quitar" data-d="${d}" data-f="${i}" aria-label="Quitar ${esc(nombre)}">✕</button>
      </span>
    </div>
    <div class="rut-fila-campos">
      <label class="rut-campo pat" for="${id('patron')}"><span>Patrón</span><select id="${id('patron')}" data-rut="campo" data-d="${d}" data-f="${i}" data-k="patron">
        ${CAT_PATRONES.map(p => { const v = p === '(Ninguno)' ? '' : p; return `<option value="${esc(v)}"${v === (f.patron || '') ? ' selected' : ''}>${esc(p)}</option>`; }).join('')}
        ${f.patron && !CAT_PATRONES.includes(f.patron) ? `<option value="${esc(f.patron)}" selected>${esc(f.patron)}</option>` : ''}</select></label>
      ${campoNum(id('series'), d, i, 'series', f.series, 1, 10, 'Series')}
      ${campoNum(id('repsMin'), d, i, 'repsMin', f.repsMin, 1, modo === 'rp' ? 60 : 30, modo === 'rp' ? (rutina.sistema === 'doble' ? 'Reps totales mín' : 'Reps totales') : rutina.sistema === 'doble' ? 'Reps mín' : 'Reps')}
      ${rutina.sistema === 'doble' ? campoNum(id('repsMax'), d, i, 'repsMax', f.repsMax, 1, modo === 'rp' ? 60 : 30, modo === 'rp' ? 'Reps totales máx' : 'Reps máx') : ''}
      ${modo === 'rp' ? '<span class="rut-campo n2 rut-fijo"><span>RIR</span><b title="En rest-pause todas las series van al fallo">al fallo</b></span>' : campoNum(id('rir'), d, i, 'rir', f.rir, 0, 6, 'RIR')}
      <label class="rut-campo n3" for="${id('descanso')}"><span>Descanso</span><select id="${id('descanso')}" title="Por defecto: el descanso que la app propone para ese ejercicio" data-rut="campo" data-d="${d}" data-f="${i}" data-k="descanso">
        <option value=""${f.descanso == null ? ' selected' : ''}>Por defecto</option>
        ${CAT_DESCANSOS.map(v => `<option value="${v}"${v === f.descanso ? ' selected' : ''}>${fmtNum(v, 1)} min</option>`).join('')}
        ${f.descanso != null && !CAT_DESCANSOS.includes(f.descanso) ? `<option value="${f.descanso}" selected>${fmtNum(f.descanso, 2)} min</option>` : ''}</select></label>
      <label class="rut-campo n4" for="${id('modalidad')}"><span>Modalidad</span><select id="${id('modalidad')}" data-rut="campo" data-d="${d}" data-f="${i}" data-k="modalidad"${enSS ? ' disabled title="En una superserie se entrena a series normales: quita la superserie para usar otra modalidad."' : ''}>
        ${Object.entries(MODO).map(([k, t]) => `<option value="${k}"${k === modo ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${params}
      ${i > 0 ? `<label class="rut-ss" for="${id('superConAnterior')}" title="${esc(ssTitulo)}"><input id="${id('superConAnterior')}" type="checkbox" data-rut="campo" data-d="${d}" data-f="${i}" data-k="superConAnterior"${f.superConAnterior && !ssChoca ? ' checked' : ''}${ssChoca ? ' disabled' : ''}> Superserie con el anterior</label>` : ''}
    </div>
    ${enSS ? `<p class="rut-meta">${chip('azul', `Superserie ${ss[i]}`)}</p>` : ''}
  </li>`;
}

function editor(ctx){
  const { borrador } = ctx;
  const r = borrador.rutina;
  ctx.listas = new Set();
  const dias = r.dias.map((dia, d) => {
    const ss = XLSX._numerosSuperserie(dia.filas);
    const series = dia.filas.reduce((s, f) => s + (f.ejercicio ? Number(f.series) || 0 : 0), 0);
    const nEj = dia.filas.filter(f => f.ejercicio).length;
    return `<section class="card rut-dia" aria-labelledby="rut-dia-${d}-titulo">
      <div class="rut-dia-cab">
        <h3 id="rut-dia-${d}-titulo" class="sr-only">Día ${d + 1}: ${esc(dia.nombre)}</h3>
        <label class="rut-campo nombre" for="rut-${d}-nombre"><span>Día ${d + 1}</span>
          <input id="rut-${d}-nombre" type="text" maxlength="40" data-rut="nombreDia" data-d="${d}" value="${esc(dia.nombre)}"></label>
        <span class="rut-mover">
          <button type="button" class="btn-mini" id="rut-${d}-diaIzq" data-rut-accion="dia-antes" data-d="${d}" aria-label="Mover ${esc(dia.nombre)} antes"${d === 0 ? ' disabled' : ''}>←</button>
          <button type="button" class="btn-mini" id="rut-${d}-diaDer" data-rut-accion="dia-despues" data-d="${d}" aria-label="Mover ${esc(dia.nombre)} después"${d === r.dias.length - 1 ? ' disabled' : ''}>→</button>
          <button type="button" class="btn-mini peligro" id="rut-${d}-diaQuitar" data-rut-accion="dia-quitar" data-d="${d}" aria-label="Quitar ${esc(dia.nombre)}"${r.dias.length <= 1 ? ' disabled' : ''}>✕</button>
        </span>
      </div>
      <p class="muted rut-dia-resumen">${nEj} ${nEj === 1 ? 'ejercicio' : 'ejercicios'} · ${series} series</p>
      <ol class="rut-filas">${dia.filas.map((f, i) => fila(r, d, i, f, ss, ctx)).join('')}</ol>
      ${dia.filas.length < XLSX.MAX_FILAS ? btn('fila-nueva', '+ Ejercicio', { extra: ` data-d="${d}" id="rut-${d}-nueva"` }) : '<p class="muted" style="font-size:12px">Máximo de ejercicios por día en el Excel de la app.</p>'}
    </section>`;
  }).join('');
  const listas = [...ctx.listas].map(p => {
    const idx = (CAT_PATRONES.indexOf(p) + 1) || 0;
    const ops = p ? PL.opcionesEjercicio(p, ctx.raw) : [...new Set([...Object.keys(CAT_FICHA), ...PL.opcionesEjercicio('', ctx.raw)])].sort((a, b) => a.localeCompare(b, 'es'));
    return `<datalist id="rut-lista-${idx}">${ops.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>`;
  }).join('');
  return `<div class="rut-dias">${dias}</div>${listas}
    ${r.dias.length < XLSX.MAX_DIAS ? `<div class="fila-botones">${btn('dia-nuevo', `+ Día (${r.dias.length}/${XLSX.MAX_DIAS})`, { extra: ' id="rut-dia-nuevo"' })}</div>` : ''}`;
}

// ---------------------------------------------------------------
// Página
// ---------------------------------------------------------------
function html(ctx){
  const { M, movil, borrador, borradores, pila, error } = ctx;
  const out = ['<div class="cabecera-seccion"><h1>Mi rutina</h1></div>'];
  if (error) out.push(`<div class="alerta rojo" role="alert"><span class="tag">No guardado</span><span>${esc(error)}</span></div>`);
  if (movil && movil.recortada)
    out.push('<div class="alerta ambar"><span class="tag">Revisar</span><span>Tu rutina del móvil tiene más días o más ejercicios por día de los que admite el Excel de la app. Un borrador hecho a partir de ella no los incluiría.</span></div>');
  ctx.sim = borrador ? PL.comoLaApp(borrador.rutina, ctx.rawExport || ctx.raw) : null;
  out.push(estado(ctx));

  // Discrepancia: la rutina del móvil cambió desde que empezó el borrador.
  const dis = borrador ? PL.discrepancia(borrador, ctx.raw) : null;
  if (dis){
    out.push(`<section class="card alerta-card" role="region" aria-label="La rutina del móvil ha cambiado">
      <div class="alerta ambar"><span class="tag">Cambió en el móvil</span><span>${dis.sinRutina
        ? 'Tu copia más reciente ya no trae la rutina personalizada de la que partió este borrador.'
        : 'La rutina de tu última copia no es la misma de la que partió este borrador. Tu borrador no se ha tocado.'}</span></div>
      ${dis.diff ? `<details class="detalle" open><summary>Qué cambió en el móvil desde que empezaste el borrador</summary>${cambiosHtml(dis.diff)}</details>` : ''}
      <div class="fila-botones">
        ${btn('rebasar', 'Mantener mi borrador y compararlo con la rutina actual', { titulo: 'El borrador no cambia; la comparación y la «rutina de partida» pasan a ser la del móvil actual.' })}
        ${movil ? btn('nuevo-movil', 'Crear otro borrador desde la rutina actual') : ''}
      </div></section>`);
  }

  // Barra de borradores.
  const sel = borradores.length > 1
    ? `<label class="rut-campo nombre" for="rutSelBorrador"><span>Borrador</span><select id="rutSelBorrador" data-rut="borrador">
        ${borradores.map(b => `<option value="${esc(b.id)}"${borrador && b.id === borrador.id ? ' selected' : ''}>${esc(b.nombre)}</option>`).join('')}</select></label>` : '';
  const acciones = `<section class="card rut-barra" aria-label="Borradores">
    <div class="fila-botones">${sel}
      ${movil ? btn('nuevo-movil', 'Nuevo borrador desde la rutina del móvil', { clase: borrador ? 'sec' : 'pri' }) : ''}
      ${btn('nuevo-blanco', 'Nuevo en blanco')}
      ${btn('abrir-excel', 'Abrir un Excel de rutina…')}
      <input type="file" id="rutExcel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      ${borrador ? btn('duplicar', 'Duplicar') + btn('renombrar', 'Renombrar') + btn('eliminar', 'Eliminar', { clase: 'peligro' }) : ''}
    </div>
    ${borrador ? `<div class="fila-botones">
      ${btn('deshacer', 'Deshacer', { des: !pila.deshacer, titulo: 'Ctrl + Z fuera de un campo de texto', extra: ' id="rutDeshacer"' })}
      ${btn('rehacer', 'Rehacer', { des: !pila.rehacer, titulo: 'Ctrl + Y fuera de un campo de texto', extra: ' id="rutRehacer"' })}
      ${btn('partida', 'Volver a la rutina de partida', { titulo: 'Recupera la rutina con la que empezaste este borrador. Se puede deshacer.' })}
      <label class="rut-campo n4" for="rutSistema"><span>Sistema</span><select id="rutSistema" data-rut="sistema">
        <option value="doble"${borrador.rutina.sistema === 'doble' ? ' selected' : ''}>Progresión doble</option>
        <option value="simple"${borrador.rutina.sistema === 'simple' ? ' selected' : ''}>Progresión simple</option></select></label>
      <span class="spacer"></span>
      ${btn('exportar', 'Exportar Excel para la app', { clase: 'pri', extra: ' id="rutExportar"' })}
    </div>` : ''}
  </section>`;
  out.push(acciones);

  if (!borrador){
    out.push(VistasEsc.rutina(M, { sinCabecera: true }));
    out.push(ayudaGeneral());
    return out.join('');
  }

  out.push(editor(ctx));

  // Cambios frente al móvil, series por grupo, avisos y progresión.
  const av = PL.avisos(borrador.rutina, ctx.raw);
  const dif = movil ? PL.diferencias(movil.normal, ctx.sim.normal) : null;
  const rg = PL.resumenGrupos(M, movil ? movil.normal : null, ctx.sim.normal);
  const prog = PL.progresion(ctx.raw, ctx.sim);
  out.push(`<div class="grid cols2 rut-analisis">
    ${tarjeta('Cambios frente a la rutina del móvil', movil
      ? cambiosHtml(dif, { vacio: 'Tu borrador es igual que la rutina del móvil.' })
      : '<p class="muted">Tu copia no trae una rutina personalizada con la que comparar.</p>', ' id="rutCambios"')}
    ${tarjeta('Avisos antes de exportar', av.avisos.length
      ? av.avisos.map(a => `<div class="alerta ${a.nivel}"><span class="tag">${a.nivel === 'rojo' ? 'Impide exportar' : a.nivel === 'ambar' ? 'Revisa' : 'Nota'}</span><span>${esc(a.txt)}</span></div>`).join('')
      : '<p class="muted">Sin avisos: la app podrá leer este borrador tal cual.</p>', ' id="rutAvisos"')}
  </div>`);
  out.push(tarjeta('Series por grupo muscular y semana', gruposHtml(rg) +
    ayuda('<p class="muted">Mismo reparto que la pestaña de volumen de la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. Se cuenta una pasada por cada día de la rutina. «Días» son los días en que el grupo recibe al menos una serie completa.</p>', 'Cómo leer esto')));
  if (prog) out.push(tarjeta('Tus cargas al aplicar esta rutina', prog.conserva
    ? '<p>Mantienes el sistema de progresión y el número de días. Según la app, en los ejercicios que se repitan seguirá proponiéndote los pesos que ya venías usando.</p><p class="muted">Es lo que indica la app al importar una rutina; ella misma te lo confirma antes de aplicar nada.</p>'
    : `<p>Cambias ${[!prog.mismosDias ? `el número de días (${esc(prog.diasAntes)} → ${ctx.sim.dias.length})` : '', !prog.mismoSistema ? `el sistema (${esc(SISTEMA[prog.sistemaAntes])} → ${esc(SISTEMA[ctx.sim.sistema])})` : ''].filter(Boolean).join(' y ')}. Según la app, al importarla volverá a proponerte las cargas desde el principio; tu historial y tus récords se conservan.</p><p class="muted">Es lo que indica la app al importar una rutina; ella misma te lo confirma antes de aplicar nada.</p>`));
  out.push(ayudaGeneral());
  return out.join('');
}

function ayudaGeneral(){
  return ayuda(`<ul class="lista-plana">
    <li><b>Rutina del móvil:</b> la que trae tu copia de datos. Es de consulta: aquí no se cambia.</li>
    <li><b>Borrador:</b> tus cambios, guardados solo en este navegador. Puedes tener varios. Importar una copia nueva no los borra.</li>
    <li><b>Archivo exportado:</b> el Excel que genera «Exportar». Tu móvil no cambia hasta que lo importas allí: en la app, <b>Rutina → Importar</b>. La app te enseña la rutina a prueba y decides si la confirmas.</li>
    <li>Para comprobar si la aplicaste, exporta una copia nueva desde el móvil e impórtala aquí.</li>
    <li>Si la app no admite algo del archivo con tu versión, te lo explica al importarlo. Los ejercicios que no tengas en tu biblioteca se añaden solo si lo aceptas.</li>
  </ul>`);
}

/* Contenido del diálogo de exportación. */
function confirmarExportacion(ctx){
  const { borrador, movil } = ctx;
  const sim = PL.comoLaApp(borrador.rutina, ctx.rawExport || ctx.raw);
  const dif = movil ? PL.diferencias(movil.normal, sim.normal) : null;
  const prog = PL.progresion(ctx.raw, sim);
  return `<h2 id="modalTitulo">Exportar «${esc(borrador.nombre)}»</h2>
    <p>Se descargará un Excel con ${sim.dias.length} días (${esc(SISTEMA[sim.sistema])}). <b>Tu móvil no cambia todavía:</b> impórtalo en la app desde <b>Rutina → Importar</b>.</p>
    ${dif ? `<details class="detalle"${dif.iguales ? '' : ' open'}><summary>Cambios frente a la rutina del móvil</summary>${cambiosHtml(dif, { vacio: 'Igual que la rutina del móvil.' })}</details>` : ''}
    ${prog && !prog.conserva ? '<div class="alerta ambar"><span class="tag">Cargas</span><span>Cambias el número de días o el sistema: según la app, volverá a proponerte las cargas desde el principio (tu historial y tus récords se conservan).</span></div>' : ''}
    <p class="muted" style="font-size:12.5px">El archivo se guarda donde tu navegador guarda las descargas. Pásalo al móvil como prefieras (correo, nube, cable).</p>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="cerrar">Cancelar</button>
      <button class="btn pri" type="button" data-rut-accion="exportar-confirmar" autofocus>Descargar Excel</button></div>`;
}

return { html, confirmarExportacion, cambiosHtml };
})();
