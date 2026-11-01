'use strict';
/* ================================================================
   TrueLift Escritorio — senales.js
   Semáforo de las señales nocturnas (VFC y FC en reposo) en Recuperación:
   qué papel juega cada una en la disponibilidad a fecha del último
   registro. Port de AppState.aporteVfcHoy / aporteFcReposoHoy y de la
   decisión que comparten con el estado diario (_autonomicoCausaEnFecha,
   App-PRO 29 y 31/10/2026).
   Diferencia conocida: los umbrales de VFC salen de VFC.umbrales
   (../coach/data.js), que no reproduce el corte por cambio de reloj o de
   app; tras un cambio de fuente la app reaprende y aquí no.
   ================================================================ */

const Senales = (() => {

const RACHA_MIN = 3, TENDENCIA_MIN_DIAS = 2, VENTANA_MIN = 5, BASE_MIN = 7, MAD_PISO = 0.03, FC_NOCHES_MIN = 14;
const dia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dias = (a, b) => Math.round((dia(b) - dia(a)) / 86400000);
const mediana = xs => VFC._mediana(xs);

function noches(R, campo, tope){
  return R.filter(r => r && r.fecha && !r.vfcDescartada && Number.isFinite(r[campo]) && dia(r.fecha) <= tope)
    .map(r => ({ f: dia(r.fecha), v: r[campo] })).sort((a, b) => a.f - b.f);
}
/* _ultimaNocheValida: la última noche hasta `tope`, si no tiene más de 2 días. */
function ultima(R, campo, tope){
  const n = noches(R, campo, tope);
  if (!n.length || dias(n[n.length - 1].f, tope) > 2) return null;
  return n[n.length - 1].v;
}
function racha(n, fuera){
  let r = 0, previa = null;
  for (let i = n.length - 1; i >= 0; i--){
    if (!fuera(n[i].v)) break;
    if (previa && dias(n[i].f, previa) > 2) break;
    r++; previa = n[i].f;
  }
  return r;
}

function preparar(raw, R, perfil, ref){
  const tope = dia(ref);
  const vfcActiva = raw.vfcActiva === true;
  const fcEnUso = vfcActiva || (raw.saludActiva === true && raw.readinessActivo === true);
  const uV = vfcActiva ? VFC.umbrales(R, perfil) : { baja: null, muyBaja: null };
  // _fcReposoUmbrales: mediana ± MAD de las últimas 30 noches (mínimo 14).
  let uF = { alta: null, muyAlta: null };
  if (fcEnUso){
    const v = noches(R, 'fcReposo', new Date(8.64e15)).map(x => x.v);
    if (v.length >= FC_NOCHES_MIN){
      const ult = v.slice(-30), med = mediana(ult);
      const mad = Math.max(mediana(ult.map(x => Math.abs(x - med))), med * MAD_PISO);
      uF = { alta: med + mad, muyAlta: med + 2 * mad };
    }
  }
  const fcUsable = uF.alta != null;
  const vfcNivel = () => { const v = ultima(R, 'vfc', tope); if (v == null || uV.baja == null) return 0; return v < uV.muyBaja ? 2 : v < uV.baja ? 1 : 0; };
  const fcNivel = () => { const v = ultima(R, 'fcReposo', tope); if (v == null || uF.alta == null) return 0; return v > uF.muyAlta ? 2 : v > uF.alta ? 1 : 0; };

  /* _vfcSostenidaEnFecha: racha de noches bajas o media de 7 días bajo la
     referencia previa durante dos noches seguidas. */
  function vfcSostenida(){
    if (!vfcActiva) return false;
    const n = noches(R, 'vfc', tope);
    if (!n.length || dias(n[n.length - 1].f, tope) > 2) return false;
    if (uV.baja != null && racha(n, v => v < uV.baja) >= RACHA_MIN) return true;
    const ult = n.length - 1;
    if (ult < 1) return false;
    const fin = n[ult].f, iniV = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 6);
    const ventana = n.filter(x => x.f >= iniV), base = n.filter(x => x.f < iniV);
    if (ventana.length < VENTANA_MIN || base.length < BASE_MIN) return false;
    const vb = base.slice(-30).map(x => x.v), med = mediana(vb);
    const mad = Math.max(mediana(vb.map(x => Math.abs(x - med))), med * MAD_PISO);
    const umbral = med - 0.75 * mad;
    const media = xs => xs.reduce((a, x) => a + x.v, 0) / xs.length;
    if (media(ventana) >= umbral) return false;
    if (TENDENCIA_MIN_DIAS <= 1) return true;
    const finP = n[ult - 1].f;
    if (dias(finP, fin) > 2) return false;
    const iniP = new Date(finP.getFullYear(), finP.getMonth(), finP.getDate() - 6);
    const vp = n.filter(x => x.f >= iniP && x.f <= finP);
    return vp.length >= VENTANA_MIN && media(vp) < umbral;
  }
  function fcAltaSostenida(){
    if (uF.alta == null) return false;
    const n = noches(R, 'fcReposo', tope);
    if (!n.length || dias(n[n.length - 1].f, tope) > 2) return false;
    return racha(n, v => v > uF.alta) >= RACHA_MIN;
  }
  /* _autonomicoCausaEnFecha. */
  function causa(){
    if (!fcEnUso) return null;
    const vn = vfcNivel(), fn = fcNivel();
    if (vfcSostenida()){
      const recuperado = fcUsable && fn === 0 && ultima(R, 'fcReposo', tope) != null && vn === 0;
      if (!recuperado) return 'vfcSostenida';
    }
    if (vn >= 1 && fn >= 1) return 'acuerdo';
    if (fcAltaSostenida()) return 'fcElevada';
    return null;
  }
  const c = causa();

  function vfc(){
    if (!vfcActiva) return { estado: 'inactiva' };
    if (uV.baja == null) return { estado: 'aprendiendo' };
    if (ultima(R, 'vfc', tope) == null) return { estado: 'sinNoche' };
    const fn = fcNivel();
    if (c === 'acuerdo') return { estado: 'frena', matiz: 'conLaOtra' };
    if (c === 'vfcSostenida') return { estado: 'frena', matiz: fn >= 1 ? 'conLaOtra' : 'sostenida' };
    if (vfcSostenida()) return { estado: 'aFavor', matiz: 'recuperada' };
    if (vfcNivel() >= 1){
      const fcNormal = fcUsable && fn === 0 && ultima(R, 'fcReposo', tope) != null;
      return { estado: 'vigilando', matiz: fcNormal ? 'otraNoConfirma' : null };
    }
    return { estado: 'aFavor' };
  }
  function fc(){
    if (!fcEnUso) return { estado: 'inactiva' };
    if (!fcUsable) return { estado: 'aprendiendo' };
    if (ultima(R, 'fcReposo', tope) == null) return { estado: 'sinNoche' };
    const fn = fcNivel();
    if (c === 'acuerdo' || (c === 'vfcSostenida' && fn >= 1)) return { estado: 'frena', matiz: 'conLaOtra' };
    if (c === 'fcElevada') return { estado: 'frena', matiz: fcAltaSostenida() ? 'sostenida' : 'muyFuera' };
    if (fn >= 1){
      const vfcNormal = uV.baja != null && vfcNivel() === 0 && ultima(R, 'vfc', tope) != null;
      return { estado: 'vigilando', matiz: vfcNormal ? 'otraNoConfirma' : null };
    }
    return { estado: 'aFavor' };
  }
  return { vfc: vfc(), fc: fc() };
}

/* Textos de la pastilla, los de la app. */
function texto(a, esVfc){
  const principal = {
    inactiva: 'No entra en tu disponibilidad', aprendiendo: 'Aprendiendo tu normal', sinNoche: 'Sin noche reciente',
    aFavor: 'Dentro de tu normal · no frena',
    vigilando: esVfc ? 'Más baja de lo habitual · vigilando' : 'Más alta de lo habitual · vigilando',
    frena: 'Está frenando la sesión de hoy',
  }[a.estado];
  const segunda = a.matiz ? {
    recuperada: 'Recuperada: la FC en reposo lo confirma',
    conLaOtra: esVfc ? 'Junto con la FC en reposo' : 'Junto con la VFC',
    otraNoConfirma: esVfc ? 'La FC en reposo no lo confirma' : 'La VFC no lo confirma',
    sostenida: esVfc ? 'Lleva días por debajo de tu normal' : 'Lleva días por encima de tu normal',
    muyFuera: 'Muy por encima de tu normal',
  }[a.matiz] : a.estado === 'aprendiendo' ? 'Aún no cuenta para tu disponibilidad'
    : a.estado === 'sinNoche' ? 'Hoy no cuenta para tu disponibilidad' : null;
  return { principal, segunda };
}

return { preparar, texto };
})();
