// Imágenes de los ejercicios: el escritorio enseña las mismas que la app, la
// foto de RepDB (media/repdb/) si el ejercicio la tiene; si no, la ilustración
// propia de TrueLift (media/propias/); y si tampoco, el dibujo propio que ya
// publica el Coach en ../coach/media/ejercicios/. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js', 'canonico.js');
const { Analisis, VistasEsc, DibujosEsc, CAT_FICHA, REPDB_FOTO } = cargar('analisis.js', 'vistas.js');

// `const` de un script clásico: no cuelga de globalThis, pero sí del realm.
const PROPIA_FOTO = vm.runInThisContext('PROPIA_FOTO');
const dir = new URL('../', import.meta.url);
// Las rutas son relativas a escritorio/ y van codificadas (acentos, espacios).
const existe = ruta => fs.existsSync(new URL(decodeURIComponent(ruta), dir));

test('cada ejercicio de la biblioteca con imagen apunta a un archivo que existe, con las dos figuras', () => {
  const conDibujo = Object.keys(CAT_FICHA).filter(n => CAT_FICHA[n].img);
  assert.ok(conDibujo.length > 300, `con dibujo: ${conDibujo.length}`);
  try {
    for (const figura of ['hombre', 'mujer']){
      DibujosEsc.figuraDesdeCopia({ sexoUsuario: figura });
      for (const n of conDibujo){
        const s = DibujosEsc.src(n);
        if (Object.hasOwn(REPDB_FOTO, n)) assert.equal(s, `media/repdb/${figura}/${REPDB_FOTO[n]}.webp`, n);
        else if (Object.hasOwn(PROPIA_FOTO, n)) assert.equal(s, `media/propias/${figura}/${PROPIA_FOTO[n][figura]}.webp`, n);
        else assert.ok(s && s.startsWith('../coach/media/ejercicios/'), n);
        assert.ok(existe(s), `falta la imagen de ${n}: ${s}`);
      }
    }
  } finally { DibujosEsc.figuraDesdeCopia(null); }
});

test('las fotos de RepDB solo cubren ejercicios de la biblioteca; el resto conserva su dibujo', () => {
  const fotos = Object.keys(REPDB_FOTO);
  assert.ok(fotos.length > 200, `con foto: ${fotos.length}`);
  for (const n of fotos) assert.ok(CAT_FICHA[n], `${n} no está en la biblioteca`);
  // Sin foto ni ilustración: el dibujo de siempre, que se invierte en claro.
  const sinFoto = Object.keys(CAT_FICHA).find(n => CAT_FICHA[n].img
    && !Object.hasOwn(REPDB_FOTO, n) && !Object.hasOwn(PROPIA_FOTO, n));
  assert.ok(sinFoto);
  const s = DibujosEsc.src(sinFoto);
  assert.match(s, /^\.\.\/coach\/media\/ejercicios\//);
  assert.equal(DibujosEsc.esFoto(s), false);
  assert.doesNotMatch(DibujosEsc.mini(sinFoto), /ej-foto/);
});

test('las ilustraciones propias cubren ejercicios de la biblioteca sin RepDB, como en la app', () => {
  const propias = Object.keys(PROPIA_FOTO);
  assert.ok(propias.length >= 36, `con ilustración: ${propias.length}`);
  for (const n of propias){
    assert.ok(CAT_FICHA[n], `${n} no está en la biblioteca`);
    assert.ok(!Object.hasOwn(REPDB_FOTO, n), `${n} también tiene foto de RepDB`);
  }
  try {
    const s = DibujosEsc.src('Abducción en polea');
    assert.equal(s, 'media/propias/hombre/abduccion-en-polea-peak.webp');
    // Se pinta en color, sin invertir en el tema claro.
    assert.equal(DibujosEsc.esFoto(s), true);
    assert.match(DibujosEsc.mini('Abducción en polea'), /ej-foto/);
    // Si la figura solo tiene la foto de inicio, el inicio (la femenina aquí).
    assert.equal(DibujosEsc.src('Pullover en máquina'), 'media/propias/hombre/pullover-en-maquina-peak.webp');
    DibujosEsc.figuraDesdeCopia({ sexoUsuario: 'mujer' });
    assert.equal(DibujosEsc.src('Pullover en máquina'), 'media/propias/mujer/pullover-en-maquina-start.webp');
    // Solo inicio en las dos figuras.
    assert.equal(DibujosEsc.src('Peso muerto en Smith'), 'media/propias/mujer/peso-muerto-en-smith-start.webp');
  } finally { DibujosEsc.figuraDesdeCopia(null); }
});

test('la figura de las fotos sigue el sexo declarado, como en la app', () => {
  try {
    DibujosEsc.figuraDesdeCopia({ sexoUsuario: 'mujer' });
    assert.equal(DibujosEsc.src('Sentadilla con barra'), 'media/repdb/mujer/squat-peak.webp');
    // Copias anteriores a la pregunta: el reparto de entonces.
    DibujosEsc.figuraDesdeCopia({ sexo: 'mujer' });
    assert.match(DibujosEsc.src('Sentadilla con barra'), /\/mujer\//);
    // Declarado aunque la rutina sea otra.
    DibujosEsc.figuraDesdeCopia({ sexo: 'mujer', sexoUsuario: 'hombre' });
    assert.match(DibujosEsc.src('Sentadilla con barra'), /\/hombre\//);
    // Sin declarar o sin copia: la masculina.
    DibujosEsc.figuraDesdeCopia({});
    assert.match(DibujosEsc.src('Sentadilla con barra'), /\/hombre\//);
    DibujosEsc.figuraDesdeCopia(null);
    assert.match(DibujosEsc.src('Sentadilla con barra'), /\/hombre\//);
    // Los isométricos solo tienen una postura.
    assert.equal(DibujosEsc.src('L-sit'), 'media/repdb/hombre/l-sit-main.webp');
  } finally { DibujosEsc.figuraDesdeCopia(null); }
});

test('las fotos llevan su clase para no invertirse en el tema claro', () => {
  assert.match(DibujosEsc.mini('Sentadilla con barra'), /class="ej-dibujo ej-dibujo-s ej-foto"/);
  assert.match(DibujosEsc.grande('Sentadilla con barra'), /ej-foto/);
  assert.match(DibujosEsc.fichaHtml('Sentadilla con barra'), /ej-dibujo-xl ej-foto/);
  const css = fs.readFileSync(new URL('escritorio.css', dir), 'utf8');
  assert.match(css, /img\.ej-dibujo:not\(\.ej-foto\)\{filter:invert/);
});

test('un ejercicio propio reserva el hueco con su inicial, sin imagen rota', () => {
  assert.equal(DibujosEsc.src('Mi ejercicio raro'), null);
  const h = DibujosEsc.mini('mi ejercicio raro');
  assert.match(h, /ej-dibujo-hueco/);
  assert.match(h, />M</);
  assert.doesNotMatch(h, /<img/);
  // Sin dibujo no hay botón de ampliar.
  assert.doesNotMatch(DibujosEsc.grande('Mi ejercicio raro'), /<button/);
  assert.match(DibujosEsc.fichaHtml('Mi ejercicio raro'), /no tiene dibujo/);
});

test('los nombres traducidos del Excel de la app encuentran su dibujo', () => {
  assert.equal(DibujosEsc.src('Barbell bench press'), DibujosEsc.src('Press banca con barra'));
  assert.ok(DibujosEsc.src('Barbell bench press'));
});

test('el nombre importado se escapa en todos los atributos', () => {
  const n = 'Curl "raro" <b>x</b>';
  for (const h of [DibujosEsc.mini(n, { extra: ` data-ejercicio="${n.replace(/"/g, '&quot;')}"` }), DibujosEsc.grande(n), DibujosEsc.fichaHtml(n)])
    assert.doesNotMatch(h, /<b>x<\/b>/);
  const g = DibujosEsc.grande('Press banca con barra');
  assert.match(g, /data-dibujo="Press banca con barra"/);
  assert.match(g, /aria-label="Ampliar el dibujo de Press banca con barra"/);
});

test('la ficha ampliada trae el dibujo grande y lo que cuenta la app', () => {
  const h = DibujosEsc.fichaHtml('Sentadilla con barra');
  assert.match(h, /<h2 id="modalTitulo">Sentadilla con barra<\/h2>/);
  assert.match(h, /ej-dibujo-xl ej-foto" src="media\/repdb\/hombre\/squat-peak\.webp"/);
  assert.match(h, /Grupo/);
});

test('las vistas de entrenamiento y rutina enseñan los dibujos', () => {
  const resumen = { ultimoRegistro: '2026-07-02' };
  const M = Analisis.preparar(copiaRica(), resumen);
  const img = /<img class="ej-dibujo[^"]*" src="media\/repdb\/hombre\/squat-peak\.webp"/;
  // Tabla de ejercicios: la miniatura también lleva a la ficha.
  const lista = VistasEsc.entrenamiento(M, { sub: 'ejercicios' });
  assert.match(lista, img);
  assert.match(lista, /<img [^>]*alt="" [^>]*data-ejercicio="Sentadilla con barra"/);
  // Ficha: dibujo grande que se amplía, y miniaturas en la lista lateral.
  const ficha = VistasEsc.entrenamiento(M, { sub: 'ejercicios', ejercicio: 'Sentadilla con barra' });
  assert.match(ficha, /class="ej-dibujo-btn" data-dibujo="Sentadilla con barra"/);
  assert.match(ficha, /ficha-item[\s\S]*?ej-dibujo-xs/);
  // Sesión y rutina del móvil.
  assert.match(VistasEsc.detalleSesionHtml(M, M.sesiones.find(s => s.entradas.some(e => e.ejercicio === 'Sentadilla con barra')).indice), img);
  assert.match(VistasEsc.rutina(M), img);
});
