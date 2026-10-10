// Fase 6 — planificador personal: rutina del móvil, borradores, simulación
// del importador de la app, comparación, avisos y exportación Excel.
// Datos sintéticos. Si hay SDK de Dart y App-PRO al lado, los Excel
// exportados se leen además con el lector REAL de la app (arnes-excel/).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'catalogo.js', 'canonico.js', 'plantilla.js', 'xlsx.js', 'planner.js');
const { Planificador: PL, Analisis, XLSX, Planner } = cargar('analisis.js', 'planificador.js');
const plain = x => JSON.parse(JSON.stringify(x));
const M = raw => Analisis.preparar(raw, { ultimoRegistro: '2026-07-02' });

/* Rutina de 3 días con todas las modalidades y un ejercicio propio. */
function copiaPlan(){
  const raw = copiaRica();
  raw.dias = '3'; raw.planModKey = 'hombre_doble|3';
  raw.ejerciciosUsuario = [{ nombre: 'Plancha lastrada', grupo: 'Core', patron: 'Core', secundarios: ['Hombro'], prioridad: 'Añadido por ti', nota: 'Con disco', porTiempo: true }];
  raw.planMod = [
    { id: 'a', dia: 'Torso', orden: 1, patron: 'Empuje horizontal', grupo: 'Pectoral', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2', descansoMin: 3, topBack: true, backoffPct: 10, rirBack: '2' },
    { id: 'b', dia: 'Torso', orden: 2, patron: 'Tirón horizontal', grupo: 'Espalda', ejercicio: 'Remo con barra inclinado', series: 3, reps: '8-12', rir: '2', descansoMin: null },
    { id: 'c', dia: 'Torso', orden: 3, patron: 'Aislamiento', grupo: 'Tríceps', ejercicio: 'Extensión en cuerda en polea', series: 3, reps: '10-15', rir: '1', superConAnterior: true },
    { id: 'd', dia: 'Pierna', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps', ejercicio: 'Sentadilla con barra', series: 4, reps: '6-8', rir: '2', descansoMin: 3.5 },
    { id: 'e', dia: 'Pierna', orden: 2, patron: 'Aislamiento', grupo: 'Cuádriceps', ejercicio: 'Extensión de cuádriceps', series: 3, reps: '10-12', rir: '0', dropSet: true, dropPct: 20 },
    { id: 'f', dia: 'Brazos', orden: 1, patron: 'Aislamiento', grupo: 'Bíceps', ejercicio: 'Curl con barra', series: 3, reps: '20-25', rir: '0', restPause: true, pausaRpSeg: 30 },
    { id: 'g', dia: 'Brazos', orden: 2, patron: 'Core', grupo: 'Core', ejercicio: 'Plancha lastrada', series: 3, reps: '30-45', rir: '2' },
  ];
  return raw;
}

test('rutina del móvil: modelo del editor con modalidades, contexto y forma canónica', () => {
  const raw = copiaPlan();
  const m = PL.rutinaMovil(raw);
  assert.equal(m.vigente, true);
  assert.equal(m.aPrueba, null);
  assert.equal(m.recortada, false);
  assert.deepEqual(m.rutina.dias.map(d => d.nombre), ['Torso', 'Pierna', 'Brazos']);
  const [torso, pierna, brazos] = m.rutina.dias;
  assert.equal(torso.filas[0].topBack, true);
  assert.equal(torso.filas[1].descanso, null);           // sin dato: la app usa el del ejercicio
  assert.equal(torso.filas[2].superConAnterior, true);
  assert.equal(pierna.filas[1].dropSet, true);
  assert.equal(brazos.filas[0].restPause, true);
  assert.equal(brazos.filas[0].pausaRpSeg, 30);
  // La superserie de la copia: la del Remo (recto) con la Extensión (recta).
  assert.equal(m.normal.dias[0].lineas[2].superserie, true);
  assert.equal(m.normal.dias[0].lineas[0].modalidad, 'topBack');
  // Rutina a prueba en el móvil y sin rutina personalizada.
  assert.deepEqual(plain(PL.rutinaMovil({ ...raw, importPendiente: { nombre: 'Mi prueba', origen: 'rutina_excel', previo: {} } }).aPrueba), { nombre: 'Mi prueba', origen: 'rutina_excel' });
  assert.equal(PL.rutinaMovil({ ...raw, planMod: [] }), null);
  // Otra combinación de días: puede no ser la que se usa.
  assert.equal(PL.rutinaMovil({ ...raw, dias: '4' }).vigente, false);
  // Más ejercicios de los que caben en el Excel: se avisa.
  const largo = { ...raw, planMod: Array.from({ length: 11 }, (_, i) => ({ dia: 'Torso', orden: i, ejercicio: `Ej ${i}`, series: 2, reps: '8', rir: '2' })) };
  assert.equal(PL.rutinaMovil(largo).recortada, true);
});

test('un borrador sin cambios produce en la app la misma rutina que tiene el móvil', () => {
  for (const raw of [copiaPlan(), copiaRica()]){
    const m = PL.rutinaMovil(raw);
    const sim = PL.comoLaApp(m.rutina, raw);
    const d = PL.diferencias(m.normal, sim.normal);
    assert.equal(d.iguales, true, JSON.stringify(d));
    assert.equal(PL.firma(sim.normal), PL.firma(m.normal));
    assert.deepEqual(sim.notas, []);
  }
  // Copias ficticias del repositorio (las del Coach).
  for (const f of ['Laura', 'Javi', 'Ruben']){
    const raw = JSON.parse(fs.readFileSync(new URL(`../../coach/${f}_2026-08-26.json`, import.meta.url), 'utf8'));
    const m = PL.rutinaMovil(raw);
    const d = PL.diferencias(m.normal, PL.comoLaApp(m.rutina, raw).normal);
    assert.equal(d.iguales, true, `${f}: ${JSON.stringify(d.dias.filter(x => x.estado !== 'igual'))}`);
  }
});

test('la simulación reproduce las lecturas y valores por defecto del importador', () => {
  const raw = copiaPlan();
  const rutina = { sistema: 'doble', dias: [
    { nombre: '', filas: [
      { patron: 'Empuje horizontal', ejercicio: 'Press banca con barra', series: null, repsMin: 8, repsMax: 8, rir: null, descanso: 2 },
      { patron: 'Aislamiento', ejercicio: 'Curl de bíceps con barra', series: 3, repsMin: 20, repsMax: 25, rir: 0, restPause: true, pausaRpSeg: 25 },
      { patron: '', ejercicio: '' },
    ] },
    { nombre: 'Torso', filas: [{ patron: 'Rodilla', ejercicio: 'Sentadilla con barra', series: 3, repsMin: null, repsMax: null, rir: 2, topBack: true, backoffPct: 50 }] },
    { nombre: 'Torso', filas: [{ patron: 'Rodilla', ejercicio: 'Prensa', series: 3, repsMin: 10, repsMax: 12, rir: 2, dropSet: true, dropPct: 2 }] },
    { nombre: 'Vacío', filas: [] },
  ] };
  const sim = PL.comoLaApp(rutina, raw);
  assert.deepEqual(sim.dias.map(d => d.nombre), ['Día 1', 'Torso', 'Torso (3)']);
  const [press, curl] = sim.dias[0].lineas;
  assert.equal(press.series, 3);              // C vacía → 3
  assert.equal(press.reps, '8-10');           // máx ≤ mín → mín + 2
  assert.equal(press.rir, '2');               // D vacía → 2
  assert.equal(curl.pausaRpSeg, 30);          // rejilla de 10 s
  assert.equal(sim.dias[0].lineas.length, 2); // fila incompleta fuera
  const sent = sim.dias[1].lineas[0];
  assert.equal(sent.reps, '8-10');            // E vacía → 8
  assert.equal(sent.backoffPct, 30);          // acotado a 5–30
  assert.equal(sim.dias[2].lineas[0].dropPct, 5);
  const textos = sim.notas.map(n => n.txt).join('\n');
  assert.match(textos, /sin nombre se llamará «Día 1»/);
  assert.match(textos, /dos días llamados «Torso»/);
  assert.match(textos, /sin series; la app usará 3/);
  assert.match(textos, /la app usará 8–10/);
  assert.match(textos, /se ajustará a 30 s/);
  // Simple: reps solo con el mínimo.
  const simple = PL.comoLaApp({ ...rutina, sistema: 'simple' }, raw);
  assert.equal(simple.dias[0].lineas[0].reps, '8');
});

test('ediciones: modalidades excluyentes, superseries, orden, límites y sin mutar el original', () => {
  const raw = copiaPlan();
  const base = PL.rutinaMovil(raw).rutina;
  const congelado = JSON.stringify(base);
  // Rest-pause en la Extensión (en superserie): rompe la superserie.
  let r = PL.editar(base, { tipo: 'campo', d: 0, f: 2, k: 'modalidad', valor: 'rp' });
  assert.equal(r.dias[0].filas[2].restPause, true);
  assert.equal(r.dias[0].filas[2].superConAnterior, false);
  assert.equal(JSON.stringify(base), congelado);
  // Top+back en el curl rest-pause: manda la nueva y apaga el rest-pause.
  r = PL.editar(base, { tipo: 'campo', d: 2, f: 0, k: 'modalidad', valor: 'topBack' });
  assert.equal(r.dias[2].filas[0].topBack, true);
  assert.equal(r.dias[2].filas[0].restPause, false);
  // Superserie sobre una fila con top+back: el grupo pasa a series rectas.
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 1, k: 'superConAnterior', valor: true });
  assert.equal(r.dias[0].filas[0].topBack, false);
  assert.equal(r.dias[0].filas[1].superConAnterior, true);
  // Mover la Extensión arriba: su superserie queda pegada al Press con top+back → se suelta.
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 2, k: 'superConAnterior', valor: true });
  r = PL.editar(r, { tipo: 'moverFila', d: 0, f: 2, delta: -1 });
  assert.equal(r.dias[0].filas[1].ejercicio, 'Extensión en cuerda en polea');
  assert.equal(r.dias[0].filas[1].superConAnterior, false);
  assert.equal(PL.editar(base, { tipo: 'moverFila', d: 0, f: 0, delta: -1 }), null);
  // Rest-pause con 1 serie sube a 2 (igual que la app).
  r = PL.editar(base, { tipo: 'campo', d: 1, f: 0, k: 'series', valor: '1' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 0, k: 'modalidad', valor: 'rp' });
  assert.equal(r.dias[1].filas[0].series, 2);
  // Descanso «por defecto» = sin dato.
  r = PL.editar(base, { tipo: 'campo', d: 0, f: 0, k: 'descanso', valor: '' });
  assert.equal(r.dias[0].filas[0].descanso, null);
  // Límites del Excel: 5 días y 10 ejercicios por día.
  let lleno = base;
  for (let i = 0; i < 5; i++) lleno = PL.editar(lleno, { tipo: 'addDia' }) || lleno;
  assert.equal(lleno.dias.length, 5);
  assert.equal(PL.editar(lleno, { tipo: 'addDia' }), null);
  for (let i = 0; i < 12; i++) lleno = PL.editar(lleno, { tipo: 'addFila', d: 0 }) || lleno;
  assert.equal(lleno.dias[0].filas.length, 10);
  r = PL.editar(base, { tipo: 'moverDia', d: 2, delta: -2 });
  assert.deepEqual(r.dias.map(d => d.nombre), ['Brazos', 'Torso', 'Pierna']);
});

test('comparación activa ↔ propuesta: ejercicios, campos, orden, días y series por grupo', () => {
  const raw = copiaPlan();
  const m = PL.rutinaMovil(raw);
  let r = m.rutina;
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 1, k: 'series', valor: 4 });                 // Remo 3 → 4
  r = PL.editar(r, { tipo: 'delFila', d: 0, f: 2 });                                      // fuera Extensión
  r = PL.editar(r, { tipo: 'addFila', d: 1 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'patron', valor: 'Bisagra' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'ejercicio', valor: 'Peso muerto rumano con barra' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'repsMin', valor: 8 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'repsMax', valor: 10 });
  r = PL.editar(r, { tipo: 'moverFila', d: 1, f: 1, delta: -1 });                         // orden en Pierna
  r = PL.editar(r, { tipo: 'nombreDia', d: 2, valor: 'Brazos y core' });
  const sim = PL.comoLaApp(r, raw);
  const d = PL.diferencias(m.normal, sim.normal);
  assert.equal(d.iguales, false);
  const [torso, pierna, brazos] = d.dias;
  assert.deepEqual(torso.cambios.map(c => [c.tipo, c.ejercicio]), [['cambiado', 'Remo con barra inclinado'], ['quitado', 'Extensión en cuerda en polea']]);
  assert.deepEqual(plain(torso.cambios[0].campos.map(c => [c.campo, c.antes, c.despues])), [['series', 3, 4]]);
  assert.equal(pierna.ordenCambiado, true);
  assert.deepEqual(pierna.cambios.map(c => c.tipo), ['nuevo']);
  assert.equal(brazos.renombrado, true);
  assert.equal(brazos.cambios.length, 0);
  // Series por grupo: mismo reparto que la app.
  const g = PL.resumenGrupos(M(raw), m.normal, sim.normal);
  const fila = n => g.filas.find(f => f.grupo === n);
  // Remo +1 serie y el peso muerto rumano nuevo, que también trabaja espalda (+0,5 × 3).
  assert.equal(fila('Espalda').dSeries, 2.5);
  assert.deepEqual(g.despues.sinGrupo, []);
  // Un ejercicio que no está en el catálogo ni en la biblioteca no suma: se enumera.
  const raro = PL.comoLaApp(PL.editar(r, { tipo: 'campo', d: 0, f: 0, k: 'ejercicio', valor: 'Press raro' }), raw);
  assert.deepEqual(PL.resumenGrupos(M(raw), m.normal, raro.normal).despues.sinGrupo, ['Press raro']);
  assert.equal(fila('Tríceps').dSeries, -3);              // fuera la extensión (el press sigue sumando media)
  assert.ok(fila('Isquios').seriesDespues > 0);
  // Quitar un día cambia la frecuencia y el número de días.
  const sinBrazos = PL.comoLaApp(PL.editar(m.rutina, { tipo: 'delDia', d: 2 }), raw);
  const d2 = PL.diferencias(m.normal, sinBrazos.normal);
  assert.deepEqual(plain(d2.numDias), { antes: 3, despues: 2 });
  assert.equal(d2.dias[2].estado, 'quitado');
  assert.equal(PL.resumenGrupos(M(raw), m.normal, sinBrazos.normal).filas.find(f => f.grupo === 'Bíceps').dDias, -1);
});

test('avisos: días suficientes, rest-pause sin series o por tiempo, ejercicio desconocido, filas incompletas', () => {
  const raw = copiaPlan();
  const base = PL.rutinaMovil(raw).rutina;
  assert.equal(PL.avisos(base, raw).bloquea, false);
  const unDia = PL.editar(PL.editar(base, { tipo: 'delDia', d: 2 }), { tipo: 'delDia', d: 1 });
  const a1 = PL.avisos(unDia, raw);
  assert.equal(a1.bloquea, true);
  assert.match(a1.avisos[0].txt, /entre 2 y 5 días/);
  let r = PL.editar(base, { tipo: 'campo', d: 2, f: 1, k: 'modalidad', valor: 'rp' });   // Plancha por tiempo
  r = PL.editar(r, { tipo: 'addFila', d: 0 });
  r = PL.editar(r, { tipo: 'campo', d: 0, f: 3, k: 'patron', valor: 'Aislamiento' });
  r = PL.editar(r, { tipo: 'addFila', d: 1 });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'patron', valor: 'Aislamiento' });
  r = PL.editar(r, { tipo: 'campo', d: 1, f: 2, k: 'ejercicio', valor: 'Curl inventado' });
  r.dias[1].filas[1].series = 1;                                                           // drop set de 1 serie
  const txt = PL.avisos(r, raw).avisos.map(a => `${a.nivel}:${a.txt}`).join('\n');
  assert.match(txt, /ambar:.*Plancha lastrada: se mide por tiempo/);
  assert.match(txt, /ambar:Torso: hay una fila sin ejercicio/);
  assert.match(txt, /azul:.*«Curl inventado» no está en el catálogo ni en tu biblioteca/);
  assert.match(txt, /ambar:.*drop set necesita al menos 2 series/);
  // Los ejercicios propios del móvil no se marcan como desconocidos.
  assert.doesNotMatch(txt, /«Plancha lastrada» no está/);
  // Ningún aviso describe umbrales del motor.
  assert.doesNotMatch(txt, /%|umbral|ventana/i);
});

test('progresión: mismo sistema y días conserva cargas; otro número de días o sistema las reinicia', () => {
  const raw = copiaPlan();
  const base = PL.rutinaMovil(raw).rutina;
  // copiaRica tiene sesiones de la revisión actual con dias '2': se fija la
  // rutina actual a 3 días para que haya sesiones de la rutina vigente.
  raw.logs.forEach(l => { if (l.dias) l.dias = '3'; });
  assert.equal(PL.progresion(raw, PL.comoLaApp(base, raw)).conserva, true);
  const p2 = PL.progresion(raw, PL.comoLaApp(PL.editar(base, { tipo: 'delDia', d: 2 }), raw));
  assert.equal(p2.conserva, false);
  assert.equal(p2.mismosDias, false);
  const p3 = PL.progresion(raw, PL.comoLaApp(PL.editar(base, { tipo: 'sistema', valor: 'simple' }), raw));
  assert.equal(p3.mismoSistema, false);
  // Sin sesiones de la rutina actual la app no dice nada.
  assert.equal(PL.progresion({ ...raw, logs: [] }, PL.comoLaApp(base, raw)), null);
});

test('borradores: origen, discrepancia con una copia nueva y estado de la exportación', () => {
  const raw = copiaPlan();
  const m = PL.rutinaMovil(raw);
  const b = PL.nuevoBorrador({ espacioId: 'e1', nombre: 'Bloque fuerza', rutina: m.rutina,
    origen: { tipo: 'movil', firma: PL.firma(m.normal), normal: m.normal, rutina: m.rutina }, ahora: '2026-07-03T10:00:00.000Z' });
  assert.equal(PL.discrepancia(b, raw), null);
  // En el móvil se cambió la rutina: una serie más de sentadilla.
  const raw2 = plain(raw); raw2.planMod[3].series = 5;
  const dis = PL.discrepancia(b, raw2);
  assert.ok(dis);
  assert.deepEqual(plain(dis.diff.dias[1].cambios[0].campos.map(c => [c.campo, c.antes, c.despues])), [['series', 4, 5]]);
  // La copia ya no trae rutina personalizada.
  assert.equal(PL.discrepancia(b, { ...raw, planMod: [] }).sinRutina, true);
  // Los borradores que no salen del móvil no tienen discrepancia.
  assert.equal(PL.discrepancia({ ...b, origen: { tipo: 'blanco' } }, raw2), null);
  // Exportación: la firma es la de lo que construirá la app.
  const r = PL.editar(b.rutina, { tipo: 'campo', d: 0, f: 1, k: 'series', valor: 4 });
  const exp = { fecha: '2026-07-04T10:00:00.000Z', archivo: 'x.xlsx', firma: PL.firma(PL.comoLaApp(r, raw).normal) };
  assert.equal(PL.estadoExportacion(exp, raw, { importadoEn: '2026-07-03T09:00:00.000Z' }), 'pendiente');
  assert.equal(PL.estadoExportacion(exp, raw, { importadoEn: '2026-07-05T09:00:00.000Z' }), 'distinta');
  const aplicada = plain(raw); aplicada.planMod[1].series = 4;
  assert.equal(PL.estadoExportacion(exp, aplicada, { importadoEn: '2026-07-05T09:00:00.000Z' }), 'aplicada');
  aplicada.importPendiente = { nombre: 'x', origen: 'rutina_excel', previo: {} };
  assert.equal(PL.estadoExportacion(exp, aplicada, { importadoEn: '2026-07-05T09:00:00.000Z' }), 'aPrueba');
  // Un borrador antiguo o incompleto se lee sin perder lo que trae.
  const viejo = PL.leerBorrador({ id: 'x', espacioId: 'e1', rutina: { sistema: 'simple', dias: [{ nombre: 'A', filas: [{ patron: 'Rodilla', ejercicio: 'Sentadilla con barra', series: 3 }] }] } });
  assert.equal(viejo.rutina.dias[0].filas[0].restPause, false);
  assert.equal(viejo.origen.tipo, 'blanco');
  assert.deepEqual(viejo.exportaciones, []);
  assert.equal(PL.leerBorrador(null), null);
  // Nombre de archivo apto para Android e iOS.
  assert.equal(PL.nombreArchivo({ nombre: 'Bloque ñ / fuerza: <v2>' }, new Date(2026, 6, 4)), 'mi_rutina_truelift_Bloque_n_fuerza_v2_2026-07-04.xlsx');
});

// ---------- Exportación Excel ----------

async function exportar(rutina, raw){
  const sim = PL.comoLaApp(rutina, raw);
  return { sim, bytes: await XLSX.escribirRutina(sim.exportable) };
}

/* Celdas de una hoja del xlsx (lector mínimo para la prueba). */
function celdasXlsx(bytes, hoja){
  const zlib = globalThis.__zlib;
  const buf = Buffer.from(bytes);
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4B, 0x05, 0x06]));
  const n = buf.readUInt16LE(p + 10); let off = buf.readUInt32LE(p + 16);
  for (let i = 0; i < n; i++){
    const metodo = buf.readUInt16LE(off + 10), tam = buf.readUInt32LE(off + 20);
    const ln = buf.readUInt16LE(off + 28), le = buf.readUInt16LE(off + 30), lc = buf.readUInt16LE(off + 32);
    const nombre = buf.toString('utf8', off + 46, off + 46 + ln), loc = buf.readUInt32LE(off + 42);
    off += 46 + ln + le + lc;
    if (nombre !== hoja) continue;
    const ini = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const datos = buf.subarray(ini, ini + tam);
    const xml = (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
    const out = {};
    for (const m of xml.matchAll(/<x:c r="([A-Z]+\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/x:c>)/g)){
      const t = /<x:t[^>]*>([\s\S]*?)<\/x:t>/.exec(m[2] || '') || /<x:v>([\s\S]*?)<\/x:v>/.exec(m[2] || '');
      if (t) out[m[1]] = t[1];
    }
    return out;
  }
  return null;
}
globalThis.__zlib = (await import('node:zlib')).default;

test('el Excel exportado lleva modalidades, superseries, rest-pause y la biblioteca propia', async () => {
  const raw = copiaPlan();
  const base = PL.rutinaMovil(raw).rutina;
  const { bytes } = await exportar(base, raw);
  const torso = celdasXlsx(bytes, 'xl/worksheets/sheet2.xml');
  assert.equal(torso.B1, 'Torso');
  assert.equal(torso.H4, 'sí'); assert.equal(torso.I4, '10');                 // top+back
  assert.equal(torso.K5, '1'); assert.equal(torso.K6, '1');                   // superserie
  assert.equal(torso.G5, undefined);                                           // descanso por defecto
  const pierna = celdasXlsx(bytes, 'xl/worksheets/sheet3.xml');
  assert.equal(pierna.L5, 'sí'); assert.equal(pierna.M5, '20');               // drop set
  const brazos = celdasXlsx(bytes, 'xl/worksheets/sheet4.xml');
  assert.equal(brazos.N4, 'sí'); assert.equal(brazos.O4, '30');               // rest-pause
  const listas = celdasXlsx(bytes, 'xl/worksheets/sheet7.xml');
  assert.equal(listas.W101, 'TRUELIFT_EXERCISES_V1');
  assert.equal(listas.W102, 'Plancha lastrada');
  assert.equal(listas.Z102, '[&quot;Hombro&quot;]');
  assert.equal(listas.AB102, 'Con disco');
  assert.equal(listas.AD102, '1');                                             // por tiempo
  const instr = celdasXlsx(bytes, 'xl/worksheets/sheet1.xml');
  assert.equal(instr.B3, 'doble');
});

// Lector real de la app (Dart). Se omite si falta el SDK o App-PRO.
const appPro = process.env.APP_PRO_DIR || new URL('../../../App-PRO/', import.meta.url).pathname;
function buscarDart(){
  for (const c of [process.env.DART, 'dart'].filter(Boolean)){
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch (_) { /* siguiente */ }
  }
  return null;
}
const dart = buscarDart();
const fuentesApp = ['rutina_excel.dart', 'rutina_excel_compatibilidad.dart', 'rutina_excel_localizacion.dart'].map(f => path.join(appPro, 'lib', f));
const omitirDart = !dart ? 'sin SDK de Dart (define DART)' : !fuentesApp.every(f => fs.existsSync(f)) ? 'App-PRO no está junto a este repositorio' : false;

test('el lector REAL de la app lee los Excel exportados igual que la simulación', { skip: omitirDart, timeout: 600000 }, async () => {
  const dir = path.join(os.tmpdir(), 'tl-arnes-excel');
  const arnes = new URL('./arnes-excel/', import.meta.url).pathname;
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  for (const f of ['pubspec.yaml', 'lib/l10n.dart', 'bin/leer.dart']) fs.copyFileSync(path.join(arnes, f), path.join(dir, f));
  for (const f of fuentesApp) fs.copyFileSync(f, path.join(dir, 'lib', path.basename(f)));
  if (!fs.existsSync(path.join(dir, '.dart_tool'))) execFileSync(dart, ['pub', 'get'], { cwd: dir, stdio: 'ignore' });

  const raw = copiaPlan();
  const base = PL.rutinaMovil(raw).rutina;
  let editada = PL.editar(base, { tipo: 'sistema', valor: 'simple' });
  editada = PL.editar(editada, { tipo: 'campo', d: 0, f: 0, k: 'repsMin', valor: 5 });
  editada = PL.editar(editada, { tipo: 'nombreDia', d: 1, valor: 'Pierna «pesada» & glúteo' });
  const casos = [['completa', base], ['simple', editada]];
  const archivos = [];
  const sims = {};
  for (const [nombre, rutina] of casos){
    const { sim, bytes } = await exportar(rutina, raw);
    const f = path.join(dir, `${nombre}.xlsx`);
    fs.writeFileSync(f, bytes);
    archivos.push(f); sims[f] = sim;
  }
  const leido = JSON.parse(execFileSync(dart, ['run', 'bin/leer.dart', ...archivos], { cwd: dir, encoding: 'utf8' }));
  for (const f of archivos){
    const app = leido[f], sim = sims[f];
    assert.equal(app.error, undefined, `${path.basename(f)}: ${app.error}`);
    assert.equal(app.sistema, sim.sistema);
    const diasApp = app.dias.filter(d => d.ejercicios.length);
    assert.deepEqual(diasApp.map(d => d.nombre), sim.dias.map(d => d.nombre));
    diasApp.forEach((d, di) => {
      let previa = 0;
      d.ejercicios.forEach((e, i) => {
        const s = sim.dias[di].lineas[i];
        const ctx = `${path.basename(f)} · ${d.nombre} · ${e.ejercicio}`;
        assert.equal(e.ejercicio, s.ejercicio, ctx);
        assert.equal(e.series, s.series, ctx);
        assert.equal(e.reps, s.reps, ctx);
        assert.equal(e.rir, s.rir, ctx);
        assert.equal(e.descanso, s.descansoMin, ctx);
        assert.equal(e.topBack, s.topBack, ctx);
        if (s.topBack){ assert.equal(e.backoffPct, s.backoffPct, ctx); assert.equal(e.rirBack, s.rirBack, ctx); }
        assert.equal(e.dropSet && !e.topBack, s.dropSet, ctx);
        if (s.dropSet) assert.equal(e.dropPct, s.dropPct, ctx);
        assert.equal(e.restPause && !e.topBack && !e.dropSet, s.restPause, ctx);
        if (s.restPause) assert.equal(e.pausaRpSeg, s.pausaRpSeg, ctx);
        assert.equal(e.superserie !== 0 && e.superserie === previa, s.superConAnterior, ctx);
        previa = e.superserie;
      });
    });
    const plancha = app.ejercicios.find(e => e.nombre === 'Plancha lastrada');
    assert.ok(plancha, 'la biblioteca embebida trae el ejercicio propio');
    assert.equal(plancha.porTiempo, true);
    assert.deepEqual(plancha.secundarios, ['Hombro']);
    assert.equal(plancha.nota, 'Con disco');
  }
});
