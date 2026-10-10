# TrueLift Escritorio

Versión de escritorio de TrueLift para la persona que entrena: importa en el
ordenador la copia de seguridad de la app y, si quieres, tus fotos de
progreso, para consultar tu evolución en pantalla grande.

**Estado:** en desarrollo (fases 1 a 4 de 8: importación, almacenamiento,
secciones personales, resumen con conclusiones, ficha por ejercicio y comparación de periodos). Informes y el editor de rutina llegan en fases
posteriores. Ver `PLAN.md`; definiciones de las métricas en `METRICAS.md`.

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
  contornos y galería de fotos.
- **Recuperación:** estado para entrenar, cuestionarios, VFC, FC en reposo y
  datos del reloj.
- **Mi rutina:** la rutina guardada en tu copia y sus series por grupo.
- **Informes:** en preparación.
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

## Pruebas

```
node --test escritorio/tests/*.test.mjs     # módulos (Node 20+)
node escritorio/tests/e2e.mjs [capturas/]   # navegador (requiere Playwright)
```
