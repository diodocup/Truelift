# TrueLift Coach

Herramienta web para entrenadores: visualiza los entrenamientos de tus clientes de TrueLift y crea o revisa sus rutinas. Sin internet, sin instalación.

## Archivos de ejemplo

En esta carpeta hay cinco copias de prueba para ver el Coach con datos antes de
importar a nadie: `Carlos_`, `Javi_`, `Laura_`, `Nuria_` y `Ruben_2026-08-26.json`.
Cubren las combinaciones de sistema y días de la app (simple y doble, de 3 a 5
días). **Los cinco clientes son ficticios**: nombres, fechas de nacimiento,
entrenamientos, pesajes y cuestionarios están inventados y no pertenecen a
ninguna persona.

## Uso

1. Abre `index.html` con doble clic (Chrome o Edge recomendados).
2. Pulsa **+ Importar JSON** (o arrastra el archivo a la ventana) con la copia de seguridad que te envía el cliente desde TrueLift.
3. Dale un nombre al cliente. Puedes tener varios clientes y cambiar entre ellos desde el desplegable.
4. Cuando el cliente te envíe una copia nueva, impórtala y elige **Actualizar existente**.

## Pestañas

- **Cartera**: pantalla inicial con todos los clientes — semáforo de atención, última sesión, antigüedad de los datos importados, adherencia del bloque y alertas. Clic para abrir un cliente. Ordenada por atención requerida.
- **Resumen**: ficha, adherencia, disponibilidad diaria (semáforo), rendimiento y alertas (ejercicios marcados con molestias, molestias intuidas en observaciones, estancamientos, RIR alto, readiness/VFC).
- **Sesiones**: cada sesión con kg/reps/RIR por serie, observaciones resaltadas, delta vs sesión anterior y el distintivo 🤒 de los ejercicios hechos con molestias.
- **Ejercicios**: progresión por ejercicio con gráfica de kg y e1RM estimado, y diagnóstico automático.
- **Rutina**: plan activo vs última ejecución, ejercicios fuera de plan, volumen semanal por grupo y la **evolución del volumen real** — series efectivas/semana por grupo muscular sobre todo el historial del cliente, con la zona objetivo y los cambios de rutina marcados. Desde aquí puedes abrir la rutina en el Planificador.
- **Planificador**: crea o revisa la rutina del cliente y expórtala al Excel que él importa en TrueLift.
- **Readiness**: estado para entrenar (0–100), VFC con su banda y detalle diario.
- **Nutrición**: la capa de dieta del cliente, si la tiene activada (ver abajo).

## Ejercicios hechos con molestias

En TrueLift el cliente puede marcar un ejercicio como **realizado con molestias o limitaciones** (dolor, rango recortado, menos peso del que tocaba, técnica adaptada). Es lo que le permite entrenar suave mientras se recupera sin arruinar su progresión, y aparece marcado con 🤒 en todo el Coach.

Esa sesión **se registra igual** —kg, repeticiones y volumen cuentan— pero la app **no la evalúa**: no mide su rendimiento, no gasta un intento de progresión, no sirve de referencia para las siguientes sesiones y no puede marcar un récord. Cuando el cliente vuelve a estar bien, la carga se retoma desde su última sesión buena.

El Coach lee la marca con el mismo criterio, para que no aparezcan diagnósticos falsos:

- **Diagnóstico de progresión** (Ejercicios y Planificador): esas sesiones no cuentan. Sin esto, tres semanas entrenando suave por una tendinitis se leían como un estancamiento.
- **Mejor e1RM del rango**: las excluye, igual que los récords de la app.
- **RIR alto sostenido**: tampoco las mira.
- **Gráfica de progresión**: los puntos se pintan en ámbar. La curva sigue enseñando lo que se hizo, pero se ve de un vistazo que ese bajón es voluntario.
- **Última carga de referencia** en el Planificador: es la de la última sesión *evaluable*, no la del día con molestias. Si no hay ninguna, se enseña la real avisando de que no sirve para planificar.
- **Alertas**: cada ejercicio marcado genera una alerta roja, y si se repite en **3 o más sesiones** del periodo sube a *Molestias repetidas*. Eso último merece decisión tuya: la app protege esa progresión indefinidamente, así que conviene cambiar el ejercicio por una variante que no le moleste.

Es una marca distinta de las **molestias intuidas en las observaciones**, que el Coach sigue detectando por palabras clave en el texto libre. Aquellas son una sospecha; esta es una declaración del cliente. Las copias de seguridad anteriores a esta versión se importan igual: simplemente no traen la marca.

## Nutrición

TrueLift no registra comidas. Lo que hace es un **lazo cerrado**: el cliente se pesa a diario, la app estima su peso-tendencia y su ritmo real de cambio, y una vez por semana ajusta las calorías para acercarlo al ritmo pactado. Esta pestaña enseña ese lazo desde fuera, en el orden en que se revisa a un cliente:

1. **Fase de dieta**: tipo (déficit / superávit / mantenimiento), estado, ritmo objetivo con su banda de color, peso objetivo, proteína recomendada y cuánto del tope de ajuste de la fase se ha consumido. Si la fase todavía está calibrando, dice qué falta y desde qué día podrá recomendar.
2. **Ritmo real**: el ritmo que el filtro mide de verdad, su desvío del objetivo y si cae dentro de la banda muerta (dentro de ella la app no toca nada). Es la cifra que resume si la dieta va donde debía.
3. **Adherencia al pesaje**: pesajes por semana, hueco más largo y días sin pesarse. Es lo primero accionable: sin pesajes el lazo no corrige nada y el resto de la pantalla envejece.
4. **Peso y tendencia** y **ritmo semanal frente al objetivo**: las dos gráficas del lazo, con la franja de banda muerta y los pesajes enmascarados por refeed o vuelta de pausa marcados en ámbar.
5. **Composición corporal**: curva teórica de % graso anclada en cada estimación, masa grasa y masa magra, y el **reparto** del último tramo — cuánto del peso movido fue grasa frente a lo esperable a ese ritmo. Es la respuesta a "¿esto le está costando músculo?".
6. **Tarjetas semanales del lazo**: qué le dijo la app y cuándo — ritmo medido, error energético, ajuste aplicado, acumulado, prescripción en gramos y proteína.
7. **Efecto sobre el entrenamiento**: si la capa de nutrición ha recortado volumen (trinquete) y con qué topes de series por línea. **Conviene mirarlo antes de tocar la rutina**: esos topes siguen vigentes hasta que se cierra la fase.
8. **Plan de temporada**, **biblioteca de alimentos** y **refeeds y pausas**.

Además, la dieta aparece en el resto de la app: columna **Dieta** en la Cartera, tarjeta de resumen y fase gobernada por el lazo en el **Resumen**, series de nutrición en el **comparador** (cruzar el ritmo de pérdida con el rendimiento neto es justo la pregunta que decide si hay que aflojar la dieta o el entrenamiento) y una sección de dieta en el informe imprimible. Las alertas de nutrición entran en el mismo triaje que las de entrenamiento, así que la Cartera ordena contando también la dieta.

Todo lo relativo al % graso es **estimación**, con ±3–4 pp de margen declarado, y a corto plazo la masa magra incluye agua y glucógeno, no solo músculo. Las copias de seguridad anteriores a la capa de nutrición se importan igual: la pestaña simplemente lo explica.

## Planificador de rutinas

Flujo de revisión semanal/quincenal recomendado:

1. Pide al cliente una copia nueva (JSON) e impórtala con **Actualizar existente**.
2. Revisa **Resumen** (alertas: molestias, estancamientos, RIR alto, readiness) y **Ejercicios**.
3. En **Rutina**, pulsa **Revisar / editar en el planificador**: se carga su rutina activa (o el borrador que dejaste a medias, que se guarda solo).
4. Cada ejercicio muestra su contexto del rango elegido: progresando/estancado, RIR alto, molestias reportadas y última carga. El panel de **Volumen y frecuencia semanal** compara las series planificadas por grupo muscular con tu objetivo (semáforo) y con la media semanal que el cliente ejecutó de verdad en el periodo seleccionado arriba.
5. Ajusta lo que toque y pulsa **Exportar Excel para TrueLift**. Envíale el archivo al cliente: lo importa en la app (Rutina → Importar) y ya entrena con la versión nueva.

Detalles:

- Cada fila admite tres **modalidades de series**, las mismas que la app, y son **excluyentes entre sí**: una fila lleva T+B **o** Drop, y una superserie solo enlaza filas a **series rectas** (sin T+B ni Drop a ninguno de los dos lados). Al marcar una, las que no caben se apagan y sus casillas quedan deshabilitadas con el motivo en el rótulo.
  - **T+B (top set + back-offs)**: la 1.ª serie fija la progresión; el resto se hace con un % menos de peso hasta su RIR objetivo.
  - **Drop (drop set)**: la 1.ª serie fija la progresión; el resto son drops inmediatos, sin descanso, cada uno con un % menos que la serie **anterior** (en cascada). Excluyente con T+B y con SS. En la app los drops se guardan como consulta: cuentan para el volumen, pero no puntúan el rendimiento.
  - **SS (superserie con el anterior)**: enlaza la fila con la de encima; en la app se alternan las series de los ejercicios del grupo (A1→B1→A2→B2…), con los descansos de siempre. Enlazando varias filas seguidas salen grupos de tres o más; la etiqueta (Superserie 1, 2…) aparece bajo la fila. La progresión de cada ejercicio no cambia. Solo con series rectas: excluyente con T+B y con Drop.
- En el Excel estas opciones viajan en las columnas **H–J** (top+back), **K** (nº de superserie: filas consecutivas con el mismo número van juntas) y **L–M** (drop set y su %). Las plantillas antiguas, sin esas columnas, se importan igual.
- También puedes **Abrir Excel…** (una plantilla `mi_rutina_truelift.xlsx` rellenada) o empezar **En blanco** (por ejemplo para un cliente nuevo, sin JSON todavía: el borrador general se guarda igualmente).
- El Excel exportado es la plantilla oficial con tus datos: conserva desplegables y validaciones, así que también se puede retocar en Excel/LibreOffice antes de importarlo. Al exportar se completa con lo que la plantilla no traía de fábrica: la hoja **Instrucciones** explica las columnas K (superserie) y L/M (drop set), los desplegables de EJERCICIO llevan **todo el catálogo** (también los ejercicios que se han ido incorporando y los tuyos personalizados) y la columna L estrena su sí/no.
- Los objetivos de series y frecuencia por grupo (el semáforo) se editan desde el botón **⚙ Objetivos** del panel de volumen; se guardan en la app y en tu copia del entrenador, con opción de restaurar los valores por defecto.
- Los borradores viajan dentro de la copia del entrenador (Clientes → Exportar).

El selector de rango de fechas (arriba) afecta a todas las pestañas. **Imprimir informe** genera un PDF del resumen vía el diálogo de impresión.

Los datos se guardan en el propio navegador (localStorage). En **Clientes → Exportar copia del entrenador** puedes descargar toda tu cartera (clientes y notas) en un archivo; para restaurarla en otro navegador u ordenador, impórtala con "+ Importar JSON" y elige Combinar o Reemplazar. Si la copia de un cliente tiene más de 7 días, la app te avisa para que le pidas una nueva. Compatible con los formatos de copia antiguos y nuevos de TrueLift.
