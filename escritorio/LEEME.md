# TrueLift Escritorio

Versión de escritorio de TrueLift para la persona que entrena: importa en el
ordenador la copia de seguridad de la app y, si quieres, tus fotos de
progreso, para consultar tu evolución en pantalla grande.

**Es un visor de la app.** Aquí no se edita ni se exporta nada que la app
cobre: la rutina, la dieta y los registros solo se cambian en el móvil, que es
la que manda. Desde el 01/11/2026 ya no hay editor de rutinas, exportación a
Excel ni vídeo de progreso.

**Estado:** fases 0–8 implementadas y validadas en el entorno indicado en
`VALIDACION.md`. Pendiente de revisión, comprobación en Safari/Firefox y prueba
de transferencia en dispositivos iOS/Android reales. Esta entrega no publica
ni fusiona cambios. Ver `PLAN.md` (registro histórico, incluidas fases que ya
no existen) y las definiciones en `METRICAS.md`.

## Secciones

- **Mi resumen:** tu **nivel de fuerza** (el nivel global de la tarjeta «Tu nivel» de la app, con su color, la barra de cinco tramos y el progreso hacia el siguiente; `Motor.clasificacionesNivel` en `coach/motor.js`), antigüedad de tus datos, hasta tres observaciones
  priorizadas (cada una con su periodo, los datos que la respaldan, sus
  limitaciones y un enlace al detalle), constancia por semana frente a la
  rutina que tenías entonces, la misma valoración de progreso que la app,
  evolución de tus ejercicios comparables, peso y fase, y cambios de
  recuperación.
- **Entrenamiento:** sesiones (de consulta, con cada serie), ejercicios con
  su estado de progresión y su ficha (series una a una, por qué de su
  estado, evolución reciente, mejores marcas y comparación de dos
  sesiones), rendimiento por sesión, volumen por grupo muscular y semana y comparación de dos periodos.
- **Evolución física:** peso tendencia y fase con el progreso de la fase
  frente a lo pactado (como «Cómo vas» de la app), composición (estimación),
  contornos con gráficas y tablas, galería por fecha/pose y comparación de fotos.
- **Recuperación:** estado para entrenar, cuestionarios, VFC, FC en reposo y
  datos del reloj. Las tarjetas de VFC y FC en reposo llevan el **semáforo** de
  la app: qué papel juega cada señal en tu disponibilidad (a favor, vigilando o
  frena; apagada si no cuenta) y lo que dice la otra (`senales.js`).
- **Nutrición:** solo consulta (`nutricion-esc.js` y `nutricion-vista.js`).
  *Tu pauta* (fase y semana, cómo la sigues, objetivo de calorías o último
  cambio acordado, pasos, proteína, macros y comidas), *Evolución* (progreso de
  la fase con «Llevas» y «Tu objetivo», tendencia, tu objetivo en azul y el plan
  inicial en morado), *Temporada* (proyección del plan como la app, gráficas,
  etapas con su «Final» e ilustraciones del cuerpo lado a lado o superpuestas
  con ▶ Reproducir) e *Historial* (versiones de la pauta y revisiones
  semanales). Los mandos solo cambian lo que se ve.
- **Mi rutina:** la rutina de tu móvil, de consulta, con sus series por grupo.
- **Informes:** informe de un mes o de unas fechas (constancia, progresión
  verificable, evolución física, volumen, recuperación, cambios, aspectos que
  revisar y limitaciones) para leer, imprimir o guardar en PDF.
- **Mis datos:** importación, almacenamiento, fotos con incidencias e
  historial de importaciones.

Teclado: Alt + 1…8 cambia de sección; Atrás y Adelante del navegador
funcionan entre secciones.

**Tema:** oscuro o claro, como en la app. Por defecto sigue el de la app
(`temaClaro` de la copia); en **Mis datos → Tema** se puede fijar en este
navegador (`tema.js`). Al imprimir manda siempre la hoja de papel.

## Diseño

El escritorio usa la imagen de la app móvil (`lib/tl_design.dart` en App-PRO):
Saira Condensed para títulos y cifras grandes, Instrument Sans para el texto
e IBM Plex Mono para toda cifra comparable, autoalojadas en `../fonts/`. El
lima de la app (`#A3E020`) marca acción o logro y nunca es fondo de bloque;
naranja y rojo marcan rendimiento bajo y el rojo de error queda para lo
destructivo. Los colores van en `@media screen`: la hoja de impresión del
Coach conserva los suyos para el papel.

- **Barra lateral:** secciones agrupadas (Analizar · Planificar y compartir ·
  Mis datos) con su atajo, hasta qué día llegan tus datos, la importación y el
  aviso de privacidad. En pantallas estrechas pasa a ser una fila arriba.
  Grupos: Analizar (Mi resumen, Entrenamiento, Evolución física,
  Recuperación, Nutrición) · Tu rutina e informes · Mis datos.
- **Mi resumen:** cuatro cifras clave con mini gráfica, «Lo más relevante» en
  tarjetas, la **línea de tiempo** del bloque (rendimiento por sesión, peso y
  entrenos sobre las mismas fechas, con fases y descargas; cada capa se puede
  ocultar y cada punto enseña su detalle al pasar el ratón), tus ejercicios
  con su evolución, el volumen por grupo, la recuperación de las últimas
  semanas y accesos a lo propio del escritorio.
- **Entrenamiento:** la ficha de un ejercicio lleva al lado la lista de tus
  ejercicios para pasar de uno a otro. Comparar periodos empieza con una
  franja de diferencias principales de A a B, sin declarar un ganador.
- **Dibujos de los ejercicios:** cada ejercicio de la biblioteca lleva el
  mismo dibujo que en la app: en las tablas de ejercicios, sesiones y
  comparación, en la lista junto a la ficha, en la cabecera de la ficha (con
  su nota técnica) y en la rutina del móvil.
  Pulsar el dibujo de la ficha lo amplía con lo que la app
  cuenta del ejercicio. Los ejercicios que creaste tú no tienen dibujo: su
  hueco lleva la inicial. Al imprimir no salen.
  Como en la app, los ejercicios con equivalente en RepDB enseñan su foto
  (figura de hombre o de mujer según el sexo que declaraste en la app); los
  demás conservan el dibujo de siempre.
- **Informes:** en pantalla el documento ya se ve como una hoja de papel, con
  los mismos colores con los que se imprime.

Las gráficas nuevas están en `graficas.js` (SVG en texto, sin dependencias).
Las imágenes de los ejercicios (`dibujos.js`) son las mismas que en la app:
- **Fotos de RepDB** en `media/repdb/<hombre|mujer>/<id>-<peak|main>.webp`
  (punto de máxima contracción, o la única postura de los isométricos) y el
  mapa nombre → foto en `repdb.js`. Los genera
  `python3 tool/escritorio_repdb.py` en el repo de la app (con `--check`
  comprueba que no estén desfasados) desde `lib/ejercicio_repdb.dart` y
  `assets/images/repdb/`. Son una figura en color sobre transparente: van
  sobre superficie 2 y no se invierten en el tema claro (clase `ej-foto`).
- **Dibujos propios** para los ejercicios sin foto: no se duplican, son los
  que ya publica el Coach en `../coach/media/ejercicios/` (el Coach sigue
  enseñando sus dibujos).

No se precachean (son cientos); el service worker las guarda a medida que se
ven y después salen también sin conexión.
Todo color de estado va acompañado de altura, posición o texto.

**Sin desplazamiento horizontal.** Las tablas dejan que sus textos salten de
línea y, si aun así no caben en su caja, cada fila pasa a ser una ficha con la
etiqueta de cada dato (`marcarDesplazables` en `app.js`, clase `apilada`;
solo en pantalla, al imprimir vuelven a ser tablas). Los días de la rutina van
en una sola columna cuando no caben dos tablas completas una al lado de otra,
y la columna «Modalidad» solo aparece si el día tiene alguna. La línea de
tiempo es lo único que conserva un ancho mínimo (600 px) y se desplaza en
pantallas de móvil.

## Importar tus datos

1. En la app: **Ajustes → Copia de seguridad → Exportar copia** (archivo
   `copia_truelift_AAAA-MM-DD.json`).
2. Opcional: en la misma pantalla, **Exportar fotos** (archivo
   `truelift_fotos_AAAA-MM-DD.zip`).
3. Pasa los archivos al ordenador y abre `escritorio/` (desde la web o con
   un servidor local). El navegador probado en esta entrega es Chromium;
   Edge, Firefox y Safari están pendientes. Para revisar la rama localmente,
   ejecuta `python3 -m http.server 8000` desde la raíz del repositorio y abre
   `http://localhost:8000/escritorio/`. No hace falta importar datos personales
   para abrirla.
4. Pulsa **Importar datos de TrueLift** (puedes elegir el JSON y el ZIP a la
   vez) o **Importar fotos de TrueLift**, o arrastra los archivos a la
   ventana.
5. Revisa la vista previa y confirma. Hasta que confirmas no se guarda nada.

Para probarlo sin exportar datos propios está la copia de ejemplo
`ejemplo/copia_truelift_2026-11-01.json` (el historial del modo DEMO de la app), la misma que se descarga desde la
sección «TrueLift Escritorio» de la web. No registra fotos de progreso: para
probar la galería y la comparación importa un ZIP de fotos de la app.

### Actualizar

Exporta una copia nueva en el móvil e impórtala. Como la copia no incluye un
identificador de persona, el escritorio te pregunta si quieres **actualizar**
tu espacio actual o **crear un espacio personal nuevo**. Actualizar sustituye
la copia entera (igual que restaurarla en el móvil); no se mezclan
historiales. Tus fotos no se tocan.

- Si la copia es **idéntica** a la que tienes, no se guarda nada.
- Si parece **más antigua** (termina antes o le faltan sesiones), se avisa y
  hay que confirmarlo.

### Fotos

- La fecha y la pose de cada foto salen de tu copia de datos, que recoge las
  correcciones hechas en el móvil; después, del índice del ZIP; y solo si
  ninguno la describe, del nombre del archivo (patrón de la app).
- Las fotos registradas en tu copia cuyo archivo no has importado aparecen
  como **«Falta la imagen»**: sus datos no se borran.
- Reimportar el mismo ZIP no duplica nada. Si llega una imagen distinta con
  un nombre que ya tienes, se conserva la tuya salvo que elijas sustituirla.
- Las fotos del ZIP que tu copia de datos no conoce (quizá las borraste en el
  móvil) no se importan salvo que lo indiques.
- Si los bytes son los mismos pero cambian fecha, pose o medidas en el índice
  del ZIP, puedes actualizar solo los metadatos. **Usar los metadatos de este
  ZIP** pide confirmación cuando difieren de los guardados; comprueba que sea
  el archivo que quieres conservar. La copia JSON mantiene su prioridad.
- Un ZIP con índice y sin las imágenes también es útil: conserva las fichas
  pendientes. Un índice idéntico no vuelve a guardarse.

## Comparar dos periodos (fase 4)

1. Abre **Entrenamiento → Comparar periodos** (también desde Mi resumen).
2. Elige las fechas de A y B y pulsa **Comparar**. El botón de acceso rápido
   selecciona las últimas cuatro semanas completas frente a las cuatro
   anteriores, tomando como referencia el último registro de la copia.
3. Revisa duración, número de sesiones y semanas completas antes de comparar.
   Las fechas se conservan por espacio personal, incluso tras actualizar el JSON.
4. Abre **Ver semanas y sesiones de origen** para consultar una sesión. Pulsa
   un ejercicio para ir a su ficha.

- Las medias semanales solo usan semanas completas con cobertura; las semanas
  parciales muestran sus registros y series aparte, sin extrapolarlos.
- El rendimiento se separa por rutina y día. El 1RM estimado se compara por
  ejercicio y modalidad con al menos dos sesiones válidas por periodo.
- Peso y contornos son medianas de mediciones dentro del periodo, con fechas
  reales. Nutrición y recuperación muestran exclusivamente contexto registrado.
- Los periodos pueden durar distinto o solaparse: se avisa. No se genera un
  ganador ni se atribuyen causas a las diferencias.
- No hay selector automático de bloques: las sesiones identifican la rutina
  utilizada, pero la copia no guarda sus límites históricos exactos. Indica
  manualmente las fechas de los bloques que quieras revisar.

## Comparar fotos y medidas (fase 5)

1. Abre **Evolución física**. Elige una pose y dos fotos distintas. Si falta
   una imagen, importa el ZIP; la ficha y sus datos se conservan.
2. Usa **Lado a lado**, **Cortina** o **Superposición**. Los deslizadores
   admiten las flechas del teclado, Inicio y Fin.
3. En **Ajustar encuadre** puedes ampliar uniformemente y mover cada imagen.
   **Restablecer A/B** vuelve al encuadre original. **Guardar encuadres en
   este navegador** conserva los ajustes al cerrar; no modifica las fotos.
4. Revisa peso guardado, fase histórica y tabla de contornos asociados.
   Cada medida enseña su fecha real: hasta 30 días antes, nunca futura.
   Si se usa la misma medida para ambas fotos, no se calcula un cambio.
5. Filtra la galería por pose y avanza por páginas. Debajo puedes consultar
   las gráficas y tablas de peso, composición estimada y contornos.

Las correcciones de fecha o pose hechas en el móvil llegan con la siguiente
copia JSON. No necesitas reimportar la imagen si conserva su nombre.
Los encuadres se mantienen en tu espacio aunque actualices la copia.
El ZIP también permite consultar fotos y contornos sin JSON, si tiene índice;
para los entrenamientos y fases históricas necesitas la copia JSON.

La perspectiva, la luz y la postura afectan a la comparación; los ajustes
no corrigen esas diferencias. Masa magra estimada no equivale a músculo.

## Mi rutina (solo consulta)

Enseña la rutina personalizada que trae tu copia (días, ejercicios, series,
reps, RIR, descanso y modalidades) y sus series por grupo y semana. Si usas
una rutina prefijada de la app, no viaja en la copia. Los cambios se hacen
en la app.

Hasta el 01/11/2026 el escritorio tenía un editor de borradores con
exportación al Excel de la app. Se retiró: al abrir, el navegador borra los
borradores que quedaran guardados (IndexedDB v2). Los Excel que ya
descargaste siguen siendo tuyos y la app los importa con sus propias reglas.

## Informe de un periodo (fase 7)

1. Abre **Informes** (Alt + 7). Sale el último mes natural completo de tus
   datos; elige otro mes u **Otras fechas** y pulsa **Ver informe**. El periodo
   se guarda para este espacio (también tras actualizar la copia).
2. Las fotos no se incluyen por defecto. Marca **Añadir fotos al informe** y
   elige hasta 6 fotos del periodo; la elección no se guarda.
3. **Imprimir o guardar en PDF** abre la impresión del navegador; elige
   «Guardar como PDF». En papel solo sale el documento.
4. **Comparar con el periodo anterior** abre Comparar periodos con el mes (o
   la misma duración) anterior frente al elegido.

- Si el periodo pasa de tu último registro o empieza antes del primero, el
  informe lo dice en «Datos insuficientes y limitaciones».
- Las lecturas del 1RM estimado con pocas sesiones salen como orientativas y
  no cuentan como cambio relevante.
- El estado actual (intentos agotados, recuperación reciente) solo aparece
  si el periodo incluye tu último registro.

## Sin conexión

Tras abrir el escritorio con conexión y completar la preparación de su caché,
el navegador guarda sus archivos y la página se puede volver a abrir sin conexión con tus
datos (que ya estaban en el navegador). **Mis datos → Sin conexión** indica si
está listo. Abierto como archivo local (`file://`) no está disponible.
Se ha comprobado en Chromium por HTTP local, incluida una actualización del
service worker y un fallo HTTP 503. No se ha comprobado en producción ni se
anuncia instalación como aplicación.

## Dónde se guardan los datos

En el propio navegador (IndexedDB), separados de TrueLift Coach. Nada se
envía a ningún servidor. **No es una copia de seguridad**: borrar los datos
del navegador los elimina. Conserva tus archivos JSON y ZIP originales.

Si el navegador no permite guardar (por ejemplo, en algunas ventanas
privadas), la página entra en **modo temporal** y lo indica: lo importado se
pierde al cerrar.

## Si una importación falla

- Toda importación se guarda en una sola operación: si falla (falta de
  espacio, cierre de la pestaña…), **no queda nada a medias** y tus datos
  anteriores siguen intactos.
- Si actualizaste con la copia equivocada: **Mis datos → Volver a la copia
  anterior** (se guardan la copia vigente y la anterior).
- La vuelta atrás recupera el JSON; no deshace una sustitución explícita de
  imágenes o del índice ZIP. Para estos, vuelve a importar el ZIP original
  correcto y revisa las confirmaciones de imagen e índice.
- Si falta espacio: borra un espacio que no uses o importa solo la copia de
  datos sin el ZIP.
- Como último recurso: **Borrar todos los datos del escritorio** y volver a
  importar tus archivos originales.

## Al día con la app (01/11/2026)

Cambios de App-PRO del 21/10 al 01/11/2026 que afectan a lo que se consulta:

- **Cardio duplicado:** el cardio apuntado a mano que repite una sesión del
  reloj (`duplicadaDe`) no cuenta en constancia, línea de tiempo ni informes.
- **Rango de reps subido tras el paso atrás:** cada sesión se juzga con el
  objetivo que tenía ese día (`repsExtra`) y la ficha dice el de hoy.
- **Déficit:** la ficha recoge cuando se vuelve a estancar tras bajar el peso
  y la app propone cambiar el ejercicio.
- **Volumen:** series que la autorregulación quitó del plan (`seriesPlan`).
- **Enfoques nuevos** de la rutina y **nombre del usuario** (saludo en Mi
  resumen y portada del informe).
- **Semáforo de VFC y FC en reposo** en Recuperación.
- **Nutrición** completa en modo consulta, con el planificador de temporada,
  sus ilustraciones y la reproducción.
- **Copia de ejemplo** = demo de la app del 01/11/2026.

No se han traído la ficha técnica nueva (fotos de inicio y final del
movimiento) ni el mapa muscular: sus imágenes vienen de un pack con licencia
que no permite publicarlas en bruto en una web.

## Al día con la app (20/10/2026)

Cambios de App-PRO del 11 al 20/10/2026 que afectan al escritorio:

- **Rutinas en casa:** la clave de la rutina incluye `casaN`; sin esto quien
  entrena en casa veía su rutina como «desconocida».
- **Peso fijo de máquina:** el 1RM estimado y las marcas suman el peso fijo,
  como la app; la carga que se ve sigue siendo la anotada.
- **Rest-pause** en progresión simple: se progresa en el extremo alto del rango.
- **Drop set:** un único objetivo de reps (la 1.ª serie), también en doble, en
  el editor, los avisos y el Excel.
- **Biblioteca de ejercicios** regenerada desde la app (Face pull unificado,
  Fondos asistidos en máquina, dibujo nuevo de Fondos en máquina).
- **Nutrición v8:** Comparar periodos dice qué pasó con cada propuesta de
  ajuste (aceptada, pospuesta, sustituida…) y cuenta solo los aceptados.
- **Fatiga en la sesión:** la ayuda del neto explica el criterio nuevo y
  Comparar periodos avisa si mezcla sesiones de antes y después.
- **Progreso de la fase** frente a lo pactado, en Mi resumen y Evolución física.
- **Copia de ejemplo** = historial del modo DEMO de la app.
- **Tema claro** y «Como en tu app».

## Pruebas

```
node --test escritorio/tests/*.test.mjs     # módulos (Node 20+)
PLAYWRIGHT_MODULE=/ruta/playwright node escritorio/tests/e2e.mjs   # si no está en node_modules
node escritorio/tests/e2e.mjs [capturas/]   # navegador (requiere Playwright)
PLAYWRIGHT_MODULE=/ruta/playwright AXE_MODULE=/ruta/axe-core/axe.min.js node escritorio/tests/integral.e2e.mjs [capturas/]
                                            # fase 8: persistencia real, proceso, ZIP, caché, accesibilidad
```
