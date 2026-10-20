'use strict';
/* TrueLift Escritorio — tema de la pantalla.

   Como en la app (16/10/2026): oscuro, el de siempre, o claro «Tiza». Por
   defecto el escritorio usa el que tienes en la app: la copia trae
   `temaClaro`, y se recuerda aquí para pintar la página bien desde el primer
   fotograma (la copia vive en IndexedDB y llega después). También se puede
   fijar oscuro o claro solo en este navegador. Es una comodidad de quien
   mira: si el navegador no deja guardar, la página sigue en oscuro.

   Va en <head>, antes de las hojas de estilo, y no depende de nada más. Solo
   cambia la pantalla: el informe impreso conserva sus colores de papel. */
const TemaEsc = (() => {
  const CLAVE = 'tl-escritorio-tema';          // 'app' | 'oscuro' | 'claro'
  const CLAVE_APP = 'tl-escritorio-tema-app';  // el de la última copia: 'oscuro' | 'claro'
  const leer = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* sin almacenamiento: no se recuerda */ } };
  const FONDO = { oscuro: '#0A0C0B', claro: '#F3F5F2' };

  function eleccion(){ const v = leer(CLAVE); return v === 'oscuro' || v === 'claro' ? v : 'app'; }
  function deLaApp(){ return leer(CLAVE_APP) === 'claro' ? 'claro' : 'oscuro'; }
  function efectivo(){ const e = eleccion(); return e === 'app' ? deLaApp() : e; }
  function aplicar(){
    if (typeof document === 'undefined') return;
    const t = efectivo();
    document.documentElement.dataset.tema = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', FONDO[t]);
  }
  function elegir(v){ escribir(CLAVE, v === 'oscuro' || v === 'claro' ? v : 'app'); aplicar(); }
  /* El tema de la app según la copia importada; copias anteriores a la clave
     no lo traen y no cambian lo recordado. */
  function desdeCopia(raw){
    if (!raw || typeof raw.temaClaro !== 'boolean') return;
    escribir(CLAVE_APP, raw.temaClaro ? 'claro' : 'oscuro');
    aplicar();
  }
  aplicar();
  return { eleccion, efectivo, deLaApp, elegir, desdeCopia, aplicar };
})();
