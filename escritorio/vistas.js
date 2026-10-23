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

const tarjeta = (titulo, cuerpo, extra = '', clase = '') => `<section class="card${clase ? ` ${clase}` : ''}"${extra}><h2>${esc(titulo)}</h2>${cuerpo}</section>`;
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
    ${tablaHtml ? `<details class="detalle"><summary>Ver los datos en tabla</summary>${tablaHtml}</details>` : ''}`;
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
  const P = Analisis.peso(M);
  out.push(`<div class="cabecera-seccion"><h1>Mi resumen</h1>
    <p class="muted">Tus datos llegan hasta el <b>${F.dia(r.ultimoRegistro)}</b> (${antig}). Último entrenamiento: ${F.dia(r.ultimoEntreno)}. Copia importada el ${F.dia(new Date(ctx.inst.importadoEn))}.
    ${dias > 14 ? '<br>Para ver lo más reciente, exporta una copia nueva en el móvil e impórtala.' : ''}</p>
    ${contextoBloque(M, P)}</div>`);

  // --- de un vistazo: cuatro cifras con su mini gráfica ---
  out.push(cifrasClave(M, P));
  // --- conclusiones priorizadas ---
  out.push(tarjetaConclusiones(M));
  // --- todo el bloque sobre un mismo eje de fechas ---
  out.push(tarjetaLineaTiempo(M, ctx.capasOcultas || new Set()));
  // --- detalle ---
  out.push(`<div class="resumen-fila"><div class="resumen-principal">${tarjetaComparables(M)}</div>
    <div class="resumen-lateral">${[tarjetaEjercicios(M), tarjetaVolumenGrupos(M)].filter(Boolean).join('')}</div></div>`);
  out.push(`<div class="grid resumen-grid">${[tarjetaConstancia(M), tarjetaPeso(M, P), tarjetaRecuperacion(M)].filter(Boolean).join('')}</div>`);
  out.push(tarjetaSiguiente());
  return out.join('');
}

/* Rutina y fase en una línea, bajo el título. */
function contextoBloque(M, P){
  const partes = [];
  if (M.raw.dias) partes.push(`Rutina de <b>${esc(M.raw.dias)} días${Motor.enCasa(M.raw) ? ' en casa' : ''}</b> · ${M.sistema === 'simple' ? 'progresión simple' : 'progresión doble'}`);
  const f = P && P.fase;
  if (f && f.tipo !== 'MAINTENANCE') partes.push(`fase de <b>${esc((FASE_NUT[f.tipo] || f.tipo).toLowerCase())}</b>${f.inicio ? ` desde el ${F.corta(f.inicio)}` : ''}`);
  else if (f) partes.push('fase de <b>mantenimiento</b>');
  return partes.length ? `<p class="resumen-contexto">${partes.join(' · ')}</p>` : '';
}

// ---------- cifras clave ----------
const ICONO_TONO = {
  verde: '<path d="M3.5 16.5l6-6 4 4 7-7"/><path d="M15 7.5h5.5V13"/>',
  rojo: '<path d="M3.5 7.5l6 6 4-4 7 7"/><path d="M15 16.5h5.5V11"/>',
  ambar: '<path d="M3 12c2.5-5 5-5 7.5 0s5 5 7.5 0 2.5-3 3-3"/>',
  gris: '<path d="M4 12h16"/><path d="M15 7l5 5-5 5"/>',
};
const icono = (d, clase = '') => `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;

function kpi(titulo, cuerpo, { tono = '', id = '' } = {}){
  return `<article class="card kpi${tono ? ` kpi-${tono}` : ''}"${id ? ` aria-labelledby="${id}"` : ''}><h2${id ? ` id="${id}"` : ''}>${esc(titulo)}</h2>${cuerpo}</article>`;
}
const grande = (valor, resto = '', logro = false) => `<p class="kpi-cifra${logro ? ' logro' : ''}">${esc(valor)}${resto ? ` <span>${esc(resto)}</span>` : ''}</p>`;

function cifrasClave(M, P){
  return `<section class="kpis" aria-label="De un vistazo">${[kpiNivel(M), kpiDias(M), kpiValoracion(M), kpiPeso(M, P), kpiEstado(M)].join('')}</section>`;
}

/* Tu nivel: la insignia global de la tarjeta «TU NIVEL» de la app. Nombre en
   el color de su nivel, barra de cinco tramos (cada uno con el color de SU
   nivel: lleno = conseguido, el que se llena = al que te acercas) y, en
   Élite, una sexta barra hacia el grado siguiente. La edad se mira a hoy,
   como en el móvil. */
function kpiNivel(M){
  const clas = Motor.clasificacionesNivel(M.raw, new Date());
  const g = Motor.nivelGlobal(clas);
  if (!g){
    return kpi('Tu nivel', `<p class="kpi-txt">${clas.length
      ? 'Tu nivel global aparecerá cuando tengas marcas en más ejercicios que puntúan y de movimientos distintos.'
      : 'Aún no tienes marcas en los ejercicios que puntúan para el nivel de fuerza.'}</p>`, { id: 'kpi-nivel' });
  }
  const titulo = g.esElite ? `${g.nombre} ${g.romano}` : g.nombre;
  const pct = Math.round(g.fraccionTramo * 100);
  const tramos = Motor.NIVEL_NOMBRES.map((n, i) =>
    `<span class="nivel-tramo"><i class="nivel-c${i}" style="width:${Math.round(Math.min(Math.max(g.puntuacion - i, 0), 1) * 100)}%"></i></span>`).join('');
  const progreso = g.siguiente ? `Progreso hacia ${g.siguiente}: ${pct} %`
    : g.siguienteGrado ? `Progreso hacia Élite ${Motor.NIVEL_ROMANOS[g.siguienteGrado - 1]}: ${pct} %`
    : 'Techo de la escala alcanzado';
  return `<article class="card kpi kpi-nivel nivel-b${g.indice}" aria-labelledby="kpi-nivel"><h2 id="kpi-nivel">Tu nivel</h2>
    <p class="nivel-nombre nivel-t${g.indice}">${esc(titulo)}</p>
    <div class="nivel-tramos" role="img" aria-label="${esc(`Nivel ${titulo}. ${progreso}`)}">${tramos}</div>
    ${g.esElite ? `<div class="nivel-tramo nivel-grado"><i class="nivel-c4" style="width:${pct}%"></i></div>` : ''}
    <p class="kpi-txt">Media de ${g.ejercicios} ejercicios · ${g.patrones} patrones</p>
    <p class="kpi-pie"><span>${esc(progreso)}</span></p></article>`;
}

function kpiDias(M){
  const k = Analisis.constancia(M);
  const primerLunes = M.sesiones.length ? Analisis._lunes(M.sesiones[0].fecha) : null;
  const semanas = Analisis.constancia(M, { semanas: 8 }).semanas.filter(s => primerLunes && +s.inicio >= +primerLunes);
  let racha = 0;
  for (let i = semanas.length - 1; i >= 0 && semanas[i].previstas != null && semanas[i].dias >= semanas[i].previstas; i--) racha++;
  const barras = GraficasEsc.barrasSemanas(semanas, `Días con sesión por semana: ${semanas.map(s => `${s.dias}${s.previstas != null ? ` de ${s.previstas}` : ''}`).join(', ')}`);
  const pie = semanas.length ? `<p class="kpi-pie"><span>${F.corta(semanas[0].inicio)}</span><span>${racha > 1 ? `${racha} semanas seguidas con lo previsto` : 'por semana'}</span></p>` : '';
  if (k.conocidas){
    return kpi('Días entrenados', `${grande(String(k.hechas), `/ ${k.previstas}`, k.hechas >= k.previstas)}
      <p class="kpi-txt">días con sesión de los previstos en tus últimas semanas completas</p>${barras}${pie}`, { id: 'kpi-dias' });
  }
  const hasta = soloDia(M.ref), desde = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - (Analisis.VENTANA_DIAS - 1));
  const ult = Analisis.enPeriodo(M.sesiones, desde, hasta);
  return kpi('Días entrenados', `${grande(String(ult.length))}<p class="kpi-txt">sesiones de fuerza en las últimas 4 semanas</p>${barras}${pie}`, { id: 'kpi-dias' });
}

function kpiValoracion(M){
  const v = M.valoracion;
  const enlace = `<div class="kpi-acciones">${ir('entrenamiento:rendimiento', 'Ver rendimiento por sesión')}</div>`;
  if (v.descarga) return kpi('Valoración general', `<p class="kpi-titular">${icono(ICONO_TONO.gris)}Semana de descarga</p>
    <p class="kpi-txt">El objetivo ahora es recuperar, así que la app no valora el rendimiento hasta que termine.</p>${enlace}`, { id: 'kpi-valoracion' });
  if (!v.tendencia) return kpi('Valoración general', `<p class="kpi-titular">${icono(ICONO_TONO.gris)}Datos insuficientes</p>
    <p class="kpi-txt">Hacen falta más sesiones recientes con rendimiento medido para valorar la tendencia.</p>${enlace}`, { id: 'kpi-valoracion' });
  const d = VALORACION[v.tendencia];
  const titulo = d.todos || d[fase(M.raw)];
  const n = v.ventana.length;
  const pct = v.ventana.map(p => p.pct);
  const mini = GraficasEsc.puntosRendimiento(pct, `Rendimiento de las sesiones de la valoración frente a tu nivel: ${pct.map(p => F.signo(p)).join(', ')}`);
  return kpi('Valoración general', `<p class="kpi-titular">${icono(ICONO_TONO[d.tono] || ICONO_TONO.gris, d.tono)}${esc(titulo)}</p>
    <p class="kpi-txt">${esc(d.frase(n))}</p>${mini}
    <p class="kpi-pie"><span>${F.corta(v.ventana[0].fecha)}</span><span>${F.corta(v.ventana[n - 1].fecha)}</span></p>`, { tono: d.tono, id: 'kpi-valoracion' });
}

function kpiPeso(M, P){
  if (!P || !P.actual){
    return kpi('Peso tendencia', M.pc
      ? `${grande(F.num(M.pc, 1), 'kg')}<p class="kpi-txt">peso de tu perfil. Tu copia no trae pesajes.</p>`
      : '<p class="kpi-txt">Tu copia no trae pesajes.</p>', { id: 'kpi-peso' });
  }
  const N = M.datos.nut, f = P.fase;
  const cambio = P.cambioKg != null ? `<b class="mono">${P.cambioKg > 0 ? '+' : P.cambioKg < 0 ? '−' : ''}${F.num(Math.abs(P.cambioKg), 1)} kg</b> en las últimas semanas` : 'Sin cambio calculable en las últimas semanas';
  const ritmo = P.tasaReal != null ? ` · ritmo <b class="mono">${F.signo(P.tasaReal, 1)}</b>/sem` : '';
  let extra = '';
  const inicio = f && f.inicio && N.serie && !N.serie.vacia ? N.serie.puntos.find(p => +p.fecha >= +soloDia(f.inicio) && p.tendenciaKg > 0) : null;
  if (f && f.pesoObjetivoKg > 0 && inicio && Math.abs(inicio.tendenciaKg - f.pesoObjetivoKg) > 0.05){
    const prog = Math.max(0, Math.min(1, (inicio.tendenciaKg - P.actual.tendenciaKg) / (inicio.tendenciaKg - f.pesoObjetivoKg)));
    const pctTxt = Math.round(prog * 100);
    extra = `<div class="kpi-progreso" role="img" aria-label="Llevas el ${pctTxt} % del camino hacia tu peso objetivo"><i style="width:${pctTxt}%"></i></div>
      <p class="kpi-pie"><span>${F.num(inicio.tendenciaKg, 1)} al empezar la fase</span><span>objetivo <b>${F.num(f.pesoObjetivoKg, 1)}</b></span></p>`;
  } else if (N.serie && !N.serie.vacia){
    const desde = +soloDia(M.ref) - 83 * 86400000;
    const serie = N.serie.puntos.filter(p => p.tendenciaKg > 0 && +p.fecha >= desde && +p.fecha <= +M.ref).map(p => p.tendenciaKg);
    extra = `<div class="kpi-linea">${GraficasEsc.linea(serie, { w: 230, h: 48, etiqueta: 'Peso tendencia de las últimas semanas' })}</div>`;
  }
  return kpi('Peso tendencia', `${grande(F.num(P.actual.tendenciaKg, 1), 'kg')}<p class="kpi-txt">${cambio}${ritmo}</p>${extra}`, { id: 'kpi-peso' });
}

const BANDA_TXT = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };
function kpiEstado(M){
  const R = M.datos.readiness.filter(r => r.estadoEntrenar != null && +r.fecha <= +M.ref);
  if (!R.length) return kpi('Estado para entrenar', `<p class="kpi-txt">${M.raw.readinessActivo === true ? 'Aún no hay cuestionarios diarios en tu copia.' : 'No tienes activado el cuestionario diario en la app.'}</p>`, { id: 'kpi-estado' });
  const ult = R[R.length - 1];
  const banda = bandaEstado(ult.estadoEntrenar);
  const hasta = soloDia(M.ref);
  const porDia = new Map(R.map(r => [+soloDia(r.fecha), r.estadoEntrenar]));
  const dias = [];
  for (let i = 13; i >= 0; i--){ const f = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - i); dias.push({ fecha: f, valor: porDia.has(+f) ? porDia.get(+f) : null }); }
  const mini = GraficasEsc.barrasEstado(dias, `Estado para entrenar de los últimos días: ${dias.map(d => d.valor == null ? 'sin dato' : Math.round(d.valor)).join(', ')}`);
  return kpi('Estado para entrenar', `<div class="kpi-cab-estado">${grande(String(Math.round(ult.estadoEntrenar)), '/ 100')}${chip(banda === 'verde' ? 'verde' : banda, BANDA_TXT[banda])}</div>
    <p class="kpi-txt">Tu último cuestionario, el ${F.dia(ult.fecha)}.</p>${mini}
    <p class="kpi-pie"><span>${F.corta(dias[0].fecha)}</span><span>${F.corta(dias[dias.length - 1].fecha)}</span></p>`, { id: 'kpi-estado' });
}

// ---------- línea de tiempo ----------
const CAPAS = [['rend', 'Rendimiento'], ['peso', 'Peso'], ['entrenos', 'Entrenos']];
function tarjetaLineaTiempo(M, ocultas){
  const N = M.datos.nut;
  const pesajes = N && N.pesajes ? N.pesajes.filter(p => !p.enmascarado && p.pesoKg > 0) : [];
  if (!M.sesiones.length && !pesajes.length) return '';
  const hasta = soloDia(M.ref);
  const primeros = [M.sesiones[0] && M.sesiones[0].fecha, pesajes[0] && pesajes[0].fecha].filter(Boolean);
  const inicio = new Date(Math.min(...primeros.map(d => +soloDia(d))));
  const desde = new Date(Math.max(+Analisis._dias(Analisis._lunes(hasta), -77), +Analisis._lunes(inicio)));
  const dentro = f => f && +soloDia(f) >= +desde && +soloDia(f) <= +hasta;
  const sesiones = M.sesiones.filter(s => dentro(s.fecha)).map(s => ({ fecha: s.fecha, dia: s.dia, valor: s.bruto, descarga: s.descarga, sinBase: s.sinBase }));
  const peso = pesajes.length ? {
    tendencia: (N.serie && !N.serie.vacia ? N.serie.puntos : []).filter(p => p.tendenciaKg > 0 && dentro(p.fecha)).map(p => ({ fecha: p.fecha, kg: p.tendenciaKg })),
    pesajes: pesajes.filter(p => dentro(p.fecha)).map(p => ({ fecha: p.fecha, kg: p.pesoKg })),
    objetivo: N.fase && N.fase.pesoObjetivoKg > 0 ? N.fase.pesoObjetivoKg : null,
  } : null;
  const nutri = M.datos.nutricion || {};
  const fases = [...(nutri.fasesCerradas || []), ...(nutri.fase ? [nutri.fase] : [])]
    .filter(f => f && f.inicio && FASE_NUT[f.tipo])
    .map(f => ({ tipo: f.tipo, texto: FASE_NUT[f.tipo], desde: soloDia(f.inicio), hasta: soloDia(f.fin || hasta) }))
    .filter(f => +f.hasta >= +desde && +f.desde <= +hasta && +f.hasta >= +f.desde)
    .map(f => ({ ...f, desde: +f.desde < +desde ? desde : f.desde, hasta: +f.hasta > +hasta ? hasta : f.hasta }));
  const cardio = (M.datos.cardio || []).map(c => c.fecha).filter(dentro);
  const botones = CAPAS.map(([k, t]) => `<button type="button" class="lt-capa" data-capa-btn="${k}" aria-pressed="${ocultas.has(k) ? 'false' : 'true'}"><i aria-hidden="true"></i>${t}</button>`).join('');
  return `<section class="card linea-tiempo${[...ocultas].map(k => ` oculta-${k}`).join('')}" id="lineaTiempo" aria-labelledby="t-linea">
    <div class="lt-cabecera"><div class="lt-titulo"><h2 id="t-linea">Tu bloque en una línea de tiempo</h2><span class="chip verde">Solo en el escritorio</span>
      <p class="muted">Rendimiento, peso y entrenos sobre las mismas fechas, para ver cómo se relacionan. Pasa el ratón por un punto para ver su detalle.</p></div>
      <div class="lt-capas" role="group" aria-label="Capas visibles">${botones}</div></div>
    <div class="lt-desplazable tabla-scroll"><div class="lt-lienzo">${GraficasEsc.lineaTiempo({ desde, hasta, sesiones, peso, cardio, fases })}</div></div>
    <p class="muted lt-pie">Del ${F.dia(desde)} al ${F.dia(hasta)}, tu último registro.</p>
    ${ayuda('Cada punto de arriba es una sesión de fuerza comparada con tu nivel reciente en ese día de la rutina: por encima en lima y por debajo en naranja. Las franjas grises son semanas de descarga, que no cuentan para el rendimiento. El peso es la tendencia que calcula la app, con tus pesajes de fondo.')}
  </section>`;
}

// ---------- volumen por grupo ----------
function tarjetaVolumenGrupos(M){
  let series, sub;
  if (M.planConocido && M.planMod.length){
    series = Analisis.volumenPlan(M, M.planMod).series;
    sub = 'Series por semana en tu rutina actual';
  } else {
    const ult = Analisis.volumen(M, { gran: 'semana' }).cubos.filter(c => !c.enCurso && c.dias === 7).pop();
    if (!ult) return null;
    series = ult.series;
    sub = `Series de tu última semana completa (${F.corta(ult.inicio)}–${F.corta(new Date(+ult.finExclusivo - 86400000))})`;
  }
  const filas = [...series].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!filas.length) return null;
  const max = filas[0][1];
  return tarjeta('Volumen por grupo', `<p class="muted tarjeta-sub">${sub}</p>
    <ul class="vol-lista">${filas.map(([g, v]) => `<li><span>${esc(g)}</span><span class="vol-barra" aria-hidden="true"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><b>${F.num(v, 1).replace(/,0$/, '')}</b></li>`).join('')}</ul>
    <div class="fila-botones">${ir('entrenamiento:volumen', 'Ver volumen por semana')}${ir('rutina', 'Ajustar en Mi rutina')}</div>`);
}

// ---------- accesos del escritorio ----------
const TILES = [
  ['informes', 'Informe del último mes', 'Tu mes en un documento para imprimir o guardar en PDF', '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10z"/><path d="M14 3.5v5h5M9 13h6M9 16.5h6"/>'],
  ['entrenamiento:comparar', 'Compara dos periodos', 'Tus últimas semanas frente a las anteriores, lado a lado', '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>'],
  ['fisica', 'Compara tus fotos', 'Dos fechas lado a lado, con el peso de cada una', '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>'],
  ['rutina', 'Prepara tu próximo bloque', 'Todos los días a la vista y exportación a la app', '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>'],
];
function tarjetaSiguiente(){
  return `<section class="siguiente" aria-labelledby="t-siguiente"><h2 id="t-siguiente">Sigue en el escritorio</h2>
    <div class="tiles">${TILES.map(([d, t, s, ic]) => `<button type="button" class="tile" data-ir="${d}">${icono(ic, 'tile-ico')}<span class="tile-txt"><b>${t}</b><span>${s}</span></span>${icono('<path d="M9 6l6 6-6 6"/>', 'tile-flecha')}</button>`).join('')}</div></section>`;
}

const FASE_NUT = { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' };
const TIPO_REC = { ADJUST: 'Ajuste', HOLD: 'Mantener', REFEED: 'Recarga', LOWER_TARGET: 'Bajar objetivo', END_PHASE: 'Fin de fase' };
// Qué pasó con cada propuesta de ajuste (la app solo cambia tu pauta al aceptarla).
const ESTADO_REC = { PROPOSED: 'Propuesta sin decidir', POSTPONED: 'Pospuesta', ACCEPTED: 'Aceptada', SUPERSEDED: 'Sustituida por otra',
  EXPIRED: 'Caducada', LEGACY_RECONCILED: 'Ya incluida en tu pauta', DEFERRED: 'Aplazada' };

/* Celda de fecha: si la fila viene de una sesión, abre su detalle. */
function celdaFecha(f){
  if (f.semana) return `${F.corta(f.fecha)}–${F.corta(new Date(f.fecha.getFullYear(), f.fecha.getMonth(), f.fecha.getDate() + 6))}`;
  return f.indice != null ? `<button type="button" class="enlace" data-sesion="${f.indice}">${F.dia(f.fecha)}</button>` : F.dia(f.fecha);
}

function conclusionHtml(c, i){
  const id = `concl-${i}`;
  return `<article class="conclusion tono-${esc(c.tono)}" aria-labelledby="${id}">
    <h3 id="${id}">${esc(c.titulo)}</h3>
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
  return tarjeta('Constancia', `${res}${tabla(['Semana', 'Sesiones', 'Días con sesión', 'Previstos', '<span class="sr-only">Descarga</span>'], filas, { caption: 'Sesiones por semana' })}
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
  // Evolución larga (últimas semanas de la línea de tiempo) para la mini
  // línea; la lectura y el cambio siguen siendo los de la ventana corta.
  const desdeLargo = +soloDia(M.ref) - 83 * 86400000;
  const filas = lista.map(x => {
    const [cl, txt] = LECTURA[x.lectura];
    const serie = x.ej.puntos.filter(p => p.e1rmMarca != null && +p.fecha >= desdeLargo).map(p => p.e1rmMarca);
    const sub = [x.ej.lineas[0] && x.ej.lineas[0].dia, x.ej.grupo].filter(Boolean).map(esc).join(' · ');
    return [DibujosEsc.celda(x.nombre, `<button type="button" class="enlace" data-ejercicio="${esc(x.nombre)}">${esc(x.nombre)}</button>${sub ? `<span class="ej-sub">${sub}</span>` : ''}`, { extra: ` data-ejercicio="${esc(x.nombre)}"` }),
      GraficasEsc.linea(serie, { etiqueta: serie.length > 1 ? `1RM estimado de ${x.nombre} en las últimas semanas: de ${F.kg(serie[0])} a ${F.kg(serie[serie.length - 1])}` : '' }),
      `${x.inicio != null && x.fin != null ? `<span class="mono"><span class="muted nowrap">${F.num(x.inicio, 1)} →</span> <b class="nowrap">${F.kg(x.fin)}</b></span>` : '—'}
        <span class="ej-sub">${x.n} de ${F.plural(x.enPeriodo, 'sesión comparable', 'sesiones comparables')}</span>`,
      x.deltaPct != null ? `<b class="mono nowrap ${x.deltaPct > 0 ? 'sube' : x.deltaPct < 0 ? 'baja' : ''}">${F.signo(x.deltaPct)}</b>` : '—',
      chip(cl, txt, x.lectura !== 'insuficiente' && !x.firme ? 'Pocas sesiones comparables: no se usa como conclusión' : '')];
  });
  return tarjeta('Evolución de tus ejercicios', `${tabla(['Ejercicio', 'Evolución', '1RM estimado', 'Cambio', 'Lectura'], filas, { caption: 'Evolución del 1RM estimado en las últimas semanas', clase: 'tabla-ejercicios' })}
    <div class="fila-botones">${ir('entrenamiento:comparar', 'Comparar dos periodos')}</div>
    ${ayuda('Compara el 1RM estimado del principio y del final de tus últimas semanas, solo con las sesiones normales de cada ejercicio (en verde, sin descarga, sin molestias ni cambios de un día) y con la misma modalidad de series. «Sin cambios claros» describe una diferencia pequeña; no significa que estés estancado. Con pocas sesiones comparables la lectura es orientativa y no se usa como conclusión. El 1RM es una estimación a partir de tus series.')}`);
}

/* Progreso de la fase frente a lo pactado, como «Cómo vas» de la app
   (18/10/2026): estado, barra de peso con la marca de lo previsto, barra de
   tiempo, frase acumulada, llegada prevista y si la meta ha cambiado desde
   el inicio. Mientras calibra o en pausa, barras sin veredicto. */
const PROGRESO_TXT = {
  enLinea: ['En línea', 'verde', 'Desde el inicio de la fase vas en línea con lo previsto.'],
  metaAlcanzada: ['Meta alcanzada', 'verde', 'Tu tendencia ya ha llegado a la meta de la fase.'],
  porDetras: ['Por detrás', 'ambar', kg => `Desde el inicio, vas ${kg} por detrás de lo previsto.`],
  porDelante: ['Por delante', 'ambar', kg => `Desde el inicio, vas ${kg} por delante de lo previsto.`],
  contrario: ['Al revés', 'ambar', 'Desde el inicio, tu peso se ha movido en sentido contrario al previsto.'],
};
function progresoFase(N){
  const p = N && N.progreso;
  if (!p) return '';
  const kgAbs = v => F.kg(Math.abs(v));
  let etiqueta, clase, frase;
  if (p.direccion === 0){
    const dentro = p.estado === 'enLinea';
    etiqueta = dentro ? 'En tu rango' : 'Fuera de tu rango'; clase = dentro ? 'verde' : 'ambar';
    const d = p.pesoHoyKg - p.pesoInicioKg;
    frase = dentro ? 'Tu peso se mantiene cerca de donde empezaste.' : `Tu peso está ${kgAbs(d)} ${d > 0 ? 'por encima' : 'por debajo'} de donde empezaste.`;
  } else {
    const t = PROGRESO_TXT[p.estado];
    etiqueta = t[0]; clase = t[1]; frase = typeof t[2] === 'function' ? t[2](kgAbs(p.desvioKg)) : t[2];
  }
  const ver = p.conVeredicto;
  const barra = (fr, color, marca, nombre) => `<div class="fase-barra" role="img" aria-label="${esc(nombre)}"><i style="width:${Math.round(fr * 1000) / 10}%;background:${color}"></i>${marca != null ? `<b style="left:${Math.round(marca * 1000) / 10}%" title="Lo previsto a esta fecha"></b>` : ''}</div>`;
  const color = !ver ? 'var(--txt4)' : clase === 'verde' ? 'var(--lima)' : 'var(--ambar)';
  const filas = [];
  if (p.fraccionPeso != null && p.totalKg != null)
    filas.push(`<div class="fase-fila"><span>Peso</span><b class="mono">${F.num(Math.max(0, p.hechoKg), 1)} de ${F.kg(p.totalKg)}</b></div>${barra(p.fraccionPeso, color, p.fraccionPrevista, `Llevas ${F.num(Math.max(0, p.hechoKg), 1)} de ${F.kg(p.totalKg)}`)}`);
  if (p.fraccionTiempo != null && p.semanasTotales != null){
    const sem = Math.min(p.semanaActual, Math.ceil(p.semanasTotales));
    filas.push(`<div class="fase-fila"><span>Tiempo</span><b class="mono">Semana ${sem} de ${F.num(p.semanasTotales, p.semanasTotales % 1 ? 1 : 0)}</b></div>${barra(p.fraccionTiempo, 'var(--txt3)', null, `Semana ${sem} de ${F.num(p.semanasTotales, 1)}`)}`);
  }
  let llegada = '';
  if (ver && p.pesoAlFinKg != null && p.fin) llegada = `Si sigues la pauta desde tu último pesaje, acabarás la etapa hacia ${F.kg(p.pesoAlFinKg)} el ${F.dia(p.fin)}.`;
  else if (ver && p.llegadaMeta && p.pesoMetaKg != null) llegada = `Si sigues la pauta desde tu último pesaje, llegarás a ${F.kg(p.pesoMetaKg)} hacia el ${F.dia(p.llegadaMeta)}.`;
  const c = p.compromiso;
  let cambio = '';
  if (c && c.pesoMetaKg != null && p.pesoMetaKg != null && (Math.abs(c.pesoMetaKg - p.pesoMetaKg) >= 0.05 || (c.fin && p.fin && diasEntre(c.fin, p.fin) !== 0)))
    cambio = c.fin && p.fin ? `Al empezar, tu meta era ${F.kg(c.pesoMetaKg)} para el ${F.dia(c.fin)}. Ahora es ${F.kg(p.pesoMetaKg)} para el ${F.dia(p.fin)}.`
                            : `Al empezar, tu meta era ${F.kg(c.pesoMetaKg)}. Ahora es ${F.kg(p.pesoMetaKg)}.`;
  return `<div class="fase-progreso">
    <div class="fase-cab"><h3 class="sub-h">Progreso de la fase</h3>${ver ? chip(clase, etiqueta) : chip('gris', 'Sin veredicto todavía', 'Al empezar una fase, o con la fase en pausa, el peso aún no dice cómo vas.')}</div>
    ${filas.join('')}
    ${ver ? `<p class="fase-frase">${esc(frase)}</p>` : '<p class="muted" style="font-size:12.5px">La fase aún se está calibrando o está en pausa: se enseña el avance, sin veredicto.</p>'}
    ${llegada ? `<p class="muted" style="font-size:12.5px">${esc(llegada)}</p>` : ''}
    ${cambio ? `<p class="muted" style="font-size:12.5px">${esc(cambio)}</p>` : ''}
    ${c && c.reconstruido ? '<p class="muted" style="font-size:12.5px">El punto de partida se ha estimado con tu historial.</p>' : ''}
    <p class="muted" style="font-size:12.5px">A fecha de tu último pesaje (${F.dia(p.hoy)}).</p>
  </div>`;
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
    ${progresoFase(M.datos.nut)}
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
  // Las últimas semanas del estado para entrenar, día a día.
  const R = M.datos.readiness.filter(r => r.estadoEntrenar != null);
  if (a.activo && R.length){
    const hasta = soloDia(M.ref), porDia = new Map(R.map(r => [+soloDia(r.fecha), r.estadoEntrenar]));
    const dias = [];
    for (let i = Analisis.VENTANA_DIAS - 1; i >= 0; i--){ const f = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - i); dias.push({ fecha: f, valor: porDia.has(+f) ? porDia.get(+f) : null }); }
    if (dias.some(d => d.valor != null)) cuerpo += `<div class="rec-grafica">${GraficasEsc.estadoPeriodo(dias)}
      <div class="leyenda"><span><i style="background:var(--lima)"></i>Verde</span><span><i style="background:var(--ambar)"></i>Ámbar</span><span><i style="background:var(--rojo-vivo)"></i>Rojo</span></div></div>`;
  }
  return tarjeta('Recuperación', `${cuerpo}
    <div class="fila-botones">${ir('recuperacion', 'Ver recuperación')}</div>`);
}

// ---------------------------------------------------------------
// ENTRENAMIENTO
// ---------------------------------------------------------------
const SUBS = [['sesiones', 'Sesiones'], ['ejercicios', 'Ejercicios'], ['rendimiento', 'Rendimiento'], ['volumen', 'Volumen'], ['comparar', 'Comparar periodos']];

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
  else if (sub === 'comparar') cuerpo = compararPeriodos(M, st);
  else cuerpo = sesiones(M, st);
  return `<div class="cabecera-seccion"><h1>Entrenamiento</h1></div>${subnav(sub, 'entrenamiento')}${cuerpo}`;
}

// Fase 4: selector manual. Las identidades de sesiones no se convierten en
// bloques: no incluyen la fecha exacta en que se empezó o terminó la rutina.
function compararPeriodos(M, st){
  const valores = st.periodos || Comparacion.defecto(M);
  const campos = ['a', 'b'].map((k, i) => `<fieldset><legend>Periodo ${i ? 'B' : 'A'}</legend>
    ${['desde', 'hasta'].map(c => `<div class="mod-fila"><label for="periodo-${k}-${c}">${c === 'desde' ? 'Desde' : 'Hasta'}</label>
      <input id="periodo-${k}-${c}" name="${k}-${c}" type="date" required value="${esc(valores[k]?.[c] || '')}"></div>`).join('')}</fieldset>`).join('');
  const selector = tarjeta('Comparar periodos', `<p>Elige dos intervalos para revisar qué cambió en tus registros.</p>
    <form id="compararPeriodos"><div class="periodos-sel">${campos}</div><div class="fila-botones">
    <button type="submit" class="btn pri">Comparar</button><button type="button" class="btn sec" data-accion-vista="periodos-defecto">Últimas 4 semanas completas frente a las 4 anteriores</button></div></form>
    <p class="muted">Se conservan las fechas para este espacio personal. Puedes comparar bloques indicando sus fechas: la copia no permite reconstruir sus límites exactos a partir de los cambios de rutina.</p>`);
  let C;
  try { C = Comparacion.comparar(M, valores); }
  catch (e) { return selector + `<div class="alerta ambar" role="alert">${esc(e.message)}</div>`; }
  const { a, b } = C;
  const numero = (v, unidad = '', dec = 1) => v == null ? '—' : `${F.num(v, dec)}${unidad ? ' ' + unidad : ''}`;
  const muestra = (s, unidad = '') => s.n ? `${numero(s.mediana, unidad)} <span class="muted">· n=${s.n}<br>${F.dia(s.desde)}–${F.dia(s.hasta)}${s.conflictos ? `<br>${s.conflictos} días con valores contradictorios excluidos` : ''}</span>` : `—${s.conflictos ? ` (${s.conflictos} días contradictorios excluidos)` : ''}`;
  const diff = (x, y, unidad = '') => x == null || y == null ? '—' : `${y - x > 0 ? '+' : ''}${numero(y - x, unidad, 2)}`;
  const rutinaTxt = key => {
    if (key === 'Sin identidad histórica') return key;
    const [variante, dias, revision] = key.split('|');
    const tipo = variante.endsWith('_doble') ? 'Rutina doble' : variante.endsWith('_simple') ? 'Rutina simple' : variante;
    return `${tipo} · ${dias} días · versión ${revision}`;
  };
  const cab = ['Dato', 'Periodo A', 'Periodo B'];
  const filas = [
    ['Fechas', `${F.dia(a.desde)}–${F.dia(a.hasta)}`, `${F.dia(b.desde)}–${F.dia(b.hasta)}`],
    ['Duración seleccionada', `${a.dias} días`, `${b.dias} días`],
    ['Sesiones de fuerza registradas', String(a.sesiones.length), String(b.sesiones.length)],
    ['Semanas completas con cobertura', String(a.completas.length), String(b.completas.length)],
    ['Semanas parciales o fuera de cobertura', String(a.parciales.length), String(b.parciales.length)],
    ['Sesiones / semana completa', numero(a.frecuencia), numero(b.frecuencia)],
    ['Días con fuerza / semana completa', numero(a.diasSemana), numero(b.diasSemana)],
    ['Constancia frente a plan conocido', ...[a, b].map(p => p.conocidas ? `${p.hechasConPlan} de ${p.previstas} días previstos · ${p.conocidas} semanas` : 'Sin planificación histórica suficiente')],
    ['Sesiones de descarga', String(a.descarga), String(b.descarga)],
    ['Tiempo por sesión (mediana)', muestra(a.duracion, 'min'), muestra(b.duracion, 'min')],
    ['Rutinas registradas', ...[a, b].map(p => p.rutinas.map(k => esc(rutinaTxt(k))).join('<br>') || '—')],
  ];
  // Franja de diferencias principales: de A a B, sin colores de «mejor» o
  // «peor» (la comparación no declara ganador).
  const tileAB = (titulo, va, vb, nota, dif) => `<article class="ab-tile"><h3>${titulo}</h3>
    <p class="ab-valores"><span class="ab-a">${va}</span><svg class="icono" viewBox="0 0 24 24" aria-label="pasa a" role="img"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span class="ab-b">${vb}</span></p>
    <p class="ab-pie"><span>${nota}</span>${dif && dif !== '—' ? `<span class="chip gris">${dif}</span>` : ''}</p></article>`;
  const constTxt = p => p.conocidas ? `${p.hechasConPlan}/${p.previstas}` : '—';
  const pesoA = C.contextoA.peso.mediana, pesoB = C.contextoB.peso.mediana;
  const resumenAB = `<section class="ab-resumen" aria-label="Diferencias principales entre A y B">
    ${tileAB('Sesiones de fuerza', String(a.sesiones.length), String(b.sesiones.length), `${a.dias} y ${b.dias} días`, diff(a.sesiones.length, b.sesiones.length).replace(/,00$/, ''))}
    ${tileAB('Por semana completa', numero(a.frecuencia), numero(b.frecuencia), 'sesiones de media', diff(a.frecuencia, b.frecuencia))}
    ${tileAB('Días previstos', constTxt(a), constTxt(b), 'con sesión, frente a tu rutina', '')}
    ${tileAB('Peso del periodo', numero(pesoA, 'kg'), numero(pesoB, 'kg'), 'mediana de tus pesajes', diff(pesoA, pesoB, 'kg'))}
  </section>`;
  const out = [selector, resumenAB, tarjeta('Muestra y contexto de entrenamiento',
    `<p class="muted">Diferencias descriptivas: no hay un periodo ganador ni se demuestra qué provocó los cambios. «—» significa dato ausente o muestra insuficiente, no cero.</p>
    ${C.avisos.map(t => `<p class="aviso-comparacion">${esc(t)}</p>`).join('')}${tabla(cab, filas, { caption: 'Duración y muestras de los periodos' })}
    ${ayuda('Las semanas son de lunes a domingo. Las medias usan solo semanas completas incluidas en la selección y entre el primer registro disponible y el último. Las semanas sin entrenamientos dentro de esa cobertura cuentan como cero sesiones registradas. La copia puede contener huecos: cero registros no demuestra que no entrenaras. Los días previstos usan la identidad histórica acotada por sesiones, nunca la frecuencia actual sin comprobarla. El tiempo excluye duraciones ausentes, no positivas o marcadas como anómalas.')}`)];

  const semanas = (p, letra) => p.semanas.map(s => [letra, `${F.dia(s.desde)}–${F.dia(s.hasta)}`, s.completa ? 'Completa' : 'Parcial / sin cobertura',
    s.indices.map(i => `<button type="button" class="enlace" data-sesion="${i}">${F.corta(M.sesiones.find(x => x.indice === i).fecha)}</button>`).join(', ') || '0 registradas',
    String(s.dias), s.previstas == null ? '—' : String(s.previstas)]);
  out.push(tarjeta('Semanas completas y parciales', `<details class="detalle"><summary>Ver semanas y sesiones de origen</summary>
    ${tabla(['Periodo', 'Fechas incluidas', 'Tipo', 'Sesiones (abrir detalle)', 'Días con sesión', 'Días previstos'], [...semanas(a, 'A'), ...semanas(b, 'B')], { caption: 'Semanas y sesiones incluidas en cada periodo' })}</details>`));

  const maxDif = Math.max(5, ...C.ejercicios.comunes.map(e => Math.abs(e.deltaPct || 0)));
  const ejerc = C.ejercicios.comunes.map(e => {
    const motivos = p => Object.entries(p.excluidos).map(([k, n]) => `${n} ${Analisis.MOTIVO_TXT[k] || k}`).join(', ');
    const valor = p => p.n ? `${numero(p.mediana, 'kg')} · n=${p.n} de ${p.registradas}<br><span class="muted">${esc(motivos(p))}</span>` : `— · 0 de ${p.registradas}<br><span class="muted">${esc(motivos(p))}</span>`;
    const avisos = [e.deltaPct == null ? (e.pesoCorporal ? 'Peso corporal histórico no reconstruible: sin diferencia estimada.' : 'No hay sesiones válidas suficientes en los dos periodos con esta modalidad para calcular una diferencia.') : '',
      e.seriesDistintas ? 'Cambió el número de series: no comparar tonelaje ni repeticiones totales.' : '',
      e.cambioRutina ? 'Rutinas distintas; contexto diferente.' : ''].filter(Boolean).join(' ');
    const barra = e.deltaPct == null ? '' : `<span class="dif-barra" aria-hidden="true"><i class="${e.deltaPct < 0 ? 'neg' : 'pos'}" style="width:${(Math.min(1, Math.abs(e.deltaPct) / maxDif) * 50).toFixed(1)}%"></i></span>`;
    return [DibujosEsc.celda(e.nombre, `<button type="button" class="enlace" data-ejercicio="${esc(e.nombre)}">${esc(e.nombre)}</button><span class="ej-sub">${esc(Analisis.MODALIDAD_TXT[e.config])}</span>`, { extra: ` data-ejercicio="${esc(e.nombre)}"` }),
      valor(e.a), valor(e.b), `<span class="dif-celda">${barra}<span>${F.signo(e.deltaPct)}</span></span>`, esc(avisos)];
  });
  out.push(tarjeta('Ejercicios comunes · 1RM estimado', `${ejerc.length ? tabla(['Ejercicio / modalidad', 'Mediana A', 'Mediana B', 'Diferencia B − A', 'Limitaciones'], ejerc, { caption: 'Comparación de ejercicios comunes' }) : vacio('No hay ejercicios realizados en ambos periodos.')}
    <p class="muted">Solo A: ${esc(C.ejercicios.soloA.join(', ') || 'ninguno')}. Solo B: ${esc(C.ejercicios.soloB.join(', ') || 'ninguno')}.</p>
    ${ayuda('Se compara la mediana del 1RM estimado de marca, con el tope de repeticiones de la app, por nombre y modalidad. Se excluyen descarga, molestias, cambio de un día, días no verdes y entradas sin estimación. Cada sesión cuenta una vez. Con pocas sesiones por periodo la diferencia es descriptiva: no confirma una tendencia. En ejercicios de peso corporal la estimación usa el peso del perfil actual: no se calcula una diferencia histórica. La copia tampoco permite verificar cambios de máquina, técnica o rango de movimiento.')}`));

  const rend = C.rendimiento.flatMap(g => ['bruto', 'neto'].filter(k => g[`${k}A`].n || g[`${k}B`].n).map(k => {
    const A = g[`${k}A`], B = g[`${k}B`];
    const mixto = k === 'neto' && g.netoMixto ? '<br><span class="muted">Mezcla sesiones guardadas antes y después de que la app cambiara cómo descuenta la fatiga: compara mejor el bruto.</span>' : '';
    return [`${esc(rutinaTxt(g.rutina))}<br>${esc(g.dia)} · ${k === 'bruto' ? 'Bruto' : 'Neto'}${mixto}`, muestra(A, '%'), muestra(B, '%'),
      A.n >= 2 && B.n >= 2 ? diff(A.mediana, B.mediana, 'pp') : 'Muestra insuficiente'];
  }));
  out.push(tarjeta('Rendimiento guardado por la app', `${rend.length ? tabla([...cab, 'Diferencia B − A'], rend, { caption: 'Rendimiento por identidad de rutina y día' }) : vacio('No hay rendimiento agrupable con identidad histórica completa.')}
    ${ayuda('Bruto y neto son porcentajes frente a la referencia móvil de cada sesión; esa referencia puede cambiar dentro de la misma rutina. La diferencia se expresa en puntos porcentuales y no mide fuerza ganada. Se separan rutina (variante, días y revisión explícita) y día. No se inventan porcentajes a partir de «buena» o «floja», ni se comparan grupos ausentes de un periodo. Las descargas y los puntos sin referencia quedan fuera.')}`));

  const grupos = Motor.GRUPOS_VOLUMEN.filter(g => [...a.semanas, ...b.semanas].some(s => s.volumen.has(g)));
  const parcial = (p, g) => p.parciales.reduce((n, s) => n + (s.volumen.get(g) || 0), 0);
  out.push(tarjeta('Series realizadas por grupo muscular', (a.sinGrupo.length || b.sinGrupo.length ? `<p class="muted">Sin reparto por grupo: ${esc([...new Set([...a.sinGrupo, ...b.sinGrupo])].join(', '))}.</p>` : '') + (grupos.length ? tabla(['Grupo', 'A · series / semana completa', 'B · series / semana completa', 'Diferencia B − A', 'A · parciales (total)', 'B · parciales (total)'], grupos.map(g => {
    const A = a.completas.length ? a.volumen.get(g) || 0 : null, B = b.completas.length ? b.volumen.get(g) || 0 : null;
    return [esc(g), numero(A), numero(B), diff(A, B), numero(parcial(a, g)), numero(parcial(b, g))];
  }), { caption: 'Series por grupo en semanas completas' }) + ayuda('Mismo reparto que la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. Incluye series realizadas con molestias, descargas y modalidades especiales; «no realizado» no suma. Las columnas de parciales son totales registrados, sin proyectarlos a una semana ni calcular diferencias entre ellos. Un ejercicio puede contribuir a varios grupos, por lo que sumar grupos no equivale al número de series totales.') : vacio('No hay series asignables a grupos en estos periodos.'))));

  const contexto = [C.contextoA, C.contextoB];
  const medidas = [...new Set(contexto.flatMap(c => Object.keys(c.medidas)))];
  const vacia = { n: 0, mediana: null };
  out.push(tarjeta('Peso y contornos registrados', tabla([...cab, 'Diferencia entre medianas B − A'], [
    ['Peso medido', ...contexto.map(c => muestra(c.peso, 'kg')), diff(C.contextoA.peso.mediana, C.contextoB.peso.mediana, 'kg')],
    ...medidas.map(k => { const A = C.contextoA.medidas[k] || vacia, B = C.contextoB.medidas[k] || vacia;
      return [esc(Comparacion.sitios[k]), muestra(A, 'cm'), muestra(B, 'cm'), diff(A.mediana, B.mediana, 'cm')]; }),
  ], { caption: 'Medianas de peso y contornos de cada periodo' }) + ayuda('Son medianas de mediciones tomadas dentro de cada periodo, con sus fechas reales. No se arrastran medidas fuera del intervalo ni se usa el peso actual del perfil. Una única medida describe ese día, no una tendencia. La diferencia no es un cambio entre extremos ni mide músculo ganado o perdido. Los pesajes siguen la deduplicación móvil (primero por día); en contornos los duplicados contradictorios se excluyen.')));

  const nutTexto = c => c.fases.length ? c.fases.map(f => `${esc(FASE_NUT[f.tipo] || f.tipo)} · ${F.dia(f.inicio)}–${f.fin ? F.dia(f.fin) : 'sin cierre registrado'}`).join('<br>') : 'Sin fase histórica fechada';
  out.push(tarjeta('Contexto nutricional', tabla(cab, [
    ['Fases que coinciden con el periodo', ...contexto.map(nutTexto)],
    ['Recomendaciones registradas', ...contexto.map(c => String(c.recomendaciones.length))],
    ['Ajustes aceptados', ...contexto.map(c => String(c.recomendaciones.filter(r => r.estadoPropuesta === 'ACCEPTED').length))],
    ['Ritmo real guardado (mediana)', ...contexto.map(c => muestra(Comparacion.estadistica(c.recomendaciones.filter(r => r.tasaRealPctSemana != null).map(r => ({ fecha: r.fecha, valor: r.tasaRealPctSemana }))), '% / semana'))],
  ], { caption: 'Contexto nutricional histórico' }) + `<details class="detalle"><summary>Ver recomendaciones y ajustes guardados</summary>${tabla(['Periodo', 'Fecha', 'Fase', 'Tipo', 'Qué pasó', 'Ajuste propuesto (kcal/día)'], contexto.flatMap((c, i) => c.recomendaciones.map(r => [i ? 'B' : 'A', F.dia(r.fecha), esc(r.faseId), esc(TIPO_REC[r.tipo] || r.tipo), r.estadoPropuesta ? esc(ESTADO_REC[r.estadoPropuesta] || r.estadoPropuesta) : '—', numero(r.ajusteKcalDia)])), { caption: 'Recomendaciones nutricionales dentro de la selección' })}</details>` +
    ayuda('Las fases proceden de sus fechas guardadas; el plan de temporada es una previsión y no se usa como historia realizada. No se aplica la fase actual a fechas anteriores a su inicio. Un ajuste solo cambia tu pauta si lo aceptaste en la app; los que quedaron sin decidir, pospuestos o sustituidos no la cambiaron. Ninguno demuestra ingesta real ni adherencia a la dieta. No se atribuyen los cambios de entrenamiento a la nutrición.')));

  out.push(tarjeta('Recuperación registrada', tabla([...cab, 'Diferencia B − A'], [
    ['Estado para entrenar (0–100)', ...contexto.map(c => muestra(c.estado)), diff(C.contextoA.estado.mediana, C.contextoB.estado.mediana)],
    ['VFC nocturna', ...contexto.map(c => muestra(c.vfc, 'ms')), diff(C.contextoA.vfc.mediana, C.contextoB.vfc.mediana, 'ms')],
    ['FC en reposo', ...contexto.map(c => muestra(c.fc, 'lpm')), diff(C.contextoA.fc.mediana, C.contextoB.fc.mediana, 'lpm')],
  ], { caption: 'Medianas de recuperación registrada' }) + ayuda('Se muestran días con medición válida; los huecos no cuentan como cero. La VFC descartada queda fuera. No se considera una VFC más alta automáticamente mejor ni se hacen recomendaciones médicas. Cambios de reloj, de condiciones de medida o pocos días registrados pueden explicar diferencias.')));
  return out.join('');
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
    if (e.estadoEjercicio && e.estadoEjercicio !== s.semaforo) m.push(chip(e.estadoEjercicio === 'verde' ? 'verde' : e.estadoEjercicio === 'rojo' ? 'rojo' : 'ambar', `Ejercicio en ${e.estadoEjercicio}`));
    const kgs = e.kgSets.some(k => k != null) && new Set(e.kgSets.filter(k => k != null)).size > 1
      ? F.series(e.kgSets.map(k => Motor.cargaOrientada(e.ejercicio, k))) : (e.kg == null ? '—' : F.num(Motor.cargaOrientada(e.ejercicio, e.kg), 2));
    const unidad = Motor.esPorTiempo(e.ejercicio, M.raw) ? 's' : 'reps';
    return [DibujosEsc.celda(e.ejercicio, `<button type="button" class="enlace" data-ejercicio="${esc(e.ejercicio)}">${esc(e.ejercicio)}</button>`, { extra: ` data-ejercicio="${esc(e.ejercicio)}"` }),
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
    return [DibujosEsc.celda(ej.nombre, `<button type="button" class="enlace" data-ejercicio="${esc(ej.nombre)}">${esc(ej.nombre)}</button>`, { extra: ` data-ejercicio="${esc(ej.nombre)}"` }),
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
  const etiquetas = [...new Set(ej.lineas.map(l => l.dia).filter(Boolean)), ej.grupo,
    ...ej.lineas.slice(0, 1).map(l => [l.series && `${l.series} × ${l.reps || '—'}`, l.rir != null && `RIR ${l.rir}`].filter(Boolean).join(' · '))].filter(Boolean);
  // El dibujo de la biblioteca va a la derecha de la cabecera, como en la
  // app; pulsarlo abre la ficha ampliada. Debajo del título, la nota técnica.
  out.push(`<section class="card ficha-cab"><div class="ficha-cab-fila"><div class="ficha-cab-txt"><h2>${esc(nombre)}</h2>
    ${ficha && ficha.nota ? `<p class="ej-nota ficha-nota">${esc(ficha.nota)}</p>` : ''}
    ${etiquetas.length ? `<p class="ficha-etiquetas">${etiquetas.map(t => `<span>${esc(String(t))}</span>`).join('')}</p>` : ''}
    <p>${est.map(({ s, t }) => `${chip(t.clase, t.corto)}${s.dia ? ` <span class="muted">${esc(s.dia)}</span>` : ''}`).join(' · ')}</p>
    ${est.map(({ s, t }) => t.largo ? `<p style="font-size:13px">${s.dia ? `<b>${esc(s.dia)}</b>: ` : ''}${esc(t.largo)}${s.objetivo != null ? ` Objetivo de la rutina: ${esc(String(s.reps))} reps.` : ''}${s.recurrente ? ' La app marcó que el estancamiento se repitió tras reiniciar los intentos.' : ''}${s.descarga ? ' Estás en descarga: ahora no se cuentan intentos.' : ''}</p>` : '').join('')}
    ${porQue.length ? `<details class="detalle"><summary>Por qué este estado</summary>${porQue.join('')}
      <p class="muted" style="font-size:12.5px">Son las sesiones más recientes de tu rutina actual que cuentan para la progresión, igual que en la app. Las descargas, las sesiones con molestias o con un cambio de un día y las que tienen series principales sin anotar no aparecen porque no cuentan.</p></details>` : ''}
    <div class="cifras">${cifra(String(ej.sesiones), 'sesiones')}
      ${cifra(F.dia(ej.primero && ej.primero.fecha), 'primera')}
      ${cifra(F.dia(ej.ultimo && ej.ultimo.fecha), 'última')}
      ${!ej.porTiempo ? cifra(ej.marca ? F.kg(ej.marca.valor) : '—', `mejor 1RM estimado${ej.marca ? ` (${F.corta(ej.marca.fecha)})` : ''}`) : ''}
      ${ficha ? cifra(ficha.grupo, 'grupo muscular') : ''}</div>
    ${ej.pesoCorporal ? `<p class="muted" style="font-size:12.5px">${ej.asistido ? 'Ejercicio asistido: la carga es la ayuda que restas a tu peso.' : 'Ejercicio con tu peso corporal: la carga anotada es el lastre.'} El 1RM estimado suma tu peso de perfil actual${M.pc ? ` (${F.kg(M.pc)})` : ''}, igual que la app, también en sesiones antiguas.${M.pc == null ? ' Tu copia no trae peso de perfil, así que no se estima.' : ''}</p>` : ''}
    ${ej.pesoFijo ? `<p class="muted" style="font-size:12.5px">Máquina con peso fijo de ${F.kg(ej.pesoFijo)}: la carga que ves es la que anotas, y el 1RM estimado y las marcas le suman ese peso, igual que la app, también en sesiones antiguas.</p>` : ''}</div>
    ${DibujosEsc.src(nombre) ? DibujosEsc.grande(nombre, { clase: 'ej-dibujo-cab' }) : ''}</div></section>`);

  // --- evolución: gráfica con marcas de contexto y tabla por serie ---
  const R = rangoGrafica(M, ej, st.graf);
  const ptsG = pts.filter(p => p.fecha >= R.desde && p.fecha < R.hastaExcl);
  const selRango = selectorRango(R);
  const marcasCtx = [];
  ptsG.forEach(p => {
    if (p.sesion.descarga) marcasCtx.push({ x: p.fecha, tipo: 'Descarga', label: 'Descarga', color: TL.azul });
    if (p.e.molestias) marcasCtx.push({ x: p.fecha, tipo: 'Molestias', label: 'Molestias', color: TL.ambar });
    if (p.sesion.cambioRutina) marcasCtx.push({ x: p.fecha, tipo: 'Cambio de rutina', label: 'Cambio de rutina', color: TL.txt3 });
  });
  const filas = ptsG.slice().reverse().map(p => [fechaSesion(p), esc(p.dia), seriesHtml(Analisis.seriesDe(p.e), ej.porTiempo),
    ...(ej.porTiempo ? [] : [p.e1rm != null ? `${F.num(p.e1rm, 1)}${p.e1rmMenosFiable ? ' <span class="muted" title="Muchas repeticiones: estimación menos precisa">≈</span>' : ''}` : '—']),
    marcasPunto(p)]);
  const cabTabla = ['Fecha', 'Sesión', `Series (${unidadCarga} × ${ej.porTiempo ? 'segundos' : 'reps'} @RIR)`, ...(ej.porTiempo ? [] : ['1RM est. (kg)']), 'Marcas'];
  const tablaHist = tabla(cabTabla, filas, { caption: `Historial de ${nombre} por serie`, clase: 'tabla-series' });
  const avisoVacio = vacio(`No entrenaste este ejercicio entre el ${F.dia(R.desde)} y el ${F.dia(R.hasta)}.`);
  if (!ptsG.length){
    out.push(tarjeta(ej.porTiempo ? 'Historial' : 'Evolución', selRango + avisoVacio));
  } else if (!ej.porTiempo){
    // La línea solo une sesiones que cuentan; las demás quedan como puntos
    // sueltos para no dibujar caídas que la app no tiene en cuenta.
    const e1 = ptsG.filter(p => p.e1rm != null);
    const serie1 = e1.filter(p => p.evaluable).map(p => ({ x: p.fecha, y: Math.round(p.e1rm * 10) / 10, c: p.estado === 'rojo' ? COLOR_ESTADO.rojo : p.noVerde ? TL.ambar : TL.lima }));
    const serieNo = e1.filter(p => !p.evaluable).map(p => ({ x: p.fecha, y: Math.round(p.e1rm * 10) / 10 }));
    const serie2 = ptsG.filter(p => p.cargaVista != null).map(p => ({ x: p.fecha, y: p.cargaVista }));
    const svg = Charts.lineas({ series: [
      { nombre: '1RM estimado', color: TL.lima, puntos: serie1, unidad: 'kg' },
      ...(serieNo.length ? [{ nombre: 'Sesiones que no cuentan', color: TL.txt4, puntos: serieNo, soloPuntos: true, unidad: 'kg' }] : []),
      { nombre: ej.asistido ? 'Asistencia' : ej.pesoCorporal ? 'Lastre' : 'Carga de la serie principal', color: TL.azul, puntos: serie2, unidad: 'kg', eje: 'der', dash: '5 4' },
    ], marcas: marcasCtx, w: 960, h: 280 });
    out.push(tarjeta('Evolución', selRango + grafica(svg, `1RM estimado y carga de ${nombre} por sesión`, tablaHist) +
      `<p class="muted" style="font-size:12.5px">El 1RM estimado es una estimación a partir de tu mejor serie de cada sesión (en drop set y rest-pause, solo la primera), no una prueba de máximo. Puntos grises sueltos: sesiones que no cuentan para la progresión (descarga, molestias, cambio de un día). Puntos ámbar: entrenado en un día ámbar; puntos rojos: en un día rojo. Las líneas verticales marcan descargas, molestias y cambios de rutina.</p>`));
  } else {
    out.push(tarjeta('Historial', selRango + tablaHist));
  }

  if (!ej.porTiempo){
    out.push(tarjetaEvolucionReciente(M, ej));
    out.push(tarjetaMarcas(M, ej));
  }
  out.push(tarjetaCompararSesiones(M, ej, st));
  return `<div class="ficha-layout">${listaLateral(M, nombre)}<div class="ficha-detalle">${out.join('')}</div></div>`;
}

/* Lista de ejercicios junto a la ficha: se salta de uno a otro sin volver a
   la tabla. Primero los de la rutina actual, por día; después el resto, del
   más reciente al más antiguo. En pantallas estrechas se oculta (queda el
   botón «Todos los ejercicios»). */
function listaLateral(M, actual){
  const todos = [...M.ejercicios.values()].filter(ej => ej.sesiones > 0);
  const dias = [...new Set(M.planMod.map(l => l.dia))];
  const diaDe = ej => ej.lineas.length ? dias.indexOf(ej.lineas[0].dia) : 99;
  const enRutina = todos.filter(ej => ej.lineas.length).sort((a, b) => diaDe(a) - diaDe(b) || a.nombre.localeCompare(b.nombre));
  const otros = todos.filter(ej => !ej.lineas.length).sort((a, b) => (b.ultimo ? +b.ultimo.fecha : 0) - (a.ultimo ? +a.ultimo.fecha : 0));
  const item = ej => {
    const serie = ej.puntos.filter(p => p.e1rmMarca != null).slice(-12).map(p => p.e1rmMarca);
    const sub = [ej.lineas[0] && ej.lineas[0].dia, ej.marca && F.kg(ej.marca.valor)].filter(Boolean).map(esc).join(' · ');
    const sel = ej.nombre === actual;
    return `<li><button type="button" class="ficha-item${sel ? ' sel' : ''}" data-ejercicio="${esc(ej.nombre)}"${sel ? ' aria-current="true"' : ''}>
      ${DibujosEsc.mini(ej.nombre, { clase: 'ej-dibujo-xs' })}<span class="ficha-item-txt"><span class="ficha-item-nom">${esc(ej.nombre)}</span>${sub ? `<span class="ficha-item-sub">${sub}</span>` : ''}</span>
      ${serie.length > 1 ? GraficasEsc.linea(serie, { w: 64, h: 22 }) : ''}</button></li>`;
  };
  const grupo = (titulo, lista) => lista.length ? `<p class="ficha-grupo">${esc(titulo)}</p><ul>${lista.map(item).join('')}</ul>` : '';
  return `<nav class="card ficha-lista" aria-label="Tus ejercicios">
    ${M.planConocido ? grupo('En tu rutina', enRutina) + grupo('Otros de tu historial', otros) : grupo('Tus ejercicios', [...enRutina, ...otros])}</nav>`;
}

/* Rango de fechas de la gráfica de un ejercicio. Los atajos cuentan hacia
   atrás desde la fecha de referencia de la copia; «Todo» va de la primera a
   la última sesión. g = { rango: 'todo'|'3m'|'6m'|'12m'|'fechas', desde, hasta }
   con desde/hasta en AAAA-MM-DD (solo en 'fechas'). */
const RANGOS_GRAF = [['todo', 'Todo'], ['3m', '3 meses'], ['6m', '6 meses'], ['12m', '1 año']];
function rangoGrafica(M, ej, g = null){
  const pts = ej.puntos.filter(p => p.hechas > 0);
  const primera = pts.length ? soloDia(pts[0].fecha) : soloDia(M.ref);
  const ultima = pts.length ? soloDia(pts[pts.length - 1].fecha) : soloDia(M.ref);
  const tipo = g && (g.rango === 'fechas' || RANGOS_GRAF.some(([k]) => k === g.rango)) ? g.rango : 'todo';
  let desde = primera, hasta = ultima;
  if (tipo === 'fechas'){
    desde = parseFecha(g.desde) ? soloDia(parseFecha(g.desde)) : primera;
    hasta = parseFecha(g.hasta) ? soloDia(parseFecha(g.hasta)) : ultima;
    if (hasta < desde) [desde, hasta] = [hasta, desde];
  } else if (tipo !== 'todo'){
    hasta = soloDia(M.ref) > ultima ? soloDia(M.ref) : ultima;
    const meses = { '3m': 3, '6m': 6, '12m': 12 }[tipo];
    desde = new Date(hasta.getFullYear(), hasta.getMonth() - meses, hasta.getDate() + 1);
  }
  const hastaExcl = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + 1);
  return { tipo, desde, hasta, hastaExcl, min: primera, max: ultima };
}
function selectorRango(R){
  const botones = RANGOS_GRAF.map(([k, txt]) => `<button type="button" data-graf-rango="${k}" aria-pressed="${R.tipo === k}" class="btn ${R.tipo === k ? 'pri' : 'sec'}">${txt}</button>`).join('');
  return `<div class="graf-rango" role="group" aria-label="Fechas de la gráfica">
      <div class="fila-botones">${botones}</div>
      <div class="graf-fechas">
        <div class="mod-fila"><label for="grafDesde">Desde</label><input type="date" id="grafDesde" value="${fmtISO(R.desde)}" min="${fmtISO(R.min)}" max="${fmtISO(R.max)}"></div>
        <div class="mod-fila"><label for="grafHasta">Hasta</label><input type="date" id="grafHasta" value="${fmtISO(R.hasta)}" min="${fmtISO(R.min)}" max="${fmtISO(R.max)}"></div>
      </div></div>`;
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
    ${tabla(['<span class="sr-only">Dato</span>', `<button type="button" class="enlace" data-sesion="${C.a.sesion.indice}">A · ${F.dia(C.a.fecha)}</button>`,
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
  if (p.noVerde && !p.sesion.descarga) m.push(p.estado === 'rojo' ? chip('rojo', 'Día rojo') : chip('ambar', 'Día ámbar'));
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
    ...(pn.length ? [{ nombre: 'Neto (descuenta la fatiga de más y el esfuerzo)', color: TL.azul, puntos: pn, unidad: '%', dash: '5 4' }] : []),
  ], lineaBase: { y: 0, label: 'Tu nivel reciente', color: TL.txt3 }, banda: { min: -tol, max: tol, label: 'Zona normal' }, w: 960, h: 280 });
  const filas = ses.slice().reverse().filter(s => s.bruto != null || s.neto != null || s.sinBase).map(s => [F.dia(s.fecha), esc(s.dia),
    s.sinBase ? '<span class="muted">sin referencia</span>' : F.signo(s.bruto), s.neto != null ? F.signo(s.neto) : '—',
    s.veredicto ? chip(...(VEREDICTO[s.veredicto] || ['gris', s.veredicto])) : '—', s.cambioRutina ? chip('azul', 'Cambio de rutina') : '']);
  return tarjeta('Rendimiento por sesión', grafica(svg, 'Rendimiento bruto y neto de cada sesión frente a tu nivel reciente',
      tabla(['Fecha', 'Sesión', 'Bruto', 'Neto', 'Valoración', '<span class="sr-only">Cambio de rutina</span>'], filas, { caption: 'Rendimiento por sesión' })) +
    ayuda('Son las cifras que la app calculó y guardó al terminar cada sesión: cuánto rindió frente a tu nivel reciente en ese día de la rutina (0 % = tu nivel). El neto, si registras el esfuerzo de la sesión, descuenta ese esfuerzo y la parte de la caída entre series que va más allá de la que sueles tener en esos ejercicios: la caída normal de cualquier sesión, o la que ya está prevista en tu rutina, no resta. Las sesiones antiguas conservan el neto con el que la app las guardó. Las sesiones que la app guardó sin referencia previa (al empezar una rutina, por ejemplo) aparecen como hueco. Las descargas no se muestran.'));
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

function contornos(modelo, st){
  if (!modelo.sitios.length) return tarjeta('Contornos', vacio(modelo.fuente ? 'No has registrado contornos.' : 'No hay registro de contornos en la copia JSON ni en el índice del ZIP.'));
  const sitio = modelo.sitios.includes(st.sitio) ? st.sitio : modelo.sitios.includes('cintura') ? 'cintura' : modelo.sitios[0];
  const serie = modelo.registros.filter(r => r.sitio === sitio && !r.conflicto);
  const t = Evolucion.tendenciaDe(serie);
  const puntos = serie.map(r => ({ x: parseFecha(r.fecha), y: r.cm }));
  const tendencias = t ? [serie[0], serie.at(-1)].map(r => ({ x: parseFecha(r.fecha), y: t.interceptoCm + t.pendienteCmPorDia * Evolucion.dias(t.origen, r.fecha) })) : [];
  const svg = puntos.length ? Charts.lineas({ series: [
    { nombre: SITIOS[sitio], color: TL.lima, unidad: 'cm', puntos },
    { nombre: 'Tendencia estimada', color: TL.txt2, unidad: 'cm', puntos: tendencias, sinPuntos: true, dash: '5 4' },
  ], w: 960, h: 260 }) : '';
  const fechas = [...new Set(modelo.registros.map(r => r.fecha))].sort().reverse();
  const valores = new Map(modelo.registros.map(r => [`${r.fecha}|${r.sitio}`, r]));
  const filas = fechas.map(f => [F.dia(f), ...modelo.sitios.map(s => {
    const r = valores.get(`${f}|${s}`);
    return !r ? '—' : r.conflicto ? '<span class="muted">Conflicto: valores distintos</span>' : `${F.num(r.cm)} cm`;
  })]);
  const aviso = modelo.conflictos.length ? `<p class="muted" role="status">${modelo.conflictos.length} días/sitios con valores contradictorios: se conservan en la copia, pero no se usan para asociar fotos ni para calcular tendencias.</p>` : '';
  return tarjeta('Contornos (cm)', `${modelo.fuente === 'zip' ? '<p class="muted">Contornos del índice del ZIP. El JSON no contiene un módulo de medidas; no se han mezclado registros.</p>' : ''}
    ${aviso}${modelo.repetidos ? `<p class="muted">${modelo.repetidos} registros repetidos; los idénticos se muestran una sola vez.</p>` : ''}
    <label for="contornoSitio">Contorno de la gráfica <select id="contornoSitio">${modelo.sitios.map(s => `<option value="${s}"${s === sitio ? ' selected' : ''}>${esc(SITIOS[s])}</option>`).join('')}</select></label>
    ${svg ? grafica(svg, `Evolución de ${SITIOS[sitio]} en cm`, tabla(['Fecha', `${esc(SITIOS[sitio])} (cm)`], serie.map(r => [F.dia(r.fecha), F.num(r.cm)]), { caption: 'Medidas de la gráfica' })) : vacio('No hay valores utilizables para la gráfica de este contorno.')}
    <p class="muted">${t ? `Tendencia estimada: ${t.cmPorMes > 0 ? '+' : t.cmPorMes < 0 ? '−' : ''}${F.num(Math.abs(t.cmPorMes), 2)} cm/mes · ${serie.length} medidas.` : 'Datos insuficientes para una tendencia: aún no hay bastantes medidas repartidas en el tiempo.'}</p>
    <details class="detalle"><summary>Todos los contornos por fecha</summary>${tabla(['Fecha', ...modelo.sitios.map(s => esc(SITIOS[s]))], filas, { caption: 'Contornos por fecha, sin arrastre' })}</details>
    ${ayuda('Los valores son medidas puntuales en centímetros; «—» significa que ese sitio no se midió ese día. La tendencia es la misma recta de la app ajustada a tus medidas, no una predicción. La repetición de un mismo valor en días distintos sigue siendo un registro válido. Ningún contorno ni fotografía permite deducir por sí solo músculo ganado o perdido.')}`);
}

function fisica(M, ctx){
  const out = ['<div class="cabecera-seccion"><h1>Evolución física</h1></div>'];
  out.push(ctx.galeriaHtml());
  const N = M.datos.nut;
  // --- peso ---
  if (N && N.pesajes.length){
    const pts = N.pesajes.map(p => ({ x: p.fecha, y: p.pesoKg, c: p.enmascarado ? TL.txt4 : TL.txt2 }));
    const tend = N.serie.vacia ? [] : N.serie.puntos.filter((p, i, a) => p.huboPesaje || i === a.length - 1).map(p => ({ x: p.fecha, y: Math.round(p.tendenciaKg * 100) / 100 }));
    const svg = Charts.lineas({ series: [
      { nombre: 'Pesajes', color: TL.txt2, puntos: pts, soloPuntos: true, unidad: 'kg' },
      { nombre: 'Peso tendencia', color: TL.lima, puntos: tend, unidad: 'kg', sinPuntos: true },
    ], w: 960, h: 260 });
    const filas = N.pesajes.slice().reverse().map(p => {
      const t = N.serie.vacia ? null : N.serie.puntos[N.serie.indice.get(p.clave)];
      return [F.dia(p.fecha), F.kg(p.pesoKg, 2), t ? F.kg(t.tendenciaKg, 2) : '—', p.enmascarado ? 'No cuenta (refeed o pausa)' : ''];
    });
    out.push(tarjeta('Peso', `<div class="cifras">
        ${cifra(N.tendenciaKg ? F.kg(N.tendenciaKg) : '—', `peso tendencia${N.fechaTendencia ? ` (${F.corta(N.fechaTendencia)})` : ''}`)}
        ${cifra(N.tasaPctSemana != null && N.pesajes.length > 1 ? F.signo(N.tasaPctSemana, 2) : '—', 'ritmo por semana')}
        ${N.fase ? cifra(FASE_NUT[N.fase.tipo] || N.fase.tipo, 'fase de nutrición') : ''}
        ${N.fase && N.fase.tipo !== 'MAINTENANCE' ? cifra(F.signo(N.fase.tasaObjetivoPctSemana, 2), 'ritmo objetivo') : ''}
        ${N.fase && N.fase.pesoObjetivoKg > 0 ? cifra(F.kg(N.fase.pesoObjetivoKg), 'peso objetivo') : ''}</div>
      ${progresoFase(N)}
      ${grafica(svg, 'Pesajes y peso tendencia', tabla(['Fecha', 'Pesaje', 'Tendencia', '<span class="sr-only">Observación</span>'], filas, { caption: 'Pesajes' }))}
      ${ayuda('La línea es el peso tendencia que calcula la app: suaviza las subidas y bajadas diarias de agua y comida para ver hacia dónde va tu peso. Los pesajes de días de refeed o tras una pausa se muestran, pero no mueven la tendencia. El progreso de la fase compara dónde está tu tendencia con dónde la ponía lo que pactaste al empezar, teniendo en cuenta los cambios de ritmo que aceptaste por el camino; la marca de la barra de peso es lo previsto. Ir por detrás no se recupera solo: el ajuste semanal de la app corrige el ritmo, no el terreno perdido.')}`));
  } else {
    out.push(tarjeta('Peso', vacio(M.pc ? `Tu copia no trae pesajes (la nutrición de la app no está activa). Peso de tu perfil: ${F.kg(M.pc)}.` : 'Tu copia no trae pesajes.')));
  }

  // --- composición (estimación) ---
  if (N && N.mediciones.length){
    const filas = N.mediciones.slice().reverse().map(m => [F.dia(m.fecha), `${F.num(m.porcentajePct, 1)} %`, F.kg(m.pesoAnclaKg), F.kg(m.grasaKg), F.kg(m.magraKg), esc(METODO[m.metodo] || m.metodo)]);
    const pct = Charts.lineas({ series: [{ nombre: '% graso estimado', color: TL.ambar, unidad: '%', puntos: N.mediciones.map(m => ({ x: m.fecha, y: m.porcentajePct })) }], w: 960, h: 230 });
    const masas = Charts.lineas({ series: [
      { nombre: 'Masa grasa estimada', color: TL.ambar, unidad: 'kg', puntos: N.mediciones.filter(m => m.grasaKg != null).map(m => ({ x: m.fecha, y: m.grasaKg })) },
      { nombre: 'Masa magra estimada', color: TL.lima, unidad: 'kg', puntos: N.mediciones.filter(m => m.magraKg != null).map(m => ({ x: m.fecha, y: m.magraKg })) },
    ], w: 960, h: 230 });
    out.push(tarjeta('Composición corporal (estimación)', `${grafica(pct, 'Estimaciones de porcentaje graso', '')}${grafica(masas, 'Masa grasa y masa magra estimadas en kg', '')}${tabla(['Fecha', '% graso', 'Peso', 'Masa grasa', 'Masa magra', 'Método'], filas, { caption: 'Mediciones de grasa corporal' })}
      <p class="muted" style="font-size:12.5px">El % graso es una estimación del método que usaste, y las masas salen de multiplicarlo por tu peso de ese día. Un cambio de masa magra no equivale a músculo ganado o perdido: incluye agua, glucógeno y el error del método.</p>`));
  }

  out.push(contornos(ctx.fisica || Evolucion.preparar(M.raw), ctx.fis || {}));
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
    // Charts.barras no trae leyenda: los colores se explican debajo.
    const svg = datos.length ? Charts.barras({ datos, w: 960, h: 220 }) +
      `<div class="leyenda">${Charts._ley(COLOR_ESTADO.verde, 'Día verde')}${Charts._ley(COLOR_ESTADO.ambar, 'Día ámbar')}${Charts._ley(COLOR_ESTADO.rojo, 'Día rojo')}</div>`
      : vacio('Sin estado calculado en este periodo.');
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
      { nombre: 'Media de 7 días', color: TL.lima, puntos: media, unidad: 'ms', sinPuntos: true, bajo: { ref: umbral, color: ROJO } },
      { nombre: 'Tu umbral', color: TL.ambar, puntos: umbral, unidad: 'ms', dash: '5 4', sinPuntos: true },
    ], leyendaExtra: media.some((m, i) => m.y < umbral[i].y) ? [{ color: ROJO, texto: 'Media por debajo del umbral' }] : [], w: 960, h: 240 });
    const filas = vfcV.filter(v => v.fecha >= soloDia(desde)).reverse().map(v => { const t = tend.get(v.clave);
      return [F.dia(v.fecha), F.num(v.vfc, 0), t ? F.num(t.media7, 1) : '—', t ? F.num(t.umbral, 1) : '—']; });
    out.push(tarjeta('Variabilidad de la frecuencia cardiaca (VFC)', grafica(svg, 'VFC nocturna, media de 7 días y umbral', tabla(['Noche', 'VFC (ms)', 'Media 7 días', 'Umbral'], filas, { caption: 'VFC' })) +
      ayuda('La media de varias noches se compara con tu propia referencia. Si queda por debajo de forma sostenida, la app lo tiene en cuenta como señal de cansancio. Las noches que descartaste no cuentan.')));
  }
  // --- FC en reposo ---
  const fcV = FCReposo.validas(R);
  if (fcV.length){
    const banda = FCReposo.bandaSerie(R);
    // Los días por encima del límite que regía ese día van en rojo.
    const pts = fcV.filter(v => v.fecha >= soloDia(desde)).map(v => { const b = banda.get(v.clave);
      return { x: v.fecha, y: v.fcReposo, ...(b && v.fcReposo > b.alta ? { c: ROJO } : {}) }; });
    const alta = fcV.filter(v => v.fecha >= soloDia(desde) && banda.get(v.clave)).map(v => ({ x: v.fecha, y: Math.round(banda.get(v.clave).alta * 10) / 10 }));
    const svg = Charts.lineas({ series: [{ nombre: 'FC en reposo', color: TL.azul, puntos: pts, unidad: 'ppm' },
      { nombre: 'Límite alto para ti', color: TL.ambar, puntos: alta, unidad: 'ppm', dash: '5 4', sinPuntos: true }],
      leyendaExtra: pts.some(p => p.c) ? [{ color: ROJO, texto: 'Por encima de tu límite' }] : [], w: 960, h: 220 });
    out.push(tarjeta('Frecuencia cardiaca en reposo', grafica(svg, 'FC en reposo y su límite alto',
      tabla(['Día', 'FC (ppm)', 'Límite alto'], fcV.filter(v => v.fecha >= soloDia(desde)).reverse().map(v => [F.dia(v.fecha), F.num(v.fcReposo, 0), banda.get(v.clave) ? F.num(banda.get(v.clave).alta, 1) : '—']), { caption: 'FC en reposo' }))));
  }
  // --- reloj: sueño y pasos ---
  const S = M.datos.salud.filter(d => d.fecha >= soloDia(desde) && d.fecha <= M.ref);
  if (S.length && Salud.hay(S)){
    const sueno = S.filter(d => d.sueno && d.sueno.total).map(d => ({ x: d.fecha, y: Math.round(d.sueno.total / 6) / 10 }));
    const pasos = S.filter(d => d.pasos != null).map(d => ({ x: d.fecha, y: d.pasos }));
    // La media se calcula con todo el historial, para que los primeros días
    // del periodo ya tengan su semana completa detrás.
    const media7 = mediaPasos7(M.datos.salud.filter(d => d.fecha <= M.ref));
    const mediaPts = pasos.filter(p => media7.has(+soloDia(p.x))).map(p => ({ x: p.x, y: Math.round(media7.get(+soloDia(p.x))) }));
    const svgSueno = sueno.length ? Charts.lineas({ series: [{ nombre: 'Horas dormidas', color: TL.azul, puntos: sueno, unidad: 'h' }], w: 960, h: 220 }) : '';
    const svgPasos = pasos.length ? Charts.lineas({ series: [
      { nombre: 'Pasos', color: TL.lima, puntos: pasos, unidad: 'pasos', barras: true },
      ...(mediaPts.length ? [{ nombre: 'Media de 7 días', color: TL.txt, puntos: mediaPts, unidad: 'pasos', sinPuntos: true }] : []),
    ], w: 960, h: 240 }) : '';
    const filas = S.slice().reverse().map(d => { const m = media7.get(+soloDia(d.fecha));
      return [F.dia(d.fecha), d.sueno && d.sueno.total ? Salud.fmtHm(d.sueno.total) : '—',
        d.sueno && d.sueno.reparadorPct != null ? `${Math.round(d.sueno.reparadorPct * 100)} %` : '—',
        d.pasos != null ? d.pasos.toLocaleString('es-ES') : '—', d.pasos != null && m != null ? Math.round(m).toLocaleString('es-ES') : '—',
        d.fcReposo != null ? F.num(d.fcReposo, 0) : '—']; });
    const tablaReloj = tabla(['Día', 'Sueño', 'Sueño profundo y REM', 'Pasos', 'Pasos, media 7 días', 'FC reposo'], filas, { caption: 'Datos del reloj por día' });
    out.push(tarjeta('Datos del reloj', (svgSueno ? grafica(svgSueno, 'Horas dormidas por noche', svgPasos ? '' : tablaReloj) : '') +
      (svgPasos ? grafica(svgPasos, 'Pasos por día y su media de 7 días', tablaReloj) : '') +
      (!svgSueno && !svgPasos ? tablaReloj : '') +
      '<p class="muted" style="font-size:12.5px">Un día sin dato del reloj es un hueco, no un cero. La media de pasos cuenta solo los días con dato de la última semana (al menos 3).</p>'));
  }
  if (out.length === 1) out.push(tarjeta('Recuperación', vacio('Tu copia no trae datos de recuperación.')));
  return out.join('');
}
const COLOR_ESTADO = { verde: TL.lima, ambar: TL.ambar, rojo: '#F04438' };
// Rojo de aviso de las gráficas de recuperación, por variable para el papel.
const ROJO = 'var(--rojo-vivo, #F04438)';

/* Media de pasos de los 7 días naturales que acaban en cada fecha (clave:
   +soloDia). Los días sin dato quedan fuera, no cuentan como cero; con menos
   de 3 días con dato en la ventana no hay media, como en la VFC. */
function mediaPasos7(salud){
  const v = salud.filter(d => d.pasos != null).sort((a, b) => a.fecha - b.fecha);
  const out = new Map();
  let lo = 0, suma = 0;
  v.forEach((d, i) => {
    suma += d.pasos;
    const ini = new Date(d.fecha.getFullYear(), d.fecha.getMonth(), d.fecha.getDate() - 6);
    while (v[lo].fecha < ini){ suma -= v[lo].pasos; lo++; }
    if (i - lo + 1 >= 3) out.set(+soloDia(d.fecha), suma / (i - lo + 1));
  });
  return out;
}

// ---------------------------------------------------------------
// MI RUTINA
// ---------------------------------------------------------------
function rutina(M, { sinCabecera = false } = {}){
  const out = [sinCabecera ? '' : '<div class="cabecera-seccion"><h1>Mi rutina</h1></div>'];
  const lineas = M.planMod;
  if (!lineas.length){
    out.push(tarjeta('Rutina', `<p>Tu copia no incluye una rutina personalizada. Si usas una de las rutinas prefijadas de la app, consúltala en el móvil.</p>`));
    return out.join('');
  }
  const aviso = M.planConocido
    ? `<p class="muted" style="font-size:13px">Rutina guardada en tu copia: ${esc(M.raw.sistema === 'simple' ? 'progresión simple' : 'progresión doble')}, ${esc(M.raw.dias || '—')} días por semana${Motor.enCasa(M.raw) ? ' en casa' : ''}. Es de consulta: para preparar cambios crea un borrador.</p>`
    : `<div class="alerta ambar"><span class="tag">Revisar</span><span>Esta rutina personalizada está guardada en tu copia, pero es de otra combinación de días, sistema o lugar de entrenamiento que la que tienes ahora en la app, así que puede no ser la que usas.</span></div>`;
  const dias = [...new Set(lineas.map(l => l.dia))];
  const bloques = dias.map(d => {
    const ls = lineas.filter(l => l.dia === d).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const filas = ls.map(l => {
      const mod = [];
      if (l.topBack) mod.push(`Top + back-off${typeof l.backoffPct === 'number' ? ` (−${l.backoffPct} %)` : ''}`);
      if (l.dropSet) mod.push(`Drop set${typeof l.dropPct === 'number' ? ` (−${l.dropPct} %)` : ''}`);
      if (l.restPause) mod.push('Rest-pause');
      if (l.superConAnterior) mod.push('Superserie con el anterior');
      return [DibujosEsc.celda(l.ejercicio, esc(l.ejercicio)), esc(l.grupo || '—'), esc(String(l.series ?? '—')), esc(String(l.reps ?? '—')), esc(String(l.rir ?? '—')),
        typeof l.descansoMin === 'number' ? `${F.num(l.descansoMin, 1)} min` : '—', esc(mod.join(' · '))];
    });
    // Sin modalidades especiales en el día, la columna solo ocuparía sitio.
    const conMod = filas.some(f => f[6]);
    const cab = ['Ejercicio', 'Grupo', 'Series', 'Reps', 'RIR', 'Descanso', 'Modalidad'];
    return tarjeta(d, tabla(conMod ? cab : cab.slice(0, 6), conMod ? filas : filas.map(f => f.slice(0, 6)), { caption: `Ejercicios de ${d}` }));
  });
  const vp = Analisis.volumenPlan(M, lineas);
  const filasVol = Motor.GRUPOS_VOLUMEN.filter(g => vp.series.get(g)).map(g => [esc(g), F.num(vp.series.get(g), 1), String(vp.dias.get(g) || 0)]);
  out.push(aviso, `<div class="grid rutina-dias">${bloques.join('')}</div>`,
    tarjeta('Series planificadas por semana', tabla(['Grupo', 'Series', 'Días'], filasVol, { caption: 'Series planificadas por grupo' }) +
      ayuda('Mismo reparto que la pestaña de volumen de la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja. «Días» son los días de la semana en que el grupo recibe alguna serie completa.')));
  return out.join('');
}

return { resumen, entrenamiento, detalleSesionHtml, fisica, contornos, recuperacion, rutina, estadoTexto, F, SITIOS, tabla };
})();
