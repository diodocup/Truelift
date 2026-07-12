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
               dash?: '5 4', soloPuntos?: bool, grosor?: num}]
     banda: {min, max} franja sombreada  ·  lineaBase: {y, label, color} */
  lineas({ series, banda = null, lineaBase = null, w = 680, h = 240 }){
    const padL = 46, padR = 14, padT = 12, padB = 26;
    const pts = series.flatMap(s => s.puntos).filter(p => p.y != null);
    if (!pts.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;

    let ys = pts.map(p => p.y);
    if (banda){ if (banda.min != null) ys.push(banda.min); if (banda.max != null) ys.push(banda.max); }
    if (lineaBase && lineaBase.y != null) ys.push(lineaBase.y);
    const [yMin, yMax] = this._escala(Math.min(...ys), Math.max(...ys));
    const xs = pts.map(p => +p.x);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMin === xMax){ xMin -= 43200000; xMax += 43200000; }

    const X = v => padL + (v - xMin) / (xMax - xMin) * (w - padL - padR);
    const Y = v => padT + (yMax - v) / (yMax - yMin) * (h - padT - padB);

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;

    if (banda && banda.min != null && banda.max != null){
      svg += `<rect x="${padL}" y="${Y(banda.max)}" width="${w-padL-padR}" height="${Y(banda.min)-Y(banda.max)}" fill="rgba(76,175,125,.10)"/>`;
    }

    this._ticksY(yMin, yMax).forEach(t => {
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2e3743" stroke-width="1"/>`;
      svg += `<text x="${padL-6}" y="${Y(t)+4}" text-anchor="end">${fmtNum(t,0)}</text>`;
    });
    svg += this._ejeX(pts, X, h, w);

    if (lineaBase && lineaBase.y != null){
      svg += `<line x1="${padL}" x2="${w-padR}" y1="${Y(lineaBase.y)}" y2="${Y(lineaBase.y)}" stroke="${lineaBase.color || '#94a1b0'}" stroke-dasharray="6 4" stroke-width="1.5"/>`;
      if (lineaBase.label)
        svg += `<text x="${w-padR-4}" y="${Y(lineaBase.y)-5}" text-anchor="end" fill="${lineaBase.color || '#94a1b0'}">${esc(lineaBase.label)}</text>`;
    }

    series.forEach(s => {
      const p = s.puntos.filter(q => q.y != null).sort((a,b) => a.x - b.x);
      if (!p.length) return;
      if (!s.soloPuntos){
        const d = p.map((q,i) => `${i ? 'L' : 'M'}${X(+q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
        svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.grosor || 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
      }
      if (!s.sinPuntos){
        p.forEach(q => {
          svg += `<circle cx="${X(+q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${s.soloPuntos ? 4 : 3}" fill="${q.c || s.color}"><title>${esc(s.nombre)} · ${fmtFecha(q.x)} · ${fmtNum(q.y,1)}</title></circle>`;
        });
      }
    });

    svg += `</svg>`;
    const ley = series.map(s => `<span><i style="background:${s.color}${s.dash ? ';height:3px;margin-bottom:3px' : ''}"></i>${esc(s.nombre)}</span>`).join('');
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
      svg += `<rect x="${x.toFixed(1)}" y="${Y(d.y).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0)-Y(d.y)).toFixed(1)}" rx="2" fill="${d.color}"><title>${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}</title></rect>`;
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
  combinada({ barras, lineas, umbrales = [], baseline = 100, w = 960, h = 280 }){
    const padL = 48, padR = 44, padT = 14, padB = 28;
    const bs = barras.filter(d => d.y != null);
    const lss = lineas.map(l => ({ ...l, pts: l.puntos.filter(p => p.y != null).sort((a,b) => a.x - b.x) }));
    const todosPts = lss.flatMap(l => l.pts);
    if (!bs.length && !todosPts.length) return `<div class="muted" style="padding:20px">Sin datos en el rango.</div>`;

    const xsAll = [...bs.map(d => +soloDia(d.x)), ...todosPts.map(p => +soloDia(p.x))];
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

    let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">`;

    // Barras readiness al fondo (con zona de señales en el rótulo)
    bs.forEach(d => {
      svg += `<rect x="${(X(+soloDia(d.x)) - bw/2).toFixed(1)}" y="${YR(d.y).toFixed(1)}" width="${bw.toFixed(1)}" height="${(YR(0)-YR(d.y)).toFixed(1)}" rx="2" fill="${d.color}" opacity="0.38"><title>Readiness · ${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}</title></rect>`;
    });

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
        svg += `<circle cx="${X(+soloDia(p.x)).toFixed(1)}" cy="${YL(p.y).toFixed(1)}" r="3.5" fill="${l.color}" stroke="#12151a" stroke-width="1"><title>${esc(l.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}%</title></circle>`;
      });
    });

    // Eje X
    const todos = [...new Set(xsAll)].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(todos.length / 8));
    todos.filter((_, i) => i % paso === 0).forEach(t => {
      svg += `<text x="${X(t).toFixed(1)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`;
    });

    svg += `</svg>`;
    return `${svg}<div class="leyenda">
      ${lss.map(l => `<span><i style="background:${l.color}"></i>${esc(l.nombre)}</span>`).join('')}
      <span><i style="background:#4caf7d;opacity:.45"></i>Readiness (eje der.)</span>
      ${umbrales.map(u => `<span><i style="background:${u.color};height:3px;margin-bottom:3px"></i>${esc(u.label)}</span>`).join('')}
    </div>`;
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
