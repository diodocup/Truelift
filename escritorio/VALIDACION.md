# Validación integral y entrega — fase 8

Fecha: 10/10/2026. Rama: `codex/escritorio-fase8-validacion`.
Base: `6c12707d720691f09effa08d03ff2660934f7c32` de `diodocup/Truelift`.
Referencia móvil consultada: `diodocup/App-PRO`, commit
`8d8a43fc3820f99e9ee79a1b61b6e3bed5213e74`.

**Resultado:** validación funcional superada en Chromium por HTTP local,
incluida reapertura del proceso, privacidad, almacenamiento y actualización
del service worker. El lector real de Excel de la app supera la prueba Dart.
Entrega preparada para revisión; no equivale a certificación en todos los
navegadores ni a prueba en un móvil real. No se ha fusionado ni desplegado.

## Qué aporta cada fase

| Fase | Función entregada | Referencia |
|---|---|---|
| 0 | Arquitectura separada del Coach y contrato real de datos | `PLAN.md`, `CONTRATO_DATOS.md` |
| 1 | JSON como instantánea, ZIP opcional, vista previa, IndexedDB y recuperación | `importar.js`, `zip-seguro.js`, `fotos.js`, `almacen.js`, `app.js` |
| 2 | Navegación personal y métricas explicadas, con prioridad de resultados móviles | `analisis.js`, `vistas.js`, módulos comunes de `coach/`, `METRICAS.md` |
| 3 | Resumen trazable y ficha de ejercicio con series y comparaciones | `analisis.js`, `vistas.js` |
| 4 | Periodos desiguales, semanas completas/parciales y muestras insuficientes | `comparacion.js` |
| 5 | Galería, tres modos de comparación y asociación de medidas | `evolucion.js`, `fisica-vista.js`, `EVOLUCION_FISICA.md` |
| 6 | Borradores independientes, comparación de rutina y Excel compatible | `planificador.js`, `rutina-vista.js`, `PLANIFICADOR.md` |
| 7 | Informes, impresión, tablas accesibles y recursos sin conexión | `informe.js`, `informe-vista.js`, `sw.js` |
| 8 | Casos adversos, correcciones, comprobación visual y evidencia reproducible | Este documento, `tests/integral.e2e.mjs`, `validacion/fase8/` |

Las fases anteriores no se han reimplementado. No se modifica App-PRO,
ningún algoritmo móvil, compras, PRO, cuentas ni servicios externos.

## Fallos encontrados y correcciones

1. **Importación parcialmente confirmada ante error asíncrono.** En
   `almacen.js`, `preventDefault()` sobre el error de una petición IndexedDB
   permitía continuar la transacción. Ahora se aborta explícitamente y se
   conserva la causa original hasta que termina el rollback. La nueva prueba
   provoca un `ConstraintError` real en la última escritura de una importación
   y compara los ocho almacenes, incluidos bytes de originales y miniaturas.
   La simulación previa de cuota también continúa pasando.
2. **Correcciones del ZIP descartadas como duplicadas.** Se permitía guardar
   solo si había un JSON distinto o imágenes nuevas. Ahora se puede guardar
   únicamente el índice; se consultan sus metadatos actuales también para
   binarios ya existentes. Los cambios respecto al índice anterior exigen
   confirmar, pues no existe una fecha de exportación fiable. El JSON sigue
   mandando. Se comprueban índices sin imágenes, reimportación idéntica,
   corrección sin renombrar, posible retroceso y cancelación. Un espacio con
   solo índice también exige decidir si el JSON actualiza o crea otro espacio.
3. **Bloqueo de almacenamiento sin modo temporal.** Algunos entornos pueden
   lanzar `SecurityError` al acceder a `indexedDB`, antes incluso de `open()`.
   Ese acceso queda dentro del control de errores y muestra el modo temporal.
4. **Caché disponible pero página inutilizable con HTTP 503.** `sw.js` usa la
   copia válida de su propia caché ante respuestas HTTP erróneas, no solo ante
   desconexión. Si falla la escritura en caché, conserva la respuesta de red.
   La versión pasa a `tlescritorio-v2`; se prueba actualización real del worker
   local y reapertura offline, conservando datos y cachés de otras páginas.
5. **Desbordamiento a 420 px.** Una etiqueta `.sr-only` de una tabla quedaba
   posicionada fuera de la región desplazable. Dar un contexto de posición
   a `.tabla-scroll` mantiene esa etiqueta dentro de la región sin ocultarla
   al lector de pantalla. La comprobación incluye las siete secciones.

Archivos de producto modificados: `almacen.js`, `app.js`, `fotos.js`,
`escritorio.css` y `sw.js`. Pruebas: `tests/zip-fotos.test.mjs`,
`tests/e2e.mjs` (versión de caché) y nuevo `tests/integral.e2e.mjs`.
Documentación: `PLAN.md`, `LEEME.md`, `CONTRATO_DATOS.md` y este documento.
No hay cambios en `coach/`, migración de esquema ni nuevas dependencias de
ejecución/CDN. Los datos v1 existentes siguen usando los mismos almacenes.

## Resultados ejecutados

| Comprobación | Resultado en esta entrega |
|---|---|
| Módulos de escritorio, Node 24.19.0 | **137/137**, sin fallos ni omitidas |
| Excel con lector de App-PRO, Dart 3.13.5 | Incluido arriba: dos archivos, lectura y comparación de campos, modalidades y biblioteca propia |
| Recorridos existentes, `tests/e2e.mjs` | **55/55**, Chromium 141.0.7390.0 |
| Riesgos integrales, `tests/integral.e2e.mjs` | **13/13**, mismo Chromium |
| axe-core 4.14.0, WCAG 2.1 A/AA | **0 infracciones** en siete secciones a 1366 y 420 px |
| Privacidad en ambos recorridos | Cero solicitudes externas; la prueba integral comprueba además cero cuerpos de solicitud y solo GET |
| Coach | **85/93**, exactamente los ocho fallos de la base; ninguna regresión añadida |
| Sintaxis JavaScript y `git diff --check` | Correctas |

Playwright 1.62.1, Chromium 141 del paquete de herramientas de prueba
`@sparticuz/chromium` 141.0.0. Las herramientas se instalaron en una carpeta
temporal; no se sirven ni se añaden como dependencias de TrueLift. La CSP de
la aplicación se conserva: axe se inyecta mediante la instrumentación del
navegador únicamente para la auditoría.

Los ocho fallos conocidos de Coach están en `fc-reposo.test.mjs` (2),
`nutricion.test.mjs` (4) y `umbral-por-dia.test.mjs` (2): comparaciones de
objetos de distintos contextos VM y expectativas antiguas de color/atributos
SVG. Ya fallaban en el commit de partida. No se han cambiado sus aserciones
para presentar una batería completamente verde. Sus detalles figuran en el
registro de resultados; no se certifica esa batería como superada.

## Matriz de los 16 requisitos de validación

Todas las entradas, notas e imágenes usadas en las pruebas son sintéticas.

| # | Riesgo | Evidencia ejecutada |
|---|---|---|
| 1 | JSON actual y antiguo | `importar.test.mjs`, `resumen.test.mjs`, importación real en e2e |
| 2 | JSON inválido y opcionales ausentes | `importar.test.mjs`, estado mínimo y rechazo recuperable en e2e |
| 3 | Cero, ausente, inválido y libras | `importar.test.mjs`, `motor.test.mjs`, `analisis.test.mjs` |
| 4 | Copia idéntica y sustitución completa | `importar.test.mjs`, e2e detecta duplicado y sustituye sin unir historiales |
| 5 | Posible copia antigua | `importar.test.mjs`, confirmación y vuelta a la copia anterior en e2e |
| 6 | ZIP con índice y antiguo sin índice | `zip-fotos.test.mjs`, importación de ambos formatos en e2e |
| 7 | Repetido, corrupto, límites y cancelación | `zip-fotos.test.mjs`, e2e; límites globales sin reservar archivos gigantes |
| 8 | Fotos ausentes, huérfanas y conflictos | `zip-fotos.test.mjs`, e2e, índice sin originales en integral |
| 9 | Fecha/pose corregidas con el mismo nombre | Tests de fotos/evolución, e2e JSON y nueva corrección ZIP sin cambiar bytes |
| 10 | Cuota/persistencia sin pérdida | Simulación de cuota en e2e; error asíncrono real, comparación integral y SecurityError en nueva batería |
| 11 | Descargas, molestias, modalidades y no realizados | `motor.test.mjs`, `analisis.test.mjs`, `resumen.test.mjs`, `informe.test.mjs`, copia rica en navegador |
| 12 | Periodos desiguales y muestras insuficientes | `comparacion.test.mjs`, `informe.test.mjs`, comparación en e2e |
| 13 | Borradores conservados tras actualizar | `planificador.test.mjs`, e2e y fallo/reintento en integral |
| 14 | Rutina exportada compatible | Exportación descargada y reabierta en e2e; archivos exportados leídos por el importador real Dart |
| 15 | Recarga, cierre y reapertura | e2e; nueva batería cierra y arranca el proceso Chromium con el mismo perfil y compara los ocho almacenes |
| 16 | Ausencia de envío de datos | Monitor de solicitudes en ambos recorridos; código sin backend y CSP de origen propio |

El caso de cuota no llena físicamente el disco. El error asíncrono real es
una restricción de IndexedDB, provocada mediante instrumentación de la última
escritura, y no una cuota agotada real. Ambas comprobaciones se distinguen.

## Recorridos visuales y capturas

Revisadas capturas del resumen, importación, error recuperable, comparación
de periodos, fotos, editor e informe. Las tablas anchas se desplazan dentro
de su región; no fuerzan el ancho de la página.

Capturas de esta ejecución en `validacion/fase8/`:

- `34-metadatos-zip.png`: confirmación de índice distinto, imagen duplicada.
- `35-error-atomico.png`: importación rechazada sin perder los datos anteriores.
- `36-resumen-1366.png`, `36-resumen-420.png`: escritorio y ventana estrecha.
- `19-periodos-desiguales.png`, `22-fotos-lado.png`, `27-rutina-editor.png`,
  `30-informe.png`: recorridos completos generados de nuevo en esta entrega.

Las fotos son figuras geométricas generadas en un canvas, no personas. La
impresión a PDF y sus estilos se ejecutan en la batería e2e; no se prueba una
impresora ni el diálogo del sistema operativo.

## Reproducir

Desde la raíz de Truelift, con Node y Playwright/Chromium disponibles:

```sh
node --test escritorio/tests/*.test.mjs
node --test coach/tests/*.mjs
PLAYWRIGHT_MODULE=/ruta/playwright node escritorio/tests/e2e.mjs /tmp/capturas-truelift
PLAYWRIGHT_MODULE=/ruta/playwright AXE_MODULE=/ruta/axe-core/axe.min.js node escritorio/tests/integral.e2e.mjs /tmp/capturas-integrales
DART=/ruta/dart APP_PRO_DIR=/ruta/App-PRO node --test escritorio/tests/*.test.mjs
```

Los scripts de navegador levantan su propio servidor HTTP local, generan
archivos temporales y cierran sus perfiles sintéticos al terminar. El último
comando necesita las fuentes del móvil y las dependencias Dart del arnés.
Sin App-PRO se omiten dos comprobaciones de sincronía; sin Dart se omite el
lector real, y se informa en la salida. Sin `AXE_MODULE` solo se omite axe,
no las demás comprobaciones integrales. Registros: `validacion/fase8/*.txt`.

## Uso y recuperación

1. Abrir `escritorio/` por HTTP(S). Para revisar la rama: desde la raíz,
   `python3 -m http.server 8000`, y abrir `http://localhost:8000/escritorio/`.
2. Exportar el JSON desde Ajustes → Copia de seguridad de TrueLift. Importarlo
   y revisar periodo/recuentos antes de confirmar. El ZIP de fotos es opcional
   y puede seleccionarse junto al JSON o por separado.
3. Al actualizar, elegir explícitamente el espacio. No mezclar copias de
   distintas personas. El JSON sustituye la instantánea; conserva fotos y
   borradores separados. Revisar los avisos de copia antigua o índice distinto.
4. Mi rutina → crear/editar borrador → revisar cambios → Exportar Excel para
   la app. Pasar el archivo al móvil, importarlo en Rutina y confirmarlo allí.
   Exportar no aplica el cambio. Una copia JSON posterior permite comprobarlo.
5. Ante una importación fallida, los datos anteriores siguen guardados:
   recargar y reintentar, o liberar espacio/importar JSON sin fotos. No borrar
   el navegador como primer recurso. Conservar siempre los originales.
6. Si se confirmó un JSON equivocado: Mis datos → Volver a la copia anterior.
   Para deshacer una sustitución explícita de imagen/índice, reimportar el ZIP
   correcto; la recuperación de JSON no restaura binarios ni el índice ZIP.
7. Si aparece «Modo temporal», los datos importados se perderán al cerrar.
   Abrir después en un navegador que permita persistencia y reimportar los
   originales. No se promete recuperar datos que solo existían en memoria.

Guía detallada: `LEEME.md`. Definiciones y límites: `METRICAS.md`,
`PLANIFICADOR.md`, `EVOLUCION_FISICA.md` y `CONTRATO_DATOS.md`.

## Pendientes antes de dar por cerrado todo el producto

- **Firefox, Safari y Edge reales:** no ejecutados. Verificar importación
  DEFLATE, miniaturas, IndexedDB, impresión y actualización offline en ellos.
- **iOS y Android reales:** no se ha exportado un JSON/ZIP desde dispositivos
  en esta sesión ni aplicado un Excel con el flujo completo de la app y sus
  permisos. Dart verifica el lector compartido, no ese flujo de interfaz.
- **Cuota física agotada y galerías de miles de originales grandes:** sin
  medición nueva. Los límites, paginación y cancelación tienen pruebas; las
  cifras de rendimiento con 468 fotos y tres años de datos pertenecen a la
  fase 7, no se presentan como una medición repetida en la fase 8.
- **Producción, actualización publicada y diagnóstico simplificado del Coach:**
  fuera de esta validación. No se autoriza ni ejecuta despliegue/merge.
- **Accesibilidad manual con lector de pantalla:** axe y teclado no sustituyen
  una sesión real con NVDA/VoiceOver.

Propuesta de revisión: revisar primero atomicidad y prioridades JSON/ZIP,
después ejecutar ambas baterías de navegador sobre la rama y completar la
transferencia móvil y los navegadores pendientes. La propuesta es abrir una PR
en borrador, sin fusión automática. El registro para continuar sigue siendo
`PLAN.md`.

### Estado de entrega remota

Los cambios y las evidencias están en el commit local `57316f2`, sobre la rama
indicada. La revisión automática de permisos rechazó `git push` al interpretar
la restricción de publicación como prohibición de subir código al remoto. No
se ha intentado eludir el bloqueo con otro mecanismo. **Subida de rama y PR
pendientes de autorización explícita; todavía no hay una PR de esta fase.**
El registro de este bloqueo se guarda en un commit documental posterior.

**Actualización 11/10/2026:** el usuario autoriza expresamente subir la rama
y abrir la PR en borrador, sin fusionar ni desplegar. Queda resuelto el bloqueo
de autorización descrito arriba. La entrega remota se realiza mediante la
conexión autenticada de GitHub; la CLI local no dispone de credenciales.

---

## Plan de entrenador — validación final (F6, 10/11/2026)

Especificación: `PLAN_ENTRENADOR.md` de App-PRO (§8.1 y §8.3; la F6 de §9).
Base: `f8a90e6` de `diodocup/Truelift` (F0, F3 y F5 ya fusionadas) y
`9d393f3` de `diodocup/App-PRO` (F0, F1, F2 y F4). Contrato:
`CONTRATO_PLAN_ENTRENADOR.md`, idéntico en los dos repositorios (lo
comprueba `plan-entrenador.test.mjs`).

**Resultado:** el modo entrenador y el contrato compartido pasan todas sus
pruebas automáticas. Por primera vez se ha ejecutado el **verificador real de
la app** (Dart, `lib/plan_entrenador/sobre.dart`) sobre planes recién emitidos
por el escritorio: los acepta y se queda exactamente con lo emitido. Queda la
comprobación en dispositivos reales (§8.4), que hace una persona con la lista
de `COMPROBACION_PLAN_ENTRENADOR.md` (App-PRO).

### Resultados ejecutados (Chromium de Playwright, Node 22, Dart 3.13 de Flutter 3.47.9)

| Batería | Resultado |
|---|---|
| `node --test escritorio/tests/*.test.mjs` (con App-PRO al lado y `DART`) | 222/222, ninguna omitida |
| `escritorio/tests/plan-entrenador-app.test.mjs` (nueva) | 3/3: vectores dorados con el verificador de la app; tres planes recién emitidos (rutina de la copia de ejemplo, rutina con todas las modalidades, un ejercicio propio y uno desconocido más temporada, y solo temporada) aceptados y leídos campo a campo igual; alterado → `firmaInvalida`, de otra clave → `claveDesconocida`, caducidad inclusiva y después `caducado` |
| `node escritorio/tests/entrenador.e2e.mjs` | 10/10 |
| `node escritorio/tests/integral.e2e.mjs` | 13/13 (el visor no cambia para quien no es entrenador) |
| `node escritorio/tests/e2e.mjs` | falla en el paso 41 (Nutrición espera «DÉFICIT» y la copia de ejemplo está en superávit), igual que antes de F3; no es del plan de entrenador |

### Matriz de §8.1 y §8.3

| Requisito | Dónde se prueba |
|---|---|
| Vectores dorados idénticos en los dos repositorios, con su SHA-256 | `plan-entrenador.test.mjs` (manifiesto, regeneración determinista, App-PRO al lado) |
| Cada vector da su resultado esperado | `plan-entrenador.test.mjs` (escritorio) y `plan-entrenador-app.test.mjs` (app) |
| Verificador real de la app sobre paquetes recién emitidos (§8.1, opcional) | `plan-entrenador-app.test.mjs` + `tests/arnes-plan-entrenador/verificar.dart` |
| `paquete.js`: construir, firmar, verificar; RFC 8032 | `plan-entrenador.test.mjs` |
| Archivo de clave: contraseña correcta e incorrecta, archivo corrupto, manipulado o ajeno | `entrenador.test.mjs`; e2e paso 2 |
| Editor de rutina (pruebas recuperadas de `planificador.test.mjs`) | `entrenador.test.mjs` |
| Editor de temporada: límites y coherencia con la proyección | `entrenador-temporada.test.mjs`; e2e pasos 5 y 7 |
| Migración IndexedDB v2 → v3 con la copia de ejemplo | e2e paso 9 |
| Sin clave no hay sección ni se piden sus scripts | e2e pasos 1 y 8; `sw.js` no los precachea |
| Con clave de pruebas: cliente, emisión y archivo que verifica | e2e pasos 3, 4, 5 y 7 |
| Estado de los planes emitidos leyendo `planEntrenador` | `entrenador-temporada.test.mjs`; e2e paso 6 |
| Pruebas existentes del escritorio en verde | todas las baterías de arriba |

### Arnés Dart

`tests/arnes-plan-entrenador/verificar.dart` no copia código de la app:
resuelve `package:rutinas_app` con `--packages` de App-PRO, así que prueba
el verificador tal cual está en su rama. La clave de pruebas entra por el
parámetro de pruebas (`clavesDePrueba`); el mapa de producción no se lee. Sin
App-PRO al lado (o `APP_PRO_DIR`), sin `flutter pub get` hecho en él o sin
Dart (`DART=/ruta/dart` o `dart` en el PATH), las tres pruebas se omiten y lo
dicen.

### Reproducir

```sh
# en App-PRO, una vez
flutter pub get
# en Truelift
DART=/ruta/flutter/bin/cache/dart-sdk/bin/dart node --test escritorio/tests/*.test.mjs
node escritorio/tests/entrenador.e2e.mjs
node escritorio/tests/integral.e2e.mjs
```

### Pendiente (persona)

- Comprobación en Android e iOS reales (§8.4): lista paso a paso en
  `COMPROBACION_PLAN_ENTRENADOR.md` de App-PRO.
- Primera clave de producción en `lib/plan_entrenador/claves.dart` (§11.1):
  hasta entonces la app rechaza todos los planes.
- Modo entrenador en Firefox, Safari y Edge reales: no ejecutado (solo
  Chromium), igual que el resto del escritorio.
