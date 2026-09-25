/*
 * truelift.es · puente de atribución entre el anuncio de ChatGPT y las tiendas
 *
 * Cargar al final de index.html:  <script src="atribucion-tiendas.js" defer></script>
 *
 * QUÉ HACE
 *  1. Si la visita llega de un anuncio de OpenAI (URL con `oppref` y/o
 *     utm_source=openai_ads), reescribe TODOS los enlaces a Google Play para que
 *     lleven `referrer=utm_source=openai_ads&…&oppref=…`. Play entrega ese texto
 *     a la app tras instalar (Install Referrer API): así la app sabe que viene
 *     de ChatGPT y Firebase atribuye su first_open a openai_ads / campaña / anuncio.
 *  2. Reescribe los enlaces a la App Store como enlace de campaña de App Store
 *     Connect (pt + ct) para ver descargas por campaña EN AGREGADO en iOS.
 *  3. (Opcional) Si el píxel de OpenAI está activo y hay consentimiento, envía
 *     el evento `clic_tienda`. Ese evento es INTENCIÓN, no instalación: nunca
 *     se configura como instalación ni como cliente.
 *
 * QUÉ NO HACE
 *  - No escribe cookies ni localStorage: `oppref` solo vive en memoria y dentro
 *    del enlace que la persona pulsa. (El píxel sí escribe cookies; por eso va
 *    detrás de consentimiento.)
 */
(function () {
  'use strict';

  // App Store Connect → App Analytics → Fuentes → "Crear enlace de campaña":
  // el número pt=… que aparece en el enlace generado.
  var APPLE_PROVIDER_TOKEN = '129321386';
  var APPLE_APP_ID = '6803201895';

  var q = new URLSearchParams(window.location.search);
  var oppref = q.get('oppref');
  var fuente = q.get('utm_source') || (oppref ? 'openai_ads' : null);
  if (fuente !== 'openai_ads') return; // resto de visitas: enlaces intactos

  var utm = {
    utm_source: 'openai_ads',
    utm_medium: q.get('utm_medium') || 'cpc',
    utm_campaign: q.get('utm_campaign') || 'openai',
    utm_content: q.get('utm_content') || '',
  };

  function referrerPlay() {
    var r = new URLSearchParams();
    Object.keys(utm).forEach(function (k) { if (utm[k]) r.set(k, utm[k]); });
    if (oppref) r.set('oppref', oppref);
    return r.toString();
  }

  function urlPlay(original) {
    try {
      var u = new URL(original);
      u.searchParams.delete('pcampaignid');
      u.searchParams.set('referrer', referrerPlay()); // URLSearchParams codifica el valor
      return u.toString();
    } catch (e) { return original; }
  }

  function urlAppStore(original) {
    if (!APPLE_PROVIDER_TOKEN || APPLE_PROVIDER_TOKEN.indexOf('PEGAR') === 0) return original;
    try {
      var u = new URL(original);
      // ct: máx. 30 caracteres, visible en App Analytics como "campaña".
      var ct = ('oai_' + (utm.utm_content || utm.utm_campaign)).slice(0, 30);
      u.searchParams.set('pt', APPLE_PROVIDER_TOKEN);
      u.searchParams.set('ct', ct);
      u.searchParams.set('mt', '8');
      return u.toString();
    } catch (e) { return original; }
  }

  function esPlay(h) { return /play\.google\.com\/store\/apps\/details/.test(h || ''); }
  function esApple(h) { return /apps\.apple\.com\//.test(h || '') && h.indexOf(APPLE_APP_ID) !== -1; }

  function reescribir() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (esPlay(h)) { a.setAttribute('href', urlPlay(h)); a.dataset.tienda = 'android'; }
      else if (esApple(h)) { a.setAttribute('href', urlAppStore(h)); a.dataset.tienda = 'ios'; }
    });
    // Botones que eligen tienda por JS (script.js lee estos atributos).
    document.querySelectorAll('[data-store-android]').forEach(function (el) {
      el.setAttribute('data-store-android', urlPlay(el.getAttribute('data-store-android')));
    });
    document.querySelectorAll('[data-store-ios]').forEach(function (el) {
      el.setAttribute('data-store-ios', urlAppStore(el.getAttribute('data-store-ios')));
    });
  }

  // Micro-conversión web: SOLO intención de descarga. Requiere píxel + consentimiento.
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-tienda], [data-store-android], [data-store-ios]');
    if (!a || typeof window.oaiq !== 'function') return;
    var tienda = a.dataset.tienda || 'auto';
    window.oaiq('measure', 'custom', { type: 'custom', tienda: tienda },
      { custom_event_name: 'clic_tienda' });
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reescribir);
  else reescribir();
})();
