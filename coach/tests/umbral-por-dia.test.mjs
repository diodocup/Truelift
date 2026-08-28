import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargarCoach() {
  const llamadasLineas = [];
  const state = { serie1: null, serie2: null, mostrarFcReposo: true };
  const sandbox = {
    console,
    State: state,
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
     ;globalThis.__catalogoSeries = catalogoSeries;
     ;globalThis.__VFC = VFC;
     ;globalThis.__FCReposo = FCReposo;
     ;globalThis.__Vistas = Vistas;`,
    sandbox,
  );
  return {
    normalizar: sandbox.__normalizar,
    catalogoSeries: sandbox.__catalogoSeries,
    VFC: sandbox.__VFC,
    FCReposo: sandbox.__FCReposo,
    Vistas: sandbox.__Vistas,
    state,
    llamadasLineas,
  };
}

function cargarCharts() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL('data.js', appDir), 'utf8'), sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('charts.js', appDir), 'utf8')}
     ;globalThis.__Charts = Charts;`,
    sandbox,
  );
  return sandbox.__Charts;
}

const dia = i => new Date(2026, 0, 1 + i);
const iso = i => `2026-${String(dia(i).getMonth() + 1).padStart(2, '0')}-${String(dia(i).getDate()).padStart(2, '0')}`;
const ctxDe = datos => ({
  datos,
  perfil: datos.perfil,
  fuerzaR: [],
  cardioR: [],
  readinessR: datos.readiness,
  desde: datos.readiness[0].fecha,
  hasta: datos.readiness.at(-1).fecha,
});

/* Cliente cuya VFC cae de golpe a la mitad: 29 noches en 100, una noche mala
   de 90 (la 30ª) y 30 noches en 50. El umbral de HOY (48,5) no dice nada de
   aquella noche de enero, que sí fue baja para su nivel de entonces (97). */
function historicoConEscalon(normalizar) {
  const noches = Array.from({ length: 60 }, (_, i) => ({
    fecha: iso(i),
    vfc: i < 29 ? 100 : i === 29 ? 90 : 50,
    vfcDescartada: false,
  }));
  return normalizar({ vfcActiva: true, logs: [], planMod: [], readinessDiario: noches });
}

test('el umbral nocturno de VFC es el de cada fecha, no el de hoy', () => {
  const coach = cargarCoach();
  const datos = historicoConEscalon(coach.normalizar);
  const serie = coach.VFC.umbralesSerie(datos.readiness, datos.perfil);

  assert.equal(serie.has(iso(28)), false);        // con 29 noches aún no hay banda
  assert.equal(serie.get(iso(29)).baja, 97);      // mediana 100 − suelo del MAD (3)
  assert.equal(serie.get(iso(59)).baja, 48.5);    // últimas 30 noches: mediana 50 − 1,5
  assert.equal(coach.VFC.umbrales(datos.readiness, datos.perfil).baja, 48.5);
});

test('la gráfica de VFC pinta cada noche contra el umbral de su fecha', () => {
  const coach = cargarCoach();
  const datos = historicoConEscalon(coach.normalizar);
  const html = coach.Vistas.readiness(ctxDe(datos));
  const noches = coach.llamadasLineas.at(-1).series.find(s => s.nombre === 'VFC nocturna').puntos;

  assert.equal(noches[29].y, 90);
  assert.equal(noches[29].c, '#e0a63c');   // 90 < 97: baja para el umbral de aquel día
  assert.equal(noches[28].c, '#5aa9e6');   // sin banda todavía: no se juzga
  assert.equal(noches.at(-1).c, '#5aa9e6'); // 50 ≥ 48,5: normal para su fecha
  assert.match(html, /por debajo del umbral de esa noche/);
  assert.match(html, /Por debajo del umbral nocturno de esa fecha/);
});

test('el comparador dibuja el umbral de VFC día a día', () => {
  const coach = cargarCoach();
  const datos = historicoConEscalon(coach.normalizar);
  const serie = coach.catalogoSeries(ctxDe(datos)).find(s => s.id === 'vfc');

  assert.equal(serie.umbrales, undefined);
  assert.equal(serie.umbralesDia.length, 1);
  const pts = serie.umbralesDia[0].puntos;
  assert.equal(pts.length, 31);            // desde la 30ª noche hasta la última
  assert.equal(pts[0].y, 97);
  assert.equal(pts.at(-1).y, 48.5);
});

test('la banda de FC en reposo también es la de cada fecha', () => {
  const coach = cargarCoach();
  const datos = coach.normalizar({
    vfcActiva: true,
    logs: [],
    planMod: [],
    readinessDiario: Array.from({ length: 40 }, (_, i) => ({
      fecha: iso(i),
      fcReposo: i < 20 ? 50 : 100,
      vfcDescartada: false,
    })),
  });
  const serie = coach.FCReposo.bandaSerie(datos.readiness);

  assert.equal(serie.has(iso(12)), false);      // 13 noches: por debajo del mínimo
  assert.equal(serie.get(iso(13)).alta, 51.5);  // mediana 50 + suelo del MAD (1,5)
  assert.equal(serie.get(iso(39)).alta, 103);   // últimas 30: mediana 100 + 3
  assert.equal(coach.FCReposo.banda(datos.readiness).alta, 103);

  const html = coach.Vistas.readiness(ctxDe(datos));
  const fcAlta = coach.llamadasLineas.at(-1).series.find(s => s.nombre.startsWith('FC alta'));
  assert.equal(fcAlta.puntos.length, 27);       // una por noche con banda
  assert.equal(fcAlta.puntos[0].y, 51.5);
  assert.equal(fcAlta.puntos.at(-1).y, 103);

  // Detalle diario: la FC fuera de banda se marca en ámbar, como la VFC.
  const filas = html.split('<tr>').filter(f => f.includes('<td class="num">'));
  const enAmbar = f => /Por encima del umbral de FC/.test(f);
  assert.equal(filas.length, 40);              // una fila por noche, la última arriba
  assert.equal(enAmbar(filas[19]), true);      // 1ª noche de 100 ppm: alta para su banda (51,5)
  assert.match(filas[19], /<span class="chip ambar"[^>]*>100<\/span>/);
  assert.equal(enAmbar(filas[26]), false);     // noche de 50 ppm con banda: en banda
  assert.equal(enAmbar(filas[0]), false);      // última noche: 100 ppm ya es su normal (banda 103)
});

test('dobleEje pinta el umbral por día como línea discontinua', () => {
  const charts = cargarCharts();
  const html = charts.dobleEje({ series: [{
    label: 'VFC (HRV)', color: '#c792ea', unidad: 'ms', eje: 'izq',
    puntos: [{ x: dia(0), y: 90 }, { x: dia(1), y: 95 }],
    umbralesDia: [{ label: 'VFC baja (umbral de cada noche)', color: '#e0a63c',
                    puntos: [{ x: dia(0), y: 97 }, { x: dia(1), y: 80 }] }],
  }] });

  assert.match(html, /stroke="#e0a63c" stroke-dasharray="3 4"/);
  assert.match(html, /VFC baja \(umbral de cada noche\)/);
});
