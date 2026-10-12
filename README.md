# TrueLift Web

Landing comercial estática para TrueLift, creada con HTML, CSS y JavaScript sin dependencias externas.

## Publicación

La web puede publicarse directamente con GitHub Pages:

1. En GitHub, entra en **Settings > Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/root`.
4. Guarda los cambios.

## Enlaces de las tiendas

La versión de Android ya está publicada en Google Play:

```text
https://play.google.com/store/apps/details?id=es.rubensoro.truelift&pcampaignid=web_share
```

La versión de iOS está publicada en App Store:

```text
https://apps.apple.com/es/app/truelift-programaci%C3%B3n-fuerza/id6803201895
```

Los enlaces explícitos de Google Play y App Store conservan siempre su tienda.
Los botones genéricos de cabecera y prueba PRO (`data-store-cta`) detectan Android,
iPhone e iPad, incluido iPadOS con identificador Macintosh y pantalla táctil.
En escritorio, dispositivos desconocidos o sin JavaScript, llevan a `#descargar`,
donde se pueden elegir ambas tiendas. No se redirige automáticamente al visitante.

## Diseño

`styles.css` define el sistema: titulares en **Archivo** 900 y etiquetas, cifras y datos en
**JetBrains Mono** con tracking amplio, que es el rasgo que amarra la web a la app. El lima
`#a8ee19` se reserva para acción y afirmación; el oro `#e2ba4a` es exclusivo de PRO y no
aparece en ningún otro contexto, de modo que el modelo de negocio se lee de un vistazo.

Las dos fuentes van autoalojadas en `fonts/` (variables, subconjuntos latin y latin-ext, SIL
Open Font License). No se cargan desde Google Fonts a propósito: la política de privacidad
declara que el sitio es estático y sin terceros, y traer las fuentes de fuera enviaría la IP
de quien visita la web a un servicio que no está descrito en esa política.

## Reloj conectado

La franja «Conecta tu smartwatch» de la portada y la sección `#reloj` anuncian la lectura de datos
del reloj a través de Health Connect (Android) y Apple Salud (iOS), que es función PRO. Las marcas
de relojes van **como texto** en la tipografía de la web, no como logotipos: nombrarlas para indicar
compatibilidad no sugiere colaboración y no depende de las normas de uso de logotipos de cada
fabricante (Apple, por ejemplo, no permite usar su manzana). El aviso de marcas va al pie de la sección.

## Precios

**En la web no se publican precios.** La sección de planes indica solo las modalidades de pago
(mensual, anual y pago único) y la comparativa de funciones; las cifras viven únicamente en la
ficha de Google Play y en la propia app.

## Idiomas

El español de `index.html` **es la clave de traducción**: `script.js` recorre los nodos de texto y
los atributos `aria-label`, `alt` y `data-label`, normaliza los espacios y busca esa frase exacta en
`englishTranslations` (dentro de `script.js`) o en `portugueseTranslations` (en
`translations-pt-br.js`). Si no la encuentra, deja el español.

Por eso, **al retocar cualquier frase en español hay que actualizar su clave en los dos ficheros de
traducción**, o esa frase se quedará en español en EN y PT-BR sin dar ningún error. Para comprobar
qué falta, extrae los textos de `index.html` y busca cada uno como `"<frase>"` en los dos ficheros.

## Capturas de pantalla

Las capturas de la landing viven en `capturas/<idioma>/<nombre>.jpg` (`es`, `en`, `pt-BR`), con el
mismo nombre de archivo en los tres idiomas. `script.js` cambia la carpeta al cambiar de idioma.
Si una captura solo existe en algunos idiomas, la `<figure>` de la galería lo indica con
`data-shot-langs="es"` y se oculta en los demás.

Para regenerarlas a partir de capturas del móvil (1220×2712): recortar la barra de estado
(96 px superiores) y reducir a 800 px de ancho, JPEG de calidad ~82.

Las de nutrición `energia`, `macros`, `comidas` y `menu-ia` salen tanto en la sección de nutrición
como en la galería. Las de TrueLift Escritorio viven aparte, en `capturas/escritorio/`, y no cambian
con el idioma porque el escritorio solo está en español: son capturas reales de `escritorio/` con la
copia de ejemplo importada (ventana de 1440×900 a 1,5×, reducidas a 1600 px y JPEG ~82).

## TrueLift Escritorio

La sección `#escritorio` presenta la versión para ordenador (`escritorio/`, ver su `LEEME.md`): la
persona importa la copia de seguridad de la app y ve sus métricas en grande, alguna que no está en
el móvil, sus informes y su rutina, que exporta al Excel que importa la app (importarlo en el móvil es
PRO, por eso la tarjeta lo marca). El botón del hero lleva a esa sección.

La copia que se descarga para probarlo es `escritorio/ejemplo/copia_truelift_2026-10-08.json`.
Es la única copia de ejemplo del sitio; la usa también `escritorio/tests/planificador.test.mjs`.

TrueLift Coach se ha retirado de la web: `coach/index.html` solo redirige a `escritorio/`. El resto
de `coach/` se conserva porque el escritorio carga de ahí su motor y sus estilos.

## Nutrición: calorías, macros y menú con IA

Dentro de `#nutricion`, el bloque «¿Prefieres pesar lo que comes?» enseña en cuatro pasos el gasto
estimado y las calorías de la fase, los macros del día, el reparto en comidas y el menú semanal con
IA externa (la app prepara el prompt; TrueLift no llama a ninguna IA). Como en la app, los textos
explican el qué y el para qué, sin umbrales, porcentajes ni detalles del cálculo.

## Valoraciones y reseñas de las tiendas

El hero muestra la nota de Google Play y App Store y una tarjeta con reseñas que
pasan solas cada pocos segundos (se pausa al pasar el ratón y se puede deslizar
en móvil). Los datos salen de `valoraciones.json`, que **no se edita a mano**:

- La Action **Valoraciones de las tiendas** (`.github/workflows/valoraciones.yml`)
  se ejecuta cada día, lee las tiendas con
  `.github/scripts/actualizar-valoraciones.mjs` y hace commit solo si algo cambió.
  También se puede lanzar a mano desde *Actions > Valoraciones de las tiendas > Run workflow*.
- Solo se publican reseñas con texto y de **4 o 5 estrellas**. Las de 1-3 estrellas
  nunca llegan a la web.
- Para retirar una reseña concreta, copia su `id` de `valoraciones.json` a la lista
  `ocultar` de `valoraciones-config.json`. Ahí también se ajustan `minEstrellas` y
  `minCaracteres`.
- Si `valoraciones.json` no existe o una tienda aún no muestra nota, ese elemento
  simplemente no aparece.
