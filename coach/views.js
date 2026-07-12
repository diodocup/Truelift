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
function graficaRendReadiness(ctx){
  const { fuerzaR, readinessR } = ctx;
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
      barras, lineas, baseline: 100,
      umbrales: [
        { y: 100 + tol, label: `bueno (≥ ${fmtNum(100 + tol,1)})`, color: '#4caf7d' },
        { y: 100 - tol, label: `bajo (≤ ${fmtNum(100 - tol,1)})`, color: '#e0a63c' },
      ],
    })}</div>
    ${media != null ? `<div class="muted" style="font-size:12px">Media ${hayNeto ? 'neta' : ''} del periodo: <b style="color:var(--texto)">${fmtNum(media,1)}%</b></div>` : ''}`;
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
      const alertas = [
        f.rojas ? `<span class="chip rojo">${f.rojas} molestia${f.rojas > 1 ? 's' : ''}</span>` : '',
        f.ambar ? `<span class="chip ambar">${f.ambar} aviso${f.ambar > 1 ? 's' : ''}</span>` : '',
        !f.rojas && !f.ambar ? '<span class="chip verde">sin alertas</span>' : '',
      ].join(' ');
      return `<tr class="fila-cli" data-abrir="${esc(f.id)}" title="Abrir a ${esc(f.nombre)}">
        <td><span class="punto ${f.estado}"></span></td>
        <td><b>${esc(f.nombre)}</b>${f.notas ? `<div class="muted" style="font-size:12px">${esc(f.notas.length > 90 ? f.notas.slice(0,90) + '…' : f.notas)}</div>` : ''}</td>
        <td>${f.ultimaSesion ? fmtFecha(f.ultimaSesion) : '<span class="muted">—</span>'}</td>
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
          <thead><tr><th></th><th>Cliente</th><th>Última sesión</th><th>Datos importados</th><th class="num">Adherencia</th><th>Alertas</th><th></th></tr></thead>
          <tbody>${filasHtml}</tbody>
        </table></div>
      </div>`;
  },

  // ================= RESUMEN =================
  resumen(ctx){
    const { perfil, fuerzaR, cardioR, readinessR, desde, hasta } = ctx;
    const P = perfil;

    // Ficha
    const diasFase = P.faseInicio ? diasEntre(P.faseInicio, new Date()) : null;
    const fase = P.fasePeso ? `${P.fasePeso}${diasFase != null ? ` · día ${diasFase}` : ''}` : '—';
    const ficha = `
      <div class="card"><h3>Ficha</h3>
        <div class="kv"><span class="muted">Cliente</span><b>${esc(ctx.nombreCliente)}</b></div>
        <div class="kv"><span class="muted">Sexo / peso</span><b>${esc(P.sexo ?? '—')} · ${fmtNum(P.pesoCorporal,1)} ${esc(P.unidadPeso)}</b></div>
        <div class="kv"><span class="muted">Fase</span><b>${esc(fase)}</b></div>
        <div class="kv"><span class="muted">Sistema</span><b>${esc(P.sistema ?? '—')} · ${P.diasSemana ?? '—'} días/sem</b></div>
        <div class="kv"><span class="muted">Bloque desde</span><b>${fmtFecha(P.bloqueInicio)}</b></div>
        <div class="kv"><span class="muted">Descarga</span><b>${P.modoDescarga ? '<span class="chip ambar">EN DESCARGA</span>' : 'no'}</b></div>
      </div>`;

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

    // Rendimiento vs readiness (protagonista, ancho completo)
    const rendimiento = `
      <div class="card" style="grid-column:1/-1"><h3>Rendimiento vs readiness</h3>
        ${graficaRendReadiness(ctx)}
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

    return cabecera + `<div class="grid cols3">${ficha}${adherencia}${disponibilidad}${rendimiento}${htmlAlertas}</div>`;
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
          <thead><tr><th>Grupo</th>${semanas.map(w => `<th class="num">Sem ${w}</th>`).join('')}</tr></thead>
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
    const media7 = [], umbral7 = [];
    readinessR.forEach(r => {
      const t = serieVfc.get(fmtISO(r.fecha));
      if (t){ media7.push({ x: r.fecha, y: t.media7 }); umbral7.push({ x: r.fecha, y: t.umbral }); }
    });
    let htmlVfc = '';
    if (perfil.vfcActiva || noches.length){
      const grafica = Charts.lineas({
        series: [
          { nombre: 'VFC nocturna', color: '#5aa9e6', puntos: noches, soloPuntos: true },
          { nombre: 'Media 7 días', color: '#4caf7d', puntos: media7, sinPuntos: true, grosor: 2.5 },
          { nombre: 'Umbral de tendencia', color: '#e0a63c', puntos: umbral7, dash: '6 4', sinPuntos: true },
        ],
      });
      htmlVfc = `
      <div class="card" style="margin-bottom:14px"><h3>VFC (HRV)</h3>
        <div class="chart-caja">${grafica}</div>
        <div class="muted" style="font-size:12px">
          Puntos: VFC nocturna (<span style="color:#e0a63c">amarillo</span> = por debajo del umbral${umbrales.baja != null ? `, ${fmtNum(umbrales.baja,1)}` : ''}).
          Línea <span style="color:#4caf7d">verde</span>: media 7 días · línea discontinua <span style="color:#e0a63c">amarilla</span>: umbral.
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
          <thead><tr><th>Fecha</th><th>Estado</th><th>Sueño</th><th>Ánimo/energía</th><th>Agujetas</th><th>Dolor</th><th>Estrés</th><th>Fatiga</th><th>Enfermo</th><th class="num">VFC</th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </div>`;
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

    return `<div class="informe">${cab}${ficha}${htmlAlertas}${htmlRend}${htmlEjercicios}${htmlReadiness}${htmlObs}</div>`;
  },
};
