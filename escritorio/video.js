'use strict';
/* ================================================================
   TrueLift Escritorio — video.js
   Vídeo de progreso: las fotos de una pose, en orden de fecha, cada una
   apareciendo sobre la anterior con un fundido. Espejo de la app
   (lib/medidas/video_progreso.dart y screens/pintor_foto_progreso.dart):
   mismos tiempos, mismos límites, misma curva del fundido, mismo encuadre
   (AjusteFoto.coeficientes) y la misma marca TRUELIFT con la T del logo.

   Se dibuja en un <canvas> y se graba con canvas.captureStream(30) +
   MediaRecorder: MP4 si el navegador lo admite y, si no, WebM. Se graba
   mientras se reproduce, así que exportar tarda lo mismo que dura el vídeo.
   Sin peticiones externas ni librerías.

   Igualar luz queda fuera: el escritorio aún no tiene la igualación.

   La parte pura (plan, momento, límites) no toca el DOM y se prueba en Node.
   ================================================================ */

const VideoTL = {

  FPS: 30,
  FOTO: { normal: 1.5, min: 0.4, max: 4 },
  TRANSICION: { normal: 1.0, min: 0.2, max: 2 },
  PASO: 0.1,
  DURACION_MAX: 60,
  TOPE_FOTOS: 60,
  BITS: 2500000,

  /* La foto es siempre un recuadro 3:4 a todo el ancho; en 9:16 se añaden
     dos bandas, arriba y abajo. */
  FORMATOS: {
    vertical: { clave: '3x4', ancho: 720, alto: 960, banda: 0, texto: 'Vertical (3:4)' },
    historia: { clave: '9x16', ancho: 720, alto: 1280, banda: 160, texto: 'Historias (9:16)' },
  },

  /* ---------- plan ---------- */

  paso(v){ return Math.round(v * 10) / 10; },
  acotar(v, t){
    if (typeof v !== 'number' || !Number.isFinite(v)) return t.normal;
    return this.paso(Math.max(t.min, Math.min(t.max, v)));
  },
  fotogramas(s){ return Math.max(1, Math.round(s * this.FPS)); },

  /* Fotos ordenadas por fecha y, a igual fecha, por archivo. */
  ordenar(fotos){
    return [...fotos].sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.archivo < b.archivo ? -1 : a.archivo > b.archivo ? 1 : 0);
  },

  /* Plan del vídeo: fotos de UNA pose (lanza si se mezclan), tiempos
     acotados y fotogramas exactos: n·h + (n−1)·t. */
  plan({ fotos = [], segundosFoto, segundosTransicion, rotulos = true, formato = 'vertical' } = {}){
    if (new Set(fotos.map(f => f.pose)).size > 1) throw new Error('Un vídeo de progreso es de una sola pose');
    const h = this.acotar(segundosFoto, this.FOTO), t = this.acotar(segundosTransicion, this.TRANSICION);
    const ordenadas = this.ordenar(fotos);
    const n = ordenadas.length, fh = this.fotogramas(h), ft = this.fotogramas(t);
    const total = n ? n * fh + (n - 1) * ft : 0;
    return {
      fotos: ordenadas, n, segundosFoto: h, segundosTransicion: t, fh, ft,
      fotogramas: total, duracion: total / this.FPS, rotulos: !!rotulos,
      formato: this.FORMATOS[formato] ? formato : 'vertical',
      cabe: n > 0 && n <= this.maximoFotos(h, t),
    };
  },

  /* ⌊(D + t) / (h + t)⌋ en fotogramas, con el tope fijo. */
  maximoFotos(h, t){
    const fh = this.fotogramas(this.acotar(h, this.FOTO)), ft = this.fotogramas(this.acotar(t, this.TRANSICION));
    return Math.min(this.TOPE_FOTOS, Math.floor((this.DURACION_MAX * this.FPS + ft) / (fh + ft)));
  },

  /* Curva suave del fundido (la misma que la app). */
  suavizar(x){
    const v = Math.max(0, Math.min(1, x));
    return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  },

  /* Qué se pinta en el fotograma i: { foto, siguiente, mezcla }. */
  momento(plan, i){
    const { n, fh, ft } = plan;
    if (n <= 1 || i <= 0) return { foto: 0, siguiente: null, mezcla: 0 };
    const ciclo = fh + ft, k = Math.floor(i / ciclo);
    if (k >= n - 1) return { foto: n - 1, siguiente: null, mezcla: 0 };
    const dentro = i - k * ciclo;
    if (dentro < fh) return { foto: k, siguiente: null, mezcla: 0 };
    return { foto: k, siguiente: k + 1, mezcla: this.suavizar((dentro - fh + 1) / (ft + 1)) };
  },
  momentoEn(plan, s){
    return this.momento(plan, Math.max(0, Math.min(plan.fotogramas - 1, Math.floor(s * this.FPS))));
  },

  /* Tiempos que hacen caber n fotos, lo más parecidos a los actuales
     (misma proporción, a pasos de una décima). Null si no hay forma. */
  tiemposQueCaben(n, h0, t0){
    if (n <= 0 || n > this.TOPE_FOTOS) return null;
    let h = this.acotar(h0, this.FOTO), t = this.acotar(t0, this.TRANSICION);
    if (n <= this.maximoFotos(h, t)) return { foto: h, transicion: t };
    const factor = this.DURACION_MAX / (n * h + (n - 1) * t);
    const abajo = v => Math.floor(v * 10 + 1e-9) / 10;
    h = abajo(Math.max(this.FOTO.min, h * factor));
    t = abajo(Math.max(this.TRANSICION.min, t * factor));
    while (n > this.maximoFotos(h, t)){
      const mh = h - this.FOTO.min, mt = t - this.TRANSICION.min;
      if (mh < 1e-9 && mt < 1e-9) return null;
      if (mh >= mt) h = this.paso(h - this.PASO); else t = this.paso(t - this.PASO);
    }
    return { foto: h, transicion: t };
  },

  /* Una por mes natural: la más cercana al día de la primera foto; en el
     último mes, la más reciente. */
  unaPorMes(fotos){
    const orden = this.ordenar(fotos);
    if (orden.length <= 1) return orden;
    const dia = +orden[0].fecha.slice(8, 10);
    const meses = new Map();
    for (const f of orden){
      const m = f.fecha.slice(0, 7);
      if (!meses.has(m)) meses.set(m, []);
      meses.get(m).push(f);
    }
    const claves = [...meses.keys()];
    return claves.map(m => {
      const fs = meses.get(m);
      if (m === claves.at(-1)) return fs.at(-1);
      return fs.reduce((mejor, f) => Math.abs(+f.fecha.slice(8, 10) - dia) < Math.abs(+mejor.fecha.slice(8, 10) - dia) ? f : mejor);
    });
  },

  /* Rótulo de la foto i: fecha y «3/8 · 76,1 kg · −2,1 kg» (cambio desde la
     primera con peso). */
  rotulo(plan, i){
    const f = plan.fotos[i];
    const num = v => v.toFixed(1).replace('.', ',');
    const partes = [`${i + 1}/${plan.n}`];
    if (typeof f.pesoKg === 'number'){
      partes.push(`${num(f.pesoKg)} kg`);
      const base = plan.fotos.slice(0, i).find(x => typeof x.pesoKg === 'number');
      if (base){
        const d = f.pesoKg - base.pesoKg;
        partes.push(`${d >= 0 ? '+' : '−'}${num(Math.abs(d))} kg`);
      }
    }
    const [y, m, d] = f.fecha.split('-');
    return { fecha: `${d}/${m}/${y}`, detalle: partes.join(' · ') };
  },

  /* «29 s» o «1 min 29 s»; y «0:29» para el contador. */
  duracionTexto(s){
    const r = Math.round(s);
    if (r < 60) return `${r} s`;
    return r % 60 ? `${Math.floor(r / 60)} min ${r % 60} s` : `${Math.floor(r / 60)} min`;
  },
  reloj(s){
    const r = Math.floor(s);
    return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
  },

  /* Formato de grabación: MP4 si el navegador lo graba; si no, WebM. */
  tipoGrabacion(admite){
    for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']){
      try { if (admite(t)) return t; } catch (_) { /* navegador sin el método */ }
    }
    return null;
  },
  nombreArchivo(hoy, tipo){
    return `truelift_progreso_${hoy}.${String(tipo).startsWith('video/mp4') ? 'mp4' : 'webm'}`;
  },

  /* ---------- geometría (espejo de AjusteFoto y BoxFit.cover) ---------- */

  /* Coeficientes de ctx.transform(a, b, c, d, e, f) para un recuadro de
     ancho × alto: espejo, escala y giro alrededor del centro y, después, el
     desplazamiento en fracción del recuadro. */
  matriz(ajuste, ancho, alto){
    if (!ajuste) return [1, 0, 0, 1, 0, 0];
    const m = ajuste.espejo ? -1 : 1, cos = Math.cos(ajuste.giro), sin = Math.sin(ajuste.giro);
    const a = ajuste.escala * m * cos, b = ajuste.escala * m * sin;
    const c = -ajuste.escala * sin, d = ajuste.escala * cos;
    const cx = ancho / 2, cy = alto / 2;
    return [a, b, c, d, cx + ajuste.dx * ancho - (a * cx + c * cy), cy + ajuste.dy * alto - (b * cx + d * cy)];
  },
  /* Parte de la imagen que llena el recuadro con «cover» centrado. */
  recorteCover(iw, ih, w, h){
    const e = Math.max(w / iw, h / ih), sw = w / e, sh = h / e;
    return { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh };
  },

  /* ---------- pintado (canvas) ---------- */

  LIMA: '#A3E020', CLARO: '#F4F6F4', CLARO2: '#C9CFC9', FONDO: '#0A0C0B',
  /* Trazos de la T del icono (los mismos que el SVG de la cabecera). */
  T: {
    brazos: ['M28 32H44A2 2 0 0 1 46 34V42A2 2 0 0 1 44 44H32.2A2.8 2.8 0 0 1 29.7 42.5L26.2 35.5A2.4 2.4 0 0 1 28 32Z',
      'M80 32H64A2 2 0 0 0 62 34V42A2 2 0 0 0 64 44H75.8A2.8 2.8 0 0 0 78.3 42.5L81.8 35.5A2.4 2.4 0 0 0 80 32Z'],
    pie: 'M50 32H58A2 2 0 0 1 60 34V71.2A3 3 0 0 1 59.1 73.3L56.4 75.6A2 2 0 0 1 55.1 76H50A2 2 0 0 1 48 74V34A2 2 0 0 1 50 32Z',
    x0: 26.2, y0: 32, ancho: 55.6, alto: 44,
  },

  /* Logotipo TRUELIFT con la T del icono como primera letra: Archivo 900,
     T a la altura de las mayúsculas sobre la línea base, «RUE» en claro y
     «LIFT» en lima. (x, base) = inicio y línea base. Devuelve el ancho. */
  medirMarca(ctx, tam){
    ctx.save();
    ctx.font = `900 ${tam}px Archivo, system-ui, sans-serif`;
    const rue = ctx.measureText('RUE').width, lift = ctx.measureText('LIFT').width;
    ctx.restore();
    const altoT = tam * 0.72, anchoT = altoT * this.T.ancho / this.T.alto;
    return { tam, altoT, anchoT, hueco: tam * 0.05, rue, lift, ancho: anchoT + tam * 0.05 + rue + lift };
  },
  pintarMarca(ctx, x, base, medida){
    const { tam, altoT, anchoT, hueco, rue } = medida, e = altoT / this.T.alto;
    ctx.save();
    ctx.translate(x - this.T.x0 * e, base - altoT - this.T.y0 * e);
    ctx.scale(e, e);
    ctx.fillStyle = this.LIMA;
    for (const d of this.T.brazos) ctx.fill(new Path2D(d));
    ctx.fillStyle = this.CLARO;
    ctx.fill(new Path2D(this.T.pie));
    ctx.restore();
    ctx.save();
    ctx.font = `900 ${tam}px Archivo, system-ui, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.CLARO;
    ctx.fillText('RUE', x + anchoT + hueco, base);
    ctx.fillStyle = this.LIMA;
    ctx.fillText('LIFT', x + anchoT + hueco + rue, base);
    ctx.restore();
  },

  /* Una foto encuadrada en su recuadro (0, 0, w, h), con opacidad. */
  pintarFoto(ctx, img, ajuste, w, h, opacidad = 1){
    if (opacidad <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.globalAlpha = opacidad;
    if (!img){ ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore(); return; }
    if (ajuste){
      // Con opacidad, fondo e imagen se funden juntos, como un Opacity sobre
      // el widget: se componen aparte y se pegan de una vez.
      if (opacidad < 1 && typeof OffscreenCanvas !== 'undefined'){
        const capa = new OffscreenCanvas(w, h), c = capa.getContext('2d');
        this.pintarFoto(c, img, ajuste, w, h, 1);
        ctx.drawImage(capa, 0, 0);
        ctx.restore(); return;
      }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.transform(...this.matriz(ajuste, w, h));
    }
    const iw = img.width, ih = img.height, r = this.recorteCover(iw, ih, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
    ctx.restore();
  },

  /* El fotograma m a tamaño de salida. imagen(i) da la imagen de la foto i
     (o null mientras carga: hueco negro). */
  pintar(ctx, plan, m, imagen, { titulo = '' } = {}){
    const F = this.FORMATOS[plan.formato], W = F.ancho, H = F.alto, altoFoto = W * 4 / 3;
    const margen = W * 0.045;
    ctx.save();
    ctx.fillStyle = this.FONDO; ctx.fillRect(0, 0, W, H);
    ctx.translate(0, F.banda);
    if (plan.n){
      this.pintarFoto(ctx, imagen(m.foto), plan.fotos[m.foto].ajuste, W, altoFoto);
      if (m.siguiente != null) this.pintarFoto(ctx, imagen(m.siguiente), plan.fotos[m.siguiente].ajuste, W, altoFoto, m.mezcla);
    }
    ctx.restore();

    const marca = this.medirMarca(ctx, W * 0.042);
    let centro;
    if (F.banda){
      centro = F.banda + altoFoto + F.banda / 2;
      ctx.save();
      ctx.font = `800 ${W * 0.05}px "Saira Condensed", Archivo, system-ui, sans-serif`;
      ctx.fillStyle = this.CLARO; ctx.textBaseline = 'middle';
      ctx.fillText(titulo, margen, F.banda / 2, W - 2 * margen);
      ctx.restore();
    } else {
      const alto = altoFoto * 0.22, g = ctx.createLinearGradient(0, altoFoto - alto, 0, altoFoto);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, altoFoto - alto, W, alto);
      centro = altoFoto - margen - marca.tam * 0.36;
    }
    if (plan.rotulos && plan.n){
      const max = W - 3 * margen - marca.ancho;
      const rotulo = (i, op) => {
        if (op <= 0) return;
        const r = this.rotulo(plan, i);
        ctx.save();
        ctx.globalAlpha = op;
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
        ctx.textBaseline = 'alphabetic';
        const t1 = W * 0.040, t2 = W * 0.029, hueco = W * 0.008;
        const arriba = centro - (t1 + hueco + t2) / 2;
        ctx.font = `600 ${t1}px "IBM Plex Mono", monospace`; ctx.fillStyle = this.CLARO;
        ctx.fillText(r.fecha, margen, arriba + t1 * 0.85, max);
        ctx.font = `500 ${t2}px "IBM Plex Mono", monospace`; ctx.fillStyle = this.CLARO2;
        ctx.fillText(r.detalle, margen, arriba + t1 + hueco + t2 * 0.85, max);
        ctx.restore();
      };
      rotulo(m.foto, 1 - m.mezcla);
      if (m.siguiente != null) rotulo(m.siguiente, m.mezcla);
    }
    // Marca fija a la derecha: no entra en el fundido.
    this.pintarMarca(ctx, W - margen - marca.ancho, centro + marca.altoT / 2, marca);
  },

  /* ---------- imágenes ---------- */

  /* Cargador con ventana: solo las fotos que se ven y las dos siguientes.
     leer(archivo) → Blob. */
  cargador(plan, leer){
    const ancho = this.FORMATOS[plan.formato].ancho;
    const listas = new Map(), pedidas = new Map();
    const decodificar = async blob => {
      try { return await createImageBitmap(blob, { resizeWidth: ancho * 2, resizeQuality: 'high' }); }
      catch (_) { return createImageBitmap(blob); }
    };
    const pedir = i => {
      const f = plan.fotos[i];
      if (!f || listas.has(i) || pedidas.has(i)) return pedidas.get(i);
      const p = (async () => {
        const blob = await leer(f.archivo);
        const img = blob ? await decodificar(blob) : null;
        pedidas.delete(i);
        if (img) listas.set(i, img);
        return img;
      })().catch(() => { pedidas.delete(i); return null; });
      pedidas.set(i, p);
      return p;
    };
    return {
      imagen: i => listas.get(i) || null,
      /* Asegura las de alrededor de m y suelta las que ya pasaron. */
      preparar(m){
        const quiero = [m.foto, m.foto + 1, m.foto + 2];
        quiero.forEach(pedir);
        for (const [i, img] of listas) if (i < m.foto){ img.close?.(); listas.delete(i); }
        return Promise.all([pedir(m.foto), m.siguiente != null ? pedir(m.siguiente) : null]);
      },
      cerrar(){ for (const img of listas.values()) img.close?.(); listas.clear(); },
    };
  },

  /* ---------- reproducir y grabar ---------- */

  /* Reproduce el plan en el canvas (desde cero) a tiempo real. Si se pasa
     `grabar`, lo graba con MediaRecorder y resuelve con el Blob. alPaso(s)
     informa del segundo; parar() lo detiene (sin Blob). */
  reproducir(canvas, plan, cargador, { grabar = null, titulo = '', alPaso = null } = {}){
    const ctx = canvas.getContext('2d');
    let parado = false, rec = null, trozos = [];
    const fin = new Promise((resolver, rechazar) => {
      const empezar = async () => {
        await cargador.preparar(this.momento(plan, 0));
        if (grabar){
          const flujo = canvas.captureStream(this.FPS);
          rec = new MediaRecorder(flujo, { mimeType: grabar, videoBitsPerSecond: this.BITS });
          rec.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
          rec.onerror = e => rechazar(e.error || new Error('grabación'));
          rec.onstop = () => resolver(parado ? null : new Blob(trozos, { type: grabar.split(';')[0] }));
          rec.start(1000);
        }
        const t0 = performance.now();
        const cuadro = ahora => {
          if (parado){ if (!rec) resolver(null); return; }
          const s = (ahora - t0) / 1000;
          const m = this.momentoEn(plan, Math.min(s, plan.duracion));
          cargador.preparar(m);
          this.pintar(ctx, plan, m, i => cargador.imagen(i), { titulo });
          alPaso?.(Math.min(s, plan.duracion));
          if (s >= plan.duracion){
            if (rec) rec.stop(); else resolver(true);
            return;
          }
          requestAnimationFrame(cuadro);
        };
        requestAnimationFrame(cuadro);
      };
      empezar().catch(rechazar);
    });
    return {
      fin,
      parar(){
        parado = true;
        if (rec && rec.state !== 'inactive') rec.stop();
      },
    };
  },
};

/* ---------- tarjeta de «Evolución física» (HTML, sin DOM) ---------- */

/* st: { pose, quitadas: Set, h, t, formato, rotulos, grabando, segundo,
   url, nombre, error }. galeria: la de FotosTL.resolver. */
VideoTL.html = function(galeria, st){
  const poses = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };
  const conImagen = galeria.filter(f => f.tieneImagen);
  const pose = poses[st.pose] ? st.pose
    : Object.keys(poses).reduce((m, p) => conImagen.filter(f => f.pose === p).length > conImagen.filter(f => f.pose === m).length ? p : m, 'frente');
  st.pose = pose;
  const dePose = this.ordenar(galeria.filter(f => f.pose === pose));
  const elegidas = dePose.filter(f => f.tieneImagen && !st.quitadas.has(f.archivo));
  const plan = this.plan({ fotos: elegidas, segundosFoto: st.h, segundosTransicion: st.t, rotulos: st.rotulos, formato: st.formato });
  const F = this.FORMATOS[plan.formato];
  const num = v => v.toFixed(1).replace('.', ',');
  const rango = (id, texto, t, valor) =>
    `<div><label for="${id}">${texto} <output for="${id}">${num(valor)} s</output></label><input id="${id}" type="range" min="${t.min}" max="${t.max}" step="${this.PASO}" value="${valor}"${st.grabando ? ' disabled' : ''}></div>`;
  const orden = new Map(plan.fotos.map((f, i) => [f.archivo, i + 1]));
  const filas = dePose.map(f => {
    const n = orden.get(f.archivo);
    const [y, m, d] = f.fecha.split('-');
    const extra = [typeof f.pesoKg === 'number' ? `${num(f.pesoKg)} kg` : '', f.ajuste ? 'encuadrada en la app' : '', f.tieneImagen ? '' : 'imagen no importada'].filter(Boolean).join(' · ');
    return `<li><label><input type="checkbox" data-video-foto="${esc(f.archivo)}"${n ? ' checked' : ''}${f.tieneImagen && !st.grabando ? '' : ' disabled'}>
      <span class="video-num">${n || '–'}</span> ${d}/${m}/${y}${extra ? ` <span class="muted">· ${esc(extra)}</span>` : ''}</label></li>`;
  }).join('');
  const porMes = this.unaPorMes(plan.fotos), rapido = this.tiemposQueCaben(plan.n, plan.segundosFoto, plan.segundosTransicion);
  const limite = plan.n && !plan.cabe ? `<div class="alerta ambar" id="videoLimite"><span>Son demasiadas fotos para un vídeo corto. Quédate con una por mes o pásalas más rápido.</span>
    <div class="fila-botones">${porMes.length < plan.n ? '<button class="btn sec" type="button" data-accion="video-una-por-mes">Una por mes</button>' : ''}${rapido ? '<button class="btn sec" type="button" data-accion="video-mas-rapido">Más rápido</button>' : ''}</div></div>` : '';
  const estado = st.grabando ? `Grabando… ${this.reloj(st.segundo || 0)} de ${this.reloj(plan.duracion)}`
    : st.error ? esc(st.error) : st.url ? 'Vídeo listo.' : '';
  return `<section class="card" id="videoProgreso"><h2>Vídeo de progreso</h2>
    <p class="muted">Tus fotos de una pose, una tras otra, con el encuadre hecho en la app, en un vídeo para guardar o compartir. Se graba mientras se reproduce: tarda lo mismo que dura.</p>
    <div class="video-ajustes">
      <label for="videoPose">Pose<select id="videoPose"${st.grabando ? ' disabled' : ''}>${Object.entries(poses).map(([k, t]) => `<option value="${k}"${k === pose ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label for="videoFormato">Formato<select id="videoFormato"${st.grabando ? ' disabled' : ''}>${Object.entries(this.FORMATOS).map(([k, f]) => `<option value="${k}"${k === plan.formato ? ' selected' : ''}>${f.texto}</option>`).join('')}</select></label>
      <label class="video-check"><input type="checkbox" id="videoRotulos"${st.rotulos ? ' checked' : ''}${st.grabando ? ' disabled' : ''}> Rótulos con fecha y peso</label>
    </div>
    <div class="video-tiempos">${rango('videoFoto', 'Cada foto', this.FOTO, plan.segundosFoto)}${rango('videoTransicion', 'Transición', this.TRANSICION, plan.segundosTransicion)}
      <p class="mono-peq" id="videoDuracion">${plan.n ? `Dura ${this.duracionTexto(plan.duracion)}` : 'Sin fotos con imagen en esta pose.'}</p></div>
    ${limite}
    <div class="video-cuerpo">
      <div class="video-previa"><canvas id="videoLienzo" width="${F.ancho}" height="${F.alto}" aria-label="Vista previa del vídeo"></canvas></div>
      <div class="video-lista"><p class="mono-peq">Fotos · ${plan.n} de ${dePose.length}</p><ul class="lista-plana">${filas}</ul></div>
    </div>
    <div class="fila-botones">
      ${st.grabando ? '<button class="btn sec" type="button" data-accion="video-cancelar">Cancelar</button>'
        : `<button class="btn sec" type="button" data-accion="video-previa"${plan.n ? '' : ' disabled'}>Ver vista previa</button>
           <button class="btn pri" type="button" data-accion="video-grabar"${plan.cabe ? '' : ' disabled'}>Grabar vídeo</button>`}
      ${st.url && !st.grabando ? `<a class="btn pri" id="videoDescargar" href="${st.url}" download="${esc(st.nombre)}">Descargar vídeo</a>` : ''}
      <span id="videoEstado" role="status">${estado}</span>
    </div>
  </section>`;
};
