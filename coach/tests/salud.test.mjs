import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargarCoach() {
  const llamadasLineas = [];
  const sandbox = {
    console,
    State: { mostrarFcReposo: false },
    Charts: {
      combinada: () => '',
      barras: () => '',
      dobleEje: () => '',
      lineas: opciones => {
        llamadasLineas.push(opciones);
        return '<svg data-test="lineas"></svg>';
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL('data.js', appDir), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(new URL('nutricion.js', appDir), 'utf8'), sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('views.js', appDir), 'utf8')}
     ;globalThis.__normalizar = normalizar;
     ;globalThis.__Salud = Salud;
     ;globalThis.__Vistas = Vistas;`,
    sandbox,
  );
  return {
    normalizar: sandbox.__normalizar,
    Salud: sandbox.__Salud,
    Vistas: sandbox.__Vistas,
    llamadasLineas,
  };
}

const NOCHE = { total: 430, ligero: 240, profundo: 100, rem: 90, despierto: 25, despertares: 2 };

function copiaConReloj(extra = {}) {
  return {
    logs: [
      {
        tipo: 'cardio', fecha: '2026-09-18T07:10:00', nombre: 'Carrera',
        duracion: 42, intensidad: 6, origen: 'reloj', saludTipo: 'RUNNING',
        rpeDeFc: true, fcMedia: 148, fcMax: 171, kcal: 430, distanciaM: 7200,
      },
      { tipo: 'cardio', fecha: '2026-09-19T18:00:00', nombre: 'Bici', duracion: 30, intensidad: 5 },
    ],
    planMod: [],
    readinessDiario: [
      { fecha: '2026-09-18', sueno: 3, suenoSugerido: 4, estadoEntrenar: 80, fcReposo: 51, fcOrigen: 'reloj' },
      { fecha: '2026-09-19', sueno: 4, suenoSugerido: 4, estadoEntrenar: 85 },
    ],
    saludDiaria: [
      { fecha: '2026-09-18', pasos: 9300, fcReposo: 51, kcalTotal: 2900, kcalBasal: 1700, sueno: NOCHE },
      { fecha: '2026-09-19', pasos: 13200, kcalTotal: 3100, kcalBasal: 1700,
        sueno: { total: 400, despierto: 15, despertares: 1, dormido: 400 } },
    ],
    ...extra,
  };
}

test('saludDiaria se normaliza con la noche y sus fases', () => {
  const { normalizar } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  assert.equal(datos.salud.length, 2);
  const [d1, d2] = datos.salud;
  assert.equal(d1.clave, '2026-09-18');
  assert.equal(d1.pasos, 9300);
  assert.equal(d1.sueno.conFases, true);
  assert.equal(d1.sueno.reparador, 190);
  assert.ok(Math.abs(d1.sueno.reparadorPct - 190 / 430) < 1e-9);
  // Fuente sin fases: no se inventa un 0 % de sueño reparador.
  assert.equal(d2.sueno.conFases, false);
  assert.equal(d2.sueno.reparadorPct, null);
});

test('una copia antigua sin saludDiaria no rompe nada', () => {
  const { normalizar, Salud } = cargarCoach();
  const datos = normalizar({ logs: [], planMod: [], readinessDiario: [] });
  assert.equal(datos.salud.length, 0);
  assert.equal(Salud.hay(datos.salud), false);
});

test('el cardio del reloj conserva FC, kcal y distancia', () => {
  const { normalizar } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  const reloj = datos.cardio.find(c => c.origen === 'reloj');
  assert.equal(reloj.fcMedia, 148);
  assert.equal(reloj.fcMax, 171);
  assert.equal(reloj.kcal, 430);
  assert.equal(reloj.distanciaM, 7200);
  assert.equal(reloj.rpeDeFc, true);
  // El cardio anotado a mano sigue sin ninguna de esas claves.
  const manual = datos.cardio.find(c => c.origen !== 'reloj');
  assert.equal(manual.fcMedia, null);
  assert.equal(manual.rpeDeFc, false);
});

test('la sugerencia de sueño del reloj viaja con la respuesta', () => {
  const { normalizar } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  assert.equal(datos.readiness[0].suenoSugerido, 4);
  assert.equal(datos.readiness[0].fcOrigen, 'reloj');
});

test('el objetivo de pasos sale del plan cuando la fase pide extra', () => {
  const { normalizar, Salud } = cargarCoach();
  const salud = [];
  for (let d = 1; d <= 14; d++) {
    salud.push({ fecha: `2026-08-${String(d).padStart(2, '0')}`, pasos: 7000 });
  }
  const datos = normalizar({
    logs: [], planMod: [], readinessDiario: [], saludDiaria: salud,
    nutricion: {
      version: 1,
      faseActual: {
        id: 'f1', tipo: 'DEFICIT', inicio: '2026-08-15', estado: 'RUNNING',
        pasosExtraAcumuladosDia: 2350,
      },
    },
  });
  const obj = Salud.objetivoPasos(datos);
  assert.equal(obj.deNutricion, true);
  assert.equal(obj.base, 7000);
  assert.equal(obj.objetivo, 9400);       // 7000 + 2350 redondeado a la centena
  assert.equal(obj.minimo, 8000);
  assert.equal(Salud.nivelPasos(obj, 9500), 2);
  assert.equal(Salud.nivelPasos(obj, 8200), 1);
  assert.equal(Salud.nivelPasos(obj, 7000), 0);
});

test('sin fase de nutrición manda la referencia general', () => {
  const { normalizar, Salud } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  const obj = Salud.objetivoPasos(datos);
  assert.equal(obj.deNutricion, false);
  assert.equal(obj.objetivo, 12000);
  assert.equal(obj.minimo, 8000);
});

test('el factor de actividad exige 7 días completos y se acota', () => {
  const { normalizar, Salud } = cargarCoach();
  const pocos = normalizar(copiaConReloj());
  assert.equal(Salud.factorActividad(pocos.salud), null);

  const dias = [];
  for (let d = 1; d <= 9; d++) {
    dias.push({ fecha: `2026-09-${String(d).padStart(2, '0')}`, kcalTotal: 9000, kcalBasal: 1700 });
  }
  const muchos = normalizar({ logs: [], planMod: [], readinessDiario: [], saludDiaria: dias });
  assert.equal(Salud.factorActividad(muchos.salud), 2.2);   // tope fisiológico
});

test('la vista Readiness pinta sueño y pasos del reloj', () => {
  const { normalizar, Vistas, llamadasLineas } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  const ctx = {
    datos, perfil: datos.perfil,
    desde: new Date(2026, 8, 18), hasta: new Date(2026, 8, 19),
    fuerzaR: [], cardioR: datos.cardio, readinessR: datos.readiness, saludR: datos.salud,
  };
  const html = Vistas.readiness(ctx);
  assert.match(html, /Sueño del reloj/);
  assert.match(html, /Pasos por día/);
  assert.match(html, /Gasto medido/);
  // La tabla diaria enseña la noche medida y la corrección de la sugerencia.
  assert.match(html, /7 h 10 min/);
  assert.match(html, /reloj 4 \(−1\)/);
  const nombres = llamadasLineas.flatMap(l => l.series.map(s => s.nombre));
  assert.ok(nombres.includes('Dormido'));
  assert.ok(nombres.some(n => n.startsWith('Objetivo')));
});

test('la vista Sesiones distingue el cardio del reloj', () => {
  const { normalizar, Vistas } = cargarCoach();
  const datos = normalizar(copiaConReloj());
  const html = Vistas.sesiones({ datos, fuerzaR: [], cardioR: datos.cardio });
  assert.match(html, /⌚ reloj/);
  assert.match(html, /FC media 148 ppm/);
  assert.match(html, /7,2 km/);
  assert.match(html, /intensidad 6\/10 \(por FC\)/);
});
