'use strict';
/* ================================================================
   TrueLift Escritorio — vistas.js
   HTML de las secciones personales a partir del modelo de
   analisis.js. Todo texto que llega de la copia (nombres, notas,
   días) pasa por esc(): nunca se interpreta como HTML.

   Textos: explican qué se ve y para qué, sin umbrales ni ventanas
   del algoritmo (eso vive en METRICAS.md).
   ================================================================ */

const VistasEsc = (() => {

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const F = {
  dia(d){ if (!d) return '—'; if (typeof d === 'string') d = parseFecha(d); return d ? `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}` : '—'; },
  corta(d){ return d ? `${d.getDate()} ${MES[d.getMonth()]}` : '—'; },
  num(n, dec = 1){ return fmtNum(n, dec); },
  kg(n, dec = 1){ return n == null ? '—' : `${fmtNum(n, dec)} kg`; },
  signo(n, dec = 1){ return n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n), dec)} %`; },
  plural(n, a, b){ return `${n} ${n === 1 ? a : b}`; },
  series(arr){ return arr.map(v => v == null ? '·' : String(v)).join(' / '); },
};

const tarjeta = (titulo, cuerpo, extra = '') => `<section class="card"${extra}><h3>${esc(titulo)}</h3>${cuerpo}</section>`;
const vacio = msg => `<p class="muted">${msg}</p>`;
const cifra = (valor, etiqueta, aviso = false) =>
  `<div class="cifra${aviso ? ' aviso' : ''}"><b>${esc(valor)}</b><span>${esc(etiqueta)}</span></div>`;
const chip = (clase, texto, titulo = '') => `<span class="chip ${clase}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`;
const ayuda = (txt) => `<details class="detalle ayuda"><summary>Cómo leer esto</summary><p class="muted">${txt}</p></details>`;
const ir = (seccion, texto, extra = '') => `<button type="button" class="btn sec btn-enlace" data-ir="${esc(seccion)}"${extra}>${esc(texto)}</button>`;

function tabla(cab, filas, { caption = '', clase = '' } = {}){
  return `<div class="tabla-scroll"><table class="${clase}">${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}
    <thead><tr>${cab.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map((c, i) => i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* Gráfica con su alternativa en tabla: el SVG es decorativo para el lector
   de pantalla (role=img con resumen); la tabla trae los mismos números. */
function grafica(svg, resumen, tablaHtml){
  return `<div class="chart-caja" role="img" aria-label="${esc(resumen)}">${svg}</div>
    <details class="detalle"><summary>Ver los datos en tabla</summary>${tablaHtml}</details>`;
}

// ---------------------------------------------------------------
// Textos de estado (comparten palabras con la app)
// ---------------------------------------------------------------
const VALORACION = {
  mejora: { deficit: 'Mejorando en déficit', superavit: 'El superávit está funcionando', normo: 'Progresando',
            frase: n => `Tus últimas ${n} sesiones van por encima de tu nivel reciente.`, tono: 'verde' },
  sostiene: { deficit: 'Buena retención', superavit: 'Nivel sostenido', normo: 'Nivel sostenido',
              frase: n => `Tus últimas ${n} sesiones se mantienen en tu nivel.`, tono: 'gris' },
  cae: { todos: 'Rendimiento a la baja', frase: n => `Tus últimas ${n} sesiones quedan por debajo de tu nivel reciente.`, tono: 'rojo' },
  mixta: { todos: 'Rendimiento irregular', frase: n => `Tus últimas ${n} sesiones alternan días buenos y flojos.`, tono: 'ambar' },
};
function fase(raw){ return raw.fasePeso === 'deficit' ? 'deficit' : raw.fasePeso === 'superavit' ? 'superavit' : 'normo'; }
const FASE_TXT = { deficit: 'Déficit (perder peso)', superavit: 'Superávit (ganar peso)', normo: 'Normocalórica (mantener)' };
const VEREDICTO = { bueno: ['verde', 'Buena'], normal: ['gris', 'Normal'], flojo: ['ambar', 'Floja'], 'muy flojo': ['rojo', 'Muy floja'] };

function estadoTexto(st){
  switch (st.tipo){
    case 'porTiempo': return { clase: 'gris', corto: 'Por tiempo', largo: 'Se mide en segundos: no tiene 1RM estimado.' };
    case 'fueraDeRutina': return { clase: 'gris', corto: 'Fuera de tu rutina', largo: 'No está en tu rutina actual: se muestra su historial, sin valorar su progresión.' };
    case 'rutinaDesconocida': return { clase: 'gris', corto: 'Sin valorar', largo: 'Tu copia no incluye la rutina que usas ahora, así que solo se muestra su historial.' };
    case 'sinObjetivo': return { clase: 'gris', corto: 'Sin objetivo', largo: 'Su línea de la rutina no fija un número de repeticiones.' };
    case 'sinOportunidades': return { clase: 'gris', corto: 'Datos insuficientes', largo: 'Aún no hay sesiones de tu rutina actual que cuenten para su progresión.' };
    case 'objetivoCumplido': return { clase: 'verde', corto: 'Objetivo cumplido', largo: 'En su última sesión válida llegaste al objetivo de repeticiones.' };
    case 'enCurso': return { clase: 'azul', corto: `Buscando el objetivo (${st.consumidos} de ${st.max} intentos)`,
      largo: 'Sigue buscando el objetivo de repeticiones con la misma carga. El número entre paréntesis son los intentos usados, como las barritas de la app.' };
    case 'intentosAgotados': return { clase: 'ambar', corto: 'Intentos agotados',
      largo: 'Has usado los intentos que da la app con esta carga. El siguiente paso lo decide la app según tu fase.' };
    default: return { clase: 'gris', corto: '—', largo: '' };
  }
}

// ---------------------------------------------------------------
// MI RESUMEN
// ---------------------------------------------------------------
function resumen(M, ctx){
  const out = [];
  const r = ctx.inst.resumen;
  const dias = diasEntre(M.ref, new Date());
  const antig = dias <= 0 ? 'de hoy' : dias === 1 ? 'de ayer' : `de hace ${dias} días`;
  if (!r.ultimoRegistro){
    out.push(`<div class="cabecera-seccion"><h1>Mi resumen</h1><p class="muted">Tu copia aún no tiene entrenamientos ni registros. Cuando entrenes con la app, exporta una copia nueva e impórtala.</p></div>`);
    return out.join('');
  }
  out.push(`<div class="cabecera-seccion"><h1>Mi resumen</h1>
    <p class="muted">Tus datos llegan hasta el <b>${F.dia(r.ultimoRegistro)}</b> (${antig}). Último entrenamiento: ${F.dia(r.ultimoEntreno)}. Copia importada el ${F.dia(new Date(ctx.inst.importadoEn))}.
    ${dias > 14 ? '<br>Para ver lo más reciente, exporta una copia nueva en el móvil e impórtala.' : ''}</p></div>`);

  // --- de un vistazo ---
  const hasta = soloDia(M.ref), desde = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - (Analisis.VENTANA_DIAS - 1));
  const ult = Analisis.enPeriodo(M.sesiones, desde, hasta);
  const kcifras = [
    cifra(String(ult.length), 'sesiones de fuerza en las últimas 4 semanas'),
    cifra(F.num(ult.length / 4, 1), 'por semana de media'),
    cifra(M.raw.dias ? `${M.raw.dias}` : '—', 'días por semana en tu rutina actual'),
    cifra(String(M.sesiones.length), 'sesiones de fuerza en total'),
  ];
  const P = Analisis.peso(M);
  if (P && P.actual) kcifras.push(cifra(F.kg(P.actual.tendenciaKg), `peso tendencia (${F.corta(P.actual.fecha)})`));
  else if (M.pc) kcifras.push(cifra(F.kg(M.pc), 'peso de tu perfil'));
  out.push(tarjeta('De un vistazo', `<div class="cifras">${kcifras.join('')}</div>
    <p class="muted" style="font-size:12.5px">Periodo: ${F.dia(desde)} – ${F.dia(hasta)}. Las últimas semanas terminan en tu último registro, no en el día de hoy.</p>`));

  // --- conclusiones priorizadas ---
  out.push(tarjetaConclusiones(M));

  // --- detalle ---
  out.push(`<div class="grid resumen-grid">${[tarjetaConstancia(M), tarjetaValoracion(M), tarjetaEjercicios(M),
    tarjetaComparables(M), tarjetaPeso(M, P), tarjetaRecuperacion(M)].filter(Boolean).join('')}</div>`);
  return out.join('');
}

const FASE_NUT = { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' };

/* Celda de fecha: si la fila viene de una sesión, abre su detalle. */
function celdaFecha(f){
  if (f.semana) return `${F.corta(f.fecha)}–${F.corta(new Date(f.fecha.getFullYear(), f.fecha.getMonth(), f.fecha.getDate() + 6))}`;
  return f.indice != null ? `<button type="button" class="enlace" data-sesion="${f.indice}">${F.dia(f.fecha)}</button>` : F.dia(f.fecha);
}

function conclusionHtml(c, i){
  const id = `concl-${i}`;
  return `<article class="conclusion tono-${esc(c.tono)}" aria-labelledby="${id}">
    <h4 id="${id}">${esc(c.titulo)}</h4>
    <p>${esc(c.texto)}</p>
    <p class="muted periodo">Periodo: ${F.dia(c.periodo.desde)} – ${F.dia(c.periodo.hasta)}</p>
    <details class="detalle"><summary>Datos que la respaldan (${c.datos.filas.length})</summary>
      ${tabla(c.datos.cabecera.map(esc), c.datos.filas.map(f => [celdaFecha(f), ...f.celdas.map(esc)]), { caption: `Datos de: ${c.titulo}` })}
    </details>
    <details class="detalle"><summary>Limitaciones</summary><ul class="lista-plana">${c.limitaciones.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>
    <div class="fila-botones">${ir(c.enlace.destino, c.enlace.texto)}</div>
  </article>`;
}

function tarjetaConclusiones(M){
  const lista = Analisis.conclusiones(M).slice(0, 3);
  const cuerpo = lista.length
    ? `<div class="conclusiones">${lista.map(conclusionHtml).join('')}</div>`
    : vacio('Con los datos de tus últimas semanas no hay ninguna observación que se pueda respaldar. Revisa el detalle de abajo o importa una copia más reciente.');
  return tarjeta('Lo más relevante', cuerpo + ayuda('Cada observación sale de reglas fijas aplicadas a tus datos, las mismas cada vez. Se ordenan por importancia y se muestran como mucho tres. Describen lo que ha pasado; no dicen por qué ni sustituyen la opinión de un profesional de la salud. Abre «Datos que la respaldan» para ver los registros y pulsa una fecha para ver la sesión completa.'));
}

const MOTIVO_PLAN = { inicio: 'antes de tu primera sesión registrada', cambioRutina: 'cambiaste de rutina y no se sabe desde cuándo', sinDias: 'la rutina no indica días por semana', enCurso: 'semana en curso' };

function tarjetaConstancia(M){
  if (!M.sesiones.length) return tarjeta('Constancia', vacio('Aún no hay sesiones de fuerza.'));
  const k = Analisis.constancia(M);
  const filas = k.semanas.map(f => [`${F.corta(f.inicio)}–${F.corta(f.fin)}`, String(f.sesiones), String(f.dias),
    f.previstas != null ? String(f.previstas) : `<span class="muted" title="${esc(MOTIVO_PLAN[f.motivo] || '')}">sin calcular</span>`,
    f.descarga ? chip('azul', 'Descarga') : '']);
  if (k.actual) filas.push([`${F.corta(k.actual.inicio)}–${F.corta(k.actual.hasta)} <span class="muted">(en curso)</span>`, String(k.actual.sesiones), String(k.actual.dias),
    '<span class="muted">—</span>', k.actual.descarga ? chip('azul', 'Descarga') : '']);
  const res = k.conocidas
    ? `<p>En ${F.plural(k.conocidas, 'semana completa', 'semanas completas')} con la rutina conocida: <b>${k.hechas} de ${k.previstas}</b> días previstos.</p>`
    : '<p>No se puede saber qué rutina tenías en estas semanas, así que no se calculan días previstos.</p>';
  return tarjeta('Constancia', `${res}${tabla(['Semana', 'Sesiones', 'Días con sesión', 'Previstos', ''], filas, { caption: 'Sesiones por semana' })}
    ${ayuda('Las semanas van de lunes a domingo. «Previstos» son los días por semana de la rutina con la que entrenabas esa semana, según tus propias sesiones; si en una semana no se puede saber qué rutina tenías (por ejemplo, porque la cambiaste sin entrenar con ella aún), queda sin calcular en lugar de suponer la rutina de hoy. La semana en curso no se valora.')}
    <div class="fila-botones">${ir('entrenamiento:sesiones', 'Ver mis sesiones')}</div>`);
}

function tarjetaEjercicios(M){
  const cuenta = { objetivoCumplido: 0, enCurso: 0, intentosAgotados: 0 };
  const agot = [];
  M.ejercicios.forEach(ej => ej.estados.forEach(st => {
    if (cuenta[st.tipo] != null) cuenta[st.tipo]++;
    if (st.tipo === 'intentosAgotados') agot.push(`<button type="button" class="enlace" data-ejercicio="${esc(ej.nombre)}">${esc(ej.nombre)}</button> <span class="muted">(${esc(st.dia)})</span>`);
  }));
  return tarjeta('Estado de tus ejercicios', M.planConocido
    ? `<div class="cifras">${cifra(String(cuenta.objetivoCumplido), 'con el objetivo cumplido en su última sesión válida')}
        ${cifra(String(cuenta.enCurso), 'buscando el objetivo')}
        ${cifra(String(cuenta.intentosAgotados), 'con los intentos agotados', cuenta.intentosAgotados > 0)}</div>
       ${agot.length ? `<p style="font-size:13px">Intentos agotados: ${agot.join(', ')}.</p>` : ''}
       <p class="muted" style="font-size:12.5px">Mismo criterio que la app para tu rutina actual. Los ejercicios que no están en ella no se valoran.</p>
       <div class="fila-botones">${ir('entrenamiento:ejercicios', 'Ver mis ejercicios')}</div>`
    : `<p>Tu copia no incluye la rutina que usas ahora en el móvil (por ejemplo, si usas una rutina prefijada de la app), así que no se valora la progresión de cada ejercicio. Su historial sí está disponible.</p>
       <div class="fila-botones">${ir('entrenamiento:ejercicios', 'Ver mis ejercicios')}</div>`);
}

const LECTURA = { sube: ['verde', 'Al alza'], baja: ['ambar', 'A la baja'], sinCambios: ['gris', 'Sin cambios claros'], insuficiente: ['gris', 'Datos insuficientes'] };

function tarjetaComparables(M){
  const lista = Analisis.comparables(M);
  if (!lista.length) return tarjeta('Evolución de tus ejercicios', vacio('No entrenaste ejercicios con carga en las últimas semanas.'));
  const filas = lista.map(x => {
    const [cl, txt] = LECTURA[x.lectura];
    return [`<button type="button" class="enlace" data-ejercicio="${esc(x.nombre)}">${esc(x.nombre)}</button>`,
      `${x.n} <span class="muted">de ${x.enPeriodo}</span>`, x.inicio != null ? F.kg(x.inicio) : '—', x.fin != null ? F.kg(x.fin) : '—',
      x.deltaPct != null ? F.signo(x.deltaPct) : '—', chip(cl, txt, x.lectura !== 'insuficiente' && !x.firme ? 'Pocas sesiones comparables: no se usa como conclusión' : '')];
  });
  return tarjeta('Evolución de tus ejercicios', `${tabla(['Ejercicio', 'Sesiones comparables', 'Al principio', 'Al final', 'Cambio', 'Lectura'], filas, { caption: 'Evolución del 1RM estimado en las últimas semanas' })}
    ${ayuda('Compara el 1RM estimado del principio y del final de tus últimas semanas, solo con las sesiones normales de cada ejercicio (en verde, sin descarga, sin molestias ni cambios de un día) y con la misma modalidad de series. «Sin cambios claros» describe una diferencia pequeña; no significa que estés estancado. Con pocas sesiones comparables la lectura es orientativa y no se usa como conclusión. El 1RM es una estimación a partir de tus series.')}`);
}

function tarjetaPeso(M, P){
  if (!P){
    return M.pc ? tarjeta('Peso y fase', `<p>Tu copia no trae pesajes (la nutrición de la app no está activa). Peso de tu perfil: ${F.kg(M.pc)}.</p>`) : null;
  }
  const f = P.fase;
  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  return tarjeta('Peso y fase', `
    ${kv('Peso tendencia', P.actual ? `${F.kg(P.actual.tendenciaKg)} <span class="muted">· ${F.corta(P.actual.fecha)}</span>` : 'sin datos suficientes')}
    ${kv('Cambio en las últimas 4 semanas', P.cambioKg != null ? `${P.cambioKg > 0 ? '+' : P.cambioKg < 0 ? '−' : ''}${F.num(Math.abs(P.cambioKg), 2)} kg` : 'sin datos suficientes')}
    ${kv('Ritmo real', P.tasaReal != null ? `${F.signo(P.tasaReal, 2)} del peso por semana` : 'sin datos suficientes')}
    ${f ? kv('Fase de nutrición', `${esc(FASE_NUT[f.tipo] || f.tipo)}${P.diasEnFase != null ? ` <span class="muted">· ${F.plural(Math.floor(P.diasEnFase / 7), 'semana', 'semanas')}</span>` : ''}`) : ''}
    ${f && f.tipo !== 'MAINTENANCE' ? kv('Ritmo objetivo de la fase', `${F.signo(f.tasaObjetivoPctSemana, 2)} por semana`) : ''}
    ${f && f.pesoObjetivoKg > 0 ? kv('Peso objetivo', F.kg(f.pesoObjetivoKg)) : ''}
    <p class="muted" style="font-size:12.5px">Último pesaje: ${F.dia(P.ultimoPesaje.fecha)}. El peso tendencia es el que calcula la app para suavizar las variaciones diarias. Los ajustes de calorías los decide la app; aquí solo se muestran.</p>
    <div class="fila-botones">${ir('fisica', 'Ver evolución física')}</div>`);
}

const LECTURA_REC = { buena: 'la mayoría de días tu estado para entrenar fue bueno', cargada: 'muchos días tu estado para entrenar fue bajo', sinDato: null };

function tarjetaRecuperacion(M){
  const rc = Analisis.cambiosRecuperacion(M);
  const a = rc.ahora, b = rc.antes;
  const txt = l => l.registrados === 0 ? 'sin cuestionarios' : LECTURA_REC[l.lectura] || 'sin una dirección clara';
  let cuerpo;
  if (!a.activo) cuerpo = '<p>No tienes activado el cuestionario diario en la app.</p>';
  else {
    const cambio = a.lectura !== b.lectura && a.lectura !== 'sinDato' && b.lectura !== 'sinDato';
    cuerpo = `<p>${cambio ? '<b>Ha cambiado respecto al periodo anterior.</b> ' : ''}Ahora (${F.corta(a.desde)}–${F.corta(a.hasta)}): ${txt(a)}${a.registrados ? ` <span class="muted">(${a.bajos} de ${F.plural(a.registrados, 'día', 'días')} con estado bajo)</span>` : ''}.</p>
      <p class="muted" style="font-size:13px">Periodo anterior (${F.corta(b.desde)}–${F.corta(b.hasta)}): ${txt(b)}${b.registrados ? ` (${b.bajos} de ${F.plural(b.registrados, 'día', 'días')} con estado bajo)` : ''}.</p>`;
  }
  if (rc.vfcBaja.length) cuerpo += `<p>Tu VFC ha estado por debajo de tu referencia de forma sostenida en ${F.plural(rc.vfcBaja.length, 'noche reciente', 'noches recientes')}.</p>`;
  return tarjeta('Recuperación', `${cuerpo}
    <div class="fila-botones">${ir('recuperacion', 'Ver recuperación')}</div>`);
}

function tarjetaValoracion(M){
  const v = M.valoracion;
  if (v.descarga) return tarjeta('¿Estoy progresando?', `<p><b>Semana de descarga.</b> El objetivo ahora es recuperar, así que la app no valora el rendimiento hasta que termine.</p>`);
  if (!v.tendencia){
    return tarjeta('¿Estoy progresando?', `<p><b>Datos insuficientes.</b> Hacen falta más sesiones recientes con rendimiento medido para valorar la tendencia.</p>
      <p class="muted" style="font-size:12.5px">Periodo revisado: ${F.dia(new Date(+M.ref - Motor.VALORACION_DIAS * 86400000))} – ${F.dia(M.ref)}. Las descargas y las sesiones que la app guardó sin referencia previa no cuentan.</p>
      <div class="fila-botones">${ir('entrenamiento:rendimiento', 'Ver rendimiento por sesión')}</div>`);
  }
  const d = VALORACION[v.tendencia];
  const titulo = d.todos || d[fase(M.raw)];
  const n = v.ventana.length;
  const filas = v.ventana.map(p => [F.dia(p.fecha), esc(p.log.dia || '—'), F.signo(p.pct)]);
  return tarjeta('¿Estoy progresando?', `<p class="valoracion"><span class="chip ${d.tono}">${esc(titulo)}</span> ${esc(d.frase(n))}</p>
    <p class="muted" style="font-size:13px">Periodo: ${F.dia(v.ventana[0].fecha)} – ${F.dia(v.ventana[n - 1].fecha)}. Es la misma lectura que la tarjeta de valoración de Progreso en la app, con los datos hasta tu último registro.</p>
    <details class="detalle"><summary>Datos que la respaldan</summary>
      ${tabla(['Fecha', 'Sesión', 'Rendimiento frente a tu nivel'], filas, { caption: 'Sesiones de la valoración' })}
      <p class="muted" style="font-size:12.5px">Cada cifra es el rendimiento que la app calculó y guardó al terminar la sesión. La app puede añadir contexto de tu fase de nutrición que aquí no se reproduce.</p></details>
    <div class="fila-botones">${ir('entrenamiento:rendimiento', 'Ver rendimiento por sesión')}</div>`);
}

// ---------------------------------------------------------------
// ENTRENAMIENTO
// ---------------------------------------------------------------
const SUBS = [['sesiones', 'Sesiones'], ['ejercicios', 'Ejercicios'], ['rendimiento', 'Rendimiento'], ['volumen', 'Volumen']];

function subnav(actual, seccion){
  return `<nav class="subnav" aria-label="Apartados">${SUBS.map(([k, t]) =>
    `<button type="button" data-ir="${seccion}:${k}" ${k === actual ? 'aria-current="true" class="activa"' : ''}>${t}</button>`).join('')}</nav>`;
}

function entrenamiento(M, st){
  const sub = SUBS.some(s => s[0] === st.sub) ? st.sub : 'sesiones';
  let cuerpo;
  if (sub === 'ejercicios') cuerpo = st.ejercicio && M.ejercicios.has(st.ejercicio) ? fichaEjercicio(M, st.ejercicio, st) : listaEjercicios(M, st);
  else if (sub === 'rendimiento') cuerpo = rendimiento(M);
  else if (sub === 'volumen') cuerpo = volumen(M);
  else cuerpo = sesiones(M, st);
  return `<div class="cabecera-seccion"><h1>Entrenamiento</h1></div>${subnav(sub, 'entrenamiento')}${cuerpo}`;
}

function marcasSesion(s){
  const m = [];
  if (s.cambioRutina) m.push(chip('azul', 'Cambio de rutina', 'Primera sesión con una rutina distinta de la anterior'));
  if (s.descarga) m.push(chip('azul', 'Descarga'));
  if (s.semaforo !== 'verde') m.push(chip(s.semaforo === 'rojo' ? 'rojo' : 'ambar', s.semaforo === 'rojo' ? 'Día rojo' : 'Día ámbar', 'Estado para entrenar con el que se hizo la sesión'));
  if (s.entradas.some(e => e.molestias)) m.push(chip('ambar', 'Molestias'));
  if (s.entradas.some(e => e.sustitucion)) m.push(chip('gris', 'Cambio solo por hoy'));
  if (s.entradas.some(e => e.noDisponible)) m.push(chip('gris', 'Ejercicio no realizado'));
  return m.join(' ');
}

function sesiones(M, st){
  if (!M.sesiones.length) return tarjeta('Sesiones', vacio('Tu copia no tiene sesiones de fuerza registradas.'));
  const lista = M.sesiones.slice().reverse();
  const max = st.verTodas ? lista.length : Math.min(lista.length, 40);
  const filas = lista.slice(0, max).map(s => {
    const [cl, txt] = VEREDICTO[s.veredicto] || ['gris', '—'];
    return [`<button type="button" class="enlace" data-sesion="${s.indice}">${F.dia(s.fecha)}</button>`,
      esc(s.dia), String(s.series), s.duracionMin != null ? `${s.duracionMin} min${s.duracionAnomala ? ' <span class="muted" title="Duración poco habitual">*</span>' : ''}` : '—',
      s.descarga ? '<span class="muted">descarga</span>' : s.sinBase ? '<span class="muted" title="La app la guardó sin una referencia previa con la que comparar">sin referencia</span>' : s.bruto != null ? F.signo(s.bruto) : '—',
      s.veredicto ? chip(cl, txt) : '—', marcasSesion(s)];
  });
  return tarjeta(`Sesiones (${M.sesiones.length})`, `
    ${tabla(['Fecha', 'Sesión', 'Series', 'Duración', 'Rendimiento', 'Valoración', 'Marcas'], filas, { caption: 'Historial de sesiones de fuerza' })}
    ${max < lista.length ? `<div class="fila-botones"><button type="button" class="btn sec" data-accion-vista="ver-todas">Ver las ${lista.length} sesiones</button></div>` : ''}
    ${ayuda('El historial es de consulta: se ve tal como lo guardó la app y no se puede editar aquí. «Rendimiento» compara cada sesión con tu nivel reciente en ese mismo día de la rutina; «Valoración» es la que te dio la app al guardarla. Abre una fecha para ver cada serie.')}`);
}

function detalleSesionHtml(M, indice){
  const s = M.sesiones.find(x => x.indice === indice);
  if (!s) return null;
  const filas = s.entradas.map(e => {
    const m = [];
    if (e.molestias) m.push(chip('ambar', 'Con molestias'));
    if (e.sustitucion) m.push(chip('gris', e.ejercicioPlan ? `En lugar de ${e.ejercicioPlan}` : 'Cambio solo por hoy'));
    if (e.noDisponible) m.push(chip('gris', 'No realizado'));
    if (e.dropSet) m.push(chip('gris', 'Drop set'));
    if (e.restPause) m.push(chip('gris', 'Rest-pause'));
    if (e.superserie != null) m.push(chip('gris', `Superserie ${e.superserie}`));
    if (e.modulada) m.push(chip('gris', 'Intensidad ajustada'));
    if (e.estadoEjercicio && e.estadoEjercicio !== s.semaforo) m.push(chip(e.estadoEjercicio === 'verde' ? 'verde' : 'ambar', `Ejercicio en ${e.estadoEjercicio}`));
    const kgs = e.kgSets.some(k => k != null) && new Set(e.kgSets.filter(k => k != null)).size > 1
      ? F.series(e.kgSets.map(k => Motor.cargaOrientada(e.ejercicio, k))) : (e.kg == null ? '—' : F.num(Motor.cargaOrientada(e.ejercicio, e.kg), 2));
    const unidad = Motor.esPorTiempo(e.ejercicio, M.raw) ? 's' : 'reps';
    return [`<button type="button" class="enlace" data-ejercicio="${esc(e.ejercicio)}">${esc(e.ejercicio)}</button>`,
      `${kgs}${Motor.esAsistido(e.ejercicio) ? ' <span class="muted">(asistencia)</span>' : Motor.esPesoCorporal(e.ejercicio) ? ' <span class="muted">(lastre)</span>' : ''}`,
      `${F.series(e.reps)} <span class="muted">${unidad}</span>`, F.series(e.rir), m.join(' '),
      e.raw.obs ? `<span class="nota">${esc(e.raw.obs)}</span>` : ''];
  });
  const [cl, txt] = VEREDICTO[s.veredicto] || ['gris', '—'];
  return `<h2 id="modalTitulo">${esc(s.dia)} · ${F.dia(s.fecha)}</h2>
    <p>${marcasSesion(s)} ${s.veredicto ? chip(cl, `Valoración: ${txt}`) : ''}</p>
    <div class="cifras">${cifra(String(s.series), 'series hechas')}
      ${cifra(s.duracionMin != null ? `${s.duracionMin} min` : '—', 'duración')}
      ${cifra(s.bruto != null ? F.signo(s.bruto) : s.sinBase ? 'sin referencia' : '—', 'rendimiento bruto')}
      ${cifra(s.neto != null ? F.signo(s.neto) : '—', 'rendimiento neto')}
      ${s.rpe != null ? cifra(String(s.rpe), 'esfuerzo percibido (RPE)') : ''}</div>
    ${tabla(['Ejercicio', 'Carga (kg)', 'Repeticiones', 'RIR', 'Marcas', 'Nota'], filas, { caption: 'Series de la sesión' })}
    <p class="muted" style="font-size:12.5px">Cargas por serie separadas por «/»; «·» es una serie sin anotar (no cuenta como cero).</p>`;
}

function listaEjercicios(M, st){
  if (!M.ejercicios.size) return tarjeta('Ejercicios', vacio('No hay ejercicios registrados.'));
  const q = sinTildes(st.busca || '');
  const todos = [...M.ejercicios.values()].filter(ej => ej.sesiones > 0 && (!q || sinTildes(ej.nombre).includes(q)));
  const enRutina = todos.filter(ej => ej.lineas.length), otros = todos.filter(ej => !ej.lineas.length);
  const orden = (a, b) => (b.ultimo ? +b.ultimo.fecha : 0) - (a.ultimo ? +a.ultimo.fecha : 0);
  const fila = ej => {
    const est = ej.estados.map(estadoTexto);
    return [`<button type="button" class="enlace" data-ejercicio="${esc(ej.nombre)}">${esc(ej.nombre)}</button>`,
      esc(ej.grupo || '—'), String(ej.sesiones), F.dia(ej.ultimo && ej.ultimo.fecha),
      ej.porTiempo ? '—' : ej.marca ? `${F.kg(ej.marca.valor)} <span class="muted">${F.corta(ej.marca.fecha)}</span>` : '—',
      est.map(e => chip(e.clase, e.corto, e.largo)).join(' ')];
  };
  const cab = ['Ejercicio', 'Grupo', 'Sesiones', 'Última', 'Mejor 1RM estimado', 'Estado'];
  return `<div class="card"><div class="mod-fila"><label for="buscaEj">Buscar ejercicio</label>
      <input type="search" id="buscaEj" value="${esc(st.busca || '')}" placeholder="Nombre del ejercicio" autocomplete="off"></div></div>
    ${tarjeta(M.planConocido ? `En tu rutina actual (${enRutina.length})` : 'Ejercicios', M.planConocido
      ? (enRutina.length ? tabla(cab, enRutina.sort(orden).map(fila), { caption: 'Ejercicios de tu rutina actual' }) : vacio('Ninguno coincide.'))
      : tabla(cab, todos.sort(orden).map(fila), { caption: 'Ejercicios registrados' }))}
    ${M.planConocido && otros.length ? tarjeta(`Otros ejercicios de tu historial (${otros.length})`, tabla(cab, otros.sort(orden).map(fila), { caption: 'Ejercicios fuera de tu rutina actual' })) : ''}
    ${ayuda('El estado usa el mismo criterio que la app: solo cuentan las sesiones de tu rutina actual hechas en condiciones de progresar (sin descarga, sin molestias, sin cambios de un día y con todas las series principales anotadas). Que una carga no suba no significa por sí solo un estancamiento. El 1RM es una estimación a partir de tus series, no una prueba de máximo.')}`;
}

/* Series de una sesión como «80×8 @2 · 80×8 @2 · 70×10 @2»: back-off,
   drops y series tras la pausa se marcan; «·» es una serie sin anotar. */
function seriesHtml(series, porTiempo){
  if (!series.length) return '—';
  const PAPEL = { back: 'back-off', drop: 'drop', pausa: 'tras la pausa' };
  return series.map(x => {
    const kg = x.kg == null ? '—' : F.num(x.kg, 2);
    const reps = x.reps == null ? '·' : `${x.reps}${porTiempo ? ' s' : ''}`;
    const rir = x.rir == null ? '' : ` @${x.rir}`;
    const papel = PAPEL[x.papel] ? ` <span class="muted">${PAPEL[x.papel]}</span>` : '';
    return `<span class="serie">${kg}×${reps}${rir}${papel}</span>`;
  }).join('<span class="sep-serie"> · </span>');
}

const fechaSesion = p => `<button type="button" class="enlace" data-sesion="${p.sesion.indice}">${F.dia(p.fecha)}</button>`;

function fichaEjercicio(M, nombre, st = {}){
  const ej = M.ejercicios.get(nombre);
  const pts = ej.puntos.filter(p => p.hechas > 0);
  const out = [`<div class="fila-botones" style="margin-bottom:10px"><button type="button" class="btn sec" data-ir="entrenamiento:ejercicios" data-limpiar-ejercicio="1">← Todos los ejercicios</button></div>`];
  const est = ej.estados.map(s => ({ s, t: estadoTexto(s) }));
  const ficha = typeof CAT_FICHA === 'object' ? CAT_FICHA[nombre] : null;
  const unidadCarga = ej.asistido ? 'asistencia en kg' : ej.pesoCorporal ? 'lastre en kg' : 'kg';

  // --- estado de progresión y su porqué ---
  const porQue = est.filter(({ s }) => s.op && s.op.length).map(({ s }) => {
    const filas = s.op.slice(0, Math.max(s.consumidos, 1) + 2).map((o, i) => {
      const p = ej.puntos.find(q => q.sesion.l === M.raw.logs[o.indice]);
      return [p ? fechaSesion(p) : F.dia(parseFecha(o.fecha)), F.num(Motor.cargaOrientada(nombre, o.kg), 2),
        Motor.repsTop(o.entrada).map(r => r == null ? '·' : r).join(' / '),
        o.completo ? chip('verde', 'Llegó al objetivo') : chip('gris', 'No llegó'),
        i < s.consumidos ? chip('azul', 'Cuenta como intento') : ''];
    });
    return `<p class="sub-h">${esc(s.dia)} · objetivo ${esc(String(s.reps))} reps</p>
      ${tabla(['Fecha', `Carga (${unidadCarga})`, 'Reps de las series principales', 'Objetivo', 'Contador'], filas, { caption: `Sesiones que cuentan para la progresión en ${s.dia}` })}`;
  });
  out.push(tarjeta(nombre, `
    <p>${est.map(({ s, t }) => `${chip(t.clase, t.corto)}${s.dia ? ` <span class="muted">${esc(s.dia)}</span>` : ''}`).join(' · ')}</p>
    ${est.map(({ s, t }) => t.largo ? `<p style="font-size:13px">${s.dia ? `<b>${esc(s.dia)}</b>: ` : ''}${esc(t.largo)}${s.objetivo != null ? ` Objetivo de la rutina: ${esc(String(s.reps))} reps.` : ''}${s.recurrente ? ' La app marcó que el estancamiento se repitió tras reiniciar los intentos.' : ''}${s.descarga ? ' Estás en descarga: ahora no se cuentan intentos.' : ''}</p>` : '').join('')}
    ${porQue.length ? `<details class="detalle"><summary>Por qué este estado</summary>${porQue.join('')}
      <p class="muted" style="font-size:12.5px">Son las sesiones más recientes de tu rutina actual que cuentan para la progresión, igual que en la app. Las descargas, las sesiones con molestias o con un cambio de un día y las que tienen series principales sin anotar no aparecen porque no cuentan.</p></details>` : ''}
    <div class="cifras">${cifra(String(ej.sesiones), 'sesiones')}
      ${cifra(F.dia(ej.primero && ej.primero.fecha), 'primera')}
      ${cifra(F.dia(ej.ultimo && ej.ultimo.fecha), 'última')}
      ${!ej.porTiempo ? cifra(ej.marca ? F.kg(ej.marca.valor) : '—', `mejor 1RM estimado${ej.marca ? ` (${F.corta(ej.marca.fecha)})` : ''}`) : ''}
      ${ficha ? cifra(ficha.grupo, 'grupo muscular') : ''}</div>
    ${ej.pesoCorporal ? `<p class="muted" style="font-size:12.5px">${ej.asistido ? 'Ejercicio asistido: la carga es la ayuda que restas a tu peso.' : 'Ejercicio con tu peso corporal: la carga anotada es el lastre.'} El 1RM estimado suma tu peso de perfil actual${M.pc ? ` (${F.kg(M.pc)})` : ''}, igual que la app, también en sesiones antiguas.${M.pc == null ? ' Tu copia no trae peso de perfil, así que no se estima.' : ''}</p>` : ''}`));

  // --- evolución: gráfica con marcas de contexto y tabla por serie ---
  const marcasCtx = [];
  pts.forEach(p => {
    if (p.sesion.descarga) marcasCtx.push({ x: p.fecha, tipo: 'Descarga', label: 'Descarga', color: TL.azul });
    if (p.e.molestias) marcasCtx.push({ x: p.fecha, tipo: 'Molestias', label: 'Molestias', color: TL.ambar });
    if (p.sesion.cambioRutina) marcasCtx.push({ x: p.fecha, tipo: 'Cambio de rutina', label: 'Cambio de rutina', color: TL.txt3 });
  });
  const filas = pts.slice().reverse().map(p => [fechaSesion(p), esc(p.dia), seriesHtml(Analisis.seriesDe(p.e), ej.porTiempo),
    ...(ej.porTiempo ? [] : [p.e1rm != null ? `${F.num(p.e1rm, 1)}${p.e1rmMenosFiable ? ' <span class="muted" title="Muchas repeticiones: estimación menos precisa">≈</span>' : ''}` : '—']),
    marcasPunto(p)]);
  const cabTabla = ['Fecha', 'Sesión', `Series (${unidadCarga} × ${ej.porTiempo ? 'segundos' : 'reps'} @RIR)`, ...(ej.porTiempo ? [] : ['1RM est. (kg)']), 'Marcas'];
  const tablaHist = tabla(cabTabla, filas, { caption: `Historial de ${nombre} por serie`, clase: 'tabla-series' });
  if (!ej.porTiempo){
    // La línea solo une sesiones que cuentan; las demás quedan como puntos
    // sueltos para no dibujar caídas que la app no tiene en cuenta.
    const e1 = pts.filter(p => p.e1rm != null);
    const serie1 = e1.filter(p => p.evaluable).map(p => ({ x: p.fecha, y: Math.round(p.e1rm * 10) / 10, c: p.noVerde ? TL.ambar : TL.lima }));
    const serieNo = e1.filter(p => !p.evaluable).map(p => ({ x: p.fecha, y: Math.round(p.e1rm * 10) / 10 }));
    const serie2 = pts.filter(p => p.cargaVista != null).map(p => ({ x: p.fecha, y: p.cargaVista }));
    const svg = Charts.lineas({ series: [
      { nombre: '1RM estimado', color: TL.lima, puntos: serie1, unidad: 'kg' },
      ...(serieNo.length ? [{ nombre: 'Sesiones que no cuentan', color: TL.txt4, puntos: serieNo, soloPuntos: true, unidad: 'kg' }] : []),
      { nombre: ej.asistido ? 'Asistencia' : ej.pesoCorporal ? 'Lastre' : 'Carga de la serie principal', color: TL.azul, puntos: serie2, unidad: 'kg', eje: 'der', dash: '5 4' },
    ], marcas: marcasCtx, w: 960, h: 280 });
    out.push(tarjeta('Evolución', grafica(svg, `1RM estimado y carga de ${nombre} por sesión`, tablaHist) +
      `<p class="muted" style="font-size:12.5px">El 1RM estimado es una estimación a partir de tu mejor serie de cada sesión (en drop set y rest-pause, solo la primera), no una prueba de máximo. Puntos grises sueltos: sesiones que no cuentan para la progresión (descarga, molestias, cambio de un día). Puntos ámbar: entrenado en un día ámbar o rojo. Las líneas verticales marcan descargas, molestias y cambios de rutina.</p>`));
  } else {
    out.push(tarjeta('Historial', tablaHist));
  }

  if (!ej.porTiempo){
    out.push(tarjetaEvolucionReciente(M, ej));
    out.push(tarjetaMarcas(M, ej));
  }
  out.push(tarjetaCompararSesiones(M, ej, st));
  return out.join('');
}

function tarjetaEvolucionReciente(M, ej){
  const hasta = soloDia(M.ref), desde = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - (Analisis.VENTANA_DIAS - 1));
  const x = Analisis.evolucionEjercicio(M, ej, desde, hasta);
  if (!x.enPeriodo) return tarjeta('Tus últimas semanas', vacio(`No entrenaste este ejercicio entre el ${F.dia(desde)} y el ${F.dia(hasta)}.`));
  const [cl, txt] = LECTURA[x.lectura];
  const exc = Object.entries(x.excluidos).map(([m, n]) => `${n} ${esc(Analisis.MOTIVO_TXT[m] || m)}`);
  const filas = x.puntos.map(p => [fechaSesion(p), esc(p.dia), esc(Analisis.serieTxt(p.e, p.marcaSerie)), F.kg(p.e1rmMarca)]);
  return tarjeta('Tus últimas semanas', `<p>${chip(cl, txt)} ${x.deltaPct != null ? `De ${F.kg(x.inicio)} a ${F.kg(x.fin)} (${F.signo(x.deltaPct)}) en ${F.plural(x.n, 'sesión comparable', 'sesiones comparables')}.` : `Hay ${F.plural(x.n, 'sesión comparable', 'sesiones comparables')}: hacen falta más para ver una evolución.`}</p>
    <p class="muted" style="font-size:12.5px">Periodo: ${F.dia(desde)} – ${F.dia(hasta)}. Modalidad comparada: ${esc(Analisis.MODALIDAD_TXT[x.config] || '—')}.${exc.length ? ` No entran: ${exc.join(', ')}.` : ''}${x.cambioRutina ? ' Incluye sesiones de rutinas distintas.' : ''}${x.seriesDistintas ? ' El número de series cambia entre sesiones; el 1RM estimado usa solo la mejor serie.' : ''}${x.lectura !== 'insuficiente' && !x.firme ? ' Con estas pocas sesiones la lectura es orientativa y no aparece en Mi resumen.' : ''}</p>
    ${x.puntos.length ? tabla(['Fecha', 'Sesión', 'Serie que da la estimación', '1RM estimado'], filas, { caption: 'Sesiones comparables recientes' }) : ''}
    ${ayuda('Es la misma lectura que la tabla «Evolución de tus ejercicios» de Mi resumen: compara el principio y el final de tus últimas semanas usando solo las sesiones normales del ejercicio y con la misma modalidad de series. «Sin cambios claros» no significa estancamiento: el estado de progresión de arriba es el que usa la app.')}`);
}

function tarjetaMarcas(M, ej){
  const marcas = Analisis.marcas(ej);
  if (!marcas.length) return tarjeta('Mejores marcas', vacio('Aún no hay ninguna sesión que pueda fijar una marca (hace falta entrenarlo en verde, sin molestias ni cambios de un día).'));
  const filas = marcas.slice().reverse().map(m => [fechaSesion(m.p), esc(m.p.dia), esc(Analisis.serieTxt(m.p.e, m.serie)), F.kg(m.valor),
    m.anterior == null ? '<span class="muted">primera referencia</span>' : `+${F.kg(m.valor - m.anterior)}`]);
  return tarjeta('Mejores marcas', `${tabla(['Fecha', 'Sesión', 'Serie', '1RM estimado', 'Mejora'], filas, { caption: `Mejores marcas de ${ej.nombre}` })}
    <p class="muted" style="font-size:12.5px">Cada fila es una sesión que superó tu mejor marca anterior, con las reglas de la app: solo cuentan los ejercicios entrenados en verde, sin molestias ni cambios de un día, y en drop set y rest-pause solo la primera serie. La primera fila fija la referencia.</p>`);
}

function tarjetaCompararSesiones(M, ej, st){
  const pts = ej.puntos.filter(p => p.hechas > 0);
  if (pts.length < 2) return tarjeta('Comparar dos sesiones', vacio('Hace falta al menos otra sesión de este ejercicio para comparar.'));
  // Por defecto: la última y la anterior con la misma modalidad (si la hay).
  const ultima = pts[pts.length - 1];
  const previa = [...pts].slice(0, -1).reverse().find(p => Analisis.configuracion(p) === Analisis.configuracion(ultima)) || pts[pts.length - 2];
  const existe = i => pts.some(p => p.sesion.indice === i);
  const ia = existe(st.compA) ? st.compA : previa.sesion.indice;
  const ib = existe(st.compB) ? st.compB : ultima.sesion.indice;
  const opciones = sel => pts.slice().reverse().map(p => `<option value="${p.sesion.indice}"${p.sesion.indice === sel ? ' selected' : ''}>${esc(F.dia(p.fecha))} · ${esc(p.dia)}</option>`).join('');
  const C = Analisis.compararSesiones(M, ej, ia, ib);
  const selectores = `<div class="comparar-sel">
      <div class="mod-fila"><label for="compA">Sesión A</label><select id="compA">${opciones(ia)}</select></div>
      <div class="mod-fila"><label for="compB">Sesión B</label><select id="compB">${opciones(ib)}</select></div></div>`;
  if (!C || ia === ib) return tarjeta('Comparar dos sesiones', selectores + vacio('Elige dos sesiones distintas.'));
  const n = Math.max(C.seriesA.length, C.seriesB.length);
  const celda = x => x ? seriesHtml([x], ej.porTiempo) : '<span class="muted">—</span>';
  const filas = Array.from({ length: n }, (_, i) => [`Serie ${i + 1}`, celda(C.seriesA[i]), celda(C.seriesB[i])]);
  const e1 = p => p.mejor ? F.kg(p.mejor.e1rm) : '—';
  if (!ej.porTiempo) filas.push(['1RM estimado (mejor serie)', e1(C.a), `${e1(C.b)}${C.deltaE1rm != null ? ` <span class="muted">(${F.signo(C.deltaE1rm)})</span>` : ''}`]);
  filas.push(['Series anotadas', String(C.a.hechas), String(C.b.hechas)]);
  filas.push(['Marcas', marcasPunto(C.a) || '—', marcasPunto(C.b) || '—']);
  return tarjeta('Comparar dos sesiones', `${selectores}
    <p class="muted" style="font-size:12.5px">${F.dia(C.a.fecha)} frente a ${F.dia(C.b.fecha)} (${F.plural(C.dias, 'día', 'días')} después).</p>
    ${tabla(['', `<button type="button" class="enlace" data-sesion="${C.a.sesion.indice}">A · ${F.dia(C.a.fecha)}</button>`,
      `<button type="button" class="enlace" data-sesion="${C.b.sesion.indice}">B · ${F.dia(C.b.fecha)}</button>`], filas, { caption: 'Comparación de dos sesiones' })}
    ${C.avisos.length ? `<div class="alerta ambar"><span class="tag">Ojo</span><span>${C.avisos.map(esc).join(' ')}</span></div>`
      : '<p class="muted" style="font-size:12.5px">Misma modalidad, mismo número de series y sesiones normales: son comparables.</p>'}
    ${!C.compatible && !ej.porTiempo ? '<p class="muted" style="font-size:12.5px">Como la modalidad es distinta, no se calcula la diferencia de 1RM estimado.</p>' : ''}`);
}

function marcasPunto(p){
  const m = [];
  if (p.sesion.descarga) m.push(chip('azul', 'Descarga'));
  if (p.e.molestias) m.push(chip('ambar', 'Molestias'));
  if (p.e.sustitucion) m.push(chip('gris', 'Cambio de un día'));
  if (p.noVerde && !p.sesion.descarga) m.push(chip('ambar', 'Día no verde'));
  if (p.e.dropSet) m.push(chip('gris', 'Drop'));
  if (p.e.restPause) m.push(chip('gris', 'Rest-pause'));
  if (p.topBack) m.push(chip('gris', 'Top + back-off'));
  if (p.superaMarca) m.push(chip('verde', 'Nueva marca'));
  if (Motor.incompleta(p.e)) m.push(chip('gris', 'Series sin anotar'));
  if (p.sesion.cambioRutina) m.push(chip('azul', 'Cambio de rutina'));
  return m.join(' ');
}

function rendimiento(M){
  const ses = M.sesiones.filter(s => !s.descarga);
  const pb = ses.filter(s => s.bruto != null).map(s => ({ x: s.fecha, y: s.bruto }));
  const pn = ses.filter(s => s.neto != null).map(s => ({ x: s.fecha, y: s.neto }));
  const tol = M.valoracion.tol;
  if (!pb.length && !pn.length) return tarjeta('Rendimiento por sesión', vacio('Tu copia no trae sesiones con rendimiento medido.'));
  const svg = Charts.lineas({ series: [
    { nombre: 'Bruto', color: TL.lima, puntos: pb, unidad: '%' },
    ...(pn.length ? [{ nombre: 'Neto (descuenta la fatiga de la sesión)', color: TL.azul, puntos: pn, unidad: '%', dash: '5 4' }] : []),
  ], lineaBase: { y: 0, label: 'Tu nivel reciente', color: TL.txt3 }, banda: { min: -tol, max: tol, label: 'Zona normal' }, w: 960, h: 280 });
  const filas = ses.slice().reverse().filter(s => s.bruto != null || s.neto != null || s.sinBase).map(s => [F.dia(s.fecha), esc(s.dia),
    s.sinBase ? '<span class="muted">sin referencia</span>' : F.signo(s.bruto), s.neto != null ? F.signo(s.neto) : '—',
    s.veredicto ? chip(...(VEREDICTO[s.veredicto] || ['gris', s.veredicto])) : '—', s.cambioRutina ? chip('azul', 'Cambio de rutina') : '']);
  return tarjeta('Rendimiento por sesión', grafica(svg, 'Rendimiento bruto y neto de cada sesión frente a tu nivel reciente',
      tabla(['Fecha', 'Sesión', 'Bruto', 'Neto', 'Valoración', ''], filas, { caption: 'Rendimiento por sesión' })) +
    ayuda('Son las cifras que la app calculó y guardó al terminar cada sesión: cuánto rindió frente a tu nivel reciente en ese día de la rutina (0 % = tu nivel). El neto, si registras el esfuerzo de la sesión, descuenta la fatiga acumulada dentro de ella. Las sesiones que la app guardó sin referencia previa (al empezar una rutina, por ejemplo) aparecen como hueco. Las descargas no se muestran.'));
}

function volumen(M){
  const { cubos, sinGrupo } = Analisis.volumen(M, { gran: 'semana' });
  if (!cubos.length) return tarjeta('Volumen', vacio('No hay sesiones de fuerza.'));
  const ult = cubos.slice(-12);
  const presentes = Motor.GRUPOS_VOLUMEN.filter(g => ult.some(c => c.series.get(g) > 0));
  const filas = ult.slice().reverse().map(c => [
    `${F.corta(c.inicio)}–${F.corta(new Date(+c.finExclusivo - 86400000))}${c.enCurso ? ' <span class="muted">(en curso)</span>' : c.dias < 7 ? ' <span class="muted">(parcial)</span>' : ''}${c.cambioRutina ? ' ' + chip('azul', 'Cambio de rutina') : ''}`,
    String(c.sesiones),
    ...presentes.map(g => { const v = c.series.get(g); return v ? F.num(v, 1) : '<span class="muted">0</span>'; }),
    `<b>${F.num(Motor.tasaSemanal(c), 1)}</b>`]);
  const total = Charts.lineas({ series: [{ nombre: 'Series efectivas por semana', color: TL.lima,
    puntos: cubos.filter(c => !c.enCurso).slice(-26).map(c => ({ x: c.inicio, y: Math.round(Motor.tasaSemanal(c) * 10) / 10 })), unidad: 'series' }], w: 960, h: 220 });
  return tarjeta('Series por grupo muscular y semana', `
    <div class="chart-caja" role="img" aria-label="Series efectivas por semana, últimas semanas completas">${total}</div>
    ${tabla(['Semana', 'Sesiones', ...presentes.map(esc), 'Total'], filas, { caption: 'Series por grupo y semana' })}
    ${sinGrupo.length ? `<p class="muted" style="font-size:12.5px">No se reconoce el grupo de ${F.plural(sinGrupo.length, 'ejercicio', 'ejercicios')} (${sinGrupo.slice(0, 5).map(esc).join(', ')}${sinGrupo.length > 5 ? '…' : ''}): sus series no se reparten, como en la app.</p>` : ''}
    ${ayuda('Cuenta las series que anotaste, con el mismo reparto que la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. Los ejercicios marcados como no realizados no suman. Las semanas van de lunes a domingo; la primera y la última pueden estar incompletas y se señalan.')}`);
}

// ---------------------------------------------------------------
// EVOLUCIÓN FÍSICA
// ---------------------------------------------------------------
const SITIOS = { cuello: 'Cuello', hombros: 'Hombros', pecho: 'Pecho', biceps_izq: 'Bíceps izq.', biceps_der: 'Bíceps der.',
  antebrazo_izq: 'Antebrazo izq.', antebrazo_der: 'Antebrazo der.', cintura: 'Cintura', abdomen: 'Abdomen', cadera: 'Cadera',
  muslo_izq: 'Muslo izq.', muslo_der: 'Muslo der.', gemelo_izq: 'Gemelo izq.', gemelo_der: 'Gemelo der.' };

function fisica(M, ctx){
  const out = ['<div class="cabecera-seccion"><h1>Evolución física</h1></div>'];
  const N = M.datos.nut;
  // --- peso ---
  if (N && N.pesajes.length){
    const pts = N.pesajes.map(p => ({ x: p.fecha, y: p.pesoKg, c: p.enmascarado ? TL.txt4 : TL.txt2 }));
    const tend = N.serie.vacia ? [] : N.serie.puntos.filter((p, i, a) => p.huboPesaje || i === a.length - 1).map(p => ({ x: p.fecha, y: Math.round(p.tendenciaKg * 100) / 100 }));
    const svg = Charts.lineas({ series: [
      { nombre: 'Pesajes', color: TL.txt2, puntos: pts, soloPuntos: true, unidad: 'kg' },
      { nombre: 'Peso tendencia', color: TL.lima, puntos: tend, unidad: 'kg', sinPuntos: true },
    ], w: 960, h: 260 });
    const filas = N.pesajes.slice().reverse().slice(0, 120).map(p => {
      const t = N.serie.vacia ? null : N.serie.puntos[N.serie.indice.get(p.clave)];
      return [F.dia(p.fecha), F.kg(p.pesoKg, 2), t ? F.kg(t.tendenciaKg, 2) : '—', p.enmascarado ? 'No cuenta (refeed o pausa)' : ''];
    });
    out.push(tarjeta('Peso', `<div class="cifras">
        ${cifra(N.tendenciaKg ? F.kg(N.tendenciaKg) : '—', `peso tendencia${N.fechaTendencia ? ` (${F.corta(N.fechaTendencia)})` : ''}`)}
        ${cifra(N.tasaPctSemana != null && N.pesajes.length > 1 ? F.signo(N.tasaPctSemana, 2) : '—', 'ritmo por semana')}
        ${N.fase ? cifra(FASE_NUT[N.fase.tipo] || N.fase.tipo, 'fase de nutrición') : ''}
        ${N.fase && N.fase.tipo !== 'MAINTENANCE' ? cifra(F.signo(N.fase.tasaObjetivoPctSemana, 2), 'ritmo objetivo') : ''}
        ${N.fase && N.fase.pesoObjetivoKg > 0 ? cifra(F.kg(N.fase.pesoObjetivoKg), 'peso objetivo') : ''}</div>
      ${grafica(svg, 'Pesajes y peso tendencia', tabla(['Fecha', 'Pesaje', 'Tendencia', ''], filas, { caption: 'Pesajes' }))}
      ${ayuda('La línea es el peso tendencia que calcula la app: suaviza las subidas y bajadas diarias de agua y comida para ver hacia dónde va tu peso. Los pesajes de días de refeed o tras una pausa se muestran, pero no mueven la tendencia.')}`));
  } else {
    out.push(tarjeta('Peso', vacio(M.pc ? `Tu copia no trae pesajes (la nutrición de la app no está activa). Peso de tu perfil: ${F.kg(M.pc)}.` : 'Tu copia no trae pesajes.')));
  }

  // --- composición (estimación) ---
  if (N && N.mediciones.length){
    const filas = N.mediciones.slice().reverse().map(m => [F.dia(m.fecha), `${F.num(m.porcentajePct, 1)} %`, F.kg(m.pesoAnclaKg), F.kg(m.grasaKg), F.kg(m.magraKg), esc(METODO[m.metodo] || m.metodo)]);
    out.push(tarjeta('Composición corporal (estimación)', `${tabla(['Fecha', '% graso', 'Peso', 'Masa grasa', 'Masa magra', 'Método'], filas, { caption: 'Mediciones de grasa corporal' })}
      <p class="muted" style="font-size:12.5px">El % graso es una estimación del método que usaste, y las masas salen de multiplicarlo por tu peso de ese día. Un cambio de masa magra no equivale a músculo ganado o perdido: incluye agua, glucógeno y el error del método.</p>`));
  }

  // --- contornos ---
  const md = M.raw.medidas && typeof M.raw.medidas === 'object' ? M.raw.medidas : null;
  const regs = md && Array.isArray(md.registros) ? md.registros.filter(r => r && typeof r.cm === 'number' && r.cm >= 10 && r.cm <= 300 && SITIOS[r.sitio] && parseFecha(r.fecha)) : [];
  if (regs.length){
    const fechas = [...new Set(regs.map(r => r.fecha.slice(0, 10)))].sort().reverse();
    const sitios = Object.keys(SITIOS).filter(s => regs.some(r => r.sitio === s));
    const val = new Map(regs.map(r => [`${r.fecha.slice(0, 10)}|${r.sitio}`, r.cm]));
    const filas = fechas.map(f => [F.dia(f), ...sitios.map(s => val.has(`${f}|${s}`) ? F.num(val.get(`${f}|${s}`), 1) : '<span class="muted">—</span>')]);
    out.push(tarjeta('Contornos (cm)', `${tabla(['Fecha', ...sitios.map(s => esc(SITIOS[s]))], filas, { caption: 'Contornos por fecha' })}
      <p class="muted" style="font-size:12.5px">«—» es un sitio que no mediste ese día. La comparación de fotos con sus medidas llegará en una fase posterior.</p>`));
  } else {
    out.push(tarjeta('Contornos', vacio(md ? 'No has registrado contornos.' : 'Tu copia es de una versión de la app anterior a las medidas y fotos.')));
  }
  out.push(ctx.galeriaHtml());
  return out.join('');
}
const METODO = { DIRECT: 'Valor introducido', NAVY: 'Fórmula con contornos (Navy)', GALLERY: 'Comparación con fotos de referencia' };

// ---------------------------------------------------------------
// RECUPERACIÓN
// ---------------------------------------------------------------
function recuperacion(M){
  const out = ['<div class="cabecera-seccion"><h1>Recuperación</h1></div>'];
  const R = M.datos.readiness;
  const desde = new Date(+M.ref - 59 * 86400000);
  const r60 = R.filter(r => r.fecha >= soloDia(desde) && r.fecha <= M.ref);
  if (!R.length) out.push(tarjeta('Estado para entrenar', vacio('Tu copia no trae cuestionarios diarios.')));
  else {
    const datos = r60.filter(r => r.estadoEntrenar != null).map(r => ({ x: r.fecha, y: Math.round(r.estadoEntrenar), color: COLOR_ESTADO[bandaEstado(r.estadoEntrenar)] }));
    const svg = datos.length ? Charts.barras({ datos, w: 960, h: 220 }) : vacio('Sin estado calculado en este periodo.');
    const fila = r => [F.dia(r.fecha), r.estadoEntrenar != null ? `${Math.round(r.estadoEntrenar)}` : '—', esc(r.sueno ?? '—'),
      esc(r.animo ?? '—'), esc(r.estres ?? '—'), `${esc(r.agujetas ?? '—')}${r.agujetasZona ? ` <span class="muted">${esc(r.agujetasZona)}</span>` : ''}`,
      `${esc(r.dolor ?? '—')}${r.dolorZona ? ` <span class="muted">${esc(r.dolorZona)}</span>` : ''}`, r.enfermo ? 'Sí' : ''];
    out.push(tarjeta('Estado para entrenar', `${grafica(svg, 'Estado para entrenar por día, últimos 60 días hasta tu último registro',
        tabla(['Fecha', 'Estado', 'Sueño', 'Ánimo', 'Estrés', 'Agujetas', 'Dolor', 'Enfermo'], r60.slice().reverse().map(fila), { caption: 'Cuestionarios diarios' }))}
      ${ayuda('Es el estado para entrenar que la app calculó cada día con tu cuestionario (0 a 100). En verde la app propone entrenar con normalidad; en ámbar o rojo ajusta la intensidad. Se muestran los dos meses previos a tu último registro.')}`));
  }
  // --- VFC ---
  const vfcV = VFC.validas(R);
  if (vfcV.length){
    const tend = VFC.tendenciaSerie(R);
    const pts = vfcV.filter(v => v.fecha >= soloDia(desde)).map(v => ({ x: v.fecha, y: v.vfc }));
    const media = vfcV.filter(v => v.fecha >= soloDia(desde) && tend.get(v.clave)).map(v => ({ x: v.fecha, y: Math.round(tend.get(v.clave).media7 * 10) / 10 }));
    const umbral = vfcV.filter(v => v.fecha >= soloDia(desde) && tend.get(v.clave)).map(v => ({ x: v.fecha, y: Math.round(tend.get(v.clave).umbral * 10) / 10 }));
    const svg = Charts.lineas({ series: [
      { nombre: 'VFC de la noche', color: TL.txt3, puntos: pts, soloPuntos: true, unidad: 'ms' },
      { nombre: 'Media de 7 días', color: TL.lima, puntos: media, unidad: 'ms', sinPuntos: true },
      { nombre: 'Tu umbral', color: TL.ambar, puntos: umbral, unidad: 'ms', dash: '5 4', sinPuntos: true },
    ], w: 960, h: 240 });
    const filas = vfcV.filter(v => v.fecha >= soloDia(desde)).reverse().map(v => { const t = tend.get(v.clave);
      return [F.dia(v.fecha), F.num(v.vfc, 0), t ? F.num(t.media7, 1) : '—', t ? F.num(t.umbral, 1) : '—']; });
    out.push(tarjeta('Variabilidad de la frecuencia cardiaca (VFC)', grafica(svg, 'VFC nocturna, media de 7 días y umbral', tabla(['Noche', 'VFC (ms)', 'Media 7 días', 'Umbral'], filas, { caption: 'VFC' })) +
      ayuda('La media de varias noches se compara con tu propia referencia. Si queda por debajo de forma sostenida, la app lo tiene en cuenta como señal de cansancio. Las noches que descartaste no cuentan.')));
  }
  // --- FC en reposo ---
  const fcV = FCReposo.validas(R);
  if (fcV.length){
    const banda = FCReposo.bandaSerie(R);
    const pts = fcV.filter(v => v.fecha >= soloDia(desde)).map(v => ({ x: v.fecha, y: v.fcReposo }));
    const alta = fcV.filter(v => v.fecha >= soloDia(desde) && banda.get(v.clave)).map(v => ({ x: v.fecha, y: Math.round(banda.get(v.clave).alta * 10) / 10 }));
    const svg = Charts.lineas({ series: [{ nombre: 'FC en reposo', color: TL.azul, puntos: pts, unidad: 'ppm' },
      { nombre: 'Límite alto para ti', color: TL.ambar, puntos: alta, unidad: 'ppm', dash: '5 4', sinPuntos: true }], w: 960, h: 220 });
    out.push(tarjeta('Frecuencia cardiaca en reposo', grafica(svg, 'FC en reposo y su límite alto',
      tabla(['Día', 'FC (ppm)', 'Límite alto'], fcV.filter(v => v.fecha >= soloDia(desde)).reverse().map(v => [F.dia(v.fecha), F.num(v.fcReposo, 0), banda.get(v.clave) ? F.num(banda.get(v.clave).alta, 1) : '—']), { caption: 'FC en reposo' }))));
  }
  // --- reloj: sueño y pasos ---
  const S = M.datos.salud.filter(d => d.fecha >= soloDia(desde) && d.fecha <= M.ref);
  if (S.length && Salud.hay(S)){
    const sueno = S.filter(d => d.sueno && d.sueno.total).map(d => ({ x: d.fecha, y: Math.round(d.sueno.total / 6) / 10 }));
    const pasos = S.filter(d => d.pasos != null).map(d => ({ x: d.fecha, y: d.pasos }));
    const svg = Charts.lineas({ series: [
      ...(sueno.length ? [{ nombre: 'Horas dormidas', color: TL.azul, puntos: sueno, unidad: 'h' }] : []),
      ...(pasos.length ? [{ nombre: 'Pasos', color: TL.lima, puntos: pasos, unidad: 'pasos', eje: sueno.length ? 'der' : undefined }] : []),
    ], w: 960, h: 240 });
    const filas = S.slice().reverse().map(d => [F.dia(d.fecha), d.sueno && d.sueno.total ? Salud.fmtHm(d.sueno.total) : '—',
      d.sueno && d.sueno.reparadorPct != null ? `${Math.round(d.sueno.reparadorPct * 100)} %` : '—',
      d.pasos != null ? d.pasos.toLocaleString('es-ES') : '—', d.fcReposo != null ? F.num(d.fcReposo, 0) : '—']);
    out.push(tarjeta('Datos del reloj', grafica(svg, 'Sueño y pasos del reloj', tabla(['Día', 'Sueño', 'Sueño profundo y REM', 'Pasos', 'FC reposo'], filas, { caption: 'Datos del reloj por día' })) +
      '<p class="muted" style="font-size:12.5px">Un día sin dato del reloj es un hueco, no un cero.</p>'));
  }
  if (out.length === 1) out.push(tarjeta('Recuperación', vacio('Tu copia no trae datos de recuperación.')));
  return out.join('');
}
const COLOR_ESTADO = { verde: TL.lima, ambar: TL.ambar, rojo: TL.naranja };

// ---------------------------------------------------------------
// MI RUTINA
// ---------------------------------------------------------------
function rutina(M){
  const out = ['<div class="cabecera-seccion"><h1>Mi rutina</h1></div>'];
  const lineas = M.planMod;
  if (!lineas.length){
    out.push(tarjeta('Rutina', `<p>Tu copia no incluye una rutina personalizada. Si usas una de las rutinas prefijadas de la app, consúltala en el móvil.</p>`));
    return out.join('');
  }
  const aviso = M.planConocido
    ? `<p class="muted" style="font-size:13px">Rutina guardada en tu copia: ${esc(M.raw.sistema === 'simple' ? 'progresión simple' : 'progresión doble')}, ${esc(M.raw.dias || '—')} días por semana. Es de consulta; el editor para preparar cambios llegará en una fase posterior.</p>`
    : `<div class="alerta ambar"><span class="tag">Revisar</span><span>Esta rutina personalizada está guardada en tu copia, pero es de otra combinación de días o sistema que la que tienes ahora en la app, así que puede no ser la que usas.</span></div>`;
  const dias = [...new Set(lineas.map(l => l.dia))];
  const bloques = dias.map(d => {
    const ls = lineas.filter(l => l.dia === d).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const filas = ls.map(l => {
      const mod = [];
      if (l.topBack) mod.push(`Top + back-off${typeof l.backoffPct === 'number' ? ` (−${l.backoffPct} %)` : ''}`);
      if (l.dropSet) mod.push(`Drop set${typeof l.dropPct === 'number' ? ` (−${l.dropPct} %)` : ''}`);
      if (l.restPause) mod.push('Rest-pause');
      if (l.superConAnterior) mod.push('Superserie con el anterior');
      return [esc(l.ejercicio), esc(l.grupo || '—'), esc(String(l.series ?? '—')), esc(String(l.reps ?? '—')), esc(String(l.rir ?? '—')),
        typeof l.descansoMin === 'number' ? `${F.num(l.descansoMin, 1)} min` : '—', esc(mod.join(' · '))];
    });
    return tarjeta(d, tabla(['Ejercicio', 'Grupo', 'Series', 'Reps', 'RIR', 'Descanso', 'Modalidad'], filas, { caption: `Ejercicios de ${d}` }));
  });
  const vp = Analisis.volumenPlan(M, lineas);
  const filasVol = Motor.GRUPOS_VOLUMEN.filter(g => vp.series.get(g)).map(g => [esc(g), F.num(vp.series.get(g), 1), String(vp.dias.get(g) || 0)]);
  out.push(aviso, `<div class="grid rutina-dias">${bloques.join('')}</div>`,
    tarjeta('Series planificadas por semana', tabla(['Grupo', 'Series', 'Días'], filasVol, { caption: 'Series planificadas por grupo' }) +
      ayuda('Mismo reparto que la pestaña de volumen de la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. «Días» son los días de la semana en que el grupo recibe al menos una serie completa.')));
  return out.join('');
}

// ---------------------------------------------------------------
// INFORMES
// ---------------------------------------------------------------
function informes(){
  return `<div class="cabecera-seccion"><h1>Informes</h1></div>${tarjeta('Informe de un periodo',
    '<p>Aquí podrás preparar un informe mensual o de las fechas que elijas, para guardarlo en PDF desde la impresión del navegador. Está en preparación.</p><p class="muted">Mientras tanto, la app genera su informe mensual en Progreso.</p>')}`;
}

return { resumen, entrenamiento, detalleSesionHtml, fisica, recuperacion, rutina, informes, estadoTexto, F };
})();
