// Fase 3: Mi resumen (constancia, comparables, conclusiones) y ficha por
// ejercicio (series, marcas, comparación). Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica, copiaFase3, diaFase3 } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js');
const G = cargar('analisis.js', 'vistas.js');
const { Analisis, VistasEsc, Motor } = G;

const ref9 = { ultimoRegistro: diaFase3(9, 4) };
const preparar = (raw = copiaFase3(), r = ref9) => Analisis.preparar(raw, r);

test('motor: extremos comparables y cortes del informe mensual de la app', () => {
  assert.deepEqual(Motor.extremosComparables([100]), [null, null]);
  assert.deepEqual(Motor.extremosComparables([100, 110, 105]), [100, 105]);
  assert.deepEqual(Motor.extremosComparables([100, 102, 104, 106, 108]), [101, 107]);
  assert.equal(Motor.lecturaProgreso(1), 'sube');
  assert.equal(Motor.lecturaProgreso(0.99), 'sinCambios');
  assert.equal(Motor.lecturaProgreso(-1), 'sinCambios');
  assert.equal(Motor.lecturaProgreso(-1.01), 'baja');
});

test('constancia: lo previsto sale de la rutina de cada semana, no de la actual', () => {
  const M = preparar();
  const k = Analisis.constancia(M, { semanas: 8 });
  // Semanas 1-2 con la rutina de 4 días; 3 y 4 rodean el cambio de rutina;
  // 5-8 con la de 3 días (la 5 sin el día B). La 9 está en curso.
  assert.deepEqual(k.semanas.map(f => [f.dias, f.previstas]),
    [[4, 4], [4, 4], [4, null], [3, null], [2, 3], [3, 3], [3, 3], [3, 3]]);
  assert.equal(k.semanas[2].motivo, 'cambioRutina');
  assert.equal(k.actual.parcial, true);
  assert.equal(k.actual.previstas, null, 'la semana en curso no se valora');
  assert.equal(M.raw.dias, '3');
  assert.equal(k.hechas, 19); assert.equal(k.previstas, 20);
});

test('constancia: sin sesiones posteriores, solo vale la rutina actual si es la de la última sesión', () => {
  // Termina con una semana completa sin sesiones (último registro el domingo).
  const raw = copiaFase3({ hastaSemana: 8 });
  raw.readinessDiario.push({ fecha: diaFase3(9, 6), sueno: 3, animo: 3, estadoEntrenar: 80 });
  const r = { ultimoRegistro: diaFase3(9, 6) };
  const k1 = Analisis.constancia(preparar(raw, r));
  assert.equal(k1.actual, null, 'el último registro es domingo: no hay semana en curso');
  assert.deepEqual(k1.semanas.map(f => [f.dias, f.previstas]).slice(-1), [[0, 3]]);
  // Si después de la última sesión cambió la rutina, no se sabe cuándo.
  const k2 = Analisis.constancia(preparar({ ...raw, rutinaRevision: 3 }, r));
  assert.equal(k2.semanas[k2.semanas.length - 1].previstas, null);
  assert.equal(k2.semanas[k2.semanas.length - 1].motivo, 'cambioRutina');
});

test('comparables: exclusiones, modalidad y firmeza (no por una sola sesión)', () => {
  const M = preparar();
  const por = Object.fromEntries(Analisis.comparables(M).map(x => [x.nombre, x]));
  const press = por['Press banca con barra'];
  assert.equal(press.n, 4); assert.equal(press.lectura, 'baja'); assert.equal(press.firme, true);
  assert.ok(Math.abs(press.inicio - 80 * (1 + 10.5 / 30)) < 1e-9);
  const sent = por['Sentadilla con barra'];
  assert.equal(sent.lectura, 'sube'); assert.equal(sent.firme, true);
  // Remo: solo la última sesión floja → lectura a la baja, pero no firme.
  const remo = por['Remo con barra'];
  assert.equal(remo.lectura, 'baja'); assert.equal(remo.firme, false);
  // Curl: drop set y luego series normales → solo cuenta la normal.
  const curl = por['Curl de bíceps con barra'];
  assert.equal(curl.config, 'normal'); assert.equal(curl.excluidos.otraConfig, 3); assert.equal(curl.lectura, 'insuficiente');
});

test('comparables: descarga, molestias, cambio de un día y días no verdes no entran', () => {
  const M = Analisis.preparar(copiaRica(), { ultimoRegistro: '2026-07-02' });
  const ej = M.ejercicios.get('Press banca con barra');
  const x = Analisis.evolucionEjercicio(M, ej, new Date(2026, 5, 1), new Date(2026, 6, 2));
  assert.deepEqual(x.excluidos, { noVerde: 1, descarga: 1 });
  assert.equal(x.cambioRutina, true, 'la sesión del 1-jun es de la rutina anterior');
  const sent = Analisis.evolucionEjercicio(M, M.ejercicios.get('Sentadilla con barra'), new Date(2026, 5, 1), new Date(2026, 6, 2));
  assert.equal(sent.excluidos.molestias, 1);
});

test('conclusiones: prioridad, máximo útil y trazabilidad hasta los registros', () => {
  const M = preparar();
  const todas = Analisis.conclusiones(M);
  assert.deepEqual(todas.slice(0, 3).map(c => c.id), ['intentos', 'recuperacion', 'constancia']);
  // El press ya sale por intentos agotados: no se repite como «a la baja».
  assert.ok(!todas.some(c => c.id === 'ejercicios-baja'));
  assert.match(todas[0].texto, /también baja/);
  for (const c of todas){
    assert.ok(c.titulo && c.texto, c.id);
    assert.ok(c.periodo.desde instanceof Date && c.periodo.hasta instanceof Date && +c.periodo.desde <= +c.periodo.hasta, c.id);
    assert.ok(c.datos.filas.length > 0, `${c.id}: sin datos`);
    assert.ok(c.limitaciones.length > 0, `${c.id}: sin limitaciones`);
    assert.ok(c.enlace && c.enlace.destino, c.id);
    // Cada fila con sesión apunta a una sesión real que contiene lo que se dice.
    for (const f of c.datos.filas.filter(f => f.indice != null)){
      const s = M.sesiones.find(x => x.indice === f.indice);
      assert.ok(s, `${c.id}: sesión ${f.indice} inexistente`);
      assert.equal(+soloDiaDe(s.fecha), +soloDiaDe(f.fecha));
    }
    const m = c.enlace.destino.match(/^entrenamiento:ejercicios:(.+)$/);
    if (m) assert.ok(M.ejercicios.has(decodeURIComponent(m[1])), `${c.id}: enlace a un ejercicio inexistente`);
  }
  const intentos = todas[0];
  assert.equal(intentos.datos.filas.length, 5, 'las cinco sesiones del contador');
  assert.ok(intentos.datos.filas.every(f => f.celdas[0] === 'Press banca con barra'));
});
const soloDiaDe = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

test('conclusiones: una sola sesión floja no genera conclusión; la descarga no se valora', () => {
  const raw = copiaFase3();
  // Sin el press: el remo (solo la última floja) no debe aparecer.
  raw.logs.forEach(l => { l.entradas = l.entradas.filter(e => e.ejercicio !== 'Press banca con barra'); });
  const c = Analisis.conclusiones(preparar(raw));
  assert.ok(!c.some(x => /Remo/.test(x.titulo)));
  assert.ok(!c.some(x => x.id === 'ejercicios-baja'));
  const enDescarga = Analisis.conclusiones(preparar({ ...copiaFase3(), modoDescarga: true }));
  assert.ok(!enDescarga.some(x => x.id === 'valoracion'));
  assert.ok(enDescarga.find(x => x.id === 'intentos').limitaciones.some(l => /descarga/.test(l)));
});

test('recuperación: cambio de lectura frente al periodo anterior', () => {
  const rc = Analisis.cambiosRecuperacion(preparar());
  assert.equal(rc.ahora.lectura, 'cargada'); assert.equal(rc.antes.lectura, 'buena');
});

test('peso: cambio de tendencia solo con pesajes suficientes y sin extrapolar', () => {
  const P = Analisis.peso(preparar());
  assert.ok(P.cambioKg < 0 && P.previo && P.actual);
  assert.ok(+P.actual.fecha <= +new Date(2026, 9, 9));
  const raw = copiaFase3(); raw.nutricion.pesajes = raw.nutricion.pesajes.slice(-1);
  assert.equal(Analisis.peso(preparar(raw)).cambioKg, null);
  const sin = copiaFase3(); delete sin.nutricion;
  assert.equal(Analisis.peso(preparar(sin)), null);
});

test('ficha: series por serie, marcas válidas y comparación con avisos', () => {
  const M = Analisis.preparar(copiaRica(), { ultimoRegistro: '2026-07-02' });
  // Drop set: la carga de cada serie y su papel.
  const ext = M.ejercicios.get('Extensión de cuádriceps');
  assert.deepEqual(Analisis.seriesDe(ext.puntos[0].e).map(x => [x.kg, x.reps, x.papel]), [[40, 12, 'top'], [30, 10, 'drop'], [20, 8, 'drop']]);
  // Asistencia en positivo.
  const dom = M.ejercicios.get('Dominada asistida en máquina');
  assert.equal(Analisis.seriesDe(dom.puntos[0].e)[0].kg, 30);
  assert.match(Analisis.serieTxt(dom.puntos[0].e, dom.puntos[0].marcaSerie ?? Motor.mejorSerie(dom.puntos[0].e, 80)), /^asistencia 30 kg × 10 @2$/);
  // Marcas: la última coincide con la del móvil; la primera fija la referencia.
  const press = M.ejercicios.get('Press banca con barra');
  const marcas = Analisis.marcas(press);
  assert.equal(marcas[0].anterior, null);
  assert.equal(marcas[marcas.length - 1].valor, Motor.mejorMarca(copiaRica().logs, 'Press banca con barra', 80));
  assert.ok(marcas.every(m => !m.p.noVerde && !m.p.e.molestias));
  // Comparación: misma modalidad sin avisos; con descarga, aviso.
  const [p1, p2, , , p5] = press.puntos;
  const c1 = Analisis.compararSesiones(M, press, p2.sesion.indice, press.puntos[2].sesion.indice);
  assert.equal(c1.compatible, true); assert.ok(c1.deltaE1rm > 0);
  const c2 = Analisis.compararSesiones(M, press, p5.sesion.indice, p1.sesion.indice);
  assert.ok(+c2.a.fecha < +c2.b.fecha, 'se ordenan por fecha');
  assert.ok(c2.avisos.some(a => /rutinas distintas/.test(a)));
  assert.ok(c2.avisos.some(a => /descarga/.test(a)));
  // Modalidad distinta: sin diferencia de 1RM.
  const curl = M.ejercicios.get('Curl de bíceps con barra');
  const raw2 = copiaRica();
  raw2.logs[5].entradas[2].restPause = false;
  const M2 = Analisis.preparar(raw2, { ultimoRegistro: '2026-07-02' });
  const c3 = Analisis.compararSesiones(M2, M2.ejercicios.get('Curl de bíceps con barra'), curl.puntos[0].sesion.indice, curl.puntos[2].sesion.indice);
  assert.equal(c3.compatible, false); assert.equal(c3.deltaE1rm, null);
  assert.ok(c3.avisos.some(a => /Modalidad distinta/.test(a)));
});

test('ficha: el estado enseña las sesiones que cuentan como intentos', () => {
  const M = preparar();
  const st = M.ejercicios.get('Press banca con barra').estados[0];
  assert.equal(st.tipo, 'intentosAgotados');
  assert.equal(st.consumidos, 5);
  assert.ok(st.op.slice(0, 5).every(o => !o.completo));
  assert.equal(st.op[5].completo, true, 'la anterior a la racha cumplió el objetivo');
});

test('vistas de la fase 3: escapan, sin undefined y sin umbrales en las ayudas', () => {
  const raw = copiaFase3();
  raw.logs[raw.logs.length - 1].entradas[0].ejercicio = 'Remo <img src=x onerror=alert(1)>';
  const M = preparar(raw);
  const ctx = { inst: { resumen: ref9, importadoEn: '2026-10-10T10:00:00Z' }, galeriaHtml: () => '' };
  const html = [VistasEsc.resumen(M, ctx),
    ...[...M.ejercicios.keys()].map(n => VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: n })),
    VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: 'Press banca con barra', compA: M.sesiones[0].indice, compB: M.sesiones[M.sesiones.length - 1].indice })].join('\n');
  assert.ok(!html.includes('<img src=x'), 'el nombre importado no se interpreta como HTML');
  assert.ok(!/undefined|NaN/.test(html.replace(/data-tt="[^"]*"/g, '')), 'sin undefined ni NaN');
  assert.ok(!/cliente|entrenador|cartera/i.test(html));
  const res = VistasEsc.resumen(M, ctx);
  assert.equal((res.match(/<article class="conclusion/g) || []).length, 3);
  assert.ok(res.includes('Datos que la respaldan') && res.includes('Limitaciones'));
  assert.ok(res.includes(`data-ir="entrenamiento:ejercicios:Press%20banca%20con%20barra"`));
  // Textos de ayuda: explican qué y para qué, sin cifras del algoritmo.
  const ayudas = [...html.matchAll(/<details class="detalle ayuda">([\s\S]*?)<\/details>/g)].map(m => m[1]);
  assert.ok(ayudas.length >= 3);
  // («1RM» es el nombre de la métrica, no una cifra del algoritmo.)
  for (const a of ayudas) assert.doesNotMatch(a.replace(/1RM/g, ''), /\d/, `ayuda con cifras: ${a.slice(0, 80)}`);
  const ficha = VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: 'Sentadilla con barra' });
  for (const t of ['Por qué este estado', 'Tus últimas semanas', 'Mejores marcas', 'Comparar dos sesiones', 'Series (kg × reps @RIR)']) assert.ok(ficha.includes(t), t);
});

test('copia mínima y antigua: el resumen y la ficha no fallan', () => {
  const ctx = r => ({ inst: { resumen: r, importadoEn: '2026-07-03T10:00:00Z' }, galeriaHtml: () => '' });
  const M0 = Analisis.preparar({ sexo: 'mujer', sistema: 'simple', dias: '3' }, { ultimoRegistro: null });
  assert.deepEqual(Analisis.conclusiones(M0), []);
  const viejo = { sexo: 'hombre', sistema: 'doble', dias: '3', logs: [
    { fecha: '2026-01-01T10:00:00', dia: 'A', variante: 'hombre_doble', dias: '3', rendimientoPct: 103, entradas: [{ ejercicio: 'Press banca', kg: 60, reps: [8, 8], rir: [2, 2] }] }] };
  const r1 = { ultimoRegistro: '2026-01-01' };
  const M1 = Analisis.preparar(viejo, r1);
  const h = VistasEsc.resumen(M1, ctx(r1)) + VistasEsc.entrenamiento(M1, { sub: 'ejercicios', ejercicio: 'Press banca' });
  assert.ok(!/undefined|NaN/.test(h.replace(/data-tt="[^"]*"/g, '')));
  assert.ok(h.includes('Hace falta al menos otra sesión'));
});
