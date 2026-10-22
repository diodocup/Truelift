// Vídeo de progreso del escritorio en Chromium (Playwright): la tarjeta de
// «Evolución física» pinta la vista previa con la marca, graba un vídeo
// corto y ofrece descargarlo. Datos 100 % sintéticos. Uso:
//   node escritorio/tests/video.e2e.mjs [carpetaCapturas]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { copiaSintetica, crearZip } from './comun.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)){
  try { pw = require(p); break; } catch (_) { /* siguiente */ }
}
if (!pw){ console.error('No se encontró Playwright. Define PLAYWRIGHT_MODULE.'); process.exit(2); }

const raiz = path.resolve(new URL('../../', import.meta.url).pathname);
const capturas = process.argv[2] || null;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
                '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const servidor = http.createServer((req, res) => {
  let f = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(raiz)){ res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)){ res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const origen = `http://127.0.0.1:${servidor.address().port}`;
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'tl-video-'));
const escribir = (nombre, datos) => { const p = path.join(tmp, nombre); fs.writeFileSync(p, datos); return p; };

const navegador = await pw.chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const externas = [], erroresJs = [];
ctx.on('request', r => { if (!r.url().startsWith(origen + '/') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) externas.push(r.url()); });
const pagina = await ctx.newPage();
pagina.on('pageerror', e => erroresJs.push(String(e)));
pagina.on('console', m => { if (m.type() === 'error') erroresJs.push(m.text()); });
let paso = 0;
const ok = msg => console.log(`ok ${++paso} - ${msg}`);

try {
  await pagina.goto(`${origen}/escritorio/`);
  await pagina.waitForSelector('html[data-listo="1"]');
  // Tres fotos de frente (colores distintos) y una encuadrada en la app.
  const jpegs = await pagina.evaluate(async () => {
    const out = [];
    for (const color of ['#6FA8DC', '#E0A92E', '#D678A6']){
      const c = document.createElement('canvas'); c.width = 300; c.height = 400;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 300, 400);
      g.fillStyle = '#0A0C0B'; g.beginPath(); g.ellipse(150, 120, 45, 55, 0, 0, 7); g.fill(); g.fillRect(95, 180, 110, 200);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      out.push(Array.from(new Uint8Array(await b.arrayBuffer())));
    }
    return out;
  });
  const fotos = [
    { fecha: '2026-06-01', pose: 'frente', archivo: 'foto_20260601_frente.jpg', pesoKg: 80 },
    { fecha: '2026-07-01', pose: 'frente', archivo: 'foto_20260701_frente.jpg', pesoKg: 79, ajuste: { escala: 1.2, dx: 0.05, dy: 0, giro: 0.1, origen: 'manual' } },
    { fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg', pesoKg: 77.9 },
  ];
  const copia = escribir('copia_truelift_2026-08-12.json', JSON.stringify(copiaSintetica({ dias: 4, fotos })));
  const zip = escribir('truelift_fotos_2026-08-12.zip', crearZip(fotos.map((f, i) => ({ nombre: f.archivo, datos: new Uint8Array(jpegs[i]) }))));
  await pagina.setInputFiles('#inputDatos', [copia, zip]);
  await pagina.getByText('Revisa la importación').waitFor();
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  await pagina.click('#tabs [data-seccion="fisica"]');
  await pagina.waitForSelector('#videoProgreso');
  const texto = await pagina.textContent('#videoProgreso');
  assert.match(texto, /Fotos · 3 de 3/);
  assert.match(texto, /Dura 7 s/);
  ok('la tarjeta del vídeo aparece con las tres fotos de frente');

  // Vista previa: el primer fotograma, con la foto y la marca pintadas.
  await pagina.waitForFunction(() => {
    const c = document.querySelector('#videoLienzo');
    // Esquina de la foto (fuera de la silueta oscura): el azul de la primera.
    const d = c.getContext('2d').getImageData(60, 60, 1, 1).data;
    return d[2] > 150;
  });
  const marca = await pagina.evaluate(() => {
    const c = document.querySelector('#videoLienzo'), g = c.getContext('2d');
    // Zona de la marca (abajo a la derecha): hay lima.
    const d = g.getImageData(470, 880, 230, 50).data;
    let lima = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 180 && d[i] > 120 && d[i] < 200 && d[i + 2] < 90) lima++;
    return lima;
  });
  assert.ok(marca > 50, `píxeles lima en la marca: ${marca}`);
  ok('la vista previa pinta la primera foto y la marca TRUELIFT');
  if (capturas){
    fs.mkdirSync(capturas, { recursive: true });
    await pagina.locator('#videoProgreso').screenshot({ path: path.join(capturas, 'video-tarjeta.png') });
    const png = await pagina.evaluate(() => document.querySelector('#videoLienzo').toDataURL('image/png'));
    fs.writeFileSync(path.join(capturas, 'video-fotograma.png'), Buffer.from(png.split(',')[1], 'base64'));
  }

  // Quitar una foto renumera; volver a ponerla.
  await pagina.locator('[data-video-foto="foto_20260701_frente.jpg"]').uncheck();
  await pagina.getByText('Fotos · 2 de 3').waitFor();
  await pagina.locator('[data-video-foto="foto_20260701_frente.jpg"]').check();
  await pagina.getByText('Fotos · 3 de 3').waitFor();
  ok('quitar y volver a poner una foto');

  // Tiempos mínimos para que la grabación sea corta: 3·0,4 + 2·0,2 = 1,6 s.
  for (const [id, v] of [['#videoFoto', '0.4'], ['#videoTransicion', '0.2']]){
    await pagina.locator(id).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  }
  assert.match(await pagina.textContent('#videoDuracion'), /Dura 2 s/);
  await pagina.click('[data-accion="video-grabar"]');
  await pagina.getByText(/Grabando…/).waitFor();
  ok('al grabar enseña el tiempo y deja cancelar');
  await pagina.waitForSelector('#videoDescargar', { timeout: 20000 });
  // La página no deja hacer fetch de un blob: (CSP connect-src 'self'): el
  // vídeo se comprueba descargándolo, como haría el usuario.
  const [d] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#videoDescargar')]);
  const nombre = d.suggestedFilename();
  const destino = path.join(capturas || tmp, nombre);
  await d.saveAs(destino);
  const bytes = fs.readFileSync(destino);
  assert.match(nombre, /^truelift_progreso_\d{4}-\d{2}-\d{2}\.(mp4|webm)$/);
  // MP4: caja «ftyp» al principio; WebM: cabecera EBML.
  const esMp4 = bytes.subarray(4, 8).toString('latin1') === 'ftyp';
  const esWebm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  assert.ok(nombre.endsWith('.mp4') ? esMp4 : esWebm, 'cabecera del contenedor');
  assert.ok(bytes.length > 1000, `tamaño ${bytes.length}`);
  ok(`vídeo grabado y descargado (${nombre}, ${bytes.length} bytes)`);

  assert.deepEqual(externas, []);
  ok('ninguna petición a servicios externos');
  assert.deepEqual(erroresJs, []);
  ok('sin errores de JavaScript');
  console.log(`# ${paso} comprobaciones superadas`);
} finally {
  await navegador.close();
  servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
