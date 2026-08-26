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

La versión de iOS estará disponible próximamente. Cuando se publique su ficha, sustituye
los dos `<span class="button is-static">iOS · pronto</span>` de `index.html` (hero y cierre)
por enlaces al App Store.

## Diseño

`styles.css` define el sistema: titulares en **Archivo** 900 y etiquetas, cifras y datos en
**JetBrains Mono** con tracking amplio, que es el rasgo que amarra la web a la app. El lima
`#a8ee19` se reserva para acción y afirmación; el oro `#e2ba4a` es exclusivo de PRO y no
aparece en ningún otro contexto, de modo que el modelo de negocio se lee de un vistazo.

Las dos fuentes van autoalojadas en `fonts/` (variables, subconjuntos latin y latin-ext, SIL
Open Font License). No se cargan desde Google Fonts a propósito: la política de privacidad
declara que el sitio es estático y sin terceros, y traer las fuentes de fuera enviaría la IP
de quien visita la web a un servicio que no está descrito en esa política.

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
