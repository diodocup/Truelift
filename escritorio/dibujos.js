'use strict';
/* ================================================================
   TrueLift Escritorio — dibujos.js
   Imagen de cada ejercicio de la biblioteca de TrueLift, la misma que
   ves en la app:
   - si el ejercicio tiene foto de RepDB (repdb.js), esa foto, con la
     figura del sexo que declaraste (media/repdb/<hombre|mujer>/,
     copiadas de la app por tool/escritorio_repdb.py). Es una figura en
     color sobre fondo transparente: se pinta tal cual, sin invertir.
   - si RepDB no lo tiene pero hay ficha propia de TrueLift, su
     ilustración en el mismo estilo (media/propias/<hombre|mujer>/, mapa
     PROPIA_FOTO de repdb.js, mismo script): el final del movimiento o,
     si esa figura solo tiene el inicio, el inicio. También en color.
   - si no, el dibujo propio que ya publica el Coach en
     ../coach/media/ejercicios/ (copiados de la app por el generador de
     catalogo.js). Trazo blanco sobre negro.

   - mini(): miniatura junto al nombre en tablas y listas. Es decorativa
     (alt vacío): el nombre que la acompaña ya dice qué ejercicio es.
   - grande(): dibujo pulsable que abre la ficha ampliada.
   - fichaHtml(): contenido del modal con el dibujo a tamaño grande y lo
     que la app cuenta del ejercicio (grupo, patrón, descanso, técnica).

   Los ejercicios que creaste tú o importaste de otra app no están en la
   biblioteca y no tienen dibujo: su hueco lleva la inicial sobre fondo
   apagado, nunca un recuadro roto. Al imprimir no salen (../coach/
   styles.css los oculta): sobre papel serían cuadrados negros.
   ================================================================ */

const DibujosEsc = (() => {

// imagenEjercicio() (catalogo.js) devuelve la ruta relativa al Coach.
const BASE = '../coach/';
const FOTOS = 'media/repdb/';
const PROPIAS = 'media/propias/';

/* Figura de las fotos de RepDB, como `personajeLaminas` en la app: la de
   mujer solo si la copia lo declara; sin declarar, la de hombre. */
let figura = 'hombre';
function figuraDesdeCopia(raw){
  const s = raw && typeof raw === 'object'
    ? (raw.sexoUsuario ?? (raw.sexo === 'hombre' || raw.sexo === 'mujer' ? raw.sexo : null))
    : null;
  figura = s === 'mujer' ? 'mujer' : 'hombre';
}

const limpio = nombre => String(nombre ?? '').trim();

/* Nombre de la biblioteca. La copia guarda los nombres en castellano, pero
   un Excel exportado con la app en inglés o portugués los trae traducidos:
   canonico.js los devuelve al castellano, como hace la app. */
function canonico(n){
  if (typeof CAT_FICHA === 'object' && CAT_FICHA[n]) return n;
  return typeof CANON_ES === 'object' && CANON_ES[n] ? CANON_ES[n] : n;
}

/** Ruta de la imagen de un ejercicio, o null si no está en la biblioteca. */
function src(nombre){
  const n = canonico(limpio(nombre));
  const foto = typeof REPDB_FOTO === 'object' && Object.hasOwn(REPDB_FOTO, n) ? REPDB_FOTO[n] : null;
  if (foto) return `${FOTOS}${figura}/${foto}.webp`;
  const propia = typeof PROPIA_FOTO === 'object' && Object.hasOwn(PROPIA_FOTO, n) ? PROPIA_FOTO[n] : null;
  if (propia && propia[figura]) return `${PROPIAS}${figura}/${propia[figura]}.webp`;
  const r = typeof imagenEjercicio === 'function' ? imagenEjercicio(n) : null;
  return r ? BASE + r : null;
}

/** ¿Es [ruta] una foto en color (RepDB o ilustración propia) y no un
    dibujo de trazo blanco? */
const esFoto = ruta => typeof ruta === 'string' && (ruta.startsWith(FOTOS) || ruta.startsWith(PROPIAS));
const claseFoto = s => esFoto(s) ? ' ej-foto' : '';

function hueco(n, clase){
  return `<span class="ej-dibujo ${clase} ej-dibujo-hueco" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`;
}

/* Miniatura decorativa. `extra` son atributos ya escapados por quien llama
   (p. ej. data-ejercicio para que pulsarla haga lo mismo que el nombre). */
function mini(nombre, { clase = 'ej-dibujo-s', extra = '' } = {}){
  const n = limpio(nombre), s = src(n);
  if (!s) return hueco(n, clase);
  return `<img class="ej-dibujo ${clase}${claseFoto(s)}" src="${esc(s)}" alt="" loading="lazy" decoding="async"${extra}>`;
}

/* Dibujo que abre la ficha ampliada: un botón de verdad, con nombre, para
   llegar también con el teclado. Sin dibujo queda el hueco, sin botón. */
function grande(nombre, { clase = 'ej-dibujo-l' } = {}){
  const n = limpio(nombre), s = src(n);
  if (!s) return hueco(n, clase);
  return `<button type="button" class="ej-dibujo-btn" data-dibujo="${esc(n)}" aria-label="Ampliar el dibujo de ${esc(n)}" title="Ampliar el dibujo">`
    + `<img class="ej-dibujo ${clase}${claseFoto(s)}" src="${esc(s)}" alt="" decoding="async"></button>`;
}

/* Celda de tabla: miniatura y, a su lado, el nombre (normalmente el enlace
   a la ficha) con lo que vaya debajo. Todo el HTML llega ya escapado. */
function celda(nombre, contenidoHtml, { clase = 'ej-dibujo-s', extra = '' } = {}){
  return `<div class="ej-celda">${mini(nombre, { clase, extra })}<div class="ej-celda-txt">${contenidoHtml}</div></div>`;
}

/* Ficha ampliada para el modal. */
function fichaHtml(nombre){
  const n = limpio(nombre), s = src(n);
  const f = typeof CAT_FICHA === 'object' ? CAT_FICHA[canonico(n)] : null;
  const linea = (etq, val) => val ? `<div class="kv"><span class="muted">${etq}</span><b>${esc(val)}</b></div>` : '';
  const datos = f
    ? linea('Grupo', f.grupo) + linea('Patrón', f.patron)
      + linea('También trabaja', (f.secundarios || []).join(', '))
      + linea('Descanso sugerido', f.descanso)
      + (f.nota ? `<p class="ej-nota">${esc(f.nota)}</p>` : '')
    : '';
  const cuerpo = s
    ? `<div class="ej-ficha">
        <img class="ej-dibujo ej-dibujo-xl${claseFoto(s)}" src="${esc(s)}" alt="Dibujo de ${esc(n)}" decoding="async">
        ${datos ? `<div class="ej-ficha-datos">${datos}</div>` : ''}
      </div>`
    : '<p class="muted">Este ejercicio no está en la biblioteca de TrueLift (lo creaste tú o llegó de otra app), así que no tiene dibujo.</p>';
  return `<h2 id="modalTitulo">${esc(n)}</h2>${cuerpo}`;
}

return { src, esFoto, figuraDesdeCopia, mini, grande, celda, fichaHtml };
})();
