# TrueLift Escritorio — plan, decisiones y registro

Versión de escritorio de TrueLift para la persona que entrena: importa su copia
JSON y, si quiere, su ZIP de fotos, y analiza su propia evolución en el
ordenador. Todo se procesa y guarda en el navegador.

Este archivo es el registro de trabajo: si se interrumpe, se continúa desde
aquí. El contrato de datos verificado está en `CONTRATO_DATOS.md`.

## Estado de las fases

| Fase | Estado | Verificación |
|---|---|---|
| 0. Auditoría y diseño | Hecha | Este documento + `CONTRATO_DATOS.md` |
| 1. Importación fiable y persistencia | Hecha (ver «Fase 1» abajo) | `tests/*.test.mjs` (Node) + `tests/e2e.mjs` (Chromium/Playwright) |
| 2. Experiencia personal y métricas | Hecha (ver «Fase 2» abajo) | `tests/motor*.test.mjs`, `tests/analisis.test.mjs` + e2e (Chromium) |
| 3. Resumen y ficha por ejercicio | Hecha (ver «Fase 3» abajo) | `tests/resumen.test.mjs` + e2e (Chromium) |
| 4. Comparación de periodos | Hecha (ver «Fase 4») | 15 casos nuevos + e2e Chromium |
| 5. Evolución física | Hecha (ver «Fase 5») | 18 casos nuevos + 41 comprobaciones e2e Chromium |
| 6. Planificador personal | Pendiente | — |
| 7. Informes y acabado | Pendiente | — |
| 8. Validación integral | Pendiente | — |

## Fase 0 — Auditoría

### Repositorios

- `diodocup/Truelift` es la web publicada (`CNAME` truelift.es). Su `coach/` es
  la copia **canónica** del Coach: los generadores de App-PRO
  (`tool/coach_generar_catalogo.py`, `tool/coach_generar_canonico.py`)
  escriben en `../Truelift/coach`.
- `App-PRO/web-truelift/coach` es una copia **antigua y divergente** (última
  edición 29/09). Solo ella tiene la modalidad **rest-pause** en el
  planificador (`e9dea7b`); la canónica no. Hay que portarla antes de la
  fase 6 (riesgo R6).
- El trabajo se hace en `Truelift/escritorio/`. App-PRO solo se lee.

### Coach existente (Truelift/coach)

- Sin módulos ni build: scripts clásicos con globales, cargados en orden
  (`data.js → nutricion.js → charts.js → views.js → catalogo.js →
  canonico.js → plantilla.js → xlsx.js → planner.js → app.js`).
- Almacenamiento: **todo** en `localStorage['tlcoach_clientes']` (cartera con
  el JSON crudo de cada cliente y borradores del planificador). Sin
  transacciones; si se llena, `alert`.
- Importación: `leerArchivo` → `pareceTrueLift` (`logs` o `planMod`) →
  `modalImportar` (cliente nuevo / actualizar). Sustituye `datos` del cliente.
  No valida tipos, no detecta copias idénticas ni retrocesos.
- `sw.js` **no se registra en ningún sitio**: hoy el Coach no funciona sin
  conexión aunque el LEEME lo sugiera. Además su `activate` borra **todas**
  las cachés del origen que no sean la suya (riesgo R4 si un día se registra
  junto a otro SW).
- No lee `medidas` ni fotos.
- `xlsx.js` trae un unzip propio (`_unzip`) sin límites de tamaño ni de
  entradas ni validación de rutas: válido para un Excel generado, no para un
  ZIP de fotos arbitrario.
- Pruebas: `node --test coach/tests/*.mjs` → **75/83** en la línea base. Los 8
  fallos son previos y ajenos: comparaciones `deepStrictEqual` entre «realms»
  de `vm` en Node 22 y un color de VFC desactualizado en la expectativa.

### Funciones existentes (no duplicar)

| Necesidad | Ya existe en | Uso en escritorio |
|---|---|---|
| Parseo de fechas locales, formato | `coach/data.js` `parseFecha`, `fmtISO`, `fmtFecha`, `soloDia`, `diasEntre` | Reutilizar |
| Normalización del JSON a modelo de vistas | `coach/data.js` `normalizar` | Reutilizar (fase 2 la ampliará con las claves que faltan, en el mismo archivo) |
| e1RM, tonelaje, diagnóstico simplificado | `coach/data.js` `Metricas` | Reutilizar tras auditarlo en fase 2 (hoy difiere del motor, §4 del contrato) |
| VFC, FC reposo, fatiga, salud | `coach/data.js` | Reutilizar |
| Nutrición (filtro de peso, bandas, composición) | `coach/nutricion.js` | Reutilizar |
| Gráficas SVG accesibles por tooltip | `coach/charts.js` | Reutilizar (fase 2+) |
| Vistas de sesiones, ejercicios, readiness, nutrición | `coach/views.js` | Adaptar en fase 2 (dependen de `State` en 3 sitios) |
| Editor de rutinas y Excel compatible | `coach/planner.js`, `coach/xlsx.js`, `coach/plantilla.js`, `coach/catalogo.js`, `coach/canonico.js` | Reutilizar en fase 6 con almacenamiento propio |
| Lectura ZIP | `coach/xlsx.js` `_unzip` | **No** se reutiliza para fotos (sin límites); nuevo `zip-seguro.js` |

### Arquitectura

```
Truelift/
  coach/          herramienta del entrenador (sin cambios en fase 1)
  escritorio/     versión personal
    index.html    carga ../coach/data.js y ../coach/nutricion.js + módulos propios
    importar.js   validación del JSON, resumen, comparación de instantáneas
    zip-seguro.js lector ZIP con límites, rutas seguras, CRC y cancelación
    fotos.js      resolución foto↔índice (prioridades del contrato §5) y plan de importación
    almacen.js    IndexedDB versionada, transacciones atómicas, cuota, modo temporal
    analisis.js   modelo personal (fase 2): sesiones, ejercicios, estado, valoración, volumen
    vistas.js     HTML de las secciones personales (fase 2)
    app.js        interfaz, navegación y «Mis datos»
  coach/motor.js  reglas del motor portadas del móvil (compartidas por las dos herramientas)
```

- **Aislamiento:** otra carpeta, otra página, otra base de datos
  (`IndexedDB 'truelift-escritorio'`). No lee ni escribe
  `localStorage['tlcoach_clientes']`: la cartera del Coach queda intacta.
- **Una sola lógica de cálculo:** el escritorio carga los módulos de cálculo
  de `../coach/` en vez de copiarlos. Cualquier corrección de métricas
  (fase 2) se hace allí y beneficia a las dos herramientas.
- **Sin dependencias externas ni CDN.** ZIP con `DecompressionStream`
  nativo; hash con `crypto.subtle`; miniaturas con `createImageBitmap`.
  Política CSP en la página: sin `connect-src` a terceros (requisito 16).

### Modelo de almacenamiento (IndexedDB, versión 1)

| Almacén | Clave | Contenido |
|---|---|---|
| `meta` | `clave` | `espacioActivo`, ajustes de la interfaz |
| `espacios` | `id` | `{id, nombre, creado, instantaneaId, instantaneaAnteriorId, indiceZip, indiceZipImportado}` |
| `instantaneas` | `id` (índice `espacioId`) | `{texto original, sha256, bytes, nombreArchivo, importadoEn, resumen}` |
| `fotos` | `[espacioId, archivo]` | metadatos: `sha256, bytes, tipo, ancho, alto, metaZip, origen, importadoEn` |
| `imagenes` | `[espacioId, archivo]` | `Blob` original |
| `miniaturas` | `[espacioId, archivo]` | `Blob` JPEG reducido |
| `importaciones` | autoincremento | historial de importaciones con su informe |
| `borradores` | `id` | reservado a la fase 6 (rutinas) |

- Una copia JSON es una **instantánea**: se guarda el texto original sin
  mutarlo y se conserva también la anterior para poder volver a ella.
- Las fotos y los borradores cuelgan del espacio, no de la instantánea:
  actualizar los datos no los toca.
- Todas las escrituras de una importación van en **una transacción**: o se
  guarda todo o nada. Antes de escribir se comprueba la cuota estimada.

### Riesgos de compatibilidad

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Sin identificador de usuario: dos archivos pueden ser de personas distintas | Elección explícita «actualizar» / «espacio nuevo», con indicios (coincidencia de historial, fecha de nacimiento) que informan pero no deciden |
| R2 | Sin fecha de exportación: no se puede saber qué copia es más nueva | Comparar el último registro y las sesiones que faltan; avisar de posible retroceso y exigir confirmación. La fecha del nombre del archivo se muestra como indicio no verificado |
| R3 | Foto con fecha o pose corregidas sin renombrar | La resolución usa el índice (JSON > ZIP > nombre) y se recalcula al leer |
| R4 | `coach/sw.js` borra cachés ajenas al activarse | No se registra hoy. Si en la fase 7 se activa el modo sin conexión, limitar su borrado a su prefijo |
| R5 | Fechas con `Z` de sesiones del reloj | Se toma el día del texto, como el resto del Coach; documentado |
| R6 | Coach canónico sin rest-pause | Portar desde App-PRO/web-truelift antes de la fase 6 |
| R7 | Métricas del Coach distintas del motor (carga efectiva, sustituciones, drops, récords en verde, estancamiento) | Fase 2: auditar y alinear o etiquetar |
| R8 | `Nutricion.contexto` usa la fecha de hoy | Fase 2: evaluar con la fecha del último dato de la instantánea |
| R9 | `file://`: IndexedDB y `crypto.subtle` dependen del navegador | Uso recomendado desde la web publicada o un servidor local; modo temporal explícito si falla la persistencia |
| R10 | HEIC u otros formatos que el navegador no pinta | Se rechazan con aviso; el móvil siempre guarda JPEG |

### Plan de pruebas (por fase)

- **Node (`node --test escritorio/tests/*.test.mjs`):** módulos puros con
  datos sintéticos generados en la propia prueba: validación JSON (válido,
  antiguo, inválido, cero/ausente/no válido, unidades), resumen y fechas,
  comparación de instantáneas (idéntica, actualización, retroceso, otra
  persona), ZIP (con índice, sin índice, corrupto, rutas inseguras, límites,
  bomba de compresión, cancelación), resolución de fotos (prioridades,
  conflictos, fecha/pose corregidas, huérfanas, ausentes).
- **Navegador (`node escritorio/tests/e2e.mjs`, Playwright + Chromium):**
  importar, recargar, actualizar, reimportar, ZIP repetido, error de cuota
  simulado sin pérdida, borrado de datos, aislamiento del Coach, ausencia de
  peticiones externas.
- Coach: `node --test coach/tests/*.mjs` sigue en 75/83 (sin regresiones).

### Orden de implementación

1. Fase 1 (núcleo + interfaz de datos). 2. Fase 2 navegación y auditoría de
métricas en `coach/data.js`. 3. Resumen y fichas. 4. Comparación. 5. Fotos y
medidas. 6. Planificador (portar rest-pause). 7. Informe y acabado. 8.
Validación integral.

## Fase 1 — Importación fiable y persistencia

### Decisiones

- **JSON = instantánea.** Actualizar sustituye la instantánea entera en una
  transacción; nunca se mezclan historiales. Se conserva la anterior.
- **Copia idéntica:** mismo SHA-256 del texto → no se guarda nada y se dice.
- **Retroceso:** si la copia nueva termina antes que la actual o le faltan
  sesiones que la actual tiene, se avisa con cifras y hay que confirmarlo.
- **Validación:** estructura de nivel superior errónea → se rechaza. Valores
  sueltos no válidos → se aceptan como hace el móvil, pero se cuentan y se
  enseñan en la vista previa (cero, ausente y no válido se distinguen).
- **Fotos:** prioridad JSON > índice del ZIP > nombre estricto; binarios sin
  asociación no se guardan; mismo nombre y mismo contenido → no se duplica;
  mismo nombre y contenido distinto → se conserva el actual salvo que se
  elija sustituir; fotos del ZIP que la copia JSON no tiene → avisadas y
  excluidas por defecto (pueden haberse borrado en el móvil).
- **Límites del ZIP:** 1 GiB comprimido, 5 000 entradas, 40 MiB por imagen,
  2 GiB descomprimido en total, relación de compresión ≤ 200:1 por entrada.
  Rutas con `/`, `\`, `..`, absolutas o con caracteres de control se ignoran.
  Solo JPEG, PNG y WebP comprobados por su firma.
- **Límite del JSON:** 64 MiB.
- **Notas importadas:** siempre como texto (`textContent`/`esc`), nunca HTML.

### Registro

- 10/10/2026: auditoría (fase 0) y primera implementación de la fase 1.
  Ver resultados de pruebas en la sección «Verificación» de abajo.

### Verificación (10/10/2026)

Implementado y comprobado:

- `node --test escritorio/tests/*.test.mjs` → **31/31**: validación (válida,
  antigua, solo ajustes, inválida, tipos imposibles, cero/ausente/no válido,
  fechas sin desplazamiento horario, lb, no mutación), comparación
  (idéntica, actualización, retroceso, sesión borrada, otra persona), ZIP
  (índice, STORE/DEFLATE, corrupto, truncado, CRC, rutas inseguras,
  carpetas, demasiadas entradas, bomba, tamaño falso, cancelación) y fotos
  (patrón estricto, firma, prioridad JSON > ZIP > nombre con fecha/pose
  corregidas, plan nueva/duplicada/conflicto/fuera de copia/sin asociación,
  pendientes, resolución al leer).
- `node escritorio/tests/e2e.mjs` en **Chromium 141 (Playwright 1.56)** por
  HTTP → **19/19**: importación conjunta, recarga, copia idéntica, ZIP
  repetido, actualización, retroceso y vuelta atrás, fallo de cuota simulado
  a mitad de transacción sin cambios, conflicto resuelto explícitamente,
  espacio nuevo sin mezclar fotos, ZIP sin índice, archivos inválidos,
  cancelación, ventana de 420 px, borrado, cartera del Coach intacta, cero
  peticiones externas, cero errores JS.
- `file://` en Chromium: IndexedDB persistente y `crypto.subtle`
  disponibles; importar y recargar funciona. Las fuentes no cargan en
  `file://` (CORS), igual que en el Coach actual.
- Las seis copias ficticias del repositorio (`coach/*_2026-08-26.json`,
  `Ejemplo TrueLift Coach.json`) se validan sin valores no válidos.
- Coach: `node --test coach/tests/*.mjs` sigue en 75/83 (sin cambios).

Sin verificar / pendiente:

- Firefox y Safari (no disponibles en este entorno). `DecompressionStream`
  y `OffscreenCanvas` existen en sus versiones recientes, pero no se han
  probado.
- Cuota real agotada: se simula el error dentro de la transacción; no se ha
  llenado un disco de verdad.
- ZIP real exportado por la app (el formato se reproduce desde el código de
  `seleccion_screen.dart`, con el paquete `archive`: no se ha probado un
  archivo generado por un móvil).
- Rendimiento con miles de fotos (probado con 150 entradas y cancelación).
- Funcionamiento sin conexión: no hay service worker en el escritorio (fase 7).

## Fase 2 — Experiencia personal y coherencia de métricas

### Decisiones

- **Una sola lógica de cálculo:** las reglas del móvil se portan a
  `coach/motor.js` (funciones puras sobre los mapas crudos de la copia). El
  escritorio las usa; el Coach lo carga para leer los nombres fusionados.
  Definiciones, fuentes y diferencias: `METRICAS.md`.
- **Prioridad de resultados:** primero lo guardado por la app (rendimiento,
  valoración, marcas por ejercicio); después reglas reproducidas con los
  casos de prueba del móvil; si no, «datos insuficientes» o descripción
  neutra. El diagnóstico simplificado del Coach (`Metricas.diagnostico`) no
  se usa: puede declarar estancamientos que el móvil no ve.
- **Fecha de referencia = último registro** de la copia; la antigüedad de
  los datos se enseña en Mi resumen.
- **Rutina en uso:** `planMod` con `planModKey` igual a la combinación actual.
  Si no, no se valora la progresión (no se tienen las prefijadas ni el estado
  PRO).
- **Sin adherencia histórica:** la copia no guarda la planificación pasada;
  se muestran sesiones hechas y, aparte, los días de la rutina actual.
- **Navegación:** Mi resumen · Entrenamiento (Sesiones, Ejercicios,
  Rendimiento, Volumen) · Evolución física · Recuperación · Mi rutina ·
  Informes · Mis datos. Hash en la URL (`#entrenamiento/ejercicios/<nombre>`)
  para Atrás/Adelante y recarga; atajos Alt + 1…7; todo lo pulsable es un
  botón; cada gráfica tiene su tabla.
- **Nutrición integrada** donde da contexto: fase y ritmo en Mi resumen;
  peso tendencia, objetivo y composición (marcada como estimación) en
  Evolución física.
- **Sin lenguaje del Coach** (cartera, clientes, triaje, notas del
  entrenador): no se cargan sus vistas; los textos son nuevos.
- **Galería:** pasa a Evolución física; «Mis datos» enseña recuentos y solo
  las fotos con incidencias.
- **Coach:** cambios mínimos y aditivos en `coach/data.js` (claves nuevas
  del motor, `sustitucion` no evaluable, huecos `displayBaselinePoint`,
  `normalizar(raw, {hoy})`), `motor.js` cargado en `coach/index.html` y en la
  lista del SW (versión v14).

### Registro

- 10/10/2026: auditoría de métricas, `motor.js`, modelo, vistas y
  navegación. Ver «Verificación (fase 2)».

### Verificación (fase 2, 10/10/2026)

Implementado y comprobado:

- `node --test escritorio/tests/*.test.mjs` → **66/66** (31 de la fase 1 +
  22 de equivalencia con el móvil, 2 de sincronía de listas con App-PRO y 11
  del modelo y las vistas). Los casos de `motor.test.mjs` reproducen con sus
  mismos datos los de `estancamiento_test`, `sesion_a_medias_test`,
  `ejercicio_molestias_test`, `cambio_ejercicio_solo_hoy_test`,
  `rest_pause_test`, `drop_set_test`, `dominada_lastre_test`,
  `dominada_asistida_test` y `valoracion_progreso_test`.
- `node escritorio/tests/e2e.mjs` en **Chromium 141** → **25/25**: las 19 de
  la fase 1 (la de miniaturas ahora se hace en Evolución física y ya no pasa
  en vacío) y 6 nuevas: resumen con valoración y antigüedad, Alt+2, ficha
  con el estado del móvil, Atrás del navegador, detalle de sesión con nota
  escapada, todas las secciones, recarga en la misma sección y 420 px sin
  desbordamiento en seis vistas. Cero peticiones externas y cero errores.
- Capturas sintéticas revisadas a mano (resumen, ejercicios, ficha, sesión,
  rendimiento, volumen, física, recuperación, rutina, estrecha).
- Coach: `node --test coach/tests/*.mjs` sigue en 75/83 con los mismos 8
  fallos previos.

Sin verificar / pendiente:

- **Equivalencia con una copia real**: los casos son sintéticos y las
  pruebas Dart no se han podido ejecutar aquí (no hay SDK de Dart/Flutter);
  la equivalencia se apoya en portar sus entradas y resultados esperados.
- Firefox y Safari.
- Rendimiento con historiales de varios años (no medido).
- El diagnóstico simplificado del Coach sigue en el Coach (fuera de alcance).
- `coach/catalogo.js` puede quedarse atrás de la biblioteca de la app (ya
  documentado en sus pruebas); el volumen avisa de ejercicios sin grupo.

## Fase 3 — Resumen personal y análisis por ejercicio

### Decisiones

- **Conclusiones = reglas fijas.** `Analisis.conclusiones(M)` genera
  candidatas con prioridad; Mi resumen enseña las tres primeras. Cada una
  trae observación, periodo, datos que la respaldan (filas con la sesión de
  origen: la fecha abre su detalle), limitaciones y enlace al detalle.
  Reglas y prioridades: `METRICAS.md` §Fase 3.
- **Prioridad de fuentes** (igual que la fase 2): primero las lecturas de la
  app (valoración, contador de intentos, estado para entrenar, VFC baja
  sostenida); después reglas reproducidas (cortes del informe mensual) con
  exclusiones más estrictas; nunca un estancamiento deducido.
- **Sin adherencia con la frecuencia actual.** Lo previsto de cada semana
  sale de los días por semana anotados en las propias sesiones (identidad
  de rutina). Si una semana no tiene la rutina acotada por sesiones de la
  misma rutina antes y después (o, al final, por la rutina actual igual a la
  de la última sesión), queda «sin calcular». La semana en curso no se valora.
- **Ejercicios comparables:** 1RM estimado de marca (tope de reps de la
  app) solo de sesiones en verde, sin descarga, molestias ni cambio de un
  día, y con la misma modalidad que la última sesión válida (normal, top +
  back-off, drop set, rest-pause). Extremos y cortes del informe mensual de
  la app (`Motor.extremosComparables`, `Motor.lecturaProgreso`). Una lectura
  solo se convierte en conclusión si es «firme» (varias sesiones y las dos
  últimas del mismo lado que el arranque): una sola sesión floja no basta.
  Nunca se infiere progreso por tonelaje ni por repeticiones totales.
- **Sin duplicar:** un ejercicio con intentos agotados no se repite como «1RM
  a la baja»; se añade a la misma conclusión.
- **Ficha:** series una a una (kg × reps @RIR con back-off, drops y series
  tras la pausa), «Por qué este estado» (las oportunidades que cuenta el
  móvil), evolución reciente con la misma regla del resumen, historial de
  marcas válidas, comparación de dos sesiones con avisos (modalidad,
  número de series, rutina, día, descarga/molestias/no verde, series sin
  anotar; sin diferencia de 1RM si la modalidad cambia) y marcas verticales
  de descarga, molestias y cambio de rutina en la gráfica.
- **Coach:** cambios aditivos: `Charts.lineas({ marcas })` y en `motor.js`
  `extremosComparables` / `lecturaProgreso`. SW del Coach a v15.

### Registro

- 10/10/2026: fase 3 implementada y verificada (ver abajo).

### Verificación (fase 3, 10/10/2026)

Implementado y comprobado:

- `node --test escritorio/tests/*.test.mjs` → **79/79** (66 previas + 13 de
  `resumen.test.mjs`): cortes del informe mensual, constancia con la rutina
  de cada semana (y sin calcular alrededor de un cambio o tras un cambio sin
  sesiones), exclusiones y modalidad de los comparables, firmeza (una sola
  sesión floja no genera conclusión), prioridad y trazabilidad (cada fila
  apunta a una sesión real del mismo día; los enlaces, a ejercicios que
  existen), descarga, cambio de recuperación, peso sin extrapolar, series
  por serie (drop set, asistencia en positivo), marcas iguales a las del
  móvil, avisos de la comparación, escape de nombres importados, ayudas sin
  cifras del algoritmo y copias mínimas o antiguas.
- `node escritorio/tests/e2e.mjs` en **Chromium 141** → **28/28** (25
  previas + 3): resumen con tres conclusiones en el orden esperado, «Datos
  que la respaldan» → sesión → ficha con «Por qué este estado» (cinco
  intentos), comparación de sesiones con el teclado sin perder el foco y con
  aviso de rutinas distintas, reinicio al cambiar de ejercicio, 420 px sin
  desbordamiento. Cero peticiones externas y cero errores JS. Se hizo
  robusta una espera previa de la fase 1 que podía coincidir con la región
  `aria-live` («Importación cancelada»).
- Capturas sintéticas revisadas (resumen, conclusión desplegada, ficha,
  comparación, 420 px).
- Coach: `node --test coach/tests/*.mjs` sigue en 75/83 con los mismos 8
  fallos previos.

Sin verificar / pendiente:

- Equivalencia con una copia real del móvil (los casos son sintéticos).
- Firefox y Safari.
- Rendimiento con historiales de varios años: `comparables` y
  `conclusiones` recorren cada ejercicio una vez por render de Mi resumen;
  no medido con miles de sesiones (fase 7).
- El informe mensual del móvil incluye en su progreso sesiones con molestias
  o descarga; el escritorio las excluye (diferencia documentada en
  `METRICAS.md`).


## Fase 4 — Comparación entre periodos y bloques (10/10/2026)

### Estado, alcance y decisiones

Implementada en `diodocup/Truelift`, rama `codex/escritorio-fase4-periodos`,
sobre `bd8f52a` (fases 1–3 ya integradas). No hay `AGENTS.md` en este
repositorio. App-PRO se ha usado solo como fuente de lectura: se verificó el
modelo de contornos, sus claves estables y sus unidades canónicas.

- Apartado **Entrenamiento → Comparar periodos** y enlace desde Mi resumen.
  Cuatro fechas, validación de intervalos y acceso a dos ventanas de cuatro
  semanas completas. Fechas guardadas por espacio en `meta`, sin cambiar el
  esquema, preservadas al actualizar el JSON. Borrar un espacio borra también
  esa selección. Fallo de escritura conserva la selección previa.
- Duraciones, muestras, frecuencia, días con fuerza, constancia donde se
  conoce el plan histórico, tiempos y descargas. Detalle de semanas y enlaces
  a sesiones. Semanas parciales separadas, sin extrapolarlas.
- Ejercicios comunes por nombre y modalidad: e1RM estimado de marca, medianas
  y muestras con exclusiones móviles existentes. Diferencias solo con al menos
  dos sesiones válidas por lado; para peso corporal se omiten porque el peso
  de perfil actual no reconstruye el histórico. Cambios de series y rutina
  advertidos; ejercicios exclusivos de cada periodo enumerados.
- Rendimiento numérico guardado agrupado por identidad de rutina explícita y
  día, bruto y neto por separado. No se inventan cifras desde las palabras
  «buena»/«floja»; grupos sin muestra compatible no producen diferencias.
- Volumen con el reparto de `Motor.seriesPorGrupo`, media de semanas completas
  y totales parciales separados. Ejercicios sin grupo enumerados.
- Peso y contornos medidos dentro de cada periodo (sin arrastre), contexto
  nutricional histórico y recuperación registrada, con muestra y fechas.
- No se inventan bloques a partir de revisiones ni se usan planes futuros
  como historia. No hay ganador automático, causalidad ni recomendaciones.
  Definiciones completas en `METRICAS.md`, instrucciones en `LEEME.md`.
- Las fases 5–8 siguen pendientes. Esta entrega no completa el proyecto ni
  añade el editor personal o la comparación de fotos.

### Archivos

- Nuevo `comparacion.js`: cálculo puro y datos de las muestras.
- `index.html`, `vistas.js`, `app.js`, `escritorio.css`: carga, navegación,
  selector, tablas accesibles, foco y persistencia local.
- `tests/comparacion.test.mjs`: casos sintéticos de fase 4.
- `tests/comun.mjs`, `tests/e2e.mjs`: carga del módulo y recorrido de navegador.
- `PLAN.md`, `METRICAS.md`, `LEEME.md`: decisiones, verificación y uso.
- `tests/capturas-fase4/19-periodos-desiguales.png`,
  `20-periodos-parciales.png`, `21-periodos-estrecha.png`: datos sintéticos,
  revisadas visualmente. No contienen datos personales.

### Verificación

- `node --test escritorio/tests/*.test.mjs`: **92 aprobadas, 0 fallos, 2
  omitidas** (94 totales). Las omitidas son la sincronía con fuentes de App-PRO,
  que no está clonado junto a este repositorio; no se ha modificado `motor.js`.
- `TZ=Europe/Madrid node --test escritorio/tests/comparacion.test.mjs`:
  **15/15**, incluyendo fechas de cambio de hora.
- `node escritorio/tests/e2e.mjs`: **33/33 en Chromium 141.0.7390.0**, con
  Playwright del runtime. Se ejecutó por HTTP con viewport 1366×900 y 420×900.
  Incluye importación, ventanas desiguales, parciales, solapamiento, rechazo
  de intervalo invertido, fallo de cuota simulado, recarga, actualización
  de JSON, cierre/reapertura de pestaña, selección por espacio, restablecimiento,
  navegación a origen, teclado/foco, aislamiento del Coach y cero solicitudes
  externas o errores JS (también en las pestañas reabiertas).
- La instalación estándar de Chromium por CDN no devolvió un archivo válido.
  Se usó un ejecutable Chromium 141 del paquete temporal `@sparticuz/chromium`
  con un adaptador local de Playwright. No se añadió dependencia al proyecto
  ni se utiliza ese paquete en la web. Para reproducir en otro entorno basta
  Playwright con su Chromium instalado y `PLAYWRIGHT_MODULE` si no está en la
  ruta habitual.
- Coach: **75/83**, mismos 8 fallos preexistentes documentados en fases 0–3.
  Ningún archivo de Coach cambiado en esta fase.
- Sintaxis (`node --check`) y `git diff --check` correctos.

### Pendientes y límites

- Firefox, Safari e interacción `file://` de esta fase no probados. No se
  anuncia funcionamiento offline ni se activa ningún service worker.
- Las muestras son sintéticas; no se ha ejecutado Flutter ni una comparación
  con una copia real del móvil.
- No se ha medido rendimiento con historiales extremos (límite de selección:
  diez años). No se añade una nueva batería sin riesgo concreto.
- Sin publicación ni fusión. Propuesta: revisar la PR de esta rama y pasar a
  fase 5 tras aceptar la comparación. Para errores de importación siguen
  vigentes las instrucciones de recuperación de `LEEME.md`; esta fase no
  modifica las instantáneas ni sus fotos.


## Fase 5 — Evolución física (10/10/2026)

### Decisiones y módulos

- Rama `codex/escritorio-fase5-evolucion-fisica`, sobre fase 4
  (`8398de16a5a74f7cfa93240e9ca22b6cee66c444`). Sin tocar Coach, App-PRO,
  producción, compras ni permisos PRO. No hay AGENTS.md en Truelift;
  se leyó el de App-PRO (compatibilidad iOS/Android).
- Auditoría, referencias móviles exactas y reglas: `EVOLUCION_FISICA.md`.
  Se conserva la prioridad JSON > ficha ZIP > patrón móvil del nombre.
- `evolucion.js`: modelo puro, contornos vigentes (30 días inclusive,
  nunca futuros), comparación sin contar la misma medida dos veces,
  tendencia de mínimos cuadrados móvil, fase con intervalos inequívocos,
  pareja de la misma pose y encuadre acotado.
- `fisica-vista.js`: selección A/B, lado a lado, cortina, superposición,
  contexto, tablas con fecha real y ayudas. Escala uniforme sin deformación.
- `app.js`, `fotos.js`, `almacen.js`: metadatos pendientes también desde
  ZIP sin JSON, galería filtrada/paginada, carga de dos originales,
  liberación de object URLs y encuadres persistentes por espacio/archivo.
  Actualizar JSON no modifica binarios ni borra encuadres.
- `vistas.js`, `escritorio.css`, `index.html`: gráficas y tablas de contornos
  y composición estimada, responsive y controles con teclado; tabla de
  pesajes sin el recorte previo de 120 filas.
- Duplicados anómalos: idénticos una vez; contradictorios señalados y
  excluidos, sin inventar qué valor quiso conservar el usuario. La copia
  original permanece intacta. Explicado como límite respecto a fromJson()
  del móvil, que no resuelve este caso anómalo de forma estable.
- Encuadres reutilizan `meta`, sin migración ni nueva dependencia. Se
  guardan con acción explícita; borrar el espacio borra sus ajustes.

### Verificación

- `node --test escritorio/tests/*.test.mjs`: **110 superadas, 0 fallidas,
  2 omitidas** (112 casos). Las dos omitidas son las pruebas previas de
  sincronía de constantes que requieren App-PRO en el disco local.
  Las 18 nuevas de evolución física incluyen casos equivalentes a los
  de `test/medidas_test.dart`, fronteras 30/31 días, fecha civil/DST,
  medida del mismo día, registros repetidos, cambio cero, fotos corregidas,
  fases con huecos/solapamientos, ZIP solo, ausencias y texto escapado.
- `PLAYWRIGHT_MODULE=/tmp/truelift-playwright.cjs node
  escritorio/tests/e2e.mjs escritorio/validacion/fase5`:
  **41/41** en **Chromium 141.0.7390.0**, por HTTP local.
  El adaptador temporal usa Playwright del runtime y el Chromium disponible;
  no es dependencia ni archivo distribuido de TrueLift.
- Recorridos nuevos: JSON+ZIP con índice corregido; tres modos;
  sliders con teclado; encuadre uniforme; guardar/restablecer; recarga y
  cierre/reapertura; cuota simulada preserva lo guardado; foto ausente,
  selección idéntica y pose sin pareja; 48+7 fichas paginadas; tablas,
  gráficos y 420 px sin desbordamiento; cambio de vista libera URLs;
  corrección JSON posterior conserva hashes y bytes originales comprobados
  con SHA-256; ZIP solo en un origen local vacío conserva medidas y
  metadatos de archivos ausentes. Cero solicitudes externas y errores JS.
- Coach: **75/83**, los mismos 8 fallos de la base (comparaciones entre
  realms de Node y expectativas previas de VFC). No se editó `coach/`.
- `git diff --check` y comprobación sintáctica de scripts: correctas.
- Capturas sintéticas inspeccionadas: `validacion/fase5/22-fotos-lado.png`,
  `23-fotos-cortina.png`, `24-fotos-superposicion.png`,
  `25-fotos-estrecha.png`, `26-fotos-solo-zip.png`. Solo siluetas y datos
  generados para las pruebas; no se usan fotos personales.

### Limitaciones y continuación

- Safari/Firefox, Dart/Flutter y ZIP real de iOS/Android: pendientes. Las
  reglas móviles se comprobaron leyendo el código y portando los casos;
  no se anuncia una prueba ejecutada en el móvil.
- No medido con miles de originales ni cuota física agotada. Galería
  paginada y dos originales simultáneos limitan los recursos mostrados.
- No se atribuyen causas, ganadores, ni músculo ganado/perdido a fotos,
  contornos o masa magra estimada. La ficha no guarda la fecha/fuente del
  peso congelado; se identifica expresamente como peso guardado.
- Guardar encuadres no sustituye conservar JSON/ZIP originales. Recuperación
  de una importación fallida y uso: `LEEME.md`.
- Fases 6, 7 y 8 pendientes: editor personal/Excel, informes/offline,
  validación integral. Fase 5 no declara terminado el proyecto.
- Propuesta de revisión: revisar el delta sobre la rama de fase 4 y probar
  JSON+ZIP propios localmente, sobre todo metadatos corregidos. No fusionar
  ni desplegar sin autorización específica.
