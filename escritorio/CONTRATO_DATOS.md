# Contrato real de datos: copia JSON y ZIP de fotos

Verificado contra el código de App-PRO en la rama `ccr-7488af2f-2tnlqq`
(commit base `8d8a43f`, 10/10/2026). Las referencias son a ese árbol.

## 1. Copia JSON (Ajustes → Copia de seguridad)

**Origen:** `AppState.exportarBackup()` (`lib/app_state.dart` ~4316) =
`{..._datosAjustes(), ..._datosHistorial(), proSello}`.
Archivo: `copia_truelift_YYYY-MM-DD.json` (`truelift_backup_…` en inglés),
generado en `seleccion_screen.dart` `_exportarCopia`.

**Importación en el móvil:** `importarBackup()` acepta cualquier objeto con
`logs` **o** `sexo`; lo guarda como estado completo y vuelve a cargar. Es una
**sustitución completa** (instantánea), no una fusión. Las claves ausentes
toman su valor por defecto (copias antiguas toleradas).

### Claves que usa el escritorio

| Clave | Tipo | Notas |
|---|---|---|
| `logs` | array | Historial de sesiones (fuerza y cardio). Ver §1.1. |
| `readinessDiario` | array | Cuestionario diario. `fecha` = `YYYY-MM-DD`. |
| `saludDiaria` | array | Reloj (Health Connect / Apple Salud). Todo campo opcional; día sin dato = hueco, nunca 0. |
| `planMod` | array \| null | Rutina activa (líneas `LineaRutina`, §1.2). Solo la **actual**: no hay historial de rutinas. |
| `planModKey`, `sistema` (`simple`\|`doble`), `dias` (string `"2".."5"`), `sexo` (reparto `hombre`/`mujer`, **no** es el sexo de la persona), `sexoUsuario`, `fechaNacimiento` | | Ajustes. |
| `bloqueInicio`, `descargaInicio`, `modoDescarga`, `fasePeso`, `faseInicio` | | Estado del motor. |
| `pesoCorporal` | number (kg) | Peso de perfil actual. |
| `unidadPeso` | `kg`\|`lb` | **Solo presentación.** Todo peso guardado (logs, material, pesajes) está en kg. |
| `nutricion` | object | Módulo con `schemaVersion` propio: `perfil`, `fase`, `pesajes[] {fecha, pesoKg, enmascarado}`, `medicionesGrasa[] {fecha, porcentajePct, metodo, pesoAnclaKg}`, `recomendaciones[]`, planes… |
| `medidas` | object | `{schemaVersion:1, registros[], fotos[]}` (§2). Ausente en copias anteriores al 30/08/2026. |
| `ejerciciosUsuario` | array | Ejercicios propios. |
| `fechaUltimaCopia` | `YYYY-MM-DD` | **Fecha de la exportación ANTERIOR**: se anota después de escribir el archivo (`marcarCopiaExportada`). No es la fecha de esta copia. |
| `proSello` | string | Sello firmado del estado de prueba PRO. El escritorio **no lo lee ni lo usa**. |

**No existe** fecha de exportación de la propia copia ni identificador de
usuario o instalación. `onboardingCompletadoEn` (ISO, solo instalaciones
recientes) y `fechaNacimiento` son indicios, no identidad.

### 1.1 `logs[]`

- `fecha`: ISO **local sin zona** (`DateTime.toIso8601String()` de una hora
  local, p. ej. `2026-06-15T21:20:40.673679`). Las sesiones del reloj se
  vuelcan con `e.desde.toIso8601String()` y pueden traer `Z`. El escritorio
  toma el día de calendario del propio texto (mismo criterio que
  `DiaLocal.desdeTexto` y `parseFecha` del Coach).
- `tipo: 'cardio'` → `nombre, duracion, intensidad, origen ('reloj'), saludTipo, fcMedia, fcMax, kcal, distanciaM, rpeDeFc`.
- Fuerza: `dia, variante, dias, rutinaRevision, semana, estadoCompuerta,
  estadoSemaforo, descarga, rendimiento, rendimientoPct (formato antiguo, base
  100), rawSessionPct, netDailyPerformancePct (±%), tolPctAtSave,
  verdictAtSave, performanceMaturity, sessionRpe, duracionMin,
  duracionAnomala, volumenBajo, effectiveSets, internalLoad, entradas[]`.
- `entradas[]`: `slot, ejercicio, kg (kg; en peso corporal es el LASTRE, y la
  asistencia se guarda en negativo), kgSets[] (cargas por serie: top/back-off
  y drops), reps[] (int|null), rir[] (int|null), obs, modulada,
  progresionPausada, estadoEjercicio, neutra, noDisponible, molestias,
  sustitucion, ejercicioPlan, dropSet, restPause, superserie`.
- **Cero ≠ ausente:** `kg: 0` es válido (peso corporal sin lastre); `reps[i]:
  null` es una serie sin anotar (entrada incompleta), no un 0.
- **Guardados por el motor (no se reconstruyen):** `rendimiento`,
  `rawSessionPct`, `netDailyPerformancePct`, `tolPctAtSave`, `verdictAtSave`,
  `effectiveSets`, `estadoSemaforo`, `performanceMaturity`, `volumenBajo`.
  **Reconstruibles desde los datos:** e1RM (Epley con RIR sobre carga
  efectiva), tonelaje, series, récords — con las reglas del motor (§4).
- No hay identificador de sesión. Huella práctica: `fecha` completa (con
  hora) + `tipo` + `dia`.

### 1.2 `planMod[]` (`LineaRutina.toJson`, `lib/models.dart`)

`id ('linea_<µs>_<n>' o 'prefijada:<dia>:<orden>'), dia, orden, patron, grupo,
ejercicio, series, reps (string), rir (string), descansoMin, topBack,
backoffPct, rirBack, dropSet, dropPct, superConAnterior, restPause,
pausaRpSeg`. Las copias antiguas no traen las modalidades.

## 2. Medidas y fotos

`lib/medidas/modelos.dart`:

- `registros[] {fecha: 'YYYY-MM-DD', sitio: clave, cm}` — siempre cm;
  `10 ≤ cm ≤ 300`; uno por día y sitio. Claves: `cuello, hombros, pecho,
  biceps_izq, biceps_der, antebrazo_izq, antebrazo_der, cintura, abdomen,
  cadera, muslo_izq, muslo_der, gemelo_izq, gemelo_der`.
- `fotos[] {fecha: 'YYYY-MM-DD', pose: 'frente'|'perfil'|'espalda', archivo, pesoKg?}`.
  `archivo` es el **identificador único** (sin `/`, `\` ni `..`). `pesoKg` es
  el peso congelado al crear la foto (pesaje más cercano ±7 días o peso de
  perfil).
- **Corrección sin renombrar:** `editarFotoProgreso` cambia fecha y/o pose
  sin tocar el binario ni su nombre; si cambia la fecha, recalcula `pesoKg`.
  Por tanto **el nombre del archivo no es fiable para fecha ni pose** cuando
  hay índice.
- Nombres al crear: `foto_YYYYMMDD_pose[_n].jpg` (`AlmacenFotos.guardarDesdeRuta`).
- Arrastre de contornos para una foto: `diasArrastreContornoFoto = 30`; la
  medida vigente es la del día o la última **anterior** (nunca futura); si
  ambos extremos resuelven al mismo registro no hay cambio (`compararContornos`).
- En fase 5 se volvió a verificar este contrato contra App-PRO/main:
  referencias exactas y política para duplicados anómalos en
  `EVOLUCION_FISICA.md`. La tendencia de contornos usa `tendenciaDe`
  (mínimos cuadrados, al menos 3 puntos y 21 días). Los metadatos del ZIP
  sin binario también se conservan como pendientes si no existe índice JSON.

## 3. ZIP de fotos (Ajustes → Copia → Exportar fotos)

`seleccion_screen.dart` `_exportarFotos` / `_importarFotos`:

- Estructura **plana**: cada binario en la raíz con su nombre del almacén
  más `medidas.json` en la raíz (índice completo = `medidas.toJson()`:
  registros **y** fotos). Desde 03/09/2026; los ZIP anteriores no lo traen.
- Archivo: `truelift_fotos_YYYY-MM-DD.zip`. Paquete Dart `archive`
  (`ZipEncoder`, DEFLATE).
- Importación en el móvil: escribe todo binario con nombre válido; fusiona el
  índice del ZIP **sin pisar** lo que ya hay (la entrada local manda);
  después adopta los binarios sin entrada **solo si** el nombre cumple
  exactamente `^foto_(\d{4})(\d{2})(\d{2})_([a-z]+)(?:_\d+)?\.jpg$` con fecha
  real y pose conocida (`fichaDesdeNombreFoto`).

## 4. Reglas del motor relevantes para métricas (para fases 2-5)

- Carga efectiva: peso corporal + lastre (asistencia restada) en ejercicios de
  peso corporal (`cargaEfectiva`). El Coach usa `kg` a secas.
- No evaluables: `molestias` **o** `sustitucion` (`noEvaluable`), y
  `noDisponible`. El Coach no excluye `sustitucion`.
- Drop set y rest-pause: solo la primera serie vale para rendimiento y
  récords (`soloPrimeraSerieEvaluable`).
- Récords: solo entradas entrenadas en verde (`cuentaParaRecordsEntrada`).
- Estancamiento: lógica propia del motor (intentos, neutras, compuerta);
  el Coach usa una regla simplificada (3 sesiones sin subir kg/reps).

## 5. Prioridad de metadatos de fotos en el escritorio

1. Índice `medidas.fotos` de la **copia JSON vigente** (es el estado del
   móvil, con sus correcciones).
2. `medidas.json` del ZIP, solo para archivos que la copia JSON no conoce
   (o si no hay copia JSON con bloque `medidas`).
3. Nombre del archivo con el patrón estricto del móvil, solo si no hay
   ninguna entrada de índice. Se marca como «deducida del nombre».
4. Cualquier otro binario: no se asocia ni se guarda; se informa.

Discrepancias entre 1 y 2 para el mismo archivo se informan y gana 1. La
resolución se calcula al leer (no se congela), de modo que importar una copia
JSON nueva corrige fechas y poses sin tocar las imágenes.
