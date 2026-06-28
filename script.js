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
