/* Capa de nutrición de la app coach.

   Lo que se comprueba aquí es, sobre todo, PARIDAD con el motor de la app
   móvil (lib/nutricion/*): las bandas, la partición, los topes y el
   enmascaramiento tienen que dar exactamente lo mismo que en Dart, porque
   si divergen el entrenador ve un semáforo distinto del que ve su cliente.
   Los valores esperados están calculados a mano desde las tablas de
   lib/nutricion/constantes.dart, no capturados de esta implementación. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const appDir = new URL('../', import.meta.url);

function cargar(){
  const sandbox = {
    console,
    State: { serie1: null, serie2: null, mostrarFcReposo: false },
    Charts: {
      lineas: () => '<svg data-test="lineas"></svg>',
      combinada: () => '', barras: () => '', dobleEje: () => '', sparkline: () => '',
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL('data.js', appDir), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(new URL('nutricion.js', appDir), 'utf8'), sandbox);
  // `enRango` vive en app.js, que no se carga aquí porque arrastra el DOM.
  vm.runInContext(`function enRango(fecha, desde, hasta){
    const d = soloDia(fecha); return d >= soloDia(desde) && d <= soloDia(hasta);
  }`, sandbox);
  vm.runInContext(
    `${fs.readFileSync(new URL('views.js', appDir), 'utf8')}
     ;globalThis.__api = { normalizar, normalizarNutricion, catalogoSeries, Vistas,
       NUT, NUT_TXT, Nutricion, EstimadorPeso, BandaTasa, Particion, Reparto,
       CurvaGrasa, GuardarrailesNut, Asentamiento, PlanTemporada, Enmascaramiento,
       duracionCiclo, acumuladoNut, fmtTasa };`,
    sandbox,
  );
  return sandbox.__api;
}

// Fecha local, como fmtISO de la app: toISOString pasaría por UTC y correría
// un día todas las fechas al este de Greenwich.
const iso = d => { const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const dia = (y, m, d) => new Date(y, m - 1, d);

/* Copia de seguridad sintética: 70 días de déficit con pesaje diario,
   pérdida limpia de 0,5 kg/semana desde 80 kg. */
function copia({ nutricion = undefined } = {}){
  return { logs: [], planMod: [], readinessDiario: [], ...(nutricion ? { nutricion } : {}) };
}

function pesajesLineales({ desde = dia(2026, 5, 1), dias = 70, pesoInicial = 80, kgSemana = -0.5 } = {}){
  const out = [];
  for (let i = 0; i < dias; i++){
    const f = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
    out.push({ fecha: iso(f), pesoKg: pesoInicial + kgSemana * i / 7, enmascarado: false });
  }
  return out;
}

function bloqueNutricion(extra = {}){
  return {
    schemaVersion: 6,
    activo: true,
    perfil: { alturaCm: 178, sexo: 'M', experienciaFuerza: 'INTERMEDIATE',
              grasaInicialPct: 22, metodoGrasa: 'NAVY', pesoReferenciaGrasaKg: 90 },
    faseActual: {
      id: 'f1', tipo: 'DEFICIT', inicio: iso(dia(2026, 5, 1)), fin: null,
      tasaObjetivoPctSemana: -0.75, diaEvaluacion: 5, ajusteAcumuladoKcal: -230,
      refeeds: 1, estado: 'ACTIVE', ingestaBaseKcal: null, pesoObjetivoKg: 74,
      semanasPreviasEnTipo: 0, modoCiclo: false, porcionesProteinaDia: 3,
      proteinaGPorKg: 1.8, proteinaPesoReferenciaKg: 80, topeImcAmpliadoActivo: null,
      integracionEntrenamiento: {
        rutinaId: 'r1', vigiladosPersonalizados: ['Press banca'],
        evaluacionesCaidaConsecutivas: 1, escalon: 2, trinqueteNivel: 1,
        topesSeriesPorLinea: { 'linea-1': 3 }, ultimaCaidaAgregadaPct: 3.2,
        ultimosVigiladosEvaluables: 2, ultimaCondicionCaida: true,
        ultimoDisparo: dia(2026, 6, 20).toISOString(),
      },
    },
    fasesCerradas: [],
    pesajes: pesajesLineales(),
    biblioteca: [{ nombre: 'Arroz', estadoReferencia: 'DRY_RAW', kcalPor100g: 350, macro: 'CARB', pasoGramos: 10 }],
    recomendaciones: [
      { fecha: iso(dia(2026, 5, 22)), faseId: 'f1', tipo: 'ADJUST', tasaRealPctSemana: -0.45,
        errorKcalDia: -180, ajusteKcalDia: -110, opciones: [
          { nombre: 'Arroz', estadoReferencia: 'DRY_RAW', gramos: -30, kcalReales: -105 }],
        proteinaObjetivoGDia: 133.2, porcionesProteinaDia: 3, objetivoAplicado: false },
      { fecha: iso(dia(2026, 5, 29)), faseId: 'f1', tipo: 'HOLD', tasaRealPctSemana: -0.72 },
      { fecha: iso(dia(2026, 6, 20)), faseId: 'f1', tipo: 'HOLD', tasaRealPctSemana: -0.80,
        accionEntrenamiento: 'VOLUME_CUT_1', porRendimiento: true },
      { fecha: iso(dia(2026, 6, 27)), faseId: 'f1', tipo: 'ADJUST', tasaRealPctSemana: -0.40,
        errorKcalDia: -200, ajusteKcalDia: -120 },
    ],
    marcasCiclo: [],
    refeeds: [{ inicio: iso(dia(2026, 6, 1)), dias: 2 }],
    reanudaciones: [],
    medicionesGrasa: [
      { fecha: iso(dia(2026, 5, 1)), porcentajePct: 22, metodo: 'NAVY', pesoAnclaKg: 90 },
      { fecha: iso(dia(2026, 5, 31)), porcentajePct: 20, metodo: 'NAVY', pesoAnclaKg: 86 },
    ],
    ultimaSolicitudGrasa: iso(dia(2026, 5, 31)),
    planTemporada: {
      id: 'p1', creado: iso(dia(2026, 4, 20)), replanificado: null, transicionPropuesta: null,
      bloques: [
        { id: 'b1', tipo: 'CUT', inicio: iso(dia(2026, 5, 1)), fin: iso(dia(2026, 6, 26)), tasaPctSemana: -0.75 },
        { id: 'b2', tipo: 'BRIDGE', inicio: iso(dia(2026, 6, 27)), fin: iso(dia(2026, 7, 17)), tasaPctSemana: 0 },
      ],
    },
    notificaciones: { recordatorioPesajeActivo: true, tarjetaSemanalActiva: false, horaPesaje: 8, minutoPesaje: 0 },
    ...extra,
  };
}

// ---------------------------------------------------------------- normalización

test('una copia sin capa de nutrición no rompe nada', () => {
  const api = cargar();
  const datos = api.normalizar(copia());
  assert.equal(datos.nutricion.presente, false);
  assert.equal(datos.nut, null);
  // Y el comparador de series sigue funcionando sin las series de nutrición.
  const cat = api.catalogoSeries({ datos, perfil: datos.perfil, fuerzaR: [], readinessR: [],
    desde: dia(2026, 5, 1), hasta: dia(2026, 7, 1) });
  assert.equal(cat.some(s => s.id.startsWith('nut_')), false);
});

test('normaliza el bloque nutricion completo', () => {
  const api = cargar();
  const N = api.normalizar(copia({ nutricion: bloqueNutricion() })).nutricion;
  assert.equal(N.presente, true);
  assert.equal(N.activo, true);
  assert.equal(N.schemaVersion, 6);
  assert.equal(N.fase.tipo, 'DEFICIT');
  assert.equal(N.fase.tasaObjetivoPctSemana, -0.75);
  assert.equal(N.fase.integracion.trinqueteNivel, 1);
  assert.equal(N.pesajes.length, 70);
  assert.equal(N.recomendaciones.length, 4);
  assert.equal(N.plan.bloques.length, 2);
  // El % graso trae ya derivadas las masas del peso ancla.
  assert.equal(N.medicionesGrasa[0].grasaKg, 19.8);
  assert.equal(N.medicionesGrasa[0].magraKg, 90 - 19.8);
  // El objetivo de proteína se calcula sobre el PESO OBJETIVO, no el actual.
  assert.equal(N.fase.objetivoProteinaGDia, 74 * 1.8);
});

test('deduplica pesajes y mediciones del mismo día conservando el primero', () => {
  const api = cargar();
  const N = api.normalizarNutricion({ nutricion: bloqueNutricion({
    pesajes: [
      { fecha: '2026-05-01', pesoKg: 80 },
      { fecha: '2026-05-01', pesoKg: 99 },
      { fecha: '2026-05-02', pesoKg: 79.8 },
    ],
    medicionesGrasa: [
      { fecha: '2026-05-01', porcentajePct: 22, metodo: 'NAVY', pesoAnclaKg: 90 },
      { fecha: '2026-05-01', porcentajePct: 40, metodo: 'NAVY', pesoAnclaKg: 90 },
    ],
  }) });
  assert.deepEqual(N.pesajes.map(p => p.pesoKg), [80, 79.8]);
  assert.equal(N.medicionesGrasa.length, 1);
  assert.equal(N.medicionesGrasa[0].porcentajePct, 22);
});

// ---------------------------------------------------------------- filtro (§3.1)

test('el filtro converge al peso-tendencia y al ritmo reales', () => {
  const api = cargar();
  const nut = api.Nutricion.contexto(
    api.normalizarNutricion({ nutricion: bloqueNutricion() }),
    { hoy: dia(2026, 7, 9) });
  // Día 70 de una bajada limpia de 0,5 kg/semana desde 80 kg.
  const pesoReal = 80 - 0.5 * 69 / 7;
  assert.ok(Math.abs(nut.tendenciaKg - pesoReal) < 0.3,
    `tendencia ${nut.tendenciaKg} lejos de ${pesoReal}`);
  const ritmoReal = -0.5 / 7 * 7 / pesoReal * 100;   // ≈ −0,66 %/semana
  assert.ok(Math.abs(nut.tasaPctSemana - ritmoReal) < 0.12,
    `ritmo ${nut.tasaPctSemana} lejos de ${ritmoReal}`);
  // La serie NO se extrapola más allá del último pesaje.
  assert.equal(iso(nut.fechaTendencia), '2026-07-09');
});

test('el enmascaramiento cubre el refeed y los días extra (§3.4)', () => {
  const api = cargar();
  const dias = api.Enmascaramiento.construir([{ inicio: dia(2026, 6, 1), dias: 2 }], []);
  // 2 días de refeed + maskExtraDays (3) = 5 días seguidos.
  assert.equal(dias.size, 5);
  ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']
    .forEach(d => assert.ok(dias.has(d), `falta ${d}`));
  assert.equal(dias.has('2026-06-06'), false);
  // Una vuelta de pausa enmascara solo maskExtraDays.
  assert.equal(api.Enmascaramiento.construir([], [{ fecha: dia(2026, 6, 1) }]).size, 3);
});

test('la duración del ciclo es la mediana de los intervalos válidos (§3.5)', () => {
  const api = cargar();
  assert.deepEqual(api.duracionCiclo([]), { dias: 28, ciclosMedidos: 0 });
  const marcas = [dia(2026, 1, 1), dia(2026, 1, 29), dia(2026, 2, 28)].map(f => ({ fecha: f }));
  assert.deepEqual(api.duracionCiclo(marcas), { dias: 29, ciclosMedidos: 2 });
  // Un intervalo de 10 días es un sangrado marcado por error, no un ciclo.
  const raras = [dia(2026, 1, 1), dia(2026, 1, 11)].map(f => ({ fecha: f }));
  assert.deepEqual(api.duracionCiclo(raras), { dias: 28, ciclosMedidos: 0 });
});

// ---------------------------------------------------------------- bandas (§5.3–5.4)

test('las bandas de déficit reproducen las tablas del tramo medio', () => {
  const api = cargar();
  const ev = t => api.BandaTasa.evaluar({ tipo: 'DEFICIT', tasaAbs: t, topeAbsPctSemana: 1.0, sexo: 'M' });
  assert.equal(ev(0.30), 'neutro');   // por debajo de 0,40: sostenible, no es aviso
  assert.equal(ev(0.40), 'verde');    // frontera cerrada por abajo
  assert.equal(ev(0.74), 'verde');
  assert.equal(ev(0.75), 'ambar');    // frontera pertenece a la banda que empieza
  assert.equal(ev(1.00), 'ambar');    // extremo superior cerrado del último tramo
});

test('el tramo de % graso alto abre banda verde más ancha y rojo por encima de 1,25', () => {
  const api = cargar();
  const ev = t => api.BandaTasa.evaluar({ tipo: 'DEFICIT', tasaAbs: t,
    topeAbsPctSemana: 1.5, grasaVigentePct: 30, sexo: 'M' });
  assert.equal(ev(0.60), 'verde');
  assert.equal(ev(1.10), 'ambar');
  assert.equal(ev(1.30), 'rojo');
  // Los umbrales de mujer se desplazan +8 pp: con 30 % sigue en tramo medio.
  assert.equal(api.BandaTasa.tramoGrasa(30, 'F'), 'medio');
  assert.equal(api.BandaTasa.tramoGrasa(30, 'M'), 'alto');
});

test('las bandas de superávit dependen de la experiencia declarada', () => {
  const api = cargar();
  const ev = (t, exp) => api.BandaTasa.evaluar({ tipo: 'SURPLUS', tasaAbs: t,
    topeAbsPctSemana: 0.35, experiencia: exp });
  assert.equal(ev(0.25, 'NOVICE'), 'verde');
  assert.equal(ev(0.25, 'INTERMEDIATE'), 'ambar');
  assert.equal(ev(0.30, 'ADVANCED'), 'rojo');
  // Sin experiencia declarada se usan las de intermedio.
  assert.equal(ev(0.20, null), 'verde');
});

// ---------------------------------------------------------------- partición (§3–§4)

test('la partición interpola entre anclas y desplaza los umbrales de mujer', () => {
  const api = cargar();
  assert.equal(api.Particion.deficitBase(20, 'M'), 0.85);
  assert.ok(Math.abs(api.Particion.deficitBase(22, 'M') - 0.87) < 1e-9);
  assert.ok(Math.abs(api.Particion.deficitBase(20, 'F') - 0.732) < 1e-9);
  assert.equal(api.Particion.deficitBase(5, 'M'), 0.70);    // satura por abajo
  assert.equal(api.Particion.deficitBase(45, 'M'), 0.95);   // satura por arriba
  // Correr más penaliza el reparto en déficit.
  assert.ok(Math.abs(api.Particion.esperado({ tipo: 'DEFICIT', grasaPct: 20, banda: 'ambar' }) - 0.80) < 1e-9);
  // En superávit la penalización va en sentido contrario: más grasa ganada.
  assert.ok(Math.abs(api.Particion.esperado({ tipo: 'SURPLUS', experiencia: 'NOVICE', grasaPct: 15, banda: 'rojo' }) - 0.55) < 1e-9);
  assert.equal(api.Particion.esperado({ tipo: 'MAINTENANCE', grasaPct: 20 }), 0);
});

test('el reparto valora el último tramo y explica cuándo se calla', () => {
  const api = cargar();
  const med = [
    { fecha: dia(2026, 5, 1), clave: '2026-05-01', porcentajePct: 22, metodo: 'NAVY', pesoAnclaKg: 90, grasaKg: 19.8, magraKg: 70.2 },
    { fecha: dia(2026, 5, 31), clave: '2026-05-31', porcentajePct: 20, metodo: 'NAVY', pesoAnclaKg: 86, grasaKg: 17.2, magraKg: 68.8 },
  ];
  const r = api.Reparto.valorar({ mediciones: med, tipoFase: 'DEFICIT',
    topeAbsPctSemana: 1.0, tasaObjetivoPctSemana: -0.75, sexo: 'M', experiencia: 'INTERMEDIATE' });
  assert.equal(r.dias, 30);
  assert.equal(r.deltaPesoKg, -4);
  assert.ok(Math.abs(r.deltaGrasaKg - -2.6) < 1e-9);
  assert.ok(Math.abs(r.fraccionGrasaObservada - 0.65) < 1e-9);
  // p_esp: tabla en 22 % (0,87) menos la penalización de banda ámbar (0,05).
  assert.ok(Math.abs(r.fraccionGrasaEsperada - 0.82) < 1e-9);
  assert.equal(r.banda, 'ambar');   // 0,65 cae entre 0,82−0,25 y 0,82−0,10

  // Menos de 14 días: cifras sí, semáforo no.
  const corto = api.Reparto.valorar({
    mediciones: [med[0], { ...med[1], fecha: dia(2026, 5, 8), clave: '2026-05-08' }],
    tipoFase: 'DEFICIT', topeAbsPctSemana: 1.0, tasaObjetivoPctSemana: -0.75 });
  assert.equal(corto.banda, null);
  assert.equal(corto.motivo, 'intervaloCorto');

  // Métodos distintos, peso en contra y mantenimiento tienen su propio motivo.
  assert.equal(api.Reparto.valorar({ mediciones: [med[0], { ...med[1], metodo: 'DIRECT' }],
    tipoFase: 'DEFICIT', topeAbsPctSemana: 1.0 }).motivo, 'metodosDistintos');
  assert.equal(api.Reparto.valorar({ mediciones: med, tipoFase: 'SURPLUS',
    topeAbsPctSemana: 0.35 }).motivo, 'pesoEnContra');
  assert.equal(api.Reparto.valorar({ mediciones: med, tipoFase: 'MAINTENANCE',
    topeAbsPctSemana: 0 }).motivo, 'sinFaseComparable');
  assert.equal(api.Reparto.valorar({ mediciones: [med[0]], tipoFase: 'DEFICIT', topeAbsPctSemana: 1 }), null);
});

// ---------------------------------------------------------------- guardarraíles (§6)

test('el tope ampliado de déficit lo habilita el % graso vigente, no el caducado', () => {
  const api = cargar();
  const G = api.GuardarrailesNut;
  assert.equal(G.topeTasaInicial('DEFICIT', { grasaVigentePct: 26, diasDesdeMedicion: 5, sexo: 'M' }), 1.5);
  assert.equal(G.topeTasaInicial('DEFICIT', { grasaVigentePct: 26, diasDesdeMedicion: 20, sexo: 'M' }), 1.0);
  assert.equal(G.topeTasaInicial('DEFICIT', { grasaVigentePct: 26, diasDesdeMedicion: null, sexo: 'M' }), 1.0);
  // La vía del IMC sigue existiendo en paralelo.
  assert.equal(G.topeTasaInicial('DEFICIT', { imc: 31 }), 1.5);
  assert.equal(G.topeTasaInicial('SURPLUS', {}), 0.35);
});

test('el tope del ajuste acumulado usa la ingesta declarada y, si no, la estimada', () => {
  const api = cargar();
  const G = api.GuardarrailesNut;
  assert.equal(G.topeEfectivoDeficit({ ingestaBaseKcal: 2000 }), 500);   // 25 % de lo declarado
  assert.equal(G.topeEfectivoDeficit({ ingestaBaseKcal: null }, null), 600);
  assert.equal(G.topeEfectivoDeficit({ ingestaBaseKcal: null }, 1600), 400);
  assert.equal(G.topeEfectivoDeficit({ ingestaBaseKcal: null }, 2500), 600);   // nunca por encima del tope plano
  // Katch-McArdle × factor de actividad.
  assert.ok(Math.abs(G.ingestaMantenimientoEstimadaKcal(80, 20) - (370 + 21.6 * 64) * 1.45) < 1e-9);
  assert.equal(G.ingestaMantenimientoEstimadaKcal(80, null), null);
});

test('el asentamiento exige menos a una fase declarada como ya en curso (§3.3)', () => {
  const api = cargar();
  const A = api.Asentamiento;
  assert.equal(A.diasRequeridos({ semanasPreviasEnTipo: 0, modoCiclo: false }), 21);
  assert.equal(A.pesajesRequeridos({ semanasPreviasEnTipo: 0 }), 10);
  assert.equal(A.diasRequeridos({ semanasPreviasEnTipo: 4, modoCiclo: false }), 7);
  assert.equal(A.pesajesRequeridos({ semanasPreviasEnTipo: 4 }), 5);
  // Con modo ciclo nunca se baja de un ciclo completo, lleve las semanas que lleve.
  assert.equal(A.diasRequeridos({ semanasPreviasEnTipo: 4, modoCiclo: true }, 30), 30);
});

// ---------------------------------------------------------------- plan (§6.4)

test('el semáforo de duración de bloque usa las bandas de su tipo', () => {
  const api = cargar();
  const bloque = (tipo, semanas) => ({ tipo, semanas });
  assert.equal(api.PlanTemporada.colorDuracion(bloque('CUT', 8)), 'verde');
  assert.equal(api.PlanTemporada.colorDuracion(bloque('CUT', 5)), 'ambar');
  assert.equal(api.PlanTemporada.colorDuracion(bloque('CUT', 20)), 'rojo');
  assert.equal(api.PlanTemporada.colorDuracion(bloque('BULK', 16)), 'verde');
  assert.equal(api.PlanTemporada.colorDuracion(bloque('BRIDGE', 2)), 'verde');
  assert.equal(api.PlanTemporada.tipoFase('BULK'), 'SURPLUS');
  assert.equal(api.PlanTemporada.tipoFase('CUT'), 'DEFICIT');
});

test('la proyección encadena bloques y el puente conserva peso y grasa', () => {
  const api = cargar();
  const nutN = api.normalizarNutricion({ nutricion: bloqueNutricion() });
  const proy = api.PlanTemporada.proyectar(nutN.plan, {
    pesoPartidaKg: 80, grasaPartidaPct: 20, perfil: nutN.perfil, experiencia: 'INTERMEDIATE',
    diasDesdeMedicion: 5,
  });
  assert.equal(proy.bloques.length, 2);
  assert.ok(proy.bloques[0].pesoFinKg < 80);            // definición: baja
  assert.ok(proy.bloques[0].grasaFinPct < 20);          // y baja el % graso
  const puente = proy.bloques[1];
  assert.equal(puente.pesoInicioKg, proy.bloques[0].pesoFinKg);
  assert.equal(puente.pesoFinKg, puente.pesoInicioKg);  // el puente no mueve nada
  assert.equal(puente.grasaFinPct, puente.grasaInicioPct);
});

// ---------------------------------------------------------------- contexto y vistas

test('el contexto reúne fase, ritmo, topes y reparto', () => {
  const api = cargar();
  const nut = api.Nutricion.contexto(api.normalizarNutricion({ nutricion: bloqueNutricion() }),
    { hoy: dia(2026, 7, 15) });
  assert.equal(nut.fase.tipo, 'DEFICIT');
  assert.equal(nut.topeTasa, 1.0);                 // 20 % de grasa no abre el tope ampliado
  assert.equal(nut.bandaObjetivo, 'ambar');        // −0,75 en tramo medio
  assert.equal(nut.diasSinPesarse, 6);             // último pesaje el 9 de julio
  assert.equal(nut.diasDesdeMedicion, 45);
  assert.equal(nut.grasaCaducada, true);
  assert.equal(nut.reparto.banda, 'ambar');
  assert.equal(nut.trinquete.trinqueteNivel, 1);
  // Tope de ajuste: sin ingesta declarada manda el estimado desde la composición.
  assert.equal(nut.topeAjuste.usadoKcal, 230);
  assert.ok(nut.topeAjuste.topeKcal > 0 && nut.topeAjuste.topeKcal <= 600);
  // Curva teórica de % graso, anclada en las dos mediciones.
  assert.equal(nut.curvaGrasa.anclas.length, 2);
  assert.equal(nut.curvaGrasa.sueloPct, 5);
});

test('el acumulado del lazo suma los ajustes y omite los refeeds', () => {
  const api = cargar();
  const nut = api.Nutricion.contexto(api.normalizarNutricion({ nutricion: bloqueNutricion() }));
  assert.deepEqual(api.acumuladoNut(nut).map(p => p.y), [-110, -110, -110, -230]);
});

test('el comparador de series ofrece peso, ritmo, % graso y ajuste acumulado', () => {
  const api = cargar();
  const datos = api.normalizar(copia({ nutricion: bloqueNutricion() }));
  const cat = api.catalogoSeries({ datos, perfil: datos.perfil, fuerzaR: [], readinessR: [],
    desde: dia(2026, 5, 1), hasta: dia(2026, 7, 9) });
  const ids = cat.filter(s => s.id.startsWith('nut_')).map(s => s.id);
  assert.deepEqual(ids.sort(), ['nut_acumulado', 'nut_grasa', 'nut_magra', 'nut_pesajes', 'nut_ritmo', 'nut_tendencia']);
  const ritmo = cat.find(s => s.id === 'nut_ritmo');
  assert.equal(ritmo.baseline, -0.75);
  assert.deepEqual(ritmo.umbrales.map(u => Math.round(u.y * 100) / 100), [-0.65, -0.85]);
  assert.equal(cat.find(s => s.id === 'nut_tendencia').umbrales[0].y, 74);
});

test('la adherencia al pesaje mide ritmo semanal y hueco máximo', () => {
  const api = cargar();
  const nut = api.Nutricion.contexto(api.normalizarNutricion({ nutricion: bloqueNutricion({
    pesajes: [
      { fecha: '2026-05-01', pesoKg: 80 },
      { fecha: '2026-05-02', pesoKg: 79.9 },
      { fecha: '2026-05-12', pesoKg: 79.4 },
    ],
  }) }));
  const ad = api.Nutricion.adherenciaPesaje(nut.pesajes, dia(2026, 5, 1), dia(2026, 5, 14));
  assert.equal(ad.hechos, 3);
  assert.equal(ad.dias, 14);
  assert.equal(ad.huecoMax, 10);
  assert.equal(iso(ad.huecoDesde), '2026-05-02');
});

test('la vista de Nutrición se renderiza con los datos clave', () => {
  const api = cargar();
  const datos = api.normalizar(copia({ nutricion: bloqueNutricion() }));
  const ctx = { datos, perfil: datos.perfil, fuerzaR: [], cardioR: [], readinessR: [],
    desde: dia(2026, 5, 1), hasta: dia(2026, 7, 9), nombreCliente: 'Cliente' };
  const html = api.Vistas.nutricion(ctx);
  assert.match(html, /Fase de dieta/);
  assert.match(html, /Déficit/);
  assert.match(html, /Ritmo real/);
  assert.match(html, /Adherencia al pesaje/);
  assert.match(html, /Composición corporal/);
  assert.match(html, /Tarjetas semanales del lazo/);
  assert.match(html, /Efecto sobre el entrenamiento/);
  assert.match(html, /Plan de temporada/);
  assert.match(html, /Recorte de volumen \(1\)/);
  // La pista de bandas trae las marcas de objetivo y ritmo real.
  assert.match(html, /pista-marca obj/);
  assert.match(html, /pista-marca real/);
});

test('la vista explica su ausencia en vez de romperse', () => {
  const api = cargar();
  const sinCapa = api.normalizar(copia());
  const ctx = d => ({ datos: d, perfil: d.perfil, fuerzaR: [], cardioR: [], readinessR: [],
    desde: dia(2026, 5, 1), hasta: dia(2026, 7, 9), nombreCliente: 'Cliente' });
  assert.match(api.Vistas.nutricion(ctx(sinCapa)), /no incluye la capa de nutrición/);

  const sinActivar = api.normalizar(copia({ nutricion: {
    schemaVersion: 6, activo: false, perfil: null, faseActual: null, pesajes: [],
  } }));
  assert.match(api.Vistas.nutricion(ctx(sinActivar)), /no la ha activado/);
});

/* Alertas: se comprueban con una fecha "hoy" explícita, porque casi todas
   dependen de la frescura del dato y si no el test envejecería solo. */
function alertasCon(api, bloque, hoy){
  const datos = api.normalizar(copia({ nutricion: bloque }));
  datos.nut = api.Nutricion.contexto(datos.nutricion, { hoy });
  const ctx = { datos, perfil: datos.perfil, fuerzaR: [], readinessR: [],
    desde: dia(2026, 5, 1), hasta: hoy, nombreCliente: 'Cliente' };
  const out = [];
  api.Vistas._alertasNutricion(ctx, (nivel, tag, cuerpo) => out.push({ nivel, tag, cuerpo }));
  return out;
}

test('las alertas de nutrición entran en el triaje del entrenador', () => {
  const api = cargar();
  const alertas = alertasCon(api, bloqueNutricion(), dia(2026, 7, 15));
  const tags = alertas.map(a => a.tag);
  assert.ok(tags.includes('Dieta y volumen'), 'falta el aviso de volumen recortado por la dieta');
  assert.ok(tags.includes('% graso'), 'falta el aviso de % graso caducado');
  assert.ok(tags.includes('Reparto'), 'falta la valoración del reparto');
  assert.equal(alertas.some(a => a.nivel === 'ambar'), true);
});

test('sin pesajes recientes la alerta sube a roja: el lazo está parado', () => {
  const api = cargar();
  // Último pesaje el 20 de mayo; se mira el 20 de junio: 31 días.
  const alertas = alertasCon(api, bloqueNutricion({ pesajes: pesajesLineales({ dias: 20 }) }),
    dia(2026, 6, 20));
  const roja = alertas.find(a => a.nivel === 'rojo' && /sin pesarse/.test(a.cuerpo));
  assert.ok(roja, 'no se avisó de que el cliente lleva un mes sin pesarse');
  assert.match(roja.cuerpo, /31 días sin pesarse/);

  // A los 10 días el aviso existe pero es ámbar, no rojo.
  const suave = alertasCon(api, bloqueNutricion({ pesajes: pesajesLineales({ dias: 20 }) }),
    dia(2026, 5, 30));
  assert.equal(suave.some(a => a.nivel === 'rojo' && /sin pesarse/.test(a.cuerpo)), false);
  assert.equal(suave.some(a => a.nivel === 'ambar' && /sin pesarse/.test(a.cuerpo)), true);
});

test('una propuesta de bajar el objetivo sin aceptar se señala aparte', () => {
  const api = cargar();
  const bloque = bloqueNutricion();
  bloque.recomendaciones = [...bloque.recomendaciones, {
    fecha: iso(dia(2026, 7, 4)), faseId: 'f1', tipo: 'LOWER_TARGET',
    tasaRealPctSemana: -0.95, nuevaTasaObjetivoPctSemana: -0.5, objetivoAplicado: false,
  }];
  const alertas = alertasCon(api, bloque, dia(2026, 7, 9));
  const pendiente = alertas.find(a => a.tag === 'Sin aceptar');
  assert.ok(pendiente, 'no se avisó de la propuesta pendiente');
  assert.equal(pendiente.nivel, 'azul');
});
