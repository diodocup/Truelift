// Plan de entrenador F3 — modo entrenador del escritorio: archivo de clave,
// editor de rutina (recuperado del planificador retirado, a4fd1ef^) y salida
// del paquete. PLAN_ENTRENADOR.md §7 y §8.3 (App-PRO). Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';
import { archivoClave, CLAVE_PRUEBAS, CONTRASENA_PRUEBAS } from './clave-pruebas.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'catalogo.js', 'canonico.js', 'planner.js');
const { PlanificadorEntrenador: PL, ClaveEntrenador: CE, PaqueteEntrenador: P } =
  cargar('analisis.js', 'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/clave.js', 'entrenador/temporada.js', 'entrenador/planificador.js');
const plain = x => JSON.parse(JSON.stringify(x));
const CLAVES = { [CLAVE_PRUEBAS.id]: CLAVE_PRUEBAS.publica };

/* Rutina de 3 días con todas las modalidades y un ejercicio propio. */
function copiaPlan(){
  const raw = copiaRica();
  raw.dias = '3'; raw.planModKey = 'hombre_doble|3';
  raw.ejerciciosUsuario = [
    { nombre: 'Plancha lastrada', grupo: 'Core', patron: 'Core', secundarios: ['Hombro'], prioridad: 'Añadido por ti', nota: 'Con disco', porTiempo: true },
    { nombre: 'Remo en máquina del gimnasio', grupo: 'Espalda', patron: 'Tirón horizontal', secundarios: [], prioridad: 'Añadido por ti' },
  ];
  raw.planMod = [
    { id: 'a', dia: 'Torso', orden: 1, patron: 'Empuje horizontal', grupo: 'Pectoral', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2', descansoMin: 3, topBack: true, backoffPct: 10, rirBack: '2' },
    { id: 'b', dia: 'Torso', orden: 2, patron: 'Tirón horizontal', grupo: 'Espalda', ejercicio: 'Remo con barra inclinado', series: 3, reps: '8-12', rir: '2', descansoMin: null },
    { id: 'c', dia: 'Torso', orden: 3, patron: 'Aislamiento', grupo: 'Tríceps', ejercicio: 'Extensión en cuerda en polea', series: 3, reps: '10-15', rir: '1', superConAnterior: true },
    { id: 'd', dia: 'Pierna', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps', ejercicio: 'Sentadilla con barra', series: 4, reps: '6-8', rir: '2', descansoMin: 3.5 },
    { id: 'e', dia: 'Pierna', orden: 2, patron: 'Aislamiento', grupo: 'Cuádriceps', ejercicio: 'Extensión de cuádriceps', series: 3, reps: '10-12', rir: '0', dropSet: true, dropPct: 20 },
    { id: 'f', dia: 'Brazos', orden: 1, patron: 'Aislamiento', grupo: 'Bíceps', ejercicio: 'Curl con barra', series: 3, reps: '20-25', rir: '0', restPause: true, pausaRpSeg: 30 },
    { id: 'g', dia: 'Brazos', orden: 2, patron: 'Core', grupo: 'Core', ejercicio: 'Plancha lastrada', series: 3, reps: '30-45', rir: '2' },
  ];
  return raw;
}

// ---------------------------------------------------------------
// Archivo de clave
// ---------------------------------------------------------------

test('archivo de clave: contraseña correcta → privada no extraíble que firma paquetes válidos', async () => {
  assert.equal(await CE.soportado(), true);
  const k = await CE.desbloquear(await archivoClave(), CONTRASENA_PRUEBAS);
  assert.equal(k.id, CLAVE_PRUEBAS.id);
  assert.equal(k.publica, CLAVE_PRUEBAS.publica);
  assert.equal(k.privada.extractable, false);
  assert.deepEqual(k.privada.usages, ['sign']);
  await assert.rejects(crypto.subtle.exportKey('pkcs8', k.privada));
  const carga = P.construirCarga({ entrenador: 'Ana', cliente: 'Luis', emitido: '2026-11-10',
    temporada: { bloques: [{ tipo: 'BRIDGE', semanas: 2, tasaPctSemana: 0 }] } });
  const r = await P.emitir(carga, { clavePrivada: k.privada, idClave: k.id, clavePublica: k.publica, hoy: '2026-11-10' });
  assert.equal((await P.verificar(r.texto, { claves: CLAVES, hoy: '2026-11-10' })).ok, true);
});

test('archivo de clave: contraseña incorrecta, archivo corrupto, manipulado o ajeno', async () => {
  const bueno = await archivoClave();
  const codigo = async (texto, pass = CONTRASENA_PRUEBAS) => {
    try { await CE.desbloquear(texto, pass); return 'ok'; } catch (e) { assert.ok(e instanceof CE.ErrorClave, String(e)); return e.codigo; }
  };
  assert.equal(await codigo(bueno, 'otra contraseña'), 'contrasena');
  assert.equal(await codigo(bueno, ''), 'contrasena');
  // Un byte cambiado en los datos cifrados: GCM no lo deja pasar.
  const o = JSON.parse(bueno);
  const datos = Buffer.from(o.cifrado.datos, 'base64url'); datos[5] ^= 1;
  assert.equal(await codigo(JSON.stringify({ ...o, cifrado: { ...o.cifrado, datos: datos.toString('base64url') } })), 'contrasena');
  // El id o la pública no corresponden.
  assert.equal(await codigo(JSON.stringify({ ...o, id: CLAVE_PRUEBAS.otraClave.id })), 'danado');
  assert.equal(await codigo(JSON.stringify({ ...o, publica: CLAVE_PRUEBAS.otraClave.publica })), 'danado');
  // Pública e id coherentes entre sí, pero la privada es de otra clave.
  assert.equal(await codigo(await archivoClave({ id: CLAVE_PRUEBAS.otraClave.id, publica: CLAVE_PRUEBAS.otraClave.publica })), 'danado');
  // Pocas iteraciones, otro algoritmo, otra versión, JSON roto, una copia o un paquete.
  assert.equal(await codigo(JSON.stringify({ ...o, kdf: { ...o.kdf, iteraciones: 1000 } })), 'danado');
  assert.equal(await codigo(JSON.stringify({ ...o, cifrado: { ...o.cifrado, alg: 'AES-128-CBC' } })), 'noSoportado');
  assert.equal(await codigo(JSON.stringify({ ...o, v: 2 })), 'noSoportado');
  assert.equal(await codigo(bueno.slice(0, 80)), 'noEsClave');
  assert.equal(await codigo(JSON.stringify(copiaRica())), 'noEsClave');
  assert.equal(await codigo(fs.readFileSync(new URL('./fixtures/plan-entrenador/v01_solo_rutina.json', import.meta.url), 'utf8')), 'noEsClave');
  assert.equal(await codigo('x'.repeat(CE.TAM_MAX + 1)), 'noEsClave');
  // Ningún mensaje lleva la contraseña.
  for (const m of Object.values(CE.MENSAJES)) assert.doesNotMatch(m, /contraseña de pruebas/);
});

// Con App-PRO al lado, el archivo que escribe su herramienta se desbloquea aquí.
const HERRAMIENTA = new URL('../../../App-PRO/tool/entrenador_claves.mjs', import.meta.url);
test('App-PRO al lado: el archivo de `entrenador_claves.mjs generar` se desbloquea', { skip: !fs.existsSync(HERRAMIENTA) && 'sin App-PRO al lado' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-clave-'));
  try {
    const salida = execFileSync(process.execPath, [HERRAMIENTA.pathname, 'generar', '--salida', dir],
      { input: 'una contraseña larga\nuna contraseña larga\n', encoding: 'utf8' });
    const archivo = fs.readdirSync(dir).find(a => /^clave_entrenador_[0-9a-f]{16}\.json$/.test(a));
    assert.ok(archivo, salida);
    const k = await CE.desbloquear(fs.readFileSync(path.join(dir, archivo), 'utf8'), 'una contraseña larga');
    assert.match(salida, new RegExp(`'${k.id}': '${k.publica}'`));
    await assert.rejects(CE.desbloquear(fs.readFileSync(path.join(dir, archivo), 'utf8'), 'otra'), e => e.codigo === 'contrasena');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------
// Editor de rutina (pruebas recuperadas de planificador.test.mjs)
// ---------------------------------------------------------------

test('rutina de la copia: modelo del editor con modalidades, contexto y forma canónica', () => {
  const raw = copiaPlan();
  const m = PL.rutinaCopia(raw);
  assert.equal(m.vigente, true);
  assert.equal(m.aPrueba, null);
  assert.equal(m.recortada, false);
  assert.deepEqual(m.rutina.dias.map(d => d.nombre), ['Torso', 'Pierna', 'Brazos']);
  const [torso, pierna, brazos] = m.rutina.dias;
  assert.equal(torso.filas[0].topBack, true);
  assert.equal(torso.filas[1].descanso, null);
  assert.equal(torso.filas[2].superConAnterior, true);
  assert.equal(pierna.filas[1].dropSet, true);
  assert.equal(brazos.filas[0].restPause, true);
  assert.equal(brazos.filas[0].pausaRpSeg, 30);
  assert.equal(m.normal.dias[0].lineas[2].superserie, true);
  assert.equal(m.normal.dias[0].lineas[0].modalidad, 'topBack');
  assert.deepEqual(plain(PL.rutinaCopia({ ...raw, importPendiente: { nombre: 'Mi prueba', origen: 'entrenador', previo: {} } }).aPrueba), { nombre: 'Mi prueba', origen: 'entrenador' });
  assert.equal(PL.rutinaCopia({ ...raw, planMod: [] }), null);
  assert.equal(PL.rutinaCopia(null), null);
  assert.equal(PL.rutinaCopia({ ...raw, dias: '4' }).vigente, false);
  const largo = { ...raw, planMod: Array.from({ length: 11 }, (_, i) => ({ dia: 'Torso', orden: i, ejercicio: `Ej ${i}`, series: 2, reps: '8', rir: '2' })) };
  assert.equal(PL.rutinaCopia(largo).recortada, true);
});

test('un borrador sin cambios produce en la app la misma rutina que trae la copia', () => {
  const ejemplo = JSON.parse(fs.readFileSync(new URL('../ejemplo/copia_truelift_2026-11-06.json', import.meta.url), 'utf8'));
  for (const raw of [copiaPlan(), copiaRica(), ejemplo]){
    const m = PL.rutinaCopia(raw);
    const sim = PL.simular(m.rutina, raw);
    const d = PL.diferencias(m.normal, sim.normal);
    assert.equal(d.iguales, true, JSON.stringify(d.dias.filter(x => x.estado !== 'igual')));
    assert.equal(PL.firma(sim.normal), PL.firma(m.normal));
    assert.deepEqual(sim.notas, []);
    // Y el paquete pasa la validación de la app.
    assert.equal(P.validarCarga({ id: 'pe_x', emitido: '2026-11-10', entrenador: { nombre: 'E' }, cliente: { nombre: 'C' }, rutina: sim.paquete }), null);
  }
});

test('paquete: claves y tipos del contrato, superseries por número y ejercicios propios usados', () => {
  const raw = copiaPlan();
  const { rutina: pq, notas } = PL.paqueteRutina(PL.rutinaCopia(raw).rutina, raw, { nombre: 'Bloque 1' });
  assert.deepEqual(notas, []);
  assert.equal(pq.nombre, 'Bloque 1');
  assert.equal(pq.sistema, 'doble');
  const [torso, pierna, brazos] = pq.dias;
  assert.deepEqual(plain(torso.ejercicios[0]), { patron: 'Empuje horizontal', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2',
    descanso: 3, topBack: true, backoffPct: 10, rirBack: '2', dropSet: false, dropPct: 15, superserie: 0, restPause: false, pausaRpSeg: 20 });
  assert.equal(torso.ejercicios[1].descanso, undefined);           // sin dato: el de la app
  assert.deepEqual(torso.ejercicios.map(e => e.superserie), [0, 1, 1]);
  assert.equal(pierna.ejercicios[1].dropSet, true);
  assert.equal(pierna.ejercicios[1].reps, '12');                    // drop set: un número
  assert.equal(pierna.ejercicios[1].dropPct, 20);
  assert.equal(brazos.ejercicios[0].restPause, true);
  assert.equal(brazos.ejercicios[0].pausaRpSeg, 30);
  for (const d of pq.dias) for (const e of d.ejercicios){
    assert.equal(typeof e.series, 'number'); assert.equal(typeof e.reps, 'string'); assert.equal(typeof e.rir, 'string');
  }
  // Solo viaja la ficha del ejercicio propio que se usa (no toda la biblioteca).
  assert.deepEqual(plain(pq.ejercicios), [{ nombre: 'Plancha lastrada', grupo: 'Core', patron: 'Core', secundarios: ['Hombro'],
    prioridad: 'Añadido por ti', nota: 'Con disco', descanso: '', porTiempo: true }]);
  // Un ejercicio que la app no conoce viaja con su ficha mínima.
  const r = PL.editar(PL.rutinaCopia(raw).rutina, { tipo: 'campo', d: 0, f: 1, k: 'ejercicio', valor: 'Remo inventado' });
  const nuevo = PL.paqueteRutina(r, raw).rutina.ejercicios.find(e => e.nombre === 'Remo inventado');
  assert.deepEqual([nuevo.patron, nuevo.grupo], ['Tirón horizontal', 'Espalda']);
  // Sin copia (cliente con ficha manual): también se construye.
  assert.equal(PL.paqueteRutina(PL.rutinaCopia(raw).rutina, null).rutina.dias.length, 3);
});

test('la simulación reproduce las lecturas y valores por defecto de la app', () => {
  const raw = copiaPlan();
  const rutina = { sistema: 'doble', dias: [
    { nombre: '', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca con barra', series: null, repsMin: 8, repsMax: 8, rir: null, descanso: 2 },
      { patron: 'Aislamiento', ejercicio: 'Curl de bíceps con barra', series: 3, repsMin: 20, repsMax: 25, rir: 0, restPause: true, pausaRpSeg: 25 },
      { patron: '', ejercicio: '' },
    ] },
    { nombre: 'Torso', filas: [{ patron: 'Rodilla', ejercicio: 'Sentadilla con barra', series: 12, repsMin: null, repsMax: null, rir: 2, topBack: true, backoffPct: 50 }] },
    { nombre: 'Torso', filas: [{ patron: 'Rodilla', ejercicio: 'Prensa', series: 3, repsMin: 10, repsMax: 12, rir: 2, dropSet: true, dropPct: 2 }] },
    { nombre: 'Vacío', filas: [] },
  ] };
  const sim = PL.simular(rutina, raw);
  assert.deepEqual(sim.dias.map(d => d.nombre), ['Día 1', 'Torso', 'Torso (3)']);
  const [press, curl] = sim.dias[0].lineas;
  assert.equal(press.series, 3);
  assert.equal(press.reps, '8-10');
  assert.equal(press.rir, '2');
  assert.equal(curl.pausaRpSeg, 30);
  assert.equal(sim.dias[0].lineas.length, 2);
  const sent = sim.dias[1].lineas[0];
  assert.equal(sent.series, 10);              // el contrato admite hasta 10
  assert.equal(sent.reps, '8-10');
  assert.equal(sent.backoffPct, 30);
  assert.equal(sim.dias[2].lineas[0].dropPct, 5);
  assert.equal(sim.paquete.dias.length, 3);   // el día vacío no viaja
  const textos = sim.notas.map(n => n.txt).join('\n');
  assert.match(textos, /sin nombre se llamará «Día 1»/);
  assert.match(textos, /dos días llamados «Torso»/);
  assert.match(textos, /sin series; la app usará 3/);
  assert.match(textos, /12 series no caben en un plan; irán 10/);
  assert.match(textos, /la app usará 8–10/);
  assert.match(textos, /se ajustará a 30 s/);
  assert.equal(PL.simular({ ...rutina, sistema: 'simple' }, raw).dias[0].lineas[0].reps, '8');
});

test('ediciones: modalidades excluyentes, superseries, orden, límites y sin mutar el original', () => {
  const raw = copiaPlan();
  const base = PL.rutinaCopia(raw).rutina;
  const congelado = JSON.stringify(base);
  let r = PL.editar(base, { tipo: 'campo', d: 0, f: 2, k: 'modalidad', valor: 'rp' });
  assert.equal(r.dias[0].filas[2].restPause, true);
  assert.equal(r.dias[0].filas[2].superConAnterior, false);
  assert.equal(JSON.stringify(base), congelado);
  r = PL.editar(base, { tipo: 'campo', d: 2, f: 0, k: 'modalidad', valor: 'topBack' });
  assert.equal(r.dias[2].filas[0].topBack, true);
  assert.equal(r.dias[2].filas[0].restPause, false);
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 1, k: 'superConAnterior', valor: true });
  assert.equal(r.dias[0].filas[0].topBack, false);
  assert.equal(r.dias[0].filas[1].superConAnterior, true);
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 2, k: 'superConAnterior', valor: true });
  r = PL.editar(r, { tipo: 'moverFila', d: 0, f: 2, delta: -1 });
  assert.equal(r.dias[0].filas[1].ejercicio, 'Extensión en cuerda en polea');
  assert.equal(r.dias[0].filas[1].superConAnterior, false);
  assert.equal(PL.editar(base, { tipo: 'moverFila', d: 0, f: 0, delta: -1 }), null);
  r = PL.editar(base, { tipo: 'campo', d: 1, f: 0, k: 'series', valor: '1' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 0, k: 'modalidad', valor: 'rp' });
  assert.equal(r.dias[1].filas[0].series, 2);
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 0, k: 'descanso', valor: '' });
  assert.equal(r.dias[0].filas[0].descanso, null);
  let lleno = base;
  for (let i = 0; i < 5; i++) lleno = PL.editar(lleno, { tipo: 'addDia' }) || lleno;
  assert.equal(lleno.dias.length, 5);
  assert.equal(PL.editar(lleno, { tipo: 'addDia' }), null);
  for (let i = 0; i < 12; i++) lleno = PL.editar(lleno, { tipo: 'addFila', d: 0 }) || lleno;
  assert.equal(lleno.dias[0].filas.length, 10);
  r = PL.editar(base, { tipo: 'moverDia', d: 2, delta: -2 });
  assert.deepEqual(r.dias.map(d => d.nombre), ['Brazos', 'Torso', 'Pierna']);
  // Elegir un ejercicio del catálogo sin patrón pone el de su ficha.
  r = PL.editar(PL.editar(base, { tipo: 'addFila', d: 0 }), { tipo: 'campo', d: 0, f: 3, k: 'ejercicio', valor: 'Sentadilla con barra' });
  assert.equal(r.dias[0].filas[3].patron, 'Rodilla');
});

test('drop set: un número de reps, no un rango, como la app', () => {
  const raw = copiaPlan();
  const m = PL.rutinaCopia(raw);
  assert.equal(m.rutina.dias[1].filas[1].repsMin, 12);
  assert.equal(m.rutina.dias[1].filas[1].repsMax, null);
  assert.equal(m.normal.dias[1].lineas[1].reps, '12');
  let r = PL.editar(m.rutina, { tipo: 'campo', d: 0, f: 1, k: 'modalidad', valor: 'drop' });
  assert.deepEqual([r.dias[0].filas[1].repsMin, r.dias[0].filas[1].repsMax], [12, null]);
  assert.equal(PL.simular(r, raw).dias[0].lineas[1].reps, '12');
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'modalidad', valor: 'normal' });
  assert.deepEqual([r.dias[0].filas[1].repsMin, r.dias[0].filas[1].repsMax], [8, 12]);
  const viejo = { sistema: 'doble', dias: [{ nombre: 'A', filas: [{ patron: 'Rodilla', ejercicio: 'Prensa', series: 3, repsMin: 10, repsMax: 15, rir: 1, dropSet: true }] }] };
  assert.equal(PL.simular(viejo, raw).dias[0].lineas[0].reps, '15');
});

test('comparación con la copia: ejercicios, campos, orden, días y series por grupo', () => {
  const raw = copiaPlan();
  const m = PL.rutinaCopia(raw);
  let r = m.rutina;
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'series', valor: 4 });
  r = PL.editar(r, { tipo: 'delFila', d: 0, f: 2 });
  r = PL.editar(r, { tipo: 'addFila', d: 1 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'patron', valor: 'Bisagra' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'ejercicio', valor: 'Peso muerto rumano con barra' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'repsMin', valor: 8 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'repsMax', valor: 10 });
  r = PL.editar(r, { tipo: 'moverFila', d: 1, f: 1, delta: -1 });
  r = PL.editar(r, { tipo: 'nombreDia', d: 2, valor: 'Brazos y core' });
  const sim = PL.simular(r, raw);
  const d = PL.diferencias(m.normal, sim.normal);
  assert.equal(d.iguales, false);
  const [torso, pierna, brazos] = d.dias;
  assert.deepEqual(torso.cambios.map(c => [c.tipo, c.ejercicio]), [['cambiado', 'Remo con barra inclinado'], ['quitado', 'Extensión en cuerda en polea']]);
  assert.deepEqual(plain(torso.cambios[0].campos.map(c => [c.campo, c.antes, c.despues])), [['series', 3, 4]]);
  assert.equal(pierna.ordenCambiado, true);
  assert.deepEqual(pierna.cambios.map(c => c.tipo), ['nuevo']);
  assert.equal(brazos.renombrado, true);
  const g = PL.resumenGrupos(raw, m.normal, sim.normal);
  const fila = n => g.filas.find(f => f.grupo === n);
  assert.equal(fila('Espalda').dSeries, 2.5);
  assert.equal(fila('Tríceps').dSeries, -3);
  const raro = PL.simular(PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'ejercicio', valor: 'Press raro' }), raw);
  assert.deepEqual(PL.resumenGrupos(raw, m.normal, raro.normal).despues.sinGrupo, ['Press raro']);
  // Cliente sin copia: series por grupo con el catálogo solo.
  assert.ok(PL.grupos(null, sim.normal).series.get('Cuádriceps') > 0);
});

test('avisos: días suficientes, ejercicio desconocido, filas incompletas, nada de umbrales', () => {
  const raw = copiaPlan();
  const base = PL.rutinaCopia(raw).rutina;
  assert.equal(PL.avisos(base, raw).bloquea, false);
  const unDia = PL.editar(PL.editar(base, { tipo: 'delDia', d: 2 }), { tipo: 'delDia', d: 1 });
  const a1 = PL.avisos(unDia, raw);
  assert.equal(a1.bloquea, true);
  assert.match(a1.avisos[0].txt, /entre 2 y 5 días/);
  let r = PL.editar(base, { tipo: 'campo', d: 2, f: 1, k: 'modalidad', valor: 'rp' });
  r = PL.editar(r, { tipo: 'addFila', d: 0 });
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 3, k: 'patron', valor: 'Aislamiento' });
  r = PL.editar(r, { tipo: 'addFila', d: 1 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'patron', valor: 'Aislamiento' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'ejercicio', valor: 'Curl inventado' });
  r.dias[1].filas[1].series = 1;
  const txt = PL.avisos(r, raw).avisos.map(a => `${a.nivel}:${a.txt}`).join('\n');
  assert.match(txt, /ambar:.*Plancha lastrada: se mide por tiempo/);
  assert.match(txt, /ambar:Torso: hay una fila sin ejercicio; no se incluirá/);
  assert.match(txt, /azul:.*«Curl inventado» no está en el catálogo ni en la biblioteca del cliente/);
  assert.match(txt, /ambar:.*drop set necesita al menos 2 series/);
  assert.doesNotMatch(txt, /«Plancha lastrada» no está/);
  assert.doesNotMatch(txt, /%|umbral|ventana/i);
  // Nombre demasiado largo para el contrato: impide emitir.
  const largo = PL.editar(base, { tipo: 'campo', d: 0, f: 1, k: 'ejercicio', valor: 'x'.repeat(81) });
  assert.equal(PL.avisos(largo, raw).bloquea, true);
});

test('progresión: mismo sistema y días conserva cargas; otro número de días o sistema las reinicia', () => {
  const raw = copiaPlan();
  const base = PL.rutinaCopia(raw).rutina;
  raw.logs.forEach(l => { if (l.dias) l.dias = '3'; });
  assert.equal(PL.progresion(raw, PL.simular(base, raw)).conserva, true);
  const p2 = PL.progresion(raw, PL.simular(PL.editar(base, { tipo: 'delDia', d: 2 }), raw));
  assert.equal(p2.conserva, false);
  assert.equal(p2.mismosDias, false);
  assert.equal(PL.progresion(raw, PL.simular(PL.editar(base, { tipo: 'sistema', valor: 'simple' }), raw)).mismoSistema, false);
  assert.equal(PL.progresion({ ...raw, logs: [] }, PL.simular(base, raw)), null);
  assert.equal(PL.progresion(null, PL.simular(base, raw)), null);
});

test('borradores: origen, discrepancia con una copia nueva y registros antiguos', () => {
  const raw = copiaPlan();
  const origen = PL.origenCopia(raw, { id: 'i1', resumen: { ultimoRegistro: '2026-07-02' } });
  const b = PL.nuevoBorrador({ espacioId: 'e1', nombre: 'Bloque fuerza', rutina: origen.rutina, origen, ahora: '2026-07-03T10:00:00.000Z' });
  assert.equal(b.tipo, 'borrador');
  assert.equal(PL.discrepancia(b, raw), null);
  const raw2 = plain(raw); raw2.planMod[3].series = 5;
  const dis = PL.discrepancia(b, raw2);
  assert.deepEqual(plain(dis.diff.dias[1].cambios[0].campos.map(c => [c.campo, c.antes, c.despues])), [['series', 4, 5]]);
  assert.equal(PL.discrepancia(b, { ...raw, planMod: [] }).sinRutina, true);
  assert.equal(PL.discrepancia({ ...b, origen: { tipo: 'blanco' } }, raw2), null);
  const viejo = PL.leerBorrador({ id: 'x', tipo: 'borrador', espacioId: 'e1', rutina: { sistema: 'simple', dias: [{ nombre: 'A', filas: [{ patron: 'Rodilla', ejercicio: 'Sentadilla con barra', series: 3 }] }] } });
  assert.equal(viejo.rutina.dias[0].filas[0].restPause, false);
  assert.equal(viejo.origen.tipo, 'blanco');
  assert.equal(PL.leerBorrador(null), null);
  assert.equal(PL.leerBorrador({ id: 'pe_x', tipo: 'emitido' }), null);
});

test('ficha manual: valores saneados; nada de ella viaja en el paquete', () => {
  assert.deepEqual(plain(PL.leerFicha({ sexo: 'mujer', pesoKg: '61,5', alturaCm: 168, grasaPct: 'x', experiencia: 'intermedio', dias: '4', notas: '  Rodilla operada  ' })),
    { sexo: 'mujer', pesoKg: 61.5, alturaCm: 168, grasaPct: null, experiencia: 'intermedio', dias: 4, notas: 'Rodilla operada' });
  assert.deepEqual(plain(PL.leerFicha(null)), { sexo: '', pesoKg: null, alturaCm: null, grasaPct: null, experiencia: '', dias: null, notas: '' });
  assert.equal(PL.leerFicha({ pesoKg: 9000 }).pesoKg, null);
});

test('del borrador al archivo: lo que se emite verifica y su rutina es la de la simulación', async () => {
  const raw = copiaPlan();
  const k = await CE.desbloquear(await archivoClave(), CONTRASENA_PRUEBAS);
  const r = PL.editar(PL.rutinaCopia(raw).rutina, { tipo: 'campo', d: 1, f: 0, k: 'series', valor: 5 });
  const sim = PL.simular(r, raw, { nombre: 'Bloque 2' });
  const carga = P.construirCarga({ entrenador: 'Ana Pérez', cliente: 'Luis Gómez', emitido: '2026-11-10', nota: 'Empieza el lunes.', rutina: sim.paquete });
  const e = await P.emitir(carga, { clavePrivada: k.privada, idClave: k.id, clavePublica: k.publica, hoy: '2026-11-10' });
  const v = await P.verificar(e.texto, { claves: CLAVES, hoy: '2026-11-10' });
  assert.equal(v.ok, true);
  assert.deepEqual(PL.comoLaApp(v.carga.rutina).normal, sim.normal);
  assert.equal(e.nombreArchivo, 'plan_truelift_luis_gomez_2026-11-10.json');
});
