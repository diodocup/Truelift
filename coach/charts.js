'use strict';
/* ================================================================
   TrueLift Coach — charts.js
   Gráficas SVG generadas en JS, sin dependencias externas.
   Todas devuelven un string SVG listo para innerHTML.
   ================================================================ */

const Charts = {

  _escala(min, max){
    if (min === max){ min -= 1; max += 1; }
    const margen = (max - min) * 0.08;
    return [min - margen, max + margen];
  },

  _ticksY(min, max, n = 4){
    const paso = (max - min) / n, out = [];
    for (let i = 0; i <= n; i++) out.push(min + paso * i);
    return out;
  },

  _ejeX(pts, X, h, w){
    const fechasU = [...new Set(pts.map(p => +soloDia(p.x)))].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(fechasU.length / 6));
    return fechasU.filter((_, i) => i % paso === 0)
      .map(t => `<text x="${X(t)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`).join('');
  },

  /* Gráfica de líneas temporales.
     series: [{nombre, color, puntos:[{x:Date, y:num, c?:colorPunto}],
                dash?: '5 4', soloPuntos?: bool, grosor?: num,
                eje?: 'der', unidad?: string}]
     banda: {min, max} franja sombreada  ·  lineaBase: {y, label, color} */
  lineas({ series, banda = null, lineaBase = null, w = 680, h = 240 }){
    const padL = 46, padT = 16, padB = 26;
    const pts = series.flatMap(s => s.puntos).filter(p => p.y != null);
    if (!pts.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;

    const ptsIzq = series.filter(s => s.eje !== 'der').flatMap(s => s.puntos).filter(p => p.y != null);
    const ptsDer = series.filter(s => s.eje === 'der').flatMap(s => s.puntos).filter(p => p.y != null);
    // Solo habilitar el segundo eje si también hay una serie a la izquierda.
    // Así una gráfica con únicamente datos derechos sigue siendo representable.
    const hayEjeDer = ptsIzq.length > 0 && ptsDer.length > 0;
    const padR = hayEjeDer ? 48 : 14;
    let ysIzq = (hayEjeDer ? ptsIzq : pts).map(p => p.y);
    if (banda){ if (banda.min != null) ysIzq.push(banda.min); if (banda.max != null) ysIzq.push(banda.max); }
    if (lineaBase && lineaBase.y != null) ysIzq.push(lineaBase.y);
    const [yMin, yMax] = this._escala(Math.min(...ysIzq), Math.max(...ysIzq));
    const [yDerMin, yDerMax] = hayEjeDer
      ? this._escala(Math.min(...ptsDer.map(p => p.y)), Math.max(...ptsDer.map(p => p.y)))
      : [null, null];
    const xs = pts.map(p => +p.x);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMin === xMax){ xMin -= 43200000; xMax += 43200000; }

    const X = v => padL + (v - xMin) / (xMax - xMin) * (w - padL - padR);
    const YIzq = v => padT + (yMax - v) / (yMax - yMin) * (h - padT - padB);
    const YDer = hayEjeDer
      ? v => padT + (yDerMax - v) / (yDerMax - yDerMin) * (h - padT - padB)
      : null;

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;

    if (banda && banda.min != null && banda.max != null){
      svg += `<rect x="${padL}" y="${YIzq(banda.max)}" width="${w-padL-padR}" height="${YIzq(banda.min)-YIzq(banda.max)}" fill="rgba(76,175,125,.10)"/>`;
    }

    svg += '<g data-eje-y="izq">';
    this._ticksY(yMin, yMax).forEach(t => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${YIzq(t)}" y2="${YIzq(t)}" stroke="#2e3743" stroke-width="1"/>`;
      svg += `<text x="${padL-6}" y="${YIzq(t)+4}" text-anchor="end">${fmtNum(t,0)}</text>`;
    });
    const unidadIzq = series.find(s => s.eje !== 'der' && s.puntos.some(p => p.y != null))?.unidad;
    if (unidadIzq) svg += `<text x="${padL-6}" y="11" text-anchor="end" style="font-size:10px">${esc(unidadIzq)}</text>`;
    svg += '</g>';

    if (hayEjeDer){
      const serieDer = series.find(s => s.eje === 'der' && s.puntos.some(p => p.y != null));
      svg += '<g data-eje-y="der">';
      this._ticksY(yDerMin, yDerMax).forEach(t => {
        svg += `<text x="${w-padR+6}" y="${YDer(t)+4}" text-anchor="start" fill="${serieDer.color}">${fmtNum(t,0)}</text>`;
      });
      if (serieDer.unidad)
        svg += `<text x="${w-4}" y="11" text-anchor="end" fill="${serieDer.color}" style="font-size:10px">${esc(serieDer.unidad)}</text>`;
      svg += '</g>';
    }
    svg += this._ejeX(pts, X, h, w);

    if (lineaBase && lineaBase.y != null){
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${YIzq(lineaBase.y)}" y2="${YIzq(lineaBase.y)}" stroke="${lineaBase.color || '#94a1b0'}" stroke-dasharray="6 4" stroke-width="1.5"/>`;
      if (lineaBase.label)
        svg += `<text x="${w-padR-4}" y="${YIzq(lineaBase.y)-5}" text-anchor="end" fill="${lineaBase.color || '#94a1b0'}">${esc(lineaBase.label)}</text>`;
    }

    series.forEach(s => {
      const p = s.puntos.filter(q => q.y != null).sort((a,b) => a.x - b.x);
      if (!p.length) return;
      const Y = hayEjeDer && s.eje === 'der' ? YDer : YIzq;
      if (!s.soloPuntos){
        const d = p.map((q,i) => `${i ? 'L' : 'M'}${X(+q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.grosor || 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
      }
      if (!s.sinPuntos){
        p.forEach(q => {
          svg += `<circle cx="${X(+q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${s.soloPuntos ? 4 : 3.2}" fill="${q.c || s.color}" data-tt="${esc(s.nombre)} · ${fmtFecha(q.x)} · ${fmtNum(q.y,1)}${s.unidad ? ' ' + esc(s.unidad) : ''}"/>`;
        });
      }
    });

    svg += `</svg>`;
    const ley = series.map(s => `<span><i style="background:${s.color}${s.dash ? ';height:3px;margin-bottom:3px' : ''}"></i>${esc(s.nombre)}${hayEjeDer && s.eje === 'der' ? ' <span class="muted">(eje der.)</span>' : ''}</span>`).join('');
    return `${svg}<div class="leyenda">${ley}${lineaBase && lineaBase.label ? `<span><i style="background:${lineaBase.color || '#94a1b0'};height:3px;margin-bottom:3px"></i>${esc(lineaBase.label)}</span>` : ''}</div>`;
  },

  /* Barras diarias coloreadas (estado para entrenar 0-100). */
  barras({ datos, w = 680, h = 200, yMax = 100 }){
    const padL = 36, padR = 10, padT = 10, padB = 26;
    const ds = datos.filter(d => d.y != null);
    if (!ds.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;
    const xs = ds.map(d => +soloDia(d.x));
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const nDias = Math.round((xMax - xMin) / 86400000) + 1;
    const bw = Math.max(3, Math.min(26, (w - padL - padR) / nDias - 3));
    const X = v => padL + (nDias === 1 ? (w-padL-padR)/2 : (v - xMin) / (xMax - xMin) * (w - padL - padR - bw));
    const Y = v => padT + (yMax - v) / yMax * (h - padT - padB);

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;
    [0, 40, 70, 100].forEach(t => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2e3743"/>`;
      svg += `<text x="${padL-6}" y="${Y(t)+4}" text-anchor="end">${t}</text>`;
    });
    ds.forEach(d => {
      const x = X(+soloDia(d.x));
      svg += `<rect x="${x.toFixed(1)}" y="${Y(d.y).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0)-Y(d.y)).toFixed(1)}" rx="2" fill="${d.color}" data-tt="${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}"/>`;
      if (d.tag)
        svg += `<text x="${(x + bw/2).toFixed(1)}" y="${(Y(d.y) - 4).toFixed(1)}" text-anchor="middle" style="font-size:9px" fill="${d.color}">${esc(d.tag)}</text>`;
    });
    const paso = Math.max(1, Math.ceil(ds.length / 6));
    ds.filter((_, i) => i % paso === 0).forEach(d => {
      svg += `<text x="${(X(+soloDia(d.x)) + bw/2).toFixed(1)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(d.x)}</text>`;
    });
    return svg + `</svg>`;
  },

  /* Rendimiento (líneas, eje izq. con baseline 100 y umbrales bueno/bajo)
     sobre readiness (barras 0-100, eje der., semitransparentes).
     lineas: [{nombre, color, puntos}] · umbrales: [{y, label, color}] */
  combinada({ barras, lineas, umbrales = [], baseline = 100, w = 960, h = 280,
              readinessArea = false, tercera = null }){
    const padL = 48, padR = 44, padT = 14, padB = 28;
    const bs = barras.filter(d => d.y != null).sort((a,b) => +soloDia(a.x) - +soloDia(b.x));
    const lss = lineas.map(l => ({ ...l, pts: l.puntos.filter(p => p.y != null).sort((a,b) => a.x - b.x) }));
    const todosPts = lss.flatMap(l => l.pts);
    if (!bs.length && !todosPts.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;

    // Tercera serie opcional (VFC como línea / 1RM como barras), con escala propia
    const t3pts = tercera ? tercera.puntos.filter(p => p.y != null).sort((a,b) => +soloDia(a.x) - +soloDia(b.x)) : [];
    const xsAll = [...bs.map(d => +soloDia(d.x)), ...todosPts.map(p => +soloDia(p.x)), ...t3pts.map(p => +soloDia(p.x))];
    let xMin = Math.min(...xsAll), xMax = Math.max(...xsAll);
    if (xMin === xMax){ xMin -= 43200000; xMax += 43200000; }
    const nDias = Math.round((xMax - xMin) / 86400000) + 1;
    const bw = Math.max(3, Math.min(24, (w - padL - padR) / nDias - 3));
    const X = v => padL + (v - xMin) / (xMax - xMin) * (w - padL - padR - bw) + bw / 2;

    // Eje izquierdo: rendimiento (incluye baseline y umbrales en la escala)
    let ysL = todosPts.map(p => p.y).concat([baseline], umbrales.map(u => u.y));
    const [lMin, lMax] = this._escala(Math.min(...ysL), Math.max(...ysL));
    const YL = v => padT + (lMax - v) / (lMax - lMin) * (h - padT - padB);
    // Eje derecho: readiness 0-100
    const YR = v => padT + (100 - v) / 100 * (h - padT - padB);

    // Escala propia para la tercera serie (autoajustada a su rango)
    let Y3 = null, t3min = 0, t3max = 0;
    if (t3pts.length){
      const vals = t3pts.map(p => p.y);
      let mn = Math.min(...vals), mx = Math.max(...vals);
      if (mn === mx){ mn -= 1; mx += 1; }
      const m = (mx - mn) * 0.15;
      t3min = mn - m; t3max = mx + m;
      if (tercera.tipo === 'barra') t3min = Math.min(0, t3min); // barras desde 0
      Y3 = v => padT + (t3max - v) / (t3max - t3min) * (h - padT - padB);
    }

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;

    if (readinessArea){
      // Readiness como línea con área ligeramente sombreada por debajo
      if (bs.length){
        const linePts = bs.map(d => `${X(+soloDia(d.x)).toFixed(1)},${YR(d.y).toFixed(1)}`);
        const x0 = X(+soloDia(bs[0].x)).toFixed(1);
        const xN = X(+soloDia(bs[bs.length-1].x)).toFixed(1);
        const area = `M${x0},${YR(0).toFixed(1)} L${linePts.join(' L')} L${xN},${YR(0).toFixed(1)} Z`;
        svg += `<path d="${area}" fill="rgba(76,175,125,.12)" stroke="none"/>`;
        svg += `<path d="M${linePts.join(' L')}" fill="none" stroke="#4caf7d" stroke-width="1.6" opacity="0.85"/>`;
        bs.forEach(d => {
          svg += `<circle cx="${X(+soloDia(d.x)).toFixed(1)}" cy="${YR(d.y).toFixed(1)}" r="3.2" fill="${d.color}" data-tt="Readiness · ${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}"/>`;
        });
      }
    } else {
      // Barras readiness al fondo (con zona de señales en el rótulo)
      bs.forEach(d => {
        svg += `<rect x="${(X(+soloDia(d.x)) - bw/2).toFixed(1)}" y="${YR(d.y).toFixed(1)}" width="${bw.toFixed(1)}" height="${(YR(0)-YR(d.y)).toFixed(1)}" rx="2" fill="${d.color}" opacity="0.38" data-tt="Readiness · ${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}"/>`;
      });
    }

    // Tercera serie: barras (1RM) al fondo, antes de la rejilla
    if (t3pts.length && tercera.tipo === 'barra'){
      const bw3 = Math.max(3, bw * 0.6);
      t3pts.forEach(p => {
        const x = X(+soloDia(p.x)) - bw3/2;
        svg += `<rect x="${x.toFixed(1)}" y="${Y3(p.y).toFixed(1)}" width="${bw3.toFixed(1)}" height="${(Y3(t3min)-Y3(p.y)).toFixed(1)}" rx="2" fill="${tercera.color}" opacity="0.45" data-tt="${esc(tercera.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}"/>`;
      });
    }

    // Rejilla y eje izquierdo
    this._ticksY(lMin, lMax).forEach(t => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${YL(t)}" y2="${YL(t)}" stroke="#2e3743"/>`;
      svg += `<text x="${padL-6}" y="${YL(t)+4}" text-anchor="end">${fmtNum(t,0)}</text>`;
    });
    // Eje derecho (readiness)
    [0, 40, 70, 100].forEach(t => {
      svg += `<text x="${w-padR+6}" y="${YR(t)+4}" text-anchor="start" fill="#94a1b0">${t}</text>`;
    });

    // Baseline 100
    svg += `<line x1="${padL}" x2="${w-padR}" y1="${YL(baseline)}" y2="${YL(baseline)}" stroke="#94a1b0" stroke-dasharray="6 4" stroke-width="1.5"/>`;
    svg += `<text x="${w-padR-4}" y="${YL(baseline)-5}" text-anchor="end">baseline ${baseline}</text>`;

    // Umbrales de veredicto (bueno / bajo, como en la app)
    umbrales.forEach(u => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${YL(u.y)}" y2="${YL(u.y)}" stroke="${u.color}" stroke-dasharray="3 4" stroke-width="1.3"/>`;
      svg += `<text x="${padL+4}" y="${YL(u.y) + (u.y >= baseline ? -4 : 11)}" text-anchor="start" fill="${u.color}">${esc(u.label)}</text>`;
    });

    // Líneas de rendimiento
    lss.forEach(l => {
      if (!l.pts.length) return;
      const d = l.pts.map((p,i) => `${i ? 'L' : 'M'}${X(+soloDia(p.x)).toFixed(1)},${YL(p.y).toFixed(1)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="${l.grosor || 2.5}"/>`;
      l.pts.forEach(p => {
        svg += `<circle cx="${X(+soloDia(p.x)).toFixed(1)}" cy="${YL(p.y).toFixed(1)}" r="3.5" fill="${l.color}" stroke="#12151a" stroke-width="1" data-tt="${esc(l.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}%"/>`;
      });
    });

    // Tercera serie: línea (VFC) en primer plano
    if (t3pts.length && tercera.tipo !== 'barra'){
      const d = t3pts.map((p,i) => `${i ? 'L' : 'M'}${X(+soloDia(p.x)).toFixed(1)},${Y3(p.y).toFixed(1)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${tercera.color}" stroke-width="${tercera.grosor || 2}"${tercera.dash ? ` stroke-dasharray="${tercera.dash}"` : ''}/>`;
      t3pts.forEach(p => {
        svg += `<circle cx="${X(+soloDia(p.x)).toFixed(1)}" cy="${Y3(p.y).toFixed(1)}" r="3" fill="${tercera.color}" stroke="#12151a" stroke-width="1" data-tt="${esc(tercera.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}"/>`;
      });
    }

    // Eje X
    const todos = [...new Set(xsAll)].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(todos.length / 8));
    todos.filter((_, i) => i % paso === 0).forEach(t => {
      svg += `<text x="${X(t).toFixed(1)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`;
    });

    svg += `</svg>`;
    const legReadiness = readinessArea
      ? `<span><i style="background:#4caf7d;opacity:.5"></i>Readiness (área, eje der.)</span>`
      : `<span><i style="background:#4caf7d;opacity:.45"></i>Readiness (eje der.)</span>`;
    const legTercera = t3pts.length
      ? `<span><i style="background:${tercera.color}${tercera.tipo === 'barra' ? ';opacity:.6' : ''}"></i>${esc(tercera.nombre)} (${fmtNum(t3pts.length ? Math.min(...t3pts.map(p=>p.y)) : 0,0)}–${fmtNum(t3pts.length ? Math.max(...t3pts.map(p=>p.y)) : 0,0)})</span>`
      : '';
    return `${svg}<div class="leyenda">
      ${lss.map(l => `<span><i style="background:${l.color}"></i>${esc(l.nombre)}</span>`).join('')}
      ${legReadiness}
      ${legTercera}
      ${umbrales.map(u => `<span><i style="background:${u.color};height:3px;margin-bottom:3px"></i>${esc(u.label)}</span>`).join('')}
    </div>`;
  },

  /* Comparador de hasta 2 series, cada una con su propio eje (izq./der.).
     series: [{ label, color, puntos:[{x,y}], eje:'izq'|'der',
                min?, max?, baseline?:num, umbrales?:[{y,label,color}], unidad? }] */
  dobleEje({ series, w = 960, h = 280 }){
    const padL = 52, padR = 52, padT = 16, padB = 28;
    const activos = (series || []).filter(s => s && s.puntos && s.puntos.some(p => p.y != null));
    if (!activos.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;

    const allPts = activos.flatMap(s => s.puntos.filter(p => p.y != null));
    const xs = allPts.map(p => +soloDia(p.x));
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMin === xMax){ xMin -= 43200000; xMax += 43200000; }
    const X = v => padL + (v - xMin) / (xMax - xMin) * (w - padL - padR);

    // Escala vertical propia por serie (incluye umbrales/baseline)
    activos.forEach(s => {
      const vals = s.puntos.filter(p => p.y != null).map(p => p.y);
      (s.umbrales || []).forEach(u => vals.push(u.y));
      if (s.baseline != null) vals.push(s.baseline);
      let a, b;
      if (s.min != null || s.max != null){
        a = (s.min != null) ? s.min : Math.min(...vals);
        b = (s.max != null) ? s.max : Math.max(...vals);
        if (a === b){ a -= 1; b += 1; }
      } else {
        [a, b] = this._escala(Math.min(...vals), Math.max(...vals));
      }
      s._a = a; s._b = b;
      s._Y = v => padT + (b - v) / (b - a) * (h - padT - padB);
    });

    const izq = activos.find(s => s.eje !== 'der') || activos[0];
    const der = activos.find(s => s !== izq && s.eje === 'der') || activos.find(s => s !== izq) || null;

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;

    // Rejilla + eje izquierdo (color de la serie izquierda)
    this._ticksY(izq._a, izq._b).forEach(t => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${izq._Y(t).toFixed(1)}" y2="${izq._Y(t).toFixed(1)}" stroke="#2e3743"/>`;
      svg += `<text x="${padL-6}" y="${izq._Y(t)+4}" text-anchor="end" fill="${izq.color}">${fmtNum(t,0)}</text>`;
    });
    // Eje derecho (color de la serie derecha)
    if (der){
      this._ticksY(der._a, der._b).forEach(t => {
        svg += `<text x="${w-padR+6}" y="${der._Y(t)+4}" text-anchor="start" fill="${der.color}">${fmtNum(t,0)}</text>`;
      });
    }

    // Umbrales / baseline por serie (línea discontinua en su color, sobre su eje)
    activos.forEach(s => {
      if (s.baseline != null){
        svg += `<line x1="${padL}" x2="${w-padR}" y1="${s._Y(s.baseline).toFixed(1)}" y2="${s._Y(s.baseline).toFixed(1)}" stroke="${s.color}" stroke-dasharray="6 4" stroke-width="1.3" opacity="0.7"/>`;
        svg += `<text x="${(s === izq ? padL+4 : w-padR-4)}" y="${s._Y(s.baseline)-4}" text-anchor="${s === izq ? 'start' : 'end'}" fill="${s.color}">baseline ${fmtNum(s.baseline,0)}</text>`;
      }
      (s.umbrales || []).forEach(u => {
        svg += `<line x1="${padL}" x2="${w-padR}" y1="${s._Y(u.y).toFixed(1)}" y2="${s._Y(u.y).toFixed(1)}" stroke="${u.color}" stroke-dasharray="3 4" stroke-width="1.2" opacity="0.85"/>`;
        svg += `<text x="${(s === izq ? padL+4 : w-padR-4)}" y="${s._Y(u.y) + (u.y >= (s.baseline ?? u.y) ? -4 : 11)}" text-anchor="${s === izq ? 'start' : 'end'}" fill="${u.color}">${esc(u.label)}</text>`;
      });
    });

    // Líneas + área tenue + puntos
    activos.forEach(s => {
      const p = s.puntos.filter(q => q.y != null).sort((a,b) => +soloDia(a.x) - +soloDia(b.x));
      if (!p.length) return;
      const linePts = p.map(q => `${X(+soloDia(q.x)).toFixed(1)},${s._Y(q.y).toFixed(1)}`);
      svg += `<path d="M${linePts.join(' L')}" fill="none" stroke="${s.color}" stroke-width="2.4"/>`;
      p.forEach(q => {
        svg += `<circle cx="${X(+soloDia(q.x)).toFixed(1)}" cy="${s._Y(q.y).toFixed(1)}" r="4" fill="${s.color}" stroke="#12151a" stroke-width="1" data-tt="${esc(s.label)} · ${fmtFecha(q.x)} · ${fmtNum(q.y,1)}${s.unidad ? ' ' + esc(s.unidad) : ''}"/>`;
      });
    });

    // Eje X
    const todos = [...new Set(xs)].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(todos.length / 8));
    todos.filter((_, i) => i % paso === 0).forEach(t => {
      svg += `<text x="${X(t).toFixed(1)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`;
    });

    svg += `</svg>`;
    const ley = activos.map(s =>
      `<span><i style="background:${s.color}"></i>${esc(s.label)}${s.unidad ? ` <span class="muted">(${esc(s.unidad)}, eje ${s === izq ? 'izq.' : 'der.'})</span>` : ` <span class="muted">(eje ${s === izq ? 'izq.' : 'der.'})</span>`}</span>`).join('');
    return `${svg}<div class="leyenda">${ley}</div>`;
  },

  /* Mini-línea sin ejes para tarjetas del resumen */
  sparkline(valores, w = 160, h = 40, color = '#5aa9e6'){
    const vs = valores.filter(v => v != null);
    if (vs.length < 2) return '';
    const [mn, mx] = this._escala(Math.min(...vs), Math.max(...vs));
    const X = i => 2 + i / (valores.length - 1) * (w - 4);
    const Y = v => 2 + (mx - v) / (mx - mn) * (h - 4);
    let d = '', started = false;
    valores.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
      started = true;
    });
    return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px"><path d="${d}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  },
};
