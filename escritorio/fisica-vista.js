'use strict';
/* HTML del comparador; no escribe imágenes ni historial. */
const FisicaVista = (() => {
  const poses = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };
  const signo = (n, unidad) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n), 1)} ${unidad}`;
  const rango = (id, texto, min, max, paso, valor, atributo = '') =>
    `<label for="${id}">${esc(texto)} <output for="${id}">${valor}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${paso}" value="${valor}" ${atributo}>`;

  function contexto(foto, modelo, raw){
    if (!foto) return '';
    const F = VistasEsc.F, fase = Evolucion.faseEn(raw, foto.fecha);
    return `<p class="foto-contexto"><b>${esc(poses[foto.pose])} · ${F.dia(foto.fecha)}</b><br>
      Peso guardado en la ficha: ${F.kg(foto.pesoKg)}<br>
      Fase de nutrición: ${fase ? esc(fase.texto) : 'sin datos históricos suficientes'}
      ${foto.fuente === 'nombre' ? '<br>Fecha y pose deducidas del nombre; sin índice.' : ''}
      ${foto.fueraDeCopia ? '<br>No figura en la copia JSON actual.' : ''}
      ${foto.discrepancia ? '<br>Ficha corregida del JSON; difiere del índice del ZIP.' : ''}</p>`;
  }

  function asociaciones(a, b, modelo){
    const F = VistasEsc.F;
    const deltas = new Map(Evolucion.compararContornos(modelo, a.fecha, b.fecha).map(d => [d.sitio, d]));
    const registro = r => r.registro ? `${F.num(r.registro.cm)} cm<br><span class="muted">${F.dia(r.registro.fecha)}${r.dias ? ` · ${r.dias} días antes` : ' · mismo día'}</span>` : `—<br><span class="muted">${esc(r.motivo)}</span>`;
    if (!modelo.sitios.length) return '<p class="muted">No hay contornos registrados para asociar a estas fotos.</p>';
    const filas = modelo.sitios.map(s => {
      const A = Evolucion.vigenteEn(modelo, a.fecha, s), B = Evolucion.vigenteEn(modelo, b.fecha, s);
      const d = deltas.get(s);
      const motivo = b.fecha <= a.fecha ? 'Sin cambio cronológico (B debe ser posterior a A)' : A.registro && B.registro && A.registro.fecha === B.registro.fecha ? 'Misma medida en ambas fotos; sin evolución calculable' : 'Sin dos medidas utilizables';
      return [esc(VistasEsc.SITIOS[s]), registro(A), registro(B), d ? signo(d.deltaCm, 'cm') : esc(motivo)];
    });
    return VistasEsc.tabla(['Contorno', `A · foto del ${F.dia(a.fecha)}`, `B · foto del ${F.dia(b.fecha)}`, 'Cambio B − A'], filas, { caption: 'Contornos asociados a las fotos y fechas reales de las medidas' });
  }

  function comparador(galeria, modelo, raw, st){
    const par = Evolucion.emparejar(galeria, st);
    st.pose = par.pose; st.a = par.a?.archivo || null; st.b = par.b?.archivo || null;
    const F = VistasEsc.F;
    const selector = (k, f) => `<label for="compFoto${k}">Foto ${k}<select id="compFoto${k}"><option value="">Selecciona una foto</option>${par.pool.map(x => `<option value="${esc(x.archivo)}"${x.archivo === f?.archivo ? ' selected' : ''}>${F.dia(x.fecha)} · ${esc(x.archivo)}${x.tieneImagen ? '' : ' · imagen no importada'}</option>`).join('')}</select></label>`;
    const mensaje = !par.a || !par.b ? 'Hacen falta dos fotos de la misma pose para comparar.' : par.a.archivo === par.b.archivo ? 'Selecciona dos fotos diferentes.' : !par.valida ? 'Falta una imagen seleccionada. Importa el ZIP de fotos para compararla; sus metadatos se conservan.' : null;
    const modo = ['lado', 'cortina', 'superposicion'].includes(st.modo) ? st.modo : 'lado';
    const botones = [['lado', 'Lado a lado'], ['cortina', 'Cortina'], ['superposicion', 'Superposición']].map(([k, txt]) => `<button type="button" data-modo-foto="${k}" aria-pressed="${modo === k}" class="btn ${modo === k ? 'pri' : 'sec'}">${txt}</button>`).join('');
    const marco = (k, f) => `<div class="comparador-marco foto-${k}" data-original="${esc(f.archivo)}" data-lado="${k}"><span class="hueco" role="status">Cargando foto ${k.toUpperCase()}…</span></div>`;
    const ajuste = (k, f) => {
      const enc = Evolucion.encuadre(st.encuadres[f.archivo]);
      return `<fieldset class="encuadre"><legend>Encuadre ${k.toUpperCase()} · ${F.dia(f.fecha)}</legend>
        ${rango(`enc-${k}-zoom`, 'Ampliación uniforme', 1, 3, 0.05, enc.zoom, `data-enc="zoom" data-archivo="${esc(f.archivo)}"`)}
        ${rango(`enc-${k}-x`, 'Posición horizontal (%)', -50, 50, 1, enc.x, `data-enc="x" data-archivo="${esc(f.archivo)}"`)}
        ${rango(`enc-${k}-y`, 'Posición vertical (%)', -50, 50, 1, enc.y, `data-enc="y" data-archivo="${esc(f.archivo)}"`)}
        <button class="btn sec" type="button" data-restaurar-foto="${esc(f.archivo)}">Restablecer ${k.toUpperCase()}</button></fieldset>`;
    };
    const deltaPeso = par.a && par.b && par.b.fecha > par.a.fecha && par.a.pesoKg != null && par.b.pesoKg != null ? ` · Peso guardado B − A: ${signo(par.b.pesoKg - par.a.pesoKg, 'kg')}` : '';
    return `<section class="card" id="comparadorFotos"><h3>Comparar fotos</h3>
      <div class="foto-selectores"><label for="compPose">Pose<select id="compPose">${Object.entries(poses).map(([k, txt]) => `<option value="${k}"${k === par.pose ? ' selected' : ''}>${txt}</option>`).join('')}</select></label>${selector('A', par.a)}${selector('B', par.b)}</div>
      ${mensaje ? `<p class="muted" role="status">${mensaje}</p>` : `<div class="fila-botones" aria-label="Modo de comparación">${botones}</div>
      <div class="comparador-etiquetas"><span>A · ${F.dia(par.a.fecha)}</span><span>B · ${F.dia(par.b.fecha)}</span></div>
      <div class="comparador-lienzo modo-${modo}" style="--corte:${st.corte}%;--opacidad:${st.opacidad / 100}">${marco('a', par.a)}${marco('b', par.b)}</div>
      <div class="comparador-control"${modo === 'lado' ? ' hidden' : ''}>${modo === 'cortina' ? rango('fotoCorte', 'Posición de la cortina (%)', 0, 100, 1, st.corte) : rango('fotoOpacidad', 'Opacidad de B (%)', 0, 100, 1, st.opacidad)}</div>
      <p class="mono-peq">${Math.abs(Evolucion.dias(par.a.fecha, par.b.fecha))} días entre fotos${deltaPeso}</p>
      <details class="detalle" id="ajustesFotos"><summary>Ajustar encuadre</summary><p class="muted">Ampliación y posición para alinear referencias. Escala uniforme, sin deformar el cuerpo ni modificar los originales. La cortina y la opacidad solo cambian la visualización.</p>
        <div class="encuadres">${ajuste('a', par.a)}${ajuste('b', par.b)}</div><div class="fila-botones"><button class="btn sec" type="button" data-accion="guardar-encuadres">Guardar encuadres en este navegador</button><span id="estadoEncuadres" role="status">${st.dirty ? 'Ajustes sin guardar' : 'Encuadres guardados o de origen'}</span></div></details>`}
      ${par.a && par.b ? `<div class="comparador-contextos">${contexto(par.a, modelo, raw)}${contexto(par.b, modelo, raw)}</div>${asociaciones(par.a, par.b, modelo)}` : ''}
      <details class="detalle ayuda"><summary>Cómo comparar con fiabilidad</summary><p class="muted">Mantén pose, distancia, luz y condiciones similares. El encuadre no corrige diferencias de perspectiva, postura o iluminación. Los contornos usan el propio día o la última medida anterior dentro de 30 días; se muestra su fecha real. Un mismo registro en ambas fotos no demuestra cambio. Los pesos son los guardados por la app en cada ficha (pueden proceder de un pesaje cercano o del perfil); no se reconstruyen a partir del peso actual. La fase se muestra solo si su intervalo histórico es inequívoco; no prueba qué causó los cambios.</p></details>
    </section>`;
  }
  return { comparador, contexto, asociaciones };
})();
