'use strict';
/* ================================================================
   TrueLift Escritorio — nutricion-esc.js
   Cálculo de la sección «Nutrición» (solo lectura). Reproduce lo que la
   app enseña con los datos de la copia; aquí no se decide ni se cambia
   nada. Fuentes en App-PRO:
   - Pauta vigente y su historial: lib/nutricion/pauta.dart,
     ServicioNutricion.objetivoVigente / kcalDieta.
   - Reparto en macros y comidas: lib/nutricion/reparto_dieta.dart.
   - Plan de temporada: lib/nutricion/plan.dart (proyectar, con bloques
     consumidos, bloque en curso desde hoy y cupo de masa magra) y la
     curva diaria de nutricion_plan_screen.dart (_DatosGraficaPlan).
   - Ilustraciones del cuerpo: lib/estado_visual.dart.
   - Reproducción de las imágenes: nutricion_plan_reproduccion.dart.
   Reutiliza de ../coach/nutricion.js: NUT, BandaTasa, GuardarrailesNut,
   Particion, PlanTemporada (pesoTrasDias, tipoFase, colorDuracion,
   colorGrasaFinal) y ProgresoFase.
   ================================================================ */

const NutricionEsc = (() => {

const dia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const entre = (a, b) => Math.round((dia(b) - dia(a)) / 86400000);
const num = v => typeof v === 'number' && isFinite(v) ? v : null;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fecha = v => { const d = typeof v === 'string' ? parseFecha(v) : v instanceof Date ? v : null; return d ? dia(d) : null; };

/* Miles con punto, como la app (milesNutricion): 2.800. */
function miles(n){
  if (n == null || !isFinite(n)) return '—';
  const s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `−${s}` : s;
}

// ---------------------------------------------------------------
// Fase, modalidad y pauta
// ---------------------------------------------------------------
const FASE = { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' };
const MODALIDAD = { HABITUAL: 'Sin contar calorías', CALORIES: 'Objetivo de calorías', PENDING: 'Sin elegir' };
const EVENTO = {
  START: 'Inicio de etapa', MIGRATION: 'Pauta que ya seguías', ADJUSTMENT_ACCEPTED: 'Revisión aceptada',
  CUSTOMIZATION: 'Personalización', CUSTOMIZATION_REMOVED: 'Vuelta a lo recomendado',
  MODE_CHANGE: 'Cambio en cómo sigues la pauta', PHASE_CHANGE: 'Cambio de etapa', RATE_CHANGE: 'Cambio de ritmo',
};

function versiones(raw){
  const n = raw && raw.nutricion;
  return (n && Array.isArray(n.versionesPauta) ? n.versionesPauta : [])
    .filter(v => v && typeof v === 'object' && fecha(v.desde))
    .map(v => ({
      numero: num(v.numero) ?? 0, faseId: String(v.faseId ?? ''), desde: fecha(v.desde),
      evento: v.evento, modalidad: ['HABITUAL', 'CALORIES', 'PENDING'].includes(v.modalidad) ? v.modalidad : 'PENDING',
      kcalEfectivas: num(v.kcalEfectivas), kcalRecomendadas: num(v.kcalRecomendadas),
      personalizacionKcal: num(v.personalizacionKcal) ?? 0,
      cambioComidaKcalDia: num(v.cambioComidaKcalDia) ?? 0,
      diasReparto: num(v.diasReparto),
      pasosAcordadosDia: num(v.pasosAcordadosDia) ?? 0,
      tasaObjetivoPctSemana: num(v.tasaObjetivoPctSemana),
    }))
    .sort((a, b) => a.numero - b.numero);
}

/* Qué dice la pauta con esa versión (historial de la app, _resultado). */
function resultadoVersion(v){
  if (v.kcalEfectivas != null) return `${miles(v.kcalEfectivas)} kcal/día`;
  if (v.modalidad === 'HABITUAL'){
    const c = Math.round(v.cambioComidaKcalDia);
    if (c === 0) return 'Sin cambio en lo que comes';
    return c < 0 ? `come unas ${miles(-c)} kcal menos al día que antes` : `come unas ${miles(c)} kcal más al día que antes`;
  }
  return 'Sin cifra diaria';
}

/* Último cambio acordado siguiendo la alimentación habitual
   (_ultimoCambio de la tarjeta de energía). */
function ultimoCambioHabitual(vs){
  let ultima = null;
  vs.forEach(v => { if (v.modalidad === 'HABITUAL' && Math.round(v.cambioComidaKcalDia) !== 0) ultima = v; });
  if (!ultima) return null;
  const c = ultima.cambioComidaKcalDia, dias = ultima.diasReparto;
  let texto;
  if (dias != null && dias > 0){
    const semana = miles(Math.abs(c * 7)), cuando = dias === 1 ? 'un día' : `${dias} días`;
    texto = `unas ${semana} kcal ${c < 0 ? 'menos' : 'más'} a la semana, repartidas en ${cuando}; se repite cada semana hasta la próxima revisión`;
  } else texto = c < 0 ? `come unas ${miles(-c)} kcal menos al día que antes` : `come unas ${miles(c)} kcal más al día que antes`;
  return { desde: ultima.desde, texto };
}

// ---------------------------------------------------------------
// Reparto de la dieta (CalculadoraDieta.repartir)
// ---------------------------------------------------------------
const DIETA = {
  kcalP: 4, kcalC: 4, kcalG: 9,
  protMin: 1.4, protMax: 3.0, grasaMin: 0.6, grasaMinMujer: 0.8, grasaMax: 2.0, grasaDefecto: 0.9, hidratosMin: 1.5,
  comidasMin: 3, comidasMax: 5, plantillas: { 3: [30, 40, 30], 4: [25, 35, 15, 25], 5: [20, 10, 30, 10, 30] },
  puntosMin: 5, puntosMax: 60, protFraccionComidaMax: 0.6,
  grasaFactorEntreno: 0.7, grasaFactorEntrenoMin: 0.5, grasaFactorEntrenoPaso: 0.05,
  ligeras: { 3: [0], 4: [0, 2], 5: [0, 1, 3] }, puntosExtraEntreno: 5, redondeoKcalComida: 10,
};
const NOMBRES_COMIDA = { 3: ['Desayuno', 'Comida', 'Cena'], 4: ['Desayuno', 'Comida', 'Merienda', 'Cena'],
  5: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena'] };
const nombreComida = (n, i) => (NOMBRES_COMIDA[n] || [])[i] || `Comida ${i + 1}`;

/* PreferenciasDieta.fromJson con sus invariantes. Sin guardar, las de por
   defecto con tantas comidas como porciones de proteína tenga la fase. */
function preferencias(perfilJ, fase){
  const j = perfilJ && perfilJ.dieta && typeof perfilJ.dieta === 'object' ? perfilJ.dieta : null;
  const n = clamp(Math.trunc(num(j ? j.comidasDia : (fase && fase.porcionesProteinaDia)) ?? DIETA.comidasMin), DIETA.comidasMin, DIETA.comidasMax);
  const lista = j && Array.isArray(j.puntosComidas) ? j.puntosComidas.filter(p => typeof p === 'number').map(Math.trunc) : null;
  const puntos = lista && lista.length === n ? lista.map(p => clamp(p, DIETA.puntosMin, DIETA.puntosMax)) : DIETA.plantillas[n].slice();
  const enRango = v => typeof v === 'number' && v >= 0 && v < n ? Math.trunc(v) : null;
  const pre = enRango(j && j.comidaPreEntreno);
  let post = enRango(j && (j.comidaPostEntreno ?? j.comidaEntreno));
  if (pre != null && post != null && post <= pre) post = null;
  return { comidasDia: n, grasaGPorKg: clamp(num(j && j.grasaGPorKg) ?? DIETA.grasaDefecto, DIETA.grasaMin, DIETA.grasaMax),
           puntosComidas: puntos, comidaPreEntreno: pre, comidaPostEntreno: post,
           entreno: new Set([pre, post].filter(v => v != null)) };
}

/* Enteros que suman exactamente `total` (mayor resto). */
function enterosQueSuman(exactos, total){
  if (!exactos.length) return [];
  const suma = exactos.reduce((a, b) => a + b, 0);
  const escala = suma <= 0 ? 0 : total / suma;
  const esc = exactos.map(x => x * escala);
  const base = esc.map(Math.floor);
  let falta = total - base.reduce((a, b) => a + b, 0);
  const orden = exactos.map((_, i) => i).sort((a, b) => (esc[b] - base[b]) - (esc[a] - base[a]) || a - b);
  for (let j = 0; falta > 0 && orden.length; j++, falta--) base[orden[j % orden.length]]++;
  return base;
}

function repartir({ kcalDia, pesoReferenciaKg, proteinaGPorKg, pref, mujer }){
  if (!(kcalDia > 0) || !(pesoReferenciaKg > 0)) return null;
  const { kcalP: P, kcalC: C, kcalG: G } = DIETA;
  const k = kcalDia, w = pesoReferenciaKg;
  const enRango = (v, a, b) => b < a ? a : clamp(v, a, b);
  const hidMinKcal = w * DIETA.hidratosMin * C;
  const gMin = mujer ? DIETA.grasaMinMujer : DIETA.grasaMin;
  const pTecho = enRango((k - gMin * w * G - hidMinKcal) / (P * w), DIETA.protMin, DIETA.protMax);
  const p = enRango(proteinaGPorKg, DIETA.protMin, pTecho);
  const gTecho = enRango((k - p * w * P - hidMinKcal) / (G * w), gMin, DIETA.grasaMax);
  const g = enRango(pref.grasaGPorKg, gMin, gTecho);
  const protDia = p * w, grasaDia = g * w;
  const resto = k - protDia * P - grasaDia * G;
  const hidDia = Math.max(0, resto / C);

  const n = pref.comidasDia, entreno = pref.entreno, ligeras = DIETA.ligeras[n] || [];
  const puntos = pref.puntosComidas.map((x, i) => x + (entreno.has(i) && ligeras.includes(i) ? DIETA.puntosExtraEntreno : 0));
  const sumaPuntos = puntos.reduce((a, b) => a + b, 0);
  const fracc = puntos.map(x => x / sumaPuntos);
  const kcal = fracc.map(f => kcalDia * f);
  // Proteína a partes iguales, con techo por comida (relleno por niveles).
  const techo = kcal.map(x => x * DIETA.protFraccionComidaMax / P);
  let prot;
  if (techo.reduce((a, b) => a + b, 0) <= protDia){
    const sk = kcal.reduce((a, b) => a + b, 0);
    prot = kcal.map(x => protDia * x / sk);
  } else {
    prot = new Array(n).fill(0);
    const abiertas = new Set(kcal.map((_, i) => i));
    let pend = protDia;
    while (abiertas.size){
      const parte = pend / abiertas.size;
      const topadas = [...abiertas].filter(i => techo[i] < parte);
      if (!topadas.length){ abiertas.forEach(i => { prot[i] = parte; }); break; }
      topadas.forEach(i => { prot[i] = techo[i]; pend -= techo[i]; abiertas.delete(i); });
    }
  }
  const restoComida = kcal.map((x, i) => x - prot[i] * P);
  const grasaPorComida = factor => {
    const pesos = restoComida.map((x, i) => Math.max(0, x) * (entreno.has(i) ? factor : 1));
    const s = pesos.reduce((a, b) => a + b, 0);
    return s <= 0 ? restoComida.map(() => grasaDia / n) : pesos.map(x => grasaDia * x / s);
  };
  const construir = factor => {
    const grasa = grasaPorComida(factor);
    const hid = restoComida.map((x, i) => Math.max(0, (x - grasa[i] * G) / C));
    const sh = hid.reduce((a, b) => a + b, 0);
    const hidAj = sh <= 0 ? fracc.map(f => hidDia * f) : hid.map(x => x * hidDia / sh);
    const pG = enterosQueSuman(prot, Math.round(protDia));
    const gG = enterosQueSuman(grasa, Math.round(grasaDia));
    const hG = enterosQueSuman(hidAj, Math.round(hidDia));
    const r = DIETA.redondeoKcalComida;
    const kc = enterosQueSuman(kcal.map(x => x / r), Math.round(kcalDia / r)).map(x => x * r);
    const pct = enterosQueSuman(fracc.map(f => f * 100), 100);
    return kcal.map((_, i) => ({ indice: i, nombre: nombreComida(n, i), porcentaje: pct[i], kcal: kc[i],
      proteinaG: pG[i], hidratosG: hG[i], grasaG: gG[i],
      momento: i === pref.comidaPreEntreno ? 'antes' : i === pref.comidaPostEntreno ? 'despues' : null }));
  };
  const masHidratosEnEntreno = cs => {
    const otras = cs.filter(c => !c.momento).map(c => c.hidratosG);
    if (!otras.length) return true;
    const mx = Math.max(...otras);
    return cs.filter(c => c.momento).every(c => c.hidratosG > mx);
  };
  const desborda = grasa => grasa.some((x, i) => x * G > restoComida[i] + 1e-6);
  let comidas, entrenoSinMasHidratos = false;
  if (!entreno.size) comidas = construir(1);
  else {
    let mejor = null, listo = false;
    for (let f = DIETA.grasaFactorEntreno; f >= DIETA.grasaFactorEntrenoMin - 1e-9; f -= DIETA.grasaFactorEntrenoPaso){
      if (desborda(grasaPorComida(f))) break;
      mejor = construir(f);
      if (masHidratosEnEntreno(mejor)){ listo = true; break; }
    }
    comidas = mejor || construir(1);
    entrenoSinMasHidratos = !listo && !masHidratosEnEntreno(comidas);
  }
  const suma = k2 => comidas.reduce((a, c) => a + c[k2], 0);
  const out = { kcalDia, proteinaGPorKg: p, grasaGPorKg: g, pesoReferenciaKg: w,
    proteinaG: suma('proteinaG'), hidratosG: suma('hidratosG'), grasaG: suma('grasaG'),
    hidratosJustos: resto < hidMinKcal - 1e-6, comidas, entrenoSinMasHidratos };
  const total = out.proteinaG * P + out.hidratosG * C + out.grasaG * G;
  out.fraccion = total <= 0 ? { proteina: 0, hidratos: 0, grasa: 0 }
    : { proteina: out.proteinaG * P / total, hidratos: out.hidratosG * C / total, grasa: out.grasaG * G / total };
  return out;
}

// ---------------------------------------------------------------
// Plan de temporada (PlanificadorTemporada.proyectar)
// ---------------------------------------------------------------
const TIPO_BLOQUE = { CUT: 'Definición', BULK: 'Volumen', BRIDGE: 'Normocalórica' };
const MAGRA_TECHO_SEMANA = { NOVICE: 0.25, INTERMEDIATE: 0.12, ADVANCED: 0.05 };
const MAGRA_TECHO_CUPO_SEMANAS = 4;

/* Un tipo que se repite en el plan lleva número («Definición 1»). */
function nombresEtapas(bloques){
  const total = {}, vistos = {};
  bloques.forEach(b => { total[b.tipo] = (total[b.tipo] || 0) + 1; });
  return bloques.map(b => {
    const base = TIPO_BLOQUE[b.tipo] || b.tipo;
    if (total[b.tipo] <= 1) return base;
    vistos[b.tipo] = (vistos[b.tipo] || 0) + 1;
    return `${base} ${vistos[b.tipo]}`;
  });
}

/* CupoMagra: la ganancia magra se acredita contra un cupo que se acumula
   a razón del techo semanal; las pérdidas magras lo devuelven. */
function cupoMagra(experiencia){
  const porDia = (MAGRA_TECHO_SEMANA[experiencia] ?? MAGRA_TECHO_SEMANA.INTERMEDIATE) / 7;
  const maximo = porDia * 7 * MAGRA_TECHO_CUPO_SEMANAS;
  let disp = maximo;
  return {
    avanzar(d = 1){ if (d > 0) disp = Math.min(maximo, disp + d * porDia); },
    deltaGrasa(dPeso, fr){
      let grasa = fr * dPeso;
      const magra = (1 - fr) * dPeso;
      if (dPeso > 0){ const acr = Math.min(magra, disp); disp -= acr; grasa += magra - acr; }
      else if (dPeso < 0) disp = Math.min(maximo, disp - magra);
      return grasa;
    },
  };
}

function grasaTrasBloque({ pesoInicio, grasaInicioPct, tasaPctSemana, dias, tipoFase, sexo, experiencia, banda, sueloPct, cupo }){
  let grasaKg = pesoInicio * grasaInicioPct / 100, pesoPrevio = pesoInicio, pct = grasaInicioPct;
  const piso = sueloPct - 1;
  for (let d = 1; d <= dias; d++){
    cupo.avanzar();
    const peso = PlanTemporada.pesoTrasDias(pesoInicio, tasaPctSemana, d);
    const p = Particion.esperado({ tipo: tipoFase, grasaPct: pct, sexo, experiencia, banda });
    grasaKg = Math.max(0, grasaKg + cupo.deltaGrasa(peso - pesoPrevio, p));
    pct = clamp(peso <= 0 ? pct : grasaKg / peso * 100, piso, NUT.grasaRegistroMaxPct);
    grasaKg = peso * pct / 100;
    pesoPrevio = peso;
  }
  return pct;
}

function proyectar(plan, { pesoPartidaKg, grasaPartidaPct, hoy, perfil, diasDesdeMedicion }){
  if (!plan || !plan.bloques.length || !(pesoPartidaKg > 0) || grasaPartidaPct == null) return null;
  const sexo = perfil?.sexo ?? null, experiencia = perfil?.experienciaFuerza ?? null;
  const suelo = sexo === 'F' ? NUT.sueloGrasaMujerPct : NUT.sueloGrasaHombrePct;
  const d0 = dia(hoy);
  let peso = pesoPartidaKg, grasa = grasaPartidaPct, finAnterior = null;
  const bloques = [], consumidos = [], cupo = cupoMagra(experiencia);
  for (const bloque of plan.bloques){
    if (entre(bloque.fin, d0) > 0){ consumidos.push(bloque); continue; }
    const pesoInicio = peso, grasaInicio = grasa;
    const tipoFase = PlanTemporada.tipoFase(bloque.tipo);
    const tope = GuardarrailesNut.topeTasaInicial(tipoFase, { imc: GuardarrailesNut.imc(perfil, pesoInicio),
      grasaVigentePct: grasaPartidaPct, diasDesdeMedicion, sexo });
    const banda = tipoFase === 'MAINTENANCE' ? 'verde' : BandaTasa.evaluar({ tipo: tipoFase,
      tasaAbs: Math.abs(bloque.tasaPctSemana), topeAbsPctSemana: tope, grasaVigentePct: grasaInicio, sexo, experiencia });
    const enCurso = entre(bloque.inicio, d0) > 0;
    const dias = enCurso ? entre(d0, bloque.fin) : bloque.dias - 1;
    const inicioProy = enCurso ? d0 : dia(bloque.inicio);
    if (finAnterior) cupo.avanzar(entre(finAnterior, inicioProy));
    const pesoFin = bloque.tipo === 'BRIDGE' ? pesoInicio : PlanTemporada.pesoTrasDias(pesoInicio, bloque.tasaPctSemana, dias);
    const magraInicio = pesoInicio * (1 - grasaInicio / 100);
    const grasaFin = bloque.tipo === 'BRIDGE' ? grasaInicio : grasaTrasBloque({ pesoInicio, grasaInicioPct: grasaInicio,
      tasaPctSemana: bloque.tasaPctSemana, dias, tipoFase, sexo, experiencia, banda, sueloPct: suelo, cupo });
    if (bloque.tipo === 'BRIDGE') cupo.avanzar(dias);
    finAnterior = dia(bloque.fin);
    const pesoMinimo = magraInicio <= 0 ? 0 : magraInicio / (1 - suelo / 100);
    bloques.push({ bloque, pesoInicioKg: pesoInicio, pesoFinKg: pesoFin, grasaInicioPct: grasaInicio, grasaFinPct: grasaFin,
      enCurso, pesoFinRazonable: bloque.tipo !== 'CUT' || pesoFin >= pesoMinimo });
    peso = pesoFin; grasa = grasaFin;
  }
  return { bloques, consumidos, pesoPartidaKg, grasaPartidaPct, sueloPct: suelo };
}

/* Curva diaria del plan (_DatosGraficaPlan.desde): lo vivido con la
   tendencia y la curva de % graso; de hoy en adelante, la proyección
   interpolada dentro de cada bloque. */
function curva(proy, { hoy, pesoRealPorDia = new Map(), grasaRealPorDia = new Map() }){
  const bloques = [...proy.consumidos, ...proy.bloques.map(p => p.bloque)];
  if (!bloques.length) return null;
  const d0 = dia(bloques[0].inicio), dFin = dia(bloques[bloques.length - 1].fin), h = dia(hoy);
  const real = (mapa, d, respaldo) => {
    if (!mapa.size) return respaldo;
    const v = mapa.get(iso(d));
    if (v != null) return v;
    for (let s = 1; s <= 366; s++) for (const delta of [-s, s]){
      const x = mapa.get(iso(mas(d, delta)));
      if (x != null) return x;
    }
    return respaldo;
  };
  const proyectado = d => {
    for (const p of proy.bloques){
      if (entre(p.bloque.inicio, d) < 0 || entre(d, p.bloque.fin) < 0) continue;
      const ancla = entre(p.bloque.inicio, h) > 0 ? h : dia(p.bloque.inicio);
      const tramo = entre(ancla, p.bloque.fin);
      const t = tramo <= 0 ? 1 : clamp(entre(ancla, d) / tramo, 0, 1);
      return [p.pesoInicioKg + (p.pesoFinKg - p.pesoInicioKg) * t, p.grasaInicioPct + (p.grasaFinPct - p.grasaInicioPct) * t];
    }
    return null;
  };
  const puntos = [];
  for (let i = 0, total = entre(d0, dFin); i <= total; i++){
    const d = mas(d0, i);
    const teoria = entre(h, d) >= 0 ? proyectado(d) : null;
    const peso = teoria ? teoria[0] : real(pesoRealPorDia, d, proy.pesoPartidaKg);
    const grasa = teoria ? teoria[1] : real(grasaRealPorDia, d, proy.grasaPartidaPct);
    puntos.push({ fecha: d, pesoKg: peso, grasaPct: grasa, grasaKg: peso * grasa / 100, magraKg: peso * (1 - grasa / 100), futuro: !!teoria });
  }
  return { puntos, desde: d0, hasta: dFin };
}

// ---------------------------------------------------------------
// Ilustraciones del cuerpo (celdaEstadoVisual)
// ---------------------------------------------------------------
const LIMITES = {
  hombre: { alturaRefM: 1.80, grasaMin: 4, grasaMax: 45, ffmiMin: 15, ffmiMax: 28, cortesM: [18, 20, 22, 24], cortesG: [10, 13, 17, 22, 28] },
  mujer: { alturaRefM: 1.65, grasaMin: 10, grasaMax: 50, ffmiMin: 12, ffmiMax: 23, cortesM: [14, 16, 17.5, 19], cortesG: [16, 20, 24, 29, 35] },
};
const banda = (v, cortes) => { for (let i = 0; i < cortes.length; i++) if (v < cortes[i]) return i + 1; return cortes.length + 1; };
function celda({ mujer, alturaCm, pesoKg, grasaPct }){
  if (!(alturaCm > 0 && pesoKg > 0 && isFinite(grasaPct))) return null;
  const l = mujer ? LIMITES.mujer : LIMITES.hombre;
  if (grasaPct < l.grasaMin || grasaPct > l.grasaMax) return null;
  const h = alturaCm / 100;
  const ffmi = pesoKg * (1 - grasaPct / 100) / (h * h) + 6.1 * (l.alturaRefM - h);
  if (ffmi < l.ffmiMin || ffmi > l.ffmiMax) return null;
  return `m${banda(ffmi, l.cortesM)}g${banda(grasaPct, l.cortesG)}`;
}
const rutaCelda = (mujer, c) => c ? `estados/${mujer ? 'mujer' : 'hombre'}/${c}.webp` : null;

/* Rótulo de una fecha del plan respecto a hoy, como los − / + de la app. */
function rotuloFecha(d, { hoy, inicio, fin }){
  const n = entre(hoy, d);
  if (entre(d, fin) === 0) return 'Final';
  if (entre(d, inicio) === 0 && n < 0) return 'Inicio del plan';
  if (n < 0){ const s = Math.floor((-n + 6) / 7); return s === 1 ? 'Hace 1 semana' : `Hace ${s} semanas`; }
  return n < 7 ? 'Inicial' : `Semana ${Math.floor(n / 7)}`;
}

/* Reproducción de las imágenes (ReproduccionPlan): una ilustración y una
   etapa por día del tramo; dura siempre lo mismo y cada ilustración nueva
   aparece fundiéndose sobre la anterior. */
const DURACION_REPRODUCCION = 10;
const FUNDIDO_SEGUNDOS = 0.6;
function reproduccion({ curva: c, desde, hasta, bloques, nombres, mujer, alturaCm, hoy, fmt }){
  const i0 = clamp(entre(c.desde, desde), 0, c.puntos.length - 1), i1 = clamp(entre(c.desde, hasta), 0, c.puntos.length - 1);
  if (i1 < i0) return null;
  const tramo = c.puntos.slice(i0, i1 + 1);
  const rutas = tramo.map(p => rutaCelda(mujer, celda({ mujer, alturaCm, pesoKg: p.pesoKg, grasaPct: p.grasaPct })));
  const fin = dia(bloques[bloques.length - 1].fin), inicio = dia(bloques[0].inicio);
  const etapas = tramo.map(p => { const k = bloques.findIndex(b => entre(b.inicio, p.fecha) >= 0 && entre(p.fecha, b.fin) >= 0); return k < 0 ? null : nombres[k]; });
  const rotulos = tramo.map((p, d) => `${d === 0 || d === tramo.length - 1 ? rotuloFecha(p.fecha, { hoy, inicio, fin }) : rotuloIntermedio(p.fecha, hoy)} · ${fmt(p.fecha)}`);
  const cambios = [];
  for (let k = 1; k < rutas.length; k++) if (rutas[k] !== rutas[k - 1]) cambios.push(k);
  return {
    dias: rutas.length, rutas, etapas, rotulos,
    distintas: [...new Set(rutas.filter(Boolean))],
    en(t){
      const ultimo = rutas.length - 1, p = clamp(t, 0, 1) * ultimo, d = clamp(Math.round(p), 0, ultimo);
      let i = -1;
      for (let k = 0; k < cambios.length && cambios[k] <= p; k++) i = k;
      let base, encima = null, mezcla = 0;
      if (i < 0) base = rutas[0];
      else {
        const ci = cambios[i], sig = i + 1 < cambios.length ? cambios[i + 1] : ultimo;
        const fundido = Math.min(FUNDIDO_SEGUNDOS / DURACION_REPRODUCCION * ultimo, sig - ci);
        mezcla = fundido <= 0 ? 1 : clamp((p - ci) / fundido, 0, 1);
        if (mezcla >= 1) base = rutas[ci]; else { base = rutas[ci - 1]; encima = rutas[ci]; }
      }
      return { base, encima, mezcla: encima ? mezcla : 0, etapa: etapas[d], rotulo: rotulos[d], dia: d };
    },
  };
}
function rotuloIntermedio(d, hoy){
  const n = entre(hoy, d);
  if (n < 0){ const s = Math.floor((-n + 6) / 7); return s === 1 ? 'Hace 1 semana' : `Hace ${s} semanas`; }
  return n < 7 ? 'Inicial' : `Semana ${Math.floor(n / 7)}`;
}

// ---------------------------------------------------------------
// Modelo de la sección
// ---------------------------------------------------------------
/* Todo lo de la sección a fecha `ref` (el último registro de la copia,
   como el resto del escritorio). N = contexto de coach/nutricion.js. */
function preparar(raw, N, ref){
  const nJ = raw && raw.nutricion && typeof raw.nutricion === 'object' ? raw.nutricion : null;
  if (!nJ || !N) return { presente: false };
  const nut = N.nut, fase = N.fase && N.fase.estado !== 'CLOSED' ? N.fase : null;
  const vs = versiones(raw);
  const deFase = fase ? vs.filter(v => v.faseId === fase.id) : [];
  const vigente = deFase.length ? deFase[deFase.length - 1] : null;
  const modalidad = ['HABITUAL', 'CALORIES', 'PENDING'].includes(nJ.modalidad) ? nJ.modalidad : (vigente ? vigente.modalidad : 'PENDING');
  const perfilJ = nJ.perfil && typeof nJ.perfil === 'object' ? nJ.perfil : null;
  const mujer = N.perfil?.sexo === 'F' ? true : N.perfil?.sexo === 'M' ? false
    : raw.sexoUsuario === 'mujer' ? true : raw.sexoUsuario === 'hombre' ? false : null;
  const kcal = vigente ? vigente.kcalEfectivas : null;
  const pref = preferencias(perfilJ, fase);
  const reparto = fase && kcal != null
    ? repartir({ kcalDia: kcal, pesoReferenciaKg: fase.pesoObjetivoKg, proteinaGPorKg: fase.proteinaGPorKg, pref, mujer: mujer === true })
    : null;

  // Semana de la fase: «DÉFICIT · SEMANA N DE M».
  const prog = N.progreso;
  const semana = fase && fase.inicio ? Math.floor(Math.max(0, entre(fase.inicio, ref)) / 7) + 1 : null;
  const semanas = prog && prog.semanasTotales != null ? Math.ceil(prog.semanasTotales) : null;

  // Plan de temporada.
  let plan = null;
  if (nut.plan && nut.plan.bloques.length){
    const pesoPartida = N.tendenciaKg ?? (N.ultimoPesaje ? N.ultimoPesaje.pesoKg : null);
    const grasaTeorica = N.curvaGrasa && N.curvaGrasa.puntos.length ? N.curvaGrasa.puntos[N.curvaGrasa.puntos.length - 1].porcentajePct : null;
    const proy = proyectar(nut.plan, { pesoPartidaKg: pesoPartida, grasaPartidaPct: grasaTeorica ?? N.grasaVigentePct, hoy: ref,
      perfil: N.perfil, diasDesdeMedicion: N.diasDesdeMedicion });
    const nombres = nombresEtapas(nut.plan.bloques);
    const filas = nut.plan.bloques.map((b, i) => {
      const p = proy ? proy.bloques.find(x => x.bloque === b) : null;
      const estado = entre(b.fin, ref) > 0 ? 'terminada' : entre(b.inicio, ref) >= 0 ? 'enCurso' : 'proxima';
      return { bloque: b, nombre: nombres[i], estado, proyeccion: p };
    });
    const pesoRealPorDia = new Map(N.serie.vacia ? [] : N.serie.puntos.map(p => [iso(p.fecha), p.tendenciaKg]));
    const grasaRealPorDia = new Map(N.curvaGrasa ? N.curvaGrasa.puntos.map(p => [iso(p.fecha), p.porcentajePct]) : []);
    const c = proy ? curva(proy, { hoy: ref, pesoRealPorDia, grasaRealPorDia }) : null;
    const alturaCm = N.perfil?.alturaCm ?? null;
    let imagenes = { motivo: 'sinProyeccion' };
    if (proy && c){
      if (mujer == null || !(alturaCm > 0)) imagenes = { motivo: 'faltanDatos' };
      else {
        const ini = celda({ mujer, alturaCm, pesoKg: proy.pesoPartidaKg, grasaPct: proy.grasaPartidaPct });
        const ult = proy.bloques[proy.bloques.length - 1];
        const fin = ult ? celda({ mujer, alturaCm, pesoKg: ult.pesoFinKg, grasaPct: ult.grasaFinPct }) : ini;
        imagenes = !ini || !fin ? { motivo: 'fueraDeRango' } : { motivo: null, mujer, alturaCm };
      }
    }
    plan = { bloques: nut.plan.bloques, filas, nombres, proyeccion: proy, curva: c, imagenes,
             replanificado: nut.plan.replanificado, creado: nut.plan.creado, estado: N.planEstado };
  }

  return {
    presente: true, activo: nJ.activo === true, fase, ref, semana, semanas, modalidad,
    vigente, kcal, kcalRecomendadas: vigente ? vigente.kcalRecomendadas : null,
    personalizada: !!(vigente && vigente.personalizacionKcal),
    ultimoCambio: modalidad === 'HABITUAL' ? ultimoCambioHabitual(deFase) : null,
    pasosAcordados: vigente ? vigente.pasosAcordadosDia : 0,
    proteinaGDia: fase && fase.pesoObjetivoKg > 0 ? fase.pesoObjetivoKg * fase.proteinaGPorKg : null,
    reparto, pref, historial: vs.slice().reverse(), versionesFase: deFase,
    mujer, plan,
  };
}

/* Momento `t` (0–1) a lo largo de la curva, para situar una imagen. */
function puntoEn(c, d){
  if (!c) return null;
  return c.puntos[clamp(entre(c.desde, d), 0, c.puntos.length - 1)];
}

return { preparar, repartir, preferencias, proyectar, curva, celda, rutaCelda, rotuloFecha, reproduccion, nombresEtapas,
         puntoEn, resultadoVersion, miles, FASE, MODALIDAD, EVENTO, TIPO_BLOQUE, DURACION_REPRODUCCION, entre, mas, dia };
})();
