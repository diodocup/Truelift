// Prueba de extremo a extremo del escritorio en Chromium (Playwright).
// Datos 100 % sintéticos. Uso:
//   node escritorio/tests/e2e.mjs [carpetaCapturas]
// Requiere el paquete `playwright` (no es dependencia del repositorio): se
// busca en node_modules o en PLAYWRIGHT_MODULE.
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

const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'tl-e2e-'));
const escribir = (nombre, datos) => { const p = path.join(tmp, nombre); fs.writeFileSync(p, datos); return p; };

const navegador = await pw.chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
const pagina = await ctx.newPage();
const externas = [], erroresJs = [];
pagina.on('request', r => { if (!r.url().startsWith(origen) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) externas.push(r.url()); });
pagina.on('pageerror', e => erroresJs.push(String(e)));
pagina.on('console', m => { if (m.type() === 'error') erroresJs.push(m.text()); });

let paso = 0;
const ok = msg => console.log(`ok ${++paso} - ${msg}`);
const foto = async n => capturas && pagina.screenshot({ path: path.join(capturas, n), fullPage: true });

try {
  // La cartera del Coach del mismo origen no debe tocarse.
  await pagina.goto(`${origen}/coach/`);
  await pagina.evaluate(() => localStorage.setItem('tlcoach_clientes', JSON.stringify({ clientes: [{ id: 'x', nombre: 'Ficticio', notas: '', fechaImportacion: '2026-08-01T10:00:00.000Z', datos: { sexo: 'hombre', dias: '3', logs: [] } }], clienteActivoId: 'x' })));
  const carteraAntes = await pagina.evaluate(() => localStorage.getItem('tlcoach_clientes'));

  await pagina.goto(`${origen}/escritorio/`);
  await pagina.waitForSelector('html[data-listo="1"]');
  await pagina.getByText('Tu entrenamiento, en grande').waitFor();
  ok('estado vacío con instrucciones');
  await foto('01-vacio.png');

  // JPEG reales y sintéticos (cuatro colores) generados en el navegador.
  const jpegs = await pagina.evaluate(async () => {
    const out = [];
    for (const color of ['#a8ee19', '#6FA8DC', '#E0A92E', '#D678A6', '#5FC6BE']){
      const c = document.createElement('canvas'); c.width = 300; c.height = 400;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 300, 400);
      g.fillStyle = '#0A0C0B'; g.beginPath(); g.ellipse(150, 120, 45, 55, 0, 0, 7); g.fill(); g.fillRect(95, 180, 110, 200);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      out.push(Array.from(new Uint8Array(await b.arrayBuffer())));
    }
    return out;
  });
  const img = jpegs.map(a => new Uint8Array(a));

  // Copia A: una foto corregida en el móvil (nombre «20260801_frente» pero
  // es de perfil y del 25 de julio) y otra cuyo archivo no se importará.
  const fotosIdx = [
    { fecha: '2026-07-25', pose: 'perfil', archivo: 'foto_20260801_frente.jpg', pesoKg: 79.2 },
    { fecha: '2026-08-01', pose: 'espalda', archivo: 'foto_20260801_espalda.jpg', pesoKg: 79 },
  ];
  const copiaA = copiaSintetica({ dias: 4, fotos: fotosIdx });
  const copiaB = copiaSintetica({ dias: 6, fotos: fotosIdx });
  const otra = copiaSintetica({ dias: 3, desde: '2025-03-03', medidas: false });
  otra.fechaNacimiento = '1984-11-11';
  const pA = escribir('copia_truelift_2026-08-12.json', JSON.stringify(copiaA));
  const pB = escribir('copia_truelift_2026-08-20.json', JSON.stringify(copiaB));
  const pOtra = escribir('copia_truelift_2025-03-15.json', JSON.stringify(otra));
  const pRoto = escribir('roto.json', '{"logs": [ esto no es json');
  // ZIP con índice exportado ANTES de la corrección de fecha y pose.
  const zip1 = escribir('truelift_fotos_2026-08-12.zip', crearZip([
    { nombre: 'foto_20260801_frente.jpg', datos: img[0] },
    { nombre: 'foto_20260815_frente.jpg', datos: img[1] },
    { nombre: 'IMG_0001.jpg', datos: img[2] },
    { nombre: 'notas.txt', datos: 'hola' },
    { nombre: '../fuera.jpg', datos: img[2] },
    { nombre: 'medidas.json', datos: JSON.stringify({ schemaVersion: 1, registros: [],
      fotos: [{ fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg' },
              { fecha: '2026-08-15', pose: 'frente', archivo: 'foto_20260815_frente.jpg' }] }) },
  ]));
  const zipCorrupto = escribir('corrupto.zip', new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9]));

  // --- 1. JSON y ZIP juntos ---
  await pagina.setInputFiles('#inputDatos', [pA, zip1]);
  await pagina.getByText('Revisa la importación').waitFor();
  const previa = await pagina.textContent('#modalCaja');
  assert.match(previa, /4\s*sesiones de fuerza/);
  assert.match(previa, /no indica cuándo se exportó/);
  assert.match(previa, /1\s*se guardarán/);
  assert.match(previa, /1\s*no figuran en tu copia de datos/);
  assert.match(previa, /1\s*sin fecha ni pose/);
  assert.match(previa, /otra fecha o pose en el índice del ZIP/);
  assert.match(previa, /seguirá\s+sin imagen/);
  ok('vista previa conjunta: periodo, recuentos, discrepancia, fuera de copia y ausentes');
  await foto('02-previa.png');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  const galeria1 = await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.archivo, f.fecha, f.pose, f.tieneImagen, f.fuente]));
  assert.deepEqual(galeria1, [
    ['foto_20260801_frente.jpg', '2026-07-25', 'perfil', true, 'json'],
    ['foto_20260801_espalda.jpg', '2026-08-01', 'espalda', false, 'json'],
  ]);
  await pagina.waitForFunction(() => [...document.querySelectorAll('img[data-mini]')].every(i => i.complete && i.naturalWidth > 0));
  ok('la ficha corregida en el móvil manda sobre el ZIP y el nombre; la foto ausente queda pendiente');
  await foto('03-mis-datos.png');

  // --- 2. Recarga: persiste ---
  await pagina.reload();
  await pagina.waitForSelector('html[data-listo="1"]');
  const tras = await pagina.evaluate(() => ({ s: Escritorio.estado.inst.resumen.sesionesFuerza, f: Escritorio.estado.fotosMeta.length }));
  assert.deepEqual(tras, { s: 4, f: 1 });
  ok('cerrar y reabrir conserva datos y fotos');

  // --- 3. Reimportar la misma copia y el mismo ZIP: nada que guardar ---
  await pagina.setInputFiles('#inputDatos', [pA]);
  await pagina.getByText('idéntica a la que ya tienes').waitFor();
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.keyboard.press('Escape');
  await pagina.setInputFiles('#inputFotos', [zip1]);
  await pagina.getByText('Revisa la importación').waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /1\s*ya estaban \(no se duplican\)/);
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.click('[data-accion="descartar"]');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.fotosMeta.length), 1);
  ok('copia idéntica y ZIP repetido se detectan y no duplican');

  // --- 4. Actualización: decisión explícita ---
  await pagina.setInputFiles('#inputDatos', [pB]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /2 sesiones nuevas/);
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.check('input[name="destino"][value="actualizar"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.inst.resumen.sesionesFuerza), 6);
  assert.equal(await pagina.evaluate(() => Escritorio.estado.fotosMeta.length), 1);
  ok('actualizar sustituye la instantánea sin tocar las fotos');

  // --- 5. Retroceso a una copia antigua ---
  await pagina.setInputFiles('#inputDatos', [pA]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  await pagina.check('input[name="destino"][value="actualizar"]');
  await pagina.getByText('Copia más antigua', { exact: true }).waitFor();
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await foto('04-retroceso.png');
  await pagina.check('input[data-op="retroceso"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.inst.resumen.sesionesFuerza), 4);
  await pagina.click('[data-accion="volver-anterior"]');
  await pagina.click('[data-accion="confirmar-anterior"]');
  await pagina.waitForFunction(() => Escritorio.estado.inst && Escritorio.estado.inst.resumen.sesionesFuerza === 6);
  ok('retroceso avisado y confirmado; se puede volver a la copia anterior');

  // --- 6. Fallo de cuota a mitad de escritura: nada cambia ---
  const zipConflicto = escribir('truelift_fotos_2026-08-20.zip', crearZip([
    { nombre: 'foto_20260801_frente.jpg', datos: img[3] },   // mismo nombre, otra imagen
    { nombre: 'foto_20260801_espalda.jpg', datos: img[4] },  // la que faltaba
  ]));
  const antes = await pagina.evaluate(async () => ({
    fotos: (await Almacen.todos('fotos')).map(f => f.archivo + ':' + f.sha256).sort().join(),
    imagenes: (await Almacen.todos('imagenes')).length }));
  await pagina.setInputFiles('#inputFotos', [zipConflicto]);
  await pagina.getByText('mismo nombre, imagen distinta').waitFor();
  await pagina.check('input[data-op="sustituir"]');
  await pagina.evaluate(() => Almacen.simularFalloEscritura('QuotaExceededError'));
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('No hay espacio suficiente').waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /No se ha guardado nada/);
  await foto('05-cuota.png');
  await pagina.click('[data-accion="cerrar"]');
  const despues = await pagina.evaluate(async () => ({
    fotos: (await Almacen.todos('fotos')).map(f => f.archivo + ':' + f.sha256).sort().join(),
    imagenes: (await Almacen.todos('imagenes')).length }));
  assert.deepEqual(despues, antes);
  ok('error de cuota durante la escritura: transacción abortada sin pérdida ni cambios parciales');

  // --- 7. Reintento: conflicto resuelto de forma explícita ---
  await pagina.setInputFiles('#inputFotos', [zipConflicto]);
  await pagina.getByText('mismo nombre, imagen distinta').waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /1\s*se guardarán/);
  await pagina.check('input[data-op="sustituir"]');
  assert.match(await pagina.textContent('#modalCaja'), /2\s*se guardarán/);
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  const g2 = await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.archivo, f.tieneImagen]));
  assert.deepEqual(g2, [['foto_20260801_frente.jpg', true], ['foto_20260801_espalda.jpg', true]]);
  ok('conflicto de nombre solo se sustituye con elección explícita; la foto pendiente se completa');

  // --- 8. Otra persona: espacio nuevo, sin mezclar fotos ---
  await pagina.setInputFiles('#inputDatos', [pOtra]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /no coinciden con tus datos actuales/);
  await pagina.check('input[name="destino"][value="nuevo"]');
  await pagina.fill('#nombreNuevo', 'Prueba');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  const nuevo = await pagina.evaluate(() => ({ n: Escritorio.estado.espacios.length, nom: Escritorio.estado.espacio.nombre,
    fotos: Escritorio.estado.fotosMeta.length, s: Escritorio.estado.inst.resumen.sesionesFuerza }));
  assert.deepEqual(nuevo, { n: 2, nom: 'Prueba', fotos: 0, s: 3 });
  ok('espacio personal nuevo: datos separados y sin fotos ajenas');

  // --- 9. ZIP antiguo sin índice sobre una copia sin bloque de medidas ---
  const zipViejo = escribir('fotos_antiguas.zip', crearZip([
    { nombre: 'foto_20250310_frente.jpg', datos: img[1], metodo: 0 },
    { nombre: 'IMG_7.jpg', datos: img[2] },
  ]));
  await pagina.setInputFiles('#inputFotos', [zipViejo]);
  await pagina.getByText('no trae índice').waitFor();
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByText('Importación completada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  const g3 = await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.archivo, f.fecha, f.pose, f.fuente]));
  assert.deepEqual(g3, [['foto_20250310_frente.jpg', '2025-03-10', 'frente', 'nombre']]);
  await pagina.getByText('Deducida del nombre').first().waitFor();
  ok('ZIP sin índice: solo se adoptan nombres con el patrón de la app, marcados como deducidos');

  // --- 10. Archivos no válidos ---
  await pagina.setInputFiles('#inputDatos', [pRoto, zipCorrupto]);
  await pagina.getByText('Revisa la importación').waitFor();
  const inval = await pagina.textContent('#modalCaja');
  assert.match(inval, /no es un JSON válido/);
  assert.match(inval, /no es un ZIP válido|incompleto/);
  assert.equal(await pagina.isDisabled('[data-accion="confirmar"]'), true);
  await pagina.keyboard.press('Escape');
  assert.equal(await pagina.isHidden('#modal'), true);
  ok('JSON roto y ZIP corrupto se rechazan; Escape cierra la vista previa');

  // --- 11. Cancelación durante el procesamiento ---
  const muchos = [];
  for (let i = 0; i < 150; i++) muchos.push({ nombre: `foto_2025${String(1 + (i % 12)).padStart(2, '0')}${String(1 + (i % 28)).padStart(2, '0')}_frente_${i}.jpg`, datos: img[i % 5] });
  const zipGrande = escribir('muchas.zip', crearZip(muchos));
  const nFotosAntes = await pagina.evaluate(async () => (await Almacen.todos('fotos')).length);
  await pagina.setInputFiles('#inputFotos', [zipGrande]);
  await pagina.getByText('Preparando la importación').waitFor();
  await pagina.click('[data-accion="cancelar-proceso"]');
  await pagina.getByText('Importación cancelada').waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.equal(await pagina.evaluate(async () => (await Almacen.todos('fotos')).length), nFotosAntes);
  ok('cancelar durante el procesamiento no guarda nada');

  // --- 12. Cambio de espacio: las fotos del primero siguen ahí ---
  await pagina.selectOption('#selEspacio', { label: 'Mis datos' });
  await pagina.waitForFunction(() => Escritorio.estado.espacio.nombre === 'Mis datos');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.fotosMeta.length), 2);
  ok('cada espacio conserva sus propias fotos');

  // --- 13. Pantalla estrecha ---
  await pagina.setViewportSize({ width: 420, height: 900 });
  const desborda = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(desborda, false);
  await foto('06-estrecha.png');
  await pagina.setViewportSize({ width: 1366, height: 900 });
  ok('ventana pequeña sin desbordamiento horizontal');

  // --- 14. Borrado ---
  await pagina.click('[data-accion="borrar-espacio"]');
  await pagina.click('[data-accion="confirmar-borrar-espacio"]');
  await pagina.waitForFunction(() => Escritorio.estado.espacios.length === 1);
  assert.equal(await pagina.evaluate(async () => (await Almacen.todos('imagenes')).length), 1);
  await pagina.click('[data-accion="borrar-todo"]');
  await pagina.click('[data-accion="confirmar-borrar-todo"]');
  await pagina.getByText('Tu entrenamiento, en grande').waitFor();
  ok('borrar un espacio elimina sus imágenes; borrar todo vuelve al estado inicial');

  // --- 15. Aislamiento y privacidad ---
  assert.equal(await pagina.evaluate(() => localStorage.getItem('tlcoach_clientes')), carteraAntes);
  await pagina.goto(`${origen}/coach/`);
  await pagina.waitForSelector('#tabs');
  assert.equal(await pagina.evaluate(() => localStorage.getItem('tlcoach_clientes')), carteraAntes);
  ok('la cartera del Coach queda intacta y el Coach sigue abriendo');
  assert.deepEqual(externas, []);
  ok('ninguna petición a servicios externos');
  assert.deepEqual(erroresJs, []);
  ok('sin errores de JavaScript');
  console.log(`# ${paso} comprobaciones superadas`);
} catch (e) {
  console.error('not ok -', e);
  if (capturas) await pagina.screenshot({ path: path.join(capturas, 'fallo.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await navegador.close();
  servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
