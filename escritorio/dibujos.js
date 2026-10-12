'use strict';
/* ================================================================
   TrueLift Escritorio — dibujos.js
   Dibujo de cada ejercicio de la biblioteca de TrueLift, el mismo que
   ves en la app. No se duplican: son los que el Coach ya publica en
   ../coach/media/ejercicios/ (copiados de la app por el generador de
   catalogo.js), así que una biblioteca nueva llega a los dos a la vez.

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

const limpio = nombre => String(nombre ?? '').trim();

/* Nombre de la biblioteca. La copia guarda los nombres en castellano, pero
   un Excel exportado con la app en inglés o portugués los trae traducidos:
   canonico.js los devuelve al castellano, como hace la app. */
function canonico(n){
  if (typeof CAT_FICHA === 'object' && CAT_FICHA[n]) return n;
  return typeof CANON_ES === 'object' && CANON_ES[n] ? CANON_ES[n] : n;
}

/** Ruta del dibujo de un ejercicio, o null si no está en la biblioteca. */
function src(nombre){
  const r = typeof imagenEjercicio === 'function' ? imagenEjercicio(canonico(limpio(nombre))) : null;
  return r ? BASE + r : null;
}

function hueco(n, clase){
  return `<span class="ej-dibujo ${clase} ej-dibujo-hueco" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`;
}

/* Miniatura decorativa. `extra` son atributos ya escapados por quien llama
   (p. ej. data-ejercicio para que pulsarla haga lo mismo que el nombre). */
function mini(nombre, { clase = 'ej-dibujo-s', extra = '' } = {}){
  const n = limpio(nombre), s = src(n);
  if (!s) return hueco(n, clase);
  return `<img class="ej-dibujo ${clase}" src="${esc(s)}" alt="" loading="lazy" decoding="async"${extra}>`;
}

/* Dibujo que abre la ficha ampliada: un botón de verdad, con nombre, para
   llegar también con el teclado. Sin dibujo queda el hueco, sin botón. */
function grande(nombre, { clase = 'ej-dibujo-l' } = {}){
  const n = limpio(nombre), s = src(n);
  if (!s) return hueco(n, clase);
  return `<button type="button" class="ej-dibujo-btn" data-dibujo="${esc(n)}" aria-label="Ampliar el dibujo de ${esc(n)}" title="Ampliar el dibujo">`
    + `<img class="ej-dibujo ${clase}" src="${esc(s)}" alt="" decoding="async"></button>`;
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
        <img class="ej-dibujo ej-dibujo-xl" src="${esc(s)}" alt="Dibujo de ${esc(n)}" decoding="async">
        ${datos ? `<div class="ej-ficha-datos">${datos}</div>` : ''}
      </div>`
    : '<p class="muted">Este ejercicio no está en la biblioteca de TrueLift (lo creaste tú o llegó de otra app), así que no tiene dibujo.</p>';
  return `<h2 id="modalTitulo">${esc(n)}</h2>${cuerpo}`;
}

return { src, mini, grande, celda, fichaHtml };
})();
