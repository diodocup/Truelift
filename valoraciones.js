// Nota de las tiendas y reseñas que van pasando solas en el hero.
// Los datos los genera a diario .github/scripts/actualizar-valoraciones.mjs en
// valoraciones.json; si el archivo no existe o está vacío, el bloque sigue oculto.
(function () {
  "use strict";

  const bloque = document.querySelector("[data-social-proof]");
  if (!bloque || !window.fetch) return;

  const notas = bloque.querySelector("[data-store-ratings]");
  const rotador = bloque.querySelector("[data-review-rotator]");
  const visor = bloque.querySelector("[data-review-viewport]");
  const puntos = bloque.querySelector("[data-review-dots]");

  const INTERVALO = 6500;
  const MAX_RESENAS = 12;
  const MAX_CARACTERES = 240;

  const enlaces = {
    android: "https://play.google.com/store/apps/details?id=es.rubensoro.truelift&pcampaignid=web_share",
    ios: "https://apps.apple.com/es/app/truelift-programaci%C3%B3n-fuerza/id6803201895"
  };
  const nombresTienda = { android: "Google Play", ios: "App Store" };

  const textos = {
    es: {
      valoraciones: (n) => `${n} ${n === 1 ? "valoración" : "valoraciones"}`,
      estrellas: (n) => `${n} de 5 estrellas`,
      resena: (i, n) => `Reseña ${i} de ${n}`,
      anonimo: "Usuario"
    },
    en: {
      valoraciones: (n) => `${n} ${n === 1 ? "rating" : "ratings"}`,
      estrellas: (n) => `${n} out of 5 stars`,
      resena: (i, n) => `Review ${i} of ${n}`,
      anonimo: "User"
    },
    "pt-BR": {
      valoraciones: (n) => `${n} ${n === 1 ? "avaliação" : "avaliações"}`,
      estrellas: (n) => `${n} de 5 estrelas`,
      resena: (i, n) => `Avaliação ${i} de ${n}`,
      anonimo: "Usuário"
    }
  };

  let datos = null;
  let tarjetas = [];
  let actual = 0;
  let temporizador = null;
  let pausado = false;

  const idioma = () => (textos[document.documentElement.lang] ? document.documentElement.lang : "es");

  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }

  // Estrellas con relleno parcial: 4,6 pinta cuatro llenas y el 60 % de la quinta.
  function estrellas(valor) {
    const caja = crear("span", "stars");
    caja.setAttribute("aria-hidden", "true");
    caja.append(crear("span", "stars-base", "★★★★★"));
    const relleno = crear("span", "stars-fill", "★★★★★");
    relleno.style.width = `${Math.max(0, Math.min(5, valor)) * 20}%`;
    caja.append(relleno);
    return caja;
  }

  function recortar(texto) {
    if (texto.length <= MAX_CARACTERES) return texto;
    const corte = texto.slice(0, MAX_CARACTERES);
    return `${corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s,.;:!?-]+$/, "")}…`;
  }

  // Primero las del idioma de la página; si hay pocas, también las demás.
  function elegirResenas(lista) {
    const lang = idioma();
    const propias = lista.filter((r) => r.idioma === lang);
    const elegidas = propias.length >= 2 ? propias : [...propias, ...lista.filter((r) => r.idioma !== lang)];
    return elegidas.slice(0, MAX_RESENAS);
  }

  function pintarNotas() {
    const t = textos[idioma()];
    const formato = new Intl.NumberFormat(idioma(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    notas.replaceChildren();
    ["android", "ios"].forEach((tienda) => {
      const info = datos[tienda];
      if (!info || !info.nota) return;
      const enlace = crear("a", "store-rating");
      enlace.href = enlaces[tienda];
      enlace.target = "_blank";
      enlace.rel = "noopener";
      enlace.setAttribute("aria-label", `${nombresTienda[tienda]}: ${t.estrellas(formato.format(info.nota))}, ${t.valoraciones(info.total)}`);
      enlace.append(crear("span", "store-rating-score", formato.format(info.nota)));
      enlace.append(estrellas(info.nota));
      const pie = crear("span", "store-rating-label", nombresTienda[tienda]);
      if (info.total) pie.append(crear("span", "store-rating-count", ` (${info.total})`));
      enlace.append(pie);
      notas.append(enlace);
    });
    notas.hidden = !notas.children.length;
  }

  function pintarResenas() {
    const t = textos[idioma()];
    const lista = elegirResenas(datos.resenas || []);
    visor.replaceChildren();
    puntos.replaceChildren();
    tarjetas = lista.map((r, i) => {
      const tarjeta = crear("blockquote", "review-card");
      tarjeta.setAttribute("aria-roledescription", "slide");
      tarjeta.setAttribute("aria-label", t.resena(i + 1, lista.length));
      const cabecera = crear("div", "review-stars");
      cabecera.append(estrellas(r.estrellas));
      cabecera.setAttribute("role", "img");
      cabecera.setAttribute("aria-label", t.estrellas(r.estrellas));
      tarjeta.append(cabecera);
      tarjeta.append(crear("p", "review-text", `“${recortar(r.texto)}”`));
      const pie = crear("footer", "review-meta");
      pie.append(crear("span", "review-author", r.autor || t.anonimo));
      pie.append(crear("span", "review-store", nombresTienda[r.tienda] || ""));
      tarjeta.append(pie);
      visor.append(tarjeta);

      if (lista.length > 1) {
        const punto = crear("button", "review-dot");
        punto.type = "button";
        punto.setAttribute("aria-label", t.resena(i + 1, lista.length));
        punto.addEventListener("click", () => {
          mostrar(i);
          programar();
        });
        puntos.append(punto);
      }
      return tarjeta;
    });
    rotador.hidden = !tarjetas.length;
    puntos.hidden = tarjetas.length < 2;
    mostrar(Math.min(actual, Math.max(0, tarjetas.length - 1)));
    programar();
  }

  function mostrar(indice) {
    if (!tarjetas.length) return;
    actual = (indice + tarjetas.length) % tarjetas.length;
    tarjetas.forEach((tarjeta, i) => {
      const activa = i === actual;
      tarjeta.classList.toggle("is-active", activa);
      tarjeta.setAttribute("aria-hidden", String(!activa));
    });
    puntos.querySelectorAll(".review-dot").forEach((punto, i) => {
      punto.setAttribute("aria-current", String(i === actual));
    });
  }

  function programar() {
    clearInterval(temporizador);
    temporizador = null;
    if (tarjetas.length < 2 || pausado || document.hidden) return;
    temporizador = setInterval(() => mostrar(actual + 1), INTERVALO);
  }

  function pintar() {
    if (!datos) return;
    pintarNotas();
    pintarResenas();
    bloque.hidden = notas.hidden && rotador.hidden;
  }

  // Pausa al pasar el ratón o enfocar con el teclado, y cuando la pestaña no se ve.
  const pausar = (valor) => {
    pausado = valor;
    programar();
  };
  rotador.addEventListener("mouseenter", () => pausar(true));
  rotador.addEventListener("mouseleave", () => pausar(false));
  rotador.addEventListener("focusin", () => pausar(true));
  rotador.addEventListener("focusout", () => pausar(false));
  document.addEventListener("visibilitychange", programar);

  // Deslizar con el dedo en móvil.
  let inicioX = null;
  visor.addEventListener("touchstart", (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener("touchend", (e) => {
    if (inicioX == null) return;
    const delta = e.changedTouches[0].clientX - inicioX;
    inicioX = null;
    if (Math.abs(delta) < 40) return;
    mostrar(actual + (delta < 0 ? 1 : -1));
    programar();
  });

  // El selector de idioma cambia <html lang>: volvemos a pintar con los textos nuevos.
  new MutationObserver(pintar).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  fetch("valoraciones.json", { cache: "no-cache" })
    .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
    .then((json) => {
      if (!json) return;
      datos = json;
      pintar();
    })
    .catch(() => {});
})();
