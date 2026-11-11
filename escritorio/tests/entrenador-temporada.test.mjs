// Plan de entrenador F5 — editor de temporada, caducidad y estado de los
// planes emitidos (PLAN_ENTRENADOR.md §7.4, §7.5 y §8.3 de App-PRO).
// Datos sintéticos y la copia de ejemplo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';
import { archivoClave, CLAVE_PRUEBAS, CONTRASENA_PRUEBAS } from './clave-pruebas.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'catalogo.js', 'canonico.js', 'planner.js');
const { TemporadaEntrenador: TE, PlanificadorEntrenador: PL, PaqueteEntrenador: P, ClaveEntrenador: CE, NutricionEsc } =
  cargar('analisis.js', 'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/clave.js', 'entrenador/temporada.js', 'entrenador/planificador.js');
const plain = x => JSON.parse(JSON.stringify(x));
const CLAVES = { [CLAVE_PRUEBAS.id]: CLAVE_PRUEBAS.publica };
const HOY = new Date(2026, 10, 10);
const L = P.LIMITES;
const ejemplo = () => JSON.parse(fs.readFileSync(new URL('./fixtures/copia_truelift_2026-11-06.json', import.meta.url), 'utf8'));
const datos = (o = {}) => ({ perfil: { sexo: 'M', alturaCm: 178, experienciaFuerza: 'INTERMEDIATE' }, pesoKg: 80, grasaPct: 18,
  diasDesdeMedicion: 3, origen: {}, faltan: [], ...o });
const editar = (t, ...ops) => ops.reduce((acc, op) => TE.editar(acc, op), t);

// ---------------------------------------------------------------
// Editor: límites del contrato aplicados al editar
// ---------------------------------------------------------------

test('editar: bloques alternos, hasta el máximo de bloques y del horizonte, sin mutar el original', () => {
  const t0 = TE.nueva('CUT');
  assert.deepEqual(plain(t0), { bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 0.5 }] });
  let t = editar(t0, { tipo: 'addBloque' }, { tipo: 'addBloque' }, { tipo: 'addBloque' });
  assert.deepEqual(t.bloques.map(b => b.tipo), ['CUT', 'BRIDGE', 'BULK', 'CUT']);
  assert.equal(t0.bloques.length, 1);
  t = editar(t, { tipo: 'addBloque' }, { tipo: 'addBloque' });
  assert.equal(t.bloques.length, L.bloquesMax);
  assert.equal(TE.editar(t, { tipo: 'addBloque' }), null);
  // Semanas: entero ≥ 1 y nunca por encima del horizonte total.
  const s = TE.editar(t, { tipo: 'semanas', i: 0, valor: '500' });
  assert.equal(TE.totalSemanas(s), L.horizonteMaxSemanas);
  assert.equal(TE.editar(t, { tipo: 'semanas', i: 0, valor: 0 }).bloques[0].semanas, 1);
  assert.equal(TE.editar(t, { tipo: 'semanas', i: 0, valor: '6,6' }).bloques[0].semanas, 7);
  assert.equal(TE.editar(t, { tipo: 'semanas', i: 0, valor: 'x' }), null);
  // Con el horizonte lleno no se pueden añadir bloques.
  assert.equal(TE.editar(editar(TE.nueva('BULK'), { tipo: 'semanas', i: 0, valor: L.horizonteMaxSemanas }), { tipo: 'addBloque' }), null);
});

test('editar: tipo, ritmo, mover y quitar', () => {
  const t = editar(TE.nueva('CUT'), { tipo: 'addBloque' }, { tipo: 'addBloque' });
  // Al pasar a normocalórica el ritmo es 0; al salir de ella, el de su tipo.
  const puente = TE.editar(t, { tipo: 'tipo', i: 0, valor: 'BRIDGE' });
  assert.deepEqual(plain(puente.bloques[0]), { tipo: 'BRIDGE', semanas: 8, ritmo: 0 });
  assert.equal(TE.editar(puente, { tipo: 'tipo', i: 0, valor: 'BULK' }).bloques[0].ritmo, TE.DEFECTO.BULK.ritmo);
  // Entre definición y volumen se conserva el ritmo.
  assert.equal(TE.editar(TE.editar(t, { tipo: 'ritmo', i: 0, valor: 0.7 }), { tipo: 'tipo', i: 0, valor: 'BULK' }).bloques[0].ritmo, 0.7);
  assert.equal(TE.editar(t, { tipo: 'tipo', i: 0, valor: 'CUT' }), null);
  assert.equal(TE.editar(t, { tipo: 'tipo', i: 0, valor: 'OTRO' }), null);
  // Ritmo: magnitud, con coma, dentro del campo; el puente no tiene ritmo.
  assert.equal(TE.editar(t, { tipo: 'ritmo', i: 0, valor: '-0,75' }).bloques[0].ritmo, 0.75);
  assert.equal(TE.editar(t, { tipo: 'ritmo', i: 0, valor: 9 }).bloques[0].ritmo, TE.RITMO_MAX);
  assert.equal(TE.editar(t, { tipo: 'ritmo', i: 0, valor: 0 }).bloques[0].ritmo, TE.RITMO_MIN);
  assert.equal(TE.editar(t, { tipo: 'ritmo', i: 1, valor: 0.5 }), null);
  // Mover y quitar.
  assert.deepEqual(TE.editar(t, { tipo: 'moverBloque', i: 2, delta: -1 }).bloques.map(b => b.tipo), ['CUT', 'BULK', 'BRIDGE']);
  assert.equal(TE.editar(t, { tipo: 'moverBloque', i: 0, delta: -1 }), null);
  assert.deepEqual(TE.editar(t, { tipo: 'delBloque', i: 1 }).bloques.map(b => b.tipo), ['CUT', 'BULK']);
  assert.equal(TE.editar(t, { tipo: 'delBloque', i: 7 }), null);
});

test('errores: tipos seguidos impiden emitir; lo emitible pasa la validación del paquete', () => {
  const t = editar(TE.nueva('CUT'), { tipo: 'addBloque' }, { tipo: 'addBloque' });
  assert.deepEqual(TE.errores(t), []);
  const seguidos = TE.editar(t, { tipo: 'delBloque', i: 1 });
  assert.deepEqual(TE.errores(editar(seguidos, { tipo: 'tipo', i: 1, valor: 'CUT' })).length, 1);
  assert.match(TE.errores(editar(seguidos, { tipo: 'tipo', i: 1, valor: 'CUT' }))[0], /dos bloques seguidos del mismo tipo/);
  assert.match(TE.errores(null)[0], /no tiene bloques/);
  assert.match(TE.errores({ bloques: [] })[0], /no tiene bloques/);
  // Lo que no da error lo acepta la validación de la app (contrato §3).
  for (const tt of [t, TE.nueva('BRIDGE'), TE.nueva('BULK'), editar(t, { tipo: 'semanas', i: 0, valor: 60 })]){
    assert.equal(P.validarCarga({ id: 'pe_x', emitido: '2026-11-10', entrenador: { nombre: 'A' }, cliente: { nombre: 'B' }, temporada: TE.paquete(tt) }), null);
  }
});

test('paquete: signo del ritmo por tipo, puente a 0 y vuelta al editor', () => {
  const t = editar(TE.nueva('BULK'), { tipo: 'ritmo', i: 0, valor: 0.3 }, { tipo: 'addBloque' }, { tipo: 'tipo', i: 1, valor: 'BRIDGE' },
    { tipo: 'addBloque' }, { tipo: 'tipo', i: 2, valor: 'CUT' });
  const pq = TE.paquete(t);
  assert.deepEqual(plain(pq), { bloques: [{ tipo: 'BULK', semanas: 16, tasaPctSemana: 0.3 }, { tipo: 'BRIDGE', semanas: 8, tasaPctSemana: 0 },
    { tipo: 'CUT', semanas: 16, tasaPctSemana: -0.25 }] });
  assert.ok(pq.bloques.every(b => b.tipo === 'CUT' ? b.tasaPctSemana < 0 : b.tipo === 'BULK' ? b.tasaPctSemana > 0 : Object.is(b.tasaPctSemana, 0)));
  assert.deepEqual(plain(TE.desdePaquete(pq)), plain(TE.normalizar(t)));
  assert.equal(TE.paquete(null), null);
  assert.equal(TE.paquete({ bloques: [] }), null);
  // Una temporada guardada con basura se sanea.
  assert.deepEqual(plain(TE.normalizar({ bloques: [{ tipo: 'CUT', semanas: '6', ritmo: '-0.6' }, { tipo: 'X' }, null, { tipo: 'BRIDGE', semanas: 2, ritmo: 3 }] })),
    { bloques: [{ tipo: 'CUT', semanas: 6, ritmo: 0.6 }, { tipo: 'BRIDGE', semanas: 2, ritmo: 0 }] });
});

// ---------------------------------------------------------------
// Lo que hará la app: anclar, ajustar y proyectar
// ---------------------------------------------------------------

test('analizar: ancla hoy y encadena como construirPlan de la app', () => {
  const t = { bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 0.5 }, { tipo: 'BRIDGE', semanas: 2, ritmo: 0 }, { tipo: 'BULK', semanas: 12, ritmo: 0.25 }] };
  const an = TE.analizar(t, { datos: datos(), hoy: HOY });
  const f = d => TE.iso(d);
  assert.deepEqual(an.bloques.map(b => [f(b.inicio), f(b.fin)]),
    [['2026-11-10', '2027-01-04'], ['2027-01-05', '2027-01-18'], ['2027-01-19', '2027-04-12']]);
  assert.equal(an.totalSemanas, 22);
  assert.equal(f(an.fin), '2027-04-12');
  assert.deepEqual(an.bloques.map(b => b.tasa), [-0.5, 0, 0.25]);
  assert.deepEqual(an.errores, []);
});

test('analizar: los ritmos se ajustan como ritmoAjustado de la app (tope de hoy y mínimo del selector)', () => {
  const t = { bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 1.4 }, { tipo: 'BULK', semanas: 12, ritmo: 0.05 }, { tipo: 'CUT', semanas: 6, ritmo: 0.1 }] };
  // IMC normal: el tope de definición es el base.
  const an = TE.analizar(t, { datos: datos(), hoy: HOY });
  assert.deepEqual(an.bloques.map(b => b.ajuste), ['baja', 'sube', 'sube']);
  assert.deepEqual(an.bloques.map(b => b.tasaApp), [-NUT.topeTasaDeficit, NUT.tasaRecomendadaSuperavitMin, -NUT.tasaSliderDeficitMin]);
  // Cada ritmo que aplicará la app cumple tasaEnTopes: signo y magnitud entre el mínimo y el tope.
  for (const b of an.bloques){
    const tope = TE.topeDe(b.tipo, datos());
    const m = Math.abs(b.tasaApp);
    assert.ok(m >= BandaTasa.minimoSlider(PlanTemporada.tipoFase(b.tipo)) - 1e-12 && m <= tope + 1e-12);
    assert.equal(Math.sign(b.tasaApp), Math.sign(b.tasa));
  }
  // IMC alto: el tope ampliado deja pasar el ritmo de la definición.
  const alto = TE.analizar(t, { datos: datos({ pesoKg: 120, perfil: { sexo: 'M', alturaCm: 170 } }), hoy: HOY });
  assert.equal(alto.bloques[0].ajuste, null);
  assert.equal(alto.bloques[0].tasaApp, -1.4);
  // % graso alto y reciente también lo amplía; caducado, no.
  assert.equal(TE.topeDe('CUT', datos({ grasaPct: 30, diasDesdeMedicion: 2 })), NUT.topeTasaDeficitImcAlto);
  assert.equal(TE.topeDe('CUT', datos({ grasaPct: 30, diasDesdeMedicion: 60 })), NUT.topeTasaDeficit);
  // El volumen nunca pasa de su tope; el puente es 0.
  assert.equal(TE.ritmoApp('BULK', 2, TE.topeDe('BULK', datos())), NUT.topeTasaSuperavit);
  assert.equal(TE.ritmoApp('BRIDGE', 0, 0), 0);
});

test('analizar: la proyección es la de la app y coincide con PlanTemporada.proyectar', () => {
  const t = { bloques: [{ tipo: 'CUT', semanas: 10, ritmo: 0.6 }, { tipo: 'BRIDGE', semanas: 3, ritmo: 0 }, { tipo: 'BULK', semanas: 16, ritmo: 0.25 }] };
  const d = datos();
  const an = TE.analizar(t, { datos: d, hoy: HOY });
  const plan = { bloques: an.bloques.map(b => ({ tipo: b.tipo, inicio: b.inicio, fin: b.fin, tasaPctSemana: b.tasaApp, dias: b.semanas * 7, semanas: b.semanas })) };
  const esc = NutricionEsc.proyectar(plan, { pesoPartidaKg: 80, grasaPartidaPct: 18, hoy: HOY, perfil: d.perfil, diasDesdeMedicion: 3 });
  assert.deepEqual(an.bloques.map(b => b.proyeccion.pesoFinKg), esc.bloques.map(p => p.pesoFinKg));
  assert.deepEqual(an.bloques.map(b => b.proyeccion.grasaFinPct), esc.bloques.map(p => p.grasaFinPct));
  // Con la proyección del Coach: el peso de todos los bloques y el % graso
  // de la definición y del puente son idénticos (el Coach no lleva el cupo
  // de masa magra del volumen).
  const coach = PlanTemporada.proyectar(plan, { pesoPartidaKg: 80, grasaPartidaPct: 18, perfil: d.perfil, experiencia: 'INTERMEDIATE', diasDesdeMedicion: 3 });
  an.bloques.forEach((b, i) => assert.ok(Math.abs(b.proyeccion.pesoFinKg - coach.bloques[i].pesoFinKg) < 1e-9));
  for (const i of [0, 1]) assert.ok(Math.abs(an.bloques[i].proyeccion.grasaFinPct - coach.bloques[i].grasaFinPct) < 1e-9);
  assert.ok(an.bloques[0].proyeccion.pesoFinKg < 80 && an.bloques[2].proyeccion.pesoFinKg > an.bloques[1].proyeccion.pesoFinKg);
  assert.equal(an.bloques[1].proyeccion.pesoFinKg, an.bloques[1].proyeccion.pesoInicioKg);
  assert.equal(an.proyeccion.pesoFinKg, an.bloques[2].proyeccion.pesoFinKg);
  // La proyección usa el ritmo que aplicará la app, no el escrito.
  const rapido = TE.analizar({ bloques: [{ tipo: 'CUT', semanas: 10, ritmo: 2 }] }, { datos: d, hoy: HOY });
  const tope = TE.analizar({ bloques: [{ tipo: 'CUT', semanas: 10, ritmo: NUT.topeTasaDeficit }] }, { datos: d, hoy: HOY });
  assert.equal(rapido.proyeccion.pesoFinKg, tope.proyeccion.pesoFinKg);
  // Sin peso o sin % graso no hay proyección, pero sí bloques y fechas.
  const sin = TE.analizar(t, { datos: datos({ grasaPct: null, faltan: ['grasa'] }), hoy: HOY });
  assert.equal(sin.proyeccion, null);
  assert.equal(sin.bloques[0].proyeccion, null);
  assert.match(sin.avisos.map(a => a.txt).join('\n'), /no hay proyección/);
});

test('avisos: ajustes de ritmo, duración y final de la proyección, sin topes ni cifras', () => {
  const t = { bloques: [{ tipo: 'CUT', semanas: 30, ritmo: 1.8 }, { tipo: 'BRIDGE', semanas: 2, ritmo: 0 }, { tipo: 'BULK', semanas: 70 - 32, ritmo: 0.05 }] };
  const an = TE.analizar(t, { datos: datos({ grasaPct: 12, pesoKg: 70 }), hoy: HOY });
  const txt = an.avisos.map(a => `${a.nivel}:${a.txt}`).join('\n');
  assert.match(txt, /ambar:Bloque 1 \(definición\): el ritmo es más rápido de lo que la app permite/);
  assert.match(txt, /ambar:Bloque 3 \(volumen\): el ritmo es más lento de lo que la app deja elegir/);
  assert.match(txt, /ambar:Bloque 1 \(definición\): la duración se sale de lo habitual/);
  assert.match(txt, /Bloque 1 \(definición\): .*(peso razonable|porcentaje graso muy bajo)/);
  assert.doesNotMatch(txt, /%|umbral|tope|ventana|\d+[.,]\d/i);
  // Dos bloques seguidos del mismo tipo: aviso rojo, primero.
  const mal = TE.analizar({ bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 0.5 }, { tipo: 'CUT', semanas: 4, ritmo: 0.5 }] }, { datos: datos(), hoy: HOY });
  assert.equal(mal.avisos[0].nivel, 'rojo');
  // Datos parciales: se avisa de que la app puede ajustar distinto.
  const parcial = TE.analizar({ bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 0.5 }] }, { datos: datos({ perfil: { sexo: 'M' }, faltan: ['altura'] }), hoy: HOY });
  assert.match(parcial.avisos.map(a => a.txt).join('\n'), /Faltan datos del cliente/);
  // Una temporada corriente no da avisos.
  assert.deepEqual(TE.analizar({ bloques: [{ tipo: 'CUT', semanas: 8, ritmo: 0.5 }, { tipo: 'BRIDGE', semanas: 2, ritmo: 0 }] }, { datos: datos(), hoy: HOY }).avisos, []);
});

// ---------------------------------------------------------------
// Datos del cliente y temporada de su copia
// ---------------------------------------------------------------

test('datos del cliente: de su copia y, si faltan, de su ficha', () => {
  const raw = ejemplo();
  const d = TE.datosCliente(raw, null, HOY);
  const N = Nutricion.contexto(normalizarNutricion(raw), { hoy: HOY });
  assert.equal(d.pesoKg, N.tendenciaKg);
  assert.equal(d.grasaPct, N.grasaVigentePct);
  assert.equal(d.diasDesdeMedicion, N.diasDesdeMedicion);
  assert.deepEqual(plain(d.perfil), { sexo: 'M', alturaCm: 176, experienciaFuerza: 'ADVANCED' });
  assert.deepEqual(d.faltan, []);
  assert.equal(d.origen.peso, 'copia');
  assert.ok(d.planCopia && d.planCopia.bloques.length === 2);
  // La ficha completa lo que la copia no trae; su % graso cuenta como de hoy.
  const sinNut = { ...copiaRica(), nutricion: undefined, sexo: 'mujer', pesoCorporal: undefined };
  const f = TE.datosCliente(sinNut, { sexo: 'hombre', pesoKg: 64, alturaCm: 165, grasaPct: 27, experiencia: 'principiante' }, HOY);
  assert.deepEqual(plain(f.perfil), { sexo: 'F', alturaCm: 165, experienciaFuerza: 'NOVICE' });
  assert.deepEqual([f.pesoKg, f.grasaPct, f.diasDesdeMedicion, f.origen.sexo, f.origen.grasa], [64, 27, 0, 'copia', 'ficha']);
  // Sin copia ni ficha.
  const nada = TE.datosCliente(null, null, HOY);
  assert.deepEqual(nada.faltan, ['peso', 'grasa', 'altura', 'sexo']);
  assert.equal(TE.analizar(TE.nueva('CUT'), { datos: nada, hoy: HOY }).proyeccion, null);
});

test('temporada desde la que el cliente tiene en la app: lo que queda, en relativo', () => {
  const raw = ejemplo();
  const plan = TE.datosCliente(raw, null, HOY).planCopia;
  // Volumen del 5/11 al 10/3 (en curso: le quedan 121 días) y definición del 11/3 al 26/5.
  assert.deepEqual(plain(TE.desdePlanCopia(plan, HOY)), { bloques: [{ tipo: 'BULK', semanas: 17, ritmo: 0.1 }, { tipo: 'CUT', semanas: 11, ritmo: 0.5 }] });
  // Con el volumen ya terminado solo queda la definición.
  assert.deepEqual(plain(TE.desdePlanCopia(plan, new Date(2027, 2, 20))), { bloques: [{ tipo: 'CUT', semanas: 10, ritmo: 0.5 }] });
  assert.equal(TE.desdePlanCopia(plan, new Date(2027, 6, 1)), null);
  assert.equal(TE.desdePlanCopia(null, HOY), null);
});

// ---------------------------------------------------------------
// Estado de los planes emitidos en la copia más reciente
// ---------------------------------------------------------------

test('estado de un plan emitido según planEntrenador de su copia', () => {
  const e = { id: 'pe_a', emitido: '2026-11-10', caduca: '2027-02-08' };
  const con = pe => ({ ...copiaRica(), planEntrenador: pe });
  const ap = (o = {}) => ({ aplicado: { id: 'pe_a', emitido: '2026-11-10', entrenador: 'Ana', cliente: 'Luis', nota: '', aplicadoEn: '2026-11-12', ...o },
    historial: [{ id: 'pe_a', aplicadoEn: '2026-11-12' }] });
  const st = (raw, o = {}) => plain(TE.estadoEmitido(e, raw, { fechaCopia: '2026-11-20', hoy: HOY, ...o }));
  assert.deepEqual(st(null), { estado: 'sinCopia' });
  assert.deepEqual(st(con(ap({ rutina: 'aPrueba', temporada: null }))), { estado: 'aPrueba', aplicadoEn: '2026-11-12', rutina: 'aPrueba', temporada: null });
  assert.equal(st(con(ap({ rutina: 'aplicada', temporada: 'pendiente' }))).estado, 'aplicado');
  assert.equal(st(con(ap({ rutina: null, temporada: 'pendiente' }))).estado, 'pendiente');
  assert.equal(st(con(ap({ rutina: null, temporada: 'aplicada' }))).estado, 'aplicado');
  assert.equal(st(con(ap({ rutina: 'descartada', temporada: 'aplicada' }))).estado, 'aplicado');
  assert.equal(st(con(ap({ rutina: 'descartada', temporada: null }))).estado, 'descartado');
  assert.equal(st(con(ap({ rutina: 'descartada', temporada: 'descartada' }))).estado, 'descartado');
  // Otro plan aplicado después: queda en el historial.
  const otro = { aplicado: { id: 'pe_b', aplicadoEn: '2026-12-01', rutina: 'aplicada' }, historial: [{ id: 'pe_a', aplicadoEn: '2026-11-12' }, { id: 'pe_b', aplicadoEn: '2026-12-01' }] };
  assert.deepEqual(st(con(otro)), { estado: 'sustituido', aplicadoEn: '2026-11-12' });
  // Sin rastro: copia anterior al plan, plan caducado o, si no, sin rastro.
  assert.equal(st(con(undefined), { fechaCopia: '2026-11-01' }).estado, 'copiaAnterior');
  assert.equal(st(con(undefined), { hoy: new Date(2027, 2, 1) }).estado, 'caducado');
  assert.equal(st(con({ aplicado: null, historial: [] })).estado, 'sinRastro');
  assert.equal(st(con('basura')).estado, 'sinRastro');
  assert.equal(st(con({ aplicado: 'x', historial: [null, 3] })).estado, 'sinRastro');
});

// ---------------------------------------------------------------
// Borradores y emisión
// ---------------------------------------------------------------

test('borradores: los de antes llevan rutina y no temporada; el contenido se deshace entero', () => {
  const viejo = PL.leerBorrador({ id: 'x', tipo: 'borrador', espacioId: 'e1', rutina: PL.rutinaVacia() });
  assert.equal(viejo.incluirRutina, true);
  assert.equal(viejo.temporada, null);
  const b = PL.nuevoBorrador({ espacioId: 'e1', nombre: 'Plan', rutina: PL.rutinaVacia(), temporada: TE.nueva('BULK'), incluirRutina: false, ahora: '2026-11-10T10:00:00.000Z' });
  assert.equal(b.incluirRutina, false);
  assert.deepEqual(plain(b.temporada), { bloques: [{ tipo: 'BULK', semanas: 16, ritmo: 0.25 }] });
  const c = PL.contenido(b);
  assert.deepEqual(Object.keys(c).sort(), ['incluirRutina', 'rutina', 'temporada']);
  c.temporada.bloques[0].semanas = 3;
  assert.equal(b.temporada.bloques[0].semanas, 16);
  assert.deepEqual(plain(PL.leerBorrador({ ...b, temporada: { bloques: [{ tipo: 'CUT', semanas: 4, ritmo: 0.5 }] } }).temporada), { bloques: [{ tipo: 'CUT', semanas: 4, ritmo: 0.5 }] });
});

test('del borrador al archivo: temporada sola o con rutina y caducidad; verifica y caduca', async () => {
  const k = await CE.desbloquear(await archivoClave(), CONTRASENA_PRUEBAS);
  const firma = carga => P.emitir(carga, { clavePrivada: k.privada, idClave: k.id, clavePublica: k.publica, hoy: '2026-11-10' });
  const t = editar(TE.nueva('CUT'), { tipo: 'ritmo', i: 0, valor: 0.6 }, { tipo: 'addBloque' }, { tipo: 'addBloque' });
  // Solo temporada.
  const c1 = P.construirCarga({ entrenador: 'Ana', cliente: 'Luis', emitido: '2026-11-10', caduca: TE.caducidadDefecto(HOY), temporada: TE.paquete(t) });
  assert.equal(c1.caduca, '2027-02-08');
  const v1 = await P.verificar((await firma(c1)).texto, { claves: CLAVES, hoy: '2026-11-10' });
  assert.equal(v1.ok, true, v1.detalle);
  assert.equal(v1.carga.rutina, undefined);
  assert.deepEqual(v1.carga.temporada, plain(TE.paquete(t)));
  assert.deepEqual(plain(TE.desdePaquete(v1.carga.temporada)), plain(t));
  // Pasada la fecha, la app lo rechaza como caducado.
  assert.equal((await P.verificar((await firma(c1)).texto, { claves: CLAVES, hoy: '2027-02-09' })).error, 'caducado');
  assert.equal((await P.verificar((await firma(c1)).texto, { claves: CLAVES, hoy: '2027-02-08' })).ok, true);
  // Rutina y temporada, sin caducidad.
  const raw = copiaRica();
  const sim = PL.simular(PL.rutinaCopia(raw).rutina, raw, { nombre: 'Bloque' });
  const c2 = P.construirCarga({ entrenador: 'Ana', cliente: 'Luis', emitido: '2026-11-10', rutina: sim.paquete, temporada: TE.paquete(t) });
  const v2 = await P.verificar((await firma(c2)).texto, { claves: CLAVES, hoy: '2030-01-01' });
  assert.equal(v2.ok, true, v2.detalle);
  assert.equal(v2.carga.caduca, undefined);
  assert.deepEqual(Object.keys(v2.carga), ['id', 'emitido', 'entrenador', 'cliente', 'rutina', 'temporada']);
});
