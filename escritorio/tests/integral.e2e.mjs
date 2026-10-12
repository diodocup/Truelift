// Riesgos de fase 8 no cubiertos por e2e.mjs: error ASÍNCRONO real de IDB,
// corrección de índice sin nuevos binarios, reapertura del proceso y actualización SW.
// Solo datos sintéticos. PLAYWRIGHT_MODULE y AXE_MODULE son herramientas de prueba,
// nunca dependencias servidas por la aplicación. Uso: node .../integral.e2e.mjs [capturas/]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { copiaRica, crearZip } from './comun.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(new URL('../../', import.meta.url).pathname);
const capturas = process.argv[2];
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-integral-'));
const guardar = (n, d) => { const p = path.join(tmp, n); fs.writeFileSync(p, d); return p; };
let version = 'v5', falloServidor = false;
const servidor = http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  let f = path.resolve(raiz, '.' + ruta);
  if (!f.startsWith(raiz + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  if (falloServidor) return res.writeHead(503).end('Fallo sintético');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(f)] || 'application/octet-stream');
  const contenido = fs.readFileSync(f);
  res.end(ruta === '/escritorio/sw.js' ? contenido.toString().replace('${PREFIJO}v5', '${PREFIJO}' + version) : contenido);
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const origen = `http://127.0.0.1:${servidor.address().port}`;
const peticiones = [], errores = [];
let ctx, pagina, paso = 0;
const ok = s => console.log(`ok ${++paso} - ${s}`);
const observar = c => {
  c.on('request', r => peticiones.push({ url: r.url(), method: r.method(), data: r.postData() }));
  c.on('page', p => p.on('pageerror', e => errores.push(String(e))));
};
async function abrir(){
  ctx = await pw.chromium.launchPersistentContext(path.join(tmp, 'perfil'), { viewport: { width: 1366, height: 900 } });
  observar(ctx);
  pagina = await ctx.newPage();
  await pagina.goto(origen + '/escritorio/');
  await pagina.waitForSelector('html[data-listo="1"]');
}
async function previa(f, input = '#inputFotos'){
  await pagina.setInputFiles(input, f);
  await pagina.getByRole('heading', { name: 'Revisa la importación', exact: true }).waitFor();
}
async function confirmar(){
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('#modalCaja [data-accion="cerrar"]');
}
async function foto(n){ if (capturas) await pagina.screenshot({ path: path.join(capturas, n), fullPage: true }); }
async function estado(){
  return pagina.evaluate(async () => {
    const datos = {};
    for (const n of Almacen.ALMACENES) datos[n] = await Almacen.todos(n);
    for (const n of ['imagenes', 'miniaturas']) datos[n] = await Promise.all(datos[n].map(async v => ({ ...v, blob: Array.from(new Uint8Array(await v.blob.arrayBuffer())) })));
    return datos;
  });
}
try {
  await abrir();
  console.log(`# Chromium ${ctx.browser().version()} · Node ${process.version}`);
  // Un índice sin ninguno de sus originales sigue siendo información útil.
  const nombre = 'foto_20260801_frente.jpg';
  const indice = { schemaVersion: 1, fotos: [{ archivo: nombre, fecha: '2026-08-01', pose: 'frente' }], registros: [{ fecha: '2026-07-25', sitio: 'cintura', cm: 84 }] };
  const zip = i => guardar('fotos.zip', crearZip([{ nombre: 'medidas.json', datos: JSON.stringify(i) }]));
  await previa(zip(indice));
  await confirmar();
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.fecha, f.pose, f.tieneImagen])), [['2026-08-01', 'frente', false]]);
  ok('ZIP solo con índice: conserva medidas y fotos ausentes aunque no traiga imágenes');
  await previa(guardar('otra-persona.json', JSON.stringify(copiaRica())), '#inputDatos');
  assert.equal(await pagina.locator('[name="destino"]').count(), 2);
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.keyboard.press('Escape');
  ok('un espacio con solo metadatos también exige elegir actualizar o separar la copia JSON');

  const bytes = await pagina.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 150; c.height = 240;
    const g = c.getContext('2d'); g.fillStyle = '#234b70'; g.fillRect(0, 0, 150, 240);
    g.fillStyle = '#bad9eb'; g.fillRect(50, 60, 50, 150);
    return [...new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg'))).arrayBuffer())];
  });
  const zipImagen = i => guardar('imagen.zip', crearZip([{ nombre, datos: new Uint8Array(bytes) }, { nombre: 'medidas.json', datos: JSON.stringify(i) }]));
  await previa(zipImagen(indice)); await confirmar();
  const imagenAntes = (await estado()).imagenes;
  const corregido = structuredClone(indice);
  corregido.fotos[0].fecha = '2026-07-25'; corregido.fotos[0].pose = 'perfil';
  await previa(zipImagen(corregido));
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.check('[data-op="indiceZip"]');
  await foto('34-metadatos-zip.png');
  await confirmar();
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.fecha, f.pose, f.tieneImagen])), [['2026-07-25', 'perfil', true]]);
  assert.deepEqual((await estado()).imagenes, imagenAntes);
  ok('corregir fecha/pose sin renombrar ni cambiar bytes actualiza el índice sin duplicar imágenes');
  await previa(zipImagen(corregido));
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.keyboard.press('Escape');
  await previa(zipImagen(indice));
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.keyboard.press('Escape');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.galeria[0].pose), 'perfil');
  ok('ZIP idéntico no escribe; volver a un índice antiguo exige confirmación y cancelar lo conserva');

  // Prioridad JSON y borrador para verificar los ocho almacenes juntos.
  const raw = copiaRica(); raw.medidas.fotos = [{ archivo: nombre, fecha: '2026-07-20', pose: 'espalda' }];
  await previa(guardar('datos.json', JSON.stringify(raw)), '#inputDatos');
  await pagina.check('[name="destino"][value="actualizar"]'); await confirmar();
  assert.equal(await pagina.evaluate(() => Escritorio.estado.galeria[0].pose), 'espalda');
  await pagina.evaluate(async () => Almacen.escribir([{ almacen: 'borradores', put: { id: 'borrador-sintetico', espacioId: Escritorio.estado.espacio.id, nombre: 'Conservar', rutina: Planificador.rutinaMovil(Escritorio.estado.raw).rutina } }]));
  const antes = await estado();
  const raw2 = structuredClone(raw); raw2.logs.push({ ...raw2.logs[0], fecha: '2026-08-10T18:00:00.000' });
  await previa(guardar('actualizacion.json', JSON.stringify(raw2)), '#inputDatos');
  await pagina.check('[name="destino"][value="actualizar"]');
  // Provoca ConstraintError ASÍNCRONO real en la última operación (la
  // importación anterior ya tiene id). No usa simularFalloEscritura.
  await pagina.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    const id = Escritorio.estado.importaciones[0].id;
    window.restaurarPut = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function(v){ return this.name === 'importaciones' ? this.add({ ...v, id }) : put.call(this, v); };
  });
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'No se pudo guardar', exact: true }).waitFor();
  await foto('35-error-atomico.png');
  await pagina.evaluate(() => window.restaurarPut());
  assert.deepEqual(await estado(), antes);
  await pagina.click('#modalCaja [data-accion="cerrar"]');
  ok('error asíncrono real: rollback íntegro de ocho almacenes, borrador y bytes de fotos incluidos');
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  assert.deepEqual(await estado(), antes);
  await ctx.close(); await abrir();
  assert.deepEqual(await estado(), antes);
  ok('recarga y cierre/reapertura del proceso Chromium conservan exactamente el estado anterior');
  await previa(guardar('actualizacion.json', JSON.stringify(raw2)), '#inputDatos');
  await pagina.check('[name="destino"][value="actualizar"]'); await confirmar();
  assert.equal((await estado()).borradores.length, 1);
  assert.equal(await pagina.evaluate(() => Escritorio.estado.raw.logs.length), raw2.logs.length);
  ok('reintento tras fallo guarda la instantánea nueva y preserva el borrador');

  // Accesibilidad y captura con datos sintéticos, también en ventana estrecha.
  if (process.env.AXE_MODULE){
    const axe = fs.readFileSync(require.resolve(process.env.AXE_MODULE), 'utf8');
    for (const ancho of [1366, 420]){
      await pagina.setViewportSize({ width: ancho, height: 900 });
      for (const seccion of ['resumen', 'entrenamiento', 'fisica', 'recuperacion', 'rutina', 'informes', 'datos']){
        await pagina.evaluate(s => { location.hash = '#' + s; }, seccion);
        await pagina.waitForFunction(s => Escritorio.estado.seccion === s, seccion);
        // Herramienta de auditoría en DevTools, sin relajar la CSP de la app.
        await pagina.evaluate(axe);
        const a = await pagina.evaluate(() => axe.run({ exclude: [] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
        assert.deepEqual(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], `${seccion} ${ancho}px`);
        const dimensiones = await pagina.evaluate(() => ({ ancho: innerWidth, documento: document.documentElement.scrollWidth,
          fuera: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2 && (!e.closest('.tabla-scroll, #tabs') || getComputedStyle(e).position === 'absolute')).slice(0, 20).map(e => [e.tagName, e.id, e.className, e.getBoundingClientRect().right]) }));
        assert.ok(dimensiones.documento <= dimensiones.ancho + 2, `${seccion} ${JSON.stringify(dimensiones)}`);
        if (seccion === 'resumen') await foto(`36-resumen-${ancho}.png`);
      }
    }
    ok('axe WCAG 2.1 A/AA: siete secciones a 1366 y 420 px sin infracciones ni desbordamiento');
  } else console.log('# OMITIDO axe: define AXE_MODULE para validar accesibilidad');

  await pagina.waitForFunction(() => !!navigator.serviceWorker.controller);
  await pagina.evaluate(async () => { await caches.open('tlcoach-ajena'); await caches.open('otra-ajena'); });
  const antesSW = await estado();
  version = 'v5-validacion';
  await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await pagina.waitForFunction(async () => (await caches.keys()).includes('tlescritorio-v5-validacion') && !(await caches.keys()).includes('tlescritorio-v5'));
  assert.ok((await pagina.evaluate(() => caches.keys())).includes('tlcoach-ajena'));
  assert.ok((await pagina.evaluate(() => caches.keys())).includes('otra-ajena'));
  assert.deepEqual(await estado(), antesSW);
  ok('actualizar service worker renueva su caché sin borrar cachés ajenas ni IndexedDB');
  falloServidor = true;
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  assert.deepEqual(await estado(), antesSW);
  ok('HTTP 503: la copia de caché mantiene utilizable el escritorio y los datos');
  await ctx.setOffline(true);
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  assert.deepEqual(await estado(), antesSW);
  ok('sin conexión tras actualizar: reapertura con datos, fotos y borrador intactos');
  await ctx.close(); ctx = null;
  falloServidor = false;

  // Fallo de apertura: modo temporal explícito, sin tocar el perfil persistente.
  const b = await pw.chromium.launch();
  try {
    const c = await b.newContext(); observar(c);
    await c.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get(){ throw new DOMException('Acceso bloqueado', 'SecurityError'); } }));
    const p = await c.newPage(); await p.goto(origen + '/escritorio/');
    await p.waitForSelector('html[data-listo="1"]');
    await p.getByText('Modo temporal', { exact: true }).waitFor();
    assert.equal(await p.evaluate(() => Almacen.modo), 'temporal');
    ok('fallo de acceso a IndexedDB: aviso explícito y modo temporal recuperable');
  } finally { await b.close(); }
  assert.deepEqual(peticiones.filter(r => !r.url.startsWith(origen + '/') && !/^(blob:|data:)/.test(r.url)), []);
  assert.deepEqual(peticiones.filter(r => r.method !== 'GET' || r.data), []);
  assert.deepEqual(errores, []);
  ok('cero solicitudes externas, cero envíos de datos y cero errores JavaScript');
  console.log(`# ${paso} comprobaciones integrales superadas`);
} catch (e){
  console.error('not ok -', e); process.exitCode = 1;
  if (capturas && pagina && !pagina.isClosed()) await foto('fallo-integral.png').catch(() => {});
} finally {
  if (ctx) await ctx.close();
  servidor.closeAllConnections(); await new Promise(r => servidor.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
}
