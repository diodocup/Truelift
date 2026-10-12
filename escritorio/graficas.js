'use strict';
/* ================================================================
   TrueLift Escritorio — graficas.js
   Gráficas propias del rediseño (fase 9): la línea de tiempo de Mi
   resumen y las mini gráficas de sus cifras clave. Solo SVG en texto,
   sin DOM: reciben datos ya calculados y devuelven HTML.

   Reglas de la casa (las mismas que charts.js): retícula solo
   horizontal, sin relleno bajo las curvas, cifras en mono y colores por
   variable CSS para que el papel los cambie al imprimir. Todo color de
   estado va acompañado de altura, posición o texto, para no depender
   solo del color.
   ================================================================ */

const GraficasEsc = (() => {

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = d => `${d.getDate()} ${MES[d.getMonth()]}`;
const n1 = v => fmtNum(v, 1);
const signo = (v, dec = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v), dec)} %`;
const dia = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
const tt = s => esc(s).replace(/"/g, '&quot;');

const COLOR = {
  lima: 'var(--lima)', naranja: 'var(--naranja)', ambar: 'var(--ambar)', rojo: 'var(--rojo-vivo, #F04438)',
  azul: 'var(--azul)', txt2: 'var(--txt2)', txt3: 'var(--txt3)', vacio: 'rgba(255,255,255,.07)',
};
const COLOR_ESTADO = { verde: COLOR.lima, ambar: COLOR.ambar, rojo: COLOR.rojo };

// Lienzo común de la línea de tiempo: todas las capas comparten el mismo
// ancho lógico y el mismo eje de fechas, así que quedan alineadas.
const W = 960, X0 = 44, X1 = 950;

function escalaX(desde, dias){
  const paso = (X1 - X0) / Math.max(1, dias - 1);
  return { x: f => X0 + diasEntre(desde, f) * paso, paso };
}

/* Semanas de descarga dentro del periodo, como franjas de lunes a domingo. */
function franjasDescarga(sesiones, desde, hasta){
  const lunes = d => dia(soloDia(d), -((d.getDay() + 6) % 7));
  const vistas = new Set();
  const out = [];
  sesiones.filter(s => s.descarga).forEach(s => {
    const l = lunes(s.fecha);
    if (vistas.has(+l)) return;
    vistas.add(+l);
    const a = l < desde ? desde : l, b = dia(l, 6) > hasta ? hasta : dia(l, 6);
    if (a <= b) out.push({ desde: a, hasta: b });
  });
  return out;
}

function svg(h, cuerpo, etiqueta){
  return `<svg class="lt-svg" viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${tt(etiqueta)}">${cuerpo}</svg>`;
}
const reticula = (y, fuerte = false) => `<line x1="${X0}" x2="${X1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="${fuerte ? 'lt-cero' : 'lt-ret'}"/>`;
const rotuloY = (y, txt) => `<text x="${X0 - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="lt-eje">${esc(txt)}</text>`;

/* ---------------------------------------------------------------
   Línea de tiempo: fases, rendimiento por sesión, peso y entrenos.
   datos: { desde, hasta, sesiones:[{fecha, dia, valor|null, descarga, sinBase}],
            peso:{ tendencia:[{fecha,kg}], pesajes:[{fecha,kg}], objetivo }|null,
            cardio:[Date], fases:[{desde,hasta,tipo,texto}] }
   --------------------------------------------------------------- */
function lineaTiempo(d){
  const dias = diasEntre(d.desde, d.hasta) + 1;
  const { x, paso } = escalaX(d.desde, dias);
  const descargas = franjasDescarga(d.sesiones, d.desde, d.hasta);
  const franjas = h => descargas.map(f => `<rect x="${(x(f.desde) - paso / 2).toFixed(1)}" y="0" width="${((diasEntre(f.desde, f.hasta) + 1) * paso).toFixed(1)}" height="${h}" class="lt-descarga"/>`).join('');
  const inicioFase = d.fases.filter(f => f.desde > d.desde).map(f => x(f.desde));
  const guias = h => inicioFase.map(px => `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="0" y2="${h}" class="lt-guia"/>`).join('');

  // --- fases y descargas ---
  const FASE_CLASE = { DEFICIT: 'deficit', SURPLUS: 'superavit', MAINTENANCE: 'mantenimiento' };
  let cab = d.fases.map(f => {
    const a = x(f.desde) - paso / 2, b = x(f.hasta) + paso / 2, ancho = b - a;
    return `<rect x="${a.toFixed(1)}" y="4" width="${Math.max(0, ancho - 3).toFixed(1)}" height="22" rx="5" class="lt-fase ${FASE_CLASE[f.tipo] || ''}"><title>${esc(f.texto)}: ${corta(f.desde)} – ${corta(f.hasta)}</title></rect>`
      + (ancho > 70 ? `<text x="${(a + 9).toFixed(1)}" y="19.5" class="lt-fase-txt">${esc(f.texto)}</text>` : '');
  }).join('');
  cab += descargas.map(f => {
    const a = x(f.desde) - paso / 2, ancho = (diasEntre(f.desde, f.hasta) + 1) * paso;
    return `<rect x="${(a + 2).toFixed(1)}" y="7" width="${Math.max(0, ancho - 4).toFixed(1)}" height="16" rx="4" class="lt-descarga-chip"/>`
      + (ancho > 54 ? `<text x="${(a + ancho / 2).toFixed(1)}" y="19" text-anchor="middle" class="lt-descarga-txt">Descarga</text>` : '');
  }).join('');
  const capaFases = (d.fases.length || descargas.length)
    ? `<div class="lt-fila lt-fila-fases">${svg(30, cab, d.fases.length
        ? `Fases de nutrición: ${d.fases.map(f => `${f.texto} del ${corta(f.desde)} al ${corta(f.hasta)}`).join('; ')}`
        : 'Semanas de descarga en el periodo')}</div>` : '';

  // --- rendimiento por sesión ---
  let capaRend = '';
  const conValor = d.sesiones.filter(s => s.valor != null && !s.descarga && !s.sinBase);
  if (d.sesiones.length){
    const H = 170, yT = 14, yB = 156;
    const absos = conValor.map(s => Math.abs(s.valor)).sort((a, b) => a - b);
    const p90 = absos.length ? absos[Math.min(absos.length - 1, Math.floor(absos.length * 0.9))] : 0;
    const D = Math.min(20, Math.max(6, Math.ceil(p90 / 2) * 2));
    const Y = v => yT + (D - Math.max(-D, Math.min(D, v))) / (2 * D) * (yB - yT);
    let c = franjas(H) + guias(H);
    [D, D / 2, -D / 2, -D].forEach(v => { c += reticula(Y(v)) + rotuloY(Y(v), `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`); });
    c += reticula(Y(0), true) + rotuloY(Y(0), '0 %');
    // Trazo entre sesiones normales; se corta en las descargas.
    let tramo = [], trazos = [];
    d.sesiones.forEach(s => {
      if (s.descarga){ if (tramo.length > 1) trazos.push(tramo); tramo = []; return; }
      if (s.valor == null || s.sinBase) return;
      tramo.push(`${x(s.fecha).toFixed(1)},${Y(s.valor).toFixed(1)}`);
    });
    if (tramo.length > 1) trazos.push(tramo);
    c += trazos.map(t => `<polyline points="${t.join(' ')}" class="lt-trazo"/>`).join('');
    d.sesiones.forEach(s => {
      const px = x(s.fecha).toFixed(1);
      const base = `${corta(s.fecha)} · ${s.dia}`;
      if (s.descarga){
        c += `<circle cx="${px}" cy="${(yB - 4).toFixed(1)}" r="4.5" class="lt-hueco" data-tt="${tt(`${base} · descarga, no cuenta para el rendimiento`)}"/>`;
        return;
      }
      if (s.sinBase || s.valor == null){
        c += `<circle cx="${px}" cy="${Y(0).toFixed(1)}" r="4.5" class="lt-hueco" data-tt="${tt(`${base} · sin referencia previa`)}"/>`;
        return;
      }
      const fuera = Math.abs(s.valor) > D;
      const col = s.valor >= 0 ? COLOR.lima : COLOR.naranja;
      const msg = `${base} · ${signo(s.valor)} frente a tu nivel`;
      if (fuera){
        const y = s.valor > 0 ? yT - 6 : yB + 6, dir = s.valor > 0 ? -1 : 1;
        c += `<path d="M${(+px - 5).toFixed(1)} ${(y - 4 * dir).toFixed(1)} L${px} ${(y + 4 * dir).toFixed(1)} L${(+px + 5).toFixed(1)} ${(y - 4 * dir).toFixed(1)} Z" style="fill:${col}" data-tt="${tt(msg)}"/>`;
      } else {
        c += `<circle cx="${px}" cy="${Y(s.valor).toFixed(1)}" r="4.5" class="lt-punto" style="fill:${col}" data-tt="${tt(msg)}"/>`;
      }
    });
    const encima = conValor.filter(s => s.valor >= 0).length;
    capaRend = `<div class="lt-fila" data-capa="rend">
      <div class="lt-cab"><span class="lt-nombre">Rendimiento por sesión <span>· frente a tu nivel</span></span>
        <span class="lt-ley"><span><i class="lt-ley-punto" style="background:${COLOR.lima}"></i>Por encima</span><span><i class="lt-ley-punto" style="background:${COLOR.naranja}"></i>Por debajo</span><span><i class="lt-ley-hueco"></i>Sin referencia o descarga</span></span></div>
      ${svg(H + 8, c, conValor.length
        ? `Rendimiento de ${conValor.length} sesiones frente a tu nivel: ${encima} por encima o igual y ${conValor.length - encima} por debajo`
        : 'Sin sesiones con rendimiento medido en el periodo')}</div>`;
  }

  // --- peso ---
  let capaPeso = '';
  if (d.peso && (d.peso.tendencia.length || d.peso.pesajes.length)){
    const H = 130, yT = 14, yB = 112;
    const vals = [...d.peso.tendencia.map(p => p.kg), ...d.peso.pesajes.map(p => p.kg)];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const obj = d.peso.objetivo;
    const objDentro = obj != null && obj >= lo - 1.5 && obj <= hi + 1.5;
    if (objDentro){ lo = Math.min(lo, obj); hi = Math.max(hi, obj); }
    if (hi - lo < 2){ const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const Y = v => yT + (hi - v) / (hi - lo) * (yB - yT);
    let c = franjas(H) + guias(H);
    const pasoY = (hi - lo) > 6 ? 2 : (hi - lo) > 3 ? 1 : 0.5;
    for (let v = Math.ceil(lo / pasoY) * pasoY; v <= hi; v += pasoY) c += reticula(Y(v)) + rotuloY(Y(v), n1(v).replace(/,0$/, ''));
    if (objDentro) c += `<line x1="${X0}" x2="${X1}" y1="${Y(obj).toFixed(1)}" y2="${Y(obj).toFixed(1)}" class="lt-objetivo"/><text x="${X1}" y="${(Y(obj) - 6).toFixed(1)}" text-anchor="end" class="lt-rotulo">objetivo ${esc(n1(obj))}</text>`;
    c += d.peso.pesajes.map(p => `<circle cx="${x(p.fecha).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.5" class="lt-pesaje" data-tt="${tt(`${corta(p.fecha)} · pesaje ${n1(p.kg)} kg`)}"/>`).join('');
    if (d.peso.tendencia.length > 1) c += `<polyline points="${d.peso.tendencia.map(p => `${x(p.fecha).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ')}" class="lt-tendencia"/>`;
    const ult = d.peso.tendencia[d.peso.tendencia.length - 1];
    if (ult){
      c += `<circle cx="${x(ult.fecha).toFixed(1)}" cy="${Y(ult.kg).toFixed(1)}" r="5" class="lt-punto" style="fill:${COLOR.lima}" data-tt="${tt(`${corta(ult.fecha)} · tendencia ${n1(ult.kg)} kg`)}"/>`
        + `<text x="${(x(ult.fecha) - 10).toFixed(1)}" y="${(Y(ult.kg) + (Y(ult.kg) > yB - 20 ? -12 : 20)).toFixed(1)}" text-anchor="end" class="lt-rotulo fuerte">${esc(n1(ult.kg))} kg</text>`;
    }
    const pri = d.peso.tendencia[0];
    const resumen = pri && ult ? `Peso tendencia de ${n1(pri.kg)} kg el ${corta(pri.fecha)} a ${n1(ult.kg)} kg el ${corta(ult.fecha)}` : 'Pesajes del periodo';
    capaPeso = `<div class="lt-fila" data-capa="peso">
      <div class="lt-cab"><span class="lt-nombre">Peso <span>· tendencia y pesajes, kg</span></span>
        <span class="lt-ley"><span><i class="lt-ley-linea"></i>Tendencia</span><span><i class="lt-ley-punto peq" style="background:var(--txt4)"></i>Pesaje</span>${objDentro ? '<span><i class="lt-ley-obj"></i>Objetivo</span>' : ''}</span></div>
      ${svg(H, c, `${resumen}${obj != null ? `. Objetivo de la fase: ${n1(obj)} kg` : ''}`)}</div>`;
  }

  // --- entrenos por día ---
  const ancho = Math.max(2, paso - 2);
  const fuerza = new Map(), cardio = new Set(d.cardio.map(f => +soloDia(f)));
  d.sesiones.forEach(s => { const k = +soloDia(s.fecha); fuerza.set(k, (fuerza.get(k) === 'normal' || !s.descarga) ? 'normal' : 'descarga'); });
  let celdas = '';
  for (let i = 0; i < dias; i++){
    const f = dia(d.desde, i), k = +f;
    const tipo = fuerza.has(k) ? fuerza.get(k) : cardio.has(k) ? 'cardio' : 'descanso';
    const txt = { normal: 'fuerza', descarga: 'fuerza en descarga', cardio: 'cardio', descanso: 'descanso' }[tipo];
    celdas += `<rect x="${(x(f) - ancho / 2).toFixed(1)}" y="6" width="${ancho.toFixed(1)}" height="22" rx="3" class="lt-dia ${tipo}" data-tt="${tt(`${corta(f)} · ${txt}`)}"/>`;
  }
  const nFuerza = d.sesiones.length, nCardio = d.cardio.length;
  const capaEntrenos = `<div class="lt-fila" data-capa="entrenos">
    <div class="lt-cab"><span class="lt-nombre">Entrenos <span>· ${nFuerza} de fuerza${nCardio ? ` y ${nCardio} de cardio` : ''}</span></span>
      <span class="lt-ley"><span><i class="lt-ley-dia normal"></i>Fuerza</span><span><i class="lt-ley-dia descarga"></i>En descarga</span><span><i class="lt-ley-dia cardio"></i>Cardio</span><span><i class="lt-ley-dia descanso"></i>Descanso</span></span></div>
    ${svg(34, celdas, `Entrenos por día del ${corta(d.desde)} al ${corta(d.hasta)}: ${nFuerza} sesiones de fuerza${nCardio ? ` y ${nCardio} de cardio` : ''}`)}</div>`;

  // --- eje de fechas: un rótulo por lunes, aclarando si se amontonan ---
  const lunes = [];
  for (let i = 0; i < dias; i++){ const f = dia(d.desde, i); if (f.getDay() === 1) lunes.push(f); }
  const cada = Math.max(1, Math.ceil(lunes.length / 12));
  const eje = lunes.filter((_, i) => i % cada === 0).map(f => {
    const px = Math.min(X1 - 18, Math.max(X0 + 18, x(f)));
    return `<text x="${px.toFixed(1)}" y="15" text-anchor="middle" class="lt-eje">${corta(f)}</text>`;
  }).join('');

  return `${capaFases}${capaRend}${capaPeso}${capaEntrenos}<div class="lt-fila lt-fila-eje">${svg(22, eje, `Semanas del ${corta(d.desde)} al ${corta(d.hasta)}`).replace('role="img"', 'aria-hidden="true"')}</div>`;
}

/* ---------------------------------------------------------------
   Mini gráficas de las cifras clave (ancho lógico 230 × 48).
   --------------------------------------------------------------- */
const MW = 230, MH = 48;
const mini = (cuerpo, etiqueta) => `<svg class="mini-svg" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="none" role="img" aria-label="${tt(etiqueta)}">${cuerpo}</svg>`;

/* Barras de días entrenados por semana frente a lo previsto. */
function barrasSemanas(semanas, etiqueta){
  if (!semanas.length) return '';
  const n = semanas.length, hueco = 6, ancho = (MW - hueco * (n - 1)) / n;
  const max = Math.max(1, ...semanas.map(s => Math.max(s.dias, s.previstas || 0)));
  const cuerpo = semanas.map((s, i) => {
    const h = Math.max(3, s.dias / max * (MH - 6));
    const llega = s.previstas != null && s.dias >= s.previstas;
    return `<rect x="${(i * (ancho + hueco)).toFixed(1)}" y="${(MH - h).toFixed(1)}" width="${ancho.toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="mini-barra${llega ? ' logro' : ''}${s.descarga ? ' descarga' : ''}"/>`;
  }).join('');
  return mini(cuerpo, etiqueta);
}

/* Puntos de rendimiento de las sesiones de la valoración, sobre su cero. */
function puntosRendimiento(valores, etiqueta){
  if (valores.length < 2) return '';
  const D = Math.max(4, ...valores.map(v => Math.abs(v)));
  const Y = v => MH / 2 - v / D * (MH / 2 - 6);
  const X = i => 6 + i * (MW - 12) / (valores.length - 1);
  const linea = `<polyline points="${valores.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" class="mini-trazo"/>`;
  const puntos = valores.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" style="fill:${v >= 0 ? COLOR.lima : COLOR.naranja}" class="mini-punto"/>`).join('');
  return mini(`<line x1="0" x2="${MW}" y1="${MH / 2}" y2="${MH / 2}" class="mini-cero"/>${linea}${puntos}`, etiqueta);
}

/* Estado para entrenar por día: altura = valor, color = banda. */
function barrasEstado(dias, etiqueta){
  if (!dias.length) return '';
  const n = dias.length, hueco = n > 20 ? 2 : 3.4, ancho = (MW - hueco * (n - 1)) / n;
  const cuerpo = dias.map((d, i) => {
    const xx = (i * (ancho + hueco)).toFixed(1);
    if (d.valor == null) return `<rect x="${xx}" y="${MH - 3}" width="${ancho.toFixed(1)}" height="3" rx="1.5" style="fill:${COLOR.vacio}"/>`;
    const h = Math.max(3, d.valor / 100 * (MH - 2));
    return `<rect x="${xx}" y="${(MH - h).toFixed(1)}" width="${ancho.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" style="fill:${COLOR_ESTADO[bandaEstado(d.valor)]}"/>`;
  }).join('');
  return mini(cuerpo, etiqueta);
}

/* Línea mínima de una serie (tabla de ejercicios): punto final en lima. */
function linea(valores, { w = 120, h = 32, etiqueta = '' } = {}){
  const vs = valores.filter(v => v != null);
  if (vs.length < 2) return '<span class="muted">—</span>';
  const lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo || 1;
  const X = i => 4 + i * (w - 8) / (valores.length - 1);
  const Y = v => 4 + (hi - v) / r * (h - 8);
  const pts = valores.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean);
  const ult = valores.length - 1 - [...valores].reverse().findIndex(v => v != null);
  return `<svg class="linea-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${etiqueta ? `role="img" aria-label="${tt(etiqueta)}"` : 'aria-hidden="true"'}>`
    + `<polyline points="${pts.join(' ')}" class="linea-trazo"/><circle cx="${X(ult).toFixed(1)}" cy="${Y(valores[ult]).toFixed(1)}" r="3.2" style="fill:${COLOR.lima}"/></svg>`;
}

/* Recuperación de las últimas semanas: barras del estado para entrenar con
   su valor escrito en los días que no son verdes (segunda pista además del
   color) y rótulo de fecha cada semana. */
function estadoPeriodo(dias){
  if (!dias.length) return '';
  const w = 600, h = 104, base = 82, x0 = 30, ancho = (w - x0 - 10) / dias.length;
  let c = [100, 67, 33].map(v => { const y = base - v * 0.7; return `<line x1="${x0}" x2="${w - 10}" y1="${y}" y2="${y}" class="lt-ret"/><text x="${x0 - 6}" y="${y + 3.5}" text-anchor="end" class="lt-eje">${v}</text>`; }).join('');
  dias.forEach((d, i) => {
    const xx = x0 + i * ancho + 1.5, aw = Math.max(2, ancho - 3);
    if (d.valor == null){ c += `<rect x="${xx.toFixed(1)}" y="${base - 4}" width="${aw.toFixed(1)}" height="4" rx="2" style="fill:${COLOR.vacio}" data-tt="${tt(`${corta(d.fecha)} · sin cuestionario`)}"/>`; return; }
    const banda = bandaEstado(d.valor), alto = Math.max(3, d.valor * 0.7);
    c += `<rect x="${xx.toFixed(1)}" y="${(base - alto).toFixed(1)}" width="${aw.toFixed(1)}" height="${alto.toFixed(1)}" rx="3" style="fill:${COLOR_ESTADO[banda]}" data-tt="${tt(`${corta(d.fecha)} · estado ${Math.round(d.valor)}`)}"/>`;
    if (banda !== 'verde') c += `<text x="${(xx + aw / 2).toFixed(1)}" y="${(base - alto - 4).toFixed(1)}" text-anchor="middle" class="lt-rotulo">${Math.round(d.valor)}</text>`;
    if (d.fecha.getDay() === 1 || i === 0 || i === dias.length - 1) c += `<text x="${(xx + aw / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="lt-eje">${corta(d.fecha)}</text>`;
  });
  const verdes = dias.filter(d => d.valor != null && bandaEstado(d.valor) === 'verde').length;
  const con = dias.filter(d => d.valor != null).length;
  return `<svg class="lt-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${tt(`Estado para entrenar por día del ${corta(dias[0].fecha)} al ${corta(dias[dias.length - 1].fecha)}: ${verdes} de ${con} días en verde`)}">${c}</svg>`;
}

return { lineaTiempo, barrasSemanas, puntosRendimiento, barrasEstado, linea, estadoPeriodo, COLOR_ESTADO };
})();
