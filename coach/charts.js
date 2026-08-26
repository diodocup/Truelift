'use strict';
/* ================================================================
   TrueLift Coach — charts.js
   Gráficas SVG generadas en JS, sin dependencias externas.
   Todas devuelven un string SVG listo para innerHTML.

   Reglas de gráfica del rediseño (handoff §4):
     · retícula SOLO horizontal y muy tenue;
     · ejes en mono, apagados (lo pone styles.css sobre `svg text`);
     · sin relleno de área bajo la curva;
     · trazo 2.2-2.4 con extremos redondeados;
     · puntos con borde del color del fondo de la caja;
     · ningún rótulo suelto dentro del lienzo: baselines y umbrales se
       nombran en la leyenda, debajo.

   El color se pinta con `style="fill:…"` / `style="stroke:…"` y no con el
   atributo de presentación, por dos razones: `svg text{fill:…}` de la hoja
   de estilos gana a los atributos y aplastaba los rótulos de eje de color,
   y los colores del sistema se emiten como `var(--x)` (ver `_c`) para que
   la hoja invierta la gráfica al imprimir. Los tonos de serie que no están
   en el sistema van literales.
   ================================================================ */

/* Paleta del sistema. Es la del handoff; la usan también views.js y el
   informe. "verde" es lima y el negativo de rendimiento es naranja: el rojo
   queda para lo destructivo. */
const TL = {
  lima:    '#a8ee19',
  ambar:   '#E0A92E',
  naranja: '#F0872D',
  rojo:    '#D4483B',
  azul:    '#6FA8DC',
  txt:     '#F4F6F4',
  txt2:    '#C9CFC9',
  txt3:    '#8E948F',
  txt4:    '#6B7370',
  vacio:   '#4E5551',
};

/* Hex del sistema → variable CSS, para que el informe impreso los cambie por
   sus equivalentes sobre papel. */
const TL_VAR = {
  [TL.lima]:    '--lima',
  [TL.ambar]:   '--ambar',
  [TL.naranja]: '--naranja',
  [TL.rojo]:    '--rojo',
  [TL.azul]:    '--azul',
  [TL.txt]:     '--txt',
  [TL.txt2]:    '--txt2',
  [TL.txt3]:    '--txt3',
  [TL.txt4]:    '--txt4',
  [TL.vacio]:   '--vacio',
};

const Charts = {

  /* Color listo para meter en un `style`. */
  _c(color){
    if (!color) return 'currentColor';
    const v = TL_VAR[color] || TL_VAR[String(color).toLowerCase()] || TL_VAR[String(color).toUpperCase()];
    return v ? `var(${v})` : color;
  },

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

  /* Decimales del rótulo del eje según lo estrecho que sea su recorrido.
     Sin esto, un eje de %/semana entre 0 y −1 rotula "0, -0, -0, -1, -1". */
  _decEje(min, max){
    const rango = Math.abs(max - min);
    return rango < 2 ? 2 : rango < 10 ? 1 : 0;
  },

  /* Línea de retícula horizontal. Único trazo estructural del lienzo. */
  _reticula(x1, x2, y){
    return `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" style="stroke:var(--reticula)" stroke-width="1"/>`;
  },

  /* Línea de referencia (baseline o umbral): siempre discontinua y sin
     rótulo dentro del lienzo. */
  _referencia(x1, x2, y, color, { dash = '6 5', grosor = 1.4, opacidad = 0.8 } = {}){
    return `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" style="stroke:${this._c(color)}" `
         + `stroke-dasharray="${dash}" stroke-width="${grosor}" opacity="${opacidad}"/>`;
  },

  /* Punto de serie con halo del fondo de la caja, para que no se coma la
     línea al amontonarse. */
  _punto(x, y, color, r, tt){
    return `<circle cx="${x}" cy="${y}" r="${r}" stroke-width="1.5" `
         + `style="fill:${this._c(color)};stroke:var(--sup2)" data-tt="${tt}"/>`;
  },

  /* Trazo de serie. */
  _trazo(d, color, grosor, dash){
    return `<path d="${d}" fill="none" style="stroke:${this._c(color)}" stroke-width="${grosor}" `
         + `stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  },

  _ejeX(pts, X, h, w){
    const fechasU = [...new Set(pts.map(p => +soloDia(p.x)))].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(fechasU.length / 6));
    return fechasU.filter((_, i) => i % paso === 0)
      .map(t => `<text x="${X(t)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`).join('');
  },

  /* Entrada de leyenda. `tipo`: 'linea' | 'trazo' (discontinua). */
  _ley(color, texto, tipo = 'linea', extra = '', opacidad = null){
    const op = opacidad != null ? `;opacity:${opacidad}` : '';
    const i = tipo === 'trazo'
      ? `<i style="background:${this._c(color)};height:3px;margin-bottom:3px${op}"></i>`
      : `<i style="background:${this._c(color)}${op}"></i>`;
    return `<span>${i}${esc(texto)}${extra}</span>`;
  },

  /* Gráfica de líneas temporales.
     series: [{nombre, color, puntos:[{x:Date, y:num, c?:colorPunto}],
                dash?: '5 4', soloPuntos?: bool, grosor?: num,
                eje?: 'der', unidad?: string}]
     banda: {min, max, label?} franja de referencia · lineaBase: {y, label, color} */
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

    // La banda no es relleno bajo la curva: es una zona de referencia (la banda
    // muerta del ritmo, la banda de VFC). Se queda, en lima muy tenue.
    if (banda && banda.min != null && banda.max != null){
      svg += `<rect x="${padL}" y="${YIzq(banda.max)}" width="${w-padL-padR}" `
           + `height="${YIzq(banda.min)-YIzq(banda.max)}" style="fill:var(--lima)" opacity="0.09"/>`;
    }

    const decIzq = this._decEje(yMin, yMax);
    svg += '<g data-eje-y="izq">';
    this._ticksY(yMin, yMax).forEach(t => {
      svg += this._reticula(padL, w-padR, YIzq(t));
      svg += `<text x="${padL-6}" y="${YIzq(t)+4}" text-anchor="end">${fmtNum(t,decIzq)}</text>`;
    });
    const unidadIzq = series.find(s => s.eje !== 'der' && s.puntos.some(p => p.y != null))?.unidad;
    if (unidadIzq) svg += `<text x="${padL-6}" y="11" text-anchor="end">${esc(unidadIzq)}</text>`;
    svg += '</g>';

    if (hayEjeDer){
      const serieDer = series.find(s => s.eje === 'der' && s.puntos.some(p => p.y != null));
      const decDer = this._decEje(yDerMin, yDerMax);
      svg += '<g data-eje-y="der">';
      this._ticksY(yDerMin, yDerMax).forEach(t => {
        svg += `<text x="${w-padR+6}" y="${YDer(t)+4}" text-anchor="start" style="fill:${this._c(serieDer.color)}">${fmtNum(t,decDer)}</text>`;
      });
      if (serieDer.unidad)
        svg += `<text x="${w-4}" y="11" text-anchor="end" style="fill:${this._c(serieDer.color)}">${esc(serieDer.unidad)}</text>`;
      svg += '</g>';
    }
    svg += this._ejeX(pts, X, h, w);

    if (lineaBase && lineaBase.y != null)
      svg += this._referencia(padL, w-padR, YIzq(lineaBase.y), lineaBase.color || TL.txt3);

    series.forEach(s => {
      const p = s.puntos.filter(q => q.y != null).sort((a,b) => a.x - b.x);
      if (!p.length) return;
      const Y = hayEjeDer && s.eje === 'der' ? YDer : YIzq;
      if (!s.soloPuntos){
        const d = p.map((q,i) => `${i ? 'L' : 'M'}${X(+q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
        svg += this._trazo(d, s.color, s.grosor || 2.2, s.dash);
      }
      if (!s.sinPuntos){
        p.forEach(q => {
          svg += this._punto(X(+q.x).toFixed(1), Y(q.y).toFixed(1), q.c || s.color,
            s.soloPuntos ? 4 : 3.4,
            `${esc(s.nombre)} · ${fmtFecha(q.x)} · ${fmtNum(q.y,1)}${s.unidad ? ' ' + esc(s.unidad) : ''}`);
        });
      }
    });

    svg += `</svg>`;
    const ley = series.map(s => this._ley(s.color, s.nombre, s.dash ? 'trazo' : 'linea',
      hayEjeDer && s.eje === 'der' ? ' <span class="muted">(eje der.)</span>' : '')).join('');
    const leyBase = lineaBase && lineaBase.label
      ? this._ley(lineaBase.color || TL.txt3, lineaBase.label, 'trazo') : '';
    const leyBanda = (banda && banda.min != null && banda.max != null)
      ? this._ley(TL.lima, banda.label || 'banda', 'linea', '', 0.35) : '';
    return `${svg}<div class="leyenda">${ley}${leyBase}${leyBanda}</div>`;
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
      svg += this._reticula(padL, w-padR, Y(t));
      svg += `<text x="${padL-6}" y="${Y(t)+4}" text-anchor="end">${t}</text>`;
    });
    ds.forEach(d => {
      const x = X(+soloDia(d.x));
      // Las barras van al 72 %: son mucha superficie, y el lima a plena
      // saturación en bloques grandes es justo lo que el rediseño retira.
      svg += `<rect x="${x.toFixed(1)}" y="${Y(d.y).toFixed(1)}" width="${bw.toFixed(1)}" `
           + `height="${(Y(0)-Y(d.y)).toFixed(1)}" rx="2" style="fill:${this._c(d.color)}" opacity="0.72" `
           + `data-tt="${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}"/>`;
      if (d.tag)
        svg += `<text x="${(x + bw/2).toFixed(1)}" y="${(Y(d.y) - 5).toFixed(1)}" text-anchor="middle" style="fill:${this._c(d.color)}">${esc(d.tag)}</text>`;
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
      // Readiness como línea. Sin relleno de área: el handoff lo prohíbe y
      // aquí, además, tapaba las líneas de rendimiento.
      if (bs.length){
        const linePts = bs.map(d => `${X(+soloDia(d.x)).toFixed(1)},${YR(d.y).toFixed(1)}`);
        svg += `<path d="M${linePts.join(' L')}" fill="none" style="stroke:var(--lima)" stroke-width="1.6" `
             + `stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;
        bs.forEach(d => {
          svg += this._punto(X(+soloDia(d.x)).toFixed(1), YR(d.y).toFixed(1), d.color, 3,
            `Readiness · ${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}`);
        });
      }
    } else {
      // Barras readiness al fondo (con zona de señales en el rótulo)
      bs.forEach(d => {
        svg += `<rect x="${(X(+soloDia(d.x)) - bw/2).toFixed(1)}" y="${YR(d.y).toFixed(1)}" width="${bw.toFixed(1)}" `
             + `height="${(YR(0)-YR(d.y)).toFixed(1)}" rx="2" style="fill:${this._c(d.color)}" opacity="0.24" `
             + `data-tt="Readiness · ${fmtFecha(d.x)} · ${d.y}${d.info ? ' · ' + esc(d.info) : ''}"/>`;
      });
    }

    // Tercera serie: barras (1RM) al fondo, antes de la retícula
    if (t3pts.length && tercera.tipo === 'barra'){
      const bw3 = Math.max(3, bw * 0.6);
      t3pts.forEach(p => {
        const x = X(+soloDia(p.x)) - bw3/2;
        svg += `<rect x="${x.toFixed(1)}" y="${Y3(p.y).toFixed(1)}" width="${bw3.toFixed(1)}" `
             + `height="${(Y3(t3min)-Y3(p.y)).toFixed(1)}" rx="2" style="fill:${this._c(tercera.color)}" opacity="0.45" `
             + `data-tt="${esc(tercera.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}"/>`;
      });
    }

    // Retícula y eje izquierdo
    const decL = this._decEje(lMin, lMax);
    this._ticksY(lMin, lMax).forEach(t => {
      svg += this._reticula(padL, w-padR, YL(t));
      svg += `<text x="${padL-6}" y="${YL(t)+4}" text-anchor="end">${fmtNum(t,decL)}</text>`;
    });
    // Eje derecho (readiness)
    [0, 40, 70, 100].forEach(t => {
      svg += `<text x="${w-padR+6}" y="${YR(t)+4}" text-anchor="start">${t}</text>`;
    });

    // Baseline y umbrales, sin rótulo dentro del lienzo: van a la leyenda.
    svg += this._referencia(padL, w-padR, YL(baseline), TL.lima, { opacidad: 0.35 });
    umbrales.forEach(u => {
      svg += this._referencia(padL, w-padR, YL(u.y), u.color, { dash: '3 5', grosor: 1.2, opacidad: 0.55 });
    });

    // Líneas de rendimiento
    lss.forEach(l => {
      if (!l.pts.length) return;
      const d = l.pts.map((p,i) => `${i ? 'L' : 'M'}${X(+soloDia(p.x)).toFixed(1)},${YL(p.y).toFixed(1)}`).join(' ');
      svg += this._trazo(d, l.color, l.grosor || 2.4);
      l.pts.forEach(p => {
        svg += this._punto(X(+soloDia(p.x)).toFixed(1), YL(p.y).toFixed(1), l.color, 3.6,
          `${esc(l.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}%`);
      });
    });

    // Tercera serie: línea (VFC) en primer plano
    if (t3pts.length && tercera.tipo !== 'barra'){
      const d = t3pts.map((p,i) => `${i ? 'L' : 'M'}${X(+soloDia(p.x)).toFixed(1)},${Y3(p.y).toFixed(1)}`).join(' ');
      svg += this._trazo(d, tercera.color, tercera.grosor || 2.2, tercera.dash);
      t3pts.forEach(p => {
        svg += this._punto(X(+soloDia(p.x)).toFixed(1), Y3(p.y).toFixed(1), tercera.color, 3.2,
          `${esc(tercera.nombre)} · ${fmtFecha(p.x)} · ${fmtNum(p.y,1)}`);
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
      ? this._ley(TL.lima, 'Readiness (eje der.)', 'linea', '', 0.5)
      : this._ley(TL.lima, 'Readiness (eje der.)', 'linea', '', 0.4);
    const legTercera = t3pts.length
      ? this._ley(tercera.color,
          `${tercera.nombre} (${fmtNum(Math.min(...t3pts.map(p=>p.y)),0)}–${fmtNum(Math.max(...t3pts.map(p=>p.y)),0)})`,
          'linea', '', tercera.tipo === 'barra' ? 0.6 : null)
      : '';
    return `${svg}<div class="leyenda">
      ${lss.map(l => this._ley(l.color, l.nombre)).join('')}
      ${legReadiness}
      ${legTercera}
      ${this._ley(TL.lima, `baseline ${baseline}`, 'trazo')}
      ${umbrales.filter(u => u.label).map(u => this._ley(u.color, u.label, 'trazo')).join('')}
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

    // Retícula + eje izquierdo (rotulado en el color de su serie)
    const decIzq = this._decEje(izq._a, izq._b);
    this._ticksY(izq._a, izq._b).forEach(t => {
      svg += this._reticula(padL, w-padR, izq._Y(t).toFixed(1));
      svg += `<text x="${padL-6}" y="${izq._Y(t)+4}" text-anchor="end" style="fill:${this._c(izq.color)}">${fmtNum(t,decIzq)}</text>`;
    });
    // Eje derecho
    if (der){
      const decDer = this._decEje(der._a, der._b);
      this._ticksY(der._a, der._b).forEach(t => {
        svg += `<text x="${w-padR+6}" y="${der._Y(t)+4}" text-anchor="start" style="fill:${this._c(der.color)}">${fmtNum(t,decDer)}</text>`;
      });
    }

    // Umbrales / baseline por serie, sobre su eje. Sin rótulo dentro del
    // lienzo: van nombrados en la leyenda.
    activos.forEach(s => {
      if (s.baseline != null)
        svg += this._referencia(padL, w-padR, s._Y(s.baseline).toFixed(1), s.color, { grosor: 1.3, opacidad: 0.5 });
      (s.umbrales || []).forEach(u => {
        svg += this._referencia(padL, w-padR, s._Y(u.y).toFixed(1), u.color, { dash: '3 5', grosor: 1.2, opacidad: 0.6 });
      });
    });

    // Líneas + puntos
    activos.forEach(s => {
      const p = s.puntos.filter(q => q.y != null).sort((a,b) => +soloDia(a.x) - +soloDia(b.x));
      if (!p.length) return;
      const linePts = p.map(q => `${X(+soloDia(q.x)).toFixed(1)},${s._Y(q.y).toFixed(1)}`);
      svg += this._trazo(`M${linePts.join(' L')}`, s.color, 2.4);
      p.forEach(q => {
        svg += this._punto(X(+soloDia(q.x)).toFixed(1), s._Y(q.y).toFixed(1), s.color, 3.6,
          `${esc(s.label)} · ${fmtFecha(q.x)} · ${fmtNum(q.y,1)}${s.unidad ? ' ' + esc(s.unidad) : ''}`);
      });
    });

    // Eje X
    const todos = [...new Set(xs)].sort((a,b) => a-b);
    const paso = Math.max(1, Math.ceil(todos.length / 8));
    todos.filter((_, i) => i % paso === 0).forEach(t => {
      svg += `<text x="${X(t).toFixed(1)}" y="${h-8}" text-anchor="middle">${fmtFechaCorta(new Date(t))}</text>`;
    });

    svg += `</svg>`;
    // Leyenda: primero las series y después las referencias que se han sacado
    // del lienzo (baseline y umbrales de cada una).
    const ley = activos.map(s =>
      this._ley(s.color, s.label, 'linea',
        s.unidad ? ` <span class="muted">(${esc(s.unidad)}, eje ${s === izq ? 'izq.' : 'der.'})</span>`
                 : ` <span class="muted">(eje ${s === izq ? 'izq.' : 'der.'})</span>`)).join('');
    const leyRef = activos.flatMap(s => [
      s.baseline != null ? this._ley(s.color, `baseline ${fmtNum(s.baseline,0)}`, 'trazo') : '',
      ...(s.umbrales || []).filter(u => u.label).map(u => this._ley(u.color, u.label, 'trazo')),
    ]).join('');
    return `${svg}<div class="leyenda">${ley}${leyRef}</div>`;
  },

  /* Mini-línea sin ejes para tarjetas del resumen. Punto final relleno, como
     el sparkline del veredicto de la app. */
  sparkline(valores, w = 160, h = 40, color = TL.lima){
    const vs = valores.filter(v => v != null);
    if (vs.length < 2) return '';
    const [mn, mx] = this._escala(Math.min(...vs), Math.max(...vs));
    const X = i => 3 + i / (valores.length - 1) * (w - 6);
    const Y = v => 3 + (mx - v) / (mx - mn) * (h - 6);
    let d = '', started = false, ultimo = null;
    valores.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
      started = true;
      ultimo = { x: X(i), y: Y(v) };
    });
    const fin = ultimo
      ? `<circle cx="${ultimo.x.toFixed(1)}" cy="${ultimo.y.toFixed(1)}" r="3" stroke-width="1.5" `
        + `style="fill:${this._c(color)};stroke:var(--sup1)"/>` : '';
    return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px">`
         + this._trazo(d, color, 2.4) + `${fin}</svg>`;
  },
};
