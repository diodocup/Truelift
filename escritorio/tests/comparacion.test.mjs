import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaFase3, copiaRica, diaFase3, sesion } from './comun.mjs';
cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const { Analisis, Comparacion, VistasEsc } = cargar('analisis.js', 'comparacion.js', 'vistas.js');
const model = raw => Analisis.preparar(raw, { ultimoRegistro: '2026-10-09' });
const periodos = { a: { desde: diaFase3(1, 0), hasta: diaFase3(3, 6) }, b: { desde: diaFase3(5, 0), hasta: diaFase3(8, 6) } };
const comparar = (raw = copiaFase3(), p = periodos) => Comparacion.comparar(model(raw), p);

test('periodos desiguales: duración inclusiva, medias solo de semanas completas, cero real en huecos', () => {
  const C = comparar();
  assert.equal(C.a.dias, 21); assert.equal(C.b.dias, 28);
  assert.equal(C.b.completas.length, 4);
  assert.equal(C.b.frecuencia, 11 / 4);
  assert.ok(C.avisos.some(x => /duran distinto/.test(x)));
  const raw = copiaFase3(); raw.logs = raw.logs.filter(l => !l.fecha.startsWith(diaFase3(6, 0).slice(0, 10)) && !(l.fecha >= diaFase3(6, 0) && l.fecha < diaFase3(7, 0)));
  const B = comparar(raw).b;
  assert.equal(B.completas.length, 4); assert.equal(B.completas[1].sesiones, 0);
  assert.equal(B.frecuencia, 8 / 4);
});

test('semanas parciales: no se proyectan series o frecuencia ni se aplican días previstos', () => {
  const p = { a: { desde: diaFase3(5, 0), hasta: diaFase3(5, 3) }, b: periodos.b };
  const C = comparar(copiaFase3(), p);
  assert.equal(C.a.completas.length, 0); assert.equal(C.a.frecuencia, null);
  assert.equal(C.a.volumen.size, 0); assert.equal(C.a.parciales[0].previstas, null);
  assert.ok(C.a.parciales[0].volumen.size > 0);
  assert.ok(C.avisos.some(x => /Faltan semanas/.test(x)));
});

test('solapamiento, cobertura insuficiente e intervalo invertido informan; fechas imposibles se rechazan', () => {
  const C = comparar(copiaFase3(), { a: periodos.a, b: periodos.a });
  assert.ok(C.avisos.some(x => /solapan/.test(x)));
  assert.throws(() => comparar(copiaFase3(), { a: { desde: '2026-02-30', hasta: '2026-03-05' }, b: periodos.b }), /fechas válidas/);
  assert.throws(() => comparar(copiaFase3(), { a: { desde: '2026-10-01', hasta: '2026-09-01' }, b: periodos.b }), /inicio/);
  assert.throws(() => comparar(copiaFase3(), { a: { desde: '1900-01-01', hasta: '2026-09-01' }, b: periodos.b }), /diez años/);
  const vacio = comparar({ logs: [] });
  assert.equal(vacio.a.frecuencia, null); assert.equal(vacio.contextoA.peso.mediana, null);
  assert.ok(vacio.avisos.some(x => /no contiene/.test(x)));
});

test('fechas locales: semanas estables con cambios de hora y defecto sin incluir la semana en curso', () => {
  assert.equal(Comparacion.dias(new Date(2026, 2, 23), new Date(2026, 2, 29)), 6);
  const d = Comparacion.defecto(model(copiaFase3()));
  assert.equal(d.b.hasta, '2026-10-04');
  assert.equal(Comparacion.rango(d.a).dias, 28);
  assert.equal(Comparacion.rango(d.b).dias, 28);
});

test('ejercicios comunes: separa modalidades, muestra excluidos y no mezcla ejercicios exclusivos', () => {
  const rawModal = copiaFase3();
  rawModal.logs.filter(l => l.fecha >= periodos.a.desde && l.fecha <= periodos.a.hasta).forEach(l => l.entradas.push({ ejercicio: 'Curl de bíceps con barra', kg: 25, reps: [12, 12], rir: [1, 1] }, { ejercicio: 'Sentadilla con barra', kg: 100, reps: [8, 8], rir: [2, 2] }));
  const C = comparar(rawModal);
  const curls = C.ejercicios.comunes.filter(e => e.nombre === 'Curl de bíceps con barra');
  assert.ok(curls.some(e => e.config === 'normal'));
  assert.ok(curls.some(e => e.config === 'drop'));
  assert.ok(curls.every(e => e.deltaPct == null), 'modalidades sin dos sesiones en ambos periodos');
  const sent = C.ejercicios.comunes.find(e => e.nombre === 'Sentadilla con barra');
  assert.ok(sent.a.n >= 2 && sent.b.n >= 2 && sent.deltaPct > 0);
  assert.equal(sent.deltaPct, (sent.b.mediana / sent.a.mediana - 1) * 100);
  const raw = copiaFase3(); raw.logs.filter(l => l.fecha >= periodos.b.desde).forEach(l => { l.entradas = l.entradas.filter(e => e.ejercicio !== 'Remo en polea baja'); });
  assert.ok(!comparar(raw).ejercicios.comunes.some(e => e.nombre === 'Remo en polea baja'));
});

test('descargas, molestias, sustituciones, día no verde y puntos sin base se excluyen de estimaciones', () => {
  const raw = copiaFase3();
  const press = raw.logs.filter(l => l.fecha >= periodos.b.desde && l.fecha <= periodos.b.hasta && l.entradas.some(e => e.ejercicio === 'Press banca con barra'));
  press[0].descarga = true; press[1].entradas[0].molestias = true;
  press[2].entradas[0].sustitucion = true; press[3].entradas[0].estadoEjercicio = 'rojo';
  const C = comparar(raw), e = C.ejercicios.comunes.find(e => e.nombre === 'Press banca con barra');
  assert.deepEqual(e.b.excluidos, { descarga: 1, molestias: 1, cambioDia: 1, noVerde: 1 });
  assert.equal(e.deltaPct, null);
});

test('peso corporal: no presenta como progreso una estimación con el peso actual del perfil', () => {
  const raw = copiaRica();
  const p = { a: { desde: '2026-06-01', hasta: '2026-06-25' }, b: { desde: '2026-06-26', hasta: '2026-07-02' } };
  raw.logs.find(l => l.fecha.startsWith('2026-07-01')).entradas.push({ ejercicio: 'Dominada asistida en máquina', kg: -20, reps: [10, 10], rir: [2, 2] });
  const C = comparar(raw, p);
  assert.ok(C.ejercicios.comunes.some(e => e.pesoCorporal));
  assert.ok(C.ejercicios.comunes.filter(e => e.pesoCorporal).every(e => e.deltaPct === null));
});

test('rendimiento: identidad histórica explícita, rutina y día separados, no inventa números de palabras', () => {
  const raw = copiaFase3();
  raw.logs.forEach(l => { l.rawSessionPct = 0; l.netDailyPerformancePct = 0; });
  const C = comparar(raw);
  assert.ok(C.rendimiento.length >= 2);
  const comunes = C.rendimiento.filter(g => g.a.length && g.b.length);
  assert.equal(comunes.length, 0, 'rutinas distintas no se agrupan');
  raw.logs.forEach(l => { delete l.rutinaRevision; });
  assert.equal(comparar(raw).rendimiento.length, 0);
  const nums = copiaFase3(); nums.logs.forEach(l => { delete l.rawSessionPct; delete l.rendimientoPct; });
  assert.ok(comparar(nums).rendimiento.every(g => g.brutoA.n === 0 && g.brutoB.n === 0));
});

test('series: mismo Motor por grupo, sesiones dobles no inflan días y sin grupo no se inventa', () => {
  const raw = copiaFase3(), base = comparar(raw).b;
  raw.logs.push({ ...structuredClone(raw.logs.find(l => l.fecha.startsWith(diaFase3(7, 0)))), entradas: [{ ejercicio: 'Desconocido', kg: 5, reps: [8], rir: [0] }] });
  const B = comparar(raw).b;
  assert.equal(B.diasSemana, base.diasSemana);
  assert.ok(B.frecuencia > base.frecuencia);
  assert.ok(B.sinGrupo.includes('Desconocido'));
  assert.deepEqual([...B.volumen], [...base.volumen]);
});

test('constancia: nunca usa la frecuencia actual al faltar plan histórico', () => {
  const raw = copiaFase3(); raw.dias = '7'; raw.rutinaRevision = 100;
  raw.logs.forEach(l => { delete l.variante; delete l.dias; delete l.rutinaRevision; });
  const C = comparar(raw);
  assert.equal(C.a.conocidas, 0); assert.equal(C.b.conocidas, 0);
});

test('tiempo: distingue ausente, cero y anómalo; conserva índices de los registros válidos', () => {
  const raw = copiaFase3();
  raw.logs.forEach(l => { l.duracionMin = null; });
  const xs = raw.logs.filter(l => l.fecha >= periodos.b.desde && l.fecha <= periodos.b.hasta);
  xs[0].duracionMin = 0; xs[1].duracionMin = 700; xs[1].duracionAnomala = true;
  xs[2].duracionMin = 45; xs[3].duracionMin = 65;
  const D = comparar(raw).b.duracion;
  assert.equal(D.n, 2); assert.equal(D.mediana, 55);
  assert.ok(D.puntos.every(p => Number.isInteger(p.indice)));
});

test('contexto: cero válido, días sin dato, VFC descartada y duplicados contradictorios', () => {
  const raw = copiaFase3();
  raw.readinessDiario = [{ fecha: periodos.b.desde, estadoEntrenar: 0, vfc: 55, vfcDescartada: true },
    { fecha: diaFase3(5, 1), estadoEntrenar: null, vfc: 50 },
    { fecha: diaFase3(5, 1), estadoEntrenar: null, vfc: 70 }];
  const B = comparar(raw).contextoB;
  assert.equal(B.estado.n, 1); assert.equal(B.estado.mediana, 0);
  assert.equal(B.vfc.n, 0); assert.equal(B.vfc.conflictos, 1);
});

test('peso y contornos: solo registros dentro del periodo, fechas reales, cm canónicos y conflictos', () => {
  const raw = copiaFase3();
  raw.unidadPeso = 'lb';
  raw.medidas = { registros: [{ fecha: diaFase3(4, 6), sitio: 'cintura', cm: 80 },
    { fecha: diaFase3(5, 0), sitio: 'cintura', cm: 81 }, { fecha: diaFase3(5, 0), sitio: 'cintura', cm: 82 },
    { fecha: diaFase3(6, 1), sitio: 'cintura', cm: 79 }, { fecha: diaFase3(6, 1), sitio: 'cintura', cm: 79 },
    { fecha: diaFase3(7, 0), sitio: 'cintura', cm: 0 }, { fecha: diaFase3(7, 0), sitio: 'desconocido', cm: 75 }] };
  const B = comparar(raw).contextoB;
  assert.equal(B.medidas.cintura.n, 1); assert.equal(B.medidas.cintura.mediana, 79); assert.equal(B.medidas.cintura.conflictos, 1);
  assert.equal(fmtISO(B.medidas.cintura.desde), diaFase3(6, 1));
  assert.equal(Object.keys(B.medidas).length, 1);
  assert.ok(B.peso.mediana > 70 && B.peso.mediana < 90, 'kg pese a presentación lb');
});

test('nutrición: fase actual no se aplica al pasado; plan futuro no es historial ni ajuste ingesta real', () => {
  const raw = copiaFase3(); raw.nutricion.faseActual = { id: 'f', tipo: 'SURPLUS', inicio: diaFase3(5, 0) };
  raw.nutricion.planTemporada = { bloques: [{ inicio: diaFase3(1, 0), fin: diaFase3(9, 0), tipo: 'CUT' }] };
  raw.nutricion.recomendaciones = [{ fecha: diaFase3(5, 0), faseId: 'f', ajusteKcalDia: 0, tasaRealPctSemana: 0 }];
  const C = comparar(raw);
  assert.equal(C.contextoA.fases.length, 0); assert.equal(C.contextoB.fases.length, 1);
  assert.equal(C.contextoB.recomendaciones[0].ajusteKcalDia, 0);
  const html = VistasEsc.entrenamiento(model(raw), { sub: 'comparar', periodos });
  assert.match(html, /no demuestran ingesta real/);
});

test('vista: fechas, muestras, parciales, contexto, enlaces y contenido importado escapado; sin mutación', () => {
  const raw = copiaFase3(); raw.logs[4].dia = '<script>peligro</script>';
  const antes = JSON.stringify(raw), M = model(raw);
  const html = VistasEsc.entrenamiento(M, { sub: 'comparar', periodos });
  assert.equal(JSON.stringify(raw), antes);
  for (const t of ['periodo-a-desde', 'periodo-b-hasta', 'n=', 'Semanas completas y parciales', 'Contexto nutricional', 'Recuperación registrada', 'data-ejercicio=', 'data-sesion=']) assert.ok(html.includes(t), t);
  assert.ok(!html.includes('<script>peligro</script>'));
  assert.match(html, /&lt;script&gt;peligro/);
});
