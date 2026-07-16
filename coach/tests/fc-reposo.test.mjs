import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargarCoach(mostrarFcReposo = false) {
  const llamadasLineas = [];
  const state = { serie1: null, serie2: null, mostrarFcReposo };
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
  vm.runInContext(
    `${fs.readFileSync(new URL('views.js', appDir), 'utf8')}
     ;globalThis.__normalizar = normalizar;
     ;globalThis.__catalogoSeries = catalogoSeries;
     ;globalThis.__FCReposo = FCReposo;
     ;globalThis.__Vistas = Vistas;`,
    sandbox,
  );
  return {
    normalizar: sandbox.__normalizar,
    catalogoSeries: sandbox.__catalogoSeries,
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

function datosConFcReposo(normalizar) {
  return normalizar({
    vfcActiva: true,
    logs: [],
    planMod: [],
    readinessDiario: [
      { fecha: '2026-07-14', estadoEntrenar: 91, vfc: 68, vfcDescartada: false, fcReposo: 52 },
      { fecha: '2026-07-15', estadoEntrenar: 88, vfc: 70, vfcDescartada: false, fcReposo: null },
      { fecha: '2026-07-16', estadoEntrenar: 69, vfc: 78, vfcDescartada: false, fcReposo: 51 },
    ],
  });
}

test('normaliza fcReposo y la ofrece en el comparador de series', () => {
  const coach = cargarCoach();
  const datos = datosConFcReposo(coach.normalizar);
  assert.deepEqual(Array.from(datos.readiness, r => r.fcReposo), [52, null, 51]);

  const serie = coach.catalogoSeries({
    datos,
    perfil: datos.perfil,
    fuerzaR: [],
    readinessR: datos.readiness,
    desde: datos.readiness[0].fecha,
    hasta: datos.readiness.at(-1).fecha,
  }).find(s => s.id === 'fc_reposo');

  assert.ok(serie);
  assert.equal(serie.label, 'FC en reposo');
  assert.equal(serie.unidad, 'ppm');
  assert.deepEqual(Array.from(serie.puntos, p => p.y), [52, 51]);
  assert.deepEqual(Array.from(serie.umbrales), []);
});

test('FC alta usa mediana y MAD robustos, descarta noches y exige un mínimo de 14', () => {
  const coach = cargarCoach();
  const fechas = Array.from({ length: 15 }, (_, i) => ({
    fecha: new Date(2026, 5, i + 1),
    fcReposo: 43 + i,
    vfcDescartada: false,
  }));
  fechas.push({ fecha: new Date(2026, 5, 16), fcReposo: 120, vfcDescartada: true });
  const banda = coach.FCReposo.banda(fechas);
  assert.deepEqual(
    { alta: banda.alta, mediana: banda.mediana, mad: banda.mad, noches: banda.noches },
    { alta: 54, mediana: 50, mad: 4, noches: 15 },
  );
  assert.equal(coach.FCReposo.banda(fechas.slice(0, 13)), null);
});

test('FC alta limita la base a 30 noches y aplica el suelo MAD del 3%', () => {
  const coach = cargarCoach();
  const fechas = Array.from({ length: 31 }, (_, i) => ({
    fecha: new Date(2026, 0, i + 1),
    fcReposo: i === 0 ? 120 : 50,
    vfcDescartada: false,
  }));
  const banda = coach.FCReposo.banda(fechas);
  assert.equal(banda.noches, 30);
  assert.equal(banda.mediana, 50);
  assert.equal(banda.mad, 1.5);
  assert.equal(banda.alta, 51.5);
});

test('el botón de Readiness muestra la FC en reposo como línea con puntos unidos', () => {
  const coach = cargarCoach();
  const datos = datosConFcReposo(coach.normalizar);
  const ctx = {
    datos,
    perfil: datos.perfil,
    fuerzaR: [],
    cardioR: [],
    readinessR: datos.readiness,
    desde: datos.readiness[0].fecha,
    hasta: datos.readiness.at(-1).fecha,
  };

  const oculto = coach.Vistas.readiness(ctx);
  assert.match(oculto, /id="btnToggleFcReposo"/);
  assert.match(oculto, />Mostrar FC en reposo</);
  assert.equal(coach.llamadasLineas.at(-1).series.some(s => s.nombre.startsWith('FC en reposo')), false);

  coach.state.mostrarFcReposo = true;
  const visible = coach.Vistas.readiness(ctx);
  const serie = coach.llamadasLineas.at(-1).series.find(s => s.nombre.startsWith('FC en reposo'));
  assert.match(visible, />Ocultar FC en reposo</);
  assert.ok(serie);
  assert.equal(serie.soloPuntos, undefined);
  assert.equal(serie.eje, 'der');
  assert.equal(serie.unidad, 'ppm');
  assert.deepEqual(Array.from(serie.puntos, p => p.y), [52, 51]);
});

test('la gráfica de líneas crea un eje vertical derecho independiente', () => {
  const charts = cargarCharts();
  const d1 = new Date(2026, 6, 14), d2 = new Date(2026, 6, 15);
  const html = charts.lineas({ series: [
    { nombre: 'VFC', color: '#5aa9e6', unidad: 'ms', puntos: [{ x: d1, y: 68 }, { x: d2, y: 70 }] },
    { nombre: 'FC en reposo', color: '#ff7a70', unidad: 'ppm', eje: 'der', puntos: [{ x: d1, y: 52 }, { x: d2, y: 49 }] },
  ] });
  assert.match(html, /data-eje-y="izq"/);
  assert.match(html, /data-eje-y="der"/);
  assert.match(html, /FC en reposo[\s\S]*eje der\./);
  assert.match(html, />ppm</);
});

test('Readiness y el comparador pintan FC alta al alcanzar 14 noches válidas', () => {
  const coach = cargarCoach(true);
  const datos = coach.normalizar({
    vfcActiva: true,
    logs: [],
    planMod: [],
    readinessDiario: Array.from({ length: 14 }, (_, i) => ({
      fecha: new Date(2026, 5, i + 1),
      vfc: 70 + (i % 2),
      vfcDescartada: false,
      fcReposo: 50,
    })),
  });
  const ctx = {
    datos,
    perfil: datos.perfil,
    fuerzaR: [],
    cardioR: [],
    readinessR: datos.readiness,
    desde: datos.readiness[0].fecha,
    hasta: datos.readiness.at(-1).fecha,
  };

  const html = coach.Vistas.readiness(ctx);
  const alta = coach.llamadasLineas.at(-1).series.find(s => s.nombre.startsWith('FC alta'));
  assert.ok(alta);
  assert.equal(alta.eje, 'der');
  assert.equal(alta.unidad, 'ppm');
  assert.equal(alta.dash, '6 4');
  assert.equal(alta.sinPuntos, true);
  assert.deepEqual(Array.from(alta.puntos, p => p.y), [51.5, 51.5]);
  assert.match(html, /FC alta \(51,5 ppm = mediana \+ MAD, 14 noches válidas\)/);

  const fcComparador = coach.catalogoSeries(ctx).find(s => s.id === 'fc_reposo');
  assert.deepEqual(Array.from(fcComparador.umbrales, u => u.y), [51.5]);
});
