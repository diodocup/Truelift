// Progreso de la fase frente a lo pactado (App-PRO 18/10/2026): mismos casos
// que test/nutricion_progreso_fase_test.dart de la app, sobre coach/nutricion.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarCoach } from './comun.mjs';

const { ProgresoFase: PF, normalizarNutricion, Nutricion } = cargarCoach('data.js', 'nutricion.js');

const inicio = new Date(2026, 6, 1);
const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const tras = (p, t, d) => p * Math.pow(1 + t / 100, d / 7);
const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const deficit = (pesoHoy, { dias = 42, meta = 75, finFijo = null } = {}) => PF.calcular({
  tipo: 'DEFICIT', inicio, hoy: mas(inicio, dias), pesoInicioKg: 80, pesoHoyKg: pesoHoy,
  tramos: [{ desde: inicio, tasaPctSemana: -0.75 }], pesoMetaKg: meta, finFijo });

test('trayectoria por tramos: un cambio de ritmo no redibuja el pasado y sigue sin saltos', () => {
  const pts = PF.trayectoria({ inicio, fin: mas(inicio, 28), pesoInicialKg: 80,
    tramos: [{ desde: inicio, tasaPctSemana: -0.75 }, { desde: mas(inicio, 14), tasaPctSemana: -0.25 }] });
  const antes = tras(80, -0.75, 14);
  cerca(pts[14].pesoObjetivoKg, antes);
  cerca(pts[28].pesoObjetivoKg, tras(antes, -0.25, 14));
  cerca(pts[0].limiteInferiorKg, 80);
});

test('lectura acumulada: en línea, por detrás, por delante, al revés y meta alcanzada', () => {
  const p = deficit(tras(80, -0.75, 42));
  assert.equal(p.estado, 'enLinea');
  cerca(p.desvioKg, 0);
  cerca(p.fraccionPeso, p.fraccionPrevista);
  assert.equal(p.totalKg, 5);
  assert.equal(p.semanaActual, 7);
  assert.ok(p.fin && p.fraccionTiempo > 0 && p.llegadaMeta);
  const detras = deficit(79.5);
  assert.equal(detras.estado, 'porDetras');
  assert.ok(detras.desvioKg > 0 && detras.fraccionPeso < detras.fraccionPrevista);
  assert.ok(+detras.llegadaMeta > +detras.fin, 'llegaría más tarde de lo previsto');
  assert.equal(deficit(75.5).estado, 'porDelante');
  assert.equal(deficit(81).estado, 'contrario');
  assert.equal(deficit(81).fraccionPeso, 0);
  assert.equal(deficit(74.8).estado, 'metaAlcanzada');
});

test('con fin fijo (plan) se calcula el peso al terminar la etapa', () => {
  const fin = mas(inicio, 70);
  const p = deficit(79.5, { finFijo: fin });
  assert.equal(+p.fin, +fin);
  cerca(p.fraccionTiempo, 42 / 70);
  assert.equal(p.llegadaMeta, null);
  cerca(p.pesoAlFinKg, tras(79.5, -0.75, 28));
});

test('mantenimiento: en tu rango o fuera, sin barra de peso', () => {
  const mant = kg => PF.calcular({ tipo: 'MAINTENANCE', inicio, hoy: mas(inicio, 28), pesoInicioKg: 80, pesoHoyKg: kg,
    tramos: [{ desde: inicio, tasaPctSemana: 0 }], pesoMetaKg: 80 });
  assert.equal(mant(80.1).estado, 'enLinea');
  assert.equal(mant(82).estado, 'fueraDeRango');
  assert.equal(mant(82).direccion, 0);
  assert.equal(mant(82).fraccionPeso, null);
});

test('tramos del historial de la pauta y compromiso de la copia o reconstruido', () => {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const pesajes = Array.from({ length: 50 }, (_, i) => ({ fecha: iso(mas(inicio, i)), pesoKg: 80 - i * 0.05 }));
  const base = { activo: true, pesajes,
    faseActual: { id: 'f1', tipo: 'DEFICIT', inicio: iso(inicio), tasaObjetivoPctSemana: -0.5, pesoObjetivoKg: 75, estado: 'ACTIVE', semanasPreviasEnTipo: 4 },
    versionesPauta: [
      { numero: 1, faseId: 'f1', desde: iso(mas(inicio, -2)), tasaObjetivoPctSemana: -0.75 },
      { numero: 2, faseId: 'f1', desde: iso(mas(inicio, 10)), tasaObjetivoPctSemana: -0.75 },
      { numero: 3, faseId: 'f1', desde: iso(mas(inicio, 21)), tasaObjetivoPctSemana: -0.5 },
      { numero: 4, faseId: 'otra', desde: iso(mas(inicio, 30)), tasaObjetivoPctSemana: 0.25 },
    ] };
  const nut = normalizarNutricion({ nutricion: base });
  const tramos = PF.tramos(nut, nut.fase);
  assert.deepEqual(tramos.map(t => [iso(t.desde), t.tasaPctSemana]), [[iso(inicio), -0.75], [iso(mas(inicio, 21)), -0.5]]);
  // Sin compromiso guardado: se reconstruye con el primer ritmo.
  const ctx = Nutricion.contexto(nut, { hoy: mas(inicio, 49) });
  assert.ok(ctx.progreso, 'hay lectura');
  assert.equal(ctx.progreso.compromiso.reconstruido, true);
  assert.equal(ctx.progreso.compromiso.tasaPctSemana, -0.75);
  assert.equal(ctx.progreso.pesoMetaKg, 75);
  // Con compromiso guardado manda el de la copia (meta inicial distinta de la actual).
  const conC = normalizarNutricion({ nutricion: { ...base, faseActual: { ...base.faseActual,
    compromiso: { tasaPctSemana: -0.75, pesoInicioKg: 80, pesoMetaKg: 76, fin: iso(mas(inicio, 60)) } } } });
  const c = Nutricion.contexto(conC, { hoy: mas(inicio, 49) }).progreso;
  assert.equal(c.compromiso.reconstruido, false);
  assert.equal(c.compromiso.pesoMetaKg, 76);
  assert.equal(c.pesoInicioKg, 80);
  // Sin fase o fase cerrada: nada.
  assert.equal(Nutricion.contexto(normalizarNutricion({ nutricion: { ...base, faseActual: null } }), { hoy: mas(inicio, 49) }).progreso, null);
});

test('vistas: Mi resumen y Evolución física enseñan el progreso de la fase de la copia de ejemplo', async () => {
  const fs = await import('node:fs');
  const { cargar } = await import('./comun.mjs');
  cargarCoach('motor.js', 'charts.js', 'catalogo.js');
  const { Analisis, VistasEsc, ImportarJSON } = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'comparacion.js', 'vistas.js', 'fisica-vista.js');
  const raw = JSON.parse(fs.readFileSync(new URL('../ejemplo/copia_truelift_2026-10-16.json', import.meta.url), 'utf8'));
  const resumen = ImportarJSON.resumen(raw);
  const M = Analisis.preparar(raw, resumen);
  assert.ok(M.datos.nut.progreso, 'la fase de la copia tiene lectura');
  const ctx = { inst: { resumen, importadoEn: '2026-10-09T10:00:00Z' }, galeriaHtml: () => '' };
  for (const html of [VistasEsc.resumen(M, ctx), VistasEsc.fisica(M, ctx)]){
    assert.match(html, /Progreso de la fase/);
    assert.match(html, /class="fase-barra"/);
  }
});
