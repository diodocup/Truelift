# Arnés del lector de Excel de la app

Ejecuta el lector **real** de rutinas de la app móvil
(`App-PRO/lib/rutina_excel.dart`, con `rutina_excel_compatibilidad.dart` y
`rutina_excel_localizacion.dart`) sobre los Excel que exporta el escritorio.

- No se copia código de la app al repositorio: `tests/planificador.test.mjs`
  copia esos tres archivos desde `APP_PRO_DIR` (por defecto `../App-PRO`) a
  una carpeta temporal junto con este arnés.
- `lib/l10n.dart` sustituye al de la app (que depende de Flutter) con lo único
  que usa el lector: `I18n.canonical` / `I18n.t` en castellano.
- Usa las mismas versiones de `excel` y `archive` que fija `pubspec.lock` de la
  app.
- Necesita el SDK de Dart (`DART=/ruta/a/dart` o `dart` en el PATH) y acceso a
  pub.dev la primera vez. Si falta algo, la prueba se omite y lo dice.
