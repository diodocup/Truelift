'use strict';
/* ================================================================
   TrueLift Escritorio — entrenador/temporada.js
   Modelo del editor de temporada del modo entrenador
   (PLAN_ENTRENADOR.md §7.4 de App-PRO). Solo cálculo, sin DOM.

   - La temporada del borrador es una lista ordenada de bloques relativos
     `{ tipo, semanas, ritmo }` (ritmo = magnitud en % del peso por
     semana; el signo lo pone el tipo). `paquete` la convierte en la
     `temporada` del contrato (CONTRATO_PLAN_ENTRENADOR.md §3.2).
   - Los límites del contrato (bloques, horizonte, tipos seguidos) se
     aplican al editar y `errores` los vuelve a mirar: lo que aquí se
     puede emitir es lo que `PaqueteEntrenador.validarCarga` acepta.
   - `analizar` hace lo mismo que la app al aplicar el plan
     (lib/plan_entrenador/temporada.dart · construirPlan): ancla el primer
     bloque hoy, encadena los demás y lleva cada ritmo a lo que el
     selector de la app permite con los datos del cliente
     (PlanificadorTemporada.topeDe → GuardarrailesNut.topeTasaInicial).
     Después proyecta con NutricionEsc.proyectar, la réplica de
     PlanificadorTemporada.proyectar de la app (con el cupo de masa
     magra), así que la proyección es la que verá el cliente.
   - Los textos de los avisos dicen qué hará la app, sin topes ni cifras
     del criterio.
   Reutiliza de ../coach/nutricion.js: NUT, BandaTasa, GuardarrailesNut,
   PlanTemporada, Nutricion y normalizarNutricion.
   ================================================================ */

const TemporadaEntrenador = (() => {

const L = PaqueteEntrenador.LIMITES;
const TIPOS = ['CUT', 'BRIDGE', 'BULK'];
const NOMBRE = { CUT: 'Definición', BULK: 'Volumen', BRIDGE: 'Normocalórica' };
// Valores con los que nace un bloque: dentro de lo habitual de cada tipo.
const DEFECTO = { CUT: { semanas: 8, ritmo: 0.5 }, BULK: { semanas: 16, ritmo: 0.25 }, BRIDGE: { semanas: 2, ritmo: 0 } };
// Siguiente tipo propuesto al añadir un bloque (nunca el mismo que el anterior).
const SIGUIENTE = { CUT: 'BRIDGE', BRIDGE: 'BULK', BULK: 'CUT' };
// Lo que deja escribir el campo del ritmo (% del peso por semana).
const RITMO_MIN = 0.05, RITMO_MAX = 2, RITMO_PASO = 0.05;
const EXPERIENCIA = { principiante: 'NOVICE', intermedio: 'INTERMEDIATE', avanzado: 'ADVANCED' };

const dia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const entre = (a, b) => Math.round((dia(b) - dia(a)) / 86400000);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const desdeIso = s => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d); };
const redondear = (v, dec = 2) => { const f = 10 ** dec; const r = Math.round(v * f) / f; return r === 0 ? 0 : r; };
const clonar = x => JSON.parse(JSON.stringify(x));
const numero = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

function bloqueDefecto(tipo){
  const t = TIPOS.includes(tipo) ? tipo : 'CUT';
  return { tipo: t, ...DEFECTO[t] };
}
const ritmoValido = (tipo, v) => {
  if (tipo === 'BRIDGE') return 0;
  const n = numero(v);
  if (n == null) return DEFECTO[tipo].ritmo;
  return redondear(Math.min(RITMO_MAX, Math.max(RITMO_MIN, Math.abs(n))), 2);
};
const totalSemanas = t => (t && Array.isArray(t.bloques) ? t.bloques : []).reduce((s, b) => s + (b.semanas || 0), 0);

/* Temporada guardada (o vieja, o basura) → forma del editor. null si no
   hay temporada. No corrige los tipos seguidos: eso lo dice `errores`. */
function normalizar(t){
  if (!t || typeof t !== 'object' || !Array.isArray(t.bloques)) return null;
  const bloques = t.bloques.filter(b => b && TIPOS.includes(b.tipo)).slice(0, L.bloquesMax).map(b => {
    const s = Math.round(numero(b.semanas) ?? DEFECTO[b.tipo].semanas);
    return { tipo: b.tipo, semanas: Math.max(1, Math.min(L.horizonteMaxSemanas, s)), ritmo: ritmoValido(b.tipo, b.ritmo ?? b.tasaPctSemana) };
  });
  return { bloques };
}

function nueva(tipo = 'CUT'){ return { bloques: [bloqueDefecto(tipo)] }; }

/* op: {tipo, i, valor, delta} → temporada nueva, o null si no aplica.
   Nunca muta la de entrada. */
function editar(temporada, op){
  const t = normalizar(temporada) || { bloques: [] };
  const b = t.bloques[op.i];
  const restoSemanas = i => totalSemanas(t) - (t.bloques[i] ? t.bloques[i].semanas : 0);
  switch (op.tipo){
    case 'addBloque': {
      if (t.bloques.length >= L.bloquesMax) return null;
      const libres = L.horizonteMaxSemanas - totalSemanas(t);
      if (libres < 1) return null;
      const ult = t.bloques[t.bloques.length - 1];
      const nb = bloqueDefecto(ult ? SIGUIENTE[ult.tipo] : 'CUT');
      nb.semanas = Math.min(nb.semanas, libres);
      t.bloques.push(nb);
      return t;
    }
    case 'delBloque': if (!b) return null; t.bloques.splice(op.i, 1); return t;
    case 'moverBloque': {
      const to = op.i + op.delta;
      if (!b || to < 0 || to >= t.bloques.length) return null;
      const [x] = t.bloques.splice(op.i, 1);
      t.bloques.splice(to, 0, x);
      return t;
    }
    case 'tipo': {
      if (!b || !TIPOS.includes(op.valor) || op.valor === b.tipo) return null;
      const deOA = b.tipo === 'BRIDGE' || op.valor === 'BRIDGE';
      b.tipo = op.valor;
      b.ritmo = deOA ? DEFECTO[op.valor].ritmo : ritmoValido(op.valor, b.ritmo);
      return t;
    }
    case 'semanas': {
      const n = numero(op.valor);
      if (!b || n == null) return null;
      b.semanas = Math.max(1, Math.min(L.horizonteMaxSemanas - restoSemanas(op.i), Math.round(n)));
      return t;
    }
    case 'ritmo': {
      if (!b || b.tipo === 'BRIDGE' || numero(op.valor) == null) return null;
      b.ritmo = ritmoValido(b.tipo, op.valor);
      return t;
    }
  }
  return null;
}

/* Lo que impediría emitir (los mismos límites que valida la app). */
function errores(temporada){
  const t = normalizar(temporada);
  const out = [];
  if (!t || !t.bloques.length){ out.push('La temporada no tiene bloques.'); return out; }
  if (t.bloques.length > L.bloquesMax) out.push(`Una temporada admite hasta ${L.bloquesMax} bloques.`);
  for (let i = 1; i < t.bloques.length; i++){
    if (t.bloques[i].tipo === t.bloques[i - 1].tipo){
      out.push(`Los bloques ${i} y ${i + 1} son los dos de ${NOMBRE[t.bloques[i].tipo].toLowerCase()}: la app no admite dos bloques seguidos del mismo tipo. Únelos o cambia uno.`);
    }
  }
  if (totalSemanas(t) > L.horizonteMaxSemanas) out.push(`La temporada no puede pasar de ${L.horizonteMaxSemanas} semanas en total.`);
  const err = PaqueteEntrenador.validarCarga({ id: 'pe_comprobacion', emitido: '2026-01-01',
    entrenador: { nombre: 'E' }, cliente: { nombre: 'C' }, temporada: paquete(t) });
  if (err && !out.length) out.push(`La app no aceptaría esta temporada (${err.detalle}).`);
  return out;
}

/* Temporada del paquete: el signo del ritmo sale del tipo. */
function paquete(temporada){
  const t = normalizar(temporada);
  if (!t || !t.bloques.length) return null;
  return { bloques: t.bloques.map(b => ({ tipo: b.tipo, semanas: b.semanas,
    tasaPctSemana: b.tipo === 'CUT' ? -redondear(b.ritmo) : b.tipo === 'BULK' ? redondear(b.ritmo) : 0 })) };
}

/* Temporada del paquete → editor (por ejemplo, la de un plan emitido). */
function desdePaquete(t){
  return normalizar(t && Array.isArray(t.bloques) ? { bloques: t.bloques.map(b => ({ tipo: b.tipo, semanas: b.semanas, ritmo: Math.abs(b.tasaPctSemana || 0) })) } : null);
}

// ---------------------------------------------------------------
// Datos del cliente: de su copia y, si faltan, de su ficha
// ---------------------------------------------------------------

/* Lo que la app usa para los topes y la proyección: peso tendencia de
   hoy, % graso vigente y su antigüedad, sexo, altura y experiencia. Manda
   la ficha del entrenador: lo que ha anotado es el punto de partida que
   viaja en el plan (cliente.datos) y el que la app propondrá al cliente. Lo
   que la ficha no trae sale de la copia. El % graso de la ficha cuenta como
   medido hoy. */
function datosCliente(raw, ficha, hoy = new Date()){
  let N = null;
  try {
    const nut = raw && raw.nutricion && typeof raw.nutricion === 'object' ? normalizarNutricion(raw) : null;
    N = nut && nut.presente ? Nutricion.contexto(nut, { hoy }) : null;
  } catch (_) { N = null; }
  const f = ficha && typeof ficha === 'object' ? PlanificadorEntrenador.leerFicha(ficha) : null;
  const origen = {};
  const tomar = (k, deCopia, deFicha) => {
    if (deFicha != null){ origen[k] = 'ficha'; return deFicha; }
    if (deCopia != null){ origen[k] = 'copia'; return deCopia; }
    return null;
  };
  const sexoCopia = N?.perfil?.sexo === 'M' || N?.perfil?.sexo === 'F' ? N.perfil.sexo
    : raw?.sexo === 'mujer' ? 'F' : raw?.sexo === 'hombre' ? 'M' : null;
  const sexo = tomar('sexo', sexoCopia, f?.sexo === 'mujer' ? 'F' : f?.sexo === 'hombre' ? 'M' : null);
  const alturaCm = tomar('altura', N?.perfil?.alturaCm > 0 ? N.perfil.alturaCm : null, f?.alturaCm);
  const experiencia = tomar('experiencia', N?.perfil?.experienciaFuerza || null, f?.experiencia ? EXPERIENCIA[f.experiencia] : null);
  const pesoCopia = N?.tendenciaKg > 0 ? N.tendenciaKg : N?.ultimoPesaje?.pesoKg > 0 ? N.ultimoPesaje.pesoKg
    : (typeof raw?.pesoCorporal === 'number' && raw.pesoCorporal > 0 ? raw.pesoCorporal : null);
  const pesoKg = tomar('peso', pesoCopia, f?.pesoKg);
  const grasaPct = tomar('grasa', N?.grasaVigentePct ?? null, f?.grasaPct);
  const diasDesdeMedicion = origen.grasa === 'copia' ? N.diasDesdeMedicion : origen.grasa === 'ficha' ? 0 : null;
  const faltan = [['peso', pesoKg], ['grasa', grasaPct], ['altura', alturaCm], ['sexo', sexo]].filter(([, v]) => v == null).map(([k]) => k);
  return { perfil: { sexo, alturaCm, experienciaFuerza: experiencia }, pesoKg, grasaPct, diasDesdeMedicion, origen, faltan,
           planCopia: N?.plan && N.plan.bloques.length ? N.plan : null };
}

/* Tope del ritmo de un tipo con los datos de hoy (PlanificadorTemporada.topeDe). */
function topeDe(tipo, datos){
  const d = datos || {};
  const imc = d.perfil && d.pesoKg > 0 ? GuardarrailesNut.imc(d.perfil, d.pesoKg) : null;
  return GuardarrailesNut.topeTasaInicial(PlanTemporada.tipoFase(tipo), {
    imc, grasaVigentePct: d.grasaPct ?? null, diasDesdeMedicion: d.diasDesdeMedicion ?? null, sexo: d.perfil?.sexo ?? null });
}

/* Ritmo con el que la app aplicará el bloque (temporada.dart · ritmoAjustado):
   signo del tipo y magnitud dentro de lo que su selector deja elegir. */
function ritmoApp(tipo, tasaPctSemana, tope){
  if (tipo === 'BRIDGE') return 0;
  const minimo = BandaTasa.minimoSlider(PlanTemporada.tipoFase(tipo));
  const maximo = tope > minimo ? tope : minimo;
  const m = Math.min(maximo, Math.max(minimo, Math.abs(tasaPctSemana)));
  return tipo === 'CUT' ? -m : m;
}

/* Bloques de la temporada que el cliente tiene en la app (su copia), en
   relativo desde hoy: el bloque en curso cuenta las semanas que le quedan. */
function desdePlanCopia(plan, hoy = new Date()){
  if (!plan || !Array.isArray(plan.bloques)) return null;
  const h = dia(hoy);
  const bloques = [];
  for (const b of plan.bloques){
    if (!b || !b.inicio || !b.fin || !TIPOS.includes(b.tipo) || entre(b.fin, h) > 0) continue;
    const dias = entre(entre(b.inicio, h) > 0 ? h : b.inicio, b.fin) + 1;
    const semanas = Math.max(1, Math.round(dias / 7));
    const prev = bloques[bloques.length - 1];
    if (prev && prev.tipo === b.tipo){ prev.semanas += semanas; continue; }
    bloques.push({ tipo: b.tipo, semanas, ritmo: Math.abs(b.tasaPctSemana || 0) });
  }
  const t = normalizar({ bloques });
  if (!t || !t.bloques.length) return null;
  // Dentro del horizonte que admite un plan.
  let libres = L.horizonteMaxSemanas;
  const dentro = [];
  for (const b of t.bloques){
    if (libres < 1) break;
    const s = Math.min(b.semanas, libres);
    libres -= s;
    dentro.push({ ...b, semanas: s });
  }
  return { bloques: dentro };
}

// ---------------------------------------------------------------
// Lo que hará la app: anclar, ajustar y proyectar
// ---------------------------------------------------------------

/* `datos` de datosCliente. Devuelve, por bloque, sus fechas si el cliente
   lo aplicase `hoy`, el ritmo del entrenador y el que aplicará la app, la
   proyección y los semáforos; y los avisos para el entrenador. */
function analizar(temporada, { datos = null, hoy = new Date() } = {}){
  const t = normalizar(temporada);
  if (!t || !t.bloques.length) return null;
  const d = datos || { perfil: {}, faltan: ['peso', 'grasa', 'altura', 'sexo'], origen: {} };
  const h = dia(hoy);
  let inicio = h;
  const bloques = t.bloques.map((b, i) => {
    const tasa = paquete({ bloques: [b] }).bloques[0].tasaPctSemana;
    const tope = topeDe(b.tipo, d);
    const tasaApp = redondear(ritmoApp(b.tipo, tasa, tope), 4);
    const fin = mas(inicio, b.semanas * 7 - 1);
    const r = { i, tipo: b.tipo, nombre: NOMBRE[b.tipo], semanas: b.semanas, tasa, tasaApp,
      ajuste: Math.abs(tasaApp - tasa) < 1e-9 ? null : Math.abs(tasaApp) < Math.abs(tasa) ? 'baja' : 'sube',
      inicio, fin, duracion: PlanTemporada.colorDuracion({ tipo: b.tipo, semanas: b.semanas }),
      // Hacia dónde se sale la duración (PlanificadorTemporada.motivoDuracion)
      // y lo habitual para su tipo: lo que la app enseña en su semáforo.
      motivoDuracion: motivoDuracion(b), habitual: PlanTemporada.rangosDuracion(b.tipo).slice(0, 2), proyeccion: null };
    inicio = mas(fin, 1);
    return r;
  });
  // Plan anclado con los ritmos de la app, como lo guardará construirPlan.
  const plan = { bloques: bloques.map(b => ({ id: `bloque-${b.i}`, tipo: b.tipo, inicio: b.inicio, fin: b.fin,
    tasaPctSemana: b.tasaApp, dias: b.semanas * 7, semanas: b.semanas })) };
  const sexo = d.perfil?.sexo ?? null, experiencia = d.perfil?.experienciaFuerza ?? null;
  const proy = d.pesoKg > 0 && d.grasaPct != null
    ? NutricionEsc.proyectar(plan, { pesoPartidaKg: d.pesoKg, grasaPartidaPct: d.grasaPct, hoy: h, perfil: d.perfil, diasDesdeMedicion: d.diasDesdeMedicion })
    : null;
  if (proy){
    proy.bloques.forEach((p, k) => {
      const b = bloques[k];
      const tipoFase = PlanTemporada.tipoFase(b.tipo);
      const tope = GuardarrailesNut.topeTasaInicial(tipoFase, { imc: GuardarrailesNut.imc(d.perfil, p.pesoInicioKg),
        grasaVigentePct: d.grasaPct, diasDesdeMedicion: d.diasDesdeMedicion, sexo });
      const banda = tipoFase === 'MAINTENANCE' ? 'verde' : BandaTasa.evaluar({ tipo: tipoFase, tasaAbs: Math.abs(b.tasaApp),
        topeAbsPctSemana: tope, grasaVigentePct: p.grasaInicioPct, sexo, experiencia });
      b.proyeccion = { pesoInicioKg: p.pesoInicioKg, pesoFinKg: p.pesoFinKg, grasaInicioPct: p.grasaInicioPct, grasaFinPct: p.grasaFinPct,
        razonable: p.pesoFinRazonable,
        colorRitmo: banda === 'neutro' ? 'verde' : banda,
        colorGrasaFinal: p.pesoFinRazonable ? PlanTemporada.colorGrasaFinal({ tipo: b.tipo, grasaFinPct: p.grasaFinPct, sexo, sueloPct: proy.sueloPct }) : 'rojo' };
    });
  }
  // Semáforo de cada bloque, como el borde de LineaTiempoPlan en la app: el
  // peor de sus chequeos (duración, ritmo y % graso final).
  const PESO = { verde: 0, ambar: 1, rojo: 2 };
  bloques.forEach(b => {
    const cs = [b.duracion, b.proyeccion?.colorRitmo, b.proyeccion?.colorGrasaFinal].filter(c => c in PESO);
    b.color = cs.reduce((a, c) => (PESO[c] > PESO[a] ? c : a), 'verde');
  });
  const ult = bloques[bloques.length - 1];
  const res = { bloques, inicio: h, fin: ult.fin, totalSemanas: totalSemanas(t), errores: errores(t), datos: d,
    // Curva diaria de la proyección (la de la gráfica del planificador de la app).
    curva: proy ? NutricionEsc.curva(proy, { hoy: h }) : null,
    proyeccion: proy && ult.proyeccion ? { pesoPartidaKg: proy.pesoPartidaKg, grasaPartidaPct: proy.grasaPartidaPct,
      pesoFinKg: ult.proyeccion.pesoFinKg, grasaFinPct: ult.proyeccion.grasaFinPct } : null };
  res.avisos = avisos(res);
  return res;
}

/* 'corta' | 'larga' | null: por qué lado se sale del verde la duración. */
function motivoDuracion(b){
  const [vMin, vMax] = PlanTemporada.rangosDuracion(b.tipo);
  return b.semanas < vMin ? 'corta' : b.semanas > vMax ? 'larga' : null;
}

/* «una definición», «un volumen», «una normocalórica». */
const CON_ARTICULO = { CUT: 'una definición', BULK: 'un volumen', BRIDGE: 'una normocalórica' };

/* Avisos para el entrenador: qué hará la app y qué conviene revisar. Uno por
   cada chequeo del semáforo de la app que no salga en verde (duración, ritmo y
   % graso final), para que lo que se ve en la línea de tiempo tenga siempre su
   explicación. Rojo en la app → «Revisa»; ámbar → «Nota». La duración dice
   hacia dónde se sale y lo habitual, como el semáforo de la app; el resto, sin
   topes ni cifras del criterio. */
function avisos(an){
  const out = [];
  const add = (nivel, txt) => out.push({ nivel, txt });
  const nivel = color => color === 'rojo' ? 'ambar' : 'azul';
  an.errores.forEach(e => add('rojo', e));
  const sinDatos = an.datos.faltan.filter(k => k === 'peso' || k === 'grasa' || k === 'altura');
  an.bloques.forEach(b => {
    const q = `Bloque ${b.i + 1} (${b.nombre.toLowerCase()})`;
    // Duración.
    if (b.duracion !== 'verde' && b.motivoDuracion){
      const [a, z] = b.habitual;
      const cuanto = `${b.duracion === 'rojo' ? 'muy' : 'algo'} ${b.motivoDuracion === 'corta' ? 'corto' : 'largo'}`;
      add(nivel(b.duracion), `${q}: es ${cuanto} (${F_SEM(b.semanas)}); lo habitual para ${CON_ARTICULO[b.tipo]} es de ${a} a ${z} semanas.`);
    }
    // Ritmo: primero lo que la app cambiará al aplicarlo; si no lo cambia,
    // cómo lo verá su semáforo con los datos del cliente.
    const p = b.proyeccion;
    if (b.ajuste === 'baja') add('ambar', `${q}: el ritmo es más rápido de lo que la app permite con los datos ${sinDatos.length ? 'que tienes' : 'actuales'} del cliente; lo bajará al aplicarlo.`);
    else if (b.ajuste === 'sube') add('ambar', `${q}: el ritmo es más lento de lo que la app deja elegir; lo subirá al aplicarlo.`);
    else if (p && b.tipo !== 'BRIDGE' && p.colorRitmo !== 'verde') add(nivel(p.colorRitmo), p.colorRitmo === 'rojo'
      ? `${q}: con los datos del cliente, la app marca este ritmo en rojo. Bájalo.`
      : `${q}: con los datos del cliente, la app marca este ritmo en ámbar. Valora bajarlo un poco.`);
    // Final del bloque.
    if (p && !p.razonable) add('ambar', `${q}: con este ritmo y esta duración la proyección acaba por debajo de un peso razonable. Acórtalo o baja el ritmo.`);
    else if (p && b.tipo !== 'BRIDGE' && p.colorGrasaFinal !== 'verde'){
      const alto = b.tipo === 'BULK';
      add(nivel(p.colorGrasaFinal), p.colorGrasaFinal === 'rojo'
        ? `${q}: la proyección acaba con un porcentaje graso ${alto ? 'alto' : 'muy bajo'}. Acórtalo o baja el ritmo.`
        : `${q}: la proyección acaba con un porcentaje graso ${alto ? 'algo alto' : 'algo bajo'}. Valora acortarlo o bajar el ritmo.`);
    }
  });
  if (!an.proyeccion){
    add('azul', 'Sin el peso y el porcentaje graso del cliente no hay proyección. Importa su copia o complétalo en su ficha.');
  } else if (sinDatos.length){
    add('azul', 'Faltan datos del cliente (por ejemplo, su altura): la app puede ajustar algún ritmo de forma distinta a lo que ves aquí.');
  }
  const orden = { rojo: 0, ambar: 1, azul: 2 };
  out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  return out;
}

const F_SEM = n => `${n} ${n === 1 ? 'semana' : 'semanas'}`;

// ---------------------------------------------------------------
// Estado de un plan emitido en la copia más reciente del cliente
// ---------------------------------------------------------------

/* Lee `planEntrenador` de la copia (App-PRO, lib/plan_entrenador/estado.dart)
   y dice qué pasó con el plan emitido `e` ({id, emitido, caduca}).
   `fechaCopia` es AAAA-MM-DD de la copia (lo más reciente que se sepa).
   estado: 'aPrueba' | 'aplicado' | 'pendiente' (solo falta su temporada) |
           'descartado' | 'sustituido' | 'copiaAnterior' | 'caducado' |
           'sinRastro' | 'sinCopia'. `rutina` y `temporada` dan el detalle. */
function estadoEmitido(e, raw, { fechaCopia = null, hoy = new Date() } = {}){
  if (!raw) return { estado: 'sinCopia' };
  const pe = raw.planEntrenador && typeof raw.planEntrenador === 'object' ? raw.planEntrenador : null;
  const ap = pe && pe.aplicado && typeof pe.aplicado === 'object' ? pe.aplicado : null;
  const historial = pe && Array.isArray(pe.historial) ? pe.historial.filter(l => l && typeof l.id === 'string') : [];
  const linea = [...historial].reverse().find(l => l.id === e.id);
  if (ap && ap.id === e.id){
    const rutina = ['aplicada', 'aPrueba', 'descartada'].includes(ap.rutina) ? ap.rutina : null;
    const temporada = ['aplicada', 'pendiente', 'descartada'].includes(ap.temporada) ? ap.temporada : null;
    const estado = rutina === 'aPrueba' ? 'aPrueba'
      : rutina === 'aplicada' || temporada === 'aplicada' ? 'aplicado'
      : temporada === 'pendiente' ? 'pendiente'
      : 'descartado';
    return { estado, aplicadoEn: typeof ap.aplicadoEn === 'string' ? ap.aplicadoEn : linea?.aplicadoEn || null, rutina, temporada };
  }
  if (linea) return { estado: 'sustituido', aplicadoEn: linea.aplicadoEn || null };
  if (fechaCopia && e.emitido && fechaCopia < e.emitido) return { estado: 'copiaAnterior' };
  if (e.caduca && e.caduca < iso(dia(hoy))) return { estado: 'caducado' };
  return { estado: 'sinRastro' };
}

/* Caducidad por defecto (días desde hoy) y fecha AAAA-MM-DD. */
const CADUCIDAD_DIAS = 90;
const caducidadDefecto = (hoy = new Date()) => iso(mas(dia(hoy), CADUCIDAD_DIAS));

return Object.freeze({ TIPOS, NOMBRE, DEFECTO, RITMO_MIN, RITMO_MAX, RITMO_PASO, CADUCIDAD_DIAS,
  nueva, normalizar, editar, errores, paquete, desdePaquete, totalSemanas, bloqueDefecto,
  datosCliente, topeDe, ritmoApp, desdePlanCopia, analizar, estadoEmitido, caducidadDefecto, iso, desdeIso, clonar });
})();
