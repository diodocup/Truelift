# Planificador personal (fase 6) — contrato y decisiones

Documentación técnica de «Mi rutina» en el escritorio. Para el uso, ver
`LEEME.md`; para el registro de trabajo, `PLAN.md`.

## Tres estados que no se confunden

| Estado | Dónde vive | Qué es |
|---|---|---|
| Rutina del móvil | `planMod` de la copia JSON importada (instantánea) | Lo que la app tenía al exportar la copia. Consulta. |
| Borrador | IndexedDB `borradores` (por espacio) | Lo que se edita en el escritorio. Nunca toca la instantánea. |
| Archivo exportado | Descarga `.xlsx` + registro en `borrador.exportaciones` | Excel para importar en la app. Exportar **no** aplica nada. |

El móvil solo cambia cuando la persona importa el Excel en la app
(Rutina → Importar). Al importar, la app deja la rutina **a prueba**
(`importPendiente` en la copia) hasta que se confirma o descarta.

## Reutilización (una sola lógica)

- `coach/planner.js`: reglas del editor del Coach, cargadas tal cual.
  - `aplicarCampo` (nuevo, extraído de `bind`): modalidades excluyentes y
    superseries; lo usan el Coach y el escritorio.
  - `prepararExportacion` (nuevo, extraído de `exportar`): filas completas,
    saneo de modalidades, patrones vigentes, biblioteca y listas.
  - `_sanearModalidades`, `_patronesVigentes`, `bibliotecaParaExcel`,
    `_normalizarEjercicio`, `filaVacia`, `rutinaVacia`.
  - El escritorio usa `Object.create(Planner)` con la biblioteca de la
    persona (`ejerciciosUsuario`) en vez de la del entrenador; no toca el
    estado del Coach. `Vistas.planificador` solo se registra si existe
    `Vistas` (el escritorio no la tiene).
- `coach/xlsx.js`: escritura y lectura del Excel, `desdePlanMod`.
- Rest-pause portado al Coach canónico desde `App-PRO/web-truelift/coach`
  (riesgo R6): editor, avisos, duración, Excel N/O, `desdePlanMod`,
  `normalizar` y chip en la vista Rutina. Prueba portada:
  `coach/tests/rest-pause.test.mjs`.

## Excel que lee la app

Lector: `App-PRO/lib/rutina_excel.dart` (`RutinaExcelParser.decodificar`)
y `AppState.importarRutina` (`lib/app_state.dart`).

| Celda | Lectura en la app | Por defecto |
|---|---|---|
| Instrucciones!B3 | «simple» / «doble» | doble |
| Día n!B1 | nombre del día (`I18n.canonical`) | vacío → «Día n»; repetido → «Nombre (n)» |
| A/B filas 4–13 | patrón y ejercicio; fila sin ellos se ignora | — |
| C series | primer entero | 3 |
| D RIR | primer entero | 2 |
| E reps mín | primer entero | 8 |
| F reps máx (doble) | primer entero; si no supera a E → E + 2 | E |
| G descanso (min) | decimal; vacío = el del ejercicio | vacío |
| H/I/J top+back | «s…»/«y…»/1; % acotado 5–30; RIR back | 15 %, RIR 2 |
| K superserie | mismo número en filas consecutivas = enlazadas | 0 |
| L/M drop set | excluyente con H; % acotado 5–30 | 15 % |
| N/O rest-pause | excluyente con H y L; pausa a la rejilla 10–50 s | 20 s |
| Listas!W101… | bloque `TRUELIFT_EXERCISES_V1`: W..AC y AD «1» = por tiempo | — |

Después la app sanea: top+back manda sobre drop set; rest-pause cede ante
ambos; una superserie se suelta si toca una fila con modalidad. Días con
ejercicios: entre 2 y 5 (si no, rechaza el archivo).

`Planificador.comoLaApp` reproduce estas lecturas sobre lo que se va a
exportar y devuelve la rutina que construirá la app más `notas` con cada
reinterpretación (se enseñan como avisos). La prueba
`tests/planificador.test.mjs` ejecuta, si hay SDK de Dart y App-PRO al lado,
el **lector real de la app** sobre Excel exportados y compara campo a campo
(`tests/arnes-excel/`).

## Comparación

- Forma canónica (`_linea`): ejercicio (nombre vigente), series, reps (texto
  como lo guarda la app), RIR (no en rest-pause), descanso, modalidad,
  parámetros de la modalidad y superserie.
- Días emparejados por posición (la app los numera en orden); ejercicios por
  nombre dentro del día. No se deduce equivalencia entre ejercicios
  distintos. El orden solo se marca si cambia la secuencia relativa de los
  ejercicios comunes.
- Series por grupo y días: `Analisis.volumenPlan` (mismo reparto que la app:
  entero al grupo principal, medio a los secundarios), una pasada por día.
  Los ejercicios fuera del catálogo y de la biblioteca no suman y se listan.

## Progresión al importar

`ui.dart · avisoProgresionImportacion` → `AppState.importacionConservaProgresion`:
con el mismo sistema y el mismo número de días (y el reparto actual, que el
Excel no cambia), la app sigue proponiendo las cargas de los ejercicios que
se repiten; si cambia, abre una revisión nueva y las cargas propuestas
empiezan de nuevo (historial y récords se conservan). La app solo lo dice
si hay sesiones de la rutina actual. El escritorio repite esa misma regla y
remite a la confirmación de la app; no promete nada sobre ejercicios nuevos
o cambiados de día. Sin PRO la importación sigue otro camino
(`analizarImportacionGratis`): la app explica al importar lo que no admite.

## Borradores

Registro en `borradores` (clave `id`, índice `espacioId`):

```
{ id, version: 1, espacioId, nombre, creado, actualizado,
  rutina: {sistema, dias:[{nombre, filas:[…]}]},
  origen: { tipo: 'movil'|'excel'|'blanco'|'copia', rutina, firma?, normal?,
            instantaneaId?, desde?, archivo? },
  exportaciones: [{ fecha, archivo, firma, bytes, dias, sistema }],   // últimas 20
  bibliotecaExcel? }                                                  // ejercicios del Excel abierto
```

- Sin cambio de versión de la base: el almacén estaba reservado desde la v1.
  `leerBorrador` tolera registros incompletos.
- `meta['borradorActivo:<espacio>']` recuerda el activo; se borra con el
  espacio.
- Cada cambio se guarda en una transacción. Si falla (cuota), el estado en
  pantalla vuelve a lo guardado y se avisa.
- Deshacer/rehacer: pila en memoria por borrador (50 pasos); se pierde al
  recargar. «Volver a la rutina de partida» restaura `origen.rutina` y se
  puede deshacer.
- Importar una copia nueva no toca los borradores. Si `origen.tipo === 'movil'`
  y la rutina de la copia ya no es la de partida (`firma`), se muestra la
  discrepancia con sus cambios y dos salidas: mantener el borrador (la
  comparación pasa a la rutina actual) o crear otro desde la rutina actual.
- Estado de una exportación frente a la copia: `aplicada` (la copia trae esa
  rutina), `aPrueba` (la trae, con `importPendiente`), `pendiente` (la copia
  es anterior a la exportación) o `distinta` (posterior y sin ella).

## Límites conocidos

- 5 días y 10 ejercicios por día (lo que admite el Excel). Una rutina del
  móvil mayor se avisa y no se edita entera.
- La comparación con la rutina del móvil necesita una rutina personalizada en
  la copia; las rutinas prefijadas no viajan en `planMod`.
- Los nombres de ejercicio se escriben tal cual: si no coinciden con el
  catálogo o la biblioteca, la app los añadirá como ejercicios nuevos (se
  avisa).
- Probado con el lector real de la app (Dart 3.13, `excel` 4.0.6,
  `archive` 3.6.1) fuera del móvil; no se ha importado un archivo en un
  dispositivo iOS/Android real desde este entorno.
