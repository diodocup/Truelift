'use strict';
/* ================================================================
   TrueLift Escritorio — informe-vista.js (fase 7)
   HTML de la sección Informes: opciones (pantalla) y documento del
   informe (pantalla e impresión). El cálculo está en informe.js.
   Todo texto que llega de la copia pasa por esc().

   Se imprime con la hoja de impresión del Coach (../coach/styles.css):
   papel blanco, colores del sistema adaptados y .no-print fuera.
   ================================================================ */

const InformeVista = (() => {

const F = VistasEsc.F, tabla = VistasEsc.tabla;
const tarjeta = (titulo, cuerpo, id = '') => `<section class="card inf-bloque"${id ? ` aria-labelledby="${id}"` : ''}><h3${id ? ` id="${id}"` : ''}>${esc(titulo)}</h3>${cuerpo}</section>`;
const cifra = (valor, etiqueta) => `<div class="cifra"><b>${esc(valor)}</b><span>${esc(etiqueta)}</span></div>`;
const chip = (clase, texto) => `<span class="chip ${clase}">${esc(texto)}</span>`;
const vacio = msg => `<p class="muted">${msg}</p>`;
const num = (v, unidad = '', dec = 1) => v == null ? '—' : `${F.num(v, dec)}${unidad ? ` ${unidad}` : ''}`;
const signo = (v, unidad, dec = 1) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${F.num(Math.abs(v), dec)} ${unidad}`;
const rango = (a, b) => +soloDia(a) === +soloDia(b) ? F.dia(a) : `${F.dia(a)} – ${F.dia(b)}`;
const LECTURA = { sube: ['verde', 'Al alza'], baja: ['ambar', 'A la baja'], sinCambios: ['gris', 'Sin cambios claros'], insuficiente: ['gris', 'Datos insuficientes'] };
const FASE = { DEFICIT: 'Déficit', SURPLUS: 'Superávit', MAINTENANCE: 'Mantenimiento' };
const POSE = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };
const VER = { bueno: 'Buenas', normal: 'Normales', flojo: 'Flojas', 'muy flojo': 'Muy flojas' };
const MAX_FILAS_PESO = 35;
const METODO = { DIRECT: 'Valor introducido', NAVY: 'Fórmula con contornos (Navy)', GALLERY: 'Comparación con fotos de referencia' };

// ---------------------------------------------------------------
// Opciones (solo pantalla)
// ---------------------------------------------------------------
function opciones(M, sel, error, fotos, st, hayInforme = true){
  const ms = Informe.meses(M);
  const esMes = sel.tipo !== 'fechas';
  const r = (() => { try { return Informe.rango(sel); } catch (_) { return null; } })();
  const desde = sel.desde ?? (r ? fmtISO(r.desde) : ''), hasta = sel.hasta ?? (r ? fmtISO(r.hasta) : '');
  const elegibles = fotos;
  const marcadas = elegibles.filter(f => st.fotos.has(f.archivo)).length;
  const fotosHtml = !st.conFotos ? '' : elegibles.length
    ? `<p class="muted" id="informeFotosAyuda">Marca hasta ${Informe.MAX_FOTOS} fotos del periodo. ${marcadas} de ${Informe.MAX_FOTOS} elegidas.</p>
       <ul class="inf-elegir" aria-describedby="informeFotosAyuda">${elegibles.map(f => {
         const id = `infFoto-${encodeURIComponent(f.archivo).replace(/[^A-Za-z0-9_-]/g, '_')}`;
         const on = st.fotos.has(f.archivo);
         return `<li><input type="checkbox" id="${id}" data-inf-elegir="${esc(f.archivo)}"${on ? ' checked' : ''}${!on && marcadas >= Informe.MAX_FOTOS ? ' disabled' : ''}>
           <label for="${id}"><span class="marco"><img data-mini="${esc(f.archivo)}" alt=""></span>${esc(POSE[f.pose] || f.pose)} · ${F.dia(f.fecha)}</label></li>`;
       }).join('')}</ul>`
    : vacio('No hay fotos con imagen importada en este periodo.');
  return `<section class="card no-print" id="informeOpciones" aria-labelledby="informeOpcionesTitulo">
    <h2 id="informeOpcionesTitulo">Preparar el informe</h2>
    <form id="formInforme" novalidate>
      <fieldset class="inf-tipo"><legend>Periodo</legend>
        <label class="inf-radio"><input type="radio" name="tipo" value="mes"${esMes ? ' checked' : ''}> Un mes</label>
        <div class="mod-fila"><label for="informeMes">Mes</label>
          <select id="informeMes" name="mes"${esMes ? '' : ' disabled'}>${ms.map(m => `<option value="${m.valor}"${m.valor === sel.mes ? ' selected' : ''}>${esc(m.texto)}${m.completo ? '' : ' (tus datos no llegan al final)'}</option>`).join('')}</select></div>
        <label class="inf-radio"><input type="radio" name="tipo" value="fechas"${esMes ? '' : ' checked'}> Otras fechas</label>
        <div class="inf-fechas">
          <div class="mod-fila"><label for="informeDesde">Desde</label><input type="date" id="informeDesde" name="desde" value="${esc(desde)}"${esMes ? ' disabled' : ''}></div>
          <div class="mod-fila"><label for="informeHasta">Hasta</label><input type="date" id="informeHasta" name="hasta" value="${esc(hasta)}"${esMes ? ' disabled' : ''}></div>
        </div>
      </fieldset>
      <div class="fila-botones"><button type="submit" class="btn pri">Ver informe</button></div>
    </form>
    ${error ? `<div class="alerta ambar" role="alert"><span class="tag">Revisa</span><span>${esc(error)}</span></div>` : ''}
    <fieldset class="inf-fotos"><legend>Fotos</legend>
      <label class="inf-radio"><input type="checkbox" id="informeConFotos"${st.conFotos ? ' checked' : ''}> Añadir fotos al informe</label>
      <p class="muted">Por defecto el informe no lleva fotos. Solo se añaden las que marques aquí, y la elección no se guarda: al recargar la página vuelve a salir sin fotos.</p>
      ${fotosHtml}
    </fieldset>
    <div class="fila-botones">
      <button type="button" class="btn pri" data-accion="imprimir-informe"${hayInforme ? '' : ' disabled'}>Imprimir o guardar en PDF</button>
      <button type="button" class="btn sec" data-accion="informe-comparar"${hayInforme ? '' : ' disabled'}>Comparar con el periodo anterior</button>
    </div>
    <p class="muted" style="font-size:12.5px">Para guardarlo como PDF, elige «Guardar como PDF» en el destino de la ventana de impresión. El informe se prepara en este navegador; no se envía a ningún sitio.</p>
  </section>`;
}

// ---------------------------------------------------------------
// Documento
// ---------------------------------------------------------------
function documento(M, R, { inst, fotos = [] } = {}){
  const r = R.periodo, k = R.constancia, p = R.progresion, fis = R.fisica, v = R.volumen, rec = R.recuperacion;
  const titulo = r.titulo ? `${r.titulo[0].toUpperCase()}${r.titulo.slice(1)}` : rango(r.desde, r.hasta);
  const out = [];
  out.push(`<header class="inf-cab">
    <p class="inf-marca">TrueLift · Informe personal</p>
    <h2 id="informeTitulo">${esc(titulo)}</h2>
    <p class="muted">${rango(r.desde, r.hasta)} · ${F.plural(r.dias, 'día', 'días')}</p>
    <p class="muted inf-meta">Tus datos llegan hasta el ${F.dia(R.ref)}${inst ? ` · copia importada el ${F.dia(new Date(inst.importadoEn))}` : ''} · informe preparado el ${F.dia(new Date())}.</p>
  </header>`);
  if (!R.hayDatos){
    out.push(tarjeta('Sin datos en este periodo', `<p>Tu copia no tiene registros entre el ${F.dia(r.desde)} y el ${F.dia(r.hasta)}.</p>
      <ul class="lista-plana">${R.limitaciones.slice(0, -2).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`, 'infVacio'));
    return `<article class="informe-doc" aria-labelledby="informeTitulo">${out.join('')}</article>`;
  }

  // --- Resumen del periodo ---
  out.push(tarjeta('Resumen del periodo', `<div class="cifras">
      ${cifra(String(k.sesiones), 'sesiones de fuerza')}
      ${cifra(String(k.dias), 'días con fuerza')}
      ${cifra(k.frecuencia != null ? F.num(k.frecuencia, 1) : '—', 'sesiones por semana completa')}
      ${cifra(k.conocidas ? `${k.hechasConPlan} de ${k.previstas}` : '—', 'días previstos entrenados')}
      ${cifra(String(v.seriesTotales), 'series anotadas')}
      ${cifra(String(k.cardio), `sesiones de cardio${k.minCardio != null ? ` · ${F.num(k.minCardio, 0)} min` : ''}`)}
      ${cifra(String(p.marcas.length), 'nuevas mejores marcas estimadas')}
      ${fis.tendencia && fis.tendencia.cambioKg != null ? cifra(signo(fis.tendencia.cambioKg, 'kg', 2), 'cambio del peso tendencia') : ''}
    </div>
    <p class="muted inf-nota">«—» significa dato ausente o insuficiente, no cero.</p>`, 'infResumen'));

  // --- Constancia ---
  const filasK = k.semanas.map(s => [rango(s.desde, s.hasta) + (s.completa ? '' : ' <span class="muted">(parcial)</span>'),
    String(s.sesiones), String(s.dias), s.previstas != null ? String(s.previstas) : '<span class="muted">sin calcular</span>']);
  out.push(tarjeta('Constancia', `${k.conocidas
      ? `<p>En ${F.plural(k.conocidas, 'semana completa', 'semanas completas')} con la rutina conocida entrenaste <b>${k.hechasConPlan} de ${k.previstas}</b> días previstos.</p>`
      : '<p>No se puede saber qué rutina tenías en las semanas completas de este periodo, así que no se calculan días previstos.</p>'}
    ${tabla(['Semana', 'Sesiones', 'Días con sesión', 'Días previstos'], filasK, { caption: 'Sesiones de fuerza por semana del periodo' })}
    ${k.descarga || k.duracion.n ? `<p>${k.descarga ? `Sesiones de descarga: ${k.descarga}. ` : ''}${k.duracion.n ? `Duración mediana de las sesiones: ${F.num(k.duracion.mediana, 0)} min.` : ''}</p>` : ''}
    <p class="muted inf-nota">Semanas de lunes a domingo; las parciales quedan al principio o al final del periodo y no se comparan con lo previsto. Lo previsto sale de la rutina con la que entrenabas cada semana, nunca de la rutina actual.</p>`, 'infConstancia'));

  // --- Progresión verificable ---
  const filasP = p.ejercicios.map(x => {
    const [cl, txt] = LECTURA[x.lectura];
    const nota = x.lectura !== 'insuficiente' && !x.firme ? ' <span class="muted">(orientativa)</span>' : '';
    return [`<button type="button" class="enlace" data-ejercicio="${esc(x.nombre)}">${esc(x.nombre)}</button>`,
      esc(Analisis.MODALIDAD_TXT[x.config] || '—'), `${x.n} <span class="muted">de ${x.enPeriodo}</span>`,
      x.inicio != null ? F.kg(x.inicio) : '—', x.fin != null ? F.kg(x.fin) : '—', x.deltaPct != null ? F.signo(x.deltaPct) : '—', chip(cl, txt) + nota];
  });
  const filasM = p.marcas.map(m => [`<button type="button" class="enlace" data-sesion="${m.indice}">${F.dia(m.fecha)}</button>`, esc(m.nombre), esc(m.serie), F.kg(m.valor), F.kg(m.anterior)]);
  const verTxt = Object.entries(p.veredictos).filter(([, n]) => n).map(([k2, n]) => `${VER[k2]}: ${n}`);
  out.push(tarjeta('Progresión verificable', `${filasP.length
      ? tabla(['Ejercicio', 'Modalidad', 'Sesiones comparables', 'Al principio', 'Al final', 'Cambio', 'Lectura'], filasP, { caption: '1RM estimado de cada ejercicio en el periodo' })
      : vacio('No entrenaste ejercicios con carga en este periodo.')}
    ${p.porTiempo.length ? `<p class="muted" style="font-size:12.5px">Ejercicios por tiempo (sin 1RM estimado): ${esc(p.porTiempo.map(x => `${x.nombre} (${F.plural(x.sesiones, 'sesión', 'sesiones')})`).join(', '))}.</p>` : ''}
    <h4 class="sub-h">Nuevas mejores marcas estimadas</h4>
    ${filasM.length ? tabla(['Fecha', 'Ejercicio', 'Serie', '1RM estimado', 'Marca anterior'], filasM, { caption: 'Nuevas mejores marcas del periodo' }) : vacio('Ninguna en este periodo.')}
    <h4 class="sub-h">Valoración que la app dio a cada sesión</h4>
    <p>${verTxt.length ? esc(verTxt.join(' · ')) : 'Sin valoraciones guardadas en el periodo.'}${p.sinVeredicto && verTxt.length ? ` <span class="muted">(${F.plural(p.sinVeredicto, 'sesión sin valoración guardada', 'sesiones sin valoración guardada')})</span>` : ''}</p>
    <p class="muted inf-nota">Cada ejercicio compara el principio y el final del periodo usando solo sus sesiones normales (en verde, sin descarga, sin molestias, sin cambios de un día) y con la misma modalidad de series. «Sin cambios claros» describe una diferencia pequeña; no significa estancamiento. Una lectura orientativa se apoya en pocas sesiones y no aparece en los cambios relevantes. El estado de progresión de cada ejercicio (intentos) es el de la app y se consulta en su ficha.</p>`, 'infProgresion'));

  // --- Evolución física ---
  const fisHtml = [];
  if (fis.peso.n){
    const t = fis.tendencia;
    fisHtml.push(`<div class="cifras">
      ${cifra(num(fis.peso.mediana, 'kg', 1), `peso medido (mediana de ${F.plural(fis.peso.n, 'día', 'días')})`)}
      ${t && t.inicio ? cifra(F.kg(t.inicio.kg, 1), `peso tendencia (${F.corta(t.inicio.fecha)})`) : ''}
      ${t && t.fin ? cifra(F.kg(t.fin.kg, 1), `peso tendencia (${F.corta(t.fin.fecha)})`) : ''}
      ${t && t.cambioKg != null ? cifra(signo(t.cambioKg, 'kg', 2), 'cambio del peso tendencia') : ''}</div>`);
    if (t && t.serie.length > 1){
      const svg = Charts.lineas({ series: [
        { nombre: 'Pesajes', color: TL.txt2, unidad: 'kg', soloPuntos: true, puntos: t.serie.map(x => ({ x: x.fecha, y: x.pesoKg })) },
        { nombre: 'Peso tendencia', color: TL.lima, unidad: 'kg', sinPuntos: true, puntos: t.serie.filter(x => x.tendenciaKg != null).map(x => ({ x: x.fecha, y: Math.round(x.tendenciaKg * 100) / 100 })) },
      ], w: 960, h: 220 });
      fisHtml.push(`<div class="chart-caja" role="img" aria-label="Pesajes y peso tendencia del periodo, en kg">${svg}</div>`);
      fisHtml.push(t.serie.length <= MAX_FILAS_PESO
        ? tabla(['Fecha', 'Pesaje', 'Tendencia'], t.serie.map(x => [F.dia(x.fecha), F.kg(x.pesoKg, 2) + (x.enmascarado ? ' <span class="muted">(no cuenta)</span>' : ''), x.tendenciaKg != null ? F.kg(x.tendenciaKg, 2) : '—']), { caption: 'Pesajes del periodo' })
        : tabla(['Semana', 'Pesajes', 'Mediana de los pesajes', 'Peso tendencia al final'], t.semanas.map(w => [rango(w.desde, w.hasta), String(w.n), F.kg(w.mediana, 2),
            w.tendenciaKg != null ? `${F.kg(w.tendenciaKg, 2)} <span class="muted">${F.corta(w.fechaTendencia)}</span>` : '—']), { caption: 'Pesajes del periodo por semana' }) +
          '<p class="muted inf-nota">Periodo largo: los pesajes se resumen por semana. Cada pesaje está en Evolución física.</p>');
    }
  } else fisHtml.push(vacio('No hay pesajes en este periodo.'));
  if (fis.fases.length) fisHtml.push(`<p>Fase de nutrición: ${fis.fases.map(f => `${esc(FASE[f.tipo] || f.tipo)} (${F.dia(f.inicio)} – ${f.fin ? F.dia(f.fin) : 'sin cierre registrado'})`).join('; ')}.</p>`);
  fisHtml.push('<h4 class="sub-h">Contornos</h4>');
  fisHtml.push(fis.contornos.length
    ? tabla(['Contorno', 'Primera medida', 'Última medida', 'Cambio'], fis.contornos.map(c => [esc(c.nombre),
        `${num(c.inicio.cm, 'cm')} <span class="muted">${F.dia(c.inicio.fecha)}</span>`,
        c.fin.fecha !== c.inicio.fecha ? `${num(c.fin.cm, 'cm')} <span class="muted">${F.dia(c.fin.fecha)}</span>` : '<span class="muted">una sola medida</span>',
        c.cambioCm != null ? signo(c.cambioCm, 'cm') : '—']), { caption: 'Contornos medidos dentro del periodo' })
    : vacio('No hay contornos medidos en este periodo.'));
  if (fis.composicion.length){
    fisHtml.push('<h4 class="sub-h">Composición corporal (estimación)</h4>');
    fisHtml.push(tabla(['Fecha', '% graso estimado', 'Masa grasa', 'Masa magra', 'Método'], fis.composicion.map(m => [F.dia(m.fecha),
      `${F.num(m.porcentajePct, 1)} %`, F.kg(m.grasaKg), F.kg(m.magraKg), esc(METODO[m.metodo] || m.metodo || '—')]), { caption: 'Estimaciones de composición del periodo' }));
  }
  if (fis.fotos.total) fisHtml.push(`<p>Fotos registradas en el periodo: ${fis.fotos.total}${fis.fotos.sinImagen ? ` (${fis.fotos.sinImagen} sin imagen importada)` : ''}.${fotos.length ? '' : ' No se incluyen en el informe salvo que las elijas.'}</p>`);
  fisHtml.push(`<p class="muted inf-nota">Los contornos son la primera y la última medida tomadas dentro del periodo, con sus fechas reales; no se usan medidas de fuera. El peso tendencia es el que calcula la app para suavizar las variaciones diarias. La composición es una estimación: un cambio de masa magra no equivale a músculo ganado o perdido.</p>`);
  if (fotos.length){
    fisHtml.push(`<h4 class="sub-h">Fotos elegidas</h4><div class="inf-fotos-doc">${fotos.map(f => `<figure><div class="marco" data-inf-foto="${esc(f.archivo)}"><span class="hueco">Cargando…</span></div>
      <figcaption>${esc(POSE[f.pose] || f.pose)} · ${F.dia(f.fecha)}${f.pesoKg != null ? ` · ${F.kg(f.pesoKg)}` : ''}</figcaption></figure>`).join('')}</div>`);
  }
  out.push(tarjeta('Evolución física', fisHtml.join(''), 'infFisica'));

  // --- Volumen realizado ---
  out.push(tarjeta('Volumen realizado', `${v.grupos.length
      ? tabla(['Grupo muscular', 'Series por semana completa (media)', 'Series en semanas parciales (total)'], v.grupos.map(g => [esc(g.grupo), num(g.media), num(g.parcial)]), { caption: 'Series realizadas por grupo muscular' })
      : vacio('No hay series asignables a grupos musculares en este periodo.')}
    ${v.sinGrupo.length ? `<p>Sin grupo muscular reconocido: ${esc(v.sinGrupo.join(', '))}.</p>` : ''}
    <p class="muted inf-nota">Mismo reparto que la app: cada serie suma entera a su grupo principal y media a los grupos que también trabaja; los ejercicios no realizados no suman. Las semanas parciales se dan en total, sin proyectarlas a una semana.</p>`, 'infVolumen'));

  // --- Recuperación ---
  const muestra = (s, unidad) => s.n ? `${num(s.mediana, unidad, 0)} <span class="muted">· ${F.plural(s.n, 'día', 'días')}</span>` : '—';
  out.push(tarjeta('Recuperación', rec.registrados || rec.vfc.n || rec.fc.n
    ? `${tabla(['Dato', 'Mediana del periodo'], [
        ['Estado para entrenar (0–100)', muestra(rec.estado, '')],
        ['Días con el estado bajo', rec.registrados ? `${rec.bajos} de ${rec.registrados}` : '—'],
        ['VFC nocturna', muestra(rec.vfc, 'ms')],
        ['FC en reposo', muestra(rec.fc, 'lpm')],
      ], { caption: 'Recuperación registrada en el periodo' })}
      <p class="muted inf-nota">Solo días con medición válida; los huecos no cuentan como cero. Describe tu estado; no es una valoración médica.</p>`
    : vacio('No hay datos de recuperación en este periodo.'), 'infRecuperacion'));

  // --- Cambios relevantes ---
  out.push(tarjeta('Cambios relevantes', R.cambios.length
    ? `<ul class="inf-lista">${R.cambios.map(c => `<li><span class="inf-fecha">${c.indice != null ? `<button type="button" class="enlace" data-sesion="${c.indice}">${F.dia(c.fecha)}</button>` : F.dia(c.fecha)}</span> ${esc(c.texto)}</li>`).join('')}</ul>`
    : vacio('No hay cambios de rutina, descargas, marcas ni otros cambios registrados en este periodo.'), 'infCambios'));

  // --- Aspectos que revisar ---
  out.push(tarjeta('Aspectos que revisar', R.revisar.length
    ? `<ul class="inf-lista">${R.revisar.map(x => `<li>${esc(x.texto)} <button type="button" class="btn sec btn-enlace no-print" data-ir="${esc(x.destino)}">Ver detalle</button></li>`).join('')}</ul>
       <p class="muted inf-nota">Son señales de tus propios registros para mirarlas con calma, no recomendaciones de entrenamiento ni médicas.</p>`
    : vacio('Nada destacable en los registros de este periodo.'), 'infRevisar'));

  // --- Limitaciones ---
  out.push(tarjeta('Datos insuficientes y limitaciones', `<ul class="lista-plana">${R.limitaciones.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`, 'infLimitaciones'));

  out.push(`<p class="muted inf-pie">Preparado con TrueLift Escritorio a partir de tu copia de seguridad. Todo el cálculo se hizo en tu navegador.</p>`);
  return `<article class="informe-doc" aria-labelledby="informeTitulo">${out.join('')}</article>`;
}

function seccion(M, ctx){
  const sel = ctx.sel || Informe.defecto(M);
  let R = null, error = ctx.error || null;
  if (!sel.mes && sel.tipo === 'mes') error = error || 'Tu copia no tiene registros fechados todavía.';
  else {
    try { R = Informe.generar(M, sel, { fisica: ctx.fisica, galeria: ctx.galeria }); }
    catch (e) { error = error || e.message; }
  }
  const elegibles = R ? Informe.fotosElegibles(ctx.galeria, R.periodo) : [];
  const elegidas = ctx.st.conFotos ? elegibles.filter(f => ctx.st.fotos.has(f.archivo)) : [];
  // Tras un error se conserva lo tecleado; el informe sigue siendo el último válido.
  return `<div class="cabecera-seccion no-print"><h1>Informes</h1>
      <p class="muted">Un resumen de un mes o de las fechas que elijas, para leerlo en pantalla, imprimirlo o guardarlo en PDF.</p></div>
    ${opciones(M, ctx.st.borrador || sel, error, elegibles, ctx.st, !!R)}
    ${R ? documento(M, R, { inst: ctx.inst, fotos: elegidas }) : ''}`;
}

return { seccion, documento, opciones };
})();
