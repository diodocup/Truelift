import assert from 'node:assert/strict';
import test from 'node:test';
import { cargar, copiaSintetica, sesion, entrada } from './comun.mjs';

const { ImportarJSON: I } = cargar('importar.js');
const texto = o => JSON.stringify(o);

test('copia reciente válida: resumen con periodo, último entreno y último registro', async () => {
  const raw = copiaSintetica({ dias: 4 });
  raw.medidas.registros.push({ fecha: '2026-08-20', sitio: 'cintura', cm: 83 });
  const inf = await I.analizar(texto(raw), { nombreArchivo: 'copia_truelift_2026-08-21.json' });
  assert.equal(inf.ok, true, inf.errores.join());
  const r = inf.resumen;
  assert.equal(r.sesionesFuerza, 4);
  assert.equal(r.sesionesCardio, 1);
  assert.equal(r.ultimoEntreno, '2026-08-12');
  // El último registro es una medida posterior al último entreno: no se confunden.
  assert.equal(r.ultimoRegistro, '2026-08-20');
  assert.equal(r.primerRegistro, '2026-08-03');
  assert.equal(r.fechaNombreArchivo, '2026-08-21');
  // fechaUltimaCopia es la exportación ANTERIOR, no la de esta copia.
  assert.equal(r.exportacionAnterior, '2026-07-01');
  assert.match(inf.sha256, /^[0-9a-f]{64}$/);
});

test('copia antigua compatible: sin medidas, nutrición ni modalidades', async () => {
  const raw = { sexo: 'hombre', sistema: 'simple', dias: '3',
    logs: [sesion('2026-07-05T10:00:00', 'Día 1', [entrada('Sentadilla', 80, [5, 5, 5], [])],
                  { rendimientoPct: 101 })] };
  const inf = await I.analizar(texto(raw));
  assert.equal(inf.ok, true);
  assert.equal(inf.resumen.tieneBloqueMedidas, false);
  assert.equal(inf.resumen.tieneNutricion, false);
  assert.equal(inf.resumen.fotosIndice, 0);
  assert.equal(inf.calidad.invalidos, 0);
});

test('copia solo con ajustes (sin logs) se acepta como hace el móvil', async () => {
  const inf = await I.analizar(texto({ sexo: 'mujer', dias: '3' }));
  assert.equal(inf.ok, true);
  assert.equal(inf.resumen.sesionesFuerza, 0);
  assert.equal(inf.resumen.ultimoRegistro, null);
});

test('JSON inválido, no-objeto y ajeno se rechazan sin guardar', async () => {
  for (const t of ['{roto', '[]', '42', 'null', texto({ hola: 1 })]){
    const inf = await I.analizar(t);
    assert.equal(inf.ok, false, t);
    assert.ok(inf.errores.length, t);
    assert.equal(inf.raw, undefined);
  }
});

test('contenedores con tipo imposible se rechazan', async () => {
  const inf = await I.analizar(texto({ sexo: 'hombre', logs: { a: 1 } }));
  assert.equal(inf.ok, false);
  assert.match(inf.errores[0], /logs/);
  const inf2 = await I.analizar(texto({ sexo: 'hombre', medidas: [] }));
  assert.equal(inf2.ok, false);
});

test('cero, ausente y no válido se distinguen', async () => {
  const raw = copiaSintetica({ dias: 1 });
  raw.logs[0].entradas = [
    entrada('Dominadas', 0, [0, 6, null], [2, null, null]),        // carga 0 válida, 1 serie a 0, 1 sin anotar
    entrada('Press banca', 'sesenta', [8, 'ocho', -1], [2, 15, 1]), // kg, reps×2 y RIR no válidos
  ];
  const inf = await I.analizar(texto(raw));
  assert.equal(inf.ok, true);
  const c = inf.calidad;
  assert.equal(c.cargasCero, 1);
  assert.equal(c.repsCero, 1);
  assert.equal(c.seriesSinAnotar, 1);
  assert.equal(c.invalidos, 4);
  assert.ok(c.ejemplos.some(e => e.ruta.endsWith('.kg')));
  assert.ok(inf.avisos.some(a => /4 valores no válidos/.test(a)));
});

test('registros sin fecha válida se cuentan y no entran en el resumen', async () => {
  const raw = copiaSintetica({ dias: 2 });
  raw.logs.push({ fecha: '2026-02-31T10:00:00', entradas: [] });
  raw.logs.push('basura');
  const inf = await I.analizar(texto(raw));
  assert.equal(inf.ok, true);
  assert.equal(inf.resumen.sesionesFuerza, 2);
  assert.equal(inf.calidad.registrosDescartados, 2);
});

test('unidad alternativa: lb es solo presentación (los valores siguen en kg)', async () => {
  const raw = copiaSintetica({ dias: 1 });
  raw.unidadPeso = 'lb';
  const inf = await I.analizar(texto(raw));
  assert.equal(inf.resumen.unidadPeso, 'lb');
  assert.equal(inf.calidad.invalidos, 0);
});

test('fechas: el día sale del texto sin desplazamientos por zona horaria', () => {
  assert.equal(I.dia('2026-03-29T00:30:00.000'), '2026-03-29');
  assert.equal(I.dia('2026-03-29T23:59:00Z'), '2026-03-29');
  assert.equal(I.dia('2026-10-25'), '2026-10-25');
  assert.equal(I.dia('2026-02-29'), null);
  assert.equal(I.dia('2028-02-29'), '2028-02-29');
  assert.equal(I.dia('29/03/2026'), null);
  assert.equal(I.dia(20260329), null);
});

test('analizar no muta el objeto: se puede volver a serializar igual', async () => {
  const raw = copiaSintetica({ dias: 3 });
  const t = texto(raw);
  const inf = await I.analizar(t);
  assert.equal(JSON.stringify(inf.raw), t);
});

test('comparar: copia idéntica', async () => {
  const t = texto(copiaSintetica());
  const a = await I.analizar(t), b = await I.analizar(t);
  const c = I.comparar(a.raw, b.raw, { shaActual: a.sha256, shaNuevo: b.sha256 });
  assert.equal(c.identica, true);
  assert.equal(c.nuevas, 0);
  assert.equal(c.faltan, 0);
});

test('comparar: actualización con sesiones nuevas, misma persona probable', () => {
  const viejo = copiaSintetica({ dias: 4 });
  const nuevo = copiaSintetica({ dias: 6 });
  const c = I.comparar(viejo, nuevo);
  assert.equal(c.identica, false);
  assert.equal(c.nuevas, 2);
  assert.equal(c.faltan, 0);
  assert.equal(c.retroceso, false);
  assert.equal(c.persona, 'probable');
});

test('comparar: retroceso a una copia antigua', () => {
  const actual = copiaSintetica({ dias: 6 });
  const antigua = copiaSintetica({ dias: 3 });
  const c = I.comparar(actual, antigua);
  assert.equal(c.retroceso, true);
  assert.equal(c.terminaAntes, true);
  assert.equal(c.faltan, 3);
  assert.equal(c.nuevas, 0);
});

test('comparar: sesión borrada en el móvil sin terminar antes no es retroceso', () => {
  const actual = copiaSintetica({ dias: 5 });
  const nuevo = copiaSintetica({ dias: 6 });
  nuevo.logs.splice(1, 1); // borró una sesión antigua pero añadió otras
  const c = I.comparar(actual, nuevo);
  assert.equal(c.faltan, 1);
  assert.equal(c.nuevas, 1);
  assert.equal(c.retroceso, false);
});

test('comparar: otra persona (fecha de nacimiento distinta) o sin relación', () => {
  const a = copiaSintetica({ dias: 3 });
  const b = copiaSintetica({ dias: 3 });
  b.fechaNacimiento = '1985-01-01';
  assert.equal(I.comparar(a, b).persona, 'distinta');
  const c = copiaSintetica({ dias: 3, desde: '2025-01-06' });
  delete c.fechaNacimiento;
  assert.equal(I.comparar(a, c).persona, 'sin_relacion');
});

test('nombres de archivo: rutas y caracteres peligrosos', () => {
  for (const n of ['a/b.jpg', '..\\x.jpg', '../x.jpg', '', 'a\u0000.jpg', 5]) assert.equal(I.archivoValido(n), false, String(n));
  assert.equal(I.archivoValido('foto_20260801_frente.jpg'), true);
});

test('límite de tamaño', async () => {
  const inf = await I.analizar('{}', { bytes: I.LIMITE_BYTES + 1 });
  assert.equal(inf.ok, false);
});
