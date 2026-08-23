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
el estado «iOS disponible pronto» por el enlace exacto del App Store en `index.html`.

## Capturas de pantalla

Las capturas de la landing viven en `capturas/<idioma>/<nombre>.jpg` (`es`, `en`, `pt-BR`), con el
mismo nombre de archivo en los tres idiomas. `script.js` cambia la carpeta al cambiar de idioma.
Si una captura solo existe en algunos idiomas, la `<figure>` de la galería lo indica con
`data-shot-langs="es"` y se oculta en los demás.

Para regenerarlas a partir de capturas del móvil (1220×2712): recortar la barra de estado
(96 px superiores) y reducir a 800 px de ancho, JPEG de calidad ~82.
