// Plan de entrenador F3 — e2e del modo entrenador en Chromium (Playwright).
// PLAN_ENTRENADOR.md §8.3 (App-PRO): sin clave no hay sección ni se piden sus
// scripts; con la clave de PRUEBAS se crea un cliente, se emite un paquete y
// el archivo descargado verifica. También la migración de IndexedDB v2 → v3
// con la copia de ejemplo. Datos sintéticos. Uso:
//   node escritorio/tests/entrenador.e2e.mjs [carpetaCapturas]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';
import { archivoClave, CLAVE_PRUEBAS, CONTRASENA_PRUEBAS } from './clave-pruebas.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)){
  try { pw = require(p); break; } catch (_) { /* siguiente */ }
}
if (!pw){ console.error('No se encontró Playwright. Define PLAYWRIGHT_MODULE.'); process.exit(2); }

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'catalogo.js', 'canonico.js', 'planner.js');
const { PaqueteEntrenador: P, PlanificadorEntrenador: PL, ImportarJSON } =
  cargar('analisis.js', 'importar.js', 'nutricion-esc.js', 'entrenador/paquete.js', 'entrenador/temporada.js', 'entrenador/planificador.js');
const CLAVES = { [CLAVE_PRUEBAS.id]: CLAVE_PRUEBAS.publica };

const raiz = path.resolve(new URL('../../', import.meta.url).pathname);
const capturas = process.argv[2] || null;
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
                '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const servir = (req, res) => {
  let f = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(raiz)){ res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)){ res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
};
const escuchar = async () => { const s = http.createServer(servir); await new Promise(ok => s.listen(0, '127.0.0.1', ok)); return s; };
const servidor = await escuchar(), servidor2 = await escuchar();
const origen = `http://127.0.0.1:${servidor.address().port}`;
const origen2 = `http://127.0.0.1:${servidor2.address().port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-ent-e2e-'));
const escribir = (nombre, datos) => { const p = path.join(tmp, nombre); fs.writeFileSync(p, datos); return p; };

const navegador = await pw.chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const peticiones = [], externas = [], erroresJs = [];
ctx.on('request', r => {
  peticiones.push(r.url());
  if (![origen, origen2].some(o => r.url().startsWith(o + '/')) && !/^(blob|data):/.test(r.url())) externas.push(r.url());
});
ctx.on('page', p => {
  p.on('pageerror', e => erroresJs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') erroresJs.push(m.text()); });
});
let pagina = await ctx.newPage();
let paso = 0;
const ok = msg => console.log(`ok ${++paso} - ${msg}`);
const foto = async n => { if (capturas) await pagina.screenshot({ path: path.join(capturas, n), fullPage: true }); };
const delModo = () => peticiones.filter(u => /\/escritorio\/entrenador\/|\/coach\/planner\.js/.test(u));
const txt = () => pagina.locator('#contenido').innerText();
async function cambiar(sel, valor){
  // Cada cambio se guarda y la sección se vuelve a pintar: se espera a que
  // el control sea uno nuevo con el valor puesto.
  const el = pagina.locator(sel);
  await el.evaluate(e => { e.dataset.prueba = 'viejo'; });
  if (await el.evaluate(e => e.tagName) === 'SELECT') await el.selectOption(String(valor));
  else { await el.fill(String(valor)); await el.press('Tab'); }
  await pagina.waitForFunction(([s, v]) => { const e = document.querySelector(s); return e && !e.dataset.prueba && e.value === String(v); }, [sel, valor]);
}
const enDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/* Fila de «Planes emitidos» de un archivo (por su huella: dos planes del mismo
   cliente y día comparten nombre). */
const filaDe = d => pagina.locator('#entEmitidos tr', { hasText: createHash('sha256').update(d.bytes).digest('hex').slice(0, 16) });
async function descargarPlan(){
  const [dl] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#entEmitirConfirmar')]);
  const ruta = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(ruta);
  return { nombre: dl.suggestedFilename(), bytes: fs.readFileSync(ruta) };
}

try {
  // --- 1. Usuario normal: ni sección ni scripts del modo ---
  await pagina.goto(`${origen}/escritorio/`);
  await pagina.waitForSelector('html[data-listo="1"]');
  const copia = copiaRica();
  copia.dias = '3'; copia.planModKey = 'hombre_doble|3';
  copia.planMod = [
    { id: 'a', dia: 'Torso', orden: 1, patron: 'Empuje horizontal', grupo: 'Pectoral', ejercicio: 'Press banca con barra', series: 3, reps: '6-10', rir: '2', topBack: true, backoffPct: 10, rirBack: '2' },
    { id: 'b', dia: 'Torso', orden: 2, patron: 'Tirón horizontal', grupo: 'Espalda', ejercicio: 'Remo con barra inclinado', series: 3, reps: '8-12', rir: '2' },
    { id: 'c', dia: 'Pierna', orden: 1, patron: 'Rodilla', grupo: 'Cuádriceps', ejercicio: 'Sentadilla con barra', series: 4, reps: '6-8', rir: '2', descansoMin: 3 },
    { id: 'd', dia: 'Brazos', orden: 1, patron: 'Aislamiento', grupo: 'Bíceps', ejercicio: 'Curl de bíceps con barra', series: 3, reps: '20-25', rir: '0', restPause: true, pausaRpSeg: 30 },
  ];
  await pagina.setInputFiles('#inputDatos', escribir('copia_truelift_2026-07-02.json', JSON.stringify(copia)));
  await pagina.getByText('Revisa la importación').waitFor();
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('#modalCaja [data-accion="cerrar"]');
  for (const s of ['resumen', 'rutina', 'datos']) await pagina.click(`#tabs [data-seccion="${s}"]`);
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  assert.equal(await pagina.locator('#tabs [data-seccion="entrenador"]').count(), 0);
  assert.deepEqual(delModo(), []);
  assert.doesNotMatch(await pagina.locator('body').innerText(), /entrenador/i);
  ok('sin clave: no hay sección de entrenador ni se pide ninguno de sus scripts');

  // --- 2. #entrenador: desbloqueo ---
  await pagina.goto(`${origen}/escritorio/#entrenador`);
  await pagina.getByRole('heading', { name: 'Desbloquear con tu archivo de clave' }).waitFor();
  assert.ok(delModo().some(u => u.endsWith('/escritorio/entrenador/modo.js')));
  assert.equal(await pagina.locator('#tabs [data-seccion="entrenador"]').count(), 0);
  const fClave = escribir(`clave_entrenador_${CLAVE_PRUEBAS.id}.json`, await archivoClave());
  await pagina.setInputFiles('#entArchivoClave', fClave);
  await pagina.fill('#entContrasena', 'no es esta');
  await pagina.click('#entDesbloqueo button[type="submit"]');
  await pagina.getByText('La contraseña no es correcta').waitFor({ timeout: 20000 });
  assert.equal(await pagina.locator('#tabs [data-seccion="entrenador"]').count(), 0);
  await foto('e01-desbloqueo-error.png');
  await pagina.setInputFiles('#entArchivoClave', fClave);
  await pagina.fill('#entContrasena', CONTRASENA_PRUEBAS);
  await pagina.click('#entDesbloqueo button[type="submit"]');
  await pagina.getByRole('heading', { name: 'Entrenador', exact: true }).waitFor({ timeout: 20000 });
  await pagina.locator('#tabs [data-seccion="entrenador"]').waitFor();
  const guardada = await pagina.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('truelift-escritorio');
    r.onsuccess = () => { const g = r.result.transaction('meta').objectStore('meta').get('entrenador:clave');
      g.onsuccess = () => { const v = g.result.valor; ok({ id: v.id, tipo: v.privada.type, extraible: v.privada.extractable, version: r.result.version, claves: Object.keys(v).sort() }); r.result.close(); }; };
    r.onerror = () => ko(r.error);
  }));
  assert.deepEqual(guardada, { id: CLAVE_PRUEBAS.id, tipo: 'private', extraible: false, version: 3, claves: ['desde', 'id', 'nombre', 'privada', 'publica'] });
  ok('desbloqueo: contraseña incorrecta rechazada; la correcta guarda la clave no extraíble (sin contraseña) y aparece la pestaña');

  // --- 3. Cliente nuevo sin copia, borrador en blanco y emisión ---
  await pagina.click('[data-ent-accion="cliente-nuevo"]');
  await pagina.fill('#entFNombre', 'Luis Gómez');
  await pagina.selectOption('#entFSexo', 'hombre');
  await pagina.fill('#entFPeso', '82.5');
  await pagina.fill('#entFNotas', 'Hombro derecho delicado');
  await pagina.click('[data-ent-accion="ficha-guardar"]');
  await pagina.getByRole('heading', { name: 'Luis Gómez', exact: true }).waitFor();
  assert.match(await txt(), /Hombro derecho delicado/);
  assert.match(await pagina.locator('#estadoDatos').innerText(), /Cliente sin copia/);
  await pagina.click('[data-ent-accion="nuevo-blanco"]');
  await pagina.locator('#ent-0-0-ejercicio').waitFor();
  await cambiar('#ent-0-0-patron', 'Empuje horizontal');
  await cambiar('#ent-0-0-ejercicio', 'Press banca con barra');
  await cambiar('#ent-0-0-repsMin', 6);
  await cambiar('#ent-0-0-repsMax', 8);
  await cambiar('#ent-1-0-ejercicio', 'Sentadilla con barra');
  assert.equal(await pagina.inputValue('#ent-1-0-patron'), 'Rodilla');
  await cambiar('#ent-1-0-modalidad', 'drop');
  await pagina.click('[data-ent-accion="fila-nueva"][data-d="1"]');
  await cambiar('#ent-1-1-patron', 'Aislamiento');
  await cambiar('#ent-1-1-ejercicio', 'Curl de bíceps con barra');
  assert.equal(await pagina.isDisabled('#ent-1-1-superConAnterior'), true);   // tras un drop set no cabe superserie
  await pagina.click('[data-ent-accion="dia-quitar"][data-d="2"]');
  await pagina.waitForFunction(() => !document.getElementById('ent-2-nombre'));
  // Deshacer y rehacer.
  await pagina.click('#entDeshacer');
  await pagina.locator('#ent-2-nombre').waitFor();
  await pagina.click('#entRehacer');
  await pagina.waitForFunction(() => !document.getElementById('ent-2-nombre'));
  assert.match(await pagina.locator('#entAvisos').innerText(), /no está en el catálogo|Sin avisos|Revisa/);
  await foto('e02-editor.png');
  await pagina.click('#entEmitir');
  await pagina.locator('#entNombreEntrenador').waitFor();
  await pagina.click('#entEmitirConfirmar');
  await pagina.getByText('Escribe tu nombre').waitFor();
  await pagina.fill('#entNombreEntrenador', 'Ana Pérez');
  await pagina.fill('#entNota', 'Empieza el lunes. Calienta bien el hombro.');
  await foto('e03-emitir.png');
  const d1 = await descargarPlan();
  assert.equal(d1.nombre, `plan_truelift_luis_gomez_${P.hoyLocal()}.json`);
  const v1 = await P.verificar(d1.bytes, { claves: CLAVES });
  assert.equal(v1.ok, true, v1.detalle);
  assert.equal(v1.carga.cliente.nombre, 'Luis Gómez');
  assert.equal(v1.carga.entrenador.nombre, 'Ana Pérez');
  assert.equal(v1.carga.nota, 'Empieza el lunes. Calienta bien el hombro.');
  assert.equal(v1.carga.temporada, undefined);
  assert.equal(v1.carga.caduca, enDias(90));   // fecha límite por defecto (F5)
  assert.deepEqual(v1.carga.rutina.dias.map(d => d.ejercicios.map(e => [e.ejercicio, e.reps, e.dropSet])),
    [[['Press banca con barra', '6-8', false]], [['Sentadilla con barra', '8', true], ['Curl de bíceps con barra', '8-10', false]]]);
  assert.doesNotMatch(new TextDecoder().decode(P.desdeB64url(JSON.parse(d1.bytes).carga)), /Hombro derecho delicado|82[.,]5/);
  await pagina.locator('#entEmitidos').getByText(d1.nombre).waitFor();
  ok('cliente sin copia: ficha manual, borrador en blanco, deshacer, y el plan descargado verifica (sin la ficha)');

  // --- 4. Cliente con copia: borrador desde su rutina, igual que la app ---
  await pagina.click('[data-ent-accion="cliente-abrir"]');
  await pagina.getByRole('heading', { name: 'Mis datos', exact: true }).first().waitFor();
  await pagina.click('[data-ent-accion="nuevo-copia"]');
  await pagina.locator('#ent-0-0-ejercicio').waitFor();
  assert.match(await pagina.locator('#entCambios').innerText(), /igual que la rutina de su copia/);
  await cambiar('#ent-1-0-series', 5);
  assert.match(await pagina.locator('#entCambios').innerText(), /Series 4 → 5/);
  await pagina.click('#entEmitir');
  await pagina.locator('#entNombreEntrenador').waitFor();
  assert.equal(await pagina.inputValue('#entNombreEntrenador'), 'Ana Pérez');   // se recuerda
  const d2 = await descargarPlan();
  const v2 = await P.verificar(d2.bytes, { claves: CLAVES });
  assert.equal(v2.ok, true, v2.detalle);
  const esperado = PL.editar(PL.rutinaCopia(copia).rutina, { tipo: 'campo', d: 1, f: 0, k: 'series', valor: 5 });
  assert.deepEqual(PL.comoLaApp(v2.carga.rutina).normal, PL.simular(esperado, copia).normal);
  assert.equal(v2.carga.rutina.dias[2].ejercicios[0].restPause, true);
  // Plantilla: borrador de otro cliente.
  await pagina.click('[data-ent-accion="nuevo-otro"]');
  await pagina.locator('#entOtro').waitFor();
  await pagina.click('[data-ent-accion="nuevo-otro-ok"]');
  await pagina.locator('#entSelBorrador').waitFor();
  assert.match(await pagina.inputValue('#entSelBorrador').then(id => pagina.locator(`#entSelBorrador option[value="${id}"]`).innerText()), /de Luis Gómez/);
  ok('cliente con copia: borrador desde su rutina, comparación, plan verificado igual a la simulación; plantilla de otro cliente');

  // --- 4b. F5: temporada en el plan, sin rutina, con fecha límite ---
  const avisosT = () => pagina.locator('#entAvisosTemporada').innerText();
  await pagina.click('#entTemporadaNueva');
  await pagina.locator('#ent-t-0-tipo').waitFor();
  assert.match(await pagina.locator('#entTemporada').innerText(), /falta: .*% graso/);   // su copia no trae nutrición
  await cambiar('#ent-t-0-ritmo', '1.8');
  assert.match(await avisosT(), /lo bajará al aplicarlo/);
  assert.match(await avisosT(), /no hay proyección/);
  await pagina.click('#ent-t-nuevo'); await pagina.locator('#ent-t-1-tipo').waitFor();
  await pagina.click('#ent-t-nuevo'); await pagina.locator('#ent-t-2-tipo').waitFor();
  assert.deepEqual(await pagina.$$eval('[id^="ent-t-"][id$="-tipo"]', l => l.map(e => e.value)), ['CUT', 'BRIDGE', 'BULK']);
  await cambiar('#ent-t-1-tipo', 'CUT');
  assert.match(await avisosT(), /impide emitir[\s\S]*dos bloques seguidos del mismo tipo/i);
  await pagina.click('#entEmitir');
  await pagina.getByRole('heading', { name: 'Aún no se puede emitir' }).waitFor();
  await pagina.click('#modalCaja [data-accion="cerrar"]');
  await pagina.click('#entDeshacer');
  await pagina.waitForFunction(() => document.getElementById('ent-t-1-tipo')?.value === 'BRIDGE');
  assert.doesNotMatch(await avisosT(), /impide emitir/i);
  await pagina.click('#entIncluirRutina');
  await pagina.locator('#entSinRutina').waitFor();
  assert.equal(await pagina.locator('#ent-0-0-ejercicio').count(), 0);
  await foto('e04-temporada.png');
  await pagina.click('#entEmitir');
  await pagina.locator('#entNombreEntrenador').waitFor();
  assert.match(await pagina.locator('#modalCaja').innerText(), /Sin rutina[\s\S]*Temporada: Definición 8 sem → Normocalórica 2 sem → Volumen 16 sem/);
  assert.equal(await pagina.isChecked('#entCaduca'), true);
  assert.equal(await pagina.inputValue('#entCaducaFecha'), enDias(90));
  await pagina.fill('#entCaducaFecha', '2020-01-01');
  await pagina.click('#entEmitirConfirmar');
  await pagina.getByText('tiene que ser posterior a hoy').waitFor();
  assert.equal(await pagina.inputValue('#entCaducaFecha'), '2020-01-01');
  await pagina.fill('#entCaducaFecha', enDias(30));
  await foto('e05-emitir-temporada.png');
  const d3 = await descargarPlan();
  const v3 = await P.verificar(d3.bytes, { claves: CLAVES });
  assert.equal(v3.ok, true, v3.detalle);
  assert.equal(v3.carga.rutina, undefined);
  assert.equal(v3.carga.caduca, enDias(30));
  assert.deepEqual(v3.carga.temporada, { bloques: [{ tipo: 'CUT', semanas: 8, tasaPctSemana: -1.8 }, { tipo: 'BRIDGE', semanas: 2, tasaPctSemana: 0 },
    { tipo: 'BULK', semanas: 16, tasaPctSemana: 0.25 }] });
  assert.equal((await P.verificar(d3.bytes, { claves: CLAVES, hoy: enDias(31) })).error, 'caducado');
  const fila3 = filaDe(d3);
  await fila3.waitFor();
  assert.match(await fila3.innerText(), /Temporada: 3 bloques · 26 semanas[\s\S]*Copia anterior/);
  ok('temporada: bloques, avisos, tipos seguidos que impiden emitir, deshacer; plan sin rutina con fecha límite que verifica y caduca');

  // --- 4c. F5: estado del plan emitido con una copia posterior del cliente ---
  const copiaTras = { ...copia, planEntrenador: { aplicado: { id: v3.carga.id, emitido: v3.carga.emitido, entrenador: 'Ana Pérez', cliente: 'Mis datos',
    nota: '', aplicadoEn: enDias(0), rutina: null, temporada: 'pendiente', propuestaTemporada: v3.carga.temporada }, historial: [{ id: v3.carga.id, aplicadoEn: enDias(0) }] } };
  await pagina.click('[data-accion="importar-datos"]').catch(() => {});
  await pagina.setInputFiles('#inputDatos', escribir(`copia_truelift_${enDias(0)}.json`, JSON.stringify(copiaTras)));
  await pagina.getByText('Revisa la importación').waitFor();
  if (await pagina.locator('input[name="destino"][value="actualizar"]').count()) await pagina.check('input[name="destino"][value="actualizar"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('#modalCaja [data-accion="cerrar"]');
  await pagina.click('#tabs [data-seccion="entrenador"]');
  await pagina.locator('#entEmitidos').waitFor();
  assert.match(await filaDe(d3).innerText(), /Temporada pendiente[\s\S]*aún no ha aplicado la temporada/);
  assert.match(await filaDe(d2).innerText(), /Sin rastro/);
  ok('estado de los planes emitidos con su copia nueva: temporada pendiente; el anterior, sin rastro');

  // --- 4d. F5: cliente con nutrición, desde la temporada de su app, con proyección ---
  const ej = JSON.parse(fs.readFileSync(new URL('./fixtures/copia_truelift_2026-11-06.json', import.meta.url), 'utf8'));
  ej.nutricion.planTemporada = { id: 'plan-x', creado: enDias(-5), replanificado: null, transicionPropuesta: null, bloques: [
    { id: 'bloque-0', tipo: 'BULK', inicio: enDias(-5), fin: enDias(120), tasaPctSemana: 0.2 },
    { id: 'bloque-1', tipo: 'CUT', inicio: enDias(121), fin: enDias(197), tasaPctSemana: -0.5 }] };
  await pagina.click('[data-ent-accion="cliente-copia"]');
  await pagina.setInputFiles('#inputDatos', escribir('copia_truelift_2026-11-06.json', JSON.stringify(ej)));
  await pagina.getByText('Revisa la importación').waitFor();
  await pagina.fill('#nombreNuevo', 'Marta Ruiz');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('#modalCaja [data-accion="cerrar"]');
  if (!(await pagina.locator('[data-ent-accion="nuevo-blanco"]').count())) await pagina.click('#tabs [data-seccion="entrenador"]');
  await pagina.getByRole('heading', { name: 'Marta Ruiz', exact: true }).waitFor();
  await pagina.click('[data-ent-accion="nuevo-blanco"]');
  await pagina.locator('#entTemporadaCopia').waitFor();
  await pagina.click('#entIncluirRutina');
  await pagina.locator('#entSinRutina').waitFor();
  await pagina.click('#entTemporadaCopia');
  await pagina.locator('#ent-t-1-tipo').waitFor();
  assert.deepEqual(await pagina.$$eval('[id^="ent-t-"][id$="-tipo"]', l => l.map(e => e.value)), ['BULK', 'CUT']);
  assert.deepEqual(await pagina.$$eval('[id^="ent-t-"][id$="-semanas"]', l => l.map(e => e.value)), ['17', '11']);
  const tem = await pagina.locator('#entTemporada').innerText();
  assert.match(tem, /al aplicarla[\s\S]*al final[\s\S]*28\s*semanas/i);
  assert.match(tem, /176 cm/);
  assert.match(tem, /ancla la temporada al día en que el cliente la aplica/);
  await foto('e06-temporada-proyeccion.png');
  await pagina.click('#entEmitir');
  await pagina.locator('#entNombreEntrenador').waitFor();
  await pagina.uncheck('#entCaduca');
  assert.equal(await pagina.isDisabled('#entCaducaFecha'), true);
  const d4 = await descargarPlan();
  const v4 = await P.verificar(d4.bytes, { claves: CLAVES, hoy: '2099-01-01' });
  assert.equal(v4.ok, true, v4.detalle);
  assert.equal(v4.carga.caduca, undefined);
  assert.deepEqual(v4.carga.temporada.bloques.map(b => [b.tipo, b.semanas, b.tasaPctSemana]), [['BULK', 17, 0.2], ['CUT', 11, -0.5]]);
  assert.match(await filaDe(d4).innerText(), /Sin límite/);
  ok('cliente con nutrición: temporada desde la de su app, proyección con sus datos, plan sin fecha límite que verifica');

  // --- 5. Recarga: la clave sigue; salir la borra ---
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  await pagina.locator('#tabs [data-seccion="entrenador"]').waitFor();
  await pagina.getByRole('heading', { name: 'Planes emitidos' }).waitFor();
  await pagina.click('#entSalir');
  await pagina.click('[data-ent-accion="salir-ok"]');
  await pagina.waitForFunction(() => !document.querySelector('#tabs [data-seccion="entrenador"]'));
  assert.equal(await pagina.evaluate(() => location.hash), '');
  peticiones.length = 0;
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  assert.deepEqual(delModo(), []);
  assert.equal(await pagina.locator('#tabs [data-seccion="entrenador"]').count(), 0);
  const quedan = await pagina.evaluate(() => Escritorio.estado.espacios.map(e => e.nombre));
  assert.deepEqual(quedan, ['Mis datos', 'Luis Gómez', 'Marta Ruiz']);
  ok('recarga con la clave guardada; «Salir del modo entrenador» la borra y la página vuelve a no pedir sus scripts');

  // --- 6. Migración IndexedDB v2 → v3 con la copia de ejemplo ---
  const texto = fs.readFileSync(new URL('./fixtures/copia_truelift_2026-11-06.json', import.meta.url), 'utf8');
  const an = await ImportarJSON.analizar(texto, { nombreArchivo: 'copia_truelift_2026-11-06.json', bytes: Buffer.byteLength(texto) });
  assert.equal(an.ok, true);
  const p2 = await ctx.newPage();
  await p2.goto(`${origen2}/privacidad.html`);
  await p2.evaluate(({ texto, resumen, sha }) => new Promise((ok, ko) => {
    const r = indexedDB.open('truelift-escritorio', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('meta', { keyPath: 'clave' });
      db.createObjectStore('espacios', { keyPath: 'id' });
      db.createObjectStore('instantaneas', { keyPath: 'id' }).createIndex('espacioId', 'espacioId');
      for (const n of ['fotos', 'imagenes', 'miniaturas']) db.createObjectStore(n, { keyPath: ['espacioId', 'archivo'] });
      db.createObjectStore('importaciones', { keyPath: 'id', autoIncrement: true }).createIndex('espacioId', 'espacioId');
    };
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction(['meta', 'espacios', 'instantaneas', 'importaciones'], 'readwrite');
      tx.objectStore('espacios').put({ id: 'e1', nombre: 'Ejemplo', creado: '2026-11-06T10:00:00.000Z', instantaneaId: 'i1', instantaneaAnteriorId: null });
      tx.objectStore('instantaneas').put({ id: 'i1', espacioId: 'e1', texto, sha256: sha, bytes: texto.length, nombreArchivo: 'copia_truelift_2026-11-06.json', importadoEn: '2026-11-06T10:00:00.000Z', resumen });
      tx.objectStore('meta').put({ clave: 'espacioActivo', valor: 'e1' });
      tx.objectStore('meta').put({ clave: 'periodos:e1', valor: { a: { desde: '2026-10-01', hasta: '2026-10-15' }, b: { desde: '2026-10-16', hasta: '2026-11-01' } } });
      tx.objectStore('importaciones').put({ espacioId: 'e1', fecha: '2026-11-06T10:00:00.000Z', archivos: ['copia_truelift_2026-11-06.json'] });
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
    r.onerror = () => ko(r.error);
  }), { texto, resumen: an.resumen, sha: an.sha256 });
  await p2.goto(`${origen2}/escritorio/`);
  await p2.waitForSelector('html[data-listo="1"]');
  const tras = await p2.evaluate(() => new Promise(ok => {
    const r = indexedDB.open('truelift-escritorio');
    r.onsuccess = () => {
      const db = r.result, out = { version: db.version, almacenes: [...db.objectStoreNames].sort() };
      const tx = db.transaction(['instantaneas', 'meta', 'importaciones']);
      tx.objectStore('instantaneas').get('i1').onsuccess = e => { out.texto = e.target.result.texto; };
      tx.objectStore('meta').get('periodos:e1').onsuccess = e => { out.periodos = !!e.target.result; };
      tx.objectStore('importaciones').count().onsuccess = e => { out.importaciones = e.target.result; };
      tx.oncomplete = () => { db.close(); ok(out); };
    };
  }));
  assert.equal(tras.version, 3);
  assert.deepEqual(tras.almacenes, ['entrenador', 'espacios', 'fotos', 'imagenes', 'importaciones', 'instantaneas', 'meta', 'miniaturas']);
  assert.equal(tras.texto, texto);
  assert.equal(tras.periodos, true);
  assert.equal(tras.importaciones, 1);
  assert.equal(await p2.evaluate(() => Escritorio.estado.espacio.nombre), 'Ejemplo');
  assert.ok(await p2.evaluate(() => Escritorio.estado.inst.resumen.sesionesFuerza > 0));
  assert.equal(await p2.locator('#tabs [data-seccion="entrenador"]').count(), 0);
  await p2.close();
  ok('IndexedDB v2 → v3 con la copia de ejemplo: se añade «entrenador» y no se pierde nada');

  assert.deepEqual(externas, []);
  assert.deepEqual(erroresJs, []);
  ok('cero solicitudes externas y cero errores JavaScript');
  console.log(`# ${paso} comprobaciones del modo entrenador superadas`);
} catch (e) {
  console.log(`not ok - ${e && e.stack ? e.stack : e}`);
  if (erroresJs.length) console.log('# errores JS:', erroresJs);
  await foto('e99-fallo.png').catch(() => {});
  process.exitCode = 1;
} finally {
  await navegador.close();
  servidor.close(); servidor2.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
