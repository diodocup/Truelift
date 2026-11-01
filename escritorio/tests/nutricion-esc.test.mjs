// Nutrición del escritorio (solo consulta): mismos casos que las pruebas de
// la app citadas, sobre escritorio/nutricion-esc.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargarCoach, cargar } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const { NutricionEsc: NE, ImportarJSON, Analisis } = cargar('importar.js', 'analisis.js', 'nutricion-esc.js');

const pref = (j = {}) => NE.preferencias({ dieta: { comidasDia: 4, ...j } }, null);
const repartir = ({ kcal = 2400, peso = 75, proteina = 1.8, p = pref(), mujer = false } = {}) =>
  NE.repartir({ kcalDia: kcal, pesoReferenciaKg: peso, proteinaGPorKg: proteina, pref: p, mujer });
function cuadra(r){
  const suma = k => r.comidas.reduce((a, c) => a + c[k], 0);
  assert.equal(suma('proteinaG'), r.proteinaG);
  assert.equal(suma('hidratosG'), r.hidratosG);
  assert.equal(suma('grasaG'), r.grasaG);
  assert.equal(suma('kcal'), r.kcalDia);
  assert.equal(suma('porcentaje'), 100);
  assert.ok(Math.abs(Math.round(r.proteinaG * 4 + r.hidratosG * 4 + r.grasaG * 9) - r.kcalDia) <= 10);
  r.comidas.forEach(c => assert.ok(c.proteinaG >= 0 && c.hidratosG >= 0 && c.grasaG >= 0));
}

test('reparto (nutricion_reparto_dieta_test): la proteína sale del g/kg y los hidratos completan', () => {
  const r = repartir();
  assert.equal(r.proteinaG, Math.round(75 * 1.8));
  assert.equal(r.grasaG, Math.round(75 * 0.9));
  assert.equal(r.hidratosG, Math.round((2400 - 75 * 1.8 * 4 - 75 * 0.9 * 9) / 4));
  assert.equal(r.hidratosJustos, false);
  cuadra(r);
});

test('reparto: cuadra con 3, 4 y 5 comidas y con comidas de entreno', () => {
  for (let n = 3; n <= 5; n++){
    cuadra(repartir({ p: NE.preferencias({ dieta: { comidasDia: n } }, null) }));
    cuadra(repartir({ kcal: 1850, p: NE.preferencias({ dieta: { comidasDia: n, comidaPreEntreno: 1, comidaPostEntreno: 2 } }, null) }));
  }
});

test('reparto: la proteína va a partes iguales y la comida del entreno lleva más hidratos', () => {
  const g = repartir().comidas.map(c => c.proteinaG);
  assert.ok(Math.max(...g) - Math.min(...g) <= 1);
  const sin = repartir({ p: NE.preferencias({ dieta: { comidasDia: 3 } }, null) });
  const con = repartir({ p: NE.preferencias({ dieta: { comidasDia: 3, comidaPostEntreno: 1 } }, null) });
  assert.equal(con.comidas[1].momento, 'despues');
  assert.ok(con.comidas[1].grasaG < sin.comidas[1].grasaG);
  assert.ok(con.comidas[1].hidratosG > sin.comidas[1].hidratosG);
  assert.equal(con.hidratosG, sin.hidratosG);
});

test('preferencias: plantilla por defecto, rangos y «después» nunca antes de «antes»', () => {
  const p = NE.preferencias(null, { porcionesProteinaDia: 5 });
  assert.equal(p.comidasDia, 5);
  assert.deepEqual(p.puntosComidas, [20, 10, 30, 10, 30]);
  const q = NE.preferencias({ dieta: { comidasDia: 9, grasaGPorKg: 5, comidaPreEntreno: 2, comidaPostEntreno: 1 } }, null);
  assert.equal(q.comidasDia, 5);
  assert.equal(q.grasaGPorKg, 2);
  assert.equal(q.comidaPostEntreno, null);
  // `comidaEntreno` (antes del 07/10/2026) se lee como la de después.
  assert.equal(NE.preferencias({ dieta: { comidasDia: 3, comidaEntreno: 2 } }, null).comidaPostEntreno, 2);
});

test('ilustraciones del cuerpo (estado_visual_test)', () => {
  const c = (mujer, alturaCm, pesoKg, grasaPct) => NE.celda({ mujer, alturaCm, pesoKg, grasaPct });
  assert.equal(c(false, 180, 80, 10), 'm4g2');
  assert.equal(c(false, 165, 80, 10), 'm5g2');
  assert.equal(c(false, 195, 80, 10), 'm2g2');
  assert.equal(c(true, 165, 60, 25), 'm3g4');
  assert.equal(c(true, 165, 60, 15), 'm4g1');
  assert.equal(c(false, 0, 80, 10), null);
  assert.equal(c(false, 180, 80, 3), null);
  assert.equal(c(false, 180, 150, 10), null);
  assert.equal(c(true, 165, 60, 8), null);
  assert.equal(c(false, 180, 80, NaN), null);
  for (const s of ['hombre', 'mujer']) for (let m = 1; m <= 5; m++) for (let g = 1; g <= 6; g++)
    assert.ok(fs.existsSync(new URL(`../estados/${s}/m${m}g${g}.webp`, import.meta.url)), `${s} m${m}g${g}`);
});

test('plan: bloques terminados fuera de la proyección y el en curso desde hoy', () => {
  const d = (y, m, dd) => new Date(y, m - 1, dd);
  const b = (tipo, ini, fin, tasa) => ({ tipo, inicio: ini, fin, tasaPctSemana: tasa, dias: NE.entre(ini, fin) + 1, semanas: (NE.entre(ini, fin) + 1) / 7 });
  const plan = { bloques: [b('CUT', d(2026, 8, 1), d(2026, 8, 31), -0.5), b('BRIDGE', d(2026, 9, 1), d(2026, 9, 14), 0), b('BULK', d(2026, 9, 15), d(2026, 12, 31), 0.25)] };
  const pr = NE.proyectar(plan, { pesoPartidaKg: 80, grasaPartidaPct: 15, hoy: d(2026, 10, 1), perfil: { sexo: 'M', alturaCm: 180, experienciaFuerza: 'INTERMEDIATE' } });
  assert.equal(pr.consumidos.length, 2);
  assert.equal(pr.bloques.length, 1);
  assert.equal(pr.bloques[0].enCurso, true);
  // Solo los días que quedan (del 1/10 al 31/12).
  const esperado = PlanTemporada.pesoTrasDias(80, 0.25, NE.entre(d(2026, 10, 1), d(2026, 12, 31)));
  assert.ok(Math.abs(pr.bloques[0].pesoFinKg - esperado) < 1e-9);
  assert.ok(pr.bloques[0].grasaFinPct > 15, 'en volumen sube el % graso');
  const c = NE.curva(pr, { hoy: d(2026, 10, 1), pesoRealPorDia: new Map([['2026-08-10', 82]]) });
  assert.equal(c.puntos.length, NE.entre(d(2026, 8, 1), d(2026, 12, 31)) + 1);
  assert.equal(c.puntos[0].pesoKg, 82, 'lo vivido sale de la tendencia más cercana');
  assert.equal(c.puntos.at(-1).pesoKg, pr.bloques[0].pesoFinKg);
  assert.deepEqual(NE.nombresEtapas([...plan.bloques, b('CUT', d(2027, 1, 1), d(2027, 2, 1), -0.5)]),
    ['Definición 1', 'Normocalórica', 'Volumen', 'Definición 2']);
});

test('reproducción (nutricion_plan_reproduccion_test): fundido, etapa por día y última imagen', () => {
  const d = (y, m, dd) => new Date(y, m - 1, dd);
  const b = { tipo: 'CUT', inicio: d(2026, 1, 1), fin: d(2026, 6, 30), tasaPctSemana: -0.75 };
  b.dias = NE.entre(b.inicio, b.fin) + 1;
  const pr = NE.proyectar({ bloques: [b] }, { pesoPartidaKg: 90, grasaPartidaPct: 24, hoy: b.inicio, perfil: { sexo: 'M', alturaCm: 180 } });
  const c = NE.curva(pr, { hoy: b.inicio });
  const R = NE.reproduccion({ curva: c, desde: b.inicio, hasta: b.fin, bloques: [b], nombres: ['Definición'], mujer: false, alturaCm: 180, hoy: b.inicio, fmt: x => x.toISOString().slice(0, 10) });
  assert.equal(R.dias, c.puntos.length);
  const ini = R.en(0), fin = R.en(1);
  assert.equal(ini.base, R.rutas[0]);
  assert.equal(fin.base, R.rutas.at(-1));
  assert.equal(fin.etapa, 'Definición');
  assert.match(ini.rotulo, /^Inicial · 2026-01-01/);
  assert.match(fin.rotulo, /^Final/);
  assert.ok(R.distintas.length >= 2, 'el cuerpo cambia a lo largo de la definición');
  // Justo después de un cambio de ilustración, la nueva aparece fundiéndose.
  const k = R.rutas.findIndex((r, i) => i > 0 && r !== R.rutas[i - 1]);
  const f = R.en((k + 0.01) / (R.dias - 1));
  assert.equal(f.encima, R.rutas[k]);
  assert.ok(f.mezcla > 0 && f.mezcla < 1);
});

test('copia de ejemplo: pauta habitual con su último cambio, plan con proyección e imágenes', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../ejemplo/copia_truelift_2026-11-01.json', import.meta.url), 'utf8'));
  const M = Analisis.preparar(raw, ImportarJSON.resumen(raw));
  const X = NE.preparar(M.raw, M.datos.nut, M.ref);
  assert.equal(X.presente, true);
  assert.equal(X.modalidad, 'HABITUAL');
  assert.equal(X.reparto, null, 'sin contar calorías no hay reparto');
  assert.match(X.ultimoCambio.texto, /171 kcal más al día/);
  assert.equal(X.plan.filas.length, 4);
  assert.ok(X.plan.proyeccion && X.plan.curva);
  assert.equal(X.plan.imagenes.motivo, null);
  assert.equal(NE.miles(2800), '2.800');
});
