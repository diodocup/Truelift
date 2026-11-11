// Plan de entrenador: el verificador REAL de la app sobre planes recién
// emitidos por el escritorio (PLAN_ENTRENADOR.md §8.1 de App-PRO).
//
// Necesita App-PRO al lado (o APP_PRO_DIR), `flutter pub get` hecho en él y
// el SDK de Dart (DART=/ruta/dart o `dart` en el PATH). Si falta algo, las
// pruebas se omiten y lo dicen. El arnés está en arnes-plan-entrenador/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';
import { archivoClave, CONTRASENA_PRUEBAS, CLAVE_PRUEBAS } from './clave-pruebas.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'catalogo.js', 'canonico.js', 'planner.js');
const { PlanificadorEntrenador: PL, ClaveEntrenador: CE, PaqueteEntrenador: P, TemporadaEntrenador: TE } =
  cargar('analisis.js', 'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/clave.js', 'entrenador/temporada.js', 'entrenador/planificador.js');

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = process.env.APP_PRO_DIR || path.resolve(AQUI, '../../../App-PRO');
const PAQUETES = path.join(APP, '.dart_tool/package_config.json');
const ARNES = path.join(AQUI, 'arnes-plan-entrenador/verificar.dart');
const DIR = path.join(AQUI, 'fixtures/plan-entrenador');
const DART = process.env.DART || 'dart';
const HOY = '2026-11-10';

function motivoOmitir(){
  if (!fs.existsSync(path.join(APP, 'lib/plan_entrenador/sobre.dart'))) return `sin App-PRO en ${APP}`;
  if (!fs.existsSync(PAQUETES)) return 'App-PRO sin dependencias resueltas (ejecuta `flutter pub get` en App-PRO)';
  const v = spawnSync(DART, ['--version'], { encoding: 'utf8' });
  if (v.error || v.status !== 0) return 'sin SDK de Dart (DART=/ruta/dart o `dart` en el PATH)';
  return false;
}
const omitir = motivoOmitir();

/** Ejecuta el verificador de la app sobre `archivos` y devuelve su resultado por archivo. */
function verificarEnLaApp(archivos, { hoy = HOY, clave = CLAVE_PRUEBAS } = {}){
  const r = spawnSync(DART, [`--packages=${PAQUETES}`, ARNES, '--clave', `${clave.id}=${clave.publica}`, '--hoy', hoy, ...archivos],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'plan-entrenador-app-'));
const plain = x => JSON.parse(JSON.stringify(x));

/* Rutina de 3 días con todas las modalidades, un ejercicio propio y uno que
   la app no conoce. */
function copiaModalidades(){
  const raw = copiaRica();
  raw.dias = '3'; raw.planModKey = 'hombre_doble|3';
  raw.ejerciciosUsuario = [
    { nombre: 'Plancha lastrada', grupo: 'Core', patron: 'Core', secundarios: ['Hombro'], prioridad: 'Añadido por ti', nota: 'Con disco', porTiempo: true },
  ];
  raw.planMod = [
    { id: 'a', dia: 'Torso', orden: 1, patron: 'Empuje horizontal', grupo: 'Pectoral', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2', descansoMin: 3, topBack: true, backoffPct: 10, rirBack: '2' },
    { id: 'b', dia: 'Torso', orden: 2, patron: 'Tirón horizontal', grupo: 'Espalda', ejercicio: 'Remo con barra inclinado', series: 3, reps: '8-12', rir: '2', descansoMin: 2.5 },
    { id: 'c', dia: 'Torso', orden: 3, patron: 'Aislamiento', grupo: 'Tríceps', ejercicio: 'Extensión en cuerda en polea', series: 3, reps: '10-15', rir: '1', superConAnterior: true },
    { id: 'd', dia: 'Pierna', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps', ejercicio: 'Sentadilla con barra', series: 4, reps: '6-8', rir: '2', descansoMin: 3.5 },
    { id: 'e', dia: 'Pierna', orden: 2, patron: 'Aislamiento', grupo: 'Cuádriceps', ejercicio: 'Extensión de cuádriceps', series: 3, reps: '10-12', rir: '0', dropSet: true, dropPct: 20 },
    { id: 'f', dia: 'Brazos', orden: 1, patron: 'Aislamiento', grupo: 'Bíceps', ejercicio: 'Curl con barra', series: 3, reps: '20-25', rir: '0', restPause: true, pausaRpSeg: 30 },
    { id: 'g', dia: 'Brazos', orden: 2, patron: 'Core', grupo: 'Core', ejercicio: 'Plancha lastrada', series: 3, reps: '30-45', rir: '2' },
  ];
  return raw;
}

test('vectores dorados: el verificador de la app da el resultado del manifiesto', { skip: omitir }, () => {
  const manifiesto = JSON.parse(fs.readFileSync(path.join(DIR, 'MANIFIESTO.json'), 'utf8'));
  const vectores = manifiesto.archivos.filter(a => a.esperado !== null);
  const r = verificarEnLaApp(vectores.map(v => path.join(DIR, v.archivo)), { hoy: manifiesto.hoy });
  for (const { archivo, esperado } of vectores){
    const x = r[path.join(DIR, archivo)];
    assert.equal(x.ok ? 'valido' : x.error, esperado, `${archivo}: ${x.detalle || ''}`);
  }
});

test('planes recién emitidos: la app los acepta y se queda exactamente con lo emitido', { skip: omitir }, async () => {
  const k = await CE.desbloquear(await archivoClave(), CONTRASENA_PRUEBAS);
  const ejemplo = JSON.parse(fs.readFileSync(path.join(AQUI, './fixtures/copia_truelift_2026-11-06.json'), 'utf8'));
  const mod = copiaModalidades();
  const conDesconocido = PL.editar(PL.rutinaCopia(mod).rutina, { tipo: 'campo', d: 0, f: 1, k: 'ejercicio', valor: 'Remo inventado' });
  const temporada = [TE.nueva('CUT'), { tipo: 'ritmo', i: 0, valor: 0.6 }, { tipo: 'addBloque' }, { tipo: 'addBloque' }]
    .reduce((t, op) => TE.editar(t, op));
  const cargas = {
    ejemplo: P.construirCarga({ entrenador: 'Ana Pérez', cliente: 'Cliente de ejemplo', emitido: HOY, nota: 'Empieza el lunes.\nSin prisa.',
      caduca: TE.caducidadDefecto(new Date(2026, 10, 10)), rutina: PL.simular(PL.rutinaCopia(ejemplo).rutina, ejemplo, { nombre: 'Bloque 1' }).paquete }),
    modalidades: P.construirCarga({ entrenador: 'Ana', cliente: 'José María Núñez', emitido: HOY,
      rutina: PL.simular(conDesconocido, mod, { nombre: 'Bloque fuerza' }).paquete, temporada: TE.paquete(temporada) }),
    soloTemporada: P.construirCarga({ entrenador: 'Ana', cliente: 'Luis', emitido: HOY, temporada: TE.paquete(temporada) }),
  };
  const dir = tmp();
  const rutas = {};
  for (const [n, c] of Object.entries(cargas)){
    const e = await P.emitir(c, { clavePrivada: k.privada, idClave: k.id, clavePublica: k.publica, hoy: HOY });
    rutas[n] = path.join(dir, e.nombreArchivo);
    fs.writeFileSync(rutas[n], e.texto);
  }
  const r = verificarEnLaApp(Object.values(rutas));
  for (const [n, c] of Object.entries(cargas)){
    const x = r[rutas[n]];
    assert.equal(x.ok, true, `${n}: ${x.error} ${x.detalle}`);
    const p = x.paquete;
    assert.deepEqual([p.id, p.emitido, p.caduca, p.entrenador, p.cliente, p.nota, p.clave],
      [c.id, c.emitido, c.caduca ?? null, c.entrenador.nombre, c.cliente.nombre, c.nota ?? '', CLAVE_PRUEBAS.id], n);
    if (c.rutina){
      // Lo que la app pasará a importarRutina es, campo a campo, lo emitido.
      assert.deepEqual([p.rutina.nombre, p.rutina.sistema], [c.rutina.nombre, c.rutina.sistema], n);
      assert.deepEqual(p.rutina.dias, plain(c.rutina.dias), n);
      assert.deepEqual(p.rutina.ejercicios, plain(c.rutina.ejercicios || []), n);
      assert.equal(p.rutina.seriesPorSemana, c.rutina.dias.flatMap(d => d.ejercicios).reduce((s, e) => s + e.series, 0), n);
    } else {
      assert.equal(p.rutina, null, n);
    }
    assert.deepEqual(p.temporada, c.temporada ? plain(c.temporada.bloques) : null, n);
  }
  // El de modalidades lleva de verdad cada modalidad y el ejercicio que la app no conoce.
  const filas = cargas.modalidades.rutina.dias.flatMap(d => d.ejercicios);
  for (const m of ['topBack', 'dropSet', 'restPause']) assert.ok(filas.some(e => e[m] === true), m);
  assert.ok(filas.some(e => e.superserie > 0), 'superserie');
  assert.deepEqual(cargas.modalidades.rutina.ejercicios.map(e => e.nombre).sort(), ['Plancha lastrada', 'Remo inventado']);
});

test('planes recién emitidos: alterados, de otra clave o caducados, la app los rechaza', { skip: omitir }, async () => {
  const k = await CE.desbloquear(await archivoClave(), CONTRASENA_PRUEBAS);
  const c = P.construirCarga({ entrenador: 'Ana', cliente: 'Luis', emitido: HOY, caduca: '2026-12-01',
    temporada: { bloques: [{ tipo: 'BULK', semanas: 8, tasaPctSemana: 0.25 }] } });
  const e = await P.emitir(c, { clavePrivada: k.privada, idClave: k.id, clavePublica: k.publica, hoy: HOY });
  const dir = tmp();
  const bueno = path.join(dir, 'bueno.json');
  fs.writeFileSync(bueno, e.texto);
  // Un carácter de la carga cambiado: la firma ya no vale.
  const sobre = JSON.parse(e.texto);
  const i = Math.floor(sobre.carga.length / 2);
  sobre.carga = sobre.carga.slice(0, i) + (sobre.carga[i] === 'A' ? 'B' : 'A') + sobre.carga.slice(i + 1);
  const alterado = path.join(dir, 'alterado.json');
  fs.writeFileSync(alterado, JSON.stringify(sobre));
  const r = verificarEnLaApp([bueno, alterado]);
  assert.equal(r[bueno].ok, true);
  assert.equal(r[alterado].error, 'firmaInvalida');
  // Hasta el día de caducidad inclusive; al siguiente, caducado.
  assert.equal(verificarEnLaApp([bueno], { hoy: '2026-12-01' })[bueno].ok, true);
  assert.equal(verificarEnLaApp([bueno], { hoy: '2026-12-02' })[bueno].error, 'caducado');
  // Una app que no conoce la clave lo rechaza.
  assert.equal(verificarEnLaApp([bueno], { clave: CLAVE_PRUEBAS.otraClave })[bueno].error, 'claveDesconocida');
});
