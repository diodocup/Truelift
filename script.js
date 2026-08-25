document.documentElement.classList.add("js");

const englishTranslations = {
  "TrueLift | Entrenamiento de fuerza y progresión automática": "TrueLift | Strength training and automatic progression",
  "App de fuerza e hipertrofia que decide cuánto peso cargar en cada serie y te explica por qué. Progresión automática, sin anuncios, sin cuenta y offline. Gratis en Android.": "Strength and hypertrophy app that decides how much weight to load on every set and explains why. Automatic progression, no ads, no account and offline. Free on Android.",
  "TrueLift | El entrenador que planifica tu progresión": "TrueLift | The coach that plans your progression",
  "TrueLift decide cuánto peso cargar en cada serie, te explica por qué y frena cuando acumulas fatiga. Gratis, sin anuncios y sin cuenta. 16 sesiones de entrenamiento con PRO incluidas.": "TrueLift decides how much weight to load on every set, explains why and holds back when fatigue builds up. Free, no ads, no account. 16 training sessions with PRO included.",

  "TrueLift inicio": "TrueLift home",
  "Abrir menú": "Open menu",
  "Cómo funciona": "How it works",
  "Progreso": "Progress",
  "Planes": "Plans",
  "Nutrición": "Nutrition",
  "Capturas": "Screenshots",
  "Seleccionar idioma": "Select language",
  "Descargar gratis": "Download free",

  "App de fuerza e hipertrofia · Android": "Strength and hypertrophy app · Android",
  "Un entrenador en tu bolsillo.": "A coach in your pocket.",
  "Las apps de registro guardan lo que haces. TrueLift decide lo que haces después: cuánto peso cargar en cada serie, cuándo mantener y cuándo frenar. Y te explica el porqué.": "Workout loggers save what you did. TrueLift decides what you do next: how much weight to load on each set, when to hold and when to back off. And it explains why.",
  "Disponible en Google Play": "Get it on Google Play",
  "Disponible en": "Available on",
  "iOS disponible pronto": "iOS coming soon",
  "Disponible pronto en": "Coming soon to",
  "Abrir aplicación web": "Open web app",
  "Resumen de TrueLift": "TrueLift at a glance",
  "Gratis para siempre": "Free forever",
  "Sin anuncios": "No ads",
  "Sin cuenta ni email": "No account or email",
  "16 sesiones de entrenamiento con PRO incluidas": "16 training sessions with PRO included",
  "Sesión en curso: objetivo de repeticiones y RIR, carga sugerida, cronómetro de descanso y explicación de por qué se mantiene la carga": "Session in progress: rep and RIR target, suggested load, rest timer and the reason the load is being held",

  "Por qué TrueLift": "Why TrueLift",
  "Deja de preguntarte si hoy toca subir peso.": "Stop wondering whether today is the day to add weight.",
  "Cada vez que abres una sesión, TrueLift ya ha comparado tu última sesión con tu histórico y ha tomado la decisión por ti.": "Every time you open a session, TrueLift has already compared your last workout with your history and made the call for you.",
  "Si cumples, subes": "Hit the target, move up",
  "Cuando completas las repeticiones con el RIR previsto, calcula una subida proporcionada al ejercicio y cargable con tus discos.": "When you complete the reps at the planned RIR, it calculates an increase that fits the exercise and the plates you own.",
  "Si no llegas, consolidas": "Miss it, consolidate",
  "Si faltan repeticiones o el esfuerzo se dispara, mantiene la carga para que consolides antes de volver a subir.": "If reps are missing or the effort shoots up, it holds the load so you consolidate before moving up again.",
  "Si acumulas fatiga, frena": "Fatigue builds up, it backs off",
  "Tu sueño, estrés, molestias y VFC también cuentan: puede frenar subidas, bajar intensidad o proponer una descarga.": "Your sleep, stress, aches and HRV count too: it can block increases, lower intensity or suggest a deload.",
  "Sin IA improvisando: un algoritmo estable y explicable. Mismos datos, misma decisión, y siempre con el motivo a la vista.": "No AI improvising: a stable, explainable algorithm. Same data, same decision, and the reason is always on screen.",

  "Abre la app, entrena, guarda. El resto lo hace TrueLift.": "Open the app, train, save. TrueLift does the rest.",
  "Pestaña Registro con la sesión que toca y el estado para entrenar de hoy desglosado": "Log tab with today's session and a breakdown of today's readiness to train",
  "Abre la sesión que toca": "Open today's session",
  "Rutina lista desde el primer día según tus días de entreno y tu nivel. Con PRO, un estado diario de 0 a 100 te dice cómo llegas.": "A routine ready from day one, based on your training days and level. With PRO, a daily 0–100 readiness score tells you how you are arriving.",
  "Registro serie a serie con la carga sugerida, el objetivo de repeticiones y RIR y el cronómetro de descanso": "Set-by-set logging with the suggested load, the rep and RIR target and the rest timer",
  "Registra serie a serie": "Log set by set",
  "Carga sugerida, objetivo de repeticiones y RIR, cronómetro de descanso. Tú solo confirmas lo que has hecho.": "Suggested load, rep and RIR target, rest timer. You just confirm what you did.",
  "Sesión guardada con el rendimiento frente a tu base, tonelaje, series, RPE y duración": "Saved session with performance against your baseline, tonnage, sets, RPE and duration",
  "Guarda y recibe el veredicto": "Save and get the verdict",
  "Rendimiento de la sesión frente a tu histórico y la carga ya programada para la próxima.": "Session performance against your history, and the load already set for the next one.",

  "Mide lo que importa: si de verdad estás progresando.": "Measure what matters: whether you are really progressing.",
  "Nada de gráficas de relleno. Cada dato responde a una pregunta concreta sobre tu entrenamiento.": "No filler charts. Every number answers a specific question about your training.",
  "Rendimiento de cada sesión frente a tu propio histórico, no frente a una tabla.": "Each session's performance against your own history, not against a chart.",
  "Nivel de fuerza por ejercicio según tu peso corporal, sexo y edad.": "Strength level per exercise, relative to your body weight, sex and age.",
  "1RM estimado, tonelaje, marcas personales e informe mensual para compartir.": "Estimated 1RM, tonnage, personal bests and a monthly report to share.",
  "Estado para entrenar y VFC día a día.": "Readiness to train and HRV, day by day.",
  "Capturas de la pestaña Progreso": "Progress tab screenshots",
  "Pestaña Progreso con el estado para entrenar, la valoración general y el rendimiento de sesión": "Progress tab with readiness to train, the overall assessment and session performance",
  "Nivel de fuerza global y por ejercicio, con el progreso hacia el siguiente nivel": "Overall and per-exercise strength level, with progress towards the next level",

  "Gratis vs PRO": "Free vs PRO",
  "Empieza gratis. Pasa a PRO si quieres más control.": "Start free. Go PRO when you want more control.",
  "Gratis": "Free",
  "para siempre": "forever",
  "Todo lo necesario para entrenar en serio.": "Everything you need to train seriously.",
  "Rutina prefijada y progresión automática": "Preset routine and automatic progression",
  "Registro de sesiones y cardio": "Session and cardio logging",
  "Volumen semanal, progreso y marcas personales": "Weekly volume, progress and personal bests",
  "Calculadora de discos, calentamiento y cronómetro": "Plate calculator, warm-up sets and rest timer",
  "Informe mensual y copias de seguridad": "Monthly report and backups",
  "Descargar en Google Play": "Download on Google Play",
  "mensual · anual · pago único": "monthly · annual · one-time",
  "Todo lo de Gratis, más:": "Everything in Free, plus:",
  "Rutina totalmente configurable y rutinas descargables": "Fully configurable routine and downloadable programmes",
  "Autorregulación por sueño, estrés, molestias y VFC": "Autoregulation by sleep, stress, aches and HRV",
  "Descarga guiada y descarga automática por fatiga": "Guided deload and automatic deload on fatigue",
  "Capa de nutrición: temporada por bloques y ajuste semanal": "Nutrition layer: season in blocks and weekly adjustment",
  "Crear ejercicios e importar tu rutina desde Excel": "Create exercises and import your routine from Excel",
  "Modalidades de pago de PRO": "PRO payment options",
  "Mensual": "Monthly",
  "sin permanencia": "cancel anytime",
  "Anual": "Annual",
  "Pago único": "One-time",
  "Probar PRO gratis durante 16 sesiones": "Try PRO free for 16 training sessions",
  "Al instalar tienes PRO completo durante tus primeras 16 sesiones de entrenamiento. Sin email, sin tarjeta, sin cargos automáticos. Si no eliges plan, sigues en la versión gratuita con tu historial intacto.": "When you install, you get full PRO access for your first 16 training sessions. No email, no card, no automatic charges. If you do not pick a plan, you keep the free version with your history intact.",
  "Ver la comparativa completa, función por función": "See the full comparison, feature by feature",
  "Función": "Feature",
  "Registrar sesiones y cardio": "Log sessions and cardio",
  "Volumen y frecuencia semanal": "Weekly volume and frequency",
  "Progreso, marcas personales y rendimiento": "Progress, personal bests and performance",
  "Compartir entrenamiento e informe mensual": "Share workouts and monthly report",
  "Copias de seguridad": "Backups",
  "Cambiar un ejercicio por otro": "Swap one exercise for another",
  "Configurar series, RIR, reps y descanso": "Configure sets, RIR, reps and rest",
  "Cambiar el patrón de un ejercicio y renombrar sesiones": "Change an exercise's movement pattern and rename sessions",
  "Crear ejercicios e importar rutina desde Excel": "Create exercises and import a routine from Excel",
  "Rutinas descargables: express, especialización, peso libre…": "Downloadable programmes: express, specialisation, free weights…",
  "Progresión ajustada a déficit, mantenimiento o superávit": "Progression adjusted to deficit, maintenance or surplus",
  "Plan de nutrición: temporada y ajuste semanal": "Nutrition plan: season and weekly adjustment",
  "Incluido": "Included",
  "No incluido": "Not included",

  "Captura de la pestaña Nutrición": "Nutrition tab screenshot",
  "Pestaña Nutrición con el peso-tendencia, el estado de la fase de déficit y la temporada por bloques": "Nutrition tab with trend weight, the deficit phase status and the season in blocks",
  "Capa de nutrición · opcional": "Nutrition layer · optional",
  "Planifica tu temporada. Pésate. Sin contar calorías.": "Plan your season. Weigh yourself. No calorie counting.",
  "Defines tus bloques de volumen, mantenimiento y definición. Cada día anotas solo tu peso. Una vez por semana, la app compara tu ritmo real con el previsto y, si hace falta, te propone el ajuste en gramos de tus propios alimentos.": "You define your bulking, maintenance and cutting blocks. Each day you log one thing: your weight. Once a week the app compares your real rate with the planned one and, if needed, suggests the adjustment in grams of your own foods.",
  "Trabaja con tu peso-tendencia, no con el número de un día suelto.": "It works with your trend weight, not with a single day's reading.",
  "Un semáforo te avisa si el ritmo elegido es sensato para tu punto de partida.": "A traffic light warns you if the chosen rate is sensible for your starting point.",
  "La fase de dieta gobierna la progresión: entrenamiento y nutrición van de la mano.": "The diet phase drives progression: training and nutrition go hand in hand.",

  "Privacidad y sin publicidad": "Privacy and no advertising",
  "Cero publicidad": "Zero advertising",
  "Ni banners, ni vídeos, ni rastreadores. Nada interrumpe tu entrenamiento.": "No banners, videos or trackers. Nothing interrupts your training.",
  "Instala y entrena. No pedimos tu nombre, tu email ni nada de ti.": "Install it and train. We do not ask for your name, your email or anything about you.",
  "Tus datos, en tu móvil": "Your data stays on your phone",
  "Tu rutina y tu historial se procesan en tu dispositivo y el desarrollador no puede consultarlos.": "Your routine and history are processed on your device and the developer cannot access them.",

  "Así se ve TrueLift.": "This is what TrueLift looks like.",
  "Registro": "Log",
  "Sesión en curso": "Session in progress",
  "Sesión guardada": "Saved session",
  "Valoración general": "Overall assessment",
  "Estado para entrenar y rendimiento de una sesión concreta frente a su histórico": "Readiness to train and the performance of one session against its history",
  "Rendimiento por sesión": "Performance per session",
  "Nivel de fuerza": "Strength level",
  "1RM estimado de un ejercicio con la evolución de la carga y del e1RM por sesión": "Estimated 1RM for an exercise with the load and e1RM trend per session",
  "1RM estimado": "Estimated 1RM",
  "VFC y frecuencia cardíaca en reposo por día, con tu banda de referencia y marcas personales": "Daily HRV and resting heart rate with your reference range, and personal bests",
  "VFC · PRO": "HRV · PRO",
  "Nutrición · PRO": "Nutrition · PRO",
  "Ajuste semanal de nutrición expresado en calorías y en gramos de tus propios alimentos": "Weekly nutrition adjustment in calories and in grams of your own foods",
  "Ajuste semanal · PRO": "Weekly adjustment · PRO",
  "Ajustes de la app: rutina, material disponible, autorregulación y VFC, nutrición y modo descarga": "App settings: routine, available equipment, autoregulation and HRV, nutrition and deload mode",
  "Ajustes": "Settings",
  "Desliza para ver más →": "Swipe to see more →",

  "Preguntas frecuentes": "Frequently asked questions",
  "Lo que conviene saber antes de instalar.": "What you should know before installing.",
  "¿Qué incluye la versión gratuita?": "What does the free version include?",
  "Rutina prefijada según tus días de entreno, cambio de ejercicios, registro de sesiones y cardio, progresión automática, volumen semanal, progreso, marcas personales, informe mensual y copias de seguridad. No es una demo: puedes entrenar con ella para siempre.": "A preset routine based on your training days, exercise swaps, session and cardio logging, automatic progression, weekly volume, progress, personal bests, monthly report and backups. It is not a demo: you can train with it forever.",
  "¿Qué pasa cuando completas las 16 sesiones de entrenamiento con PRO?": "What happens when you complete the 16 PRO training sessions?",
  "Ningún cargo: la prueba no pide tarjeta. Al terminar, la app pasa sola a la versión gratuita y eso implica:": "No charge: the trial asks for no card. When it ends, the app switches to the free version by itself, which means:",
  "Las funciones PRO que hubieras activado (autorregulación, VFC, fase de dieta, descarga guiada, nutrición…) quedan desactivadas.": "Any PRO features you had turned on (autoregulation, HRV, diet phase, guided deload, nutrition…) are switched off.",
  "Si personalizaste o importaste tu rutina, vuelves a la rutina estándar de la versión gratuita. Se conservan los cambios de ejercicio que la versión gratuita permite.": "If you customised or imported your routine, you go back to the standard free routine. The exercise swaps the free version allows are kept.",
  "Tu historial de entrenamiento no se pierde y la progresión automática sigue funcionando.": "Your training history is not lost and automatic progression keeps working.",
  "La rutina personalizada no se borra: queda guardada y reaparece tal y como la dejaste si más adelante pasas a PRO.": "Your custom routine is not deleted: it stays saved and comes back exactly as you left it if you upgrade to PRO later.",
  "¿Cómo se paga TrueLift PRO?": "How do I pay for TrueLift PRO?",
  "Como prefieras: suscripción mensual, suscripción anual o un pago único que desbloquea PRO para siempre. Las suscripciones no tienen permanencia. La compra queda asociada a tu cuenta de Google o Apple y puedes restaurarla si cambias de dispositivo.": "However you prefer: a monthly subscription, an annual subscription or a one-time payment that unlocks PRO forever. Subscriptions have no lock-in. The purchase is tied to your Google or Apple account and can be restored if you change device.",
  "¿Tiene publicidad o necesito crear una cuenta?": "Are there ads, or do I need an account?",
  "No y no. TrueLift no muestra publicidad y no requiere registro. Tu historial se procesa en tu móvil y el desarrollador no puede consultarlo; los servicios de compra y descarga tratan solo los datos descritos en la política de privacidad.": "No and no. TrueLift shows no ads and requires no sign-up. Your history is processed on your phone and the developer cannot access it; the purchase and download services only handle the data described in the privacy policy.",
  "¿Necesito medir la VFC para usar la autorregulación?": "Do I need to measure HRV to use autoregulation?",
  "No. La VFC (variabilidad de la frecuencia cardíaca) es una señal opcional que dan relojes y bandas de pulso y que suele avisar de la fatiga antes que el rendimiento. Si la mides, la app la integra con el resto de señales; si no, la autorregulación funciona con tu descanso, tu estrés, tus molestias y tu rendimiento reciente.": "No. HRV (heart rate variability) is an optional signal from watches and chest straps that usually flags fatigue before performance does. If you measure it, the app blends it with the other signals; if not, autoregulation works from your sleep, stress, aches and recent performance.",
  "¿Sirve para hipertrofia o solo para fuerza?": "Is it for hypertrophy or only for strength?",
  "Las rutinas de la versión gratuita están orientadas a hipertrofia. En PRO puedes configurar series, repeticiones, RIR y descansos para priorizar fuerza si ese es tu objetivo.": "The free routines are geared towards hypertrophy. In PRO you can configure sets, reps, RIR and rest to prioritise strength if that is your goal.",
  "¿Puedo usarla si entreno con mancuernas o máquinas?": "Can I use it if I train with dumbbells or machines?",
  "Sí. Indicas el material que tienes y TrueLift propone cargas que realmente puedas montar con tus discos, microcargas y mancuernas.": "Yes. You tell it the equipment you have and TrueLift suggests loads you can actually set up with your plates, microplates and dumbbells.",
  "¿Dónde puedo consultar el manual de la app?": "Where can I read the app manual?",
  "Puedes": "You can",
  "descargar el manual de TrueLift en PDF": "download the TrueLift manual as a PDF",
  "con la explicación de todas las pantallas y funciones, gratuitas y PRO.": "with an explanation of every screen and feature, free and PRO.",

  "Deja de improvisar. Empieza a progresar.": "Stop improvising. Start progressing.",
  "Gratis, sin anuncios y sin cuenta. Instala, abre la sesión que toca y deja que TrueLift decida la carga.": "Free, no ads, no account. Install it, open today's session and let TrueLift decide the load.",
  "¿Eres entrenador?": "Are you a coach?",
  "TrueLift Coach es la app web para seguir a tus atletas desde el escritorio, a partir del archivo que exportan desde la app.": "TrueLift Coach is the web app for following your athletes from the desktop, using the file they export from the app.",
  "Abrir TrueLift Coach": "Open TrueLift Coach",
  "Archivo de ejemplo para probarla": "Sample file to try it out",

  "TrueLift - Un entrenador en tu bolsillo.": "TrueLift - A coach in your pocket.",
  "Privacidad y aviso legal": "Privacy and legal notice",
  "Manual (PDF)": "Manual (PDF)",
  "Web del autor": "Author's website",
  "Descargar gratis en Google Play": "Download free on Google Play"
};

const normaliseTranslationKey = (value) => value.replace(/\s+/g, " ").trim();
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const originalMetadata = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content || "",
  ogTitle: document.querySelector('meta[property="og:title"]')?.content || "",
  ogDescription: document.querySelector('meta[property="og:description"]')?.content || ""
};

function translatedValue(value, language) {
  const translations = language === "en"
    ? englishTranslations
    : language === "pt-BR"
      ? (typeof portugueseTranslations !== "undefined" ? portugueseTranslations : null)
      : null;
  return translations?.[normaliseTranslationKey(value)] || value;
}

function normaliseLanguage(language) {
  const value = String(language || "").toLowerCase();
  if (value === "en" || value.startsWith("en-")) return "en";
  if (value === "pt" || value.startsWith("pt-")) return "pt-BR";
  return "es";
}

// Las capturas viven en capturas/<idioma>/<nombre>.jpg. Si una captura solo existe
// en algunos idiomas (data-shot-langs en la figura), se oculta en los demás.
const screenshotFolders = {
  es: "capturas/es",
  en: "capturas/en",
  "pt-BR": "capturas/pt-BR"
};

function setScreenshotLanguage(language) {
  document.querySelectorAll("img[data-shot]").forEach((image) => {
    const figure = image.closest("figure");
    const restricted = figure?.dataset.shotLangs;
    if (restricted) {
      const hasLanguage = restricted.split(/\s+/).includes(language);
      figure.hidden = !hasLanguage;
      if (!hasLanguage) return;
    }
    const source = `${screenshotFolders[language]}/${image.dataset.shot}.jpg`;
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
  });
}

function setPageLanguage(language, { updateUrl = false } = {}) {
  const selectedLanguage = normaliseLanguage(language);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest("script, style")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    }
  });

  let textNode = walker.nextNode();
  while (textNode) {
    if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue || "");
    const source = originalText.get(textNode) || "";
    const key = normaliseTranslationKey(source);
    const translation = translatedValue(key, selectedLanguage);
    if (key && translation !== key) {
      const leading = source.match(/^\s*/)?.[0] || "";
      const trailing = source.match(/\s*$/)?.[0] || "";
      textNode.nodeValue = `${leading}${translation}${trailing}`;
    } else {
      textNode.nodeValue = source;
    }
    textNode = walker.nextNode();
  }

  document.querySelectorAll("[aria-label], [alt], [data-label]").forEach((element) => {
    if (!originalAttributes.has(element)) {
      const values = {};
      ["aria-label", "alt", "data-label"].forEach((name) => {
        if (element.hasAttribute(name)) values[name] = element.getAttribute(name) || "";
      });
      originalAttributes.set(element, values);
    }
    const values = originalAttributes.get(element);
    Object.entries(values).forEach(([name, value]) => {
      element.setAttribute(name, translatedValue(value, selectedLanguage));
    });
  });

  document.title = translatedValue(originalMetadata.title, selectedLanguage);
  const metadata = [
    ['meta[name="description"]', originalMetadata.description],
    ['meta[property="og:title"]', originalMetadata.ogTitle],
    ['meta[property="og:description"]', originalMetadata.ogDescription]
  ];
  metadata.forEach(([selector, source]) => {
    const element = document.querySelector(selector);
    if (element && source) element.setAttribute("content", translatedValue(source, selectedLanguage));
  });

  document.documentElement.lang = selectedLanguage;
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-language") === selectedLanguage));
  });

  const privacyPages = {
    es: "privacidad.html",
    en: "privacy.html",
    "pt-BR": "privacidade.html"
  };
  document.querySelectorAll("[data-privacy-link]").forEach((link) => {
    link.setAttribute("href", privacyPages[selectedLanguage]);
  });

  const manualFiles = {
    es: "Manual_TrueLift.pdf",
    en: "Manual_TrueLift_EN.pdf",
    "pt-BR": "Manual_TrueLift_PT-BR.pdf"
  };
  document.querySelectorAll("a[data-manual-download]").forEach((link) => {
    const manualFile = manualFiles[selectedLanguage];
    link.setAttribute("href", manualFile);
    link.setAttribute("download", manualFile);
  });

  setScreenshotLanguage(selectedLanguage);

  try {
    localStorage.setItem("truelift-language", selectedLanguage);
  } catch (_) {
    // El selector funciona igual aunque no haya almacenamiento.
  }

  if (updateUrl && window.history?.replaceState) {
    const url = new URL(window.location.href);
    if (selectedLanguage !== "es") url.searchParams.set("lang", selectedLanguage);
    else url.searchParams.delete("lang");
    window.history.replaceState({}, "", url);
  }
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    setPageLanguage(button.getAttribute("data-language") || "es", { updateUrl: true });
  });
});

const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
let storedLanguage = "";
try {
  storedLanguage = localStorage.getItem("truelift-language") || "";
} catch (_) {
  storedLanguage = "";
}
const browserLanguage = navigator.languages?.find((language) => language.toLowerCase().startsWith("pt")) || "";
setPageLanguage(requestedLanguage || storedLanguage || browserLanguage || "es");

// Menú en móvil
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

// CTA fija en móvil: aparece al dejar atrás el hero
const hero = document.querySelector("[data-hero]");
if (hero && "IntersectionObserver" in window) {
  const heroObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        document.body.classList.toggle("past-hero", !entry.isIntersecting);
      });
    },
    { threshold: 0.05 }
  );
  heroObserver.observe(hero);
} else {
  document.body.classList.add("past-hero");
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
