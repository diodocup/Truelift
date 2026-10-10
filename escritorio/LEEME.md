# TrueLift Escritorio

Versión de escritorio de TrueLift para la persona que entrena: importa en el
ordenador la copia de seguridad de la app y, si quieres, tus fotos de
progreso, para consultar tu evolución en pantalla grande.

**Estado:** en desarrollo (fases 1 a 7 de 8: importación, almacenamiento,
secciones personales, resumen con conclusiones, ficha por ejercicio, comparación de periodos, evolución física, planificador de rutina, informes y acabado). Falta la
validación integral (fase 8). Ver `PLAN.md`; definiciones de las métricas en `METRICAS.md`; el
planificador, en `PLANIFICADOR.md`.

## Secciones

- **Mi resumen:** antigüedad de tus datos, hasta tres observaciones
  priorizadas (cada una con su periodo, los datos que la respaldan, sus
  limitaciones y un enlace al detalle), constancia por semana frente a la
  rutina que tenías entonces, la misma valoración de progreso que la app,
  evolución de tus ejercicios comparables, peso y fase, y cambios de
  recuperación.
- **Entrenamiento:** sesiones (de consulta, con cada serie), ejercicios con
  su estado de progresión y su ficha (series una a una, por qué de su
  estado, evolución reciente, mejores marcas y comparación de dos
  sesiones), rendimiento por sesión, volumen por grupo muscular y semana y comparación de dos periodos.
- **Evolución física:** peso tendencia y fase, composición (estimación),
  contornos con gráficas y tablas, galería por fecha/pose y comparación de fotos.
- **Recuperación:** estado para entrenar, cuestionarios, VFC, FC en reposo y
  datos del reloj.
- **Mi rutina:** la rutina de tu móvil (consulta) y tus borradores: editor con
  todos los días a la vista, cambios frente a la rutina del móvil, series por
  grupo, avisos y exportación al Excel que importa la app.
- **Informes:** informe de un mes o de unas fechas (constancia, progresión
  verificable, evolución física, volumen, recuperación, cambios, aspectos que
  revisar y limitaciones) para leer, imprimir o guardar en PDF.
- **Mis datos:** importación, almacenamiento, fotos con incidencias e
  historial de importaciones.

Teclado: Alt + 1…7 cambia de sección; Atrás y Adelante del navegador
funcionan entre secciones.

## Importar tus datos

1. En la app: **Ajustes → Copia de seguridad → Exportar copia** (archivo
   `copia_truelift_AAAA-MM-DD.json`).
2. Opcional: en la misma pantalla, **Exportar fotos** (archivo
   `truelift_fotos_AAAA-MM-DD.zip`).
3. Pasa los archivos al ordenador y abre `escritorio/` (desde la web o con
   doble clic en `index.html`; Chrome o Edge recomendados).
4. Pulsa **Importar datos de TrueLift** (puedes elegir el JSON y el ZIP a la
   vez) o **Importar fotos de TrueLift**, o arrastra los archivos a la
   ventana.
5. Revisa la vista previa y confirma. Hasta que confirmas no se guarda nada.

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

## Preparar y aplicar un cambio de rutina (fase 6)

1. Importa tu copia de datos y abre **Mi rutina**. Arriba ves tres cosas
   distintas: la rutina **en tu móvil** (según la copia), tu **borrador** y el
   último **archivo exportado**.
2. Pulsa **Nuevo borrador desde la rutina del móvil** (o **Nuevo en blanco**, o
   **Abrir un Excel de rutina…**). Puedes tener varios borradores.
3. Edita: nombre y orden de los días, ejercicios (escribe o elige; si eliges
   uno del catálogo sin patrón, se rellena solo), series, repeticiones, RIR,
   descanso, modalidad (series normales, top set + back-off, drop set,
   rest-pause) y superseries. Todo se maneja con el teclado; ↑ ↓ cambian el
   orden. Cada cambio se guarda en este navegador.
4. **Deshacer** / **Rehacer** (Ctrl + Z / Ctrl + Y fuera de un campo de texto)
   y **Volver a la rutina de partida** recuperan versiones anteriores.
5. Revisa **Cambios frente a la rutina del móvil**, **Series por grupo**,
   **Avisos antes de exportar** (lo que la app interpretará de otra forma) y
   **Tus cargas al aplicar esta rutina**.
6. **Exportar Excel para la app** descarga `mi_rutina_truelift_….xlsx`.
   **Tu móvil no cambia todavía.**
7. Pasa el archivo al móvil e impórtalo en la app: **Rutina → Importar**. La
   app te enseña la rutina a prueba; confírmala o descártala allí.
8. Para comprobarlo, exporta una copia nueva desde el móvil e impórtala aquí:
   el archivo exportado aparecerá como **A prueba en el móvil** o **En tu
   móvil**.

- Importar una copia nueva **no borra** tus borradores. Si la rutina del móvil
  cambió desde que empezaste un borrador, se avisa con los cambios y eliges
  entre mantener tu borrador o crear otro desde la rutina actual.
- El historial importado no se edita aquí; los borradores son aparte.
- Si la app no admite algo del archivo con tu versión, te lo explica al
  importarlo. Un ejercicio que no tengas en tu biblioteca se añade solo si lo
  aceptas en la app.

## Informe de un periodo (fase 7)

1. Abre **Informes** (Alt + 6). Sale el último mes natural completo de tus
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

Tras abrir el escritorio una vez con conexión desde la web, el navegador
guarda sus archivos y la página se puede volver a abrir sin conexión con tus
datos (que ya estaban en el navegador). **Mis datos → Sin conexión** indica si
está listo. Abierto como archivo local (`file://`) no está disponible.

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
- Si falta espacio: borra un espacio que no uses o importa solo la copia de
  datos sin el ZIP.
- Como último recurso: **Borrar todos los datos del escritorio** y volver a
  importar tus archivos originales.
- Un borrador que no se pudo guardar (falta de espacio) se queda como estaba
  en su último guardado; el aviso lo dice. Los Excel ya exportados son
  archivos tuyos: puedes volver a abrirlos con **Abrir un Excel de rutina…**.

## Pruebas

```
node --test escritorio/tests/*.test.mjs     # módulos (Node 20+)
PLAYWRIGHT_MODULE=/ruta/playwright node escritorio/tests/e2e.mjs   # si no está en node_modules
node escritorio/tests/e2e.mjs [capturas/]   # navegador (requiere Playwright)
DART=/ruta/dart node --test escritorio/tests/planificador.test.mjs
                                            # + lector real del Excel de la app (App-PRO al lado)
```
