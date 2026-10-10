// Sustituto mínimo de l10n.dart (que depende de Flutter) para ejecutar el
// lector real de la app fuera del móvil. Castellano: canonical = identidad.
class I18n {
  static String languageCode = 'es';
  static String canonical(String s) => s;
  static String t(String s) => s;
}
