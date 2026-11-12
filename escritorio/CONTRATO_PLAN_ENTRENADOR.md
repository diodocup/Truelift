# Contrato del plan de entrenador (v1 y v2)

Este archivo es **idéntico** en la raíz de `diodocup/App-PRO` y en
`escritorio/` de `diodocup/Truelift`. Cualquier cambio se hace en los dos a la
vez, junto con los vectores dorados (§7). El plan de implementación completo
está en `PLAN_ENTRENADOR.md` (App-PRO).

Implementaciones:

| Lado | Archivo |
|---|---|
| App (verificar) | `lib/plan_entrenador/{modelo,sobre,validacion,claves}.dart` |
| Escritorio (construir, firmar, verificar) | `escritorio/entrenador/paquete.js` |
| Claves (generar, verificar a mano) | `tool/entrenador_claves.mjs` (App-PRO) |

---

## 1. Archivo

- JSON en UTF-8, extensión `.json`. Nombre recomendado:
  `plan_truelift_<cliente>_<AAAA-MM-DD>.json`, con `<cliente>` en minúsculas,
  sin tildes y con `_` en lugar de espacios.
- Tamaño máximo del archivo completo: **262 144 bytes** (256 KB). Uno mayor se
  rechaza sin analizarlo.

## 2. Sobre

```json
{
  "formato": "truelift-plan-entrenador",
  "v": 1,
  "clave": "3f9a1c0e5b7d2a46",
  "carga": "<base64url sin relleno de los bytes UTF-8 del JSON de la carga>",
  "firma": "<base64url sin relleno de la firma Ed25519, 64 bytes>"
}
```

- `formato`: siempre `truelift-plan-entrenador`.
- `v`: entero, `1` o `2`. La v2 (11/11/2026) solo añade los datos de partida
  del cliente (`cliente.datos`, §3.1). Un plan se emite con la versión más
  baja que lo describe: sin datos del cliente, `1`, que leen todas las
  versiones de la app; con ellos, `2`, y una app que solo lee la v1 dice
  «actualiza la app» en lugar de rechazar el contenido.
- `clave`: identificador de la clave pública que firmó. Son los 8 primeros
  bytes del SHA-256 de la clave pública en crudo (32 bytes), en hexadecimal en
  minúsculas (16 caracteres).
- `carga`: los bytes UTF-8 del JSON de la carga, en base64url **sin relleno**
  (alfabeto `A-Z a-z 0-9 - _`, sin `=`).
- `firma`: firma Ed25519 (RFC 8032, sin prehash ni contexto) de

  ```
  UTF8("truelift-plan-entrenador:v1\n") ‖ bytesDeCarga
  ```

  donde `bytesDeCarga` son exactamente los bytes que salen de decodificar
  `carga`. El prefijo es el mismo en la v1 y en la v2. **No se canoniza JSON**: se verifica sobre los bytes recibidos y
  solo después se analiza la carga. En base64url sin relleno (86 caracteres).

## 3. Carga

```json
{
  "id": "pe_0b6f6c1e-5d1a-4c55-9f43-2a7f3e1b9c10",
  "emitido": "2026-11-10",
  "caduca": "2027-02-08",
  "entrenador": { "nombre": "Ana Pérez" },
  "cliente": { "nombre": "Luis Gómez",
               "datos": { "sexo": "hombre", "pesoKg": 82.5, "alturaCm": 178, "grasaPct": 18 } },
  "nota": "Texto libre del entrenador para el cliente.",
  "rutina": {
    "nombre": "Torso / Pierna",
    "sistema": "doble",
    "dias": [
      { "nombre": "Torso 1",
        "ejercicios": [
          { "patron": "Empuje horizontal", "ejercicio": "Press banca con barra",
            "series": 3, "reps": "6-8", "rir": "2", "descanso": 3,
            "topBack": false, "backoffPct": 15, "rirBack": "2",
            "dropSet": false, "dropPct": 15,
            "superserie": 0,
            "restPause": false, "pausaRpSeg": 20 }
        ] }
    ],
    "ejercicios": [
      { "nombre": "Remo en máquina Hammer", "grupo": "Espalda",
        "patron": "Tirón horizontal", "secundarios": ["Bíceps"],
        "prioridad": "", "nota": "", "descanso": "", "porTiempo": false }
    ]
  },
  "temporada": {
    "bloques": [
      { "tipo": "CUT", "semanas": 12, "tasaPctSemana": -0.5 },
      { "tipo": "BRIDGE", "semanas": 4, "tasaPctSemana": 0 }
    ]
  }
}
```

Esquema estricto: una clave que no figure aquí, o un valor de tipo distinto
del indicado, invalida el paquete. No hay conversiones permisivas (un `"3"` no
es un `3`). Un número entero puede escribirse `3` o `3.0`: los dos son el
mismo número JSON.

«Texto corto» es una cadena de **1 a 80** caracteres que no es solo espacios,
salvo donde se dice que puede ir vacía (entonces de 0 a 80). Los caracteres se
cuentan como puntos de código Unicode.

### 3.1 Raíz

| Clave | Tipo | Obligatoria | Regla |
|---|---|---|---|
| `id` | texto | sí | `pe_` seguido de 1 a 64 caracteres `[0-9a-z-]`. Identifica el paquete. |
| `emitido` | fecha | sí | `AAAA-MM-DD`, fecha real. |
| `caduca` | fecha | no | `AAAA-MM-DD`. Si viene, el paquete se puede importar **hasta ese día inclusive**. |
| `entrenador` | objeto | sí | `{ "nombre": texto corto }` |
| `cliente` | objeto | sí | `{ "nombre": texto corto, "datos": objeto }`. `datos` es opcional y solo existe en la v2 (en un sobre v1 invalida el paquete). |
| `nota` | texto | no | 0 a 2000 caracteres. |
| `rutina` | objeto | no | §3.2 |
| `temporada` | objeto | no | §3.3 |

`cliente.datos` (v2): datos de partida del cliente que el entrenador anotó
en su ficha. Al menos una clave; todas opcionales:

| Clave | Tipo | Regla |
|---|---|---|
| `sexo` | texto | `hombre` o `mujer`. |
| `pesoKg` | número | 40 a 150 (el rango de pesaje de la app). |
| `alturaCm` | número | 130 a 220 (el del selector de altura de la app). |
| `grasaPct` | número | 3 a 60 (`ConstantesNutricion.grasaRegistroMinPct`–`Max`). |

Son un punto de partida, no un registro: la app los propone y el usuario los
puede cambiar (§6).

Debe venir `rutina`, `temporada` o las dos. Un plan inicial y una revisión
posterior tienen exactamente la misma forma.

### 3.2 `rutina`

| Clave | Tipo | Obligatoria | Regla |
|---|---|---|---|
| `nombre` | texto | sí | 0 a 80 caracteres (puede ir vacío). |
| `sistema` | texto | sí | `simple` o `doble`. |
| `dias` | lista | sí | De 2 a 5 días. |
| `ejercicios` | lista | no | Biblioteca de ejercicios propios, hasta 200. |

Cada día: `{ "nombre": texto 0–80, "ejercicios": lista de 1 a 10 filas }`.

Cada fila de ejercicio usa las claves y tipos que lee
`AppState.importarRutina` (`lib/app_state.dart`):

| Clave | Tipo | Obligatoria | Regla |
|---|---|---|---|
| `patron` | texto | sí | 0 a 80. Nombre canónico en español. |
| `ejercicio` | texto | sí | Texto corto. Nombre canónico en español. |
| `series` | entero | sí | 1 a 10. |
| `reps` | texto | sí | 0 a 80. |
| `rir` | texto | sí | 0 a 80. |
| `descanso` | número | no | Minutos, mayor que 0 y como mucho 15. Ausente = el de la app. |
| `topBack` | booleano | no | Top set + back-offs. |
| `backoffPct` | entero | no | 5 a 30. |
| `rirBack` | texto | no | 0 a 80. |
| `dropSet` | booleano | no | |
| `dropPct` | entero | no | 5 a 30. |
| `superserie` | entero | no | 0 a 99. Filas consecutivas con el mismo número distinto de cero quedan enlazadas. |
| `restPause` | booleano | no | |
| `pausaRpSeg` | entero | no | 10 a 50. |
| `seriesLibres` | booleano | no | Series libres: cada serie con sus reps, su RIR, su peso y su progresión. |
| `repsSeries` | lista de texto | no | Reps de cada serie libre, en orden (`["5", "8", "10-12"]`). Hasta 10 elementos; si faltan, copian la última. |
| `rirSeries` | lista de texto | no | RIR de cada serie libre, en orden (`["1", "2", "2"]`). Mismas reglas que `repsSeries`. |

Las modalidades excluyentes (top+back, drop set, rest-pause, superserie) las
sanea la app al aplicar, igual que con cualquier plantilla. Las series libres
ceden ante cualquiera de las otras tres modalidades, pero sí pueden ir en
superserie.

Cada ejercicio propio (claves del bloque `TRUELIFT_EXERCISES_V1` de
`lib/rutina_excel.dart`):

| Clave | Tipo | Obligatoria | Regla |
|---|---|---|---|
| `nombre` | texto | sí | Texto corto. |
| `grupo` | texto | no | 0 a 80. |
| `patron` | texto | no | 0 a 80. |
| `secundarios` | lista de textos | no | Hasta 10, cada uno texto corto. |
| `prioridad` | texto | no | 0 a 80. |
| `nota` | texto | no | 0 a 2000. |
| `descanso` | texto | no | 0 a 80. |
| `porTiempo` | booleano | no | |

### 3.3 `temporada`

`{ "bloques": lista }`, con 1 a `ConstantesNutricion.planBloquesMax` (6)
bloques. Cada bloque:

| Clave | Tipo | Regla |
|---|---|---|
| `tipo` | texto | `BULK`, `BRIDGE` o `CUT` (`TipoBloquePlan.clave`). |
| `semanas` | entero | 1 o más. |
| `tasaPctSemana` | número | Con signo: negativa en `CUT`, positiva en `BULK`, `0` en `BRIDGE`. |

- La suma de `semanas` no supera `ConstantesNutricion.planHorizonteMaxSemanas`
  (78).
- No puede haber dos bloques consecutivos del mismo tipo.
- Los bloques son **relativos**: la app ancla el primero al día en que se
  aplica el paquete. Los ritmos **no** se validan contra los topes al
  importar: dependen del peso y el % graso del usuario y se ajustan al
  aplicar.

## 4. Verificación (orden estricto)

Al primer fallo se para y se devuelve el error. Nada se guarda ni se aplica.

| Paso | Comprobación | Error |
|---|---|---|
| 1 | Archivo ≤ 262 144 bytes | `demasiadoGrande` |
| 1 | UTF-8 válido, JSON válido y objeto | `noEsUnPlan` |
| 2 | `formato` es `truelift-plan-entrenador`. Si no lo es y el objeto no trae `formato` pero sí `logs` o `sexo` | `esUnaCopia` |
| 2 | En otro caso de `formato` ajeno o ausente | `noEsUnPlan` |
| 3 | `v` es un entero ≥ 1 | `noEsUnPlan` |
| 3 | `v` mayor que la versión soportada (2) | `versionNoSoportada` |
| 4 | `clave` es texto y está entre las claves aceptadas | `claveDesconocida` |
| 4 | `carga` y `firma` son texto en base64url sin relleno, la firma son 64 bytes y verifica | `firmaInvalida` |
| 5 | La carga es UTF-8 y JSON válidos, y cumple el esquema de §3 | `contenidoInvalido` |
| 6 | Límites de §3 (días, filas, series, longitudes, bloques, horizonte, tipos consecutivos, signo de la tasa, rangos de `cliente.datos`) | `contenidoInvalido` |
| 7 | `caduca`, si viene, es igual o posterior a hoy | `caducado` |

`firmaInvalida` y `claveDesconocida` comparten texto de cara al usuario: «este
archivo no viene de un entrenador de TrueLift o se ha modificado».

## 5. Claves

- Ed25519. Clave pública de 32 bytes; firma de 64.
- Las claves públicas aceptadas por la app viven en
  `lib/plan_entrenador/claves.dart` como `id → clave pública en base64url sin
  relleno`. El mapa nace vacío.
- Archivo de clave privada que produce `tool/entrenador_claves.mjs generar`:

  ```json
  {
    "formato": "truelift-clave-entrenador",
    "v": 1,
    "id": "3f9a1c0e5b7d2a46",
    "publica": "<base64url, 32 bytes>",
    "kdf": { "alg": "PBKDF2-SHA-256", "iteraciones": 600000, "sal": "<base64url, 16 bytes>" },
    "cifrado": { "alg": "AES-256-GCM", "iv": "<base64url, 12 bytes>", "datos": "<base64url>" }
  }
  ```

  `datos` es la clave privada en PKCS#8 (DER) cifrada con AES-256-GCM; la
  clave AES sale de PBKDF2-SHA-256 sobre la contraseña (UTF-8) con la sal y
  las iteraciones indicadas; los datos adicionales autenticados son
  `UTF8("truelift-clave-entrenador:v1:" + id)`.
- `clave_entrenador*.json` está en `.gitignore` en los dos repositorios.
- La **clave de pruebas** es fija y pública, vive con los vectores dorados y
  nunca puede figurar en el mapa de producción (lo comprueba un test).

## 6. Al aplicar (app)

- `rutina` se pasa tal cual a `AppState.importarRutina` con
  `origen: 'entrenador'`. No se pasa por Excel.
- `temporada` es una propuesta: la app la ancla a hoy, recorta cada ritmo a su
  tope conservando el signo y solo la escribe por
  `guardarPlanTemporadaNutricion` / `sincronizarFaseConPlanNutricion`.
- `cliente.datos` es el punto de partida del cliente: en el onboarding rellena
  «Sobre ti»; desde Rutina, con la nutrición sin activar, pasa a ser el sexo,
  el peso y la altura de Ajustes (la vista previa lo dice antes de aplicar);
  el % graso (y la altura) se proponen en el alta de nutrición. Con la
  nutrición ya activa mandan los pesajes y mediciones del móvil y no se toca
  nada. Siempre los puede cambiar el usuario.

## 7. Vectores dorados

- Mismos archivos en `test/fixtures/plan_entrenador/` (App-PRO) y
  `escritorio/tests/fixtures/plan-entrenador/` (Truelift).
- Los genera `escritorio/tests/generar-vectores-plan-entrenador.mjs` con la
  clave de pruebas. Ed25519 es determinista, así que regenerarlos da los
  mismos bytes.
- `MANIFIESTO.json` lista cada archivo con su SHA-256 y el resultado esperado
  (`valido` o el código de error) verificando con la clave de pruebas y con
  hoy = `MANIFIESTO.hoy`. Cada repositorio comprueba sus archivos contra el
  manifiesto y que su verificador da exactamente el resultado esperado.
