# Evolución física — fase 5

Trabajo en `codex/escritorio-fase5-evolucion-fisica`, sobre el commit
`8398de16a5a74f7cfa93240e9ca22b6cee66c444` de fase 4. Solo se modifica
`Truelift/escritorio/`; App-PRO se consulta como referencia. Sin despliegue,
fusión, cambios de permisos PRO o algoritmos del móvil.

## Asociación verificable

Fuentes móviles revisadas el 10/10/2026 en App-PRO/main:

| Fuente | Blob SHA / regla |
|---|---|
| `lib/medidas/modelos.dart` | `bc8f696aa0603fdadb4e70597b8054cbcc005326`; `vigenteEn`, `compararContornos`, `tendenciaDe` |
| `lib/medidas/fotos_archivos.dart` | `8b57f2a8fa668a317ed525d2c1934fdc43b6f032`; archivo como identidad, JPEG al crear, sin renombrar al corregir |
| `lib/screens/medidas_screen.dart` | `2a06011da3d982e89ca881e403b2d6185fbd1552`; filtro de pose, selección, peso congelado |
| `test/medidas_test.dart` | `2f6860c1337e031506175fe195a39c07d6c7e6aa`; casos portados a Node |
| `lib/screens/seleccion_screen.dart` | `b97d9f44150997495d27ab2efd85665fca3d274d`; `medidas.json` y binarios en raíz del ZIP |
| `lib/nutricion/modelos.dart` | `e090a33459b5f88e84c03d1a0e0a021b09b5189c`; `fase`, `fasesCerradas`, `inicio`, `fin` |

- La foto se resuelve cada vez desde el **JSON vigente**, luego su ficha
  ZIP guardada, y finalmente el patrón estricto del móvil. Nunca se deduce
  fecha/pose de un nombre arbitrario. Corregir la fecha o pose del JSON
  cambia selección y asociaciones sin tocar el binario ni los encuadres.
- Para cada sitio se toma el propio día o la medida anterior más cercana,
  hasta **30 días inclusive**. Nada futuro. La tabla muestra fecha real y
  días de arrastre. Si ambas fotos resuelven a una misma fecha/sitio no se
  calcula evolución. Dos mediciones distintas con el mismo valor sí dan 0.
- Los cambios se calculan **B − A**, solo con B posterior a A. Se pueden
  visualizar fotos invertidas o del mismo día sin afirmar evolución.
- Una exportación móvil normal tiene un registro por día/sitio:
  `registrar()` sustituye al corregir. `fromJson()` no deduplica una copia
  manipulada y su orden entre empates no es una base fiable para elegir un
  valor. En escritorio, duplicados idénticos se cuentan una vez; los
  contradictorios se indican y se excluyen. Tampoco se salta un conflicto
  para utilizar una medida anterior. Esta es una defensa explícita para
  datos anómalos, no un cambio del algoritmo móvil.
- Los registros del JSON son una instantánea. Incluso un bloque `medidas`
  vacío tiene prioridad sobre el ZIP. Solo si el JSON carece del módulo se
  muestran los contornos del ZIP, indicando su origen. No se mezclan.
- El peso es `FotoProgreso.pesoKg` **guardado en la ficha**. No se añade el
  peso actual ni se busca otro pesaje: la app pudo congelar un pesaje
  cercano o el peso del perfil; la copia no guarda esa procedencia/fecha.
- La fase se sitúa con los intervalos explícitos de `nutricion.fase` y
  `fasesCerradas`. Fase actual abierta: desde `inicio`; cerrada: exige `fin`.
  Huecos, intervalos inválidos o solapados: «sin datos históricos
  suficientes». No se proyecta `fasePeso` actual al pasado, ni se inventan
  pausas históricas desde el estado actual de la fase.

## Interfaz y almacenamiento

- Galería por fecha, filtro por pose, **48 entradas por página**,
  miniaturas diferidas. Las fichas con imagen ausente permanecen visibles,
  incluso si solo se importó un ZIP con índice.
- Comparación de dos archivos de la **misma pose**. No se admite el mismo
  archivo en ambos lados ni una imagen pendiente como pareja visual.
- Lado a lado, cortina y superposición. Ambas imágenes ocupan un marco
  igual, con `object-fit: contain`. La cortina recorta la capa con
  `clip-path`; no cambia la anchura de la imagen. Todas las transformaciones
  usan escala uniforme (1–3) y traslación; sin deformaciones por eje.
- Encuadres por archivo y espacio personal, independientes del historial,
  en `meta['encuadres:<espacioId>']`. Se guardan explícitamente, se pueden
  restablecer por foto y se conserva lo guardado si falla una escritura.
  En modo temporal se advierte que se perderán al cerrar.
- No hay cambio de versión de IndexedDB: se reutiliza el almacén `meta`
  existente. Borrar un espacio elimina también sus encuadres y fechas de
  comparación de periodos. Las imágenes siguen siendo blobs originales.
- Solo se leen dos originales para comparar. Al cambiar de sección, pose
  o selección se liberan sus object URLs; las lecturas tardías comprueban
  que el marco siga en la página y pertenezca al mismo espacio.
- Contornos con gráfica, tabla del sitio y tabla conjunta por fecha.
  Tendencia: recta de mínimos cuadrados móvil, **≥3 medidas, ≥21 días**,
  cm/mes de 30,44 días. Sin extrapolación ni valoración de bueno/malo.
- Peso y tendencia existentes, sin truncar la tabla a 120 pesajes.
  Composición: gráficas de % graso y masas estimadas, tabla con método;
  masa magra incluye agua/glucógeno y error del método, no solo músculo.
- Sin nuevas dependencias, CDN, peticiones externas ni service worker.

## Validación y pendientes

Resultados finales y capturas: `PLAN.md`, sección Fase 5.

Se prueban datos sintéticos y el contrato leído en Dart. No se ejecuta
Flutter/Dart en este entorno ni se usa una exportación real de iOS/Android.
Safari y Firefox quedan pendientes. La galería se prueba con 58 fichas,
incluidas 56 sin binario y paginación, y el flujo previo de cancelación con
150 entradas; no se ha medido rendimiento con miles de originales.
La cuota se simula; no se llena el disco físico.

La fase 5 no completa el proyecto: editor personal/exportación de rutinas
(fase 6), informes/acabado/offline (fase 7) y validación integral (fase 8)
siguen pendientes.
