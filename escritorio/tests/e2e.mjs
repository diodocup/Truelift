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
import { copiaSintetica, copiaRica, copiaFase3, crearZip } from './comun.mjs';

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
const origenesPrueba = new Set([origen]);

const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'tl-e2e-'));
const escribir = (nombre, datos) => { const p = path.join(tmp, nombre); fs.writeFileSync(p, datos); return p; };

const navegador = await pw.chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
const externas = [], erroresJs = [];
ctx.on('request', r => { if (![...origenesPrueba].some(o => r.url().startsWith(o + '/')) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) externas.push(r.url()); });
ctx.on('page', p => {
  p.on('pageerror', e => erroresJs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') erroresJs.push(m.text()); });
});
let pagina = await ctx.newPage();

let paso = 0;
const ok = msg => console.log(`ok ${++paso} - ${msg}`);
const foto = async n => {
  if (!capturas) return;
  await pagina.evaluate(() => scrollTo(0, 0));
  if (/^2[2-4]-/.test(n)) await pagina.locator('#comparadorFotos').screenshot({ path: path.join(capturas, n) });
  else await pagina.screenshot({ path: path.join(capturas, n), fullPage: true });
};

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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  const galeria1 = await pagina.evaluate(() => Escritorio.estado.galeria.map(f => [f.archivo, f.fecha, f.pose, f.tieneImagen, f.fuente]));
  assert.deepEqual(galeria1, [
    ['foto_20260801_frente.jpg', '2026-07-25', 'perfil', true, 'json'],
    ['foto_20260801_espalda.jpg', '2026-08-01', 'espalda', false, 'json'],
  ]);
  await foto('03-mis-datos.png');
  await pagina.click('#tabs [data-seccion="fisica"]');
  await pagina.waitForSelector('img[data-mini]', { state: 'attached' });
  await pagina.locator('.galeria').last().scrollIntoViewIfNeeded();
  await pagina.waitForFunction(() => { const i = [...document.querySelectorAll('img[data-mini]')]; return i.length > 0 && i.every(x => x.complete && x.naturalWidth > 0); });
  await pagina.getByText('Imagen no importada').first().waitFor();
  ok('la ficha corregida en el móvil manda sobre el ZIP y el nombre; la foto ausente queda pendiente');
  await pagina.click('#tabs [data-seccion="datos"]');

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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
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
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
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
  await pagina.locator('#modalCaja').getByText('Importación cancelada').waitFor();
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

  // --- Fase 2: recorrido personal con una copia rica ---
  const pR = escribir('copia_truelift_2026-07-02.json', JSON.stringify(copiaRica()));
  await pagina.setInputFiles('#inputDatos', [pR]);
  await pagina.getByText('Revisa la importación').waitFor();
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  await pagina.click('#tabs [data-seccion="resumen"]');
  await pagina.getByText('Rendimiento irregular').waitFor();
  const res = await pagina.textContent('#contenido');
  assert.match(res, /Tus datos llegan hasta el\s*2 jul 2026/);
  assert.match(res, /Tus últimas 4 sesiones alternan días buenos y flojos/);
  assert.doesNotMatch(res, /cliente|entrenador|cartera/i);
  assert.equal(await pagina.title(), 'Mi resumen · TrueLift Escritorio');
  await foto('07-resumen.png');
  ok('mi resumen: valoración igual que la app, antigüedad de los datos y sin lenguaje del Coach');

  await pagina.keyboard.press('Alt+2');
  await pagina.waitForFunction(() => location.hash === '#entrenamiento');
  await pagina.getByRole('button', { name: 'Ejercicios', exact: true }).click();
  await pagina.getByText('En tu rutina actual').waitFor();
  await foto('08-ejercicios.png');
  await pagina.getByRole('button', { name: 'Sentadilla con barra' }).first().click();
  await pagina.getByText('Buscando el objetivo (3 de 4 intentos)').first().waitFor();
  assert.match(await pagina.textContent('#contenido'), /1RM estimado/);
  await foto('09-ficha.png');
  await pagina.goBack();
  await pagina.getByText('En tu rutina actual').waitFor();
  ok('teclado (Alt+2), ficha de ejercicio con el estado del móvil y Atrás del navegador');

  await pagina.getByRole('button', { name: 'Sesiones', exact: true }).click();
  await pagina.getByRole('button', { name: '17 jun 2026' }).click();
  await pagina.getByText('Rodilla <b>molesta</b>').waitFor();
  assert.equal(await pagina.locator('#modalCaja b:text-is("molesta")').count(), 0);
  await foto('10-sesion.png');
  await pagina.keyboard.press('Escape');
  ok('detalle de sesión de solo lectura; las notas importadas se muestran como texto');

  for (const [sec, texto] of [['fisica', 'Contornos (cm)'], ['recuperacion', 'Estado para entrenar'], ['rutina', 'Series planificadas por semana'], ['informes', 'Preparar el informe']]){
    await pagina.click(`#tabs [data-seccion="${sec}"]`);
    await pagina.getByText(texto).first().waitFor();
    await foto(`11-${sec}.png`);
  }
  for (const sub of ['rendimiento', 'volumen']){
    await pagina.evaluate(s => { location.hash = `#entrenamiento/${s}`; }, sub);
    await pagina.waitForSelector('.subnav button.activa');
    await foto(`12-${sub}.png`);
  }
  // Todo lo que se puede pulsar en las secciones es un botón (alcanzable con teclado).
  const noBotones = await pagina.evaluate(() => [...document.querySelectorAll('[data-ir],[data-sesion],[data-ejercicio],[data-ver]')].filter(el => el.tagName !== 'BUTTON').length);
  assert.equal(noBotones, 0);
  ok('evolución física, recuperación, rutina, informes, rendimiento y volumen se muestran');

  await pagina.reload();
  await pagina.waitForSelector('html[data-listo="1"]');
  assert.equal(await pagina.evaluate(() => location.hash), '#entrenamiento/volumen');
  await pagina.waitForSelector('.subnav button.activa');
  ok('la recarga vuelve a la misma sección');

  await pagina.setViewportSize({ width: 420, height: 900 });
  for (const h of ['#resumen', '#entrenamiento/sesiones', '#entrenamiento/ejercicios/Sentadilla%20con%20barra', '#fisica', '#recuperacion', '#rutina']){
    await pagina.evaluate(x => { location.hash = x; }, h);
    await pagina.waitForTimeout(80);
    const anchoCuerpo = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(anchoCuerpo, false, `desborda en ${h}`);
  }
  await foto('13-estrecha-ficha.png');
  await pagina.setViewportSize({ width: 1366, height: 900 });
  ok('secciones personales sin desbordamiento horizontal en ventana estrecha');

  // --- Fase 3: del resumen a los registros que justifican cada conclusión ---
  const raw3 = copiaFase3();
  raw3.medidas = { registros: [{ fecha: '2026-08-15', sitio: 'cintura', cm: 83 }, { fecha: '2026-09-15', sitio: 'cintura', cm: 82 }] };
  raw3.nutricion.fasesCerradas = [{ id: 'fase-a', tipo: 'MAINTENANCE', inicio: '2026-08-01', fin: '2026-08-31' }];
  raw3.nutricion.faseActual = { id: 'fase-b', tipo: 'DEFICIT', inicio: '2026-09-01' };
  raw3.nutricion.recomendaciones = [{ fecha: '2026-09-15', faseId: 'fase-b', tipo: 'HOLD', tasaRealPctSemana: -0.2, ajusteKcalDia: 0 }];
  raw3.readinessDiario.forEach(r => { r.vfc = 60; r.fcReposo = 50; });
  const p3 = escribir('copia_truelift_2026-10-09.json', JSON.stringify(raw3));
  await pagina.setInputFiles('#inputDatos', [p3]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  await pagina.check('input[name="destino"][value="nuevo"]');
  await pagina.fill('#nombreNuevo', 'Fase 3');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  await pagina.evaluate(() => { location.hash = '#resumen'; });
  await pagina.getByText('Lo más relevante').waitFor();
  assert.equal(await pagina.locator('article.conclusion').count(), 3);
  const titulos = await pagina.locator('article.conclusion h3').allTextContents();
  assert.deepEqual(titulos, ['Intentos agotados en Press banca con barra', 'Muchos días con el estado para entrenar bajo', 'Entrenaste 11 de 12 días previstos']);
  await pagina.getByText('Constancia', { exact: true }).waitFor();
  await pagina.getByText('Evolución de tus ejercicios').waitFor();
  await pagina.getByText('Peso y fase').waitFor();
  await foto('14-resumen-conclusiones.png');
  const primera = pagina.locator('article.conclusion').first();
  await primera.locator('summary', { hasText: 'Datos que la respaldan' }).click();
  await primera.locator('summary', { hasText: 'Limitaciones' }).click();
  await foto('15-conclusion-datos.png');
  // Una fecha de los datos abre la sesión completa (solo lectura).
  await primera.locator('button[data-sesion]').last().click();
  await pagina.locator('#modalCaja').getByText('Press banca con barra').first().waitFor();
  assert.match(await pagina.textContent('#modalCaja'), /Día A/);
  await pagina.keyboard.press('Escape');
  // El enlace lleva a la ficha, con el porqué del estado.
  await primera.getByRole('button', { name: 'Ver la ficha del ejercicio' }).click();
  await pagina.waitForFunction(() => location.hash === '#entrenamiento/ejercicios/Press%20banca%20con%20barra');
  await pagina.getByText('Intentos agotados', { exact: true }).first().waitFor();
  await pagina.locator('summary', { hasText: 'Por qué este estado' }).click();
  assert.equal(await pagina.locator('text=Cuenta como intento').count(), 5);
  for (const t of ['Tus últimas semanas', 'Mejores marcas', 'Comparar dos sesiones']) await pagina.getByText(t, { exact: true }).waitFor();
  await foto('16-ficha-porque.png');
  ok('mi resumen: tres conclusiones priorizadas que llevan a sus datos, a la sesión y a la ficha');

  // Comparación de dos sesiones: se elige con el teclado y el foco no se pierde.
  const opciones = await pagina.locator('#compA option').evaluateAll(os => os.map(o => o.value));
  await pagina.selectOption('#compA', opciones[opciones.length - 1]);
  await pagina.waitForFunction(() => document.activeElement && document.activeElement.id === 'compA');
  const tablaComp = await pagina.locator('.card', { hasText: 'Comparar dos sesiones' }).textContent();
  assert.match(tablaComp, /rutinas distintas/);
  assert.match(tablaComp, /Serie 1/);
  await pagina.locator('.card', { hasText: 'Comparar dos sesiones' }).scrollIntoViewIfNeeded();
  await foto('17-ficha-comparar.png');
  // Cambiar de ejercicio reinicia la comparación.
  await pagina.evaluate(() => { location.hash = '#entrenamiento/ejercicios/Sentadilla%20con%20barra'; });
  await pagina.getByText('primera referencia').first().waitFor();
  assert.equal(await pagina.evaluate(() => Escritorio.estado.st.compA), null);
  await pagina.getByText('Al alza', { exact: true }).first().waitFor();
  ok('ficha: comparación de dos sesiones con avisos de compatibilidad, marcas y evolución reciente');

  await pagina.setViewportSize({ width: 420, height: 900 });
  for (const h of ['#resumen', '#entrenamiento/ejercicios/Press%20banca%20con%20barra']){
    await pagina.evaluate(x => { location.hash = x; }, h);
    await pagina.waitForTimeout(80);
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `desborda en ${h}`);
  }
  await foto('18-estrecha-resumen.png');
  await pagina.setViewportSize({ width: 1366, height: 900 });
  const noBotones3 = await pagina.evaluate(() => [...document.querySelectorAll('[data-ir],[data-sesion],[data-ejercicio]')].filter(el => el.tagName !== 'BUTTON').length);
  assert.equal(noBotones3, 0);
  ok('resumen y ficha sin desbordamiento en ventana estrecha y todo lo pulsable es un botón');

  // --- Fase 4: periodos desiguales, parciales y persistencia independiente ---
  await pagina.evaluate(() => { location.hash = '#entrenamiento/comparar'; });
  await pagina.getByRole('heading', { name: 'Comparar periodos', exact: true }).waitFor();
  const seleccionarPeriodos = async (aDesde, aHasta, bDesde, bHasta) => {
    for (const [id, valor] of Object.entries({ 'a-desde': aDesde, 'a-hasta': aHasta, 'b-desde': bDesde, 'b-hasta': bHasta }))
      await pagina.fill(`#periodo-${id}`, valor);
    await pagina.getByRole('button', { name: 'Comparar', exact: true }).click();
  };
  await seleccionarPeriodos('2026-08-10', '2026-08-30', '2026-09-07', '2026-10-04');
  await pagina.getByText('Los periodos duran distinto.', { exact: false }).waitFor();
  await pagina.waitForFunction(() => document.activeElement?.matches('#compararPeriodos button[type="submit"]'));
  assert.match(await pagina.textContent('#contenido'), /21 días/);
  assert.match(await pagina.textContent('#contenido'), /28 días/);
  for (const h of ['Ejercicios comunes · 1RM estimado', 'Series realizadas por grupo muscular', 'Contexto nutricional', 'Recuperación registrada'])
    await pagina.getByRole('heading', { name: h, exact: true }).waitFor();
  await foto('19-periodos-desiguales.png');
  const fechas4 = await pagina.evaluate(() => Escritorio.estado.st.periodos);
  await pagina.reload();
  await pagina.waitForSelector('html[data-listo="1"]');
  assert.equal(await pagina.inputValue('#periodo-a-desde'), fechas4.a.desde);
  assert.equal(await pagina.inputValue('#periodo-b-hasta'), fechas4.b.hasta);
  ok('comparador: periodos desiguales, contexto y muestras; recarga conserva fechas y foco');

  await pagina.locator('summary', { hasText: 'Ver semanas y sesiones de origen' }).click();
  await pagina.locator('#contenido [data-sesion]').first().click();
  await pagina.locator('#modalCaja').getByText('Press banca con barra').first().waitFor();
  await pagina.keyboard.press('Escape');
  await pagina.locator('#contenido [data-ejercicio]').first().click();
  await pagina.getByText('Comparar dos sesiones', { exact: true }).waitFor();
  await pagina.goBack();
  await pagina.getByRole('heading', { name: 'Comparar periodos', exact: true }).waitFor();
  ok('comparador: sesiones de origen, ficha de ejercicio y Atrás accesibles');

  // Inversión rechazada sin cambiar la selección persistida.
  await seleccionarPeriodos('2026-08-30', '2026-08-10', '2026-09-07', '2026-10-04');
  await pagina.getByText('Revisa los periodos', { exact: true }).waitFor();
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.st.periodos), fechas4);
  await pagina.keyboard.press('Escape');
  // Fallo de escritura: el historial y las fechas anteriores permanecen.
  await pagina.evaluate(() => Almacen.simularFalloEscritura('QuotaExceededError'));
  await seleccionarPeriodos('2026-09-07', '2026-09-09', '2026-09-07', '2026-10-04');
  await pagina.getByText('No se pudo guardar', { exact: true }).waitFor();
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.st.periodos), fechas4);
  await pagina.keyboard.press('Escape');
  await seleccionarPeriodos('2026-09-07', '2026-09-09', '2026-09-07', '2026-10-04');
  await pagina.getByText('Faltan semanas completas', { exact: false }).waitFor();
  await pagina.getByText('Los periodos se solapan', { exact: false }).waitFor();
  await foto('20-periodos-parciales.png');
  ok('comparador: fechas invertidas y fallo de cuota preservan selección; parcial y solapamiento explícitos');

  await pagina.setViewportSize({ width: 420, height: 900 });
  assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  await foto('21-periodos-estrecha.png');
  await pagina.setViewportSize({ width: 1366, height: 900 });
  // Las fechas son independientes por espacio.
  await pagina.evaluate(() => { location.hash = '#datos'; });
  const idFase3 = await pagina.evaluate(() => Escritorio.estado.espacio.id);
  const otraOpcion = await pagina.locator('#selEspacio option').evaluateAll(os => os.find(o => o.textContent === 'Mis datos')?.value);
  await pagina.selectOption('#selEspacio', otraOpcion);
  await pagina.waitForFunction(id => Escritorio.estado.espacio.id !== id, idFase3);
  await pagina.evaluate(() => { location.hash = '#entrenamiento/comparar'; });
  await pagina.getByRole('heading', { name: 'Comparar periodos', exact: true }).waitFor();
  assert.equal(await pagina.evaluate(() => Escritorio.estado.st.periodos), null);
  await pagina.evaluate(() => { location.hash = '#datos'; });
  await pagina.selectOption('#selEspacio', idFase3);
  await pagina.waitForFunction(id => Escritorio.estado.espacio.id === id, idFase3);
  await pagina.evaluate(() => { location.hash = '#entrenamiento/comparar'; });
  await pagina.getByRole('heading', { name: 'Comparar periodos', exact: true }).waitFor();
  // cargarEstado cambia de espacio antes de leer sus fechas: se espera al
  // valor guardado en lugar de leer el primer repintado.
  await pagina.waitForFunction(() => document.querySelector('#periodo-a-hasta')?.value === '2026-09-09');
  await pagina.getByRole('button', { name: 'Últimas 4 semanas completas frente a las 4 anteriores' }).click();
  await pagina.waitForFunction(() => document.querySelector('#periodo-a-hasta').value === '2026-09-06');
  ok('comparador: 420 px sin desbordamiento, fechas separadas por espacio y restauración de selección');

  const fechasAntesActualizar = await pagina.evaluate(() => Escritorio.estado.st.periodos);
  const actualizada4 = structuredClone(raw3);
  actualizada4.logs.push({ ...structuredClone(raw3.logs.at(-1)), fecha: '2026-10-10T18:00:00.000' });
  const p4 = escribir('actualizada-fase4.json', JSON.stringify(actualizada4));
  await pagina.setInputFiles('#inputDatos', [p4]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  await pagina.check('input[name="destino"][value="actualizar"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.st.periodos), fechasAntesActualizar);
  assert.equal(await pagina.evaluate(() => Escritorio.estado.M.sesiones.length), raw3.logs.length + 1);
  // Cerrar la pestaña y abrir otra conserva selección, JSON e IndexedDB.
  await pagina.close();
  const reabierta = await ctx.newPage();
  await reabierta.goto(`${origen}/escritorio/#entrenamiento/comparar`);
  await reabierta.waitForSelector('html[data-listo="1"]');
  assert.deepEqual(await reabierta.evaluate(() => Escritorio.estado.st.periodos), fechasAntesActualizar);
  await reabierta.close();
  pagina = await ctx.newPage();
  await pagina.goto(`${origen}/escritorio/`);
  ok('comparador: actualizar la instantánea y cerrar/reabrir conserva las fechas');

  // --- Fase 5. Comparación física con índice corregido y datos sintéticos ---
  await pagina.setViewportSize({ width: 1366, height: 900 });
  const raw5 = copiaRica();
  const archivoA = 'foto_20260601_frente.jpg', archivoB = 'foto_20260901_perfil.jpg';
  raw5.medidas = { schemaVersion: 1, registros: [
    { fecha: '2026-06-01', sitio: 'cintura', cm: 88 },
    { fecha: '2026-07-01', sitio: 'cintura', cm: 86 },
    { fecha: '2026-09-01', sitio: 'cintura', cm: 82 },
    { fecha: '2026-09-03', sitio: 'pecho', cm: 105 }, // futura para foto B
    { fecha: '2026-06-01', sitio: 'cuello', cm: 39 }, // >30 días en foto B
  ], fotos: [
    { archivo: archivoA, fecha: '2026-06-03', pose: 'perfil', pesoKg: 80 },
    { archivo: archivoB, fecha: '2026-09-02', pose: 'perfil', pesoKg: 78 },
    { archivo: 'ausente.jpg', fecha: '2026-09-05', pose: 'perfil' },
    ...Array.from({ length: 55 }, (_, i) => ({ archivo: `pendiente_${i}.jpg`, fecha: '2026-08-01', pose: 'frente' })),
  ] };
  raw5.nutricion.fasesCerradas = [{ id: 'cut', tipo: 'DEFICIT', inicio: '2026-06-01', fin: '2026-07-31', estado: 'CLOSED' }];
  raw5.nutricion.fase = { id: 'bulk', tipo: 'SURPLUS', inicio: '2026-08-01', tasaObjetivoPctSemana: 0.25, pesoObjetivoKg: 82 };
  raw5.nutricion.medicionesGrasa = [
    { fecha: '2026-06-01', porcentajePct: 18, pesoAnclaKg: 80, metodo: 'DIRECT' },
    { fecha: '2026-09-01', porcentajePct: 16, pesoAnclaKg: 78, metodo: 'DIRECT' },
  ];
  const idx5 = { ...raw5.medidas, fotos: raw5.medidas.fotos.map(f => f.archivo === archivoA ? { ...f, fecha: '2026-06-01', pose: 'frente' } : f) };
  const zip5 = escribir('fotos-fase5.zip', crearZip([
    { nombre: archivoA, datos: img[0] }, { nombre: archivoB, datos: img[1] },
    { nombre: 'medidas.json', datos: JSON.stringify(idx5) },
  ]));
  const p5 = escribir('fase5.json', JSON.stringify(raw5));
  await pagina.setInputFiles('#inputDatos', [p5, zip5]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  await pagina.check('input[name="destino"][value="nuevo"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  await pagina.evaluate(() => { location.hash = '#fisica'; });
  await pagina.waitForFunction(() => document.querySelectorAll('[data-original] img').length === 2);
  assert.equal(await pagina.inputValue('#compPose'), 'perfil');
  assert.equal(await pagina.inputValue('#compFotoA'), archivoA);
  const comparador = pagina.locator('#comparadorFotos');
  assert.ok((await comparador.innerText()).includes('1 jun 2026 · 2 días antes'));
  assert.ok((await comparador.innerText()).includes('−6 cm'));
  assert.ok((await comparador.innerText()).includes('sin medida anterior'));
  assert.ok((await comparador.innerText()).includes('medida demasiado antigua'));
  assert.ok((await comparador.innerText()).includes('Déficit'));
  assert.ok((await comparador.innerText()).includes('Superávit'));
  await foto('22-fotos-lado.png');
  ok('fotos: misma pose, ficha corregida, peso guardado, fases y fechas reales; sin contornos futuros ni antiguos');

  await pagina.click('[data-modo-foto="cortina"]');
  await pagina.waitForFunction(() => document.querySelectorAll('[data-original] img').length === 2);
  await pagina.locator('#fotoCorte').focus();
  await pagina.keyboard.press('Home'); await pagina.keyboard.press('ArrowRight');
  assert.equal(await pagina.inputValue('#fotoCorte'), '1');
  assert.ok(await pagina.locator('.foto-b').evaluate(el => getComputedStyle(el).clipPath.includes('99%')));
  const proporciones = await pagina.locator('[data-original] img').evaluateAll(imgs => imgs.map(i => [getComputedStyle(i).objectFit, i.clientWidth, i.clientHeight]));
  assert.ok(proporciones.every(p => p[0] === 'contain' && p[1] === proporciones[0][1] && p[2] === proporciones[0][2]));
  await foto('23-fotos-cortina.png');
  await pagina.click('[data-modo-foto="superposicion"]');
  await pagina.locator('#fotoOpacidad').focus(); await pagina.keyboard.press('Home');
  assert.equal(await pagina.locator('.foto-b').evaluate(el => getComputedStyle(el).opacity), '0');
  await pagina.keyboard.press('End');
  assert.equal(await pagina.locator('.foto-b').evaluate(el => getComputedStyle(el).opacity), '1');
  await pagina.locator('#fotoOpacidad').evaluate(i => { i.value = 50; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await foto('24-fotos-superposicion.png');
  ok('fotos: cortina y opacidad con teclado; ambos marcos mantienen proporciones');

  const hashesAntes = await pagina.evaluate(() => Escritorio.estado.fotosMeta.map(f => [f.archivo, f.sha256]));
  await pagina.locator('#ajustesFotos summary').click();
  await pagina.locator('#enc-a-zoom').evaluate(i => { i.value = 1.5; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pagina.locator('#enc-a-x').evaluate(i => { i.value = 10; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pagina.waitForFunction(() => document.querySelector('[data-lado="a"] img')?.style.transform.includes('scale(1.5)'));
  assert.ok((await pagina.locator('[data-lado="a"] img').getAttribute('style')).includes('translate(10%, 0%)'));
  await pagina.click('[data-accion="guardar-encuadres"]');
  await pagina.getByText('Encuadres guardados', { exact: true }).waitFor();
  const id5 = await pagina.evaluate(() => Escritorio.estado.espacio.id);
  await pagina.reload(); await pagina.waitForSelector('html[data-listo="1"]');
  await pagina.waitForFunction(() => document.querySelector('[data-lado="a"] img')?.style.transform.includes('scale(1.5)'));
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.fotosMeta.map(f => [f.archivo, f.sha256])), hashesAntes);
  assert.equal(await pagina.evaluate(() => Escritorio.estado.inst.texto), JSON.stringify(raw5));
  await pagina.close(); pagina = await ctx.newPage(); await pagina.goto(`${origen}/escritorio/#fisica`);
  await pagina.waitForSelector('html[data-listo="1"]');
  assert.equal(await pagina.evaluate(a => Escritorio.estado.fis.encuadres[a].zoom, archivoA), 1.5);
  ok('fotos: encuadres guardados tras recarga y cierre/reapertura; hashes y JSON originales intactos');

  await pagina.locator('#ajustesFotos summary').click();
  await pagina.getByRole('button', { name: 'Restablecer A', exact: true }).click();
  assert.equal(await pagina.inputValue('#enc-a-zoom'), '1');
  await pagina.evaluate(() => { Almacen._falloSimulado = 'QuotaExceededError'; });
  await pagina.click('[data-accion="guardar-encuadres"]');
  await pagina.getByRole('heading', { name: 'No se guardaron los encuadres' }).waitFor();
  assert.equal(await pagina.evaluate(async id => (await Almacen.leer('meta', `encuadres:${id}`)).valor['foto_20260601_frente.jpg'].zoom, id5), 1.5);
  await pagina.click('[data-accion="cerrar"]');
  await pagina.click('[data-accion="guardar-encuadres"]');
  await pagina.getByText('Encuadres guardados', { exact: true }).waitFor();
  ok('fotos: restablecer es reversible; fallo de escritura conserva encuadres previos e imágenes');

  await pagina.selectOption('#compFotoB', archivoA);
  await pagina.getByText('Selecciona dos fotos diferentes.', { exact: true }).waitFor();
  assert.equal(await pagina.locator('[data-original]').count(), 0);
  await pagina.selectOption('#compFotoB', 'ausente.jpg');
  await pagina.getByText('Falta una imagen seleccionada.', { exact: false }).waitFor();
  assert.equal(await pagina.locator('[data-original]').count(), 0);
  await pagina.selectOption('#compPose', 'espalda');
  await pagina.getByText('Hacen falta dos fotos de la misma pose para comparar.', { exact: true }).waitFor();
  await pagina.selectOption('#compPose', 'perfil');
  await pagina.selectOption('#galeriaPose', 'frente');
  assert.equal(await pagina.locator('.galeria .foto').count(), 48);
  await pagina.click('[data-pagina-fotos="1"]');
  assert.equal(await pagina.locator('.galeria .foto').count(), 7);
  await pagina.selectOption('#contornoSitio', 'pecho');
  assert.ok((await pagina.locator('#contenido').innerText()).includes('Datos insuficientes para una tendencia'));
  await pagina.getByText('Todos los contornos por fecha', { exact: true }).click();
  await pagina.getByRole('heading', { name: 'Composición corporal (estimación)', exact: true }).waitFor();
  await pagina.setViewportSize({ width: 420, height: 900 });
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await foto('25-fotos-estrecha.png');
  ok('fotos: ausentes, idénticas, pose sin pareja, paginación, tablas y 420 px sin desbordamiento');

  await pagina.evaluate(() => {
    const crear = URL.createObjectURL, liberar = URL.revokeObjectURL;
    window.urlsPrueba = new Set();
    window.restaurarUrlsPrueba = () => { URL.createObjectURL = crear; URL.revokeObjectURL = liberar; };
    URL.createObjectURL = blob => { const u = crear.call(URL, blob); urlsPrueba.add(u); return u; };
    URL.revokeObjectURL = u => { urlsPrueba.delete(u); return liberar.call(URL, u); };
  });
  await pagina.click('[data-modo-foto="cortina"]');
  await pagina.waitForFunction(() => document.querySelectorAll('[data-original] img').length === 2);
  await pagina.evaluate(() => { location.hash = '#recuperacion'; });
  await pagina.waitForFunction(() => !document.querySelector('#comparadorFotos') && urlsPrueba.size === 0);
  await pagina.evaluate(() => { restaurarUrlsPrueba(); location.hash = '#fisica'; });
  await pagina.locator('#compPose').waitFor();
  ok('fotos: cambio de sección libera object URLs de originales y miniaturas, también con lecturas en curso');

  // Corrección posterior en JSON, sin importar otra vez los binarios.
  const corregida5 = structuredClone(raw5);
  corregida5.medidas.fotos[0].fecha = '2026-07-02'; corregida5.medidas.fotos[0].pose = 'espalda';
  const p5c = escribir('fase5-corregida.json', JSON.stringify(corregida5));
  await pagina.setInputFiles('#inputDatos', [p5c]);
  await pagina.getByText('¿Dónde guardar esta copia?').waitFor();
  await pagina.check('input[name="destino"][value="actualizar"]');
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.fotosMeta.map(f => [f.archivo, f.sha256])), hashesAntes);
  const binariosIntactos = await pagina.evaluate(async () => {
    for (const f of Escritorio.estado.fotosMeta){
      const binario = await Almacen.leer('imagenes', [f.espacioId, f.archivo]);
      const h = await crypto.subtle.digest('SHA-256', await binario.blob.arrayBuffer());
      const hex = [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
      if (hex !== f.sha256) return false;
    }
    return true;
  });
  assert.equal(binariosIntactos, true);
  await pagina.evaluate(() => { location.hash = '#fisica'; });
  await pagina.locator('#compPose').waitFor();
  assert.equal(await pagina.evaluate(a => Escritorio.estado.galeria.find(f => f.archivo === a).pose, archivoA), 'espalda');
  assert.equal(await pagina.locator('#compFotoA option').filter({ hasText: archivoA }).count(), 0);
  assert.equal(await pagina.evaluate(a => Escritorio.estado.fis.encuadres[a].zoom, archivoA), 1);
  await pagina.selectOption('#compPose', 'espalda');
  assert.ok((await pagina.locator('#compFotoA').innerText()).includes('2 jul 2026'));
  ok('fotos: nueva corrección JSON cambia fecha/pose y selección sin renombrar, duplicar o perder encuadres');

  // ZIP sin JSON también permite comparación y contornos; metadatos sin archivo visibles.
  const paginaConJSON = pagina;
  // Origen distinto: también aisla IndexedDB en Chromium con --single-process.
  const servidorSoloZip = http.createServer(servidor.listeners('request')[0]);
  await new Promise(ok => servidorSoloZip.listen(0, '127.0.0.1', ok));
  servidorSoloZip.unref();
  const origenSoloZip = `http://127.0.0.1:${servidorSoloZip.address().port}`;
  origenesPrueba.add(origenSoloZip);
  const zipSolo5 = escribir('fotos-solo-fase5.zip', crearZip([
    { nombre: archivoA, datos: img[0] }, { nombre: archivoB, datos: img[1] },
    { nombre: 'medidas.json', datos: JSON.stringify(raw5.medidas) },
  ]));
  pagina = await ctx.newPage();
  await pagina.setViewportSize({ width: 1366, height: 900 });
  await pagina.goto(`${origenSoloZip}/escritorio/`);
  await pagina.waitForSelector('html[data-listo="1"]');
  await pagina.setInputFiles('#inputDatos', [zipSolo5]);
  await pagina.getByText('Revisa la importación').waitFor();
  await pagina.click('[data-accion="confirmar"]');
  await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
  await pagina.click('[data-accion="cerrar"]');
  assert.equal(await pagina.evaluate(() => Escritorio.estado.inst), null);
  assert.equal(await pagina.evaluate(() => Escritorio.estado.galeria.filter(f => !f.tieneImagen).length), 56);
  await pagina.evaluate(() => { location.hash = '#fisica'; });
  await pagina.waitForFunction(() => document.querySelectorAll('[data-original] img').length === 2);
  await pagina.getByText('Contornos del índice del ZIP.', { exact: false }).waitFor();
  assert.equal(await pagina.evaluate(() => Escritorio.estado.fis.encuadres['foto_20260601_frente.jpg']), undefined);
  await pagina.setViewportSize({ width: 1366, height: 900 });
  await foto('26-fotos-solo-zip.png');
  ok('fotos: ZIP independiente conserva medidas, metadatos ausentes y separación de encuadres entre espacios');
  await pagina.close(); servidorSoloZip.close(); pagina = paginaConJSON;

  // --- Fase 6. Planificador personal: borradores, edición con teclado,
  // comparación, exportación, actualización de la copia y recuperación ---
  {
    const paginaAntes6 = pagina;
    const servidor6 = http.createServer(servidor.listeners('request')[0]);
    await new Promise(ok => servidor6.listen(0, '127.0.0.1', ok));
    servidor6.unref();
    const origen6 = `http://127.0.0.1:${servidor6.address().port}`;
    origenesPrueba.add(origen6);
    const raw6 = copiaRica();
    const p6 = escribir('copia_truelift_2026-07-02.json', JSON.stringify(raw6));
    pagina = await ctx.newPage();
    await pagina.setViewportSize({ width: 1366, height: 900 });
    await pagina.goto(`${origen6}/escritorio/`);
    await pagina.waitForSelector('html[data-listo="1"]');
    const importar6 = async (ruta, destino = null) => {
      await pagina.setInputFiles('#inputDatos', [ruta]);
      await pagina.getByText('Revisa la importación').waitFor();
      if (destino) await pagina.check(`input[name="destino"][value="${destino}"]`);
      await pagina.click('[data-accion="confirmar"]');
      await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
      await pagina.click('#modalCaja [data-accion="cerrar"]');
      // Tras importar se abre «Mis datos»; se vuelve a Mi rutina.
      await pagina.evaluate(() => { location.hash = '#rutina'; });
      await pagina.waitForSelector('.rut-estado');
    };
    await importar6(p6);
    await pagina.evaluate(() => { location.hash = '#rutina'; });
    await pagina.getByRole('heading', { name: 'Mi rutina', exact: true }).waitFor();
    const cont = () => pagina.locator('#contenido').innerText();
    assert.match(await cont(), /EN TU MÓVIL[\s\S]*progresión doble · 2 días/i);
    assert.match(await cont(), /Es de consulta: para preparar cambios crea un borrador/);
    // Crear el borrador con el teclado.
    await pagina.focus('[data-rut-accion="nuevo-movil"]');
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('.rut-dias');
    await pagina.waitForFunction(id => document.activeElement && document.activeElement.id === id, 'rutExportar', { timeout: 5000 });
    assert.match(await cont(), /Tu borrador es igual que la rutina del móvil/);
    // Editar: series, modalidad, nuevo ejercicio con patrón deducido y orden.
    await pagina.fill('#rut-0-1-series', '4');
    await pagina.press('#rut-0-1-series', 'Tab');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[0].filas[1].series === 4);
    await pagina.selectOption('#rut-1-0-modalidad', 'topBack');
    await pagina.waitForSelector('#rut-1-0-backoffPct');
    await pagina.waitForFunction(id => document.activeElement && document.activeElement.id === id, 'rut-1-0-modalidad', { timeout: 5000 });
    await pagina.click('#rut-1-nueva');
    await pagina.waitForFunction(id => document.activeElement && document.activeElement.id === id, 'rut-1-1-ejercicio', { timeout: 5000 });
    await pagina.keyboard.type('Peso muerto rumano con barra');
    await pagina.keyboard.press('Tab');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[1].filas[1].patron === 'Bisagra');
    await pagina.focus('#rut-1-1-arriba');
    await pagina.keyboard.press('Enter');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[1].filas[0].ejercicio === 'Peso muerto rumano con barra');
    await pagina.waitForFunction(id => document.activeElement && document.activeElement.id === id, 'rut-1-0-abajo', { timeout: 5000 });
    const cambios = await pagina.locator('#rutCambios').innerText();
    assert.match(cambios, /Dominada asistida en máquina: Series 3 → 4/);
    assert.match(cambios, /Sentadilla con barra: Modalidad Series normales → Top set \+ back-off/);
    assert.match(cambios, /Nuevo\s*Peso muerto rumano con barra · 3 × 8-10/i);
    const avisos6 = await pagina.locator('#rutAvisos').innerText();
    assert.match(avisos6, /máximo debe superar al mínimo; la app usará 8–10/);
    const tablaGrupos = await pagina.locator('table', { has: pagina.locator('caption', { hasText: 'rutina del móvil frente al borrador' }) }).innerText();
    assert.match(tablaGrupos, /Espalda\s+3\s+5,5\s+\+2,5/);
    await foto('27-rutina-editor.png');
    ok('rutina: borrador desde el móvil con teclado; series, modalidad, ejercicio nuevo y orden; cambios, avisos y grupos');

    // Deshacer / rehacer y volver a la rutina de partida.
    await pagina.focus('#rutDeshacer');
    await pagina.keyboard.press('Control+z');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[1].filas[1].ejercicio === 'Peso muerto rumano con barra');
    await pagina.click('#rutRehacer');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[1].filas[0].ejercicio === 'Peso muerto rumano con barra');
    await pagina.click('[data-rut-accion="partida"]');
    await pagina.getByText('Tu borrador es igual que la rutina del móvil').waitFor();
    await pagina.click('#rutDeshacer');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores[0]?.rutina.dias[1].filas.length === 2);
    ok('rutina: deshacer, rehacer y volver a la rutina de partida (también deshacible)');

    // Fallo de escritura: el cambio no se aplica y lo guardado sigue intacto.
    const antesFallo = await pagina.evaluate(() => JSON.stringify(Escritorio.estado.rut.borradores[0].rutina));
    await pagina.evaluate(() => Almacen.simularFalloEscritura());
    await pagina.fill('#rut-0-0-series', '9');
    await pagina.press('#rut-0-0-series', 'Tab');
    await pagina.getByText('No hay espacio en el navegador para guardar el borrador').waitFor();
    assert.equal(await pagina.evaluate(() => JSON.stringify(Escritorio.estado.rut.borradores[0].rutina)), antesFallo);
    await pagina.reload();
    await pagina.waitForSelector('.rut-dias');
    assert.equal(await pagina.evaluate(() => JSON.stringify(Escritorio.estado.rut.borradores[0].rutina)), antesFallo);
    assert.equal(await pagina.inputValue('#rut-0-0-series'), '3');
    ok('rutina: fallo de cuota conserva el borrador guardado; la recarga lo recupera');

    // Exportar: Excel descargado, exportación anotada y sin aplicar.
    await pagina.click('#rutExportar');
    await pagina.getByText('Tu móvil no cambia todavía').waitFor();
    const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('[data-rut-accion="exportar-confirmar"]')]);
    assert.match(descarga.suggestedFilename(), /^mi_rutina_truelift_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const rutaXlsx = path.join(tmp, descarga.suggestedFilename());
    await descarga.saveAs(rutaXlsx);
    assert.deepEqual([...fs.readFileSync(rutaXlsx).subarray(0, 2)], [0x50, 0x4B]);
    await pagina.getByText('Sin comprobar').waitFor();
    assert.equal(await pagina.evaluate(() => Escritorio.estado.rut.borradores[0].exportaciones.length), 1);
    // Abrir el Excel exportado como borrador: es la misma rutina para la app.
    await pagina.setInputFiles('#rutExcel', rutaXlsx);
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores.length === 2);
    const mismas = await pagina.evaluate(() => {
      const [a, b] = Escritorio.estado.rut.borradores, raw = Escritorio.estado.raw;
      return Planificador.firma(Planificador.comoLaApp(a.rutina, raw).normal) === Planificador.firma(Planificador.comoLaApp(b.rutina, raw).normal);
    });
    assert.ok(mismas);
    assert.equal(await pagina.inputValue('#rutSelBorrador'), await pagina.evaluate(() => Escritorio.estado.rut.borradores[1].id));
    ok('rutina: exportar descarga un Excel compatible, se anota «sin comprobar» y al reabrirlo produce la misma rutina');

    // Una copia nueva del móvil con la rutina aplicada A PRUEBA: el borrador
    // sigue, la exportación se reconoce y se avisa del cambio de origen.
    await pagina.selectOption('#rutSelBorrador', await pagina.evaluate(() => Escritorio.estado.rut.borradores[0].id));
    const plan6 = await pagina.evaluate(() => {
      const b = Escritorio.estado.rut.borradores[0];
      const sim = Planificador.comoLaApp(b.rutina, Escritorio.estado.raw);
      return sim.dias.flatMap(d => d.lineas.map((l, i) => ({ dia: d.nombre, orden: i + 1, patron: '', grupo: '', ...l })));
    });
    const aplicada6 = structuredClone(raw6);
    aplicada6.planMod = plan6;
    aplicada6.importPendiente = { nombre: 'mi_rutina', origen: 'rutina_excel', ejerciciosAnadidos: [], previo: {} };
    aplicada6.logs.push({ ...structuredClone(raw6.logs.at(-2)), fecha: '2026-07-03T18:00:00.000' });
    await importar6(escribir('copia-aprueba.json', JSON.stringify(aplicada6)), 'actualizar');
    assert.equal(await pagina.evaluate(() => Escritorio.estado.rut.borradores.length), 2);
    await pagina.getByText('A prueba en el móvil').first().waitFor();
    assert.match(await cont(), /La rutina de tu última copia no es la misma de la que partió este borrador/);
    await foto('28-rutina-a-prueba.png');
    delete aplicada6.importPendiente;
    aplicada6.logs.push({ ...structuredClone(raw6.logs.at(-2)), fecha: '2026-07-04T18:00:00.000' });
    await importar6(escribir('copia-confirmada.json', JSON.stringify(aplicada6)), 'actualizar');
    await pagina.getByText('En tu móvil', { exact: true }).nth(1).waitFor();
    assert.match(await cont(), /Tu borrador es igual que la rutina del móvil/);
    await pagina.click('[data-rut-accion="rebasar"]');
    await pagina.waitForFunction(() => !document.body.innerText.includes('no es la misma de la que partió'));
    ok('rutina: actualizar la copia conserva los borradores; reconoce la rutina a prueba y luego aplicada; la discrepancia se resuelve');

    // Una rutina de un solo día no se exporta; eliminar pide confirmación.
    await pagina.click('[data-rut-accion="nuevo-blanco"]');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores.length === 3);
    await pagina.click('#rutExportar');
    await pagina.getByText('Aún no se puede exportar').waitFor();
    assert.match(await pagina.locator('#modalCaja').innerText(), /entre 2 y 5 días con ejercicios; ahora hay 0/);
    await pagina.click('#modalCaja [data-accion="cerrar"]');
    await pagina.click('[data-rut-accion="eliminar"]');
    await pagina.click('[data-rut-accion="eliminar-ok"]');
    await pagina.waitForFunction(() => Escritorio.estado.rut.borradores.length === 2);
    ok('rutina: sin días suficientes no se exporta; eliminar un borrador pide confirmación');

    // Ventana estrecha y cierre/reapertura.
    await pagina.setViewportSize({ width: 420, height: 900 });
    await pagina.waitForTimeout(100);
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await foto('29-rutina-estrecha.png');
    await pagina.setViewportSize({ width: 1366, height: 900 });
    const activo = await pagina.evaluate(() => Escritorio.estado.rut.activoId);
    await pagina.close();
    pagina = await ctx.newPage();
    await pagina.goto(`${origen6}/escritorio/#rutina`);
    await pagina.waitForSelector('.rut-dias');
    assert.equal(await pagina.evaluate(() => Escritorio.estado.rut.activoId), activo);
    assert.equal(await pagina.evaluate(() => Escritorio.estado.rut.borradores.length), 2);
    ok('rutina: 420 px sin desbordamiento; cerrar y reabrir conserva borradores y el activo');
    await pagina.close(); servidor6.close(); pagina = paginaAntes6;
  }

  // --- Fase 7. Informe de un periodo: selección, fotos solo elegidas,
  // impresión/PDF, recarga y ventana estrecha ---
  {
    const paginaAntes7 = pagina;
    const servidor7 = http.createServer(servidor.listeners('request')[0]);
    await new Promise(ok => servidor7.listen(0, '127.0.0.1', ok));
    servidor7.unref();
    const origen7 = `http://127.0.0.1:${servidor7.address().port}`;
    origenesPrueba.add(origen7);
    const raw7 = copiaFase3();
    raw7.medidas = { schemaVersion: 1, registros: [
      { fecha: '2026-08-28', sitio: 'cintura', cm: 85 }, { fecha: '2026-09-04', sitio: 'cintura', cm: 84.6 }, { fecha: '2026-09-25', sitio: 'cintura', cm: 84 }],
      fotos: [{ fecha: '2026-09-04', pose: 'frente', archivo: 'foto_20260904_frente.jpg', pesoKg: 81.9 },
              { fecha: '2026-09-25', pose: 'frente', archivo: 'foto_20260925_frente.jpg', pesoKg: 81.4 },
              { fecha: '2026-09-25', pose: 'perfil', archivo: 'foto_20260925_perfil.jpg', pesoKg: 81.4 },
              { fecha: '2026-08-28', pose: 'frente', archivo: 'foto_20260828_frente.jpg', pesoKg: 82 }] };
    const p7 = escribir('copia_truelift_2026-10-09.json', JSON.stringify(raw7));
    const z7 = escribir('fotos_2026-10-09.zip', crearZip([
      { nombre: 'foto_20260904_frente.jpg', datos: img[0] }, { nombre: 'foto_20260925_frente.jpg', datos: img[1] },
      { nombre: 'foto_20260828_frente.jpg', datos: img[2] }, { nombre: 'medidas.json', datos: JSON.stringify(raw7.medidas) }]));
    pagina = await ctx.newPage();
    await pagina.setViewportSize({ width: 1366, height: 900 });
    await pagina.goto(`${origen7}/escritorio/`);
    await pagina.waitForSelector('html[data-listo="1"]');
    await pagina.setInputFiles('#inputDatos', [p7, z7]);
    await pagina.getByText('Revisa la importación').waitFor();
    await pagina.click('[data-accion="confirmar"]');
    await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
    await pagina.click('#modalCaja [data-accion="cerrar"]');
    await pagina.keyboard.press('Alt+6');
    await pagina.getByRole('heading', { name: 'Septiembre de 2026', exact: true }).waitFor();
    const doc = () => pagina.locator('.informe-doc').innerText();
    for (const t of ['RESUMEN DEL PERIODO', 'CONSTANCIA', 'PROGRESIÓN VERIFICABLE', 'EVOLUCIÓN FÍSICA', 'VOLUMEN REALIZADO', 'RECUPERACIÓN',
      'CAMBIOS RELEVANTES', 'ASPECTOS QUE REVISAR', 'DATOS INSUFICIENTES Y LIMITACIONES']) assert.ok((await doc()).toUpperCase().includes(t), t);
    assert.match(await doc(), /8 de 9/);
    assert.match(await doc(), /Cintura\s+84,6 cm\s*4 sep 2026\s+84 cm\s*25 sep 2026\s+−0,6 cm/);
    assert.match(await doc(), /Fotos registradas en el periodo: 3 \(1 sin imagen importada\)/);
    assert.equal(await pagina.locator('[data-inf-foto]').count(), 0);
    ok('informe: Alt + 6 abre el último mes completo con todas sus secciones, contornos sin arrastre y sin fotos');
    await foto('30-informe.png');

    // Fechas con el teclado: invertidas se rechazan sin guardar; válidas se
    // guardan y el foco pasa al título del informe.
    await pagina.focus('input[name="tipo"][value="mes"]');
    await pagina.keyboard.press('ArrowDown');
    assert.equal(await pagina.locator('#informeDesde').isDisabled(), false);
    assert.equal(await pagina.locator('#informeMes').isDisabled(), true);
    await pagina.fill('#informeDesde', '2026-09-20');
    await pagina.fill('#informeHasta', '2026-09-10');
    await pagina.keyboard.press('Enter');
    await pagina.getByText('La fecha de inicio debe ser anterior o igual a la final.').waitFor();
    assert.equal(await pagina.evaluate(() => Escritorio.estado.st.informe), null);
    await pagina.fill('#informeDesde', '2026-09-07');
    await pagina.fill('#informeHasta', '2026-10-09');
    await pagina.click('#formInforme button[type="submit"]');
    await pagina.waitForFunction(() => document.activeElement?.id === 'informeTitulo');
    assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.st.informe), { tipo: 'fechas', desde: '2026-09-07', hasta: '2026-10-09' });
    assert.match(await doc(), /A fecha de tu último registro, la app cuenta los intentos agotados en Press banca con barra/);
    ok('informe: fechas con teclado, rechazo sin guardar y foco en el informe; el estado actual solo con el último registro');

    // Fotos: solo con la casilla y la elección explícita; solo las del periodo con imagen.
    await pagina.check('#informeConFotos');
    await pagina.waitForFunction(() => document.activeElement?.id === 'informeConFotos');
    const elegibles = await pagina.locator('[data-inf-elegir]').evaluateAll(xs => xs.map(x => x.dataset.infElegir));
    assert.deepEqual(elegibles, ['foto_20260925_frente.jpg']);
    assert.equal(await pagina.locator('[data-inf-foto]').count(), 0);
    await pagina.locator('[data-inf-elegir]').first().check();
    await pagina.waitForFunction(() => document.querySelector('[data-inf-foto] img')?.naturalWidth > 0);
    await pagina.evaluate(() => {
      window.__impresiones = [];
      window.print = () => window.__impresiones.push({ titulo: document.title,
        fotos: [...document.querySelectorAll('[data-inf-foto] img')].filter(i => i.complete && i.naturalWidth > 0).length });
    });
    await pagina.click('[data-accion="imprimir-informe"]');
    await pagina.waitForFunction(() => window.__impresiones.length === 1);
    assert.deepEqual(await pagina.evaluate(() => window.__impresiones[0]), { titulo: 'Informe TrueLift 2026-09-07 a 2026-10-09', fotos: 1 });
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await pagina.title(), 'Informes · TrueLift Escritorio');
    await foto('31-informe-fotos.png');
    ok('informe: fotos solo por elección (del periodo y con imagen); imprimir espera a las fotos y propone el nombre del PDF');

    // Hoja de impresión: solo el documento, en papel blanco; PDF real.
    await pagina.emulateMedia({ media: 'print' });
    assert.equal(await pagina.locator('#informeOpciones').isVisible(), false);
    assert.equal(await pagina.locator('#tabs').isVisible(), false);
    assert.equal(await pagina.locator('.privacy-notice').isVisible(), false);
    assert.equal(await pagina.locator('.informe-doc').isVisible(), true);
    assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
    const pdf = await pagina.pdf({ format: 'A4', printBackground: true });
    assert.equal(Buffer.from(pdf.subarray(0, 4)).toString(), '%PDF');
    if (capturas) fs.writeFileSync(path.join(capturas, '32-informe.pdf'), pdf);
    await foto('32-informe-impreso.png');
    await pagina.emulateMedia({ media: 'screen' });
    ok('informe: la impresión deja solo el documento sobre blanco y genera un PDF');

    // Recarga: la selección del periodo sigue; las fotos vuelven a quedar fuera.
    await pagina.reload();
    await pagina.waitForSelector('.informe-doc');
    assert.equal(await pagina.inputValue('#informeDesde'), '2026-09-07');
    assert.equal(await pagina.locator('#informeConFotos').isChecked(), false);
    assert.equal(await pagina.locator('[data-inf-foto]').count(), 0);
    // Una copia nueva no borra la selección.
    const raw7b = structuredClone(raw7);
    raw7b.logs.push({ ...structuredClone(raw7.logs.at(-1)), fecha: '2026-10-10T18:00:00.000' });
    await pagina.setInputFiles('#inputDatos', [escribir('copia_truelift_2026-10-10.json', JSON.stringify(raw7b))]);
    await pagina.getByText('Revisa la importación').waitFor();
    await pagina.check('input[name="destino"][value="actualizar"]');
    await pagina.click('[data-accion="confirmar"]');
    await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
    await pagina.click('#modalCaja [data-accion="cerrar"]');
    await pagina.evaluate(() => { location.hash = '#informes'; });
    await pagina.waitForSelector('.informe-doc');
    assert.equal(await pagina.inputValue('#informeHasta'), '2026-10-09');
    ok('informe: la recarga conserva el periodo y vuelve sin fotos; actualizar la copia no lo borra');

    await pagina.click('[data-accion="informe-comparar"]');
    await pagina.getByRole('heading', { name: 'Comparar periodos', exact: true }).waitFor();
    assert.deepEqual(await pagina.evaluate(() => Escritorio.estado.st.periodos),
      { a: { desde: '2026-08-05', hasta: '2026-09-06' }, b: { desde: '2026-09-07', hasta: '2026-10-09' } });
    await pagina.evaluate(() => { location.hash = '#informes'; });
    await pagina.waitForSelector('.informe-doc');
    await pagina.setViewportSize({ width: 420, height: 900 });
    await pagina.waitForTimeout(100);
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await foto('33-informe-estrecha.png');
    await pagina.setViewportSize({ width: 1366, height: 900 });
    ok('informe: comparar con el periodo anterior prepara las fechas; 420 px sin desbordamiento');
    await pagina.close(); servidor7.close(); pagina = paginaAntes7;
  }

  // --- Fase 7. Sin conexión tras una visita con conexión (service worker) ---
  {
    const paginaAntes8 = pagina;
    const servidor8 = http.createServer(servidor.listeners('request')[0]);
    await new Promise(ok => servidor8.listen(0, '127.0.0.1', ok));
    const puerto8 = servidor8.address().port;
    const origen8 = `http://127.0.0.1:${puerto8}`;
    origenesPrueba.add(origen8);
    pagina = await ctx.newPage();
    await pagina.setViewportSize({ width: 1366, height: 900 });
    // Cachés ajenas del mismo origen (Coach y otra): no se deben borrar.
    await pagina.goto(`${origen8}/coach/`);
    await pagina.evaluate(async () => { await caches.open('tlcoach-v16'); await caches.open('otra-pagina'); });
    await pagina.goto(`${origen8}/escritorio/`);
    await pagina.waitForSelector('html[data-listo="1"]');
    await pagina.setInputFiles('#inputDatos', [escribir('copia_offline.json', JSON.stringify(copiaFase3()))]);
    await pagina.getByText('Revisa la importación').waitFor();
    await pagina.click('[data-accion="confirmar"]');
    await pagina.getByRole('heading', { name: 'Importación completada', exact: true }).waitFor();
    await pagina.click('#modalCaja [data-accion="cerrar"]');
    await pagina.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    await pagina.getByText('esta página ya se puede abrir sin conexión en este navegador').waitFor();
    assert.deepEqual((await pagina.evaluate(() => caches.keys())).sort(), ['otra-pagina', 'tlcoach-v16', 'tlescritorio-v1']);
    // Sin red ni servidor: la página, los datos y el informe siguen disponibles.
    await ctx.setOffline(true);
    servidor8.closeAllConnections(); await new Promise(ok => servidor8.close(ok));
    await pagina.reload();
    await pagina.waitForSelector('html[data-listo="1"]');
    await pagina.evaluate(() => { location.hash = '#resumen'; });
    await pagina.getByRole('heading', { name: 'Mi resumen', exact: true }).waitFor();
    await pagina.evaluate(() => { location.hash = '#informes'; });
    await pagina.getByRole('heading', { name: 'Septiembre de 2026', exact: true }).waitFor();
    assert.equal(await pagina.evaluate(() => document.fonts.check('16px Archivo')), true);
    // Control: lo que no está en su lista (el Coach) no se sirve sin red.
    const nErrores = erroresJs.length;
    assert.equal(await pagina.evaluate(async o => { try { await fetch(`${o}/coach/views.js`); return 'servido'; } catch (_) { return 'sin red'; } }, origen8), 'sin red');
    await pagina.close();
    // El fallo de red provocado por el control no es un error de la página.
    erroresJs.splice(nErrores, erroresJs.length - nErrores, ...erroresJs.slice(nErrores).filter(e => !e.includes('ERR_INTERNET_DISCONNECTED')));
    await ctx.setOffline(false);
    pagina = paginaAntes8;
    ok('sin conexión: tras una visita la página abre con sus datos e informe sin red; solo se crean y gestionan sus cachés');
  }

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
