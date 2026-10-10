// Fase 7: informe de un mes o de unas fechas. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica, copiaFase3, diaFase3 } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const G = cargar('importar.js', 'fotos.js', 'evolucion.js', 'analisis.js', 'comparacion.js', 'vistas.js', 'informe.js', 'informe-vista.js');
const { Analisis, Informe, InformeVista, Evolucion } = G;

const M3 = (raw = copiaFase3()) => Analisis.preparar(raw, { ultimoRegistro: diaFase3(9, 4) });   // 9 oct 2026
const MR = (raw = copiaRica()) => Analisis.preparar(raw, { ultimoRegistro: '2026-07-02' });
const sept = { tipo: 'mes', mes: '2026-09' };

test('selección: meses con datos, el último mes completo por defecto y validación', () => {
  const M = M3();
  assert.deepEqual(Informe.meses(M).map(m => [m.valor, m.completo]), [['2026-10', false], ['2026-09', true], ['2026-08', true]]);
  assert.deepEqual(Informe.defecto(M), sept);
  // Un mes que acaba antes del último registro cuenta como completo aunque
  // los datos empiecen a mitad; si ninguno acaba antes, el del último registro.
  const corta = copiaRica(); corta.logs = corta.logs.filter(l => l.fecha >= '2026-06-08');
  corta.medidas.registros = []; corta.readinessDiario = []; corta.nutricion.pesajes = [];
  assert.deepEqual(Informe.defecto(MR(corta)), { tipo: 'mes', mes: '2026-06' });
  corta.logs = corta.logs.filter(l => l.fecha >= '2026-07-01');
  assert.deepEqual(Informe.defecto(MR(corta)), { tipo: 'mes', mes: '2026-07' });
  assert.deepEqual(Informe.meses(MR(corta)).map(m => m.completo), [false]);
  const r = Informe.rango(sept);
  assert.equal(r.dias, 30); assert.equal(r.titulo, 'septiembre de 2026');
  assert.equal(Informe.rango({ tipo: 'mes', mes: '2024-02' }).dias, 29);
  assert.throws(() => Informe.rango({ tipo: 'mes', mes: '2026-13' }), /mes de la lista/);
  assert.throws(() => Informe.rango({ tipo: 'fechas', desde: '2026-09-10', hasta: '2026-09-01' }), /anterior o igual/);
  assert.throws(() => Informe.rango({ tipo: 'fechas', desde: '2026-02-30', hasta: '2026-03-01' }), /válidas/);
  assert.throws(() => Informe.rango({ tipo: 'fechas', desde: '2010-01-01', hasta: '2026-01-01' }), /diez años/);
  // Periodo anterior: el mes natural previo o la misma duración justo antes.
  const a = Informe.anterior(r);
  assert.deepEqual([fmtISO(a.desde), fmtISO(a.hasta)], ['2026-08-01', '2026-08-31']);
  const f = Informe.anterior(Informe.rango({ tipo: 'fechas', desde: '2026-09-10', hasta: '2026-09-19' }));
  assert.deepEqual([fmtISO(f.desde), fmtISO(f.hasta)], ['2026-08-31', '2026-09-09']);
});

test('mes completo: constancia con la rutina de cada semana y semanas parciales separadas', () => {
  const R = Informe.generar(M3(), sept);
  const k = R.constancia;
  assert.equal(k.sesiones, 12); assert.equal(k.completas, 3); assert.equal(k.parciales, 2);
  assert.equal(k.conocidas, 3); assert.equal(k.hechasConPlan, 8); assert.equal(k.previstas, 9);
  assert.equal(k.pordebajo.length, 1, 'la semana sin el día B');
  assert.ok(k.semanas.filter(s => !s.completa).every(s => s.previstas == null), 'las parciales no se comparan con lo previsto');
  assert.ok(R.revisar.some(x => /menos días de entrenamiento que los previstos/.test(x.texto)));
});

test('progresión: solo lecturas firmes pasan a cambios y a revisar; las demás son orientativas', () => {
  const R = Informe.generar(M3(), sept);
  const lec = Object.fromEntries(R.progresion.ejercicios.map(x => [x.nombre, [x.lectura, x.firme]]));
  assert.deepEqual(lec['Press banca con barra'], ['baja', true]);
  assert.deepEqual(lec['Sentadilla con barra'], ['sube', true]);
  // Remo: solo la última sesión floja (fuera de septiembre); curl en drop set.
  assert.equal(lec['Remo con barra'][1], false);
  assert.equal(R.progresion.ejercicios.find(x => x.nombre === 'Curl de bíceps con barra').config, 'drop');
  assert.ok(R.cambios.some(c => c.tipo === 'e1rm-baja' && c.ejercicio === 'Press banca con barra'));
  assert.ok(!R.cambios.some(c => c.ejercicio === 'Remo con barra'), 'una lectura orientativa no es un cambio relevante');
  // Las tres marcas de sentadilla se agrupan en una sola línea.
  const marcas = R.cambios.filter(c => c.tipo === 'marca');
  assert.equal(R.progresion.marcas.length, 3); assert.equal(marcas.length, 1);
  assert.match(marcas[0].texto, /^3 nuevas mejores marcas estimadas en Sentadilla con barra/);
  assert.ok(R.revisar.some(x => x.texto.includes('Press banca con barra') && x.destino.endsWith(encodeURIComponent('Press banca con barra'))));
  assert.ok(R.limitaciones.some(l => /orientativa/.test(l) && l.includes('Remo con barra')));
});

test('estado actual (intentos, recuperación) solo si el periodo incluye el último registro', () => {
  const M = M3();
  const conRef = Informe.generar(M, { tipo: 'fechas', desde: diaFase3(6, 0), hasta: diaFase3(9, 4) });
  assert.ok(conRef.revisar.some(x => /A fecha de tu último registro.*intentos agotados.*Press banca con barra/.test(x.texto)));
  assert.ok(conRef.revisar.some(x => /estado para entrenar bajo/.test(x.texto)));
  const sinRef = Informe.generar(M, sept);
  assert.ok(!sinRef.revisar.some(x => /último registro|estado para entrenar bajo/.test(x.texto)));
});

test('cobertura: periodos fuera de los datos se declaran y no inventan cifras', () => {
  const M = M3();
  const oct = Informe.generar(M, { tipo: 'mes', mes: '2026-10' });
  assert.ok(oct.limitaciones.some(l => /llegan hasta el 9 de octubre de 2026/.test(l)));
  // 1–4 oct es parcial y 5–11 oct pasa del último registro: ninguna completa.
  assert.equal(oct.constancia.completas, 0);
  assert.ok(oct.constancia.sesiones > 0);
});

test('periodo sin semanas completas: sin medias semanales ni días previstos', () => {
  const R = Informe.generar(M3(), { tipo: 'fechas', desde: diaFase3(6, 1), hasta: diaFase3(6, 4) });
  assert.equal(R.constancia.completas, 0);
  assert.equal(R.constancia.frecuencia, null);
  assert.ok(R.volumen.grupos.every(g => g.media == null && g.parcial >= 0));
  assert.ok(R.limitaciones.some(l => /ninguna semana completa/.test(l)));
  const antes = Informe.generar(M3(), { tipo: 'mes', mes: '2025-01' });
  assert.equal(antes.hayDatos, false);
  assert.ok(antes.limitaciones[0].includes('anterior a tu primer registro'));
  const html = InformeVista.documento(M3(), antes, {});
  assert.match(html, /Sin datos en este periodo/);
});

test('contexto de entrenamiento: descarga, molestias, cambios de un día, no realizados y cambio de rutina', () => {
  const R = Informe.generar(MR(), { tipo: 'fechas', desde: '2026-06-01', hasta: '2026-07-02' });
  const tipos = R.cambios.map(c => c.tipo);
  for (const t of ['rutina', 'descarga', 'molestias', 'sustitucion', 'noHecho']) assert.ok(tipos.includes(t), t);
  assert.equal(R.constancia.descarga, 1);
  assert.equal(R.constancia.cardio, 1); assert.equal(R.constancia.minCardio, 30);
  assert.ok(R.revisar.some(x => /molestias en Sentadilla con barra/.test(x.texto)));
  // La descarga no tiene valoración ni cuenta como sesión sin valorar.
  assert.equal(Object.values(R.progresion.veredictos).reduce((a, b) => a + b, 0) + R.progresion.sinVeredicto, 8);
  // La dominada asistida es de peso corporal: se avisa de la estimación.
  assert.ok(R.limitaciones.some(l => /peso de perfil actual/.test(l)));
  // Cero series de un ejercicio no realizado: no aparece como ejercicio entrenado.
  assert.ok(!R.progresion.ejercicios.some(x => x.nombre === 'Prensa'));
});

test('evolución física: contornos solo dentro del periodo, sin arrastre ni valores contradictorios', () => {
  const raw = copiaRica();
  raw.medidas.registros.push({ fecha: '2026-06-15', sitio: 'cintura', cm: 83.8 }, { fecha: '2026-06-20', sitio: 'cadera', cm: 98 }, { fecha: '2026-06-20', sitio: 'cadera', cm: 99 });
  const M = MR(raw);
  const modelo = Evolucion.preparar(raw);
  const junio = Informe.generar(M, { tipo: 'fechas', desde: '2026-06-02', hasta: '2026-06-30' }, { fisica: modelo });
  // 1-jun y 1-jul quedan fuera: solo la medida del 15 de junio, sin cambio.
  assert.deepEqual(junio.fisica.contornos.map(c => [c.sitio, c.n, c.cambioCm]), [['cintura', 1, null]]);
  assert.equal(junio.fisica.conflictos, 1);
  assert.ok(junio.revisar.some(x => /contradictorios/.test(x.texto)));
  const todo = Informe.generar(M, { tipo: 'fechas', desde: '2026-06-01', hasta: '2026-07-02' }, { fisica: modelo });
  const cin = todo.fisica.contornos.find(c => c.sitio === 'cintura');
  assert.equal(cin.inicio.fecha, '2026-06-01'); assert.equal(cin.fin.fecha, '2026-07-01');
  assert.ok(Math.abs(cin.cambioCm - (-0.8)) < 1e-9);
  // Peso: pesajes del periodo y peso tendencia en su primer y último día pesado.
  const t = todo.fisica.tendencia;
  assert.equal(todo.fisica.peso.n, 4);
  assert.equal(fmtISO(t.inicio.fecha), '2026-06-20'); assert.equal(fmtISO(t.fin.fecha), '2026-07-02');
  assert.equal(t.semanas.reduce((n, w) => n + w.n, 0), 4);
  assert.equal(Informe.generar(M, { tipo: 'fechas', desde: '2026-06-01', hasta: '2026-06-10' }).fisica.tendencia, null, 'sin pesajes no se extrapola');
});

test('fotos: fuera por defecto; solo las elegidas, del periodo y con imagen', () => {
  const galeria = [
    { archivo: 'a.jpg', fecha: '2026-09-03', pose: 'frente', tieneImagen: true, pesoKg: 81 },
    { archivo: 'b.jpg', fecha: '2026-09-03', pose: 'perfil', tieneImagen: false },
    { archivo: 'c.jpg', fecha: '2026-08-20', pose: 'frente', tieneImagen: true },
  ];
  const M = M3();
  const R = Informe.generar(M, sept, { galeria });
  assert.deepEqual(R.fisica.fotos, { total: 2, conImagen: 1, sinImagen: 1, poses: ['frente', 'perfil'] });
  assert.deepEqual(Informe.fotosElegibles(galeria, R.periodo).map(f => f.archivo), ['a.jpg']);
  const sin = InformeVista.documento(M, R, {});
  assert.doesNotMatch(sin, /data-inf-foto/);
  assert.match(sin, /No se incluyen en el informe salvo que las elijas/);
  const con = InformeVista.documento(M, R, { fotos: [galeria[0]] });
  assert.equal((con.match(/data-inf-foto=/g) || []).length, 1);
  // La sección completa no marca ninguna foto si no se ha elegido.
  const sec = InformeVista.seccion(M, { sel: sept, galeria, st: { conFotos: true, fotos: new Set() } });
  assert.doesNotMatch(sec, /data-inf-foto=/);
  assert.match(sec, /data-inf-elegir="a.jpg"/);
  assert.doesNotMatch(sec, /data-inf-elegir="c.jpg"|data-inf-elegir="b.jpg"/);
});

test('documento: secciones pedidas, nombres escapados y notas sin cifras del algoritmo', () => {
  const raw = copiaFase3();
  raw.logs.forEach(l => l.entradas.forEach(e => { if (e.ejercicio === 'Remo con barra') e.ejercicio = 'Remo <img src=x onerror=alert(1)>'; }));
  const M = M3(raw);
  const R = Informe.generar(M, sept);
  const html = InformeVista.documento(M, R, { inst: { importadoEn: '2026-10-10T10:00:00Z' } });
  for (const t of ['Resumen del periodo', 'Constancia', 'Progresión verificable', 'Evolución física', 'Volumen realizado',
    'Recuperación', 'Cambios relevantes', 'Aspectos que revisar', 'Datos insuficientes y limitaciones']) assert.ok(html.includes(`>${t}</h3>`), t);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /Remo &lt;img src=x/);
  assert.doesNotMatch(html, /<details/, 'en papel no puede haber desplegables cerrados');
  const notas = [...html.matchAll(/<p class="muted inf-nota">([\s\S]*?)<\/p>/g)].map(m => m[1]);
  assert.ok(notas.length >= 5);
  for (const n of notas) assert.doesNotMatch(n.replace(/1RM/g, ''), /\d/, `nota con cifras: ${n.slice(0, 80)}`);
  // Todas las tablas tienen leyenda accesible y cabeceras.
  const tablas = html.match(/<table/g).length;
  assert.equal((html.match(/<caption class="sr-only">/g) || []).length, tablas);
  // Gráfica con unidades y alternativa en tabla.
  assert.match(html, /role="img" aria-label="Pesajes y peso tendencia del periodo, en kg"/);
  assert.match(html, /caption class="sr-only">Pesajes del periodo/);
});

test('el informe no muta la copia original', () => {
  const raw = copiaRica();
  const antes = JSON.stringify(raw);
  const M = MR(raw);
  Informe.generar(M, { tipo: 'fechas', desde: '2026-06-01', hasta: '2026-07-02' });
  assert.equal(JSON.stringify(raw), antes);
});
