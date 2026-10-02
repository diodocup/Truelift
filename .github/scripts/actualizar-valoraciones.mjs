// Descarga la nota media y las reseñas públicas de Google Play y App Store y las
// guarda en valoraciones.json, que la web lee al cargar. Lo ejecuta a diario la
// Action de .github/workflows/valoraciones.yml.
//
// Solo se publican las reseñas con texto y con al menos `minEstrellas`; las demás
// se descartan aquí y nunca llegan a la web. Para retirar una reseña concreta,
// añade su id a `ocultar` en valoraciones-config.json.
//
// Si una tienda falla (cambio de formato, red caída), se conservan sus datos de
// la ejecución anterior en lugar de vaciar la sección.

import { readFile, writeFile } from "node:fs/promises";
import gplay from "google-play-scraper";

const ANDROID_ID = "es.rubensoro.truelift";
const IOS_ID = "6803201895";
const SALIDA = "valoraciones.json";
const CONFIG = "valoraciones-config.json";

// Idiomas en los que pedimos reseñas a Google Play (la tienda las filtra por idioma).
const IDIOMAS_PLAY = [
  { lang: "es", country: "es", idioma: "es" },
  { lang: "en", country: "us", idioma: "en" },
  { lang: "pt", country: "br", idioma: "pt-BR" }
];

// App Store separa notas y reseñas por país.
const PAISES_APPLE = {
  es: "es", mx: "es", ar: "es", co: "es", cl: "es", pe: "es", us: "en", gb: "en", br: "pt-BR", pt: "pt-BR"
};

async function leerJson(ruta, porDefecto) {
  try {
    return JSON.parse(await readFile(ruta, "utf8"));
  } catch {
    return porDefecto;
  }
}

// "Rubén Soro Esteban" -> "Rubén S.": suficiente para que se vea real sin
// publicar el nombre completo de nadie.
function nombreCorto(nombre) {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
}

function limpiarTexto(texto) {
  return String(texto || "").replace(/\s+/g, " ").trim();
}

async function datosAndroid() {
  const app = await gplay.app({ appId: ANDROID_ID, lang: "es", country: "es" });
  const resenas = [];
  for (const { lang, country, idioma } of IDIOMAS_PLAY) {
    const { data } = await gplay.reviews({
      appId: ANDROID_ID,
      lang,
      country,
      sort: gplay.sort.NEWEST,
      num: 200
    });
    for (const r of data || []) {
      resenas.push({
        id: `gp:${r.id}`,
        tienda: "android",
        autor: nombreCorto(r.userName),
        estrellas: Number(r.score) || 0,
        texto: limpiarTexto(r.text),
        fecha: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
        idioma
      });
    }
  }
  return {
    nota: typeof app.score === "number" && app.score > 0 ? Math.round(app.score * 10) / 10 : null,
    total: Number(app.ratings) || 0,
    resenas
  };
}

async function obtenerJson(url) {
  const respuesta = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (TrueLift web)" } });
  if (!respuesta.ok) throw new Error(`${url}: HTTP ${respuesta.status}`);
  return respuesta.json();
}

async function datosIos() {
  let suma = 0;
  let total = 0;
  const resenas = [];
  for (const [pais, idioma] of Object.entries(PAISES_APPLE)) {
    const busqueda = await obtenerJson(`https://itunes.apple.com/lookup?id=${IOS_ID}&country=${pais}`);
    const app = busqueda.results?.[0];
    if (app?.userRatingCount) {
      suma += app.averageUserRating * app.userRatingCount;
      total += app.userRatingCount;
    }

    let feed;
    try {
      feed = await obtenerJson(`https://itunes.apple.com/${pais}/rss/customerreviews/page=1/id=${IOS_ID}/sortby=mostrecent/json`);
    } catch {
      continue; // Sin reseñas en ese país Apple a veces responde con error.
    }
    let entradas = feed.feed?.entry || [];
    if (!Array.isArray(entradas)) entradas = [entradas];
    for (const e of entradas) {
      if (!e["im:rating"]) continue; // La primera entrada de algunos feeds es la propia app.
      const titulo = limpiarTexto(e.title?.label);
      const cuerpo = limpiarTexto(e.content?.label);
      resenas.push({
        id: `as:${e.id?.label}`,
        tienda: "ios",
        autor: nombreCorto(e.author?.name?.label),
        estrellas: Number(e["im:rating"].label) || 0,
        texto: titulo && !cuerpo.startsWith(titulo) ? `${titulo}. ${cuerpo}` : cuerpo,
        fecha: e.updated?.label ? e.updated.label.slice(0, 10) : null,
        idioma
      });
    }
  }
  return {
    nota: total ? Math.round((suma / total) * 10) / 10 : null,
    total,
    resenas
  };
}

function filtrar(resenas, config) {
  const vistas = new Set();
  return resenas
    .filter((r) => r.estrellas >= config.minEstrellas)
    .filter((r) => r.texto.length >= config.minCaracteres)
    .filter((r) => !config.ocultar.includes(r.id))
    .filter((r) => (vistas.has(r.id) ? false : vistas.add(r.id)))
    .sort((a, b) => b.estrellas - a.estrellas || String(b.fecha).localeCompare(String(a.fecha)));
}

const config = {
  minEstrellas: 4,
  minCaracteres: 20,
  ocultar: [],
  ...(await leerJson(CONFIG, {}))
};
const anterior = await leerJson(SALIDA, {});

const tiendas = {};
const resenas = [];
for (const [tienda, obtener] of [["android", datosAndroid], ["ios", datosIos]]) {
  try {
    const datos = await obtener();
    tiendas[tienda] = { nota: datos.nota, total: datos.total };
    resenas.push(...datos.resenas);
    console.log(`${tienda}: nota ${datos.nota ?? "-"} (${datos.total}), ${datos.resenas.length} reseñas leídas`);
  } catch (error) {
    console.warn(`${tienda}: no se pudo actualizar, se conservan los datos anteriores.`, error.message);
    tiendas[tienda] = anterior[tienda] || { nota: null, total: 0 };
    resenas.push(...(anterior.resenas || []).filter((r) => r.tienda === tienda));
  }
}

const nuevo = {
  android: tiendas.android,
  ios: tiendas.ios,
  resenas: filtrar(resenas, config).slice(0, 30)
};

// La fecha solo cambia si cambian los datos: así no hay un commit diario vacío.
const { actualizado, ...anteriorSinFecha } = anterior;
if (JSON.stringify(anteriorSinFecha) === JSON.stringify(nuevo)) {
  console.log("Sin cambios.");
} else {
  await writeFile(SALIDA, `${JSON.stringify({ actualizado: new Date().toISOString(), ...nuevo }, null, 2)}\n`);
  console.log(`Guardadas ${nuevo.resenas.length} reseñas en ${SALIDA}.`);
}
