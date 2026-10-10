// Casos sintéticos basados en test/medidas_test.dart del móvil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach } from './comun.mjs';
cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const { Evolucion: E, FotosTL: Fotos, FisicaVista, VistasEsc } = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'vistas.js', 'fisica-vista.js');
const r = (fecha, cm, sitio = 'cintura') => ({ fecha, sitio, cm });
const modelo = registros => E.preparar({ medidas: { registros } });
const conCintura = () => modelo([r('2026-06-01', 88), r('2026-09-01', 82)]);

test('móvil: arrastre por sitio conserva fechas reales y delta de −6 cm', () => {
  const [d] = E.compararContornos(conCintura(), '2026-06-03', '2026-09-02');
  assert.equal(d.deltaCm, -6);
  assert.equal(d.desde.fecha, '2026-06-01'); assert.equal(d.hasta.fecha, '2026-09-01');
});
test('móvil: una misma medida en ambos extremos no es evolución', () => {
  assert.deepEqual(E.compararContornos(modelo([r('2026-06-01', 88)]), '2026-06-05', '2026-06-20'), []);
});
test('móvil: no arrastra más de 30 días ni mira medidas futuras', () => {
  assert.equal(E.vigenteEn(conCintura(), '2026-07-01', 'cintura').registro.cm, 88);
  assert.equal(E.vigenteEn(conCintura(), '2026-07-02', 'cintura').registro, null);
  assert.equal(E.vigenteEn(conCintura(), '2026-05-31', 'cintura').registro, null);
  assert.deepEqual(E.compararContornos(conCintura(), '2026-06-03', '2026-12-01'), []);
});
test('móvil: medida del día prevalece sobre la anterior, por sitio', () => {
  const m = modelo([r('2026-06-01', 88), r('2026-06-03', 86), r('2026-06-04', 85), r('2026-06-02', 100, 'pecho')]);
  assert.equal(E.vigenteEn(m, '2026-06-03', 'cintura').registro.cm, 86);
  assert.equal(E.vigenteEn(m, '2026-06-03', 'pecho').registro.fecha, '2026-06-02');
});
test('móvil: fechas iguales, invertidas o extremo sin medida no comparan', () => {
  assert.deepEqual(E.compararContornos(conCintura(), '2026-09-02', '2026-06-03'), []);
  assert.deepEqual(E.compararContornos(conCintura(), '2026-09-02', '2026-09-02'), []);
  assert.deepEqual(E.compararContornos(modelo([r('2026-09-01', 82)]), '2026-06-03', '2026-09-02'), []);
});
test('móvil: cintura primera, resto por magnitud; cambio cero es medida nueva', () => {
  const rs = [['cintura', 88, 86], ['pecho', 100, 104], ['biceps_der', 36, 37], ['muslo_der', 58, 61], ['cuello', 39, 39]]
    .flatMap(([s, a, b]) => [r('2026-06-01', a, s), r('2026-09-01', b, s)]);
  const ds = E.compararContornos(modelo(rs), '2026-06-01', '2026-09-01');
  assert.deepEqual(ds.map(d => d.sitio), ['cintura', 'pecho', 'muslo_der', 'biceps_der', 'cuello']);
  assert.equal(ds.at(-1).deltaCm, 0);
});
test('duplicados idénticos cuentan una vez; contradictorios no se eligen ni se sustituyen con medidas viejas', () => {
  const m = modelo([r('2026-06-01', 88), r('2026-06-01', 88), r('2026-06-10', 80), r('2026-06-10', 81)]);
  assert.equal(m.registros.length, 2); assert.equal(m.repetidos, 2); assert.equal(m.conflictos.length, 1);
  assert.equal(E.vigenteEn(m, '2026-06-11', 'cintura').motivo, 'registros contradictorios');
});
test('valores cero, inválidos, campos ausentes y unidades: cm canónico', () => {
  const m = E.preparar({ unidadMedida: 'in', medidas: { registros: [r('2026-06-01', 0), r('2026-06-02', '88'), r('2026-06-03', 88), r('incorrecta', 86), { sitio: 'cintura' }] } });
  assert.equal(m.registros.length, 1); assert.equal(m.registros[0].cm, 88); assert.equal(m.descartadas, 4);
  assert.equal(E.preparar({}).registros.length, 0);
});
test('JSON es instantánea: bloque vacío conserva el vacío frente al ZIP; JSON antiguo permite índice ZIP', () => {
  const zip = { registros: [r('2026-06-01', 88)] };
  assert.equal(E.preparar({ medidas: { registros: [] } }, zip).registros.length, 0);
  assert.equal(E.preparar({ logs: [] }, zip).fuente, 'zip');
  assert.equal(E.preparar(null, zip).registros.length, 1);
});
test('la resolución ZIP sin JSON conserva metadatos de archivos ausentes', () => {
  const indiceZip = Fotos.leerIndice({ fotos: [{ fecha: '2026-06-01', pose: 'espalda', archivo: 'cualquier.jpg' }] });
  const [f] = Fotos.resolver({ indiceZip });
  assert.equal(f.tieneImagen, false); assert.equal(f.fuente, 'zip'); assert.equal(f.pose, 'espalda');
  assert.equal(Fotos.resolver({ indiceJson: Fotos.leerIndice({ fotos: [] }), indiceZip }).length, 0);
});
test('corregir fecha o pose sin renombrar cambia pool y medidas, nunca la imagen', () => {
  const archivo = 'foto_20260601_frente.jpg';
  const guardadas = [{ archivo, metaZip: { fecha: '2026-06-01', pose: 'frente' } }];
  const g = Fotos.resolver({ guardadas, indiceJson: Fotos.leerIndice({ fotos: [{ archivo, fecha: '2026-09-02', pose: 'perfil' }] }) });
  assert.equal(g[0].archivo, archivo); assert.equal(g[0].pose, 'perfil');
  assert.equal(E.vigenteEn(conCintura(), g[0].fecha, 'cintura').registro.cm, 82);
  assert.equal(E.emparejar(g, { pose: 'frente' }).pool.length, 0);
});
test('comparador exige misma pose, archivos diferentes y ambos binarios', () => {
  const g = [{ archivo: 'a.jpg', fecha: '2026-06-01', pose: 'frente', tieneImagen: true }, { archivo: 'b.jpg', fecha: '2026-09-01', pose: 'perfil', tieneImagen: true }, { archivo: 'c.jpg', fecha: '2026-09-01', pose: 'frente', tieneImagen: true }, { archivo: 'd.jpg', fecha: '2026-09-02', pose: 'frente', tieneImagen: false }];
  assert.equal(E.emparejar(g).valida, true);
  assert.deepEqual(E.emparejar(g).pool.map(x => x.archivo), ['a.jpg', 'c.jpg', 'd.jpg']);
  assert.equal(E.emparejar(g, { a: 'a.jpg', b: 'a.jpg' }).valida, false);
  assert.equal(E.emparejar(g, { a: 'a.jpg', b: 'd.jpg' }).valida, false);
  assert.equal(E.emparejar(g, { pose: 'perfil' }).valida, false);
});
test('móvil: tendencia mínimos cuadrados, 3 puntos y 21 días como mínimo', () => {
  assert.equal(E.tendenciaDe([r('2026-06-01', 88), r('2026-09-01', 82)]), null);
  assert.equal(E.tendenciaDe([r('2026-06-01', 88), r('2026-06-10', 87), r('2026-06-21', 86)]), null);
  const t = E.tendenciaDe([r('2026-06-01', 88), r('2026-06-11', 87), r('2026-06-22', 85.9)]);
  assert.ok(Math.abs(t.pendienteCmPorDia + 0.1) < 1e-10); assert.ok(Math.abs(t.cmPorMes + 3.044) < 1e-10);
  assert.equal(E.tendenciaDe([r('2026-06-01', 88), r('2026-06-11', 88), r('2026-06-22', 88)]).cmPorMes, 0);
});
test('fechas locales no cambian y arrastre cuenta días civiles alrededor de DST', () => {
  const m = modelo([r('2026-03-01T23:30:00-08:00', 88)]);
  assert.equal(m.registros[0].fecha, '2026-03-01');
  assert.equal(E.dias('2026-03-01', '2026-03-31'), 30);
  assert.equal(E.vigenteEn(m, '2026-03-31', 'cintura').registro.cm, 88);
});
test('fase histórica: intervalos explícitos, huecos, solapamientos y fin desconocido', () => {
  const raw = { fasePeso: 'superavit', nutricion: { fasesCerradas: [{ tipo: 'DEFICIT', inicio: '2026-06-01', fin: '2026-06-30', estado: 'CLOSED' }], fase: { tipo: 'SURPLUS', inicio: '2026-08-01' } } };
  assert.equal(E.faseEn(raw, '2026-06-30').texto, 'Déficit');
  assert.equal(E.faseEn(raw, '2026-07-01'), null);
  assert.equal(E.faseEn(raw, '2026-08-01').texto, 'Superávit');
  raw.nutricion.fasesCerradas[0].fin = null;
  assert.equal(E.faseEn(raw, '2026-06-30'), null);
  raw.nutricion.fasesCerradas[0].fin = '2026-09-01';
  assert.equal(E.faseEn(raw, '2026-08-01'), null);
  assert.equal(E.faseEn({ fasePeso: 'deficit' }, '2026-06-01'), null);
});
test('datos originales inmutables al asociar fotos y calcular tendencias', () => {
  const raw = { medidas: { registros: [r('2026-06-01', 88), r('2026-06-22', 86), r('2026-07-01', 85)] } };
  const antes = JSON.stringify(raw); const m = E.preparar(raw);
  E.vigenteEn(m, '2026-06-03', 'cintura'); E.tendenciaDe(m.registros); E.compararContornos(m, '2026-06-01', '2026-07-01');
  assert.equal(JSON.stringify(raw), antes);
});
test('encuadre limitado, reversible y siempre escala uniforme', () => {
  assert.deepEqual(E.encuadre({ zoom: 99, x: -999, y: Infinity }), { zoom: 3, x: -50, y: 0 });
  assert.deepEqual(E.encuadre(), { zoom: 1, x: 0, y: 0 });
});
test('vistas muestran medidas reales, ausencia, sin músculo deducido y texto escapado', () => {
  const a = { archivo: 'arbitrario<img>.jpg', fecha: '2026-06-03', pose: 'frente', pesoKg: null, tieneImagen: true };
  const b = { archivo: 'b.jpg', fecha: '2026-09-02', pose: 'frente', pesoKg: 80, tieneImagen: true };
  const html = FisicaVista.comparador([a, b], conCintura(), {}, { corte: 50, opacidad: 50, encuadres: {} });
  assert.ok(html.includes('1 jun 2026')); assert.ok(html.includes('1 sep 2026'));
  assert.ok(html.includes('−6 cm')); assert.ok(html.includes('Peso guardado en la ficha: —'));
  assert.ok(html.includes('arbitrario&lt;img&gt;.jpg')); assert.ok(!html.includes('arbitrario<img>'));
  assert.ok(!html.includes('Peso guardado B − A'));
  const sin = FisicaVista.comparador([a, { ...b, tieneImagen: false }], modelo([]), {}, { corte: 50, opacidad: 50, encuadres: {} });
  assert.ok(sin.includes('Falta una imagen')); assert.ok(!sin.includes('data-original'));
  assert.ok(VistasEsc.contornos(conCintura(), {}).includes('Datos insuficientes para una tendencia'));
});
