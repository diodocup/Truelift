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
Si una captura solo existe en algunos idiomas, la `<figure>` lo indica con `data-shot-langs`
(por ejemplo `data-shot-langs="es"`) y se oculta en los demás.

Para regenerarlas a partir de capturas del móvil (1220×2712): recortar la barra de estado
(96 px superiores) y la barra de navegación de Android (161 px inferiores), y reducir a
800×1610, JPEG de calidad ~82.

**Interfaz nueva (31/10/2026).** Las capturas de `es` son ya de la interfaz de cuatro pestañas
(Rutina, Registro, Progreso, Nutrición). Las de `en` y `pt-BR` siguen siendo de la interfaz
anterior hasta que se hagan en esos idiomas. Mientras tanto:

- Solo en `es` (`data-shot-langs="es"`): `descanso`, `disponibilidad`, `hoy`, `rutina`, `estructura`,
  `rutinas-pro`, `rutina-ia`, `volumen`, `tecnica`, `informe-mensual`, `temporada` y `semana`.
  Al añadir la captura en `en` y `pt-BR` con el mismo nombre, basta con quitar el atributo.
- Solo en `en` y `pt-BR` (`data-shot-langs="en pt-BR"`): `estado` y `vfc`, de la interfaz anterior.
  En `es` las sustituyen `disponibilidad` y `hoy`. Cuando existan las nuevas en esos idiomas, se
  borran estas dos figuras de la galería.

Las de nutrición `energia`, `macros`, `comidas` y `menu-ia` salen tanto en la sección de nutrición
como en la galería. Las de TrueLift Escritorio viven aparte, en `capturas/escritorio/`, y no cambian
con el idioma porque el escritorio solo está en español: son capturas reales de `escritorio/` con la
copia de ejemplo importada (ventana de 1440×900 a 1,5×, reducidas a 1600 px y JPEG ~82).

## Planificador de temporada

La sección `#temporada` (PRO) presenta el planificador: bloques de definición, mantenimiento y
volumen, proyección de peso, % graso y masa libre de grasa, y la ilustración orientativa de cómo
cambiaría el cuerpo del inicio al final. El hero lo anuncia con una franja propia.

La pieza central es un comparador antes/después: un `input range` transparente sobre las dos
ilustraciones de `capturas/temporada/` (recortadas de la pantalla Temporada de la app, sin texto,
así que valen para los tres idiomas). Funciona con ratón, dedo y teclado; al entrar en pantalla
hace un vaivén corto para que se vea que se puede deslizar (no lo hace con movimiento reducido).
La nota «Ilustración orientativa: cada cuerpo responde a su manera» y el aviso «Una guía, no una
promesa» no se quitan: las imágenes no son una promesa de resultado.

El móvil con la pantalla Temporada solo sale en `es` (`data-shot-langs="es"`); en EN y PT-BR la
columna se queda con el ejemplo de temporada.

## Récords y niveles en vídeo

Dentro de `#progreso`, el bloque «Cada récord y cada nivel nuevo» muestra las animaciones de la app
en `capturas/videos/` (`record.mp4` y `nivel.mp4`, H.264 vertical 576×1280 con `faststart`, y su
fotograma de portada en `.jpg`). Se reproducen en bucle y sin sonido solo mientras están a la vista;
el botón de altavoz activa el sonido de uno (y silencia el otro). Con movimiento reducido no
arrancan solos y muestran los controles nativos. Los vídeos están grabados en español.

## TrueLift Escritorio

La sección `#escritorio` presenta la versión para ordenador (`escritorio/`, ver su `LEEME.md`): la
persona importa la copia de seguridad de la app y ve sus métricas en grande, alguna que no está en
el móvil, sus informes y su rutina, que exporta al Excel que importa la app (importarlo en el móvil es
PRO, por eso la tarjeta lo marca). El botón del hero lleva a esa sección.

La copia que se descarga para probarlo es `escritorio/ejemplo/copia_truelift_2026-10-16.json`.
Es la única copia de ejemplo del sitio: el mismo historial que el modo DEMO de la app
(`assets/demo/historial_demo.json` en App-PRO). La usan también `escritorio/tests/planificador.test.mjs`
y `escritorio/tests/progreso-fase.test.mjs`.

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
