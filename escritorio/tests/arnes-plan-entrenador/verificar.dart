// Arnés del verificador de planes de entrenador de la app móvil
// (PLAN_ENTRENADOR.md §8.1 de App-PRO).
//
// Ejecuta el verificador REAL de la app (`App-PRO/lib/plan_entrenador/`,
// Dart puro) sobre los archivos que se le pasan y escribe por la salida
// estándar un JSON con el resultado de cada uno. No se copia código de la
// app: se resuelve `package:rutinas_app` con la configuración de paquetes
// de App-PRO (`dart --packages=<App-PRO>/.dart_tool/package_config.json`).
//
// Uso:
//   dart --packages=… verificar.dart --clave <id>=<pública base64url>
//        [--hoy AAAA-MM-DD] archivo.json…
//
// La clave se pasa como clave de pruebas (`clavesDePrueba`): el mapa de
// producción de la app no se toca ni se lee.

import 'dart:convert';
import 'dart:io';

import 'package:rutinas_app/plan_entrenador/modelo.dart';
import 'package:rutinas_app/plan_entrenador/sobre.dart';

Future<void> main(List<String> args) async {
  final claves = <String, String>{};
  DateTime? hoy;
  final archivos = <String>[];
  for (var i = 0; i < args.length; i++) {
    final a = args[i];
    if (a == '--clave') {
      final par = args[++i];
      final eq = par.indexOf('=');
      claves[par.substring(0, eq)] = par.substring(eq + 1);
    } else if (a == '--hoy') {
      hoy = DateTime.parse(args[++i]);
    } else {
      archivos.add(a);
    }
  }
  final out = <String, Object?>{};
  for (final ruta in archivos) {
    try {
      final p = await verificarPlanEntrenador(
        File(ruta).readAsBytesSync(),
        hoy: hoy,
        clavesDePrueba: claves,
      );
      out[ruta] = {'ok': true, 'paquete': _resumen(p)};
    } on ExcepcionPlanEntrenador catch (e) {
      out[ruta] = {'ok': false, 'error': e.error.name, 'detalle': e.detalle};
    }
  }
  stdout.write(jsonEncode(out));
}

/// Lo que la app se queda del paquete, en la forma en que se lo pasa a
/// `AppState.importarRutina` y a la temporada.
Map<String, Object?> _resumen(PaquetePlanEntrenador p) => {
      'id': p.id,
      'emitido': p.emitido,
      'caduca': p.caduca,
      'entrenador': p.entrenador,
      'cliente': p.cliente,
      'datosCliente': p.datosCliente?.toJson(),
      'nota': p.nota,
      'clave': p.clave,
      'rutina': p.rutina == null
          ? null
          : {
              'nombre': p.rutina!.nombre,
              'sistema': p.rutina!.sistema,
              'dias': p.rutina!.diasParaImportar,
              'ejercicios': p.rutina!.ejerciciosParaImportar,
              'seriesPorSemana': p.rutina!.seriesPorSemana,
            },
      'temporada': p.temporada == null
          ? null
          : [for (final b in p.temporada!) b.toJson()],
    };
