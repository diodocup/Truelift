import assert from 'node:assert/strict';
import test from 'node:test';
import { cargar, crearZip, jpegFalso, copiaSintetica } from './comun.mjs';

const { ZipSeguro: Z, FotosTL: F, ImportarJSON: I } = cargar('importar.js', 'zip-seguro.js', 'fotos.js');
const blob = u8 => new Blob([u8]);

async function leerTodo(u8){
  const b = blob(u8);
  const { entradas, problemas } = await Z.listar(b);
  const out = new Map();
  for (const e of entradas) out.set(e.nombre, await Z.extraer(b, e));
  return { out, problemas, entradas };
}

test('ZIP con índice (formato actual del móvil): STORE y DEFLATE', async () => {
  const indice = { schemaVersion: 1, registros: [], fotos: [
    { fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg', pesoKg: 80 }] };
  const zip = crearZip([
    { nombre: 'foto_20260801_frente.jpg', datos: jpegFalso(1), metodo: 8 },
    { nombre: 'foto_20260801_perfil.jpg', datos: jpegFalso(2), metodo: 0 },
    { nombre: 'medidas.json', datos: JSON.stringify(indice) },
  ]);
  const { out, problemas } = await leerTodo(zip);
  assert.equal(problemas.length, 0);
  assert.deepEqual([...out.keys()].sort(), ['foto_20260801_frente.jpg', 'foto_20260801_perfil.jpg', 'medidas.json']);
  assert.deepEqual(Array.from(out.get('foto_20260801_frente.jpg')), Array.from(jpegFalso(1)));
  const cl = F.clasificarEntradas([...out.keys()].map(nombre => ({ nombre })));
  assert.equal(cl.indice.nombre, 'medidas.json');
  assert.equal(cl.imagenes.length, 2);
});

test('ZIP corrupto, truncado o que no es ZIP', async () => {
  await assert.rejects(Z.listar(blob(new TextEncoder().encode('esto no es un zip, solo texto plano'))), e => e.codigo === 'corrupto');
  const zip = crearZip([{ nombre: 'foto_20260801_frente.jpg', datos: jpegFalso(1) }]);
  await assert.rejects(Z.listar(blob(zip.slice(0, zip.length - 10))), e => e.codigo === 'corrupto');
  // CRC falso: se detecta al extraer.
  const malo = crearZip([{ nombre: 'foto_20260801_frente.jpg', datos: jpegFalso(1), crcFalso: 1234 }]);
  const b = blob(malo);
  const { entradas } = await Z.listar(b);
  await assert.rejects(Z.extraer(b, entradas[0]), e => e.codigo === 'corrupto');
});

test('rutas inseguras y carpetas no se extraen', async () => {
  const zip = crearZip([
    { nombre: '../fuera.jpg', datos: jpegFalso(1) },
    { nombre: '/abs.jpg', datos: jpegFalso(2) },
    { nombre: 'a\\b.jpg', datos: jpegFalso(3) },
    { nombre: 'carpeta/foto_20260801_frente.jpg', datos: jpegFalso(4) },
    { nombre: '__MACOSX/._foto.jpg', datos: 'x' },
    { nombre: 'nota.txt', datos: 'hola' },
    { nombre: 'foto_20260801_frente.jpg', datos: jpegFalso(5) },
  ]);
  const { entradas, problemas } = await Z.listar(blob(zip));
  assert.equal(problemas.length, 3);
  const cl = F.clasificarEntradas(entradas);
  assert.deepEqual(cl.imagenes.map(e => e.nombre), ['foto_20260801_frente.jpg']);
  assert.equal(cl.ignoradas.length, 3);
  assert.ok(cl.ignoradas.some(i => /carpeta/.test(i.motivo)));
});

test('límites: demasiadas entradas, bomba de compresión y tamaño declarado falso', async () => {
  const antes = { ...Z.LIMITES };
  try {
    Z.LIMITES.entradas = 2;
    const zip = crearZip([1, 2, 3].map(i => ({ nombre: `f${i}.jpg`, datos: jpegFalso(i) })));
    await assert.rejects(Z.listar(blob(zip)), e => e.codigo === 'entradas');
    Z.LIMITES.entradas = antes.entradas;

    // 5 MB de ceros comprimen a pocos KB: relación > 200:1.
    const bomba = crearZip([{ nombre: 'bomba.jpg', datos: new Uint8Array(5 * 1024 * 1024) }]);
    const r = await Z.listar(blob(bomba));
    assert.equal(r.entradas.length, 0);
    assert.match(r.problemas[0].motivo, /sospechosa/);

    // Declara 100 bytes pero descomprime a más: se corta al pasar de lo declarado.
    const engaño = crearZip([{ nombre: 'e.jpg', datos: jpegFalso(9, 5000), realFalso: 100 }]);
    const b = blob(engaño);
    Z.LIMITES.ratio = 1e9;
    const { entradas } = await Z.listar(b);
    await assert.rejects(Z.extraer(b, entradas[0]), e => e.codigo === 'corrupto');

    Z.LIMITES.bytesEntrada = 100;
    const grande = crearZip([{ nombre: 'g.jpg', datos: jpegFalso(1, 1000), metodo: 0 }]);
    const g = await Z.listar(blob(grande));
    assert.match(g.problemas[0].motivo, /grande/);
  } finally { Object.assign(Z.LIMITES, antes); }
});

test('cancelación durante la extracción', async () => {
  const zip = crearZip([{ nombre: 'foto_20260801_frente.jpg', datos: jpegFalso(1, 300000) }]);
  const b = blob(zip);
  const { entradas } = await Z.listar(b);
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(Z.extraer(b, entradas[0], { signal: ac.signal }), e => e.codigo === 'cancelado');
});

test('ficha por nombre: solo el patrón exacto del móvil', () => {
  assert.deepEqual(F.fichaDesdeNombre('foto_20260801_frente.jpg'), { fecha: '2026-08-01', pose: 'frente' });
  assert.deepEqual(F.fichaDesdeNombre('foto_20260801_espalda_3.jpg'), { fecha: '2026-08-01', pose: 'espalda' });
  for (const n of ['IMG_1234.jpg', 'foto_20260231_frente.jpg', 'foto_20260801_lateral.jpg',
                   'foto_20260801_frente.jpeg', 'Foto_20260801_frente.jpg', 'foto_2026081_frente.jpg'])
    assert.equal(F.fichaDesdeNombre(n), null, n);
});

test('tipo por firma, no por extensión', () => {
  assert.equal(F.tipoImagen(jpegFalso(1)), 'image/jpeg');
  assert.equal(F.tipoImagen(new TextEncoder().encode('no soy una imagen, soy texto')), null);
});

test('prioridad: copia JSON > índice del ZIP > nombre (fecha y pose corregidas sin renombrar)', () => {
  // En el móvil la foto se corrigió: el archivo se llama «20260801_frente»
  // pero es de perfil y del 25 de julio.
  const raw = copiaSintetica({ fotos: [{ fecha: '2026-07-25', pose: 'perfil', archivo: 'foto_20260801_frente.jpg', pesoKg: 79 }] });
  const indiceJson = F.leerIndice(raw.medidas);
  // El ZIP se exportó antes de la corrección.
  const indiceZip = F.leerIndice({ fotos: [{ fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg' }] });
  const a = F.asociar('foto_20260801_frente.jpg', { indiceJson, metaZip: indiceZip.fotos.get('foto_20260801_frente.jpg') });
  assert.equal(a.fuente, 'json');
  assert.equal(a.ficha.fecha, '2026-07-25');
  assert.equal(a.ficha.pose, 'perfil');
  assert.deepEqual(a.discrepancia, { zip: { fecha: '2026-08-01', pose: 'frente' } });

  // Sin copia JSON: manda el índice del ZIP, aunque contradiga al nombre.
  const indiceZip2 = F.leerIndice({ fotos: [{ fecha: '2026-07-25', pose: 'perfil', archivo: 'foto_20260801_frente.jpg' }] });
  const b = F.asociar('foto_20260801_frente.jpg', { indiceJson: null, metaZip: indiceZip2.fotos.get('foto_20260801_frente.jpg') });
  assert.equal(b.fuente, 'zip');
  assert.equal(b.ficha.pose, 'perfil');

  // Sin índice alguno (ZIP antiguo): nombre estricto.
  const c = F.asociar('foto_20260801_frente.jpg', {});
  assert.equal(c.fuente, 'nombre');
  assert.equal(c.ficha.fecha, '2026-08-01');
  // Nombre arbitrario sin índice: sin asociación.
  assert.equal(F.asociar('IMG_0001.jpg', {}).ficha, null);
});

test('plan: nueva, duplicada, conflicto, fuera de la copia, sin asociación y no válida', () => {
  const raw = copiaSintetica({ fotos: [
    { fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg' },
    { fecha: '2026-08-01', pose: 'perfil', archivo: 'foto_20260801_perfil.jpg' },
    { fecha: '2026-08-15', pose: 'frente', archivo: 'foto_20260815_frente.jpg' },
  ] });
  const indiceJson = F.leerIndice(raw.medidas);
  const existentes = new Map([
    ['foto_20260801_frente.jpg', { sha256: 'aaa' }],
    ['foto_20260801_perfil.jpg', { sha256: 'bbb' }],
  ]);
  const { items, cuentas } = F.planificar({
    candidatas: [
      { nombre: 'foto_20260801_frente.jpg', sha256: 'aaa', tipo: 'image/jpeg' },   // misma imagen
      { nombre: 'foto_20260801_perfil.jpg', sha256: 'zzz', tipo: 'image/jpeg' },   // mismo nombre, otra imagen
      { nombre: 'foto_20260815_frente.jpg', sha256: 'ccc', tipo: 'image/jpeg' },   // nueva
      { nombre: 'foto_20260901_espalda.jpg', sha256: 'ddd', tipo: 'image/jpeg' },  // no está en la copia
      { nombre: 'IMG_9.jpg', sha256: 'eee', tipo: 'image/jpeg' },                  // sin asociación
      { nombre: 'foto_20260902_frente.jpg', sha256: 'fff', tipo: null },           // no es imagen
    ],
    indiceJson, indiceZip: null, existentes,
  });
  assert.deepEqual(items.map(i => i.estado), ['duplicada', 'conflicto', 'nueva', 'fueraDeCopia', 'sinAsociacion', 'noValida']);
  assert.equal(cuentas.nueva, 1);
});

test('copia sin bloque de medidas (anterior al módulo): nada queda fuera de la copia', () => {
  const { items } = F.planificar({ candidatas: [{ nombre: 'foto_20260901_espalda.jpg', sha256: 'd', tipo: 'image/jpeg' }],
                                    indiceJson: null });
  assert.equal(items[0].estado, 'nueva');
  assert.equal(items[0].fuente, 'nombre');
});

test('galería: fotos sin imagen se muestran como pendientes y no se borran', () => {
  const raw = copiaSintetica({ fotos: [
    { fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg' },
    { fecha: '2026-08-01', pose: 'espalda', archivo: 'foto_20260801_espalda.jpg' },
  ] });
  const g = F.resolver({ indiceJson: F.leerIndice(raw.medidas), guardadas: [{ archivo: 'foto_20260801_frente.jpg' }] });
  assert.deepEqual(g.map(f => [f.archivo, f.tieneImagen]),
    [['foto_20260801_frente.jpg', true], ['foto_20260801_espalda.jpg', false]]);
});

test('una copia JSON nueva corrige la ficha de una imagen ya guardada (resolución al leer)', () => {
  const guardadas = [{ archivo: 'foto_20260801_frente.jpg', metaZip: { fecha: '2026-08-01', pose: 'frente' } }];
  const antes = F.resolver({ indiceJson: F.leerIndice({ fotos: [{ fecha: '2026-08-01', pose: 'frente', archivo: 'foto_20260801_frente.jpg' }] }), guardadas });
  const despues = F.resolver({ indiceJson: F.leerIndice({ fotos: [{ fecha: '2026-07-20', pose: 'perfil', archivo: 'foto_20260801_frente.jpg' }] }), guardadas });
  assert.equal(antes[0].pose, 'frente');
  assert.equal(despues[0].pose, 'perfil');
  assert.equal(despues[0].fecha, '2026-07-20');
});

test('medidas del índice del ZIP distintas de la copia se cuentan', () => {
  const j = F.leerIndice({ registros: [{ fecha: '2026-08-01', sitio: 'cintura', cm: 84 }] });
  const z = F.leerIndice({ registros: [{ fecha: '2026-08-01', sitio: 'cintura', cm: 86 }, { fecha: '2026-07-01', sitio: 'pecho', cm: 100 }] });
  assert.equal(F.registrosDistintos(j, z), 2);
});

test('índice tolerante: pose desconocida se lee como frente, entradas rotas se descartan', () => {
  const idx = F.leerIndice({ fotos: [
    { fecha: '2026-08-01', pose: 'lateral', archivo: 'a.jpg' },
    { fecha: 'mal', pose: 'frente', archivo: 'b.jpg' },
    { fecha: '2026-08-01', pose: 'frente', archivo: '../c.jpg' },
  ] });
  assert.equal(idx.fotos.size, 1);
  assert.equal(idx.fotos.get('a.jpg').pose, 'frente');
  assert.equal(idx.fotos.get('a.jpg').poseDesconocida, true);
  assert.equal(idx.descartadas, 2);
  assert.equal(I.archivoValido('a.jpg'), true);
});
