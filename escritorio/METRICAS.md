# Métricas del escritorio: definiciones y equivalencia con el móvil

Auditoría de la fase 2 (10/10/2026). Las reglas portadas viven en
`coach/motor.js`; el modelo personal en `escritorio/analisis.js`. Fuente
de cada regla: App-PRO `lib/app_state.dart` (salvo que se indique otro
archivo), rama base `8d8a43f`.

Prioridad aplicada en todas las vistas:

1. Lo que la app **guardó** al cerrar la sesión (rendimiento bruto y neto,
   valoración, marcas por ejercicio).
2. Una regla **reproducida** solo si se ha portado con sus mismos datos de
   entrada y está cubierta por los casos de las pruebas del móvil.
3. Si no, **descripción neutra** o «datos insuficientes».

## Tabla de métricas

| Métrica | Origen | Definición (igual que el móvil) | Pruebas |
|---|---|---|---|
| Rendimiento bruto de sesión | Guardado: `rawSessionPct` (±%), antiguo `rendimientoPct` (base 100) o palabra `rendimiento` | `_rawPctDeLog` de `progreso_screen.dart`. Las sesiones con `displayBaselinePoint` (primera exposición sin base, 0 % por convenio) se dejan como **hueco**. | `motor.test.mjs` |
| Rendimiento neto | Guardado: `netDailyPerformancePct` | Hueco si `netDisplayBaselinePoint`. Solo existe con RPE de sesión. | `motor.test.mjs` |
| Valoración de la sesión | Guardado: `verdictAtSave`; si falta, `netVerdict(neto, tolPctAtSave)`; si no, la palabra antigua | `veredictoDeLog` | `motor.test.mjs` |
| «¿Estoy progresando?» | Reproducida desde datos guardados | `valoracionProgreso` + `tendenciaValoracion` (`valoracion_progreso.dart`): sesiones de fuerza de los 28 días previos sin descarga ni puntos sin base, últimas 4, ≥ 3 para opinar; mejora / sostiene / cae / mixta con la tolerancia. | `motor.test.mjs`, `analisis.test.mjs`, e2e |
| Tolerancia de la valoración | `tolPctAtSave` de la sesión más reciente; si no hay, `_caidaPct` de la fase (3 % ± 1 % según `fasePeso`, `faseInicio`, `fasePrevia`) | | `motor.test.mjs` |
| Carga efectiva | Reproducida | `cargaEfectiva`: peso corporal + lastre en ejercicios de peso corporal; la asistencia (también en positivo, histórico antiguo) se resta; «Fondos en máquina» es carga propia. Listas de nombres copiadas y comparadas con el código (`motor-sincronia.test.mjs`). | `motor.test.mjs` (casos de `dominada_lastre_test`, `dominada_asistida_test`) |
| e1RM de la gráfica por ejercicio | Reproducida | Epley con RIR sobre carga efectiva, mejor serie de la sesión, **sin tope** (como Progreso, `capEff: null`), marcado «≈» si reps > 18. Drops y series tras la pausa del rest-pause no compiten. Series sin RIR: RIR 0. | `motor.test.mjs` |
| Mejor marca (1RM estimado) | Reproducida | `mejorMarca`: solo entradas entrenadas en verde (`estadoEjercicio` o semáforo de sesión), sin molestias ni cambio solo por hoy, tope de 18 reps efectivas, solo primera serie en drop/rest-pause. **Las descargas no se excluyen** (el móvil tampoco). | `motor.test.mjs`, `analisis.test.mjs` |
| Estado de progresión por ejercicio | Reproducida, solo para la rutina actual | `_sesionesEstancadoEjercicio` + `sesionesEstancadas` + `intentosProgresionMax`. Ver §Estancamiento. | `motor.test.mjs` (casos de `estancamiento_test`, `sesion_a_medias_test`, `ejercicio_molestias_test`, `cambio_ejercicio_solo_hoy_test`, `rest_pause_test`) |
| Series hechas | Reproducida | `_seriesHechas`: series con reps anotadas; en entradas antiguas sin `reps`, las de RIR anotado. `null` = serie sin anotar, nunca 0. Los ejercicios «no realizado» no suman. | `motor.test.mjs` |
| Volumen real por grupo y semana | Reproducida | `historialVolumenReal` (`volumen_historico.dart`): primario ×1, secundarios ×0,5, «Isquios/glúteo» partido por patrón, «Aductores en máquina» fuera, ejercicio sin ficha fuera (no se inventa). Semana lunes-domingo; cubos de < 7 días se muestran tal cual (no se proyectan). | `motor.test.mjs` |
| Volumen planificado | Reproducida | Mismo reparto sobre las líneas de la rutina; si el ejercicio no está en la biblioteca, se usa el grupo de la línea. | `analisis.test.mjs` |
| Cambio de rutina | Dato de la copia | Identidad `variante|dias|rutinaRevision` (`rutinaKeyDeLog`). | `analisis.test.mjs` |
| Recuperación reciente | Reproducida | `recuperacionValoracion`: días con `estadoEntrenar` < 70 en los 14 días previos; ≥ 4 registros; cargada ≥ 50 %, buena ≤ 25 %. Solo con `readinessActivo`. | `analisis.test.mjs` |
| Peso tendencia, ritmo, fase | `coach/nutricion.js` (port previo del Coach) evaluado en la fecha del último registro | Filtro de peso de la app. El ritmo no se muestra con un solo pesaje. | pruebas del Coach |
| VFC y FC en reposo | `coach/data.js` (port previo del Coach) | Cada noche con su propia banda. | pruebas del Coach |

## Estancamiento

El móvil cuenta, para cada línea (ejercicio, día) de la **rutina actual**,
las oportunidades válidas consecutivas desde la más reciente con el mismo
kg sin cumplir el objetivo de reps. Una oportunidad es válida si:

- la sesión es de la rutina actual (`variante`, `dias`, `rutinaRevision`);
- no es descarga, el ejercicio no está «no realizado», no tiene compuerta
  cerrada (`progresionPausada`), no está modulado (`modulada`), no tiene
  molestias ni es un cambio solo por hoy;
- todas las series **top** están anotadas (`oportunidadCompleta`);
- con marca por ejercicio (`progresionPausada`/`modulada` registradas) cuenta
  aunque el día no fuera verde; sin marca, solo en verde;
- una entrada **neutra** fallida se ignora; una neutra cumplida corta la racha.

El objetivo es el primer número del rango en sistema simple y el último en
doble; en rest-pause cuenta la **suma** de reps. Los intentos son 5 en
déficit, 3 en superávit y 4 en el resto.

El escritorio recorre `logs` en **orden de archivo**, como el móvil (no por
fecha). Estados que muestra:

| Estado | Condición |
|---|---|
| Objetivo cumplido | La oportunidad válida más reciente cumplió el objetivo. |
| Buscando el objetivo (n de N intentos) | 0 < n < N. |
| Intentos agotados | n ≥ N. El escritorio **no** dice qué hará la app: en un déficit prolongado no baja la carga. |
| Datos insuficientes | Ninguna oportunidad válida en la rutina actual. |
| Fuera de tu rutina / Sin valorar | El ejercicio no está en la rutina actual, o la copia no trae la rutina en uso. Solo se describe. |

## Diferencias conocidas con el móvil (y por qué)

1. **Fecha de referencia.** El móvil evalúa con la fecha de hoy; el
   escritorio, con el **último registro** de la copia (la copia no dice
   cuándo se exportó). La antigüedad de los datos se muestra siempre.
2. **Rutina en uso.** El móvil usa `planMod` solo si `planModKey` es su
   combinación actual **y** PRO está activo. El escritorio no lee el estado
   PRO (`proSello`) y no tiene las rutinas prefijadas: si `planModKey`
   coincide, asume que la rutina guardada es la que se usa; si no, no valora
   la progresión. Si la persona perdió PRO, el móvil usaría la rutina gratis
   y los estados podrían diferir.
3. **Contador fuera del verde.** El móvil oculta las barritas de intentos
   si hoy no es verde o hay descarga; el escritorio enseña el contador del
   historial y, en descarga, avisa de que no se cuentan intentos.
4. **Valoración: frases de contexto.** Se reproduce el título y la frase de
   hecho; no las frases de fase, ritmo y escalera del déficit, que dependen
   del estado vivo del lazo de nutrición.
5. **Peso corporal en ejercicios de peso corporal.** Se usa el peso de
   perfil actual para todo el historial, igual que el móvil; si la copia no
   trae `pesoCorporal`, no se estima e1RM de esos ejercicios.
6. **Biblioteca de ejercicios.** El grupo, patrón y secundarios salen de
   `coach/catalogo.js` (copia generada de la biblioteca de la app) y de
   `ejerciciosUsuario`. Si la copia del catálogo está desfasada, un
   ejercicio nuevo de la app no se repartiría en el volumen (se avisa).
7. **Gráfica de carga.** Muestra el kg de la serie principal tal como lo
   teclea la persona (lastre en peso corporal, asistencia en positivo).

## Reglas simplificadas del Coach (no usadas en el escritorio)

`coach/data.js` `Metricas.diagnostico` declara «Estancado» tras 3 sesiones
evaluables sin subir kg ni reps totales, con cualquier rutina, objetivo o
estado del día. Contradice al móvil (que mide contra el objetivo de la
rutina, por series top, con exclusiones y con intentos por fase) y puede
afirmar un estancamiento que el móvil no ve. El escritorio **no la usa**.
En el Coach se han corregido solo las lecturas que eran errores claros y
compartidos: el cambio solo por hoy ya no se evalúa, las sesiones sin base
son hueco y los nombres fusionados se leen como en la app. Sustituir el
diagnóstico del Coach por el del motor queda fuera de este encargo
(herramienta del entrenador) y se propone como tarea aparte.

## Fase 3: resumen y ficha por ejercicio

Ventana del resumen: los 28 días que terminan en el último registro (la
misma que la valoración de la app). Código: `escritorio/analisis.js`.

| Lectura | Origen | Regla |
|---|---|---|
| Días previstos por semana | Reproducida desde los datos | Semana lunes-domingo. Rutina conocida si la última sesión anterior, las de la semana y la primera posterior tienen la misma identidad `variante|dias|revisión`; sin sesión posterior, si la rutina actual es la de la última sesión. Previstos = `dias` de esa identidad. Si no, «sin calcular». La semana en curso no se valora. Se compara con días con sesión (como `diasEntrenados` del informe mensual). |
| Evolución de un ejercicio | Reproducida (`resumen_mensual.dart` `_extremosComparables`, cortes de `informe_mensual.dart`) | Mejor 1RM estimado de marca (Epley con RIR, carga efectiva, tope de 18 reps efectivas) por sesión. Media de las dos primeras y las dos últimas (con 2–3, primera y última). Δ ≥ 1 % al alza; Δ < −1 % a la baja; si no, «sin cambios claros». |
| Sesiones comparables | Más estricta que el informe mensual | Entrenado en verde (como el móvil) **y** sin descarga, molestias ni cambio de un día, con la misma modalidad (normal, top + back-off, drop set, rest-pause) que la última sesión válida. El informe mensual del móvil no excluye descargas ni molestias ni separa modalidades. |
| Lectura «firme» | Propia del escritorio | ≥ 4 sesiones comparables y las dos últimas por debajo (o por encima) de la media inicial. Solo las firmes se convierten en conclusión. |
| Marcas | Reproducida (`mejorMarca`) | Cada sesión que supera la mejor marca anterior; la primera fija la referencia. |
| Recuperación: cambio | Regla de la app aplicada dos veces | `recuperacionValoracion` en los 14 días previos al último registro y en los 14 anteriores. |
| VFC baja | Reproducida (`tendenciaBajaFechas`) | Noches de los últimos 7 días con la media de 7 noches por debajo del umbral 3 o más días seguidos. |
| Peso | Filtro de la app (`coach/nutricion.js`) | Tendencia en el último punto del filtro y en el último punto ≤ 28 días antes; cambio solo con ≥ 2 pesajes en la ventana. No se extrapola. |

### Conclusiones y prioridad

| Prioridad | Conclusión | Condición |
|---|---|---|
| 1 | Rendimiento por debajo de tu nivel | Valoración de la app = `cae` (sin descarga) |
| 1 | Intentos agotados | Algún ejercicio con `intentosAgotados`; si además su 1RM baja de forma firme, se dice aquí |
| 2 | Estado para entrenar bajo | Lectura `cargada` |
| 2 | VFC baja sostenida | Alguna noche marcada en la última semana |
| 3 | 1RM estimado a la baja | Lectura firme a la baja (sin los ya citados por intentos) |
| 3 / 5 | Constancia | ≥ 2 semanas completas con rutina conocida; 3 si faltan días, 5 si se cumplieron |
| 4 | Nuevas marcas | Alguna marca superada en la ventana |
| 4,5 | 1RM estimado al alza | Lectura firme al alza |
| 4 / 5 / 6 | Valoración mejora / mixta / sostiene | Valoración de la app |
| 5 | Estado para entrenar mejorado | Antes `cargada`, ahora `buena` |

Empates: el orden de la tabla. Se muestran las tres primeras. Ninguna
recomienda cambios ni hace valoraciones médicas; las limitaciones de cada
una se muestran con ella.


## Fase 4 — comparación entre periodos

`comparacion.js` reutiliza `Analisis` y `Motor`; no modifica el JSON ni las
reglas móviles. Los intervalos son inclusivos, en días locales. Su duración
se cuenta por componentes de calendario, independiente del horario de verano.

| Dato | Definición en el comparador | Límite |
|---|---|---|
| Cobertura | Primer registro fechado de fuerza, recuperación, pesajes o contornos hasta último registro disponible | No acredita que cada día se registrara todo |
| Frecuencia | Sesiones y días distintos con fuerza / número de semanas lunes–domingo completas dentro del periodo y la cobertura | Semanas vacías cuentan como cero registros; parciales fuera de la media |
| Constancia | Días con fuerza frente a días previstos, solo en semanas completas con planificación histórica acotada (`Analisis.planSemana`) | Nunca extender automáticamente la frecuencia actual al pasado |
| Series / grupo | `Motor.seriesPorGrupo`: principal ×1, secundarios ×0,5; media de semanas completas | Totales parciales aparte, sin proyectar ni comparar sus diferencias; sin grupo reconocido fuera del reparto |
| Tiempo | Mediana de `duracionMin` positiva no marcada como anómala, todas las sesiones del intervalo | `n` y fechas de la muestra; no suplir ausentes con cero |
| Ejercicios comunes | Mismo nombre vigente y misma modalidad (`Analisis.configuracion`); mediana de e1RM de marca de sesiones elegibles | Sin descarga, molestias, sustitución, día no verde ni estimación ausente; mínimo 2 sesiones únicas por lado para diferencia descriptiva, no conclusión de progreso |
| Ejercicios de peso corporal | Estimación existente con peso del perfil | Sin diferencia porcentual entre periodos: peso corporal histórico no reconstruible |
| Rendimiento | Medianas de porcentajes numéricos guardados; grupos por variante, días, revisión explícita y día de entrenamiento | Sin descargas ni puntos sin referencia; mínimo 2 datos por lado para diferencia en pp. Las referencias móviles son móviles: no mide fuerza absoluta |
| Peso | Mediana de pesajes dentro del intervalo, normalización existente: primero de cada día | No es tendencia ni cambio entre extremos; kg canónicos aunque presentación móvil sea lb |
| Contornos | Medianas por sitio de registros válidos (10–300 cm) dentro del intervalo | Sin arrastre; mismo día/valor cuenta una vez; valores contradictorios del mismo día excluidos y avisados |
| Nutrición | Fases con fechas guardadas que coinciden; recomendaciones y ritmo real guardado dentro del periodo | Plan de temporada no es historial; ajuste guardado no acredita ingesta real |
| Recuperación | Medianas de días con estado 0–100, VFC positiva no descartada y FC positiva | Huecos fuera de la muestra; días repetidos iguales no inflan `n`; conflictos excluidos |

La tabla de ejercicios separa muestras por modalidad y cuenta una sesión una
vez. Si una entrada se repite en una sesión, conserva la primera elegible para
esa modalidad. Advierte del cambio de series y rutina. No usa tonelaje ni reps
totales para inferir progreso. La copia no identifica máquinas ni permite
verificar técnica o rango de movimiento: se explicita esa limitación.

No se reconstruyen bloques de entrenamiento a partir de revisiones de rutina:
la primera sesión conocida no es necesariamente el inicio de un bloque. Los
periodos se eligen manualmente. Se informa de duración distinta, solapamiento,
selecciones fuera de cobertura y ausencia de semanas completas.

Pruebas: `tests/comparacion.test.mjs` (15 casos, también con `TZ=Europe/Madrid`)
y el recorrido de fase 4 de `tests/e2e.mjs`.
