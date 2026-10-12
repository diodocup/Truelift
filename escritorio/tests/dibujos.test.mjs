// Dibujos de los ejercicios: el escritorio enseña los de la biblioteca de la
// app, que ya publica el Coach en ../coach/media/ejercicios/. Datos sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cargar, cargarCoach, copiaRica } from './comun.mjs';

cargarCoach('motor.js', 'data.js', 'nutricion.js', 'charts.js', 'catalogo.js', 'canonico.js');
const { Analisis, VistasEsc, DibujosEsc, CAT_FICHA } = cargar('analisis.js', 'vistas.js');

const dir = new URL('../', import.meta.url);
// Las rutas son relativas a escritorio/ y van codificadas (acentos, espacios).
const existe = ruta => fs.existsSync(new URL(decodeURIComponent(ruta), dir));

test('cada ejercicio de la biblioteca con dibujo apunta a un archivo que existe', () => {
  const conDibujo = Object.keys(CAT_FICHA).filter(n => CAT_FICHA[n].img);
  assert.ok(conDibujo.length > 300, `con dibujo: ${conDibujo.length}`);
  for (const n of conDibujo){
    const s = DibujosEsc.src(n);
    assert.ok(s && s.startsWith('../coach/media/ejercicios/'), n);
    assert.ok(existe(s), `falta el dibujo de ${n}: ${s}`);
  }
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
  assert.match(h, /ej-dibujo-xl" src="\.\.\/coach\/media\/ejercicios\/Sentadilla%20con%20barra\.webp"/);
  assert.match(h, /Grupo/);
});

test('las vistas de entrenamiento y rutina enseñan los dibujos', () => {
  const resumen = { ultimoRegistro: '2026-07-02' };
  const M = Analisis.preparar(copiaRica(), resumen);
  const img = /<img class="ej-dibujo[^"]*" src="\.\.\/coach\/media\/ejercicios\/Sentadilla%20con%20barra\.webp"/;
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
