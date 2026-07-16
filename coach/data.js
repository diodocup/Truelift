'use strict';
/* ================================================================
   TrueLift Coach — data.js
   Utilidades, parser/normalizador del JSON de TrueLift,
   métricas derivadas y almacenamiento multi-cliente.
   Tolera ambos formatos (2026-07-05 y 2026-07-11): todo campo
   puede faltar o ser null; nunca romper, mostrar "—".
   ================================================================ */

// ---------- Utilidades ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtNum(n, dec = 1){
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', {minimumFractionDigits:0, maximumFractionDigits:dec});
}
function sinTildes(s){
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function uuid(){
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,9);
}

const DIAS_SEM = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// Parsea "YYYY-MM-DD" o ISO con hora como fecha LOCAL (evita saltos de día por UTC)
function parseFecha(s){
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  return new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0));
}
function soloDia(d){ return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null; }
function fmtFecha(d){
  if (!d) return '—';
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
function fmtFechaCorta(d){ return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : '—'; }
function fmtISO(d){
  if (!d) return '';
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function diasEntre(a, b){ return Math.round((soloDia(b) - soloDia(a)) / 86400000); }

// ---------- Validación y normalización ----------
function pareceTrueLift(raw){
  return raw && typeof raw === 'object' && !Array.isArray(raw) &&
         (Array.isArray(raw.logs) || Array.isArray(raw.planMod));
}

function normalizar(raw){
  const perfil = {
    sexo: raw.sexo ?? null,
    sistema: raw.sistema ?? null,
    diasSemana: parseInt(raw.dias, 10) || null,
    pesoCorporal: (typeof raw.pesoCorporal === 'number') ? raw.pesoCorporal : null,
    fasePeso: raw.fasePeso ?? null,
    faseInicio: parseFecha(raw.faseInicio),
    bloqueInicio: parseFecha(raw.bloqueInicio),
    modoDescarga: raw.modoDescarga === true,
    vfcActiva: raw.vfcActiva === true,
    vfcBandaMin: (typeof raw.vfcBandaMin === 'number') ? raw.vfcBandaMin : null,
    vfcBandaMax: (typeof raw.vfcBandaMax === 'number') ? raw.vfcBandaMax : null,
    unidadPeso: raw.unidadPeso || 'kg',
    planModKey: raw.planModKey ?? null,
  };

  const plan = (Array.isArray(raw.planMod) ? raw.planMod : []).map(p => ({
    dia: p.dia ?? '—', orden: p.orden ?? 0, patron: p.patron ?? '',
    grupo: p.grupo ?? 'Otros', ejercicio: p.ejercicio ?? '—',
    series: p.series ?? null, reps: p.reps ?? '—', rir: p.rir ?? '—',
    descansoMin: (typeof p.descansoMin === 'number') ? p.descansoMin : null,
  }));

  const grupoDe = new Map();
  plan.forEach(p => { if (!grupoDe.has(p.ejercicio)) grupoDe.set(p.ejercicio, p.grupo); });

  const fuerza = [], cardio = [];
  (Array.isArray(raw.logs) ? raw.logs : []).forEach(l => {
    if (!l || typeof l !== 'object') return;
    const fecha = parseFecha(l.fecha);
    if (!fecha) return;
    if (l.tipo === 'cardio'){
      cardio.push({
        fecha, nombre: l.nombre ?? 'Cardio',
        duracion: l.duracion ?? null, intensidad: l.intensidad ?? null,
      });
      return;
    }
    const entradas = (Array.isArray(l.entradas) ? l.entradas : []).map(e => {
      const reps = Array.isArray(e.reps) ? e.reps : [];
      const rir = Array.isArray(e.rir) ? e.rir : [];
      const kgSets = Array.isArray(e.kgSets) ? e.kgSets : null;
      return {
        slot: e.slot ?? null, ejercicio: e.ejercicio ?? '—',
        kg: (typeof e.kg === 'number') ? e.kg : null,
        kgSets, reps, rir,
        obs: (e.obs ?? '').trim(),
        modulada: e.modulada === true,
        nSeries: Math.max(reps.length, rir.length, kgSets ? kgSets.length : 0),
      };
    });
    fuerza.push({
      fecha, dia: l.dia ?? '—',
      semana: (typeof l.semana === 'number') ? l.semana : null,
      compuerta: l.estadoCompuerta ?? null,           // verde | ambar | rojo | null
      descarga: l.descarga === true,
      rendimiento: l.rendimiento ?? null,              // floja | normal | buena | null
      rendPctAbs: (typeof l.rendimientoPct === 'number') ? l.rendimientoPct : null,       // formato antiguo (~100)
      rendPctNet: (typeof l.netDailyPerformancePct === 'number') ? l.netDailyPerformancePct : null, // neto diario (±%)
      rendPctRaw: (typeof l.rawSessionPct === 'number') ? l.rawSessionPct : null,          // bruto de sesión (±%)
      tolPct: (typeof l.tolPctAtSave === 'number') ? l.tolPctAtSave : null,                // tolerancia bueno/bajo
      verdict: l.verdictAtSave ?? null,
      rpe: (typeof l.sessionRpe === 'number') ? l.sessionRpe : null,
      duracionMin: (typeof l.duracionMin === 'number') ? l.duracionMin : null,
      duracionAnomala: l.duracionAnomala === true,
      volumenBajo: l.volumenBajo === true,
      effectiveSets: (typeof l.effectiveSets === 'number') ? l.effectiveSets : null,
      entradas,
    });
  });
  fuerza.sort((a,b) => a.fecha - b.fecha);
  cardio.sort((a,b) => a.fecha - b.fecha);

  const readiness = (Array.isArray(raw.readinessDiario) ? raw.readinessDiario : [])
    .map(r => ({
      fecha: parseFecha(r.fecha),
      sueno: r.sueno ?? null, agujetas: r.agujetas ?? null,
      agujetasZona: r.agujetasZona ?? null,
      estres: r.estres ?? null, animo: r.animo ?? null,
      dolor: r.dolor ?? null, dolorZona: r.dolorZona ?? null,
      enfermo: r.enfermo === true,
      vfc: (typeof r.vfc === 'number') ? r.vfc : null,
      vfcDescartada: r.vfcDescartada === true,
      fcReposo: (typeof r.fcReposo === 'number') ? r.fcReposo : null,
      estadoEntrenar: (typeof r.estadoEntrenar === 'number') ? r.estadoEntrenar : null,
      estadoDia: r.estadoDia ?? null,                  // verde | ambar | rojo | null
    }))
    .filter(r => r.fecha)
    .sort((a,b) => a.fecha - b.fecha);

  return { perfil, plan, fuerza, cardio, readiness, grupoDe };
}

// ---------- Métricas ----------
const Metricas = {

  // Carga representativa de una entrada: kg máximo entre series (kgSets si existe)
  kgRepr(e){
    if (e.kgSets && e.kgSets.some(k => typeof k === 'number'))
      return Math.max(...e.kgSets.filter(k => typeof k === 'number'));
    return e.kg;
  },

  kgDeSerie(e, i){
    if (e.kgSets && typeof e.kgSets[i] === 'number') return e.kgSets[i];
    return e.kg;
  },

  repsTotales(e){
    return e.reps.reduce((s, r) => s + (typeof r === 'number' ? r : 0), 0) || null;
  },

  // e1RM (Epley ajustado por RIR) de la mejor serie. null si no hay datos.
  e1rm(e){
    let mejor = null;
    for (let i = 0; i < e.nSeries; i++){
      const kg = this.kgDeSerie(e, i);
      const reps = e.reps[i];
      if (typeof kg !== 'number' || typeof reps !== 'number' || reps <= 0) continue;
      const rir = (typeof e.rir[i] === 'number') ? e.rir[i] : 0;
      const v = kg * (1 + (reps + rir) / 30);
      if (mejor == null || v > mejor) mejor = v;
    }
    return mejor == null ? null : Math.round(mejor * 2) / 2;
  },

  tonelajeEntrada(e){
    let t = 0, hay = false;
    for (let i = 0; i < e.nSeries; i++){
      const kg = this.kgDeSerie(e, i), reps = e.reps[i];
      if (typeof kg === 'number' && typeof reps === 'number'){ t += kg * reps; hay = true; }
    }
    return hay ? Math.round(t) : null;
  },

  tonelajeSesion(s){
    let t = 0, hay = false;
    s.entradas.forEach(e => { const v = this.tonelajeEntrada(e); if (v != null){ t += v; hay = true; } });
    return hay ? t : null;
  },

  rirMedio(e){
    const v = e.rir.filter(r => typeof r === 'number');
    return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null;
  },

  // Histórico completo de un ejercicio (orden cronológico)
  historicoEjercicio(datos, nombre){
    const h = [];
    datos.fuerza.forEach(s => {
      s.entradas.forEach(e => {
        if (e.ejercicio !== nombre) return;
        h.push({
          fecha: s.fecha, dia: s.dia, semana: s.semana, entrada: e,
          kgR: this.kgRepr(e), repsTot: this.repsTotales(e),
          e1rm: this.e1rm(e), tonelaje: this.tonelajeEntrada(e),
          rirMed: this.rirMedio(e),
        });
      });
    });
    return h;
  },

  // Delta del punto idx respecto al anterior: sube / baja / igual / null
  delta(hist, idx){
    if (idx <= 0) return null;
    const a = hist[idx], p = hist[idx - 1];
    if (a.kgR == null || p.kgR == null){
      if (a.repsTot != null && p.repsTot != null && a.repsTot !== p.repsTot)
        return { tipo: a.repsTot > p.repsTot ? 'sube' : 'baja', texto: `${a.repsTot > p.repsTot ? '▲' : '▼'} ${Math.abs(a.repsTot - p.repsTot)} reps` };
      return null;
    }
    const dkg = Math.round((a.kgR - p.kgR) * 100) / 100;
    if (dkg > 0) return { tipo:'sube', texto:`▲ +${fmtNum(dkg,2)} kg` };
    if (dkg < 0) return { tipo:'baja', texto:`▼ ${fmtNum(dkg,2)} kg` };
    if (a.repsTot != null && p.repsTot != null && a.repsTot !== p.repsTot)
      return { tipo: a.repsTot > p.repsTot ? 'sube' : 'baja', texto:`${a.repsTot > p.repsTot ? '▲' : '▼'} ${Math.abs(a.repsTot - p.repsTot)} reps` };
    return { tipo:'igual', texto:'=' };
  },

  _mejora(act, ant){
    if (act.kgR != null && ant.kgR != null){
      if (act.kgR > ant.kgR) return true;
      if (act.kgR < ant.kgR) return false;
    }
    if (act.repsTot != null && ant.repsTot != null) return act.repsTot > ant.repsTot;
    return false;
  },

  // Diagnóstico de progresión de un ejercicio
  diagnostico(hist){
    if (hist.length < 2) return { estado:'insuficiente', texto:'Datos insuficientes' };
    let racha = 0; // sesiones consecutivas (desde el final) sin mejora
    for (let i = hist.length - 1; i >= 1; i--){
      if (this._mejora(hist[i], hist[i-1])) break;
      racha++;
    }
    if (racha === 0) return { estado:'progresando', texto:'Progresando' };
    if (racha >= 3){
      const desde = hist[hist.length - racha].fecha;
      return { estado:'estancado', texto:`Estancado desde ${fmtFecha(desde)}`, desde, racha };
    }
    return { estado:'neutro', texto:`Sin mejora en la última sesión` };
  },

  // RIR medio >= 3 en las 2 últimas sesiones → va sobrado
  rirAltoSostenido(hist){
    if (hist.length < 2) return false;
    const u = hist.slice(-2);
    return u.every(p => p.rirMed != null && p.rirMed >= 3);
  },

  PALABRAS_MOLESTIA: ['dolor','molest','pinch','tiron','lesion','duele','sobrecarga','cargad',
                      'rodilla','hombro','lumbar','cervical','codo','muneca','aductor','isquio','tendon'],

  // Observaciones con posibles molestias en el rango
  molestias(fuerzaR){
    const out = [];
    fuerzaR.forEach(s => s.entradas.forEach(e => {
      if (!e.obs) return;
      const t = sinTildes(e.obs);
      if (this.PALABRAS_MOLESTIA.some(p => t.includes(p)))
        out.push({ fecha: s.fecha, ejercicio: e.ejercicio, obs: e.obs });
    }));
    return out.reverse(); // más recientes primero
  },

  adherencia(fuerzaR, desde, hasta, diasSemana){
    const dias = Math.max(1, diasEntre(desde, hasta) + 1);
    const semanas = dias / 7;
    const esperadas = diasSemana ? Math.round(semanas * diasSemana) : null;
    return { hechas: fuerzaR.length, esperadas,
             pct: esperadas ? Math.round(100 * fuerzaR.length / esperadas) : null };
  },

  // Días con VFC bajo banda en los últimos 7 días del rango
  vfcBajas(readinessR, bandaMin, hasta){
    if (bandaMin == null) return [];
    const lim = new Date(soloDia(hasta) - 6 * 86400000);
    return readinessR.filter(r =>
      r.fecha >= lim && r.vfc != null && !r.vfcDescartada && r.vfc < bandaMin);
  },

  // % de rendimiento unificado (antiguo ~100 / nuevo ±% → base 100)
  pctSesion(s){
    if (s.rendPctAbs != null) return s.rendPctAbs;
    if (s.rendPctNet != null) return Math.round((100 + s.rendPctNet) * 10) / 10;
    return null;
  },

  // Rendimiento BRUTO de sesión en base 100 (antiguo rendimientoPct / nuevo rawSessionPct)
  pctBruto(s){
    if (s.rendPctAbs != null) return s.rendPctAbs;
    if (s.rendPctRaw != null) return Math.round((100 + s.rendPctRaw) * 10) / 10;
    return null;
  },

  // Rendimiento NETO diario en base 100 (solo formato nuevo)
  pctNeto(s){
    if (s.rendPctNet != null) return Math.round((100 + s.rendPctNet) * 10) / 10;
    return null;
  },
};

function bandaEstado(v){
  if (v == null) return null;
  return v < 40 ? 'rojo' : v < 70 ? 'ambar' : 'verde';
}

/* ================================================================
   VFC — lógica portada de la app TrueLift (lib/app_state.dart)
   ================================================================ */
const VFC = {
  MAD_PISO_FRAC: 0.03,   // _vfcMadPisoFrac
  NOCHES_AUTO: 30,       // _vfcNochesAuto

  _mediana(xs){
    if (!xs.length) return 0;
    const s = [...xs].sort((a,b) => a-b), n = s.length;
    return n % 2 ? s[(n-1)/2] : (s[n/2 - 1] + s[n/2]) / 2;
  },

  // Noches válidas ordenadas: [{fecha, clave, vfc}]
  validas(readiness){
    return readiness
      .filter(r => r.vfc != null && !r.vfcDescartada && r.fecha)
      .map(r => ({ fecha: soloDia(r.fecha), clave: fmtISO(r.fecha), vfc: r.vfc }))
      .sort((a,b) => a.fecha - b.fecha);
  },

  /* Serie de tendencia (idéntica a AppState.vfcTendenciaSerie):
     por noche válida, media móvil de 7 días y umbral = mediana − 0,75·MAD
     de la base previa (últimas 30 noches), con suelo de MAD = 3% de la mediana.
     Solo hay valor con ≥7 noches en ventana y ≥7 previas. */
  tendenciaSerie(readiness){
    const v = this.validas(readiness), n = v.length;
    const serie = new Map(); // clave → {media7, umbral}
    let lo = 0, hiEx = 0;
    for (let i = 0; i < n; i++){
      const actual = v[i];
      const inicioVentana = new Date(+actual.fecha - 6 * 86400000);
      while (lo < n && v[lo].fecha < inicioVentana) lo++;
      if (hiEx < lo) hiEx = lo;
      while (hiEx < n && v[hiEx].fecha <= actual.fecha) hiEx++;
      const ventanaLen = hiEx - lo, baseLen = lo;
      if (ventanaLen < 7 || baseLen < 7) continue;
      const desdeBase = baseLen > 30 ? baseLen - 30 : 0;
      const base = [];
      for (let j = desdeBase; j < lo; j++) base.push(v[j].vfc);
      const med = this._mediana(base);
      let mad = this._mediana(base.map(x => Math.abs(x - med)));
      const piso = med * this.MAD_PISO_FRAC;
      if (mad < piso) mad = piso;
      let suma = 0;
      for (let j = lo; j < hiEx; j++) suma += v[j].vfc;
      serie.set(actual.clave, { media7: suma / ventanaLen, umbral: med - 0.75 * mad });
    }
    return serie;
  },

  // Fechas (claves ISO) con tendencia baja sostenida (media7 < umbral ≥3 días seguidos)
  tendenciaBajaFechas(readiness){
    const v = this.validas(readiness);
    const serie = this.tendenciaSerie(readiness);
    const bajas = new Set(); let racha = [];
    for (const a of v){
      const t = serie.get(a.clave);
      if (!t){ racha = []; continue; }
      const ayer = racha.length ? new Date(+parseFecha(racha[racha.length-1]) + 86400000) : null;
      const sigue = ayer && fmtISO(ayer) === a.clave;
      if (t.media7 < t.umbral){
        if (!sigue) racha = [];
        racha.push(a.clave);
        if (racha.length >= 3) racha.forEach(c => bajas.add(c));
      } else racha = [];
    }
    return bajas;
  },

  /* Umbrales nocturnos (baja, muyBaja) como AppState._vfcUmbrales:
     con ≥30 noches → banda auto (mediana−MAD, mediana−2·MAD de las últimas 30);
     si no, semilla manual (min, min·0,9); si nada, null. */
  umbrales(readiness, perfil){
    if (!perfil.vfcActiva && perfil.vfcBandaMin == null) return { baja: null, muyBaja: null, auto: false };
    const v = this.validas(readiness).map(x => x.vfc);
    if (v.length >= this.NOCHES_AUTO){
      const ult = v.slice(-30);
      const med = this._mediana(ult);
      let mad = this._mediana(ult.map(x => Math.abs(x - med)));
      const piso = med * this.MAD_PISO_FRAC;
      if (mad < piso) mad = piso;
      return { baja: med - mad, muyBaja: med - 2 * mad, auto: true };
    }
    if (perfil.vfcBandaMin != null)
      return { baja: perfil.vfcBandaMin, muyBaja: perfil.vfcBandaMin * 0.9, auto: false };
    return { baja: null, muyBaja: null, auto: false };
  },
};

/* ================================================================
   FC en reposo — banda robusta portada de la app móvil
   ================================================================ */
const FCReposo = {
  MAD_PISO_FRAC: 0.03,
  NOCHES_BANDA: 30,
  MIN_NOCHES_BANDA: 14,

  // La marca vfcDescartada identifica una noche no representativa completa.
  validas(readiness){
    return readiness
      .filter(r => Number.isFinite(r.fcReposo) && !r.vfcDescartada && r.fecha)
      .map(r => ({ fecha: soloDia(r.fecha), clave: fmtISO(r.fecha), fcReposo: r.fcReposo }))
      .sort((a,b) => a.fecha - b.fecha);
  },

  /* FC alta = mediana + MAD sobre las últimas 30 noches válidas.
     Requiere al menos 14 noches y aplica un suelo al MAD del 3% de la mediana. */
  banda(readiness){
    const validas = this.validas(readiness);
    if (validas.length < this.MIN_NOCHES_BANDA) return null;
    const valores = validas.slice(-this.NOCHES_BANDA).map(r => r.fcReposo);
    const mediana = VFC._mediana(valores);
    const madBruto = VFC._mediana(valores.map(x => Math.abs(x - mediana)));
    const mad = Math.max(madBruto, mediana * this.MAD_PISO_FRAC);
    return { alta: mediana + mad, mediana, mad, noches: valores.length };
  },
};

/* ================================================================
   Fatiga acumulada — portada de AppState (_readinessDiaCargado y
   _diasCargadosVentana; sin la parte de carga interna de cardio,
   que el JSON no exporta desglosada por fecha)
   ================================================================ */
const Fatiga = {
  // ¿Día "cargado"? (señales de fatiga ese día)
  diaCargado(r, vfcNivel = 0){
    const sueno = r.sueno ?? 3, animo = r.animo ?? 3;
    const agujetas = r.agujetas ?? 1, estres = r.estres ?? 1, dolor = r.dolor ?? 1;
    return sueno <= 2 || animo <= 2 || agujetas >= 3 || estres >= 3 || dolor >= 3 || vfcNivel >= 1;
  },

  /* Para cada día con cuestionario: nº de días cargados en la ventana de 7 días
     que TERMINA ese día. Map(claveISO → {cargados, datos, nivel}).
     nivel = fatiga% como en la app (cargados·12, solo con ≥3 días de datos). */
  porDia(readiness, tendenciaBaja){
    const dias = readiness.filter(r => r.fecha).map(r => ({
      clave: fmtISO(r.fecha), fecha: soloDia(r.fecha),
      cargado: this.diaCargado(r, tendenciaBaja.has(fmtISO(r.fecha)) ? 1 : 0),
    })).sort((a,b) => a.fecha - b.fecha);
    const out = new Map();
    dias.forEach((d, i) => {
      const ini = new Date(+d.fecha - 6 * 86400000);
      let cargados = 0, datos = 0;
      for (let j = i; j >= 0 && dias[j].fecha >= ini; j--){
        datos++;
        if (dias[j].cargado) cargados++;
      }
      out.set(d.clave, {
        cargados, datos,
        nivel: datos >= 3 ? Math.min(100, cargados * 12) : null,
      });
    });
    return out;
  },
};

// ---------- Almacenamiento multi-cliente ----------
const Store = {
  KEY: 'tlcoach_clientes',
  cargar(){
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY));
      if (s && Array.isArray(s.clientes)) return s;
    } catch (e) { /* corrupto → empezar de cero */ }
    return { clientes: [], clienteActivoId: null };
  },
  guardar(store){
    try {
      localStorage.setItem(this.KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      alert('No se pudo guardar: el almacenamiento del navegador está lleno.\nElimina clientes antiguos desde "Clientes".');
      return false;
    }
  },
};
