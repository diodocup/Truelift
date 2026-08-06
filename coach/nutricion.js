'use strict';
/* ================================================================
   TrueLift Coach — nutricion.js
   Capa de nutrición del cliente, leída desde la copia de seguridad.

   Dos cosas viven aquí:

     1. El normalizador del bloque `nutricion` del JSON de TrueLift.
        Es un campo ADITIVO: las copias anteriores a la capa de
        nutrición simplemente no lo traen y todo queda en null, sin
        romper nada (mismo criterio que el resto de data.js).

     2. El port a JS del motor de la app móvil (lib/nutricion/*) que
        hace falta para reconstruir lo que el JSON NO guarda porque
        se calcula al vuelo: peso-tendencia (Kalman de §3.1), ritmo
        en %/semana, bandas de color del ritmo (§5.3–§5.4), reparto
        grasa/masa magra (§4), curva teórica de % graso (§3.2),
        topes y asentamiento (§3.3, §6.1–§6.3) y la proyección del
        plan de temporada (§6.3).

   Todos los números salen de lib/nutricion/constantes.dart y llevan
   aquí el mismo nombre: si allí se recalibra algo, aquí también.

   Honestidad del dato (§0.8 del documento de implantación): nada de
   lo que sale de aquí es una medición. El % graso es una estimación
   con ±3–4 pp de margen y el reparto es un cociente entre dos de
   ellas. Las vistas lo declaran siempre.
   ================================================================ */

const NUT = {
  // §4.2 — Controlador
  kcalPorKg: 7700,
  bandaMuertaPctSemana: 0.1,
  maxPasoKcal: 300,

  // §6.1–6.2 — Guardarraíles de ajuste acumulado
  topeDeficitKcal: 600,
  topeSuperavitKcal: 400,
  sueloBasePct: 0.25,
  metabolismoBasalIntercepto: 370.0,
  metabolismoBasalPorKgMagro: 21.6,
  factorActividadEstimada: 1.45,
  topeDeficitEstimadoMinKcal: 300,

  // §6.3 — Topes de tasa objetivo
  topeTasaDeficit: 1.0,
  topeTasaSuperavit: 0.35,
  imcUmbralAmpliado: 30.0,
  imcUmbralAmpliadoReactivacion: 30.5,
  topeTasaDeficitImcAlto: 1.5,

  // §6.4 — Proteína
  proteinaGPorKg: 1.8,
  proteinaGPorKgMin: 1.6,
  proteinaGPorKgMax: 2.2,

  // §3.3 — Asentamiento
  settlingMinDays: 21,
  settlingMinWeighins: 10,
  settlingRateVar: 6.5e-3,
  steadyWeeksMin: 3,
  settlingMinDaysSteady: 7,
  settlingMinWeighinsSteady: 5,
  settlingMinDaysCycle: 28,

  // §3.5 — Modo ciclo
  cicloDiasDefecto: 28,
  cicloDiasMin: 21,
  cicloDiasMax: 35,
  cicloIntervalosMax: 6,

  // §3.1 — Filtro de Kalman
  noisePctBw: 0.006,
  qNivel: 0.05 * 0.05,
  qPendiente: 0.007 * 0.007,
  pInicialNivel: 1.0,
  pInicialPendiente: 0.01,

  // §3.4 — Enmascaramiento
  maskExtraDays: 3,
  maskRFactor: 10.0,
  maskDiasPosponer: 3,
  pesajesMinTrasPausa: 5,

  // §3.3 — Ventana de agua de arranque de fase
  ventanaAguaDias: 7,
  ventanaAguaFactorQNivel: 25.0,

  // §7.6 — Refeeds
  refeedKcal: 500,
  refeedDays: 2,
  refeedsAntesDeBajarObjetivo: 3,

  // §7.4 — Trinquete de volumen
  trinqueteCorte1Pct: 20.0,
  trinqueteCorte2Pct: 15.0,

  // §2.1, §8.7 — Validaciones
  pesoMinKg: 40,
  pesoMaxKg: 150,
  sueloGrasaHombrePct: 5.0,
  sueloGrasaMujerPct: 12.0,
  grasaMargenPpMin: 3,
  grasaMargenPpMax: 4,
  diasSinPesajeAviso: 7,
  diasSinPesajeOfrecerPausa: 21,

  // Implantación §2 — Historial de % graso
  grasaAvisoDias: 14,
  grasaAvisoAmbarDias: 14,
  grasaRegistroMinPct: 3.0,
  grasaRegistroMaxPct: 60.0,

  // Implantación §3–§4 — Partición y reparto
  particionDeficitAnclas: { 10: 0.70, 15: 0.78, 20: 0.85, 25: 0.90, 30: 0.95 },
  particionDesplazamientoMujerPp: 8.0,
  particionPenalizacionAmbar: 0.05,
  particionPenalizacionRojo: 0.10,
  particionDeficitMin: 0.50,
  particionSuperavitPrincipiante: 0.35,
  particionSuperavitIntermedio: 0.50,
  particionSuperavitAvanzado: 0.60,
  particionSuperavitPenalizacionAmbar: 0.10,
  particionSuperavitPenalizacionRojo: 0.20,
  particionSuperavitMax: 0.90,
  grasaValoracionDiasMin: 14,
  grasaCambioMinimoKg: 1.0,
  repartoToleranciaVerde: 0.10,
  repartoToleranciaAmbar: 0.25,

  // Implantación §5 — Bandas del selector de ritmo
  tasaSliderDeficitMin: 0.25,
  tasaRecomendadaSuperavitMin: 0.1,
  umbralGrasaAltaHombrePct: 25.0,
  umbralGrasaMediaHombrePct: 15.0,
  umbralGrasaTopeReactivacionPp: 1.0,
  bandaDeficitAltoVerdeMin: 0.50,
  bandaDeficitAltoAmbarMax: 1.25,
  bandaDeficitMedioVerdeMin: 0.40,
  bandaDeficitMedioVerdeMax: 0.75,
  bandaDeficitBajoVerdeMin: 0.25,
  bandaDeficitBajoVerdeMax: 0.50,
  bandaDeficitBajoAmbarMax: 0.75,
  superavitTechoGrasaHombrePct: 20.0,
  bandaSupPrincipianteVerdeMin: 0.20,
  bandaSupPrincipianteVerdeMax: 0.30,
  bandaSupIntermedioVerdeMin: 0.15,
  bandaSupIntermedioVerdeMax: 0.25,
  bandaSupAvanzadoVerdeMin: 0.10,
  bandaSupAvanzadoVerdeMax: 0.15,
  bandaSupAvanzadoAmbarMax: 0.25,

  // Implantación §6 — Planificador de temporada
  planDesfaseDias: 7,
  volumenSemVerdeMin: 12, volumenSemVerdeMax: 20, volumenSemAmbarMin: 8, volumenSemAmbarMax: 30,
  definicionSemVerdeMin: 6, definicionSemVerdeMax: 12, definicionSemAmbarMin: 4, definicionSemAmbarMax: 16,
  puenteSemVerdeMin: 2, puenteSemVerdeMax: 3, puenteSemAmbarMin: 1, puenteSemAmbarMax: 6,
  volumenTechoVerdeHombrePct: 17.0,
  definicionMargenVerdePp: 3.0,
  margenBajoSueloPp: 1.0,
};

/* ---------- Etiquetas de las enumeraciones del módulo ---------- */
const NUT_TXT = {
  fase: { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' },
  estadoFase: {
    SETTLING: 'Calibrando', ACTIVE: 'Activa', PAUSED: 'Pausada',
    END_RECOMMENDED: 'Fin recomendado', CLOSED: 'Cerrada',
  },
  recomendacion: {
    ADJUST: 'Ajuste', HOLD: 'Mantener', REFEED: 'Refeed',
    LOWER_TARGET: 'Bajar objetivo', END_PHASE: 'Fin de fase',
  },
  accion: {
    REFEED_DELOAD: 'Refeed + descarga', VOLUME_CUT_1: 'Recorte de volumen (1)',
    VOLUME_CUT_2: 'Recorte de volumen (2)', PHASE_END: 'Cierre de fase',
  },
  metodoGrasa: { DIRECT: 'directo', NAVY: 'Navy', GALLERY: 'galería' },
  sexo: { M: 'hombre', F: 'mujer' },
  experiencia: { NOVICE: 'principiante', INTERMEDIATE: 'intermedio', ADVANCED: 'avanzado' },
  bloque: { BULK: 'Volumen', BRIDGE: 'Puente', CUT: 'Definición' },
  referencia: { DRY_RAW: 'seco/crudo', COOKED: 'cocinado' },
  macro: { CARB: 'carbohidrato', FAT: 'grasa', PROTEIN: 'proteína', MIXED: 'mixto' },
  banda: { neutro: 'sostenible, más lento', verde: 'recomendado', ambar: 'razonable', rojo: 'agresivo' },
};

/* ---------- Utilidades de fecha y estadística ---------- */
// DiaLocal.sumarDias: se construye por componentes para que un cambio de
// horario de verano no reste horas al día.
function diaMas(d, n){
  const b = soloDia(d);
  return new Date(b.getFullYear(), b.getMonth(), b.getDate() + n);
}
function medianaNum(xs){
  if (!xs.length) return 0;
  const s = [...xs].sort((a,b) => a-b), n = s.length;
  return n % 2 ? s[(n-1)/2] : (s[n/2 - 1] + s[n/2]) / 2;
}
function numNut(v){ return typeof v === 'number' && isFinite(v) ? v : null; }
function nutClamp(v, a, b){ return v < a ? a : v > b ? b : v; }

/* ================================================================
   Normalización del bloque `nutricion`
   ================================================================ */
function normalizarNutricion(raw){
  const n = raw && typeof raw === 'object' ? raw.nutricion : null;
  if (!n || typeof n !== 'object' || Array.isArray(n)) return { presente: false, activo: false };

  const lista = v => Array.isArray(v) ? v : [];

  const perfilJ = n.perfil;
  const perfil = (perfilJ && typeof perfilJ === 'object') ? {
    alturaCm: numNut(perfilJ.alturaCm),
    grasaInicialPct: numNut(perfilJ.grasaInicialPct),
    metodoGrasa: perfilJ.metodoGrasa ?? null,
    sexo: perfilJ.sexo ?? null,                       // 'M' | 'F' | null
    pesoReferenciaGrasaKg: numNut(perfilJ.pesoReferenciaGrasaKg),
    experienciaFuerza: perfilJ.experienciaFuerza ?? null,
  } : null;

  const fase = f => {
    if (!f || typeof f !== 'object') return null;
    const integ = (f.integracionEntrenamiento && typeof f.integracionEntrenamiento === 'object')
      ? f.integracionEntrenamiento : {};
    return {
      id: String(f.id ?? ''),
      tipo: f.tipo ?? 'MAINTENANCE',
      inicio: parseFecha(f.inicio),
      fin: parseFecha(f.fin),
      tasaObjetivoPctSemana: numNut(f.tasaObjetivoPctSemana) ?? 0,
      diaEvaluacion: numNut(f.diaEvaluacion),
      ajusteAcumuladoKcal: numNut(f.ajusteAcumuladoKcal) ?? 0,
      refeeds: numNut(f.refeeds) ?? 0,
      estado: f.estado ?? 'SETTLING',
      ingestaBaseKcal: numNut(f.ingestaBaseKcal),
      pesoObjetivoKg: numNut(f.pesoObjetivoKg) ?? 0,
      semanasPreviasEnTipo: numNut(f.semanasPreviasEnTipo) ?? 0,
      modoCiclo: f.modoCiclo === true,
      porcionesProteinaDia: numNut(f.porcionesProteinaDia),
      proteinaGPorKg: numNut(f.proteinaGPorKg) ?? NUT.proteinaGPorKg,
      proteinaPesoReferenciaKg: numNut(f.proteinaPesoReferenciaKg),
      topeImcAmpliadoActivo: typeof f.topeImcAmpliadoActivo === 'boolean' ? f.topeImcAmpliadoActivo : null,
      integracion: {
        rutinaId: integ.rutinaId ?? null,
        vigilados: lista(integ.vigiladosPersonalizados).map(String),
        evaluacionesCaidaConsecutivas: numNut(integ.evaluacionesCaidaConsecutivas) ?? 0,
        ultimaEvaluacion: parseFecha(integ.ultimaEvaluacionDetector),
        ultimoDisparo: parseFecha(integ.ultimoDisparo),
        ultimoDisparoAmbiguo: parseFecha(integ.ultimoDisparoAmbiguo),
        escalon: numNut(integ.escalon) ?? 0,            // 0 sin respuesta · 1 rama barata · 2 recorte 1 · 3 suelo
        trinqueteNivel: numNut(integ.trinqueteNivel) ?? 0,
        topesSeriesPorLinea: (integ.topesSeriesPorLinea && typeof integ.topesSeriesPorLinea === 'object')
          ? integ.topesSeriesPorLinea : {},
        ultimaCaidaAgregadaPct: numNut(integ.ultimaCaidaAgregadaPct),
        ultimosVigiladosEvaluables: numNut(integ.ultimosVigiladosEvaluables) ?? 0,
        ultimaCondicionCaida: integ.ultimaCondicionCaida === true,
      },
      // Sugerencia de §6.4: g/día sobre el PESO OBJETIVO, nunca sobre el actual.
      get objetivoProteinaGDia(){ return this.pesoObjetivoKg * this.proteinaGPorKg; },
    };
  };

  // Un pesaje por día (§2.1: si hay dos, manda el primero registrado).
  const porDiaPesaje = new Map();
  lista(n.pesajes).forEach(p => {
    const fecha = parseFecha(p && p.fecha);
    const peso = numNut(p && p.pesoKg);
    if (!fecha || peso == null) return;
    const clave = fmtISO(fecha);
    if (!porDiaPesaje.has(clave))
      porDiaPesaje.set(clave, { fecha: soloDia(fecha), clave, pesoKg: peso, enmascarado: p.enmascarado === true });
  });
  const pesajes = [...porDiaPesaje.values()].sort((a,b) => a.fecha - b.fecha);

  // Misma deduplicación por día para las mediciones de % graso.
  const porDiaGrasa = new Map();
  lista(n.medicionesGrasa).forEach(m => {
    const fecha = parseFecha(m && m.fecha);
    const pct = numNut(m && m.porcentajePct);
    const ancla = numNut(m && m.pesoAnclaKg);
    if (!fecha || pct == null || ancla == null) return;
    const clave = fmtISO(fecha);
    if (porDiaGrasa.has(clave)) return;
    porDiaGrasa.set(clave, {
      fecha: soloDia(fecha), clave, porcentajePct: pct,
      metodo: m.metodo ?? 'DIRECT', pesoAnclaKg: ancla,
      grasaKg: ancla * pct / 100, magraKg: ancla - ancla * pct / 100,
    });
  });
  const medicionesGrasa = [...porDiaGrasa.values()].sort((a,b) => a.fecha - b.fecha);

  const opcion = o => ({
    nombre: String(o?.nombre ?? ''),
    estadoReferencia: o?.estadoReferencia ?? 'DRY_RAW',
    gramos: numNut(o?.gramos) ?? 0,
    kcalReales: numNut(o?.kcalReales) ?? 0,
    componentes: lista(o?.componentes).map(c => ({
      nombre: String(c?.nombre ?? ''),
      estadoReferencia: c?.estadoReferencia ?? 'DRY_RAW',
      gramos: numNut(c?.gramos) ?? 0,
      kcalReales: numNut(c?.kcalReales) ?? 0,
    })),
  });

  const recomendaciones = lista(n.recomendaciones).map(r => ({
    fecha: parseFecha(r && r.fecha),
    faseId: String(r?.faseId ?? ''),
    tipo: r?.tipo ?? 'HOLD',
    tasaRealPctSemana: numNut(r?.tasaRealPctSemana),
    errorKcalDia: numNut(r?.errorKcalDia),
    ajusteKcalDia: numNut(r?.ajusteKcalDia),
    pasosExtraDia: numNut(r?.pasosExtraDia),
    gastoPasosKcalDia: numNut(r?.gastoPasosKcalDia),
    opciones: lista(r?.opciones).map(opcion),
    limitadaPorBiblioteca: r?.limitadaPorBiblioteca === true,
    usaBasicos: r?.usaBasicos === true,
    nuevaTasaObjetivoPctSemana: numNut(r?.nuevaTasaObjetivoPctSemana),
    objetivoAplicado: r?.objetivoAplicado === true,
    proteinaObjetivoGDia: numNut(r?.proteinaObjetivoGDia),
    porcionesProteinaDia: numNut(r?.porcionesProteinaDia),
    proteinaRecalculada: r?.proteinaRecalculada === true,
    alimentosProteina: lista(r?.alimentosProteina).map(String),
    accionEntrenamiento: r?.accionEntrenamiento ?? null,
    porRendimiento: r?.porRendimiento === true,
  })).filter(r => r.fecha).sort((a,b) => a.fecha - b.fecha);

  const planJ = n.planTemporada;
  const plan = (planJ && typeof planJ === 'object') ? {
    id: String(planJ.id ?? ''),
    creado: parseFecha(planJ.creado),
    replanificado: parseFecha(planJ.replanificado),
    transicionPropuesta: parseFecha(planJ.transicionPropuesta),
    bloques: lista(planJ.bloques).map(b => {
      const inicio = parseFecha(b?.inicio), fin = parseFecha(b?.fin);
      const dias = (inicio && fin) ? diasEntre(inicio, fin) + 1 : 0;
      return {
        id: String(b?.id ?? ''), tipo: b?.tipo ?? 'BRIDGE',
        inicio, fin, tasaPctSemana: numNut(b?.tasaPctSemana) ?? 0,
        dias, semanas: dias / 7,
      };
    }).filter(b => b.inicio && b.fin).sort((a,b) => a.inicio - b.inicio),
  } : null;

  const notifJ = n.notificaciones || {};

  return {
    presente: true,
    activo: n.activo === true,
    schemaVersion: numNut(n.schemaVersion) ?? 1,
    perfil,
    fase: fase(n.faseActual),
    fasesCerradas: lista(n.fasesCerradas).map(fase).filter(Boolean).sort((a,b) => (a.inicio||0) - (b.inicio||0)),
    pesajes,
    medicionesGrasa,
    recomendaciones,
    biblioteca: lista(n.biblioteca).map(a => ({
      nombre: String(a?.nombre ?? ''),
      estadoReferencia: a?.estadoReferencia ?? 'DRY_RAW',
      kcalPor100g: numNut(a?.kcalPor100g),
      macro: a?.macro ?? 'MIXED',
      pasoGramos: numNut(a?.pasoGramos),
    })),
    refeeds: lista(n.refeeds).map(r => ({ inicio: parseFecha(r?.inicio), dias: numNut(r?.dias) ?? NUT.refeedDays }))
      .filter(r => r.inicio).sort((a,b) => a.inicio - b.inicio),
    reanudaciones: lista(n.reanudaciones).map(r => ({ fecha: parseFecha(r?.fecha) }))
      .filter(r => r.fecha).sort((a,b) => a.fecha - b.fecha),
    marcasCiclo: lista(n.marcasCiclo).map(m => ({ fecha: parseFecha(m?.fecha) }))
      .filter(m => m.fecha).sort((a,b) => a.fecha - b.fecha),
    ultimaSolicitudGrasa: parseFecha(n.ultimaSolicitudGrasa),
    plan,
    notificaciones: {
      recordatorioPesajeActivo: notifJ.recordatorioPesajeActivo === true,
      tarjetaSemanalActiva: notifJ.tarjetaSemanalActiva === true,
      horaPesaje: numNut(notifJ.horaPesaje),
      minutoPesaje: numNut(notifJ.minutoPesaje),
    },
  };
}

/* ================================================================
   §3.4 — Ventanas de enmascaramiento (refeeds y vueltas de pausa)
   El pesaje NO se descarta: sigue anclando el nivel con R inflado.
   ================================================================ */
const Enmascaramiento = {
  construir(refeeds = [], reanudaciones = []){
    const dias = new Set();
    refeeds.forEach(r => {
      const total = (r.dias || NUT.refeedDays) + NUT.maskExtraDays;
      for (let i = 0; i < total; i++) dias.add(fmtISO(diaMas(r.inicio, i)));
    });
    reanudaciones.forEach(r => {
      for (let i = 0; i < NUT.maskExtraDays; i++) dias.add(fmtISO(diaMas(r.fecha, i)));
    });
    return dias;
  },
  // La app recalcula la marca al leer, así que un refeed prescrito después de
  // un pesaje también lo enmascara. Se hace igual aquí.
  marcar(pesajes, dias){
    return pesajes.map(p => ({ ...p, enmascarado: dias.has(p.clave) }));
  },
};

/* ================================================================
   §3.1–§3.2 — Filtro de Kalman de 2 estados sobre el peso
   Estado x = [m, v]: m tendencia (kg), v pendiente (kg/día).
   ================================================================ */
function crearFiltroPeso(){
  return {
    m: 0, v: 0, p00: 0, p01: 0, p10: 0, p11: 0, iniciado: false,

    predecir(dt, factorQNivel = 1){
      if (!this.iniciado) return;
      this.m += this.v * dt;
      const qm = NUT.qNivel * factorQNivel;
      const a00 = this.p00 + dt * (this.p01 + this.p10) + dt * dt * this.p11 + qm * dt;
      const a01 = this.p01 + dt * this.p11;
      const a10 = this.p10 + dt * this.p11;
      const a11 = this.p11 + NUT.qPendiente * dt;
      this.p00 = a00; this.p01 = a01; this.p10 = a10; this.p11 = a11;
    },

    actualizar(pesoKg, enmascarado = false){
      if (!this.iniciado){
        this.m = pesoKg; this.v = 0;
        this.p00 = NUT.pInicialNivel; this.p01 = 0; this.p10 = 0;
        this.p11 = NUT.pInicialPendiente;
        this.iniciado = true;
        return;
      }
      const sigma = NUT.noisePctBw * this.m;
      let r = sigma * sigma;
      if (enmascarado) r *= NUT.maskRFactor;
      const s = this.p00 + r;
      const k0 = this.p00 / s, k1 = this.p10 / s;
      const y = pesoKg - this.m;
      this.m += k0 * y;
      this.v += k1 * y;
      const n00 = (1 - k0) * this.p00;
      const n01 = (1 - k0) * this.p01;
      const n10 = this.p10 - k1 * this.p00;
      const n11 = this.p11 - k1 * this.p01;
      this.p00 = n00; this.p01 = n01; this.p10 = n10; this.p11 = n11;
    },

    get tasaPctSemana(){ return this.m <= 0 ? 0 : this.v * 7 / this.m * 100; },
  };
}

const EstimadorPeso = {
  /* Recorre día a día desde el primer pesaje; los huecos se propagan sin
     actualizar. `ventanasAgua` son inicios de fase: durante ventanaAguaDias
     el ruido de proceso del NIVEL se infla, para que el escalón de
     glucógeno/agua no contamine la pendiente (§3.3). */
  calcular(pesajes, { ventanasAgua = [], hasta = null } = {}){
    if (!pesajes.length) return { puntos: [], indice: new Map(), vacia: true };
    const porDia = new Map(pesajes.map(p => [p.clave, p]));
    const inicio = pesajes[0].fecha;
    let fin = pesajes[pesajes.length - 1].fecha;
    if (hasta && diasEntre(fin, hasta) > 0) fin = soloDia(hasta);

    const ventanas = ventanasAgua.filter(Boolean).map(soloDia);
    const factorAgua = dia => {
      for (const v of ventanas){
        const d = diasEntre(v, dia);
        if (d >= 0 && d < NUT.ventanaAguaDias) return NUT.ventanaAguaFactorQNivel;
      }
      return 1;
    };

    const filtro = crearFiltroPeso();
    const puntos = [];
    let acumulados = 0;
    const total = diasEntre(inicio, fin);
    for (let i = 0; i <= total; i++){
      const dia = diaMas(inicio, i);
      const clave = fmtISO(dia);
      if (filtro.iniciado) filtro.predecir(1, factorAgua(dia));
      const p = porDia.get(clave);
      if (p){ filtro.actualizar(p.pesoKg, p.enmascarado); acumulados++; }
      puntos.push({
        fecha: dia, clave,
        tendenciaKg: filtro.m,
        tasaPctSemana: filtro.tasaPctSemana,
        varianzaTasa: filtro.p11,
        pesajesAcumulados: acumulados,
        huboPesaje: !!p,
        enmascarado: p ? p.enmascarado : false,
      });
    }
    const indice = new Map(puntos.map((p, i) => [p.clave, i]));
    return { puntos, indice, vacia: false };
  },

  en(serie, fecha){
    const i = serie.indice.get(fmtISO(fecha));
    return i == null ? null : serie.puntos[i];
  },

  hasta(serie, fecha){
    let out = null;
    for (const p of serie.puntos){
      if (diasEntre(p.fecha, fecha) < 0) break;
      out = p;
    }
    return out;
  },

  /* Variable de control del lazo (§4). Con modo ciclo se diferencia sobre un
     ciclo completo en vez de usar la pendiente instantánea (§3.5). */
  tasaControl(serie, fecha, { modoCiclo = false, diasCiclo = null } = {}){
    const p = this.en(serie, fecha);
    if (!p) return null;
    if (!modoCiclo) return p.tasaPctSemana;
    const periodo = nutClamp(diasCiclo ?? NUT.cicloDiasDefecto, NUT.cicloDiasMin, NUT.cicloDiasMax);
    const previo = this.en(serie, diaMas(fecha, -periodo));
    if (!previo || p.tendenciaKg <= 0) return null;
    return (p.tendenciaKg - previo.tendenciaKg) / p.tendenciaKg * 100 / (periodo / 7);
  },
};

/* §3.5 — Duración real del ciclo: mediana de los últimos intervalos válidos
   entre días 1 declarados. Sin dos marcas, el nominal de 28. */
function duracionCiclo(marcas){
  if (!marcas || marcas.length < 2) return { dias: NUT.cicloDiasDefecto, ciclosMedidos: 0 };
  const fechas = [...new Map(marcas.map(m => [fmtISO(m.fecha), soloDia(m.fecha)])).values()]
    .sort((a,b) => a-b);
  const intervalos = [];
  for (let i = 1; i < fechas.length; i++){
    const d = diasEntre(fechas[i-1], fechas[i]);
    if (d >= NUT.cicloDiasMin && d <= NUT.cicloDiasMax) intervalos.push(d);
  }
  if (!intervalos.length) return { dias: NUT.cicloDiasDefecto, ciclosMedidos: 0 };
  const usados = intervalos.slice(Math.max(0, intervalos.length - NUT.cicloIntervalosMax));
  return { dias: Math.round(medianaNum(usados)), ciclosMedidos: usados.length };
}

/* ================================================================
   §5.3–§5.4 — Bandas de color del ritmo
   Cada tramo es cerrado por abajo y abierto por arriba.
   ================================================================ */
const BandaTasa = {
  umbralParaSexo(umbralHombrePct, sexo){
    return sexo === 'F' ? umbralHombrePct + NUT.particionDesplazamientoMujerPp : umbralHombrePct;
  },

  // Sin medición: tramo medio (es el defecto del documento).
  tramoGrasa(grasaVigentePct, sexo){
    if (grasaVigentePct == null) return 'medio';
    if (grasaVigentePct >= this.umbralParaSexo(NUT.umbralGrasaAltaHombrePct, sexo)) return 'alto';
    if (grasaVigentePct >= this.umbralParaSexo(NUT.umbralGrasaMediaHombrePct, sexo)) return 'medio';
    return 'bajo';
  },

  minimoSlider(tipo){
    if (tipo === 'DEFICIT') return NUT.tasaSliderDeficitMin;
    if (tipo === 'SURPLUS') return NUT.tasaRecomendadaSuperavitMin;
    return 0;
  },

  _cortesDeficit(grasaVigentePct, sexo){
    switch (this.tramoGrasa(grasaVigentePct, sexo)){
      case 'alto': return [[0,'neutro'], [NUT.bandaDeficitAltoVerdeMin,'verde'],
                           [NUT.topeTasaDeficit,'ambar'], [NUT.bandaDeficitAltoAmbarMax,'rojo']];
      case 'bajo': return [[0,'neutro'], [NUT.bandaDeficitBajoVerdeMin,'verde'],
                           [NUT.bandaDeficitBajoVerdeMax,'ambar'], [NUT.bandaDeficitBajoAmbarMax,'rojo']];
      default:     return [[0,'neutro'], [NUT.bandaDeficitMedioVerdeMin,'verde'],
                           [NUT.bandaDeficitMedioVerdeMax,'ambar'], [NUT.topeTasaDeficit,'rojo']];
    }
  },

  _cortesSuperavit(experiencia){
    switch (experiencia || 'INTERMEDIATE'){
      case 'NOVICE':   return [[0,'neutro'], [NUT.bandaSupPrincipianteVerdeMin,'verde'],
                               [NUT.bandaSupPrincipianteVerdeMax,'ambar']];
      case 'ADVANCED': return [[0,'verde'], [NUT.bandaSupAvanzadoVerdeMax,'ambar'],
                               [NUT.bandaSupAvanzadoAmbarMax,'rojo']];
      default:         return [[0,'neutro'], [NUT.bandaSupIntermedioVerdeMin,'verde'],
                               [NUT.bandaSupIntermedioVerdeMax,'ambar']];
    }
  },

  pista({ tipo, topeAbsPctSemana, grasaVigentePct = null, sexo = null, experiencia = null }){
    if (tipo === 'MAINTENANCE' || !(topeAbsPctSemana > 0)) return [];
    const min = this.minimoSlider(tipo);
    if (topeAbsPctSemana <= min) return [];
    const cortes = tipo === 'DEFICIT'
      ? this._cortesDeficit(grasaVigentePct, sexo)
      : this._cortesSuperavit(experiencia);
    const out = [];
    for (let i = 0; i < cortes.length; i++){
      const desde = Math.max(cortes[i][0], min);
      const siguiente = i + 1 < cortes.length ? cortes[i+1][0] : topeAbsPctSemana;
      const hasta = Math.min(siguiente, topeAbsPctSemana);
      if (hasta <= desde) continue;
      out.push({ banda: cortes[i][1], desde, hasta });
    }
    return out;
  },

  evaluar({ tipo, tasaAbs, topeAbsPctSemana, grasaVigentePct = null, sexo = null, experiencia = null }){
    const tramos = this.pista({ tipo, topeAbsPctSemana, grasaVigentePct, sexo, experiencia });
    if (!tramos.length) return 'neutro';
    const v = Math.abs(tasaAbs);
    for (const t of tramos) if (v >= t.desde && v < t.hasta) return t.banda;
    return v < tramos[0].desde ? tramos[0].banda : tramos[tramos.length - 1].banda;
  },
};

/* ================================================================
   §6.1–§6.3 — Guardarraíles
   ================================================================ */
const GuardarrailesNut = {
  imc(perfil, pesoKg){
    if (!perfil || !(perfil.alturaCm > 0) || !(pesoKg > 0)) return null;
    const m = perfil.alturaCm / 100;
    return pesoKg / (m * m);
  },

  grasaHabilitaTopeAmpliado({ grasaVigentePct, diasDesdeMedicion, sexo, reactivando = false }){
    if (grasaVigentePct == null) return false;
    // Sin fecha se trata como caducada: es el lado seguro.
    if (diasDesdeMedicion == null || diasDesdeMedicion > NUT.grasaAvisoAmbarDias) return false;
    const umbral = BandaTasa.umbralParaSexo(NUT.umbralGrasaAltaHombrePct, sexo)
      + (reactivando ? NUT.umbralGrasaTopeReactivacionPp : 0);
    return grasaVigentePct >= umbral;
  },

  imcHabilitaTopeAmpliado(imc, reactivando = false){
    return imc != null && imc >= (reactivando ? NUT.imcUmbralAmpliadoReactivacion : NUT.imcUmbralAmpliado);
  },

  topeTasaInicial(tipo, { imc = null, grasaVigentePct = null, diasDesdeMedicion = null, sexo = null } = {}){
    if (tipo === 'SURPLUS') return NUT.topeTasaSuperavit;
    if (tipo !== 'DEFICIT') return 0;
    const ampliado = this.imcHabilitaTopeAmpliado(imc)
      || this.grasaHabilitaTopeAmpliado({ grasaVigentePct, diasDesdeMedicion, sexo });
    return ampliado ? NUT.topeTasaDeficitImcAlto : NUT.topeTasaDeficit;
  },

  /* §6.3 con la histéresis ya resuelta: el estado persistido de la fase
     (`topeImcAmpliadoActivo`) significa "tope ampliado activo", venga del IMC
     o del % graso. */
  evaluarTopeTasa({ fase, perfil, pesoTendenciaKg, grasaVigentePct = null, diasDesdeMedicion = null }){
    const imc = this.imc(perfil, pesoTendenciaKg);
    if (fase.tipo !== 'DEFICIT'){
      const tope = this.topeTasaInicial(fase.tipo, { imc });
      return { topeAbsPctSemana: tope, ampliadoActivo: false, imc };
    }
    const alguna = reactivando =>
      this.imcHabilitaTopeAmpliado(imc, reactivando)
      || this.grasaHabilitaTopeAmpliado({ grasaVigentePct, diasDesdeMedicion, sexo: perfil?.sexo, reactivando });
    const ampliado = fase.topeImcAmpliadoActivo === false ? alguna(true) : alguna(false);
    return {
      topeAbsPctSemana: ampliado ? NUT.topeTasaDeficitImcAlto : NUT.topeTasaDeficit,
      ampliadoActivo: ampliado, imc,
    };
  },

  // Katch-McArdle × factor de actividad. Cálculo interno: NO es un TDEE.
  ingestaMantenimientoEstimadaKcal(pesoTendenciaKg, grasaPct){
    if (!(pesoTendenciaKg > 0) || grasaPct == null || grasaPct <= 0 || grasaPct >= 100) return null;
    const magra = pesoTendenciaKg * (1 - grasaPct / 100);
    if (magra <= 0) return null;
    const basal = NUT.metabolismoBasalIntercepto + NUT.metabolismoBasalPorKgMagro * magra;
    const mant = basal * NUT.factorActividadEstimada;
    return isFinite(mant) && mant > 0 ? mant : null;
  },

  /* §6.1–6.2 — Tope efectivo del ajuste acumulado a la baja. Manda siempre la
     ingesta base declarada; sin ella se acepta la estimada, y el resultado es
     un min con el tope plano, así que la estimación solo puede apretarlo. */
  topeEfectivoDeficit(fase, ingestaEstimadaKcal = null){
    const declarada = fase && fase.ingestaBaseKcal;
    if (declarada != null && declarada > 0)
      return Math.min(NUT.topeDeficitKcal, NUT.sueloBasePct * declarada);
    if (ingestaEstimadaKcal == null || ingestaEstimadaKcal <= 0) return NUT.topeDeficitKcal;
    return Math.min(NUT.topeDeficitKcal,
      Math.max(NUT.topeDeficitEstimadoMinKcal, NUT.sueloBasePct * ingestaEstimadaKcal));
  },
};

/* ================================================================
   §3.3 — Asentamiento (por qué el lazo todavía no recomienda nada)
   ================================================================ */
const Asentamiento = {
  faseYaEnCurso(fase){ return (fase.semanasPreviasEnTipo || 0) >= NUT.steadyWeeksMin; },

  diasRequeridos(fase, diasCiclo = null){
    const base = this.faseYaEnCurso(fase) ? NUT.settlingMinDaysSteady : NUT.settlingMinDays;
    if (!fase.modoCiclo) return base;
    return Math.max(base, diasCiclo ?? NUT.settlingMinDaysCycle);
  },

  pesajesRequeridos(fase){
    return this.faseYaEnCurso(fase) ? NUT.settlingMinWeighinsSteady : NUT.settlingMinWeighins;
  },

  evaluar({ fase, serie, pesajes, hoy, diasCiclo = null }){
    const dReq = this.diasRequeridos(fase, diasCiclo);
    const pReq = this.pesajesRequeridos(fase);
    const dias = diasEntre(fase.inicio, hoy);
    const contados = pesajes.filter(p =>
      diasEntre(fase.inicio, p.fecha) >= 0 && diasEntre(p.fecha, hoy) >= 0).length;
    const punto = EstimadorPeso.hasta(serie, hoy);
    const varianza = punto ? punto.varianzaTasa : null;
    const varianzaOk = varianza != null && varianza <= NUT.settlingRateVar;
    return {
      asentado: dias >= dReq && contados >= pReq && varianzaOk,
      diasRequeridos: dReq, diasTranscurridos: dias,
      pesajesRequeridos: pReq, pesajesContados: contados,
      varianza, varianzaOk,
      fechaMinima: diaMas(fase.inicio, dReq),
      diasQueFaltan: Math.max(0, dReq - dias),
      pesajesQueFaltan: Math.max(0, pReq - contados),
    };
  },
};

/* ================================================================
   Implantación §3–§4 — Partición, curva teórica y reparto
   ================================================================ */
const Particion = {
  // Interpolación lineal entre anclas, con saturación en los extremos.
  deficitBase(grasaPct, sexo){
    const claves = Object.keys(NUT.particionDeficitAnclas).map(Number).sort((a,b) => a-b);
    const x = grasaPct - (sexo === 'F' ? NUT.particionDesplazamientoMujerPp : 0);
    if (x <= claves[0]) return NUT.particionDeficitAnclas[claves[0]];
    if (x >= claves[claves.length-1]) return NUT.particionDeficitAnclas[claves[claves.length-1]];
    for (let i = 1; i < claves.length; i++){
      const hasta = claves[i];
      if (x > hasta) continue;
      const desde = claves[i-1];
      const t = (x - desde) / (hasta - desde);
      return NUT.particionDeficitAnclas[desde] + (NUT.particionDeficitAnclas[hasta] - NUT.particionDeficitAnclas[desde]) * t;
    }
    return NUT.particionDeficitAnclas[claves[claves.length-1]];
  },

  superavitBase(experiencia){
    if (experiencia === 'NOVICE') return NUT.particionSuperavitPrincipiante;
    if (experiencia === 'ADVANCED') return NUT.particionSuperavitAvanzado;
    return NUT.particionSuperavitIntermedio;
  },

  /* `p` esperado: base por fase + penalización por la banda del ritmo. En
     déficit correr más deja peor reparto; en superávit, engorda más. */
  esperado({ tipo, grasaPct, sexo = null, experiencia = null, banda = 'verde' }){
    if (tipo === 'MAINTENANCE') return 0;
    if (tipo === 'DEFICIT'){
      const pen = banda === 'ambar' ? NUT.particionPenalizacionAmbar
                : banda === 'rojo'  ? NUT.particionPenalizacionRojo : 0;
      return nutClamp(this.deficitBase(grasaPct, sexo) - pen, NUT.particionDeficitMin, 1);
    }
    const pen = banda === 'ambar' ? NUT.particionSuperavitPenalizacionAmbar
              : banda === 'rojo'  ? NUT.particionSuperavitPenalizacionRojo : 0;
    return nutClamp(this.superavitBase(experiencia) + pen, 0, NUT.particionSuperavitMax);
  },
};

const CurvaGrasa = {
  /* §3.2 — Curva por tramos entre mediciones sobre el peso-tendencia. Cada
     medición nueva abre un ancla y la curva continúa desde el valor MEDIDO:
     el salto entre teórico y medido queda a la vista a propósito. */
  construir({ mediciones, pesoPorDia, hoy, sueloPct, tipoFase = 'MAINTENANCE',
              sexo = null, experiencia = null, banda = 'verde' }){
    if (!mediciones.length || !pesoPorDia.size) return null;
    const anclaPorDia = new Map(mediciones.map(m => [m.clave, m]));
    const inicio = soloDia(mediciones[0].fecha);
    let fin = soloDia(hoy);
    if (diasEntre(inicio, fin) < 0) fin = inicio;

    const puntos = [], anclas = [];
    let grasaKg = null, magraKg = null, pctPrevio = null;
    const techo = NUT.grasaRegistroMaxPct;
    const piso = sueloPct - NUT.margenBajoSueloPp;

    for (let d = 0; d <= diasEntre(inicio, fin); d++){
      const dia = diaMas(inicio, d);
      const clave = fmtISO(dia);
      const ancla = anclaPorDia.get(clave);
      if (ancla){
        grasaKg = ancla.grasaKg; magraKg = ancla.magraKg; pctPrevio = ancla.porcentajePct;
        anclas.push(ancla);
        puntos.push({ fecha: dia, clave, porcentajePct: ancla.porcentajePct,
                      pesoKg: ancla.pesoAnclaKg, ancla: true, recortadoAlSuelo: false });
        continue;
      }
      if (grasaKg == null) continue;             // antes del primer ancla no hay curva
      const peso = pesoPorDia.get(clave);
      if (peso == null || peso <= 0) continue;

      const p = Particion.esperado({ tipo: tipoFase, grasaPct: pctPrevio, sexo, experiencia, banda });
      const deltaW = peso - (grasaKg + magraKg);
      grasaKg = Math.max(0, grasaKg + p * deltaW);
      const bruto = peso <= 0 ? pctPrevio : grasaKg / peso * 100;
      const pct = nutClamp(bruto, piso, techo);
      pctPrevio = pct;
      grasaKg = peso * pct / 100;
      magraKg = peso - grasaKg;
      puntos.push({ fecha: dia, clave, porcentajePct: pct, pesoKg: peso,
                    ancla: false, recortadoAlSuelo: bruto < piso });
    }
    if (!puntos.length) return null;
    return { puntos, sueloPct, anclas, algunRecorteAlSuelo: puntos.some(p => p.recortadoAlSuelo) };
  },
};

const Reparto = {
  /* §4 — Reparto grasa/masa magra del último tramo entre mediciones.
     Con dos mediciones SIEMPRE hay cifras; el semáforo es el que se calla
     cuando falta alguna condición de §4.2, y dice cuál. */
  valorar({ mediciones, tipoFase, topeAbsPctSemana, tasaObjetivoPctSemana = null,
            sexo = null, experiencia = null, enmascaradas = new Set() }){
    if (!mediciones || mediciones.length < 2) return null;
    const anterior = mediciones[mediciones.length - 2];
    const ultima = mediciones[mediciones.length - 1];
    const dias = diasEntre(anterior.fecha, ultima.fecha);
    const deltaPeso = ultima.pesoAnclaKg - anterior.pesoAnclaKg;
    const deltaGrasa = ultima.grasaKg - anterior.grasaKg;
    const base = { anterior, ultima, dias, deltaPesoKg: deltaPeso,
                   deltaGrasaKg: deltaGrasa, deltaMagraKg: deltaPeso - deltaGrasa };
    const sin = motivo => ({ ...base, banda: null, motivo });

    if (enmascaradas.has(anterior.clave) || enmascaradas.has(ultima.clave)) return sin('enmascarada');
    if (dias < NUT.grasaValoracionDiasMin) return sin('intervaloCorto');
    if (Math.abs(deltaPeso) < NUT.grasaCambioMinimoKg) return sin('cambioPequeno');
    if (anterior.metodo !== ultima.metodo) return sin('metodosDistintos');
    if (!tipoFase || tipoFase === 'MAINTENANCE') return sin('sinFaseComparable');
    const signo = tipoFase === 'DEFICIT' ? -1 : 1;
    if (deltaPeso * signo <= 0) return sin('pesoEnContra');

    const pObs = deltaGrasa / deltaPeso;
    // El `p` esperado se evalúa con el % graso y el ritmo DEL INTERVALO: el
    // punto de partida es la medición anterior, no la vigente (§4.3).
    const banda = BandaTasa.evaluar({
      tipo: tipoFase, tasaAbs: Math.abs(tasaObjetivoPctSemana ?? 0),
      topeAbsPctSemana, grasaVigentePct: anterior.porcentajePct, sexo, experiencia,
    });
    const pEsp = Particion.esperado({
      tipo: tipoFase, grasaPct: anterior.porcentajePct, sexo, experiencia, banda,
    });
    return { ...base, fraccionGrasaObservada: pObs, fraccionGrasaEsperada: pEsp,
             banda: this._semaforo(tipoFase, pObs, pEsp), motivo: null };
  },

  /* §4.3 — En déficit conviene que p_obs sea ALTO (la pérdida sale de la
     grasa); en superávit, BAJO. Las tolerancias se aplican al revés. */
  _semaforo(tipo, pObs, pEsp){
    const { repartoToleranciaVerde: v, repartoToleranciaAmbar: a } = NUT;
    if (tipo === 'DEFICIT'){
      if (pObs >= pEsp - v) return 'verde';
      if (pObs >= pEsp - a) return 'ambar';
      return 'rojo';
    }
    if (pObs <= pEsp + v) return 'verde';
    if (pObs <= pEsp + a) return 'ambar';
    return 'rojo';
  },

  MOTIVOS: {
    enmascarada: 'una de las dos estimaciones cae en ventana de refeed o vuelta de pausa',
    intervaloCorto: `menos de ${NUT.grasaValoracionDiasMin} días entre estimaciones: manda el ruido`,
    cambioPequeno: `el peso se movió menos de ${NUT.grasaCambioMinimoKg} kg`,
    metodosDistintos: 'las dos estimaciones se hicieron con métodos distintos',
    sinFaseComparable: 'sin fase de déficit o superávit con la que comparar',
    pesoEnContra: 'el peso se movió en contra del signo de la fase',
  },
};

/* ================================================================
   Implantación §6 — Planificador de temporada
   ================================================================ */
const PlanTemporada = {
  rangosDuracion(tipo){
    if (tipo === 'BULK') return [NUT.volumenSemVerdeMin, NUT.volumenSemVerdeMax, NUT.volumenSemAmbarMin, NUT.volumenSemAmbarMax];
    if (tipo === 'CUT')  return [NUT.definicionSemVerdeMin, NUT.definicionSemVerdeMax, NUT.definicionSemAmbarMin, NUT.definicionSemAmbarMax];
    return [NUT.puenteSemVerdeMin, NUT.puenteSemVerdeMax, NUT.puenteSemAmbarMin, NUT.puenteSemAmbarMax];
  },

  colorDuracion(bloque){
    const [vMin, vMax, aMin, aMax] = this.rangosDuracion(bloque.tipo);
    const s = bloque.semanas;
    if (s >= vMin && s <= vMax) return 'verde';
    if (s >= aMin && s <= aMax) return 'ambar';
    return 'rojo';
  },

  tipoFase(tipoBloque){
    return tipoBloque === 'BULK' ? 'SURPLUS' : tipoBloque === 'CUT' ? 'DEFICIT' : 'MAINTENANCE';
  },

  colorGrasaFinal({ tipo, grasaFinPct, sexo, sueloPct }){
    if (tipo === 'BRIDGE') return 'verde';
    if (tipo === 'BULK'){
      const verde = BandaTasa.umbralParaSexo(NUT.volumenTechoVerdeHombrePct, sexo);
      const ambar = BandaTasa.umbralParaSexo(NUT.superavitTechoGrasaHombrePct, sexo);
      if (grasaFinPct <= verde) return 'verde';
      if (grasaFinPct <= ambar) return 'ambar';
      return 'rojo';
    }
    if (grasaFinPct >= sueloPct + NUT.definicionMargenVerdePp) return 'verde';
    if (grasaFinPct >= sueloPct) return 'ambar';
    return 'rojo';
  },

  pesoTrasDias(pesoInicialKg, tasaPctSemana, dias){
    return pesoInicialKg * Math.pow(1 + tasaPctSemana / 100, dias / 7);
  },

  // % graso al final de un bloque, integrando la partición con el mismo paso
  // diario que la curva de §3.2 (así plan y curva no pueden discrepar).
  _grasaTrasBloque({ pesoInicio, grasaInicioPct, tasaPctSemana, dias, tipoFase, sexo, experiencia, banda, sueloPct }){
    let grasaKg = pesoInicio * grasaInicioPct / 100;
    let pesoPrevio = pesoInicio, pct = grasaInicioPct;
    const piso = sueloPct - NUT.margenBajoSueloPp;
    for (let d = 1; d <= dias; d++){
      const peso = this.pesoTrasDias(pesoInicio, tasaPctSemana, d);
      const p = Particion.esperado({ tipo: tipoFase, grasaPct: pct, sexo, experiencia, banda });
      grasaKg = Math.max(0, grasaKg + p * (peso - pesoPrevio));
      pct = nutClamp(peso <= 0 ? pct : grasaKg / peso * 100, piso, NUT.grasaRegistroMaxPct);
      grasaKg = peso * pct / 100;
      pesoPrevio = peso;
    }
    return pct;
  },

  /* §6.3 — Proyección encadenada: el estado final de un bloque es el inicial
     del siguiente. El puente conserva peso y % graso. */
  proyectar(plan, { pesoPartidaKg, grasaPartidaPct, perfil = null, experiencia = null, diasDesdeMedicion = null }){
    if (!plan || !plan.bloques.length || !(pesoPartidaKg > 0) || grasaPartidaPct == null) return null;
    const sexo = perfil?.sexo ?? null;
    const suelo = sexo === 'F' ? NUT.sueloGrasaMujerPct : NUT.sueloGrasaHombrePct;
    let peso = pesoPartidaKg, grasa = grasaPartidaPct;
    const bloques = [];

    for (const bloque of plan.bloques){
      const pesoInicio = peso, grasaInicio = grasa;
      const tipoFase = this.tipoFase(bloque.tipo);
      const tope = GuardarrailesNut.topeTasaInicial(tipoFase, {
        imc: GuardarrailesNut.imc(perfil, pesoInicio),
        grasaVigentePct: grasaPartidaPct, diasDesdeMedicion, sexo,
      });
      // La banda se evalúa con el % graso proyectado AL INICIO del bloque (§6.4).
      const banda = tipoFase === 'MAINTENANCE' ? 'verde' : BandaTasa.evaluar({
        tipo: tipoFase, tasaAbs: Math.abs(bloque.tasaPctSemana), topeAbsPctSemana: tope,
        grasaVigentePct: grasaInicio, sexo, experiencia,
      });
      const dias = bloque.dias - 1;
      const pesoFin = bloque.tipo === 'BRIDGE' ? pesoInicio
        : this.pesoTrasDias(pesoInicio, bloque.tasaPctSemana, dias);
      const magraInicio = pesoInicio * (1 - grasaInicio / 100);
      const grasaFin = bloque.tipo === 'BRIDGE' ? grasaInicio
        : this._grasaTrasBloque({ pesoInicio, grasaInicioPct: grasaInicio,
            tasaPctSemana: bloque.tasaPctSemana, dias, tipoFase, sexo, experiencia, banda, sueloPct: suelo });
      const pesoMinimo = magraInicio <= 0 ? 0 : magraInicio / (1 - suelo / 100);
      const razonable = bloque.tipo !== 'CUT' || pesoFin >= pesoMinimo;

      bloques.push({
        bloque, pesoInicioKg: pesoInicio, pesoFinKg: pesoFin,
        grasaInicioPct: grasaInicio, grasaFinPct: grasaFin,
        pesoMinimoRazonableKg: pesoMinimo, pesoFinRazonable: razonable,
        colores: {
          duracion: this.colorDuracion(bloque),
          tasa: banda === 'neutro' ? 'verde' : banda,     // neutro cuenta como verde (§6.4)
          grasaFinal: razonable
            ? this.colorGrasaFinal({ tipo: bloque.tipo, grasaFinPct: grasaFin, sexo, sueloPct: suelo })
            : 'rojo',
        },
      });
      peso = pesoFin; grasa = grasaFin;
    }
    return { bloques, pesoPartidaKg, grasaPartidaPct, sueloPct: suelo };
  },

  bloqueEn(plan, dia){
    if (!plan) return null;
    const d = soloDia(dia);
    return plan.bloques.find(b => diasEntre(b.inicio, d) >= 0 && diasEntre(d, b.fin) >= 0) || null;
  },

  /* §6.6 — Estado del plan frente a la fase que el usuario tiene abierta. */
  estado(plan, { hoy, fase = null }){
    if (!plan || !plan.bloques.length) return 'sinPlan';
    const dia = soloDia(hoy);
    const fin = plan.bloques[plan.bloques.length - 1].fin;
    if (fin && diasEntre(fin, dia) > 0) return 'terminado';
    const bloque = this.bloqueEn(plan, dia);
    if (!bloque) return 'enCurso';
    if (fase && fase.estado !== 'CLOSED' && fase.tipo === this.tipoFase(bloque.tipo)) return 'enCurso';
    if (plan.transicionPropuesta && diasEntre(plan.transicionPropuesta, dia) >= NUT.planDesfaseDias)
      return 'desfasado';
    return 'transicionPendiente';
  },
};

/* ================================================================
   Contexto de nutrición para las vistas del entrenador
   ================================================================
   Reúne, en un solo objeto, todo lo que la app móvil enseña en su
   ventana de Nutrición más lo que solo el entrenador necesita
   (adherencia al pesaje, huecos, consumo del tope de ajuste).

   Referencia temporal: la serie del filtro NO se extrapola más allá
   del último pesaje —extenderla dibujaría una tendencia inventada—,
   mientras que la frescura (días sin pesarse, vigencia del % graso)
   se mide contra hoy de verdad, que es cuando el entrenador mira.
   ================================================================ */
const Nutricion = {
  contexto(nut, { hoy = new Date() } = {}){
    if (!nut || !nut.presente) return null;
    const ref = soloDia(hoy);
    const fase = nut.fase;
    const perfil = nut.perfil;

    // --- Enmascaramiento y serie del filtro ---
    const diasEnmascarados = Enmascaramiento.construir(nut.refeeds, nut.reanudaciones);
    const pesajes = Enmascaramiento.marcar(nut.pesajes, diasEnmascarados);
    // Ventana de agua solo si la fase arrancó de verdad (§3.3).
    const ventanasAgua = (fase && fase.inicio && !Asentamiento.faseYaEnCurso(fase)) ? [fase.inicio] : [];
    const serie = EstimadorPeso.calcular(pesajes, { ventanasAgua });
    const ultimoPunto = serie.vacia ? null : serie.puntos[serie.puntos.length - 1];
    const ultimoPesaje = pesajes.length ? pesajes[pesajes.length - 1] : null;

    const ciclo = duracionCiclo(nut.marcasCiclo);
    const tendenciaKg = (ultimoPunto && ultimoPunto.tendenciaKg > 0) ? ultimoPunto.tendenciaKg : null;
    const tasaPctSemana = !ultimoPunto ? null
      : (fase && fase.modoCiclo)
        ? EstimadorPeso.tasaControl(serie, ultimoPunto.fecha, { modoCiclo: true, diasCiclo: ciclo.dias })
        : ultimoPunto.tasaPctSemana;

    // --- % graso ---
    const mediciones = nut.medicionesGrasa;
    const grasaVigente = mediciones.length ? mediciones[mediciones.length - 1] : null;
    const grasaInicial = mediciones.length ? mediciones[0] : null;
    const diasDesdeMedicion = grasaVigente ? diasEntre(grasaVigente.fecha, ref) : null;
    const grasaVigentePct = grasaVigente ? grasaVigente.porcentajePct : null;
    const grasaCaducada = diasDesdeMedicion != null && diasDesdeMedicion > NUT.grasaAvisoAmbarDias;
    const sueloPct = perfil?.sexo === 'F' ? NUT.sueloGrasaMujerPct
                   : perfil?.sexo === 'M' ? NUT.sueloGrasaHombrePct : null;

    // --- Topes y bandas ---
    const pesoParaTope = tendenciaKg ?? (fase && fase.pesoObjetivoKg > 0 ? fase.pesoObjetivoKg : null);
    const topeInfo = fase
      ? GuardarrailesNut.evaluarTopeTasa({
          fase, perfil,
          pesoTendenciaKg: pesoParaTope && pesoParaTope > 0 ? pesoParaTope : NUT.pesoMinKg,
          grasaVigentePct, diasDesdeMedicion,
        })
      : { topeAbsPctSemana: NUT.topeTasaDeficit, ampliadoActivo: false, imc: null };

    const bandaObjetivo = (fase && fase.tipo !== 'MAINTENANCE')
      ? BandaTasa.evaluar({ tipo: fase.tipo, tasaAbs: Math.abs(fase.tasaObjetivoPctSemana),
          topeAbsPctSemana: topeInfo.topeAbsPctSemana, grasaVigentePct,
          sexo: perfil?.sexo, experiencia: perfil?.experienciaFuerza })
      : 'neutro';

    const bandaReal = (fase && fase.tipo !== 'MAINTENANCE' && tasaPctSemana != null)
      ? BandaTasa.evaluar({ tipo: fase.tipo, tasaAbs: Math.abs(tasaPctSemana),
          topeAbsPctSemana: topeInfo.topeAbsPctSemana, grasaVigentePct,
          sexo: perfil?.sexo, experiencia: perfil?.experienciaFuerza })
      : null;

    const pista = fase ? BandaTasa.pista({ tipo: fase.tipo, topeAbsPctSemana: topeInfo.topeAbsPctSemana,
      grasaVigentePct, sexo: perfil?.sexo, experiencia: perfil?.experienciaFuerza }) : [];

    // --- Desvío del ritmo respecto al objetivo (la variable del lazo) ---
    let desvioPctSemana = null, dentroBandaMuerta = null;
    if (fase && tasaPctSemana != null){
      desvioPctSemana = tasaPctSemana - fase.tasaObjetivoPctSemana;
      dentroBandaMuerta = Math.abs(desvioPctSemana) <= NUT.bandaMuertaPctSemana;
    }

    // --- Asentamiento ---
    const asentamiento = (fase && fase.inicio && !serie.vacia)
      ? Asentamiento.evaluar({ fase, serie, pesajes, hoy: ref,
          diasCiclo: fase.modoCiclo ? ciclo.dias : null })
      : null;

    // --- Tope del ajuste acumulado ---
    let topeAjuste = null;
    if (fase){
      const ingestaEstimada = GuardarrailesNut.ingestaMantenimientoEstimadaKcal(
        tendenciaKg ?? 0, grasaVigentePct);
      const tope = fase.tipo === 'SURPLUS'
        ? NUT.topeSuperavitKcal
        : GuardarrailesNut.topeEfectivoDeficit(fase, ingestaEstimada);
      const usado = Math.abs(fase.ajusteAcumuladoKcal);
      topeAjuste = {
        topeKcal: tope, usadoKcal: usado,
        pct: tope > 0 ? Math.min(100, Math.round(usado / tope * 100)) : null,
        agotado: tope > 0 && usado >= tope,
        ingestaEstimadaKcal: ingestaEstimada,
        declarada: fase.ingestaBaseKcal != null && fase.ingestaBaseKcal > 0,
      };
    }

    // --- Curva teórica de % graso ---
    const pesoPorDia = new Map(serie.puntos.map(p => [p.clave, p.tendenciaKg]));
    const curvaGrasa = (mediciones.length && sueloPct != null && !serie.vacia)
      ? CurvaGrasa.construir({
          mediciones, pesoPorDia, hoy: ultimoPunto ? ultimoPunto.fecha : ref, sueloPct,
          tipoFase: fase ? fase.tipo : 'MAINTENANCE',
          sexo: perfil?.sexo, experiencia: perfil?.experienciaFuerza, banda: bandaObjetivo,
        })
      : null;

    // --- Reparto del último tramo ---
    const reparto = Reparto.valorar({
      mediciones,
      tipoFase: (fase && fase.estado !== 'CLOSED') ? fase.tipo : null,
      topeAbsPctSemana: topeInfo.topeAbsPctSemana,
      tasaObjetivoPctSemana: fase ? fase.tasaObjetivoPctSemana : null,
      sexo: perfil?.sexo, experiencia: perfil?.experienciaFuerza,
      enmascaradas: diasEnmascarados,
    });

    // --- Adherencia al pesaje: sin pesajes el lazo está ciego ---
    const diasSinPesarse = ultimoPesaje ? diasEntre(ultimoPesaje.fecha, ref) : null;

    // --- Semanas en la fase ---
    const diasEnFase = (fase && fase.inicio) ? diasEntre(fase.inicio, ref) : null;

    // --- Plan de temporada ---
    const planEstado = PlanTemporada.estado(nut.plan, { hoy: ref, fase });
    const bloqueActual = PlanTemporada.bloqueEn(nut.plan, ref);
    const proyeccionPlan = nut.plan ? PlanTemporada.proyectar(nut.plan, {
      pesoPartidaKg: tendenciaKg ?? (ultimoPesaje ? ultimoPesaje.pesoKg : 0),
      grasaPartidaPct: grasaVigentePct,
      perfil, experiencia: perfil?.experienciaFuerza, diasDesdeMedicion,
    }) : null;

    return {
      nut, fase, perfil, pesajes, serie, ciclo,
      tendenciaKg, tasaPctSemana, ultimoPunto, ultimoPesaje,
      fechaTendencia: ultimoPunto ? ultimoPunto.fecha : null,
      mediciones, grasaVigente, grasaInicial, grasaVigentePct,
      diasDesdeMedicion, grasaCaducada, sueloPct, curvaGrasa,
      imc: topeInfo.imc, topeTasa: topeInfo.topeAbsPctSemana,
      topeAmpliadoActivo: topeInfo.ampliadoActivo,
      bandaObjetivo, bandaReal, pista,
      desvioPctSemana, dentroBandaMuerta,
      asentamiento, topeAjuste, reparto,
      diasSinPesarse, diasEnFase,
      diasEnmascarados,
      plan: nut.plan, planEstado, bloqueActual, proyeccionPlan,
      trinquete: fase ? fase.integracion : null,
    };
  },

  /* Adherencia al pesaje dentro de un rango: es lo primero que el entrenador
     puede accionar, porque sin pesajes el lazo no corrige nada. */
  adherenciaPesaje(pesajes, desde, hasta){
    const d = soloDia(desde), h = soloDia(hasta);
    const dentro = pesajes.filter(p => p.fecha >= d && p.fecha <= h);
    const dias = Math.max(1, diasEntre(d, h) + 1);
    const pct = Math.round(100 * dentro.length / dias);
    // Hueco mayor entre dos pesajes consecutivos del rango (incluye los bordes).
    let hueco = 0, huecoDesde = null, previo = d;
    dentro.forEach(p => {
      const g = diasEntre(previo, p.fecha);
      if (g > hueco){ hueco = g; huecoDesde = previo; }
      previo = p.fecha;
    });
    const gFinal = diasEntre(previo, h);
    if (gFinal > hueco){ hueco = gFinal; huecoDesde = previo; }
    return { pesajes: dentro, hechos: dentro.length, dias, pct,
             porSemana: dentro.length / (dias / 7), huecoMax: hueco, huecoDesde };
  },

  // Recomendación semanal vigente = la última emitida.
  ultimaRecomendacion(nut){
    return nut && nut.recomendaciones.length ? nut.recomendaciones[nut.recomendaciones.length - 1] : null;
  },

  // Series de refeeds y pausas expresadas como intervalos, para explicar mesetas.
  ventanas(nut){
    const out = [];
    (nut?.refeeds || []).forEach(r => out.push({
      tipo: 'refeed', inicio: r.inicio, fin: diaMas(r.inicio, r.dias - 1),
      finEnmascarado: diaMas(r.inicio, r.dias + NUT.maskExtraDays - 1), dias: r.dias,
    }));
    (nut?.reanudaciones || []).forEach(r => out.push({
      tipo: 'reanudacion', inicio: r.fecha, fin: r.fecha,
      finEnmascarado: diaMas(r.fecha, NUT.maskExtraDays - 1), dias: 1,
    }));
    return out.sort((a,b) => a.inicio - b.inicio);
  },
};
