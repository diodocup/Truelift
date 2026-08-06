'use strict';
/* ================================================================
   TrueLift Coach — views.js
   Renderizado de las 5 pestañas. Cada vista recibe ctx:
   { datos, perfil, fuerzaR, cardioR, readinessR, desde, hasta,
     ejercicioSel, buscaEj, nombreCliente }
   (R = ya filtrado por el rango de fechas)
   ================================================================ */

// ---------- Piezas comunes ----------
function chipCompuerta(c){
  if (!c) return '';
  const lbl = { verde:'Verde', ambar:'Ámbar', rojo:'Rojo' }[c] || c;
  return `<span class="chip ${esc(c)}"><span class="punto ${esc(c)}"></span> ${esc(lbl)}</span>`;
}
function textoRend(s){
  const partes = [];
  if (s.rendimiento) partes.push(s.rendimiento);
  const pct = Metricas.pctSesion(s);
  if (pct != null) partes.push(`${fmtNum(pct,1)}%`);
  else if (s.verdict) partes.push(s.verdict);
  return partes.join(' · ');
}
function celdaKg(e){
  if (e.kgSets && e.kgSets.some(k => k != null)){
    const unicos = new Set(e.kgSets.filter(k => k != null));
    if (unicos.size > 1)
      return e.kgSets.map(k => k == null ? '—' : fmtNum(k,2)).join(' · ');
  }
  const kg = Metricas.kgRepr(e);
  return kg == null ? '—' : fmtNum(kg,2);
}
function joinSeries(arr){
  if (!arr || !arr.length) return '—';
  return arr.map(v => v == null ? '—' : v).join(' · ');
}
/* Escala 1–4 con color semáforo.
   tipo 'buena' (sueño, ánimo): 4 = perfecto → 3-4 verde, 2 ámbar, 1 rojo.
   tipo 'mala' (agujetas, dolor, estrés): 1 = perfecto → 1 verde, 2 ámbar, 3-4 rojo. */
function escDots(v, tipo = 'buena'){
  if (v == null) return '<span class="muted">—</span>';
  const calidad = tipo === 'mala'
    ? (v <= 1 ? 'verde' : v === 2 ? 'ambar' : 'rojo')
    : (v >= 3 ? 'verde' : v === 2 ? 'ambar' : 'rojo');
  const on = '●'.repeat(v), off = '○'.repeat(Math.max(0, 4 - v));
  return `<span class="esc ${calidad}" title="${v}/4"><span class="on">${on}</span><span class="off">${off}</span></span>`;
}
function zonaTxt(z){
  return z === 'inferior' ? ' (tren inf.)' : z === 'superior' ? ' (tren sup.)' : '';
}
function tarjetaVacia(msg){
  return `<div class="card"><div class="muted" style="padding:14px 4px">${esc(msg)}</div></div>`;
}

const COLORES_SEM = { verde:'#4caf7d', ambar:'#e0a63c', rojo:'#e05c5c' };

/* Zona de las señales del día (agujetas/dolor ≥2 con zona): null si no hay señales. */
function zonaSenales(r){
  const zonas = new Set();
  if ((r.agujetas ?? 1) >= 2) zonas.add(r.agujetasZona || 'general');
  if ((r.dolor ?? 1) >= 2) zonas.add(r.dolorZona || 'general');
  if (!zonas.size) return null;
  const inf = zonas.has('inferior'), sup = zonas.has('superior');
  if (inf && sup) return 'tren inf. + sup.';
  if (inf) return 'tren inferior';
  if (sup) return 'tren superior';
  return 'general';
}
function zonaTag(z){
  return z === 'tren inferior' ? 'I' : z === 'tren superior' ? 'S'
       : z === 'tren inf. + sup.' ? 'I+S' : z === 'general' ? 'G' : '';
}

/* Gráfica combinada rendimiento (líneas bruto y neto, baseline 100 y
   umbrales bueno/bajo de la app) + readiness (barras de fondo).
   Compartida por Resumen, Readiness e Informe. */
function graficaRendReadiness(ctx, opts = {}){
  const { fuerzaR, readinessR } = ctx;
  const { readinessArea = false, tercera = null } = opts;
  const barras = readinessR.map(r => {
    const c = r.estadoDia || bandaEstado(r.estadoEntrenar);
    const z = zonaSenales(r);
    return { x: r.fecha, y: r.estadoEntrenar, color: COLORES_SEM[c] || '#3a4552',
             info: z ? `señales: ${z}` : '' };
  });
  const bruto = fuerzaR.map(s => ({ x: s.fecha, y: Metricas.pctBruto(s) }));
  const neto = fuerzaR.map(s => ({ x: s.fecha, y: Metricas.pctNeto(s) }));
  const hayNeto = neto.some(p => p.y != null);
  // Tolerancia de veredicto de la app (tolPctAtSave; 2,5% si el JSON no la trae)
  const tols = fuerzaR.map(s => s.tolPct).filter(v => v != null);
  const tol = tols.length ? VFC._mediana(tols) : 2.5;
  const lineas = hayNeto
    ? [{ nombre: 'Rendimiento bruto', color: '#5aa9e6', puntos: bruto, grosor: 1.6 },
       { nombre: 'Rendimiento neto diario', color: '#a8d020', puntos: neto, grosor: 2.5 }]
    : [{ nombre: 'Rendimiento de sesión', color: '#5aa9e6', puntos: bruto, grosor: 2.5 }];
  const base = hayNeto ? neto : bruto;
  const conPct = base.filter(p => p.y != null);
  const media = conPct.length ? conPct.reduce((a,b) => a + b.y, 0) / conPct.length : null;
  return `
    <div class="chart-caja">${Charts.combinada({
      barras, lineas, baseline: 100, readinessArea, tercera,
      umbrales: [
        { y: 100 + tol, label: `bueno (≥ ${fmtNum(100 + tol,1)})`, color: '#4caf7d' },
        { y: 100 - tol, label: `bajo (≤ ${fmtNum(100 - tol,1)})`, color: '#e0a63c' },
      ],
    })}</div>
    ${media != null ? `<div class="muted" style="font-size:12px">Media ${hayNeto ? 'neta' : ''} del periodo: <b style="color:var(--texto)">${fmtNum(media,1)}%</b></div>` : ''}`;
}

/* Paleta para las series por tipo de sesión */
const COLORES_SESION = ['#e0985c','#5cc9c0','#d06e9a','#9ec25a','#6a8ff0','#e0c94c','#c0705a','#7ad0e0','#b58cff','#8fd06a'];

/* Catálogo de todas las series representables en el rango actual.
   Cada serie: { id, label, color, puntos:[{x,y}], grupo, unidad?, min?, max?,
                 baseline?, umbrales?:[{y,label,color}] } */
function catalogoSeries(ctx){
  const { datos, perfil, fuerzaR, readinessR } = ctx;
  const cat = [];

  // --- Rendimiento (bruto / neto) con baseline 100 y umbrales bueno/bajo ---
  const bruto = fuerzaR.map(s => ({ x: s.fecha, y: Metricas.pctBruto(s) }));
  const neto  = fuerzaR.map(s => ({ x: s.fecha, y: Metricas.pctNeto(s) }));
  const hayNeto = neto.some(p => p.y != null);
  const tols = fuerzaR.map(s => s.tolPct).filter(v => v != null);
  const tol = tols.length ? VFC._mediana(tols) : 2.5;
  const umbralRend = [
    { y: 100 + tol, label: `bueno (≥ ${fmtNum(100 + tol,1)})`, color: '#4caf7d' },
    { y: 100 - tol, label: `bajo (≤ ${fmtNum(100 - tol,1)})`, color: '#e0a63c' },
  ];
  const G_REND = 'Rendimiento global';
  if (hayNeto){
    cat.push({ id: 'rend_bruto', label: 'Rendimiento bruto', color: '#5aa9e6', puntos: bruto, unidad: '%', baseline: 100, umbrales: umbralRend, grupo: G_REND });
    cat.push({ id: 'rend_neto',  label: 'Rendimiento neto diario', color: '#a8d020', puntos: neto, unidad: '%', baseline: 100, umbrales: umbralRend, grupo: G_REND });
  } else if (bruto.some(p => p.y != null)){
    cat.push({ id: 'rend_sesion', label: 'Rendimiento de sesión', color: '#5aa9e6', puntos: bruto, unidad: '%', baseline: 100, umbrales: umbralRend, grupo: G_REND });
  }

  // --- Rendimiento por cada tipo de sesión de entrenamiento (agrupado por 'dia') ---
  const tipos = [...new Set(fuerzaR.map(s => s.dia).filter(d => d && d !== '—'))].sort((a,b) => a.localeCompare(b));
  tipos.forEach((tipo, i) => {
    const pts = fuerzaR
      .filter(s => s.dia === tipo)
      .map(s => ({ x: s.fecha, y: Metricas.pctBruto(s) }))  // bruto: alcanza tanto histórico como el rendimiento bruto global
      .filter(p => p.y != null);
    if (pts.length)
      cat.push({ id: 'rend_dia::' + tipo, label: 'Rend. · ' + tipo, color: COLORES_SESION[i % COLORES_SESION.length],
                 puntos: pts, unidad: '%', baseline: 100, umbrales: umbralRend, grupo: 'Rendimiento por sesión' });
  });

  // --- Readiness (0-100) ---
  const rdPts = readinessR.map(r => ({ x: r.fecha, y: r.estadoEntrenar })).filter(p => p.y != null);
  if (rdPts.length)
    cat.push({ id: 'readiness', label: 'Readiness', color: '#4caf7d', puntos: rdPts, unidad: '', min: 0, max: 100, grupo: 'Estado / recuperación' });

  // --- VFC (HRV) con umbral bajo si existe ---
  const vfcPts = readinessR.filter(r => r.vfc != null && !r.vfcDescartada).map(r => ({ x: r.fecha, y: r.vfc }));
  if (vfcPts.length){
    const uVfc = VFC.umbrales(datos.readiness, perfil);
    const umbrales = (uVfc && uVfc.baja != null) ? [{ y: uVfc.baja, label: `VFC baja (${fmtNum(uVfc.baja,1)})`, color: '#e0a63c' }] : [];
    cat.push({ id: 'vfc', label: 'VFC (HRV)', color: '#c792ea', puntos: vfcPts, unidad: 'ms', umbrales, grupo: 'Estado / recuperación' });
  }

  // --- Frecuencia cardiaca en reposo (campo fcReposo de readinessDiario) ---
  const fcReposoPts = readinessR.filter(r => r.fcReposo != null && !r.vfcDescartada)
    .map(r => ({ x: r.fecha, y: r.fcReposo }));
  if (fcReposoPts.length){
    const bandaFc = FCReposo.banda(datos.readiness);
    const umbrales = bandaFc
      ? [{ y: bandaFc.alta, label: `FC alta (${fmtNum(bandaFc.alta,1)})`, color: '#ff5252' }]
      : [];
    cat.push({ id: 'fc_reposo', label: 'FC en reposo', color: '#ff7a70', puntos: fcReposoPts,
               unidad: 'ppm', umbrales, grupo: 'Estado / recuperación' });
  }

  // --- 1RM estimado por ejercicio ---
  const nombresEj = [...new Set(fuerzaR.flatMap(s => s.entradas.map(e => e.ejercicio)))].sort((a,b) => a.localeCompare(b));
  nombresEj.forEach(n => {
    const pts = Metricas.historicoEjercicio(datos, n)
      .filter(p => enRango(p.fecha, ctx.desde, ctx.hasta) && p.e1rm != null)
      .map(p => ({ x: p.fecha, y: p.e1rm }));
    if (pts.length) cat.push({ id: 'e1rm::' + n, label: '1RM · ' + n, color: '#8a7dff', puntos: pts, unidad: 'kg', grupo: '1RM estimado' });
  });

  /* --- Nutrición ---
     Cruzarlas con el rendimiento neto o el readiness es justo la pregunta que
     el discriminador de la app resuelve por dentro (§7.5) y que el entrenador
     quiere ver con sus ojos: ¿la caída de rendimiento va con el ritmo de
     pérdida, o va por su cuenta? */
  const nut = datos.nut;
  if (nut){
    const G_NUT = 'Nutrición';
    const tendencia = serieNutEnRango(nut, 'tendenciaKg', ctx.desde, ctx.hasta);
    if (tendencia.length)
      cat.push({ id: 'nut_tendencia', label: 'Peso tendencia', color: '#a8d020', puntos: tendencia,
                 unidad: 'kg', grupo: G_NUT,
                 umbrales: (nut.fase && nut.fase.pesoObjetivoKg >= NUT.pesoMinKg)
                   ? [{ y: nut.fase.pesoObjetivoKg, label: `objetivo (${fmtNum(nut.fase.pesoObjetivoKg,1)} kg)`, color: '#94a1b0' }] : [] });

    const pesajes = nut.pesajes.filter(p => enRango(p.fecha, ctx.desde, ctx.hasta))
      .map(p => ({ x: p.fecha, y: p.pesoKg }));
    if (pesajes.length)
      cat.push({ id: 'nut_pesajes', label: 'Pesajes (crudos)', color: '#6fb3d9', puntos: pesajes, unidad: 'kg', grupo: G_NUT });

    const ritmo = serieNutEnRango(nut, 'tasaPctSemana', ctx.desde, ctx.hasta);
    if (ritmo.length){
      const obj = nut.fase ? nut.fase.tasaObjetivoPctSemana : null;
      const umbrales = obj != null ? [
        { y: obj + NUT.bandaMuertaPctSemana, label: 'banda muerta', color: '#4caf7d' },
        { y: obj - NUT.bandaMuertaPctSemana, label: '', color: '#4caf7d' },
      ] : [];
      cat.push({ id: 'nut_ritmo', label: 'Ritmo de peso', color: '#e0985c', puntos: ritmo,
                 unidad: '%/sem', baseline: obj ?? undefined, umbrales, grupo: G_NUT });
    }

    if (nut.curvaGrasa){
      const g = nut.curvaGrasa.puntos.filter(p => enRango(p.fecha, ctx.desde, ctx.hasta))
        .map(p => ({ x: p.fecha, y: p.porcentajePct }));
      if (g.length)
        cat.push({ id: 'nut_grasa', label: '% graso (curva teórica)', color: '#d06e9a', puntos: g,
                   unidad: '%', grupo: G_NUT,
                   umbrales: nut.sueloPct != null
                     ? [{ y: nut.sueloPct, label: `suelo fisiológico (${fmtNum(nut.sueloPct,0)} %)`, color: '#e05c5c' }] : [] });
      const magra = nut.curvaGrasa.puntos.filter(p => enRango(p.fecha, ctx.desde, ctx.hasta))
        .map(p => ({ x: p.fecha, y: p.pesoKg * (1 - p.porcentajePct / 100) }));
      if (magra.length)
        cat.push({ id: 'nut_magra', label: 'Masa magra estimada', color: '#5cc9c0', puntos: magra, unidad: 'kg', grupo: G_NUT });
    }

    const acum = acumuladoNut(nut).filter(p => enRango(p.x, ctx.desde, ctx.hasta));
    if (acum.length)
      cat.push({ id: 'nut_acumulado', label: 'Ajuste acumulado del lazo', color: '#c792ea',
                 puntos: acum.map(p => ({ x: p.x, y: p.y })), unidad: 'kcal/d', baseline: 0, grupo: G_NUT });
  }

  return cat;
}

/* Construye <option>/<optgroup> a partir del catálogo, marcando el seleccionado. */
function opcionesSeries(cat, curId, incluirNinguna){
  let html = incluirNinguna ? `<option value=""${!curId ? ' selected' : ''}>— ninguna —</option>` : '';
  const grupos = [...new Set(cat.map(s => s.grupo || ''))];
  grupos.forEach(g => {
    const inner = cat.filter(s => (s.grupo || '') === g)
      .map(s => `<option value="${esc(s.id)}"${s.id === curId ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
    html += g ? `<optgroup label="${esc(g)}">${inner}</optgroup>` : inner;
  });
  return html;
}

/* Gráfica comparadora con 2 selectores (Serie 1 y Serie 2) sobre el catálogo. */
function graficaDobleSerie(ctx){
  const cat = catalogoSeries(ctx);
  if (!cat.length) return `<div class="muted" style="padding:14px 4px">Sin datos para representar en el rango.</div>`;

  const s1 = State.serie1 != null ? State.serie1 : cat[0].id;
  const s2 = State.serie2 != null ? State.serie2
           : (cat.some(s => s.id === 'readiness') ? 'readiness' : (cat[1] ? cat[1].id : ''));
  const d1 = cat.find(s => s.id === s1) || cat[0];
  const d2 = s2 ? cat.find(s => s.id === s2) : null;

  const opciones1 = opcionesSeries(cat, d1.id, false);
  const opciones2 = opcionesSeries(cat, d2 ? d2.id : '', true);

  const series = [{ ...d1, eje: 'izq' }];
  if (d2 && d2.id !== d1.id) series.push({ ...d2, eje: 'der' });

  return `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
      <label class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px">Serie 1
        <select id="selSerie1" class="sel-tercera">${opciones1}</select></label>
      <label class="muted" style="font-size:12px;display:flex;align-items:center;gap:6px">Serie 2
        <select id="selSerie2" class="sel-tercera">${opciones2}</select></label>
    </div>
    <div class="chart-caja">${Charts.dobleEje({ series })}</div>`;
}

/* ================================================================
   Piezas de la capa de nutrición

   Criterio de lectura para el entrenador: la app móvil YA gobierna la
   dieta con un lazo cerrado (pesaje diario → tendencia → ritmo →
   ajuste semanal en kcal). Aquí no se re-decide nada; se enseña lo
   que el lazo está haciendo y, sobre todo, lo que solo un humano
   puede juzgar: si el cliente le está dando datos, si el ritmo real
   se corresponde con lo pactado, si el peso perdido sale de la grasa
   y si la dieta está recortando el entrenamiento.
   ================================================================ */

const NUT_COLOR = { verde:'#4caf7d', ambar:'#e0a63c', rojo:'#e05c5c', neutro:'#94a1b0' };

/* Ritmo con signo explícito: el signo ES la información (baja o sube). */
function fmtTasa(v, dec = 2){
  if (v == null || isNaN(v)) return '—';
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${fmtNum(Math.abs(v), dec)} %/sem`;
}
function fmtKcal(v){
  if (v == null || isNaN(v)) return '—';
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${fmtNum(Math.abs(v), 0)} kcal/d`;
}
function claseBanda(b){ return b === 'neutro' ? 'gris' : (b || 'gris'); }
function chipBandaNut(banda, texto){
  if (!banda) return '';
  return `<span class="chip ${claseBanda(banda)}">${esc(texto ?? NUT_TXT.banda[banda] ?? banda)}</span>`;
}

/* Pista de bandas del selector de ritmo de la app (§5.3–§5.4), con la marca
   del objetivo pactado y la del ritmo real. De un vistazo dice si el cliente
   está corriendo por encima de lo que su composición corporal aconseja. */
function pistaBandasHtml(pista, { objetivo = null, real = null } = {}){
  if (!pista || !pista.length) return '';
  const min = pista[0].desde, max = pista[pista.length - 1].hasta;
  const span = max - min;
  if (!(span > 0)) return '';
  const segs = pista.map(t =>
    `<i class="pista-seg ${claseBanda(t.banda)}" style="flex:${((t.hasta - t.desde) / span).toFixed(4)}"
        title="${esc(NUT_TXT.banda[t.banda] || t.banda)}: ${fmtNum(t.desde,2)}–${fmtNum(t.hasta,2)} %/sem"></i>`).join('');
  const marca = (v, cls, txt) => {
    if (v == null) return '';
    const x = nutClamp((Math.abs(v) - min) / span, 0, 1) * 100;
    return `<span class="pista-marca ${cls}" style="left:${x.toFixed(2)}%" title="${esc(txt)}: ${fmtNum(Math.abs(v),2)} %/sem"></span>`;
  };
  return `<div class="pista" title="verde = recomendado · ámbar = razonable · rojo = agresivo">
      ${segs}${marca(objetivo, 'obj', 'Objetivo')}${marca(real, 'real', 'Ritmo real')}
    </div>
    <div class="pista-pie muted"><span>${fmtNum(min,2)}</span><span>${fmtNum(max,2)} %/sem</span></div>
    <div class="muted" style="font-size:11px">▲ objetivo · ▼ ritmo real · verde recomendado, ámbar razonable, rojo agresivo</div>`;
}

/* Barra de consumo del tope de ajuste acumulado (§6.1): cuando llega al 100 %
   la fase se cierra sola, así que es una cuenta atrás que conviene ver venir. */
function barraTope(tope){
  if (!tope || !(tope.topeKcal > 0)) return '';
  const pct = tope.pct ?? 0;
  const col = pct >= 100 ? 'rojo' : pct >= 75 ? 'ambar' : 'verde';
  return `<div class="barra"><i class="${col}" style="width:${nutClamp(pct,0,100)}%"></i></div>
    <div class="muted" style="font-size:12px">
      ${fmtNum(tope.usadoKcal,0)} de ${fmtNum(tope.topeKcal,0)} kcal/día del tope de la fase (${pct}%)
      ${tope.declarada ? ' · suelo desde la ingesta base declarada'
        : tope.ingestaEstimadaKcal ? ' · suelo estimado desde la composición corporal' : ''}
    </div>`;
}

/* Serie diaria del filtro recortada al rango, para las gráficas. */
function serieNutEnRango(nut, campo, desde, hasta){
  if (!nut || nut.serie.vacia) return [];
  return nut.serie.puntos
    .filter(p => enRango(p.fecha, desde, hasta))
    .map(p => ({ x: p.fecha, y: p[campo] }))
    .filter(p => p.y != null && isFinite(p.y));
}

/* Ajuste acumulado del lazo, semana a semana, dentro de la fase vigente.
   El JSON guarda el ajuste de cada tarjeta y el acumulado final; la curva
   intermedia se reconstruye sumando en orden. */
function acumuladoNut(nut){
  if (!nut || !nut.fase) return [];
  const out = [];
  let suma = 0;
  nut.nut.recomendaciones
    .filter(r => r.faseId === nut.fase.id)
    .forEach(r => {
      if (r.ajusteKcalDia) suma += r.ajusteKcalDia;   // los refeeds no suman (§6.1)
      out.push({ x: r.fecha, y: suma, rec: r });
    });
  return out;
}

/* Chip de frescura de los datos importados */
function chipFrescura(dias){
  if (dias == null) return '<span class="muted">—</span>';
  const col = dias <= 7 ? 'verde' : dias <= 14 ? 'ambar' : 'rojo';
  const txt = dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
  return `<span class="chip ${col}">${txt}</span>`;
}

const Vistas = {

  // ================= CARTERA (panel de todos los clientes) =================
  /* filas: [{id, nombre, notas, estado, ultimaSesion, diasImport, ad, rojas, ambar, azules}] */
  cartera(filas){
    if (!filas.length)
      return tarjetaVacia('Importa el JSON de un cliente para empezar.');

    const filasHtml = filas.map(f => {
      // "Molestia" dejó de valer como etiqueta cuando las alertas rojas también
      // pueden venir de la dieta (lazo parado, reparto rojo…).
      const alertas = [
        f.rojas ? `<span class="chip rojo">${f.rojas} urgente${f.rojas > 1 ? 's' : ''}</span>` : '',
        f.ambar ? `<span class="chip ambar">${f.ambar} aviso${f.ambar > 1 ? 's' : ''}</span>` : '',
        !f.rojas && !f.ambar ? '<span class="chip verde">sin alertas</span>' : '',
      ].join(' ');
      // Dieta: la fase que gobierna el lazo y el ritmo real, con el color de su
      // banda. Es el dato que decide si hay que abrir la pestaña Nutrición.
      const n = f.nut;
      const nFase = (n && n.fase && n.fase.estado !== 'CLOSED') ? n.fase : null;
      const dieta = !n || !n.nut.presente ? '<span class="muted">—</span>'
        : !nFase ? '<span class="muted">sin fase</span>'
        : `<span class="chip ${claseBanda(n.bandaReal || n.bandaObjetivo)}">${esc(NUT_TXT.fase[nFase.tipo] || nFase.tipo)}</span>
           <div class="muted" style="font-size:12px">${fmtTasa(n.tasaPctSemana)}${
             n.diasSinPesarse != null && n.diasSinPesarse >= NUT.diasSinPesajeAviso
               ? ` · <span style="color:var(--ambar)">${n.diasSinPesarse} d sin pesarse</span>` : ''}</div>`;
      return `<tr class="fila-cli" data-abrir="${esc(f.id)}" title="Abrir a ${esc(f.nombre)}">
        <td><span class="punto ${f.estado}"></span></td>
        <td><b>${esc(f.nombre)}</b>${f.notas ? `<div class="muted" style="font-size:12px">${esc(f.notas.length > 90 ? f.notas.slice(0,90) + '…' : f.notas)}</div>` : ''}</td>
        <td>${f.ultimaSesion ? fmtFecha(f.ultimaSesion) : '<span class="muted">—</span>'}</td>
        <td>${dieta}</td>
        <td>${chipFrescura(f.diasImport)}</td>
        <td class="num">${f.ad.pct != null
          ? `<span class="chip ${f.ad.pct >= 85 ? 'verde' : f.ad.pct >= 60 ? 'ambar' : 'rojo'}">${f.ad.pct}%</span> <span class="muted">${f.ad.hechas}/${f.ad.esperadas}</span>`
          : `<span class="muted">${f.ad.hechas} ses.</span>`}</td>
        <td>${alertas}</td>
        <td><button class="btn sec" data-abrir="${esc(f.id)}">Abrir</button></td>
      </tr>`;
    }).join('');

    return `
      <div class="card">
        <h3>Mis clientes (${filas.length})</h3>
        <div class="muted" style="font-size:12px;margin-bottom:8px">
          Ordenados por atención requerida. Alertas y adherencia calculadas sobre el bloque actual de cada cliente.
          Recuerda pedir una copia nueva cuando los datos pasen de una semana.
        </div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th></th><th>Cliente</th><th>Última sesión</th><th>Dieta</th><th>Datos importados</th><th class="num">Adherencia</th><th>Alertas</th><th></th></tr></thead>
          <tbody>${filasHtml}</tbody>
        </table></div>
      </div>`;
  },

  // ================= RESUMEN =================
  resumen(ctx){
    const { perfil, fuerzaR, cardioR, readinessR, desde, hasta } = ctx;
    const P = perfil;

    // Ficha. Con el lazo de nutrición activo, la fase de dieta y el peso los
    // gobierna el lazo, así que la ficha muestra esos valores y no los manuales.
    const nut = ctx.datos.nut;
    const nutFase = (nut && nut.fase && nut.fase.estado !== 'CLOSED') ? nut.fase : null;
    const diasFase = P.faseInicio ? diasEntre(P.faseInicio, new Date()) : null;
    const fase = nutFase
      ? `${NUT_TXT.fase[nutFase.tipo] || nutFase.tipo} · ${fmtTasa(nutFase.tasaObjetivoPctSemana)}`
      : (P.fasePeso ? `${P.fasePeso}${diasFase != null ? ` · día ${diasFase}` : ''}` : '—');
    const peso = (nut && nut.tendenciaKg != null)
      ? `${fmtNum(nut.tendenciaKg,1)} kg <span class="muted">tendencia</span>`
      : `${fmtNum(P.pesoCorporal,1)} ${esc(P.unidadPeso)}`;
    const ficha = `
      <div class="card"><h3>Ficha</h3>
        <div class="kv"><span class="muted">Cliente</span><b>${esc(ctx.nombreCliente)}</b></div>
        <div class="kv"><span class="muted">Sexo / peso</span><b>${esc(P.sexo ?? '—')} · ${peso}</b></div>
        <div class="kv"><span class="muted">Fase</span><b>${esc(fase)} ${nutFase ? chipBandaNut(nut.bandaObjetivo) : ''}</b></div>
        ${nutFase ? `<div class="kv"><span class="muted">Dieta desde</span><b>${fmtFecha(nutFase.inicio)}${
          nut.diasEnFase != null ? ` · ${fmtNum(nut.diasEnFase / 7,1)} sem` : ''} <span class="muted">(lazo de nutrición)</span></b></div>` : ''}
        <div class="kv"><span class="muted">Sistema</span><b>${esc(P.sistema ?? '—')} · ${P.diasSemana ?? '—'} días/sem</b></div>
        <div class="kv"><span class="muted">Bloque desde</span><b>${fmtFecha(P.bloqueInicio)}</b></div>
        <div class="kv"><span class="muted">Descarga</span><b>${P.modoDescarga ? '<span class="chip ambar">EN DESCARGA</span>' : 'no'}</b></div>
      </div>`;

    // Resumen de dieta: los tres números que deciden si hay que abrir la pestaña.
    const adPeso = nut ? Nutricion.adherenciaPesaje(nut.pesajes, desde, hasta) : null;
    const tarjetaNut = (nut && nut.nut.presente && (nutFase || nut.pesajes.length)) ? `
      <div class="card"><h3>Dieta (lazo de nutrición)</h3>
        <div class="big" style="color:${NUT_COLOR[nut.bandaReal] || 'var(--texto)'}">${fmtTasa(nut.tasaPctSemana)}
          <span class="muted" style="font-size:15px;font-weight:400">ritmo real</span></div>
        <div>${nut.bandaReal ? chipBandaNut(nut.bandaReal) : ''}
          ${nut.dentroBandaMuerta === true ? '<span class="chip verde">en banda muerta</span>'
            : nut.dentroBandaMuerta === false ? `<span class="chip ambar">${fmtTasa(nut.desvioPctSemana)} del objetivo</span>` : ''}</div>
        <div class="kv" style="margin-top:8px"><span class="muted">Pesajes del periodo</span><b>${adPeso.hechos}/${adPeso.dias} <span class="muted">(${fmtNum(adPeso.porSemana,1)}/sem)</span></b></div>
        <div class="kv"><span class="muted">% graso estimado</span><b>${
          nut.grasaVigentePct != null ? `${fmtNum(nut.grasaVigentePct,1)} %${nut.grasaCaducada ? ' <span class="chip ambar">caducado</span>' : ''}` : '—'}</b></div>
        <div class="kv"><span class="muted">Reparto último tramo</span><b>${
          nut.reparto && nut.reparto.banda
            ? `${fmtNum(nut.reparto.fraccionGrasaObservada * 100,0)} % grasa ${chipBandaNut(nut.reparto.banda)}`
            : '<span class="muted">sin valorar</span>'}</b></div>
        ${nut.trinquete && nut.trinquete.trinqueteNivel > 0
          ? `<div class="kv"><span class="muted">Volumen</span><b><span class="chip ${nut.trinquete.trinqueteNivel >= 2 ? 'rojo' : 'ambar'}">recortado por la dieta</span></b></div>` : ''}
        <div class="muted" style="font-size:12px;margin-top:6px">El detalle está en la pestaña <b>Nutrición</b>.</div>
      </div>` : '';

    // Adherencia
    const ad = Metricas.adherencia(fuerzaR, desde, hasta, P.diasSemana);
    const adherencia = `
      <div class="card"><h3>Adherencia del periodo</h3>
        <div class="big">${ad.hechas}${ad.esperadas != null ? ` / ${ad.esperadas}` : ''} <span class="muted" style="font-size:15px;font-weight:400">sesiones de fuerza</span></div>
        ${ad.pct != null ? `<div>${ad.pct >= 85 ? '<span class="chip verde">' : ad.pct >= 60 ? '<span class="chip ambar">' : '<span class="chip rojo">'}${ad.pct}% de lo esperado</span></div>` : ''}
        <div class="kv" style="margin-top:8px"><span class="muted">Sesiones de cardio</span><b>${cardioR.length}</b></div>
      </div>`;

    // Disponibilidad (mini-calendario, máx. 8 semanas más recientes)
    const nDias = diasEntre(desde, hasta) + 1;
    const ini = nDias > 56 ? new Date(soloDia(hasta) - 55 * 86400000) : soloDia(desde);
    const mapaEstado = new Map(); // isoDia → color
    const mapaZona = new Map();   // isoDia → zona de las señales
    readinessR.forEach(r => {
      const c = r.estadoDia || bandaEstado(r.estadoEntrenar);
      if (c) mapaEstado.set(fmtISO(r.fecha), c);
      const z = zonaSenales(r);
      if (z) mapaZona.set(fmtISO(r.fecha), z);
    });
    fuerzaR.forEach(s => {
      const k = fmtISO(s.fecha);
      if (!mapaEstado.has(k) && s.compuerta) mapaEstado.set(k, s.compuerta);
    });
    let cal = '';
    for (let d = new Date(ini); d <= soloDia(hasta); d = new Date(+d + 86400000)){
      const k = fmtISO(d);
      const c = mapaEstado.get(k) || 'gris';
      const z = mapaZona.get(k);
      cal += `<div class="cd"><span class="punto ${c}" title="${fmtFecha(d)}${z ? ' · señales: ' + esc(z) : ''}"></span>${d.getDate()}${z ? `<span class="cd-zona">${zonaTag(z)}</span>` : ''}</div>`;
    }
    const disponibilidad = `
      <div class="card"><h3>Disponibilidad diaria</h3>
        <div class="cal">${cal}</div>
        <div class="muted" style="margin-top:6px;font-size:11px">G general · I tren inferior · S tren superior.
        ${nDias > 56 ? ' Mostrando las últimas 8 semanas del rango.' : ''}</div>
      </div>`;

    // Comparador de series (protagonista, ancho completo): 2 selectores
    const rendimiento = `
      <div class="card" style="grid-column:1/-1"><h3>Comparador de series</h3>
        ${graficaDobleSerie(ctx)}
      </div>`;

    // Alertas
    const alertas = this._alertas(ctx);
    const htmlAlertas = `
      <div class="card" style="grid-column:1/-1"><h3>Alertas para el entrenador</h3>
        ${alertas.length ? alertas.map(a => a.html).join('') : '<div class="muted">Sin alertas en el periodo. Todo en orden.</div>'}
      </div>`;

    const cabecera = `
      <div class="muted" style="margin-bottom:12px">Periodo: <b style="color:var(--texto)">${fmtFecha(desde)} — ${fmtFecha(hasta)}</b>
      · ${fuerzaR.length} sesiones de fuerza · ${cardioR.length} de cardio · ${readinessR.length} cuestionarios</div>`;

    return cabecera + `<div class="grid cols3">${ficha}${adherencia}${tarjetaNut}${disponibilidad}${rendimiento}${htmlAlertas}</div>`;
  },

  /* Devuelve [{nivel:'rojo'|'ambar'|'azul', html}] para poder contarlas por nivel. */
  _alertas(ctx){
    const { datos, perfil, fuerzaR, readinessR, hasta } = ctx;
    const out = [];
    const add = (nivel, tag, cuerpo) => out.push({ nivel,
      html: `<div class="alerta ${nivel}"><span class="tag">${tag}</span><span>${cuerpo}</span></div>` });

    // 1. Molestias en observaciones (máxima prioridad)
    Metricas.molestias(fuerzaR).forEach(m => {
      add('rojo', 'Molestia', `${fmtFecha(m.fecha)} · <b>${esc(m.ejercicio)}</b>: <cite>“${esc(m.obs)}”</cite>`);
    });

    // 2. Estancamientos y RIR alto (sobre ejercicios del rango)
    const nombres = [...new Set(fuerzaR.flatMap(s => s.entradas.map(e => e.ejercicio)))];
    nombres.forEach(n => {
      const hist = Metricas.historicoEjercicio({ fuerza: fuerzaR }, n);
      const d = Metricas.diagnostico(hist);
      if (d.estado === 'estancado')
        add('ambar', 'Estancado', `<b>${esc(n)}</b>: sin mejora en ${d.racha} sesiones (desde ${fmtFecha(d.desde)}).`);
      if (Metricas.rirAltoSostenido(hist))
        add('azul', 'RIR alto', `<b>${esc(n)}</b>: RIR medio ≥ 3 en las 2 últimas sesiones. Va sobrado: valorar subir carga.`);
    });

    // 3. Días rojos/ámbar y VFC
    const malos = readinessR.filter(r => (r.estadoDia || bandaEstado(r.estadoEntrenar)) === 'rojo');
    if (malos.length >= 2)
      add('ambar', 'Readiness', `${malos.length} días en rojo en el periodo (${malos.map(r => fmtFechaCorta(r.fecha)).join(', ')}).`);
    const vfcB = Metricas.vfcBajas(readinessR, perfil.vfcBandaMin, hasta);
    if (vfcB.length >= 2)
      add('ambar', 'VFC', `VFC por debajo de banda (${fmtNum(perfil.vfcBandaMin,0)}) en ${vfcB.length} de los últimos 7 días del rango.`);

    // 4. Sesiones con volumen bajo
    fuerzaR.filter(s => s.volumenBajo).forEach(s => {
      add('azul', 'Volumen', `${fmtFecha(s.fecha)} · ${esc(s.dia)}: sesión marcada con volumen bajo.`);
    });

    // 5. Capa de nutrición. Entran aquí a propósito: así el triaje de la Cartera
    //    ordena por atención requerida contando también la dieta, y el entrenador
    //    no tiene que abrir cliente por cliente para enterarse.
    this._alertasNutricion(ctx, add);

    return out;
  },

  // ================= SESIONES =================
  sesiones(ctx){
    const { datos, fuerzaR, cardioR } = ctx;
    if (!fuerzaR.length && !cardioR.length)
      return tarjetaVacia('No hay sesiones en el rango seleccionado.');

    // Cache de históricos (sobre TODO el historial, para deltas correctos)
    const cacheHist = new Map();
    const histDe = n => {
      if (!cacheHist.has(n)) cacheHist.set(n, Metricas.historicoEjercicio(datos, n));
      return cacheHist.get(n);
    };

    const items = [
      ...fuerzaR.map(s => ({ f: s.fecha, tipo: 'fuerza', s })),
      ...cardioR.map(s => ({ f: s.fecha, tipo: 'cardio', s })),
    ].sort((a,b) => b.f - a.f);

    return items.map((it, i) => {
      const s = it.s;
      if (it.tipo === 'cardio'){
        return `<details class="sesion">
          <summary>
            <span class="ses-fecha">${fmtFecha(s.fecha)}</span>
            <span class="ses-nombre">Cardio · ${esc(s.nombre)}</span>
            ${s.duracion != null ? `<span class="chip azul">${s.duracion} min</span>` : ''}
            ${s.intensidad != null ? `<span class="chip gris">intensidad ${s.intensidad}/10</span>` : ''}
          </summary>
        </details>`;
      }
      const chips = [
        s.semana != null ? `<span class="chip gris">semana ${s.semana}</span>` : '',
        chipCompuerta(s.compuerta),
        textoRend(s) ? `<span class="chip azul">${esc(textoRend(s))}</span>` : '',
        s.rpe != null ? `<span class="chip gris">RPE ${s.rpe}</span>` : '',
        s.duracionMin != null ? `<span class="chip gris">${s.duracionMin} min${s.duracionAnomala ? ' (anómala)' : ''}</span>` : '',
        s.descarga ? '<span class="chip ambar">DESCARGA</span>' : '',
        s.volumenBajo ? '<span class="chip ambar">volumen bajo</span>' : '',
      ].join(' ');

      const filas = s.entradas.map(e => {
        const hist = histDe(e.ejercicio);
        const idx = hist.findIndex(p => p.entrada === e);
        const d = idx >= 0 ? Metricas.delta(hist, idx) : null;
        return `<tr>
          <td>${esc(e.ejercicio)}${e.modulada ? ' <span class="chip ambar" title="Carga modulada por autorregulación">mod.</span>' : ''}</td>
          <td class="num">${celdaKg(e)}${d ? `<span class="delta ${d.tipo}">${d.texto}</span>` : ''}</td>
          <td class="num">${joinSeries(e.reps)}</td>
          <td class="num">${joinSeries(e.rir)}</td>
          <td class="${e.obs ? 'obs-si' : ''}">${esc(e.obs) || '<span class="muted">—</span>'}</td>
        </tr>`;
      }).join('');

      const ton = Metricas.tonelajeSesion(s);
      return `<details class="sesion" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="ses-fecha">${fmtFecha(s.fecha)}</span>
          <span class="ses-nombre">${esc(s.dia)}</span>
          ${chips}
        </summary>
        <div class="cuerpo">
          <table>
            <thead><tr><th>Ejercicio</th><th class="num">Kg</th><th class="num">Reps</th><th class="num">RIR</th><th>Observaciones</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
          ${ton != null ? `<div class="muted" style="margin-top:8px;font-size:13px">Tonelaje de la sesión: <b>${fmtNum(ton,0)} kg</b>${s.effectiveSets != null ? ` · series efectivas: ${s.effectiveSets}` : ''}</div>` : ''}
        </div>
      </details>`;
    }).join('');
  },

  // ================= EJERCICIOS =================
  ejercicios(ctx){
    const { fuerzaR, datos, ejercicioSel, buscaEj } = ctx;
    if (!fuerzaR.length) return tarjetaVacia('No hay sesiones en el rango seleccionado.');

    // Ejercicios presentes en el rango, agrupados por grupo muscular
    const conteo = new Map();
    fuerzaR.forEach(s => s.entradas.forEach(e => conteo.set(e.ejercicio, (conteo.get(e.ejercicio) || 0) + 1)));
    const filtro = sinTildes(buscaEj || '');
    const porGrupo = new Map();
    [...conteo.keys()].sort((a,b) => a.localeCompare(b, 'es')).forEach(n => {
      if (filtro && !sinTildes(n).includes(filtro)) return;
      const g = datos.grupoDe.get(n) || 'Otros';
      if (!porGrupo.has(g)) porGrupo.set(g, []);
      porGrupo.get(g).push(n);
    });
    const grupos = [...porGrupo.keys()].sort((a,b) =>
      (a === 'Otros') - (b === 'Otros') || a.localeCompare(b, 'es'));

    const lista = grupos.map(g => `
      <div class="ej-grupo">${esc(g)}</div>
      ${porGrupo.get(g).map(n => `
        <button class="ej-item ${n === ejercicioSel ? 'sel' : ''}" data-ej="${esc(n)}">
          <span>${esc(n)}</span><span class="muted">${conteo.get(n)}</span>
        </button>`).join('')}`).join('');

    let detalle = '<div class="card"><div class="muted" style="padding:30px;text-align:center">Selecciona un ejercicio de la lista para ver su progresión.</div></div>';

    if (ejercicioSel && conteo.has(ejercicioSel)){
      const hist = Metricas.historicoEjercicio({ fuerza: fuerzaR }, ejercicioSel);
      const diag = Metricas.diagnostico(hist);
      const rirAlto = Metricas.rirAltoSostenido(hist);
      const molest = hist.filter(p => p.entrada.obs &&
        Metricas.PALABRAS_MOLESTIA.some(w => sinTildes(p.entrada.obs).includes(w)));

      const chips = [
        diag.estado === 'progresando' ? `<span class="chip verde">${esc(diag.texto)}</span>` :
        diag.estado === 'estancado' ? `<span class="chip rojo">${esc(diag.texto)}</span>` :
        `<span class="chip gris">${esc(diag.texto)}</span>`,
        rirAlto ? '<span class="chip azul">RIR alto: puede subir carga</span>' : '',
        molest.length ? `<span class="chip rojo">Molestias reportadas (${molest.length})</span>` : '',
      ].join(' ');

      const grafica = Charts.lineas({
        series: [
          { nombre: 'Kg (mejor serie)', color: '#5aa9e6', puntos: hist.map(p => ({ x: p.fecha, y: p.kgR })) },
          { nombre: 'e1RM estimado', color: '#4caf7d', puntos: hist.map(p => ({ x: p.fecha, y: p.e1rm })) },
        ],
      });

      const filas = hist.slice().reverse().map(p => `<tr>
        <td>${fmtFecha(p.fecha)}<div class="muted" style="font-size:12px">${esc(p.dia)}${p.semana != null ? ` · sem ${p.semana}` : ''}</div></td>
        <td class="num">${celdaKg(p.entrada)}</td>
        <td class="num">${joinSeries(p.entrada.reps)}</td>
        <td class="num">${joinSeries(p.entrada.rir)}</td>
        <td class="num">${fmtNum(p.e1rm,1)}</td>
        <td class="num">${fmtNum(p.tonelaje,0)}</td>
        <td class="${p.entrada.obs ? 'obs-si' : ''}">${esc(p.entrada.obs) || '<span class="muted">—</span>'}</td>
      </tr>`).join('');

      const mejor = Math.max(...hist.map(p => p.e1rm ?? -Infinity));
      detalle = `<div class="card">
        <h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--texto)">${esc(ejercicioSel)}
          <span class="muted" style="font-weight:400">· ${esc(datos.grupoDe.get(ejercicioSel) || 'Otros')}</span></h3>
        <div style="margin-bottom:8px">${chips}</div>
        <div class="kv" style="max-width:420px"><span class="muted">Mejor e1RM del rango</span><b>${isFinite(mejor) ? fmtNum(mejor,1) + ' kg' : '—'}</b></div>
        <div class="chart-caja">${grafica}</div>
        <table>
          <thead><tr><th>Fecha</th><th class="num">Kg</th><th class="num">Reps</th><th class="num">RIR</th><th class="num">e1RM</th><th class="num">Tonelaje</th><th>Obs</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
    }

    return `<div class="ej-layout">
      <div class="card ej-lista">
        <input type="search" id="buscaEj" placeholder="Buscar ejercicio…" value="${esc(buscaEj || '')}">
        ${lista || '<div class="muted" style="padding:10px">Sin resultados.</div>'}
      </div>
      <div>${detalle}</div>
    </div>`;
  },

  // ================= RUTINA =================
  rutina(ctx){
    const { datos, fuerzaR } = ctx;
    const btnPln = `<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn pri" id="btnAbrirPlanificador">✎ Revisar / editar en el planificador</button>
      <span class="muted" style="font-size:12px">Edita la rutina, analiza volumen y frecuencia, y exporta el Excel para que el cliente lo importe en TrueLift.</span>
    </div>`;
    if (!datos.plan.length) return btnPln + tarjetaVacia('El JSON no contiene rutina activa (planMod).');

    // Última ejecución de cada ejercicio dentro del rango
    const ultima = new Map();
    fuerzaR.forEach(s => s.entradas.forEach(e => ultima.set(e.ejercicio, { s, e })));

    // Días en orden de aparición
    const dias = [];
    datos.plan.forEach(p => { if (!dias.includes(p.dia)) dias.push(p.dia); });

    const bloques = dias.map(dia => {
      const filas = datos.plan.filter(p => p.dia === dia).sort((a,b) => a.orden - b.orden).map(p => {
        const u = ultima.get(p.ejercicio);
        let ejec = '<span class="muted">— sin registro en el rango</span>', avisos = '';
        if (u){
          const rirMed = Metricas.rirMedio(u.e);
          ejec = `${celdaKg(u.e)} kg · ${joinSeries(u.e.reps)} reps · RIR ${joinSeries(u.e.rir)}
                  <div class="muted" style="font-size:12px">${fmtFecha(u.s.fecha)}</div>`;
          if (p.series != null && u.e.nSeries < p.series)
            avisos += ` <span class="chip ambar" title="Hizo menos series de las planificadas">${u.e.nSeries}/${p.series} series</span>`;
          const rirPlan = parseFloat(p.rir);
          if (!isNaN(rirPlan) && rirMed != null && rirMed - rirPlan >= 2)
            avisos += ' <span class="chip azul" title="RIR real muy por encima del objetivo">RIR alto</span>';
        }
        return `<tr>
          <td class="num muted">${p.orden}</td>
          <td>${esc(p.ejercicio)}<div class="muted" style="font-size:12px">${esc(p.grupo)} · ${esc(p.patron)}</div></td>
          <td class="num">${p.series ?? '—'} × ${esc(p.reps)} @RIR ${esc(p.rir)}${p.descansoMin != null ? `<div class="muted" style="font-size:12px">descanso ${fmtNum(p.descansoMin,1)} min</div>` : ''}</td>
          <td>${ejec}${avisos}</td>
        </tr>`;
      }).join('');
      return `<div class="card" style="margin-bottom:14px"><h3>${esc(dia)}</h3>
        <table>
          <thead><tr><th class="num">#</th><th>Ejercicio</th><th class="num">Planificado</th><th>Última ejecución</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
    }).join('');

    // Fuera de plan
    const enPlan = new Set(datos.plan.map(p => p.ejercicio));
    const fuera = [...ultima.keys()].filter(n => !enPlan.has(n));
    const htmlFuera = fuera.length ? `<div class="card" style="margin-bottom:14px"><h3>Ejecutado fuera del plan</h3>
      <div class="muted" style="font-size:13px;margin-bottom:6px">Ejercicios registrados que no están en la rutina activa (sustituciones del cliente).</div>
      ${fuera.map(n => { const u = ultima.get(n);
        return `<div class="kv"><span>${esc(n)}</span><b>${celdaKg(u.e)} kg · ${joinSeries(u.e.reps)} reps · ${fmtFechaCorta(u.s.fecha)}</b></div>`; }).join('')}
    </div>` : '';

    // Volumen semanal por grupo (series ejecutadas)
    const semanas = [...new Set(fuerzaR.map(s => s.semana).filter(v => v != null))].sort((a,b) => a-b);
    let htmlVol = '';
    if (semanas.length){
      // Rango lunes→domingo (ambos incluidos) de cada semana, según la fecha
      // más temprana registrada en esa semana.
      const semInicio = new Map(); // semana → Date más temprana
      fuerzaR.forEach(s => {
        if (s.semana == null || !s.fecha) return;
        const cur = semInicio.get(s.semana);
        if (!cur || s.fecha < cur) semInicio.set(s.semana, s.fecha);
      });
      const rangoSemana = w => {
        const d = semInicio.get(w);
        if (!d) return '';
        const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
        const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
        return `${fmtFechaCorta(lunes)} – ${fmtFechaCorta(domingo)}`;
      };
      const vol = new Map(); // grupo → Map(semana → series)
      fuerzaR.forEach(s => {
        if (s.semana == null) return;
        s.entradas.forEach(e => {
          const g = datos.grupoDe.get(e.ejercicio) || 'Otros';
          if (!vol.has(g)) vol.set(g, new Map());
          const m = vol.get(g);
          m.set(s.semana, (m.get(s.semana) || 0) + e.nSeries);
        });
      });
      const gruposV = [...vol.keys()].sort((a,b) => (a === 'Otros') - (b === 'Otros') || a.localeCompare(b, 'es'));
      htmlVol = `<div class="card"><h3>Volumen semanal (series ejecutadas por grupo)</h3>
        <table>
          <thead><tr><th>Grupo</th>${semanas.map(w => `<th class="num">Sem ${w}<div class="muted" style="font-size:11px;font-weight:400;white-space:nowrap">${rangoSemana(w)}</div></th>`).join('')}</tr></thead>
          <tbody>${gruposV.map(g => `<tr><td>${esc(g)}</td>${semanas.map(w =>
            `<td class="num">${vol.get(g).get(w) ?? '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    return btnPln + bloques + htmlFuera + htmlVol;
  },

  // ================= READINESS =================
  readiness(ctx){
    const { datos, perfil, readinessR } = ctx;
    if (!readinessR.length) return tarjetaVacia('No hay cuestionarios de readiness en el rango.');

    // Cálculos sobre TODO el histórico (la media 7d y la fatiga necesitan contexto previo)
    const serieVfc = VFC.tendenciaSerie(datos.readiness);
    const umbrales = VFC.umbrales(datos.readiness, perfil);
    const tendenciaBaja = VFC.tendenciaBajaFechas(datos.readiness);
    const fatigaMap = Fatiga.porDia(datos.readiness, tendenciaBaja);

    // --- Rendimiento vs readiness ---
    const htmlCombinada = `
      <div class="card" style="margin-bottom:14px"><h3>Rendimiento vs readiness</h3>
        ${graficaRendReadiness(ctx)}
      </div>`;

    // --- Estado para entrenar (con zona de las señales del día) ---
    const barras = Charts.barras({
      datos: readinessR.map(r => {
        const c = r.estadoDia || bandaEstado(r.estadoEntrenar);
        const z = zonaSenales(r);
        return { x: r.fecha, y: r.estadoEntrenar, color: COLORES_SEM[c] || '#3a4552',
                 tag: zonaTag(z), info: z ? `señales: ${z}` : 'sin señales' };
      }),
    });

    // --- VFC como en la app: noches + media 7 días + umbral de tendencia ---
    const noches = readinessR.filter(r => r.vfc != null && !r.vfcDescartada)
      .map(r => ({ x: r.fecha, y: r.vfc,
                   c: (umbrales.baja != null && r.vfc < umbrales.baja) ? '#e0a63c' : '#5aa9e6' }));
    const fcReposo = readinessR.filter(r => r.fcReposo != null && !r.vfcDescartada)
      .map(r => ({ x: r.fecha, y: r.fcReposo }));
    const bandaFc = FCReposo.banda(datos.readiness);
    const nochesFcValidas = FCReposo.validas(datos.readiness).length;
    const mostrarFcReposo = State.mostrarFcReposo === true;
    const media7 = [], umbral7 = [];
    readinessR.forEach(r => {
      const t = serieVfc.get(fmtISO(r.fecha));
      if (t){ media7.push({ x: r.fecha, y: t.media7 }); umbral7.push({ x: r.fecha, y: t.umbral }); }
    });
    let htmlVfc = '';
    if (perfil.vfcActiva || noches.length || fcReposo.length){
      const seriesVfc = [
        { nombre: 'VFC nocturna', color: '#5aa9e6', puntos: noches, unidad: 'ms' },
        { nombre: 'Media 7 días', color: '#4caf7d', puntos: media7, sinPuntos: true, grosor: 2.5, unidad: 'ms' },
        { nombre: 'Umbral de tendencia', color: '#e0a63c', puntos: umbral7, dash: '6 4', sinPuntos: true, unidad: 'ms' },
      ];
      if (mostrarFcReposo && fcReposo.length){
        seriesVfc.push({ nombre: 'FC en reposo', color: '#ff7a70', puntos: fcReposo,
                         grosor: 2.5, eje: 'der', unidad: 'ppm' });
        if (bandaFc){
          seriesVfc.push({
            nombre: `FC alta (${fmtNum(bandaFc.alta,1)} ppm)`, color: '#ff5252',
            puntos: [
              { x: readinessR[0].fecha, y: bandaFc.alta },
              { x: readinessR[readinessR.length - 1].fecha, y: bandaFc.alta },
            ],
            dash: '6 4', sinPuntos: true, grosor: 2, eje: 'der', unidad: 'ppm',
          });
        }
      }
      const grafica = Charts.lineas({
        series: seriesVfc,
      });
      const botonFcReposo = fcReposo.length
        ? `<button class="btn sec" id="btnToggleFcReposo" type="button" aria-pressed="${mostrarFcReposo}">${mostrarFcReposo ? 'Ocultar' : 'Mostrar'} FC en reposo</button>`
        : '';
      htmlVfc = `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <h3 style="margin:0">VFC (HRV)</h3>
          ${botonFcReposo}
        </div>
        <div class="chart-caja">${grafica}</div>
        <div class="muted" style="font-size:12px">
          Puntos: VFC nocturna (<span style="color:#e0a63c">amarillo</span> = por debajo del umbral${umbrales.baja != null ? `, ${fmtNum(umbrales.baja,1)}` : ''}).
          Línea <span style="color:#4caf7d">verde</span>: media 7 días · línea discontinua <span style="color:#e0a63c">amarilla</span>: umbral.
          ${mostrarFcReposo && fcReposo.length ? ' Línea <span style="color:#ff7a70">coral</span>: FC en reposo (ppm, eje derecho).' : ''}
          ${mostrarFcReposo && bandaFc ? ` Línea discontinua <span style="color:#ff5252">roja</span>: FC alta (${fmtNum(bandaFc.alta,1)} ppm = mediana + MAD, ${bandaFc.noches} noches válidas).` : ''}
          ${mostrarFcReposo && fcReposo.length && !bandaFc ? ` FC alta aún no disponible: requiere ≥14 noches válidas (${nochesFcValidas}/14).` : ''}
          ${media7.length ? '' : ' Aún no hay media de 7 días: requiere ≥7 noches válidas y ≥7 previas.'}
        </div>
      </div>`;
    }

    // --- Tabla diaria ---
    const filas = readinessR.slice().reverse().map(r => {
      const c = r.estadoDia || bandaEstado(r.estadoEntrenar);
      const f = fatigaMap.get(fmtISO(r.fecha));
      let fatigaCelda = '<span class="muted">—</span>';
      if (f && f.nivel != null){
        const col = f.cargados <= 1 ? 'verde' : f.cargados <= 3 ? 'ambar' : 'rojo';
        fatigaCelda = `<span class="chip ${col}" title="${f.cargados} de los últimos 7 días con señales de fatiga">${f.cargados}/7d</span>`;
      }
      const vfcBaja = umbrales.baja != null && r.vfc != null && !r.vfcDescartada && r.vfc < umbrales.baja;
      return `<tr>
        <td>${fmtFecha(r.fecha)}</td>
        <td>${r.estadoEntrenar != null ? `<span class="chip ${c || 'gris'}">${r.estadoEntrenar}</span>` : (c ? chipCompuerta(c) : '<span class="muted">—</span>')}</td>
        <td>${escDots(r.sueno, 'buena')}</td>
        <td>${escDots(r.animo, 'buena')}</td>
        <td>${escDots(r.agujetas, 'mala')}${zonaTxt(r.agujetasZona)}</td>
        <td>${escDots(r.dolor, 'mala')}${zonaTxt(r.dolorZona)}</td>
        <td>${escDots(r.estres, 'mala')}</td>
        <td>${fatigaCelda}</td>
        <td>${r.enfermo ? '<span class="chip rojo">sí</span>' : '<span class="muted">no</span>'}</td>
        <td class="num">${r.vfc != null
          ? (vfcBaja ? `<span class="chip ambar" title="Por debajo del umbral nocturno">${fmtNum(r.vfc,0)}</span>` : fmtNum(r.vfc,0))
            + (r.vfcDescartada ? ' <span class="muted">(desc.)</span>' : '')
          : '—'}</td>
        <td class="num">${r.fcReposo != null ? fmtNum(r.fcReposo,0) : '—'}</td>
      </tr>`;
    }).join('');

    return `
      ${htmlCombinada}
      <div class="card" style="margin-bottom:14px"><h3>Estado para entrenar (0–100)</h3>
        <div class="chart-caja">${barras}</div>
        <div class="muted" style="font-size:12px">0–39 rojo · 40–69 ámbar · 70–100 verde.
          Letra sobre la barra = zona de las señales del día: G general · I tren inferior · S tren superior.</div>
      </div>
      ${htmlVfc}
      <div class="card"><h3>Detalle diario</h3>
        <div class="muted" style="font-size:12px;margin-bottom:8px">
          Verde = perfecto, ámbar = atención, rojo = señal fuerte. En sueño y ánimo el 4 es lo mejor;
          en agujetas, dolor y estrés lo mejor es el 1. Fatiga = días con señales en la ventana de 7 días.
        </div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Fecha</th><th>Estado</th><th>Sueño</th><th>Ánimo/energía</th><th>Agujetas</th><th>Dolor</th><th>Estrés</th><th>Fatiga</th><th>Enfermo</th><th class="num">VFC</th><th class="num">FC reposo (ppm)</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </div>`;
  },

  // ================= NUTRICIÓN =================
  /* Orden de lectura pensado para una revisión de cliente:
       1. ¿Va al ritmo pactado?      → estado de la fase + ritmo real vs objetivo
       2. ¿El lazo tiene datos?      → adherencia al pesaje (lo primero accionable)
       3. ¿De dónde sale el peso?    → composición corporal y reparto
       4. ¿Qué le ha dicho la app?   → historial de tarjetas semanales
       5. ¿Afecta al entrenamiento?  → trinquete, refeeds y descargas coordinadas
       6. ¿Dónde está en la temporada? → plan de bloques */
  nutricion(ctx){
    const { datos, desde, hasta } = ctx;
    const nut = datos.nut;
    const N = datos.nutricion;

    if (!nut || !N || !N.presente)
      return tarjetaVacia('Esta copia de seguridad no incluye la capa de nutrición: se hizo con una versión de TrueLift anterior al lazo de nutrición. Pídele al cliente una copia nueva.');
    if (!N.activo && !nut.fase && !nut.pesajes.length)
      return tarjetaVacia('El cliente tiene la capa de nutrición disponible pero no la ha activado (Ajustes → Nutrición en TrueLift). Sin activarla, la app funciona exactamente igual que antes y la fase de dieta la elige él a mano.');

    const F = nut.fase;
    const tipoFase = F ? (NUT_TXT.fase[F.tipo] || F.tipo) : null;

    // Aviso cuando el rango elegido deja fuera parte de la fase.
    const avisoRango = (F && F.inicio && diasEntre(F.inicio, desde) > 0)
      ? `<div class="alerta azul" style="margin-bottom:14px"><span class="tag">Rango</span>
         <span>La fase empezó el <b>${fmtFecha(F.inicio)}</b>, antes del periodo mostrado.
         Cambia el rango a «Todo» para ver la fase completa.</span></div>` : '';

    // ---------- 1. Estado de la dieta ----------
    const asent = nut.asentamiento;
    const calibrando = F && (F.estado === 'SETTLING' || (asent && !asent.asentado));
    const estadoFase = F ? `<span class="chip ${
        F.estado === 'ACTIVE' ? 'verde' : F.estado === 'PAUSED' ? 'rojo'
        : F.estado === 'END_RECOMMENDED' ? 'ambar' : 'gris'
      }">${esc(NUT_TXT.estadoFase[F.estado] || F.estado)}</span>` : '';

    const tarjetaFase = `
      <div class="card"><h3>Fase de dieta</h3>
        ${F ? `
        <div class="big">${esc(tipoFase)} ${estadoFase}</div>
        <div class="kv"><span class="muted">Desde</span><b>${fmtFecha(F.inicio)}${
          nut.diasEnFase != null ? ` · ${fmtNum(nut.diasEnFase / 7, 1)} semanas` : ''}</b></div>
        <div class="kv"><span class="muted">Ritmo objetivo</span><b>${fmtTasa(F.tasaObjetivoPctSemana)} ${chipBandaNut(nut.bandaObjetivo)}</b></div>
        <div class="kv"><span class="muted">Peso objetivo</span><b>${fmtNum(F.pesoObjetivoKg,1)} kg</b></div>
        <div class="kv"><span class="muted">Tope duro del ritmo</span><b>${fmtNum(nut.topeTasa,2)} %/sem${
          nut.topeAmpliadoActivo ? ' <span class="chip ambar">ampliado</span>' : ''}</b></div>
        <div class="kv"><span class="muted">Proteína recomendada</span><b>${fmtNum(F.objetivoProteinaGDia,0)} g/día <span class="muted">(${fmtNum(F.proteinaGPorKg,1)} g/kg sobre peso objetivo)</span></b></div>
        ${F.modoCiclo ? `<div class="kv"><span class="muted">Modo ciclo</span><b>activo · ventana ${nut.ciclo.dias} días${
          nut.ciclo.ciclosMedidos ? ` (${nut.ciclo.ciclosMedidos} ciclos medidos)` : ' (nominal)'}</b></div>` : ''}
        ${F.refeeds ? `<div class="kv"><span class="muted">Refeeds de la fase</span><b>${F.refeeds} de ${NUT.refeedsAntesDeBajarObjetivo}</b></div>` : ''}
        ${nut.pista.length ? pistaBandasHtml(nut.pista, { objetivo: F.tasaObjetivoPctSemana, real: nut.tasaPctSemana }) : ''}
        <div style="margin-top:10px">${barraTope(nut.topeAjuste)}</div>
        ${calibrando && asent ? `<div class="muted" style="font-size:12px;margin-top:8px">
          <b style="color:var(--ambar)">Calibrando</b>: el lazo aún no emite ajustes.
          Días ${asent.diasTranscurridos}/${asent.diasRequeridos} ·
          pesajes ${asent.pesajesContados}/${asent.pesajesRequeridos} ·
          varianza de la pendiente ${asent.varianzaOk ? 'dentro' : 'fuera'} del criterio.
          Primera recomendación posible a partir del ${fmtFecha(asent.fechaMinima)}.
        </div>` : ''}
        ` : `<div class="muted">Sin fase de dieta abierta. ${
          N.fasesCerradas.length ? `El cliente ha cerrado ${N.fasesCerradas.length} fase${N.fasesCerradas.length > 1 ? 's' : ''}.` : ''}</div>`}
      </div>`;

    // ---------- 2. Ritmo real vs objetivo ----------
    const desvio = nut.desvioPctSemana;
    const tarjetaRitmo = `
      <div class="card"><h3>Ritmo real</h3>
        <div class="big" style="color:${NUT_COLOR[nut.bandaReal] || 'var(--texto)'}">${fmtTasa(nut.tasaPctSemana)}</div>
        ${nut.bandaReal ? `<div>${chipBandaNut(nut.bandaReal)}</div>` : ''}
        ${desvio != null ? `<div class="kv" style="margin-top:6px"><span class="muted">Desvío del objetivo</span><b>${
          nut.dentroBandaMuerta
            ? `<span class="chip verde">en banda muerta</span>`
            : `<span class="chip ambar">${fmtTasa(desvio)}</span>`}</b></div>` : ''}
        <div class="kv"><span class="muted">Peso tendencia</span><b>${fmtNum(nut.tendenciaKg,2)} kg</b></div>
        <div class="kv"><span class="muted">Último pesaje</span><b>${
          nut.ultimoPesaje ? `${fmtNum(nut.ultimoPesaje.pesoKg,1)} kg · ${fmtFecha(nut.ultimoPesaje.fecha)}` : '—'}</b></div>
        ${nut.imc != null ? `<div class="kv"><span class="muted">IMC</span><b>${fmtNum(nut.imc,1)}</b></div>` : ''}
        <div class="muted" style="font-size:12px;margin-top:8px">
          Tendencia y ritmo salen del filtro de la app sobre los pesajes diarios, no del pesaje del día.
          La cifra es la del ${nut.fechaTendencia ? fmtFecha(nut.fechaTendencia) : '—'}: la serie no se extrapola más allá del último pesaje.
          Dentro de la banda muerta (±${fmtNum(NUT.bandaMuertaPctSemana,1)} pp) el lazo no toca nada.
        </div>
      </div>`;

    // ---------- 3. Adherencia al pesaje ----------
    const ad = Nutricion.adherenciaPesaje(nut.pesajes, desde, hasta);
    const colAd = ad.porSemana >= 5 ? 'verde' : ad.porSemana >= 3 ? 'ambar' : 'rojo';
    const tarjetaPesaje = `
      <div class="card"><h3>Adherencia al pesaje</h3>
        <div class="big">${ad.hechos} <span class="muted" style="font-size:15px;font-weight:400">de ${ad.dias} días</span></div>
        <div><span class="chip ${colAd}">${fmtNum(ad.porSemana,1)} pesajes/semana</span></div>
        <div class="kv" style="margin-top:8px"><span class="muted">Hueco más largo</span><b>${
          ad.huecoMax > 1 ? `${ad.huecoMax} días${ad.huecoDesde ? ` (desde ${fmtFechaCorta(ad.huecoDesde)})` : ''}` : 'sin huecos'}</b></div>
        <div class="kv"><span class="muted">Sin pesarse</span><b>${
          nut.diasSinPesarse == null ? '—'
          : nut.diasSinPesarse >= NUT.diasSinPesajeOfrecerPausa ? `<span class="chip rojo">${nut.diasSinPesarse} días</span>`
          : nut.diasSinPesarse >= NUT.diasSinPesajeAviso ? `<span class="chip ambar">${nut.diasSinPesarse} días</span>`
          : `${nut.diasSinPesarse} día${nut.diasSinPesarse === 1 ? '' : 's'}`}</b></div>
        <div class="muted" style="font-size:12px;margin-top:8px">
          Es lo primero que se puede accionar: sin pesajes el lazo no corrige nada y todo lo demás
          de esta pantalla envejece. A partir de ${NUT.diasSinPesajeAviso} días la app avisa;
          a partir de ${NUT.diasSinPesajeOfrecerPausa} ofrece pausar la fase.
        </div>
      </div>`;

    // ---------- Gráfica de peso ----------
    const ptsTendencia = serieNutEnRango(nut, 'tendenciaKg', desde, hasta);
    const ptsPesaje = nut.pesajes.filter(p => enRango(p.fecha, desde, hasta))
      .map(p => ({ x: p.fecha, y: p.pesoKg, c: p.enmascarado ? '#e0a63c' : '#6fb3d9' }));
    const hayEnmascarado = ptsPesaje.some(p => p.c === '#e0a63c');
    const graficaPeso = (ptsTendencia.length || ptsPesaje.length) ? `
      <div class="card" style="grid-column:1/-1"><h3>Peso y tendencia</h3>
        <div class="chart-caja">${Charts.lineas({
          series: [
            { nombre: 'Pesajes', color: '#6fb3d9', puntos: ptsPesaje, soloPuntos: true, unidad: 'kg' },
            { nombre: 'Tendencia', color: '#a8d020', puntos: ptsTendencia, sinPuntos: true, grosor: 2.6, unidad: 'kg' },
          ],
          lineaBase: (F && F.pesoObjetivoKg >= NUT.pesoMinKg)
            ? { y: F.pesoObjetivoKg, label: `objetivo ${fmtNum(F.pesoObjetivoKg,1)} kg`, color: '#94a1b0' } : null,
          h: 260,
        })}</div>
        <div class="muted" style="font-size:12px">
          Puntos: pesajes tal cual los introdujo el cliente. Línea: peso-tendencia del filtro, que es
          lo que gobierna el lazo${hayEnmascarado ? ' · <span style="color:#e0a63c">ámbar</span> = pesaje en ventana de refeed o vuelta de pausa (cuenta, pero pesa menos en la pendiente)' : ''}.
        </div>
      </div>` : '';

    // ---------- Gráfica de ritmo ----------
    const ptsRitmo = serieNutEnRango(nut, 'tasaPctSemana', desde, hasta);
    const obj = F ? F.tasaObjetivoPctSemana : null;
    const graficaRitmo = ptsRitmo.length ? `
      <div class="card" style="grid-column:1/-1"><h3>Ritmo semanal frente al objetivo</h3>
        <div class="chart-caja">${Charts.lineas({
          series: [{ nombre: 'Ritmo real', color: '#e0985c', puntos: ptsRitmo, sinPuntos: true, grosor: 2.4, unidad: '%/sem' }],
          banda: obj != null ? { min: obj - NUT.bandaMuertaPctSemana, max: obj + NUT.bandaMuertaPctSemana } : null,
          lineaBase: obj != null ? { y: obj, label: `objetivo ${fmtTasa(obj)}`, color: '#94a1b0' } : null,
          h: 220,
        })}</div>
        <div class="muted" style="font-size:12px">
          Franja verde: banda muerta de ±${fmtNum(NUT.bandaMuertaPctSemana,1)} pp alrededor del objetivo.
          Dentro de ella la app emite «mantener»; fuera, corrige las calorías el día de evaluación semanal.
          Las primeras semanas de fase el ritmo es ruido de agua y glucógeno: por eso existe el asentamiento.
        </div>
      </div>` : '';

    // ---------- 4. Composición corporal ----------
    const composicion = this._nutComposicion(nut, ctx);

    // ---------- 5. Tarjetas semanales ----------
    const tarjetas = this._nutTarjetas(nut, ctx);

    // ---------- 6. Efecto sobre el entrenamiento ----------
    const entrenamiento = this._nutEntrenamiento(nut, ctx);

    // ---------- 7. Plan de temporada ----------
    const plan = this._nutPlan(nut);

    // ---------- 8. Biblioteca de alimentos ----------
    const biblioteca = N.biblioteca.length ? `
      <div class="card"><h3>Biblioteca de alimentos del cliente</h3>
        <div class="muted" style="font-size:12px;margin-bottom:8px">
          TrueLift no registra comidas: esta lista es solo el material con el que la app convierte
          un ajuste en kcal en gramos concretos. Si está vacía o es muy corta, las prescripciones
          se apoyan en alimentos básicos genéricos y pierden precisión.
        </div>
        <table><thead><tr><th>Alimento</th><th class="num">kcal/100 g</th><th>Macro</th><th>Referencia</th><th class="num">Paso</th></tr></thead>
        <tbody>${N.biblioteca.map(a => `<tr>
          <td>${esc(a.nombre)}</td>
          <td class="num">${fmtNum(a.kcalPor100g,0)}</td>
          <td>${esc(NUT_TXT.macro[a.macro] || a.macro)}</td>
          <td>${esc(NUT_TXT.referencia[a.estadoReferencia] || a.estadoReferencia)}</td>
          <td class="num">${a.pasoGramos != null ? a.pasoGramos + ' g' : '—'}</td>
        </tr>`).join('')}</tbody></table>
      </div>` : `
      <div class="card"><h3>Biblioteca de alimentos del cliente</h3>
        <div class="muted">Vacía. La app prescribe con alimentos básicos genéricos; dar de alta
        6–8 alimentos reales del cliente mejora bastante la utilidad de las tarjetas semanales.</div>
      </div>`;

    const cabecera = `
      <div class="muted" style="margin-bottom:12px">Periodo: <b style="color:var(--texto)">${fmtFecha(desde)} — ${fmtFecha(hasta)}</b>
      · ${nut.pesajes.length} pesajes en total · ${N.recomendaciones.length} tarjetas semanales
      · ${N.medicionesGrasa.length} estimaciones de % graso</div>`;

    return cabecera + avisoRango +
      `<div class="grid cols3">${tarjetaFase}${tarjetaRitmo}${tarjetaPesaje}${graficaPeso}${graficaRitmo}</div>` +
      composicion + tarjetas +
      `<div class="grid cols2" style="margin-top:14px">${entrenamiento}${plan}</div>` +
      `<div class="grid cols2" style="margin-top:14px">${biblioteca}${this._nutVentanas(nut)}</div>`;
  },

  /* Composición corporal: curva teórica de % graso, mediciones y reparto. */
  _nutComposicion(nut, ctx){
    const { desde, hasta } = ctx;
    const N = nut.nut;
    if (!N.medicionesGrasa.length)
      return `<div class="card" style="margin-top:14px"><h3>Composición corporal</h3>
        <div class="muted">El cliente no ha estimado su % graso. Sin ese punto de partida la app no puede
        decir si el peso que se mueve es grasa o masa magra, ni afinar las bandas de ritmo: se comporta
        como si estuviera en el tramo medio. Merece la pena pedírselo (TrueLift → Nutrición → % graso).</div></div>`;

    const g = nut.grasaVigente;
    const curva = nut.curvaGrasa;
    const ptsCurva = curva ? curva.puntos.filter(p => enRango(p.fecha, desde, hasta))
      .map(p => ({ x: p.fecha, y: p.porcentajePct })) : [];
    const ptsMed = N.medicionesGrasa.filter(m => enRango(m.fecha, desde, hasta))
      .map(m => ({ x: m.fecha, y: m.porcentajePct }));

    const grafica = (ptsCurva.length || ptsMed.length) ? `
      <div class="chart-caja">${Charts.lineas({
        series: [
          { nombre: 'Curva teórica', color: '#d06e9a', puntos: ptsCurva, sinPuntos: true, grosor: 2.2, unidad: '%' },
          { nombre: 'Estimaciones', color: '#e8ecf1', puntos: ptsMed, soloPuntos: true, unidad: '%' },
        ],
        lineaBase: nut.sueloPct != null
          ? { y: nut.sueloPct, label: `suelo fisiológico ${fmtNum(nut.sueloPct,0)} %`, color: '#e05c5c' } : null,
        h: 220,
      })}</div>
      <div class="muted" style="font-size:12px">
        La curva reparte cada kilo que se mueve entre grasa y masa magra con la proporción esperable
        para este % graso y este ritmo; cada estimación nueva la recalibra, y el salto entre la línea
        y el punto es información, no un error. Todo es estimación:
        ±${NUT.grasaMargenPpMin}–${NUT.grasaMargenPpMax} pp de margen declarado.
        ${curva && curva.algunRecorteAlSuelo ? ' <b style="color:var(--ambar)">La proyección toca el suelo fisiológico: a este ritmo el objetivo no es realista.</b>' : ''}
      </div>` : '';

    const cifras = `
      <div class="inf-2col" style="margin-top:10px">
        <div>
          <div class="kv"><span class="muted">% graso vigente</span><b>${fmtNum(g.porcentajePct,1)} %
            ${nut.grasaCaducada ? `<span class="chip ambar" title="Pasados ${NUT.grasaAvisoAmbarDias} días deja de habilitar el tope ampliado de déficit">caducado</span>` : ''}</b></div>
          <div class="kv"><span class="muted">Medido</span><b>${fmtFecha(g.fecha)}${
            nut.diasDesdeMedicion != null ? ` · hace ${nut.diasDesdeMedicion} días` : ''} · ${esc(NUT_TXT.metodoGrasa[g.metodo] || g.metodo)}</b></div>
          <div class="kv"><span class="muted">Masa grasa</span><b>${fmtNum(g.grasaKg,1)} kg</b></div>
          <div class="kv"><span class="muted">Masa magra estimada</span><b>${fmtNum(g.magraKg,1)} kg</b></div>
        </div>
        <div>
          ${nut.grasaInicial && nut.grasaInicial !== g ? `
          <div class="kv"><span class="muted">Punto de partida</span><b>${fmtNum(nut.grasaInicial.porcentajePct,1)} % · ${fmtFecha(nut.grasaInicial.fecha)}</b></div>
          <div class="kv"><span class="muted">Cambio de grasa</span><b>${fmtNum(g.grasaKg - nut.grasaInicial.grasaKg,1)} kg</b></div>
          <div class="kv"><span class="muted">Cambio de masa magra</span><b>${fmtNum(g.magraKg - nut.grasaInicial.magraKg,1)} kg</b></div>` : ''}
          <div class="kv"><span class="muted">Sexo / experiencia</span><b>${
            esc(NUT_TXT.sexo[nut.perfil?.sexo] || '—')} · ${
            esc(NUT_TXT.experiencia[nut.perfil?.experienciaFuerza] || 'sin declarar')}</b></div>
          <div class="kv"><span class="muted">Altura</span><b>${nut.perfil?.alturaCm ? fmtNum(nut.perfil.alturaCm,0) + ' cm' : '—'}</b></div>
        </div>
      </div>`;

    // Reparto del último tramo: la pregunta de "¿esto sale de la grasa?"
    const r = nut.reparto;
    let reparto = '';
    if (r && r.banda){
      const pObs = r.fraccionGrasaObservada * 100, pEsp = r.fraccionGrasaEsperada * 100;
      const consejo = r.banda === 'verde' ? 'Reparto consistente con el ritmo. Sin cambios.'
        : r.banda === 'ambar' ? 'Proteína hacia el extremo alto del rango, revisar sueño y volumen de entrenamiento, y valorar bajar un escalón el ritmo.'
        : 'El reparto se aleja bastante de lo esperable a este ritmo: conviene bajar el ritmo, subir proteína y revisar la carga de entrenamiento.';
      reparto = `<div class="alerta ${r.banda === 'verde' ? 'azul' : r.banda}" style="margin-top:12px">
        <span class="tag">Reparto</span>
        <span><b>${fmtNum(pObs,0)} % del peso movido fue grasa</b>, frente al ${fmtNum(pEsp,0)} % esperable
        ${chipBandaNut(r.banda)}. Tramo de ${r.dias} días: ${fmtNum(r.deltaPesoKg,1)} kg de peso =
        ${fmtNum(r.deltaGrasaKg,1)} kg de grasa y ${fmtNum(r.deltaMagraKg,1)} kg de masa magra.
        ${esc(consejo)}
        <br><span class="muted">A corto plazo la masa magra incluye agua y glucógeno, no solo músculo.</span></span></div>`;
    } else if (r){
      reparto = `<div class="alerta azul" style="margin-top:12px"><span class="tag">Reparto</span>
        <span>Tramo de ${r.dias} días: ${fmtNum(r.deltaPesoKg,1)} kg de peso = ${fmtNum(r.deltaGrasaKg,1)} kg de grasa
        y ${fmtNum(r.deltaMagraKg,1)} kg de masa magra. <b>Sin valoración</b>: ${esc(Reparto.MOTIVOS[r.motivo] || '')}.</span></div>`;
    } else {
      reparto = `<div class="muted" style="margin-top:12px;font-size:13px">Con una sola estimación no hay tramo que valorar.
        La app pide re-estimar cada ${NUT.grasaAvisoDias} días.</div>`;
    }

    const tabla = `<table style="margin-top:12px"><thead><tr>
        <th>Fecha</th><th class="num">% graso</th><th>Método</th><th class="num">Peso ancla</th>
        <th class="num">Grasa</th><th class="num">Masa magra</th></tr></thead><tbody>
      ${[...N.medicionesGrasa].reverse().map(m => `<tr>
        <td>${fmtFecha(m.fecha)}</td>
        <td class="num">${fmtNum(m.porcentajePct,1)} %</td>
        <td>${esc(NUT_TXT.metodoGrasa[m.metodo] || m.metodo)}</td>
        <td class="num">${fmtNum(m.pesoAnclaKg,1)} kg</td>
        <td class="num">${fmtNum(m.grasaKg,1)} kg</td>
        <td class="num">${fmtNum(m.magraKg,1)} kg</td>
      </tr>`).join('')}</tbody></table>`;

    return `<div class="card" style="margin-top:14px"><h3>Composición corporal</h3>
      ${grafica}${cifras}${reparto}${tabla}</div>`;
  },

  /* Historial de tarjetas semanales: es lo que la app le ha dicho al cliente. */
  _nutTarjetas(nut, ctx){
    const recs = nut.nut.recomendaciones.filter(r => enRango(r.fecha, ctx.desde, ctx.hasta));
    if (!recs.length)
      return `<div class="card" style="margin-top:14px"><h3>Tarjetas semanales del lazo</h3>
        <div class="muted">Ninguna en el periodo.${nut.nut.recomendaciones.length
          ? ` El cliente tiene ${nut.nut.recomendaciones.length} en total: cambia el rango para verlas.`
          : ' El lazo aún no ha emitido ninguna (fase en calibración o recién abierta).'}</div></div>`;

    const acumPorFecha = new Map(acumuladoNut(nut).map(p => [fmtISO(p.x), p.y]));
    const colTipo = { ADJUST: 'azul', HOLD: 'gris', REFEED: 'ambar', LOWER_TARGET: 'ambar', END_PHASE: 'rojo' };

    const filas = [...recs].reverse().map(r => {
      // El signo de los gramos es la instrucción: negativo = recortar.
      const opciones = r.opciones.map(o => {
        const lineas = o.componentes.length ? o.componentes : [o];
        return lineas.map(l =>
          `${l.gramos < 0 ? '−' : '+'}${fmtNum(Math.abs(l.gramos),0)} g ${esc(l.nombre)}`).join(' + ');
      }).join(' &nbsp;<span class="muted">o</span>&nbsp; ');
      const pendiente = r.tipo === 'LOWER_TARGET' && !r.objetivoAplicado;
      const acum = acumPorFecha.get(fmtISO(r.fecha));
      return `<tr>
        <td>${fmtFecha(r.fecha)}</td>
        <td><span class="chip ${colTipo[r.tipo] || 'gris'}">${esc(NUT_TXT.recomendacion[r.tipo] || r.tipo)}</span>
          ${r.porRendimiento ? ' <span class="chip ambar" title="Disparada por caída de rendimiento, no por el peso">por rendimiento</span>' : ''}
          ${pendiente ? ' <span class="chip rojo" title="El cliente aún no ha aceptado la propuesta">sin aceptar</span>' : ''}</td>
        <td class="num">${fmtTasa(r.tasaRealPctSemana)}</td>
        <td class="num">${r.errorKcalDia != null ? fmtKcal(r.errorKcalDia) : '—'}</td>
        <td class="num"><b>${r.ajusteKcalDia ? fmtKcal(r.ajusteKcalDia) : '—'}</b></td>
        <td class="num">${acum != null ? fmtKcal(acum) : '—'}</td>
        <td>${r.nuevaTasaObjetivoPctSemana != null ? `nuevo objetivo ${fmtTasa(r.nuevaTasaObjetivoPctSemana)}<br>` : ''}
          ${opciones ? `<span class="muted" style="font-size:12px">${opciones}</span>` : ''}
          ${r.pasosExtraDia ? `<div class="muted" style="font-size:12px">alternativa: ${fmtNum(r.pasosExtraDia,0)} pasos/día</div>` : ''}
          ${r.limitadaPorBiblioteca ? '<div class="muted" style="font-size:12px">limitada por la biblioteca de alimentos</div>' : ''}
          ${r.usaBasicos ? '<div class="muted" style="font-size:12px">apoyada en alimentos básicos</div>' : ''}</td>
        <td class="num">${r.proteinaObjetivoGDia != null ? fmtNum(r.proteinaObjetivoGDia,0) + ' g' : '—'}${
          r.proteinaRecalculada ? ' <span class="chip azul" title="Recalculada porque la tendencia se alejó más de un 3 % del último cálculo">rev.</span>' : ''}</td>
        <td>${r.accionEntrenamiento
          ? `<span class="chip ambar">${esc(NUT_TXT.accion[r.accionEntrenamiento] || r.accionEntrenamiento)}</span>` : ''}</td>
      </tr>`;
    }).join('');

    return `<div class="card" style="margin-top:14px"><h3>Tarjetas semanales del lazo</h3>
      <div class="muted" style="font-size:12px;margin-bottom:8px">
        Una tarjeta por semana como máximo, el día de evaluación de la fase. «Error» es la diferencia
        energética que explica el desvío de ritmo; «Ajuste» es lo que la app aplicó tras ganancia,
        clamp de ±${fmtNum(NUT.maxPasoKcal,0)} kcal y el tope acumulado. Los refeeds son un pulso fijo
        de ${fmtNum(NUT.refeedKcal,0)} kcal y NO suman al acumulado.
      </div>
      <div style="overflow-x:auto"><table><thead><tr>
        <th>Fecha</th><th>Tipo</th><th class="num">Ritmo real</th><th class="num">Error</th>
        <th class="num">Ajuste</th><th class="num">Acumulado</th><th>Prescripción</th>
        <th class="num">Proteína</th><th>Entrenamiento</th></tr></thead>
      <tbody>${filas}</tbody></table></div></div>`;
  },

  /* Puente nutrición → entrenamiento: lo que solo se ve cruzando ambos mundos. */
  _nutEntrenamiento(nut, ctx){
    const t = nut.trinquete;
    if (!t)
      return `<div class="card"><h3>Efecto sobre el entrenamiento</h3>
        <div class="muted">Sin fase abierta: el detector de rendimiento y el trinquete de volumen
        pertenecen a la fase y se reinician con cada una.</div></div>`;

    const topes = Object.entries(t.topesSeriesPorLinea || {});
    const nivel = t.trinqueteNivel || 0;
    const escalonTxt = ['sin respuesta todavía', 'refeed o bajada de objetivo aplicados',
                        `recorte de volumen del ${fmtNum(NUT.trinqueteCorte1Pct,0)} %`,
                        `segundo recorte, del ${fmtNum(NUT.trinqueteCorte2Pct,0)} % adicional`][nutClamp(t.escalon || 0, 0, 3)];

    return `<div class="card"><h3>Efecto sobre el entrenamiento</h3>
      <div class="kv"><span class="muted">Trinquete de volumen</span><b>${
        nivel === 0 ? '<span class="chip verde">sin recortes</span>'
        : `<span class="chip ${nivel >= 2 ? 'rojo' : 'ambar'}">nivel ${nivel}</span>`}</b></div>
      <div class="kv"><span class="muted">Escalón de respuesta</span><b>${esc(escalonTxt)}</b></div>
      <div class="kv"><span class="muted">Último disparo del detector</span><b>${
        t.ultimoDisparo ? fmtFecha(t.ultimoDisparo) : 'nunca'}</b></div>
      <div class="kv"><span class="muted">Caída agregada medida</span><b>${
        t.ultimaCaidaAgregadaPct != null ? fmtNum(t.ultimaCaidaAgregadaPct,1) + ' %' : '—'}</b></div>
      <div class="kv"><span class="muted">Levantamientos vigilados</span><b>${
        t.vigilados.length ? esc(t.vigilados.join(', ')) : 'selección automática'}</b></div>
      ${topes.length ? `<div style="margin-top:8px">
        <div class="muted" style="font-size:12px;margin-bottom:4px">Topes de series aplicados por el trinquete:</div>
        <table><thead><tr><th>Línea de la rutina</th><th class="num">Tope de series</th></tr></thead>
        <tbody>${topes.map(([k,v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>
      </div>` : ''}
      <div class="muted" style="font-size:12px;margin-top:8px">
        ${nivel > 0
          ? '<b style="color:var(--ambar)">La capa de nutrición ha recortado volumen de entrenamiento.</b> Si vas a tocar la rutina, hazlo sabiendo que estos topes siguen vigentes hasta que se cierre la fase: el trinquete no devuelve series solo.'
          : 'El detector vigila la caída de rendimiento en déficit y, si dispara, primero prueba un refeed o baja el objetivo antes de tocar el volumen. Nunca sube series por su cuenta.'}
      </div>
    </div>`;
  },

  /* Refeeds y vueltas de pausa: explican mesetas que si no parecen estancamiento. */
  _nutVentanas(nut){
    const v = Nutricion.ventanas(nut.nut);
    if (!v.length)
      return `<div class="card"><h3>Refeeds y pausas</h3>
        <div class="muted">Ninguno registrado. Son los eventos que enmascaran el peso durante unos días:
        cuando los haya, aparecerán aquí para explicar mesetas que si no parecen estancamiento.</div></div>`;
    return `<div class="card"><h3>Refeeds y pausas</h3>
      <table><thead><tr><th>Evento</th><th>Inicio</th><th>Duración</th><th>Peso enmascarado hasta</th></tr></thead>
      <tbody>${[...v].reverse().map(x => `<tr>
        <td>${x.tipo === 'refeed'
          ? `<span class="chip ambar">Refeed</span>` : `<span class="chip azul">Vuelta de pausa</span>`}</td>
        <td>${fmtFecha(x.inicio)}</td>
        <td>${x.tipo === 'refeed' ? `${x.dias} días` : '—'}</td>
        <td>${fmtFecha(x.finEnmascarado)}</td></tr>`).join('')}</tbody></table>
      <div class="muted" style="font-size:12px;margin-top:8px">
        Durante estos días el peso sube por agua y glucógeno. Los pesajes se conservan pero pesan menos
        en la pendiente, y la evaluación semanal se pospone si cae dentro: nunca se corrige sobre agua.
      </div></div>`;
  },

  /* Plan de temporada: dónde está el cliente dentro del ciclo largo. */
  _nutPlan(nut){
    const plan = nut.plan;
    if (!plan || !plan.bloques.length)
      return `<div class="card"><h3>Plan de temporada</h3>
        <div class="muted">Sin plan. El cliente gestiona las fases una a una. Un plan encadena bloques
        de volumen, puente y definición y propone el cambio de fase cuando toca.</div></div>`;

    const estadoTxt = {
      enCurso: '<span class="chip verde">en curso</span>',
      transicionPendiente: '<span class="chip ambar">cambio de bloque pendiente de confirmar</span>',
      desfasado: '<span class="chip rojo">desfasado: la propuesta lleva días sin aceptarse</span>',
      terminado: '<span class="chip gris">terminado</span>',
      sinPlan: '',
    }[nut.planEstado] || '';
    const bloqueHoy = nut.bloqueActual
      ? `Hoy: <b>${esc(NUT_TXT.bloque[nut.bloqueActual.tipo] || nut.bloqueActual.tipo)}</b>,
         hasta el ${fmtFecha(nut.bloqueActual.fin)}.`
      : 'Hoy no cae dentro de ningún bloque del plan.';

    const proy = nut.proyeccionPlan;
    const porId = new Map((proy?.bloques || []).map(b => [b.bloque.id, b]));

    const filas = plan.bloques.map(b => {
      const p = porId.get(b.id);
      const actual = nut.bloqueActual && nut.bloqueActual.id === b.id;
      const colDur = PlanTemporada.colorDuracion(b);
      return `<tr${actual ? ' style="background:var(--verde-suave)"' : ''}>
        <td>${actual ? '<span class="punto verde" title="Bloque actual"></span> ' : ''}<b>${esc(NUT_TXT.bloque[b.tipo] || b.tipo)}</b></td>
        <td>${fmtFechaCorta(b.inicio)} → ${fmtFechaCorta(b.fin)}</td>
        <td class="num"><span class="chip ${claseBanda(colDur)}">${fmtNum(b.semanas,0)} sem</span></td>
        <td class="num">${b.tasaPctSemana ? fmtTasa(b.tasaPctSemana) : '0'}${
          p ? ` <span class="punto ${claseBanda(p.colores.tasa)}" title="Ritmo: ${esc(NUT_TXT.banda[p.colores.tasa] || p.colores.tasa)}"></span>` : ''}</td>
        <td class="num">${p ? `${fmtNum(p.pesoInicioKg,1)} → ${fmtNum(p.pesoFinKg,1)} kg` : '—'}</td>
        <td class="num">${p ? `<span class="chip ${claseBanda(p.colores.grasaFinal)}">${fmtNum(p.grasaFinPct,1)} %</span>` : '—'}</td>
      </tr>`;
    }).join('');

    return `<div class="card"><h3>Plan de temporada</h3>
      <div style="margin-bottom:8px">${estadoTxt} <span class="muted" style="font-size:13px">${bloqueHoy}</span></div>
      <div style="overflow-x:auto"><table><thead><tr>
        <th>Bloque</th><th>Fechas</th><th class="num">Duración</th><th class="num">Ritmo</th>
        <th class="num">Peso proyectado</th><th class="num">% graso al final</th></tr></thead>
      <tbody>${filas}</tbody></table></div>
      <div class="muted" style="font-size:12px;margin-top:8px">
        Proyección encadenada: el final de un bloque es el punto de partida del siguiente, con el
        reparto grasa/magra esperable en cada tramo. Los colores marcan duración, ritmo y % graso
        final fuera de lo recomendable. ${proy ? '' : 'Sin peso o % graso vigente no hay proyección.'}
        ${nut.planEstado === 'transicionPendiente' || nut.planEstado === 'desfasado'
          ? '<b style="color:var(--ambar)"> El plan propone cambiar de bloque y el cliente aún no lo ha confirmado en la app.</b>' : ''}
      </div></div>`;
  },

  /* Alertas de nutrición, en el mismo formato que las de entrenamiento para que
     entren en el triaje de la Cartera sin tocar nada más. */
  _alertasNutricion(ctx, add){
    const nut = ctx.datos.nut;
    if (!nut || !nut.nut.presente) return;
    const N = nut.nut, F = nut.fase;

    // 1. Sin pesajes: el lazo está ciego y todo lo demás envejece.
    if (F && F.estado !== 'CLOSED' && nut.diasSinPesarse != null){
      if (nut.diasSinPesarse >= NUT.diasSinPesajeOfrecerPausa)
        add('rojo', 'Dieta', `<b>${nut.diasSinPesarse} días sin pesarse.</b> El lazo de nutrición está parado: no corrige calorías ni valora el ritmo. La app ya le ofrece pausar la fase.`);
      else if (nut.diasSinPesarse >= NUT.diasSinPesajeAviso)
        add('ambar', 'Dieta', `${nut.diasSinPesarse} días sin pesarse: la evaluación semanal se pospone hasta que vuelva a haber datos.`);
    }

    // 2. Fase pausada.
    if (F && F.estado === 'PAUSED')
      add('ambar', 'Dieta', `Fase de <b>${esc(NUT_TXT.fase[F.tipo] || F.tipo)}</b> pausada. Al reanudar, la app exige ${NUT.pesajesMinTrasPausa} pesajes antes de volver a evaluar.`);

    // 3. Ritmo real en banda ámbar o roja: va más rápido de lo que aconseja su composición.
    if (nut.bandaReal === 'rojo')
      add('rojo', 'Ritmo', `Ritmo real <b>${fmtTasa(nut.tasaPctSemana)}</b> (objetivo ${fmtTasa(F ? F.tasaObjetivoPctSemana : null)}): banda roja para su % graso. A este ritmo el reparto empeora.`);
    else if (nut.bandaReal === 'ambar')
      add('ambar', 'Ritmo', `Ritmo real <b>${fmtTasa(nut.tasaPctSemana)}</b> en banda ámbar (objetivo ${fmtTasa(F ? F.tasaObjetivoPctSemana : null)}).`);

    // 4. Reparto: la pregunta de si el peso sale de la grasa.
    const r = nut.reparto;
    if (r && r.banda === 'rojo')
      add('rojo', 'Reparto', `Solo el <b>${fmtNum(r.fraccionGrasaObservada * 100,0)} %</b> del peso movido fue grasa (esperable ${fmtNum(r.fraccionGrasaEsperada * 100,0)} %) en los últimos ${r.dias} días. Bajar ritmo, subir proteína y revisar carga.`);
    else if (r && r.banda === 'ambar')
      add('ambar', 'Reparto', `Reparto grasa/masa magra por debajo de lo esperable (${fmtNum(r.fraccionGrasaObservada * 100,0)} % frente a ${fmtNum(r.fraccionGrasaEsperada * 100,0)} %) en los últimos ${r.dias} días.`);

    // 5. La dieta ha recortado volumen de entrenamiento.
    if (nut.trinquete && nut.trinquete.trinqueteNivel > 0)
      add('ambar', 'Dieta y volumen', `El trinquete de la capa de nutrición ha recortado series (<b>nivel ${nut.trinquete.trinqueteNivel}</b>)${
        nut.trinquete.ultimoDisparo ? ` desde ${fmtFecha(nut.trinquete.ultimoDisparo)}` : ''}. Tenlo en cuenta antes de tocar la rutina.`);

    // 6. Fin de fase recomendado o tope de ajuste agotado.
    if (F && F.estado === 'END_RECOMMENDED')
      add('ambar', 'Fin de fase', `La app recomienda cerrar la fase de ${esc(NUT_TXT.fase[F.tipo] || F.tipo)}. Toca decidir la siguiente etapa.`);
    else if (nut.topeAjuste && nut.topeAjuste.agotado)
      add('ambar', 'Fin de fase', `Tope de ajuste acumulado agotado (${fmtNum(nut.topeAjuste.topeKcal,0)} kcal/día). La próxima corrección del mismo signo cerrará la fase.`);

    // 7. Propuesta de bajar objetivo sin aceptar.
    const ult = Nutricion.ultimaRecomendacion(N);
    if (ult && ult.tipo === 'LOWER_TARGET' && !ult.objetivoAplicado)
      add('azul', 'Sin aceptar', `Propuesta de bajar el objetivo a ${fmtTasa(ult.nuevaTasaObjetivoPctSemana)} del ${fmtFecha(ult.fecha)}: el cliente todavía no la ha aceptado en la app.`);

    // 8. % graso caducado: sin él, el tope ampliado se cae y el reparto no se valora.
    if (F && F.estado !== 'CLOSED' && N.medicionesGrasa.length && nut.grasaCaducada)
      add('ambar', '% graso', `Última estimación de % graso hace ${nut.diasDesdeMedicion} días. Caducada para los guardarraíles: conviene pedir una nueva.`);
    else if (F && F.estado !== 'CLOSED' && !N.medicionesGrasa.length)
      add('azul', '% graso', 'Sin ninguna estimación de % graso: la app usa el tramo medio por defecto y no puede valorar el reparto grasa/masa magra.');

    // 9. Refeed reciente: explica una meseta que si no parece estancamiento.
    const refeedReciente = [...N.refeeds].reverse().find(x => diasEntre(x.inicio, ctx.hasta) <= 14 && diasEntre(x.inicio, ctx.hasta) >= 0);
    if (refeedReciente)
      add('azul', 'Refeed', `Refeed de ${refeedReciente.dias} días desde el ${fmtFecha(refeedReciente.inicio)}: el peso de esos días y los ${NUT.maskExtraDays} siguientes está enmascarado.`);

    // 10. Plan de temporada con transición sin confirmar.
    if (nut.planEstado === 'desfasado')
      add('ambar', 'Plan', 'El plan de temporada propuso cambiar de bloque hace más de una semana y sigue sin confirmarse. O se acepta o conviene replanificar.');
  },

  // ================= INFORME (impresión) =================
  informe(ctx){
    const { datos, perfil, fuerzaR, cardioR, readinessR, desde, hasta } = ctx;
    const P = perfil;
    const hoy = new Date();

    const cab = `
      <div class="inf-cabecera">
        <img src="media/banner.png" alt="TrueLift" class="inf-banner">
        <div class="inf-titulo">
          <h1>Informe de entrenamiento</h1>
          <div><b>${esc(ctx.nombreCliente)}</b> · ${fmtFecha(desde)} — ${fmtFecha(hasta)}</div>
          <div class="muted">Generado el ${fmtFecha(hoy)} con TrueLift Coach</div>
        </div>
      </div>`;

    // Ficha + adherencia
    const ad = Metricas.adherencia(fuerzaR, desde, hasta, P.diasSemana);
    const diasFase = P.faseInicio ? diasEntre(P.faseInicio, hoy) : null;
    const ficha = `
      <div class="card"><h3>Resumen</h3>
        <div class="inf-2col">
          <div>
            <div class="kv"><span class="muted">Sexo / peso</span><b>${esc(P.sexo ?? '—')} · ${fmtNum(P.pesoCorporal,1)} ${esc(P.unidadPeso)}</b></div>
            <div class="kv"><span class="muted">Fase</span><b>${esc(P.fasePeso ?? '—')}${diasFase != null ? ` · día ${diasFase}` : ''}</b></div>
            <div class="kv"><span class="muted">Sistema</span><b>${esc(P.sistema ?? '—')} · ${P.diasSemana ?? '—'} días/sem</b></div>
            <div class="kv"><span class="muted">Descarga</span><b>${P.modoDescarga ? 'sí' : 'no'}</b></div>
          </div>
          <div>
            <div class="kv"><span class="muted">Sesiones de fuerza</span><b>${ad.hechas}${ad.esperadas != null ? ` / ${ad.esperadas} (${ad.pct}%)` : ''}</b></div>
            <div class="kv"><span class="muted">Sesiones de cardio</span><b>${cardioR.length}</b></div>
            <div class="kv"><span class="muted">Cuestionarios readiness</span><b>${readinessR.length}</b></div>
          </div>
        </div>
      </div>`;

    const alertas = this._alertas(ctx);
    const htmlAlertas = `<div class="card"><h3>Alertas</h3>
      ${alertas.length ? alertas.map(a => a.html).join('') : '<div class="muted">Sin alertas en el periodo.</div>'}</div>`;

    const htmlRend = `<div class="card"><h3>Rendimiento vs readiness</h3>${graficaRendReadiness(ctx)}</div>`;

    // Progresión por ejercicio (compacta)
    const nombres = [...new Set(fuerzaR.flatMap(s => s.entradas.map(e => e.ejercicio)))]
      .sort((a,b) => (datos.grupoDe.get(a) || 'zz').localeCompare(datos.grupoDe.get(b) || 'zz', 'es') || a.localeCompare(b, 'es'));
    const filasEj = nombres.map(n => {
      const hist = Metricas.historicoEjercicio({ fuerza: fuerzaR }, n);
      if (!hist.length) return '';
      const pri = hist[0], ult = hist[hist.length - 1];
      const diag = Metricas.diagnostico(hist);
      const mejor = Math.max(...hist.map(p => p.e1rm ?? -Infinity));
      const cls = diag.estado === 'progresando' ? 'verde' : diag.estado === 'estancado' ? 'rojo' : 'gris';
      return `<tr>
        <td>${esc(n)}<div class="muted" style="font-size:11px">${esc(datos.grupoDe.get(n) || 'Otros')}</div></td>
        <td class="num">${hist.length}</td>
        <td class="num">${fmtNum(pri.kgR,2)} → ${fmtNum(ult.kgR,2)}</td>
        <td class="num">${isFinite(mejor) ? fmtNum(mejor,1) : '—'}</td>
        <td><span class="chip ${cls}">${esc(diag.texto)}</span>${Metricas.rirAltoSostenido(hist) ? ' <span class="chip azul">RIR alto</span>' : ''}</td>
      </tr>`;
    }).join('');
    const htmlEjercicios = `<div class="card"><h3>Progresión por ejercicio</h3>
      <table><thead><tr><th>Ejercicio</th><th class="num">Ses.</th><th class="num">Kg (1ª → últ.)</th><th class="num">Mejor e1RM</th><th>Diagnóstico</th></tr></thead>
      <tbody>${filasEj}</tbody></table></div>`;

    // Readiness medio del periodo
    const med = k => {
      const v = readinessR.map(r => r[k]).filter(x => x != null);
      return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null;
    };
    const rojos = readinessR.filter(r => (r.estadoDia || bandaEstado(r.estadoEntrenar)) === 'rojo').length;
    const umbrales = VFC.umbrales(datos.readiness, perfil);
    const vfcBajas = umbrales.baja != null
      ? readinessR.filter(r => r.vfc != null && !r.vfcDescartada && r.vfc < umbrales.baja).length : null;
    const htmlReadiness = `<div class="card"><h3>Readiness del periodo (medias)</h3>
      <div class="inf-2col">
        <div>
          <div class="kv"><span class="muted">Sueño (1–4, mejor 4)</span><b>${fmtNum(med('sueno'),1)}</b></div>
          <div class="kv"><span class="muted">Ánimo/energía (1–4, mejor 4)</span><b>${fmtNum(med('animo'),1)}</b></div>
          <div class="kv"><span class="muted">Agujetas (1–4, mejor 1)</span><b>${fmtNum(med('agujetas'),1)}</b></div>
        </div>
        <div>
          <div class="kv"><span class="muted">Dolor (1–4, mejor 1)</span><b>${fmtNum(med('dolor'),1)}</b></div>
          <div class="kv"><span class="muted">Estrés (1–4, mejor 1)</span><b>${fmtNum(med('estres'),1)}</b></div>
          <div class="kv"><span class="muted">Días en rojo</span><b>${rojos}</b></div>
          ${vfcBajas != null ? `<div class="kv"><span class="muted">Noches VFC bajo umbral</span><b>${vfcBajas}</b></div>` : ''}
        </div>
      </div></div>`;

    // Observaciones del cliente
    const obs = [];
    fuerzaR.forEach(s => s.entradas.forEach(e => {
      if (e.obs) obs.push(`<div class="kv"><span>${fmtFechaCorta(s.fecha)} · ${esc(e.ejercicio)}</span><b><cite>“${esc(e.obs)}”</cite></b></div>`);
    }));
    const htmlObs = obs.length
      ? `<div class="card"><h3>Observaciones del cliente</h3>${obs.reverse().join('')}</div>` : '';

    // Dieta: solo si el cliente tiene el lazo de nutrición en marcha. Se imprime
    // lo justo para una revisión —estado, ritmo, adherencia al pesaje,
    // composición y últimas tarjetas—, no la pestaña entera.
    const nut = datos.nut;
    const nFase = (nut && nut.fase && nut.fase.estado !== 'CLOSED') ? nut.fase : null;
    let htmlNutricion = '';
    if (nut && nut.nut.presente && (nFase || nut.pesajes.length)){
      const adPeso = Nutricion.adherenciaPesaje(nut.pesajes, desde, hasta);
      const r = nut.reparto;
      const ultimas = nut.nut.recomendaciones
        .filter(x => enRango(x.fecha, desde, hasta)).slice(-6).reverse();
      htmlNutricion = `<div class="card"><h3>Dieta (lazo de nutrición)</h3>
        <div class="inf-2col">
          <div>
            <div class="kv"><span class="muted">Fase</span><b>${nFase
              ? `${esc(NUT_TXT.fase[nFase.tipo] || nFase.tipo)} desde ${fmtFecha(nFase.inicio)} · objetivo ${fmtTasa(nFase.tasaObjetivoPctSemana)}`
              : 'sin fase abierta'}</b></div>
            <div class="kv"><span class="muted">Ritmo real</span><b>${fmtTasa(nut.tasaPctSemana)}${
              nut.dentroBandaMuerta === true ? ' (en banda muerta)'
              : nut.dentroBandaMuerta === false ? ` (${fmtTasa(nut.desvioPctSemana)} del objetivo)` : ''}</b></div>
            <div class="kv"><span class="muted">Peso tendencia</span><b>${fmtNum(nut.tendenciaKg,1)} kg</b></div>
            <div class="kv"><span class="muted">Pesajes del periodo</span><b>${adPeso.hechos}/${adPeso.dias} (${fmtNum(adPeso.porSemana,1)}/semana)</b></div>
          </div>
          <div>
            <div class="kv"><span class="muted">% graso estimado</span><b>${
              nut.grasaVigentePct != null ? `${fmtNum(nut.grasaVigentePct,1)} % (hace ${nut.diasDesdeMedicion} días)` : '—'}</b></div>
            <div class="kv"><span class="muted">Masa magra estimada</span><b>${
              nut.grasaVigente ? fmtNum(nut.grasaVigente.magraKg,1) + ' kg' : '—'}</b></div>
            <div class="kv"><span class="muted">Reparto último tramo</span><b>${
              r && r.banda ? `${fmtNum(r.fraccionGrasaObservada * 100,0)} % grasa (esperable ${fmtNum(r.fraccionGrasaEsperada * 100,0)} %)` : 'sin valorar'}</b></div>
            <div class="kv"><span class="muted">Volumen recortado por la dieta</span><b>${
              nut.trinquete && nut.trinquete.trinqueteNivel > 0 ? `sí, nivel ${nut.trinquete.trinqueteNivel}` : 'no'}</b></div>
          </div>
        </div>
        ${ultimas.length ? `<table style="margin-top:10px"><thead><tr>
          <th>Fecha</th><th>Tarjeta</th><th class="num">Ritmo real</th><th class="num">Ajuste</th><th>Entrenamiento</th></tr></thead>
          <tbody>${ultimas.map(x => `<tr>
            <td>${fmtFecha(x.fecha)}</td>
            <td>${esc(NUT_TXT.recomendacion[x.tipo] || x.tipo)}</td>
            <td class="num">${fmtTasa(x.tasaRealPctSemana)}</td>
            <td class="num">${x.ajusteKcalDia ? fmtKcal(x.ajusteKcalDia) : '—'}</td>
            <td>${x.accionEntrenamiento ? esc(NUT_TXT.accion[x.accionEntrenamiento] || x.accionEntrenamiento) : ''}</td>
          </tr>`).join('')}</tbody></table>` : ''}
        <div class="muted" style="font-size:11px;margin-top:6px">
          El % graso y todo lo derivado de él son estimaciones con ±${NUT.grasaMargenPpMin}–${NUT.grasaMargenPpMax} pp de margen.
          A corto plazo la masa magra incluye agua y glucógeno, no solo músculo.
        </div></div>`;
    }

    return `<div class="informe">${cab}${ficha}${htmlAlertas}${htmlRend}${htmlEjercicios}${htmlReadiness}${htmlNutricion}${htmlObs}</div>`;
  },
};
