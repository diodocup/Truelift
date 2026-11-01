'use strict';
/* ================================================================
   TrueLift Escritorio — nutricion-vista.js
   HTML de la sección «Nutrición»: tu pauta, evolución, plan de temporada
   e historial. Solo consulta: no hay ningún control que cambie datos; los
   mandos (posición de las imágenes, superponer, reproducir) solo cambian
   lo que se ve. El cálculo vive en nutricion-esc.js. Todo texto importado
   pasa por esc().
   ================================================================ */

const NutricionVista = (() => {

const NE = NutricionEsc;
const F = () => VistasEsc.F;
const tarjeta = (titulo, cuerpo, extra = '', clase = '') => `<section class="card${clase ? ` ${clase}` : ''}"${extra}><h2>${esc(titulo)}</h2>${cuerpo}</section>`;
const vacio = msg => `<p class="muted">${msg}</p>`;
const cifra = (valor, etiqueta) => `<div class="cifra"><b>${esc(valor)}</b><span>${esc(etiqueta)}</span></div>`;
const chip = (clase, texto, titulo = '') => `<span class="chip ${clase}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`;
const ayuda = txt => `<details class="detalle ayuda"><summary>Cómo leer esto</summary><p class="muted">${txt}</p></details>`;
const ir = (destino, texto) => `<button type="button" class="btn sec btn-enlace" data-ir="${esc(destino)}">${esc(texto)}</button>`;
const tabla = (...a) => VistasEsc.tabla(...a);
const MORADO = 'var(--morado, #A78BFA)';
const AZUL = 'var(--azul, #6FA8DC)';

const SUBS = [['pauta', 'Tu pauta'], ['evolucion', 'Evolución'], ['temporada', 'Temporada'], ['historial', 'Historial']];
function subnav(actual){
  return `<nav class="subnav" aria-label="Apartados">${SUBS.map(([k, t]) =>
    `<button type="button" data-ir="nutricion:${k}" ${k === actual ? 'aria-current="true" class="activa"' : ''}>${t}</button>`).join('')}</nav>`;
}

/* «DÉFICIT · SEMANA 4 DE 16», como la cabecera de la app. */
function titularFase(X){
  if (!X.fase) return 'Sin fase abierta';
  const tipo = (NE.FASE[X.fase.tipo] || X.fase.tipo).toUpperCase();
  if (X.semana == null) return tipo;
  return `${tipo} · SEMANA ${X.semana}${X.semanas != null && X.semanas >= X.semana ? ` DE ${X.semanas}` : ''}`;
}

function html(M, st, X){
  const out = [`<div class="cabecera-seccion"><h1>Nutrición</h1>`];
  if (!X.presente){
    out.push('</div>', tarjeta('Nutrición', vacio('Tu copia no trae la nutrición de la app. Si la usas, exporta una copia nueva desde el móvil e impórtala.')));
    return out.join('');
  }
  out.push(`<p class="nut-fase">${esc(titularFase(X))}</p>
    <p class="muted">Lo que la app guarda de tu nutrición hasta el ${F().dia(X.ref)}. Es de consulta: tu pauta y tu plan se cambian en la app.</p></div>`);
  if (!X.activo) out.push('<div class="alerta ambar"><span class="tag">Desactivada</span><span>La nutrición está desactivada en tu app. Se muestra lo que quedó guardado.</span></div>');
  const sub = SUBS.some(s => s[0] === st.sub) ? st.sub : 'pauta';
  out.push(subnav(sub));
  if (sub === 'evolucion') out.push(evolucion(M, X));
  else if (sub === 'temporada') out.push(temporada(M, X, st));
  else if (sub === 'historial') out.push(historial(M, X));
  else out.push(pauta(M, X));
  return out.join('');
}

// ---------------------------------------------------------------
// Tu pauta
// ---------------------------------------------------------------
function pauta(M, X){
  const out = [];
  const f = X.fase;
  if (!f){
    out.push(tarjeta('Tu pauta', vacio('No tienes una fase de nutrición abierta en la app.')));
    return out.join('');
  }
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${v}</b></div>`;
  const filas = [];
  let principal;
  if (X.modalidad === 'CALORIES' && X.kcal != null){
    principal = `<p class="nut-kcal mono">${NE.miles(X.kcal)} <span>kcal/día</span></p>
      <p class="muted">${X.personalizada && X.kcalRecomendadas != null ? `Tu objetivo, personalizado en la app (lo recomendado era ${NE.miles(X.kcalRecomendadas)} kcal/día).` : 'Tu objetivo diario: la cifra que recomienda la app para tu fase.'}</p>`;
  } else if (X.modalidad === 'HABITUAL'){
    principal = `<p class="nut-modo">Ajustas tu alimentación habitual, sin contar calorías.</p>
      <p>${X.ultimoCambio ? esc(`Último cambio en tu pauta, desde el ${F().dia(X.ultimoCambio.desde)}: ${X.ultimoCambio.texto}.`) : 'Sin cambio en lo que comes: sigue comiendo como hasta ahora.'}</p>`;
  } else {
    principal = '<p>Aún no has elegido en la app cómo seguir tu pauta: ajustando tu alimentación habitual o con un objetivo de calorías.</p>';
  }
  if (X.pasosAcordados > 0) filas.push(kv('Pasos extra acordados', `${NE.miles(X.pasosAcordados)} al día`));
  filas.push(kv('Cómo sigues la pauta', esc(NE.MODALIDAD[X.modalidad] || X.modalidad)));
  filas.push(kv('Fase', `${esc(NE.FASE[f.tipo] || f.tipo)}${f.inicio ? ` <span class="muted">· desde el ${F().dia(f.inicio)}</span>` : ''}`));
  if (f.tipo !== 'MAINTENANCE') filas.push(kv('Ritmo objetivo', `${F().signo(f.tasaObjetivoPctSemana, 2)} del peso por semana`));
  if (f.pesoObjetivoKg > 0) filas.push(kv('Peso objetivo', F().kg(f.pesoObjetivoKg)));
  if (X.proteinaGDia) filas.push(kv('Proteína al día', `${NE.miles(X.proteinaGDia)} g${f.porcionesProteinaDia ? ` <span class="muted">· en ${F().plural(f.porcionesProteinaDia, 'ración', 'raciones')}</span>` : ''}`));
  out.push(tarjeta('Tu pauta', `${principal}<div class="nut-kv">${filas.join('')}</div>
    <p class="muted" style="font-size:12.5px">Tu pauta cambia cuando aceptas una revisión semanal en la app o cambias tu fase; aquí solo se consulta.</p>`, ' id="nutPauta"'));

  const R = X.reparto;
  if (R){
    const fr = R.fraccion;
    const barra = `<div class="nut-macros-barra" role="img" aria-label="Reparto de las calorías: proteína ${Math.round(fr.proteina * 100)} %, hidratos ${Math.round(fr.hidratos * 100)} %, grasa ${Math.round(fr.grasa * 100)} %">
      <i class="m-prot" style="width:${(fr.proteina * 100).toFixed(1)}%"></i><i class="m-hid" style="width:${(fr.hidratos * 100).toFixed(1)}%"></i><i class="m-gra" style="width:${(fr.grasa * 100).toFixed(1)}%"></i></div>`;
    const cifras = `<div class="cifras">${cifra(`${R.proteinaG} g`, 'proteína')}${cifra(`${R.hidratosG} g`, 'hidratos')}${cifra(`${R.grasaG} g`, 'grasa')}</div>`;
    const momento = { antes: 'Antes de entrenar', despues: 'Después de entrenar' };
    const filasC = R.comidas.map(c => [esc(c.nombre), `${c.porcentaje} %`, `${NE.miles(c.kcal)} kcal`, `${c.proteinaG} g`, `${c.hidratosG} g`, `${c.grasaG} g`, c.momento ? chip('azul', momento[c.momento]) : '']);
    const conMomento = R.comidas.some(c => c.momento);
    const cab = ['Comida', 'Del día', 'Kcal', 'Proteína', 'Hidratos', 'Grasa', 'Entreno'];
    out.push(tarjeta('Macros y comidas', `${cifras}${barra}
      <p class="nut-leyenda"><span><i class="m-prot"></i>Proteína</span><span><i class="m-hid"></i>Hidratos</span><span><i class="m-gra"></i>Grasa</span></p>
      ${tabla(conMomento ? cab : cab.slice(0, 6), conMomento ? filasC : filasC.map(x => x.slice(0, 6)), { caption: 'Reparto de tu día en comidas' })}
      ${R.hidratosJustos ? '<div class="alerta ambar"><span class="tag">Revisar</span><span>Con tus calorías, los hidratos quedan por debajo de lo recomendable. La app te lo explica en tu pauta.</span></div>' : ''}
      ${ayuda('Es el reparto de tu objetivo diario que propone la app: la proteína y la grasa que elegiste y, los hidratos, lo que queda, así que la suma cuadra con tus calorías. Son las mismas calorías todos los días, entrenes o no. El número de comidas y su tamaño se eligen en la app.')}`, ' id="nutMacros"'));
  } else if (X.modalidad === 'HABITUAL'){
    out.push(tarjeta('Macros y comidas', vacio('Sigues tu alimentación habitual sin contar calorías, así que la app no reparte un objetivo en macros ni en comidas.')));
  }

  const N = M.datos.nut;
  if (N && N.progreso){
    out.push(tarjeta('Cómo vas', `${VistasEsc.progresoFase(N)}<div class="fila-botones">${ir('nutricion:evolucion', 'Ver la evolución')}</div>`));
  }
  if (X.plan) out.push(tarjeta('Tu temporada', `<p>${esc(resumenTemporada(X))}</p><div class="fila-botones">${ir('nutricion:temporada', 'Ver el plan de temporada')}</div>`));
  return out.join('');
}

function resumenTemporada(X){
  const P = X.plan, ahora = P.filas.find(f => f.estado === 'enCurso');
  const quedan = P.filas.filter(f => f.estado === 'proxima').length;
  const fin = P.bloques[P.bloques.length - 1].fin;
  return `${ahora ? `Ahora: ${ahora.nombre}.` : 'Ninguna etapa en curso.'} ${quedan ? `${F().plural(quedan, 'etapa', 'etapas')} por delante; ` : ''}el plan termina el ${F().dia(fin)}.`;
}

// ---------------------------------------------------------------
// Evolución: tendencia, objetivo y plan inicial de la fase
// ---------------------------------------------------------------
function evolucion(M, X){
  const out = [];
  const N = M.datos.nut;
  if (!N || !N.pesajes.length) return tarjeta('Evolución', vacio('Tu copia no trae pesajes.'));
  const f = X.fase;
  const p = N.progreso;
  out.push(tarjeta('Cómo vas', p ? VistasEsc.progresoFase(N) : vacio(f ? 'Aún no hay datos suficientes para leer la fase.' : 'No tienes una fase de nutrición abierta en la app.')));

  // Gráfica de la fase: desde su inicio hasta su fin previsto (o tu último pesaje).
  const desde = f && f.inicio ? f.inicio : N.pesajes[0].fecha;
  const finPrev = p && p.fin ? p.fin : null;
  const hasta = finPrev && finPrev > X.ref ? finPrev : X.ref;
  const dentro = d => d >= desde && d <= hasta;
  const pts = N.pesajes.filter(x => dentro(x.fecha)).map(x => ({ x: x.fecha, y: x.pesoKg }));
  const tend = N.serie.vacia ? [] : N.serie.puntos.filter(x => dentro(x.fecha)).map(x => ({ x: x.fecha, y: Math.round(x.tendenciaKg * 100) / 100 }));
  const series = [
    { nombre: 'Pesajes', color: TL.txt3, puntos: pts, soloPuntos: true, unidad: 'kg' },
    { nombre: 'Peso tendencia', color: TL.lima, puntos: tend, unidad: 'kg', sinPuntos: true },
  ];
  if (f && p && p.compromiso && p.compromiso.pesoInicioKg > 0){
    const c = p.compromiso;
    const tramos = ProgresoFase.tramos(N.nut, f);
    const obj = ProgresoFase.trayectoria({ inicio: f.inicio, fin: hasta, pesoInicialKg: c.pesoInicioKg, tramos });
    const hoyIdx = obj.findIndex(x => +x.fecha >= +X.ref);
    const objPts = obj.map(x => ({ x: x.fecha, y: Math.round(x.pesoObjetivoKg * 100) / 100 }));
    const corte = hoyIdx < 0 ? objPts.length : hoyIdx + 1;
    series.push({ nombre: 'Tu objetivo', color: AZUL, puntos: objPts.slice(0, corte), unidad: 'kg', sinPuntos: true });
    if (corte < objPts.length) series.push({ nombre: 'Tu objetivo (pronóstico)', color: AZUL, puntos: objPts.slice(corte - 1), unidad: 'kg', sinPuntos: true, dash: '5 4' });
    // El plan inicial llega hasta el fin con el que empezó la fase.
    const ini = ProgresoFase.trayectoria({ inicio: f.inicio, fin: c.fin || hasta, pesoInicialKg: c.pesoInicioKg,
      tramos: [{ desde: f.inicio, tasaPctSemana: c.tasaPctSemana }] });
    // El plan inicial va encima del objetivo: donde coinciden, se ve el inicial.
    series.push({ nombre: 'Plan inicial', color: MORADO, puntos: ini.map(x => ({ x: x.fecha, y: Math.round(x.pesoObjetivoKg * 100) / 100 })), unidad: 'kg', sinPuntos: true });
  }
  const svg = Charts.lineas({ series, marcas: [{ x: X.ref, color: TL.txt3, label: 'Tu último registro', tipo: 'último registro' }], w: 960, h: 300 });
  out.push(tarjeta(f ? 'Tu peso en la fase' : 'Tu peso', `${VistasEsc.grafica(svg, 'Pesajes, peso tendencia, tu objetivo y el plan inicial de la fase', '')}
    ${ayuda('La línea lima es tu peso tendencia, la que calcula la app para suavizar las subidas y bajadas diarias. La azul es tu objetivo: dónde deberías estar con el ritmo de tu pauta, contando los cambios que aceptaste; a trazos, por dónde seguiría. La morada es el plan con el que empezaste la fase, sin esos cambios.')}`));

  // Fases anteriores.
  const cerradas = (N.nut.fasesCerradas || []).slice().reverse();
  if (cerradas.length){
    out.push(tarjeta('Fases anteriores', tabla(['Fase', 'Desde', 'Hasta', 'Ritmo objetivo', 'Peso objetivo'],
      cerradas.map(c => [esc(NE.FASE[c.tipo] || c.tipo), F().dia(c.inicio), F().dia(c.fin), c.tipo === 'MAINTENANCE' ? '—' : `${F().signo(c.tasaObjetivoPctSemana, 2)} / semana`, c.pesoObjetivoKg > 0 ? F().kg(c.pesoObjetivoKg) : '—']),
      { caption: 'Fases de nutrición cerradas' })));
  }
  out.push(`<div class="fila-botones">${ir('fisica', 'Ver pesajes y composición en Evolución física')}</div>`);
  return out.join('');
}

// ---------------------------------------------------------------
// Temporada
// ---------------------------------------------------------------
const ESTADO_ETAPA = { terminada: ['gris', 'Terminada'], enCurso: ['verde', 'En curso'], proxima: ['azul', 'Próxima'] };

/* Posiciones (en semanas desde el inicio del plan) de las dos imágenes. */
function posiciones(P, st){
  const c = P.curva, total = c.puntos.length - 1;
  const maxSem = Math.ceil(total / 7);
  const semHoy = NE.entre(c.desde, P.ref) <= 0 ? 0 : Math.min(maxSem, Math.round(NE.entre(c.desde, P.ref) / 7));
  const izq = Math.max(0, Math.min(maxSem, st.izq ?? semHoy));
  const der = Math.max(izq, Math.min(maxSem, st.der ?? maxSem));
  const fechaDe = s => s >= maxSem ? c.hasta : NE.mas(c.desde, s * 7);
  // La imagen de hoy es la de partida de la proyección.
  return { maxSem, izq, der, fechaIzq: st.izq == null ? P.ref : fechaDe(izq), fechaDer: fechaDe(der) };
}

function temporada(M, X, st){
  const P = X.plan;
  if (!P) return tarjeta('Plan de temporada', vacio('No tienes un plan de temporada en la app. Se prepara en la app: Nutrición → Temporada.'));
  P.ref = X.ref;
  const out = [];
  const pr = P.proyeccion;
  const ult = pr && pr.bloques.length ? pr.bloques[pr.bloques.length - 1] : null;
  const fin = P.bloques[P.bloques.length - 1].fin;
  const semanas = P.bloques.reduce((a, b) => a + b.semanas, 0);
  if (pr){
    out.push(`<section class="card nut-temporada-cab"><div class="cifras">
      ${cifra(F().kg(pr.pesoPartidaKg), `hoy · ${F().num(pr.grasaPartidaPct, 1)} % graso`)}
      ${ult ? cifra(F().kg(ult.pesoFinKg), `al final · ${F().num(ult.grasaFinPct, 1)} % graso`) : ''}
      ${cifra(F().num(semanas, 0), `semanas · hasta el ${F().corta(fin)}`)}
    </div><p class="muted" style="font-size:12.5px">Es una proyección de la app desde tu último pesaje con los ritmos del plan: una guía, no una promesa.</p></section>`);
  } else {
    out.push('<div class="alerta ambar"><span class="tag">Sin proyección</span><span>Para proyectar el plan hace falta tu peso y una medición de % graso. Se ven las etapas, sin cifras finales.</span></div>');
  }

  // Gráficas: peso total y, debajo, masa magra y masa grasa.
  const c = P.curva;
  if (c){
    const marcas = [{ x: X.ref, color: TL.txt, label: 'Hoy', tipo: 'hoy' },
      ...P.bloques.slice(1).map((b, i) => ({ x: b.inicio, color: TL.txt4, label: `Empieza ${P.nombres[i + 1]}`, tipo: 'cambio de etapa' }))];
    const pasado = c.puntos.filter(x => !x.futuro), futuro = c.puntos.filter(x => x.futuro);
    const serie = (pts, k) => pts.map(x => ({ x: x.fecha, y: Math.round(x[k] * 100) / 100 }));
    const peso = Charts.lineas({ series: [
      { nombre: 'Peso (vivido)', color: TL.lima, puntos: serie(pasado, 'pesoKg'), unidad: 'kg', sinPuntos: true },
      { nombre: 'Peso (proyección)', color: TL.lima, puntos: serie(futuro, 'pesoKg'), unidad: 'kg', sinPuntos: true, dash: '5 4' },
    ], marcas, w: 960, h: 240 });
    const masas = Charts.lineas({ series: [
      { nombre: 'Masa magra', color: AZUL, puntos: serie(c.puntos, 'magraKg'), unidad: 'kg', sinPuntos: true },
      { nombre: 'Masa grasa', color: TL.ambar, puntos: serie(c.puntos, 'grasaKg'), unidad: 'kg', sinPuntos: true, eje: 'der' },
    ], marcas, w: 960, h: 220 });
    out.push(tarjeta('Tu temporada', `${VistasEsc.grafica(peso, 'Peso a lo largo del plan: lo vivido y la proyección', '')}
      ${VistasEsc.grafica(masas, 'Masa magra (eje izquierdo) y masa grasa (eje derecho) a lo largo del plan', '')}
      ${ayuda('Hasta hoy, la línea es tu peso tendencia y tu % graso estimado; desde hoy, la proyección del plan con el ritmo de cada etapa. Las rayas verticales marcan hoy y el comienzo de cada etapa. Son estimaciones: el reparto entre masa magra y grasa depende de tu entrenamiento, tu descanso y tu punto de partida.')}`, ' id="nutGraficaPlan"'));
  }

  // Etapas.
  const filas = P.filas.map(fl => {
    const b = fl.bloque, p = fl.proyeccion;
    const [cl, txt] = ESTADO_ETAPA[fl.estado];
    return [`<b>${esc(fl.nombre)}</b>`, `${F().corta(b.inicio)} – ${F().dia(b.fin)}`, F().num(b.semanas, b.semanas % 1 ? 1 : 0),
      b.tipo === 'BRIDGE' ? '—' : `${F().signo(b.tasaPctSemana, 2)} / semana`,
      p ? `${F().kg(p.pesoFinKg)} · ${F().num(p.grasaFinPct, 1)} %` : fl.estado === 'terminada' ? '<span class="muted">vivida</span>' : '—',
      chip(cl, txt)];
  });
  out.push(tarjeta('Etapas', tabla(['Etapa', 'Fechas', 'Semanas', 'Ritmo', 'Final', 'Estado'], filas, { caption: 'Etapas del plan de temporada' }) +
    `${P.replanificado ? `<p class="muted" style="font-size:12.5px">Replanificado el ${F().dia(P.replanificado)}.</p>` : ''}` +
    ayuda('«Final» es el peso y el % graso con los que acabarías cada etapa si sigues su ritmo. Las etapas terminadas ya son historia: su resultado está en tu tendencia, no en una proyección.')));

  // Imágenes.
  out.push(imagenes(X, st));
  return out.join('');
}

function imagenes(X, st){
  const P = X.plan, I = P.imagenes;
  const titulo = 'Cómo cambiaría tu cuerpo';
  if (I.motivo === 'faltanDatos') return tarjeta(titulo, vacio('Añade tu altura y tu sexo en la app (Ajustes → Mis datos) para ver cómo cambiaría tu cuerpo.'));
  if (I.motivo === 'fueraDeRango') return tarjeta(titulo, vacio('Este plan lleva a un punto que las ilustraciones no pueden representar.'));
  if (I.motivo) return '';
  const pos = posiciones(P, st);
  const c = P.curva;
  const fin = c.hasta, inicio = c.desde;
  const punto = d => NE.puntoEn(c, d);
  const img = d => {
    const p = punto(d);
    const r = NE.rutaCelda(I.mujer, NE.celda({ mujer: I.mujer, alturaCm: I.alturaCm, pesoKg: p.pesoKg, grasaPct: p.grasaPct }));
    return { p, r };
  };
  const a = img(pos.fechaIzq), b = img(pos.fechaDer);
  const rot = d => NE.rotuloFecha(d, { hoy: X.ref, inicio, fin });
  const fig = (x, d, lado) => `<figure class="nut-cuerpo">${x.r ? `<img src="${esc(x.r)}" alt="Ilustración orientativa del cuerpo: ${esc(rot(d))}, ${esc(F().kg(x.p.pesoKg))} y ${esc(F().num(x.p.grasaPct, 1))} % graso" loading="lazy">` : '<div class="nut-cuerpo-vacio">Fuera de lo que las ilustraciones representan</div>'}
    <figcaption><b>${esc(rot(d))}</b> · ${F().dia(d)}<br><span class="mono">${esc(F().kg(x.p.pesoKg))} · ${esc(F().num(x.p.grasaPct, 1))} %</span></figcaption></figure>`;
  const modo = st.modo === 'superponer' ? 'superponer' : 'lado';
  const deslizador = (id, valor, min, etiqueta) => `<label class="nut-desl" for="${id}"><span>${etiqueta}</span>
    <input type="range" id="${id}" min="${min}" max="${pos.maxSem}" step="1" value="${valor}" aria-valuetext="${esc(rot(id === 'nutImgIzq' ? pos.fechaIzq : pos.fechaDer))}"></label>`;
  const vista = modo === 'superponer'
    ? `<div class="nut-superponer" style="--opacidad:${(st.opacidad ?? 50) / 100}">
        <div class="nut-capa">${a.r ? `<img src="${esc(a.r)}" alt="">` : ''}</div><div class="nut-capa encima">${b.r ? `<img src="${esc(b.r)}" alt="">` : ''}</div></div>
       <p class="nut-superponer-pie"><span>${esc(rot(pos.fechaIzq))} · ${F().corta(pos.fechaIzq)}</span><span>${esc(rot(pos.fechaDer))} · ${F().corta(pos.fechaDer)}</span></p>
       <label class="nut-desl" for="nutOpacidad"><span>Transparencia</span><input type="range" id="nutOpacidad" min="0" max="100" step="1" value="${st.opacidad ?? 50}"></label>
       <div class="fila-botones"><button type="button" class="btn pri" data-accion="nut-reproducir">▶ Reproducir</button></div>`
    : `<div class="nut-cuerpos">${fig(a, pos.fechaIzq, 'izq')}${fig(b, pos.fechaDer, 'der')}</div>`;
  return tarjeta(titulo, `<div class="fila-botones nut-modo-btns" role="group" aria-label="Cómo ver las imágenes">
      <button type="button" class="btn ${modo === 'lado' ? 'pri' : 'sec'}" data-nut-modo="lado" aria-pressed="${modo === 'lado'}">Lado a lado</button>
      <button type="button" class="btn ${modo === 'superponer' ? 'pri' : 'sec'}" data-nut-modo="superponer" aria-pressed="${modo === 'superponer'}">Superponer</button></div>
    ${vista}
    <div class="nut-desls">${deslizador('nutImgIzq', pos.izq, 0, 'Imagen de partida')}${deslizador('nutImgDer', pos.der, 0, 'Imagen final')}</div>
    <p class="muted" style="font-size:12.5px">Ilustración orientativa: cada cuerpo responde a su manera.</p>`, ' id="nutImagenes"');
}

/* Contenido del diálogo de reproducción. */
function reproductor(){
  return `<div class="nut-repro">
    <h2 id="modalTitulo" class="nut-repro-etapa">&nbsp;</h2>
    <p class="nut-repro-rotulo mono">&nbsp;</p>
    <div class="nut-repro-lienzo"><img class="base" alt=""><img class="encima" alt=""></div>
    <div class="nut-repro-avance" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <div class="mod-acciones"><button class="btn sec" type="button" data-accion="nut-repro-pausa">Pausar</button>
      <button class="btn pri" type="button" data-accion="cerrar" autofocus>Cerrar</button></div></div>`;
}

// ---------------------------------------------------------------
// Historial
// ---------------------------------------------------------------
function historial(M, X){
  const out = [];
  if (X.historial.length){
    let anterior = null;
    const filas = X.historial.slice().reverse().map(v => {
      const pasos = v.pasosAcordadosDia > 0 && (!anterior || anterior.pasosAcordadosDia !== v.pasosAcordadosDia) ? `${NE.miles(v.pasosAcordadosDia)} al día` : '';
      anterior = v;
      return [F().dia(v.desde), esc(NE.EVENTO[v.evento] || 'Cambio en tu pauta'), esc(NE.MODALIDAD[v.modalidad] || v.modalidad), esc(NE.resultadoVersion(v)), pasos];
    }).reverse();
    out.push(tarjeta('Historial de tu pauta', tabla(['Desde', 'Qué pasó', 'Cómo la sigues', 'Tu pauta', 'Pasos extra'], filas, { caption: 'Versiones de la pauta' })));
  }
  const recs = (M.datos.nut?.nut?.recomendaciones || []).slice().reverse();
  if (recs.length){
    const ajuste = r => r.ajusteKcalDia == null || r.ajusteKcalDia === 0 ? '—' : `${r.ajusteKcalDia > 0 ? '+' : '−'}${NE.miles(Math.abs(r.ajusteKcalDia))} kcal/día`;
    out.push(tarjeta('Revisiones semanales', tabla(['Fecha', 'Propuesta', 'Qué pasó', 'Ajuste propuesto', 'Ritmo real'],
      recs.map(r => [F().dia(r.fecha), esc(VistasEsc.TIPO_REC[r.tipo] || r.tipo), r.estadoPropuesta ? esc(VistasEsc.ESTADO_REC[r.estadoPropuesta] || r.estadoPropuesta) : '—', ajuste(r),
        r.tasaRealPctSemana != null ? `${F().signo(r.tasaRealPctSemana, 2)} / semana` : '—']), { caption: 'Revisiones semanales de la app' }) +
      ayuda('Son las revisiones que la app te propuso cada semana. Solo cambian tu pauta las que aceptaste; las pospuestas, sustituidas o sin decidir no la cambiaron.')));
  }
  if (!out.length) out.push(tarjeta('Historial', vacio('Tu copia aún no trae cambios de pauta ni revisiones semanales.')));
  return out.join('');
}

return { html, reproductor, posiciones };
})();
