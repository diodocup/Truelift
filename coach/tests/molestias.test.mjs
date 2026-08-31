// Ejercicios marcados como "hechos con molestias" (clave `molestias` de cada
// entrada del JSON de TrueLift).
//
// Lo que protegen estas pruebas es que el Coach NO evalúe esas sesiones: la app
// tampoco lo hace, y si aquí contaran, tres semanas entrenando suave por una
// tendinitis se leerían como un estancamiento y el entrenador bajaría una carga
// que no había que tocar.
//
// Ejecutar con: node --test tests/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargarDatos() {
  const sandbox = { console };
  vm.createContext(sandbox);
  // `normalizar` reconstruye también la capa de nutrición, así que necesita
  // `nutricion.js` en el mismo contexto aunque estas pruebas no la miren.
  vm.runInContext(fs.readFileSync(new URL('data.js', appDir), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(new URL('nutricion.js', appDir), 'utf8'), sandbox);
  vm.runInContext(
    ';globalThis.__normalizar = normalizar; globalThis.__Metricas = Metricas;',
    sandbox,
  );
  return { normalizar: sandbox.__normalizar, Metricas: sandbox.__Metricas };
}

/* Sesión de fuerza con UN ejercicio, en el formato crudo del JSON. */
function sesion({ fecha, kg, reps = [10, 10, 10], molestias = false, obs = '' }) {
  return {
    fecha, dia: 'Día 1', variante: 'hombre_doble', dias: '3',
    estadoCompuerta: 'verde', descarga: false,
    entradas: [{
      slot: 0, ejercicio: 'Sentadilla', kg, reps, rir: [2, 2, 2], obs,
      modulada: false, progresionPausada: false,
      ...(molestias ? { molestias: true } : {}),
    }],
  };
}

function datosDe(logs) {
  const { normalizar, Metricas } = cargarDatos();
  const datos = normalizar({ logs, planMod: [] });
  return { datos, Metricas };
}

test('la marca se lee del JSON y las copias antiguas siguen valiendo', () => {
  const { datos } = datosDe([
    sesion({ fecha: '2026-08-01T10:00:00.000', kg: 100, molestias: true }),
    sesion({ fecha: '2026-08-04T10:00:00.000', kg: 100 }),
  ]);
  assert.equal(datos.fuerza[0].entradas[0].molestias, true);
  // Copia anterior a la función: sin la clave, la entrada es normal.
  assert.equal(datos.fuerza[1].entradas[0].molestias, false);
});

test('una racha con molestias no se diagnostica como estancamiento', () => {
  // Cuatro sesiones clavadas a 80 kg: sin la marca es un estancamiento de
  // manual; con ella, el cliente estaba entrenando suave a propósito.
  const fechas = ['2026-08-01', '2026-08-04', '2026-08-07', '2026-08-10'];
  const conCarga = m => fechas.map(f =>
    sesion({ fecha: `${f}T10:00:00.000`, kg: 80, molestias: m }));

  const sin = datosDe([sesion({ fecha: '2026-07-28T10:00:00.000', kg: 100 }), ...conCarga(false)]);
  const dSin = sin.Metricas.diagnostico(
    sin.Metricas.historicoEjercicio(sin.datos, 'Sentadilla'));
  assert.equal(dSin.estado, 'estancado');

  const con = datosDe([sesion({ fecha: '2026-07-28T10:00:00.000', kg: 100 }), ...conCarga(true)]);
  const dCon = con.Metricas.diagnostico(
    con.Metricas.historicoEjercicio(con.datos, 'Sentadilla'));
  // Solo queda la sesión buena: no hay dos puntos evaluables que comparar.
  assert.equal(dCon.estado, 'insuficiente');
});

test('sin ninguna sesión evaluable el diagnóstico lo dice, no inventa', () => {
  const { datos, Metricas } = datosDe([
    sesion({ fecha: '2026-08-01T10:00:00.000', kg: 80, molestias: true }),
    sesion({ fecha: '2026-08-04T10:00:00.000', kg: 80, molestias: true }),
  ]);
  const d = Metricas.diagnostico(Metricas.historicoEjercicio(datos, 'Sentadilla'));
  assert.equal(d.estado, 'molestias');
});

test('el RIR alto sostenido ignora las sesiones con molestias', () => {
  const { normalizar, Metricas } = cargarDatos();
  const alto = (fecha, molestias) => ({
    fecha, dia: 'Día 1', estadoCompuerta: 'verde',
    entradas: [{
      slot: 0, ejercicio: 'Sentadilla', kg: 80, reps: [10, 10, 10], rir: [4, 4, 4],
      ...(molestias ? { molestias: true } : {}),
    }],
  });
  // Dos sesiones con RIR 4: "va sobrado", sube carga.
  const normal = normalizar({ logs: [alto('2026-08-01T10:00:00.000'), alto('2026-08-04T10:00:00.000')], planMod: [] });
  assert.equal(
    Metricas.rirAltoSostenido(Metricas.historicoEjercicio(normal, 'Sentadilla')), true);
  // Las mismas, con molestias: el RIR alto es que se contuvo por el dolor.
  const conM = normalizar({ logs: [alto('2026-08-01T10:00:00.000', true), alto('2026-08-04T10:00:00.000', true)], planMod: [] });
  assert.equal(
    Metricas.rirAltoSostenido(Metricas.historicoEjercicio(conM, 'Sentadilla')), false);
});

test('molestiasMarcadas y molestiasRecurrentes no se pisan con el rastreo de texto', () => {
  const { datos, Metricas } = datosDe([
    sesion({ fecha: '2026-08-01T10:00:00.000', kg: 80, molestias: true, obs: 'me duele la rodilla' }),
    sesion({ fecha: '2026-08-04T10:00:00.000', kg: 80, molestias: true }),
    sesion({ fecha: '2026-08-07T10:00:00.000', kg: 80, molestias: true }),
    sesion({ fecha: '2026-08-10T10:00:00.000', kg: 100, obs: 'tiron en el isquio' }),
  ]);
  const marcadas = Metricas.molestiasMarcadas(datos.fuerza);
  assert.equal(marcadas.length, 3);
  // Más recientes primero.
  assert.equal(marcadas[0].fecha.getTime() > marcadas[2].fecha.getTime(), true);

  // El rastreo de texto NO repite la entrada del 1 de agosto, que ya va
  // marcada: solo devuelve la sospecha del día 10.
  const intuidas = Metricas.molestias(datos.fuerza);
  assert.equal(intuidas.length, 1);
  assert.equal(intuidas[0].obs, 'tiron en el isquio');

  const rec = Metricas.molestiasRecurrentes(datos.fuerza);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].ejercicio, 'Sentadilla');
  assert.equal(rec[0].veces, 3);
  // Con el umbral por encima de las veces registradas, no hay recurrencia.
  assert.equal(Metricas.molestiasRecurrentes(datos.fuerza, 4).length, 0);
});

test('una sesión con molestias no puede ser el mejor e1RM', () => {
  const { datos, Metricas } = datosDe([
    sesion({ fecha: '2026-08-01T10:00:00.000', kg: 100 }),
    // Más pesada, pero marcada: no fija marca, igual que en la app.
    sesion({ fecha: '2026-08-04T10:00:00.000', kg: 200, molestias: true }),
  ]);
  const hist = Metricas.historicoEjercicio(datos, 'Sentadilla');
  const mejorTodo = Math.max(...hist.map(p => p.e1rm ?? -Infinity));
  const mejorEval = Math.max(...Metricas.evaluables(hist).map(p => p.e1rm ?? -Infinity));
  assert.equal(mejorTodo > mejorEval, true);
  assert.equal(Metricas.evaluables(hist).length, 1);
});
