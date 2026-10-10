import 'dart:convert';
import 'dart:io';
import 'package:arnes_excel/rutina_excel.dart';

void main(List<String> args) {
  final out = <String, dynamic>{};
  for (final ruta in args) {
    try {
      final p = RutinaExcelParser.decodificar(File(ruta).readAsBytesSync());
      out[ruta] = {'sistema': p.sistema, 'dias': p.dias, 'ejercicios': p.ejercicios, 'detalles': p.detalles, 'numeroDias': p.numeroDias};
    } catch (e) {
      out[ruta] = {'error': '$e'};
    }
  }
  stdout.write(jsonEncode(out));
}
