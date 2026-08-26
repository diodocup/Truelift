# Fuentes autoalojadas

Las dos familias del sistema de diseño, en formato WOFF2 variable y con los subconjuntos
latin y latin-ext, que son los que necesitan el español, el inglés y el portugués de Brasil.

| Archivo | Familia | Ejes | Origen |
| --- | --- | --- | --- |
| `archivo-latin.woff2`, `archivo-latin-ext.woff2` | Archivo | `wght` 400–900 | [Google Fonts](https://fonts.google.com/specimen/Archivo) |
| `jetbrainsmono-latin.woff2`, `jetbrainsmono-latin-ext.woff2` | JetBrains Mono | `wght` 400–800 | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) |

Ambas se distribuyen bajo la **SIL Open Font License 1.1**, que permite alojarlas en el propio
sitio. Se sirven desde aquí y no desde Google Fonts para que la web no cargue ningún recurso de
terceros: la política de privacidad declara que el sitio es estático y sin terceros, y pedir las
fuentes a `fonts.gstatic.com` enviaría la IP de quien visita la web a un servicio que esa
política no describe.

Los `@font-face` y sus `unicode-range` están al principio de `../styles.css`. Para actualizar una
familia, descarga el WOFF2 nuevo del subconjunto correspondiente y sustituye el archivo: los
nombres y los rangos no cambian.
