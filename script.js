document.documentElement.classList.add("js");

const screens = [
  {
    label: "Registro",
    src: "Screenshot_2026-07-04-19-16-02-551_es.rubensoro.truelift.jpg",
    alt: "Registro de rutina con recomendación de carga y estado para entrenar",
  },
  {
    label: "Registro · RIR",
    src: "Screenshot_2026-07-04-19-15-09-688_es.rubensoro.truelift.jpg",
    alt: "Registro de rutina con consolidación de carga por RIR inferior al objetivo",
  },
  {
    label: "Autorregulación",
    src: "Screenshot_2026-07-04-19-15-31-412_es.rubensoro.truelift.jpg",
    alt: "Formulario de autorregulación diaria con sueño, energía, estrés, dolor articular y VFC",
  },
  {
    label: "Progreso · Informe",
    src: "Screenshot_2026-07-04-19-13-40-804_es.rubensoro.truelift.jpg",
    alt: "Informe mensual con disponibilidad reciente, estado para entrenar y rendimiento de sesión",
  },
  {
    label: "Progreso · VFC",
    src: "Screenshot_2026-07-04-19-13-36-841_es.rubensoro.truelift.jpg",
    alt: "Pantalla de progreso con rendimiento neto diario, VFC por día y marcas personales",
  },
  {
    label: "Progreso · Tonelaje",
    src: "Screenshot_2026-07-04-19-14-22-056_es.rubensoro.truelift.jpg",
    alt: "Pantalla de progreso con tonelaje por sesión y 1RM estimado por ejercicio",
  },
  {
    label: "Progreso · e1RM",
    src: "Screenshot_2026-07-04-19-14-10-994_es.rubensoro.truelift.jpg",
    alt: "Pantalla de progreso con evolución del e1RM estimado y repeticiones totales por sesión",
  },
  {
    label: "Volumen",
    src: "Screenshot_2026-07-04-19-16-18-341_es.rubensoro.truelift.jpg",
    alt: "Pantalla de volumen semanal con series efectivas y frecuencia por grupo muscular",
  },
  {
    label: "Rutina PRO",
    src: "Screenshot_2026-07-04-19-16-35-066_es.rubensoro.truelift.jpg",
    alt: "Pantalla de rutina PRO con importación, exportación, creación de ejercicios y personalización",
  },
];

const legacyImageMap = new Map([
  ["Screenshot_20260628_100329.jpg", screens[3]],
  ["Screenshot_20260628_100348.jpg", screens[7]],
  ["Screenshot_20260628_100505.jpg", screens[0]],
  ["Screenshot_20260628_100415.jpg", screens[8]],
  ["Screenshot_20260628_100435.jpg", screens[1]],
  ["Screenshot_20260628_100529.jpg", screens[2]],
  ["Screenshot_20260628_100728.jpg", screens[4]],
]);

document.querySelectorAll("img").forEach((img) => {
  const replacement = legacyImageMap.get(img.getAttribute("src") || "");
  if (!replacement) return;
  img.src = replacement.src;
  img.alt = replacement.alt;
});

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      document.body.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const gallery = document.querySelector("[data-gallery]");

if (gallery) {
  const image = gallery.querySelector("[data-gallery-image]");
  const thumbs = gallery.querySelector(".screen-thumbs");

  if (image instanceof HTMLImageElement) {
    image.src = screens[0].src;
    image.alt = screens[0].alt;
  }

  if (thumbs instanceof HTMLElement) {
    thumbs.innerHTML = "";

    screens.forEach((screen, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.src = screen.src;
      button.dataset.alt = screen.alt;
      if (index === 0) button.classList.add("is-active");

      const thumb = document.createElement("img");
      thumb.src = screen.src;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";

      const label = document.createElement("span");
      label.textContent = screen.label;

      button.append(thumb, label);
      thumbs.append(button);
    });
  }

  const buttons = gallery.querySelectorAll("[data-src]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!(image instanceof HTMLImageElement)) return;

      buttons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      image.src = button.dataset.src || image.src;
      image.alt = button.dataset.alt || image.alt;
    });
  });
}

// Aparición suave al hacer scroll
const revealTargets = document.querySelectorAll("[data-reveal]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (revealTargets.length && "IntersectionObserver" in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}
