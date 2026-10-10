'use strict';
/* ================================================================
   TrueLift Escritorio — importar.js
   Validación de la copia JSON de TrueLift, resumen para la vista
   previa y comparación entre instantáneas.

   Contrato: escritorio/CONTRATO_DATOS.md. La copia es una INSTANTÁNEA
   del móvil (el móvil la restaura sustituyendo todo su estado), así que
   aquí nunca se fusionan historiales: se valida, se resume y se compara.

   Nada de este archivo muta el objeto leído: el texto original se
   guarda tal cual y el objeto se vuelve a parsear cuando hace falta.
   Sin dependencias del DOM: se prueba en Node (tests/importar.test.mjs).
   ================================================================ */

const ImportarJSON = {

  LIMITE_BYTES: 64 * 1024 * 1024,
  MAX_EJEMPLOS: 8,

  // Contenedores de primer nivel y el tipo que el móvil espera. Si una de
  // estas claves existe con otro tipo, la copia no es restaurable en la app
  // (su `cargar` haría un cast imposible) y tampoco se acepta aquí.
  CONTENEDORES: {
    logs: 'array', readinessDiario: 'array', saludDiaria: 'array',
    planMod: 'array', ejerciciosUsuario: 'array',
    nutricion: 'object', medidas: 'object',
  },

  SITIOS: ['cuello','hombros','pecho','biceps_izq','biceps_der','antebrazo_izq',
           'antebrazo_der','cintura','abdomen','cadera','muslo_izq','muslo_der',
           'gemelo_izq','gemelo_der'],
  POSES: ['frente','perfil','espalda'],

  // ---------- utilidades ----------

  /* Día de calendario 'YYYY-MM-DD' del texto, sin pasar por Date: así no
     hay husos ni horarios de verano que muevan el día (mismo criterio que
     DiaLocal.desdeTexto del móvil y parseFecha del Coach). null si no es
     una fecha real. */
  dia(v){
    if (typeof v !== 'string') return null;
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
    if (!m) return null;
    const a = +m[1], me = +m[2], d = +m[3];
    if (me < 1 || me > 12 || d < 1) return null;
    const diasMes = new Date(Date.UTC(a, me, 0)).getUTCDate();
    if (d > diasMes) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  },

  tipoDe(v){
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  },

  esNum(v){ return typeof v === 'number' && Number.isFinite(v); },

  /* Fecha que sugiere el NOMBRE del archivo (copia_truelift_2026-10-09.json).
     Es un indicio: el archivo puede haberse renombrado. */
  fechaDeNombre(nombre){
    const m = String(nombre || '').match(/(\d{4}-\d{2}-\d{2})/);
    return m ? this.dia(m[1]) : null;
  },

  async sha256(texto){
    const datos = new TextEncoder().encode(texto);
    const h = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ---------- análisis completo ----------

  /* Lee y valida el texto de un archivo. Devuelve siempre un informe:
     { ok, errores[], avisos[], raw?, sha256?, calidad?, resumen? }.
     `ok` false significa que NO se puede guardar. */
  async analizar(texto, { nombreArchivo = '', bytes = null } = {}){
    const informe = { ok: false, errores: [], avisos: [], nombreArchivo,
                      bytes: bytes ?? (typeof texto === 'string' ? texto.length : 0) };
    if (typeof texto !== 'string'){
      informe.errores.push('No se pudo leer el archivo.');
      return informe;
    }
    if (informe.bytes > this.LIMITE_BYTES){
      informe.errores.push('El archivo es demasiado grande para ser una copia de TrueLift.');
      return informe;
    }
    let raw;
    try { raw = JSON.parse(texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto); }
    catch (e) {
      informe.errores.push('El archivo no es un JSON válido. Vuelve a exportar la copia desde la app (Ajustes → Copia de seguridad).');
      return informe;
    }
    const v = this.validar(raw);
    informe.errores.push(...v.errores);
    informe.avisos.push(...v.avisos);
    informe.calidad = v.calidad;
    if (v.errores.length) return informe;
    informe.raw = raw;
    informe.resumen = this.resumen(raw, { nombreArchivo });
    informe.sha256 = await this.sha256(texto);
    informe.ok = true;
    return informe;
  },

  // ---------- validación ----------

  validar(raw){
    const errores = [], avisos = [];
    const calidad = {
      invalidos: 0, ejemplos: [],
      cargasCero: 0, repsCero: 0, seriesSinAnotar: 0,
      registrosDescartados: 0,
    };
    const invalido = (ruta, motivo) => {
      calidad.invalidos++;
      if (calidad.ejemplos.length < this.MAX_EJEMPLOS) calidad.ejemplos.push({ ruta, motivo });
    };

    if (this.tipoDe(raw) !== 'object'){
      errores.push('El archivo no contiene una copia de TrueLift.');
      return { errores, avisos, calidad };
    }
    // Mismo criterio que importarBackup del móvil: logs o sexo. Se admite
    // también una copia con solo la rutina (planMod), como hacía el Coach.
    if (!('logs' in raw) && !('sexo' in raw) && !Array.isArray(raw.planMod)){
      errores.push('El JSON no parece una copia de seguridad de TrueLift: no trae historial ni ajustes de la app.');
      return { errores, avisos, calidad };
    }
    for (const [clave, tipo] of Object.entries(this.CONTENEDORES)){
      if (!(clave in raw) || raw[clave] === null) continue;
      if (this.tipoDe(raw[clave]) !== tipo)
        errores.push(`La clave «${clave}» tiene un formato inesperado (${this.tipoDe(raw[clave])}). La copia está dañada o no es de TrueLift.`);
    }
    if (errores.length) return { errores, avisos, calidad };

    // --- logs ---
    (raw.logs || []).forEach((l, i) => {
      const r = `logs[${i}]`;
      if (this.tipoDe(l) !== 'object'){ invalido(r, 'no es un registro'); calidad.registrosDescartados++; return; }
      if (!this.dia(l.fecha)){ invalido(`${r}.fecha`, 'fecha no válida'); calidad.registrosDescartados++; return; }
      if (l.tipo === 'cardio'){
        if (l.duracion != null && !this.esNum(l.duracion)) invalido(`${r}.duracion`, 'no es un número');
        if (l.intensidad != null && !this.esNum(l.intensidad)) invalido(`${r}.intensidad`, 'no es un número');
        return;
      }
      if (l.entradas != null && !Array.isArray(l.entradas)){ invalido(`${r}.entradas`, 'no es una lista'); return; }
      (l.entradas || []).forEach((e, j) => {
        const re = `${r}.entradas[${j}]`;
        if (this.tipoDe(e) !== 'object'){ invalido(re, 'no es un ejercicio'); return; }
        if (typeof e.ejercicio !== 'string' || !e.ejercicio.trim()) invalido(`${re}.ejercicio`, 'sin nombre');
        if (e.kg != null){
          if (!this.esNum(e.kg)) invalido(`${re}.kg`, 'no es un número');
          else if (e.kg === 0) calidad.cargasCero++;
        }
        const reps = e.reps;
        if (reps != null && !Array.isArray(reps)) invalido(`${re}.reps`, 'no es una lista');
        (Array.isArray(reps) ? reps : []).forEach((x, k) => {
          if (x === null) { calidad.seriesSinAnotar++; return; }
          if (!Number.isInteger(x) || x < 0) invalido(`${re}.reps[${k}]`, 'repeticiones no válidas');
          else if (x === 0) calidad.repsCero++;
        });
        const rir = e.rir;
        if (rir != null && !Array.isArray(rir)) invalido(`${re}.rir`, 'no es una lista');
        (Array.isArray(rir) ? rir : []).forEach((x, k) => {
          if (x === null) return;
          if (!Number.isInteger(x) || x < 0 || x > 10) invalido(`${re}.rir[${k}]`, 'RIR no válido');
        });
        const ks = e.kgSets;
        if (ks != null && !Array.isArray(ks)) invalido(`${re}.kgSets`, 'no es una lista');
        (Array.isArray(ks) ? ks : []).forEach((x, k) => {
          if (x !== null && !this.esNum(x)) invalido(`${re}.kgSets[${k}]`, 'no es un número');
        });
      });
    });

    // --- cuestionario y reloj ---
    (raw.readinessDiario || []).forEach((d, i) => {
      if (this.tipoDe(d) !== 'object' || !this.dia(d.fecha)){
        invalido(`readinessDiario[${i}]`, 'sin fecha válida'); calidad.registrosDescartados++;
      }
    });
    (raw.saludDiaria || []).forEach((d, i) => {
      if (this.tipoDe(d) !== 'object' || !this.dia(d.fecha)){
        invalido(`saludDiaria[${i}]`, 'sin fecha válida'); calidad.registrosDescartados++; return;
      }
      for (const k of ['pasos','fcReposo','kcalTotal','kcalBasal','kcalActiva','pesoKg','vfc'])
        if (d[k] != null && !this.esNum(d[k])) invalido(`saludDiaria[${i}].${k}`, 'no es un número');
    });

    // --- nutrición ---
    const n = raw.nutricion;
    if (n && typeof n === 'object'){
      for (const k of ['pesajes','medicionesGrasa','recomendaciones'])
        if (n[k] != null && !Array.isArray(n[k])) invalido(`nutricion.${k}`, 'no es una lista');
      (Array.isArray(n.pesajes) ? n.pesajes : []).forEach((p, i) => {
        if (this.tipoDe(p) !== 'object' || !this.dia(p.fecha) || !this.esNum(p.pesoKg) || p.pesoKg <= 0){
          invalido(`nutricion.pesajes[${i}]`, 'pesaje no válido'); calidad.registrosDescartados++;
        }
      });
    }

    // --- medidas y fotos (mismo filtro que EstadoMedidas.fromJson) ---
    const md = raw.medidas;
    if (md && typeof md === 'object'){
      (Array.isArray(md.registros) ? md.registros : []).forEach((r, i) => {
        const ok = this.tipoDe(r) === 'object' && this.dia(r.fecha) && this.SITIOS.includes(r.sitio) &&
                   this.esNum(r.cm) && r.cm >= 10 && r.cm <= 300;
        if (!ok){ invalido(`medidas.registros[${i}]`, 'medida no válida'); calidad.registrosDescartados++; }
      });
      (Array.isArray(md.fotos) ? md.fotos : []).forEach((f, i) => {
        const ok = this.tipoDe(f) === 'object' && this.dia(f.fecha) && this.archivoValido(f.archivo);
        if (!ok){ invalido(`medidas.fotos[${i}]`, 'foto sin fecha o con nombre no válido'); calidad.registrosDescartados++; }
        else if (!this.POSES.includes(f.pose)) invalido(`medidas.fotos[${i}].pose`, 'pose desconocida (la app la trata como «frente»)');
      });
    }

    if (raw.unidadPeso != null && raw.unidadPeso !== 'kg' && raw.unidadPeso !== 'lb')
      invalido('unidadPeso', 'unidad desconocida (se usa kg)');

    if (calidad.invalidos)
      avisos.push(`${calidad.invalidos} valor${calidad.invalidos === 1 ? '' : 'es'} no válido${calidad.invalidos === 1 ? '' : 's'}: se ignora${calidad.invalidos === 1 ? '' : 'n'} igual que en la app.`);
    return { errores, avisos, calidad };
  },

  archivoValido(n){
    return typeof n === 'string' && n.length > 0 && n.length <= 255 &&
           !n.includes('/') && !n.includes('\\') && !n.includes('..') &&
           !/[\u0000-\u001f\u007f]/.test(n);
  },

  // ---------- resumen ----------

  resumen(raw, { nombreArchivo = '' } = {}){
    const lista = v => Array.isArray(v) ? v : [];
    const logs = lista(raw.logs).filter(l => l && typeof l === 'object' && this.dia(l.fecha));
    const fuerza = logs.filter(l => l.tipo !== 'cardio');
    const cardio = logs.filter(l => l.tipo === 'cardio');
    const readiness = lista(raw.readinessDiario).filter(d => d && this.dia(d.fecha));
    const salud = lista(raw.saludDiaria).filter(d => d && this.dia(d.fecha));
    const n = (raw.nutricion && typeof raw.nutricion === 'object') ? raw.nutricion : null;
    const pesajes = n ? lista(n.pesajes).filter(p => p && this.dia(p.fecha) && this.esNum(p.pesoKg) && p.pesoKg > 0) : [];
    const grasa = n ? lista(n.medicionesGrasa).filter(m => m && this.dia(m.fecha)) : [];
    const md = (raw.medidas && typeof raw.medidas === 'object') ? raw.medidas : null;
    const registros = md ? lista(md.registros).filter(r => r && this.dia(r.fecha)) : [];
    const fotos = md ? lista(md.fotos).filter(f => f && this.dia(f.fecha) && this.archivoValido(f.archivo)) : [];

    const dias = xs => xs.map(x => this.dia(x.fecha)).filter(Boolean).sort();
    const ultimo = xs => { const d = dias(xs); return d.length ? d[d.length - 1] : null; };
    const primero = xs => { const d = dias(xs); return d.length ? d[0] : null; };

    // Último registro de cualquier tipo: es la «antigüedad» real de los
    // datos. No es la fecha de exportación, que la copia no incluye.
    const todas = [fuerza, cardio, readiness, salud, pesajes, grasa, registros, fotos]
      .flatMap(dias).sort();

    const ejercicios = new Set();
    fuerza.forEach(l => lista(l.entradas).forEach(e => {
      if (e && typeof e.ejercicio === 'string' && e.ejercicio.trim()) ejercicios.add(e.ejercicio.trim());
    }));

    return {
      sesionesFuerza: fuerza.length,
      sesionesCardio: cardio.length,
      cuestionarios: readiness.length,
      diasReloj: salud.length,
      pesajes: pesajes.length,
      medicionesGrasa: grasa.length,
      medidas: registros.length,
      fechasMedidas: new Set(registros.map(r => this.dia(r.fecha))).size,
      fotosIndice: fotos.length,
      tieneBloqueMedidas: !!md,
      tieneNutricion: !!n,
      lineasRutina: lista(raw.planMod).length,
      ejercicios: ejercicios.size,
      primerRegistro: todas.length ? todas[0] : null,
      ultimoRegistro: todas.length ? todas[todas.length - 1] : null,
      primerEntreno: primero(fuerza),
      ultimoEntreno: ultimo(fuerza),
      ultimoPesaje: ultimo(pesajes),
      unidadPeso: raw.unidadPeso === 'lb' ? 'lb' : 'kg',
      sistema: typeof raw.sistema === 'string' ? raw.sistema : null,
      diasSemana: typeof raw.dias === 'string' || typeof raw.dias === 'number' ? String(raw.dias) : null,
      fechaNombreArchivo: this.fechaDeNombre(nombreArchivo),
      // Fecha de la exportación ANTERIOR registrada por la app (no esta).
      exportacionAnterior: this.dia(raw.fechaUltimaCopia),
    };
  },

  // ---------- comparación de instantáneas ----------

  /* Huella de una sesión. No hay identificador de sesión en la copia: la
     fecha con hora + tipo + día de rutina la distingue en la práctica. */
  huellas(raw){
    const out = new Set();
    (Array.isArray(raw && raw.logs) ? raw.logs : []).forEach(l => {
      if (!l || typeof l !== 'object' || !this.dia(l.fecha)) return;
      out.add(`${String(l.fecha).trim()}|${l.tipo === 'cardio' ? 'cardio' : 'fuerza'}|${l.dia ?? l.nombre ?? ''}`);
    });
    return out;
  },

  /* Compara la instantánea guardada (actual) con la nueva. No decide nada:
     describe lo que cambiaría para que la persona elija con datos. */
  comparar(actualRaw, nuevoRaw, { shaActual = null, shaNuevo = null } = {}){
    const ra = this.resumen(actualRaw), rn = this.resumen(nuevoRaw);
    const ha = this.huellas(actualRaw), hn = this.huellas(nuevoRaw);
    let comunes = 0, faltan = 0;
    ha.forEach(h => { if (hn.has(h)) comunes++; else faltan++; });
    const nuevas = hn.size - comunes;

    const termAntes = !!(ra.ultimoRegistro && rn.ultimoRegistro && rn.ultimoRegistro < ra.ultimoRegistro);
    const retroceso = termAntes || (faltan > 0 && nuevas === 0);

    // Indicios de persona. Solo informan: la decisión es explícita.
    const contradicciones = [];
    const iguales = [];
    for (const k of ['fechaNacimiento', 'onboardingCompletadoEn']){
      const a = actualRaw && actualRaw[k], b = nuevoRaw && nuevoRaw[k];
      if (typeof a === 'string' && typeof b === 'string'){
        if (a === b) iguales.push(k); else contradicciones.push(k);
      }
    }
    let persona;
    if (contradicciones.length) persona = 'distinta';
    else if (ha.size && hn.size && comunes === 0) persona = 'sin_relacion';
    else if (ha.size && comunes / ha.size >= 0.5) persona = 'probable';
    else persona = 'incierta';

    return {
      identica: !!(shaActual && shaNuevo && shaActual === shaNuevo),
      sesionesActual: ha.size, sesionesNueva: hn.size,
      comunes, nuevas, faltan,
      ultimoActual: ra.ultimoRegistro, ultimoNuevo: rn.ultimoRegistro,
      terminaAntes: termAntes,
      retroceso,
      persona, contradicciones, iguales,
    };
  },
};
