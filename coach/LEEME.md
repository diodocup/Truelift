# TrueLift Coach

Herramienta web para entrenadores: visualiza los entrenamientos de tus clientes de TrueLift y crea o revisa sus rutinas. Sin internet, sin instalación.

## Uso

1. Abre `index.html` con doble clic (Chrome o Edge recomendados).
2. Pulsa **+ Importar JSON** (o arrastra el archivo a la ventana) con la copia de seguridad que te envía el cliente desde TrueLift.
3. Dale un nombre al cliente. Puedes tener varios clientes y cambiar entre ellos desde el desplegable.
4. Cuando el cliente te envíe una copia nueva, impórtala y elige **Actualizar existente**.

## Pestañas

- **Cartera**: pantalla inicial con todos los clientes — semáforo de atención, última sesión, antigüedad de los datos importados, adherencia del bloque y alertas. Clic para abrir un cliente. Ordenada por atención requerida.
- **Resumen**: ficha, adherencia, disponibilidad diaria (semáforo), rendimiento y alertas (molestias en observaciones, estancamientos, RIR alto, readiness/VFC).
- **Sesiones**: cada sesión con kg/reps/RIR por serie, observaciones resaltadas y delta vs sesión anterior.
- **Ejercicios**: progresión por ejercicio con gráfica de kg y e1RM estimado, y diagnóstico automático.
- **Rutina**: plan activo vs última ejecución, ejercicios fuera de plan y volumen semanal por grupo. Desde aquí puedes abrir la rutina en el Planificador.
- **Planificador**: crea o revisa la rutina del cliente y expórtala al Excel que él importa en TrueLift.
- **Readiness**: estado para entrenar (0–100), VFC con su banda y detalle diario.

## Planificador de rutinas

Flujo de revisión semanal/quincenal recomendado:

1. Pide al cliente una copia nueva (JSON) e impórtala con **Actualizar existente**.
2. Revisa **Resumen** (alertas: molestias, estancamientos, RIR alto, readiness) y **Ejercicios**.
3. En **Rutina**, pulsa **Revisar / editar en el planificador**: se carga su rutina activa (o el borrador que dejaste a medias, que se guarda solo).
4. Cada ejercicio muestra su contexto del rango elegido: progresando/estancado, RIR alto, molestias reportadas y última carga. El panel de **Volumen y frecuencia semanal** compara las series planificadas por grupo muscular con tu objetivo (semáforo) y con la media semanal que el cliente ejecutó de verdad en el periodo seleccionado arriba.
5. Ajusta lo que toque y pulsa **Exportar Excel para TrueLift**. Envíale el archivo al cliente: lo importa en la app (Rutina → Importar) y ya entrena con la versión nueva.

Detalles:

- También puedes **Abrir Excel…** (una plantilla `mi_rutina_truelift.xlsx` rellenada) o empezar **En blanco** (por ejemplo para un cliente nuevo, sin JSON todavía: el borrador general se guarda igualmente).
- El Excel exportado es la plantilla oficial con tus datos: conserva desplegables y validaciones, así que también se puede retocar en Excel/LibreOffice antes de importarlo.
- Los objetivos de series y frecuencia por grupo (el semáforo) se editan desde el botón **⚙ Objetivos** del panel de volumen; se guardan en la app y en tu copia del entrenador, con opción de restaurar los valores por defecto.
- Los borradores viajan dentro de la copia del entrenador (Clientes → Exportar).

El selector de rango de fechas (arriba) afecta a todas las pestañas. **Imprimir informe** genera un PDF del resumen vía el diálogo de impresión.

Los datos se guardan en el propio navegador (localStorage). En **Clientes → Exportar copia del entrenador** puedes descargar toda tu cartera (clientes y notas) en un archivo; para restaurarla en otro navegador u ordenador, impórtala con "+ Importar JSON" y elige Combinar o Reemplazar. Si la copia de un cliente tiene más de 7 días, la app te avisa para que le pidas una nueva. Compatible con los formatos de copia antiguos y nuevos de TrueLift.
