'use strict';
/* ================================================================
   TrueLift Escritorio — video.js
   Vídeo de progreso: las fotos de una pose, en orden de fecha, cada una
   apareciendo sobre la anterior con un fundido. Espejo de la app
   (lib/medidas/video_progreso.dart, medidas/analisis_foto.dart,
   medidas/zona_censura.dart y screens/pintor_foto_progreso.dart): mismos
   tiempos, mismos límites, misma curva del fundido, mismo encuadre
   (AjusteFoto.coeficientes), la misma igualación de luz, las mismas zonas
   pixeladas, la misma banda sonora con el drop en la última foto y la
   misma marca TRUELIFT con la T del logo.

   Se dibuja en un <canvas> a 1080 de ancho y se graba con
   canvas.captureStream(30) + MediaRecorder (con la pista de la música
   mezclada por Web Audio): MP4 si el navegador lo admite y, si no, WebM.
   Se graba mientras se reproduce, así que exportar tarda lo mismo que dura
   el vídeo. Sin peticiones externas ni librerías.

   La parte pura (plan, momento, límites, música, luz, zonas) no toca el
   DOM y se prueba en Node.
   ================================================================ */

const VideoTL = {

  FPS: 30,
  FOTO: { normal: 1.5, min: 0.4, max: 4 },
  TRANSICION: { normal: 1.0, min: 0.2, max: 2 },
  PASO: 0.1,
  DURACION_MAX: 60,
  TOPE_FOTOS: 60,
  /* Como la app a 1080: los fundidos son lo que peor comprime. */
  BITS: 9000000,
  BITS_AUDIO: 192000,

  /* La foto es siempre un recuadro 3:4 a todo el ancho; en 9:16 se añaden
     dos bandas, arriba y abajo. Tamaño de salida de la app (1080 de ancho);
     el pintado es proporcional al ancho. */
  FORMATOS: {
    vertical: { clave: '3x4', ancho: 1080, alto: 1440, banda: 0, texto: 'Vertical (3:4)' },
    historia: { clave: '9x16', ancho: 1080, alto: 1920, banda: 240, texto: 'Historias (9:16)' },
  },

  /* Banda sonora de TrueLift (BsoTrueLift en la app): 122 BPM en 4/4,
     empieza en un primer tiempo y el drop cae al empezar el compás 8; tras
     él suenan 4 compases, el último con fundido de salida. Si se cambia la
     pista hay que volver a medir. La .webm (Opus) es la misma pista para
     navegadores que no decodifican AAC. */
  BSO: {
    segundosCompas: 4 * 60 / 122,
    compasesHastaDrop: 8,
    compasesTrasDrop: 4,
    compasesMinimos: 3,
    archivos: ['sonidos/bso_truelift.m4a', 'sonidos/bso_truelift.webm'],
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
     acotados y fotogramas exactos: n·h + (n−1)·t, más lo que se alargan la
     primera y la última foto para la música. */
  plan({ fotos = [], segundosFoto, segundosTransicion, rotulos = true, formato = 'vertical',
         musica = false, igualarLuz = true, grises = false } = {}){
    if (new Set(fotos.map(f => f.pose)).size > 1) throw new Error('Un vídeo de progreso es de una sola pose');
    const h = this.acotar(segundosFoto, this.FOTO), t = this.acotar(segundosTransicion, this.TRANSICION);
    const ordenadas = this.ordenar(fotos);
    const n = ordenadas.length, fh = this.fotogramas(h), ft = this.fotogramas(t);
    const B = this.BSO, compas = B.segundosCompas;
    const conMusica = !!musica && this.encajeMusica(n, h, t) === 'cabe';
    // Fotograma en el que la última foto termina de aparecer, sin música.
    const llegada = n ? (n - 1) * (fh + ft) : 0;
    let extraInicio = 0, extraFinal = 0, inicioMusica = 0;
    if (conMusica){
      const drop = Math.round(this.compasesAntesDelDrop(n, fh, ft) * compas * this.FPS);
      extraInicio = Math.max(0, drop - llegada);
      extraFinal = Math.max(0, Math.round(B.compasesTrasDrop * compas * this.FPS) - fh);
      inicioMusica = Math.max(0, B.compasesHastaDrop * compas - (llegada + extraInicio) / this.FPS);
    }
    const total = n ? n * fh + (n - 1) * ft + extraInicio + extraFinal : 0;
    return {
      fotos: ordenadas, n, segundosFoto: h, segundosTransicion: t, fh, ft,
      fotogramas: total, duracion: total / this.FPS, rotulos: !!rotulos,
      formato: this.FORMATOS[formato] ? formato : 'vertical',
      igualarLuz: !!igualarLuz, grises: !!grises,
      musica: !!musica, conMusica, extraInicio, extraFinal, inicioMusica,
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
    i -= plan.extraInicio || 0;
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

  /* ---------- banda sonora ---------- */

  /* Compases enteros de música antes del drop: los que hagan falta para
     llegar a la última foto, hacia arriba (lo que sobra se lo queda la
     primera foto). */
  compasesAntesDelDrop(n, fh, ft){
    if (n < 2) return 0;
    const s = (n - 1) * (fh + ft) / this.FPS;
    return Math.ceil(s / this.BSO.segundosCompas - 1e-9);
  },

  /* ¿Cabe la música con n fotos y estos tiempos? 'cabe', 'corto' (no da
     tiempo a la subida) o 'largo' (la última foto llega después del drop). */
  encajeMusica(n, h, t){
    const c = this.compasesAntesDelDrop(n, this.fotogramas(this.acotar(h, this.FOTO)), this.fotogramas(this.acotar(t, this.TRANSICION)));
    if (c < this.BSO.compasesMinimos) return 'corto';
    if (c > this.BSO.compasesHastaDrop) return 'largo';
    return 'cabe';
  },

  /* Tiempos lo más parecidos a los actuales con los que cabe la música:
     los dos en la misma proporción, a pasos de una décima y dentro de sus
     topes. Null si no hay forma. */
  tiemposParaMusica(n, h0, t0){
    if (n < 2) return null;
    let h = this.acotar(h0, this.FOTO), t = this.acotar(t0, this.TRANSICION);
    if (this.encajeMusica(n, h, t) === 'cabe') return { foto: h, transicion: t };
    // Se apunta al centro del margen: un retoque pequeño después no la deja
    // fuera.
    const B = this.BSO;
    const objetivo = (B.compasesMinimos + B.compasesHastaDrop) / 2 * B.segundosCompas;
    const factor = objetivo / ((n - 1) * (h + t));
    h = this.acotar(h * factor, this.FOTO);
    t = this.acotar(t * factor, this.TRANSICION);
    for (let i = 0; i < 100; i++){
      const e = this.encajeMusica(n, h, t);
      if (e === 'cabe') return { foto: h, transicion: t };
      const d = e === 'corto' ? this.PASO : -this.PASO;
      const h2 = this.acotar(h + d, this.FOTO), t2 = this.acotar(t + d, this.TRANSICION);
      if (h2 === h && t2 === t) return null;
      h = h2; t = t2;
    }
    return null;
  },

  /* Decodifica la pista (la primera que el navegador sepa leer). leer(url)
     → ArrayBuffer; decodificar(ArrayBuffer) → AudioBuffer. Null si ninguna. */
  async cargarMusica(leer, decodificar){
    for (const url of this.BSO.archivos){
      try {
        const datos = await leer(url);
        if (datos) return await decodificar(datos);
      } catch (_) { /* la siguiente */ }
    }
    return null;
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

  /* Formato de grabación: MP4 si el navegador lo graba; si no, WebM. Con
     música, con su códec de audio. */
  tipoGrabacion(admite, conAudio = false){
    const tipos = conAudio
      ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const t of tipos){
      try { if (admite(t)) return t; } catch (_) { /* navegador sin el método */ }
    }
    return null;
  },
  nombreArchivo(hoy, tipo){
    return `truelift_progreso_${hoy}.${String(tipo).startsWith('video/mp4') ? 'mp4' : 'webm'}`;
  },

  /* ---------- luz (espejo de analisis_foto.dart) ---------- */

  LUZ: {
    version: 1, region: 0.7, percentilBajo: 0.02, percentilAlto: 0.98, ancho: 96,
    gananciaMin: 0.6, gananciaMax: 1.8, desplazamientoMax: 60, balanceMin: 0.8, balanceMax: 1.25, recorridoMin: 16,
  },
  IDENTIDAD: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  GRISES: [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0],

  /* Niveles y color de la región central de una imagen RGBA (como
     estadisticosRgba; la nitidez no hace falta para igualar). */
  estadisticos(rgba, ancho, alto){
    if (!(ancho > 0) || !(alto > 0) || rgba.length < ancho * alto * 4) throw new Error('Imagen RGBA vacía o incompleta');
    const mx = Math.floor(ancho * (1 - this.LUZ.region) / 2), my = Math.floor(alto * (1 - this.LUZ.region) / 2);
    const histo = new Array(256).fill(0);
    let sr = 0, sg = 0, sb = 0, sl = 0, n = 0;
    for (let y = my; y < alto - my; y++){
      for (let x = mx; x < ancho - mx; x++){
        const i = (y * ancho + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sr += r; sg += g; sb += b; sl += l; n++;
        histo[Math.max(0, Math.min(255, Math.round(l)))]++;
      }
    }
    const percentil = p => {
      let acc = 0;
      for (let v = 0; v < 256; v++){ acc += histo[v]; if (acc >= p * n && acc > 0) return v; }
      return 255;
    };
    return { r: sr / n, g: sg / n, b: sb / n, luz: sl / n,
             bajo: percentil(this.LUZ.percentilBajo), alto: percentil(this.LUZ.percentilAlto) };
  },

  /* Matriz 5×4 que lleva obj hacia ref: niveles y balance de blancos, con
     topes. Null si no hay nada honesto que hacer. */
  matrizIgualacion(ref, obj){
    const L = this.LUZ, ac = (v, a, b) => Math.max(a, Math.min(b, v));
    const rRef = ref.alto - ref.bajo, rObj = obj.alto - obj.bajo;
    if (rRef < L.recorridoMin || rObj < L.recorridoMin) return null;
    const ganancia = ac(rRef / rObj, L.gananciaMin, L.gananciaMax);
    const desp = ac(ref.bajo - ganancia * obj.bajo, -L.desplazamientoMax, L.desplazamientoMax);
    const balance = (cRef, cObj) => ref.luz < 1 || obj.luz < 1 || cRef < 1 || cObj < 1 ? 1
      : ac((cRef / ref.luz) / (cObj / obj.luz), L.balanceMin, L.balanceMax);
    const kr = balance(ref.r, obj.r), kg = balance(ref.g, obj.g), kb = balance(ref.b, obj.b);
    const m = [kr * ganancia, 0, 0, 0, kr * desp, 0, kg * ganancia, 0, 0, kg * desp,
               0, 0, kb * ganancia, 0, kb * desp, 0, 0, 0, 1, 0];
    return this.esIdentidad(m) ? null : m;
  },
  esIdentidad(m){
    return m.every((v, i) => Math.abs(v - this.IDENTIDAD[i]) <= (i % 5 === 4 ? 0.5 : 1e-3));
  },
  /* Aplicar `primero` y después `despues`. */
  componer(despues, primero){
    const out = new Array(20).fill(0);
    for (let f = 0; f < 4; f++) for (let c = 0; c < 5; c++){
      let v = 0;
      for (let k = 0; k < 4; k++) v += despues[f * 5 + k] * primero[k * 5 + c];
      if (c === 4) v += despues[f * 5 + 4];
      out[f * 5 + c] = v;
    }
    return out;
  },
  /* Filtro de la foto i del plan: con igualar luz, todas a la luz de la
     primera (que va tal cual); con grises, en blanco y negro. Null = tal
     cual. */
  filtro(plan, i){
    const propio = plan.fotos[i]?.analisis, ref = plan.igualarLuz && i > 0 ? plan.fotos[0].analisis : null;
    let m = propio && ref ? this.matrizIgualacion(ref, propio) : null;
    if (plan.grises) m = m ? this.componer(this.GRISES, m) : this.GRISES;
    return m;
  },
  /* Aplica la matriz a los píxeles RGBA, recortando a 0–255 como la GPU. */
  aplicarMatriz(rgba, m){
    for (let i = 0; i < rgba.length; i += 4){
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
      rgba[i] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
      rgba[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
      rgba[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];
    }
    return rgba;
  },

  /* Mide la luz de una foto (Blob) sobre una miniatura. Null si no se
     puede leer. */
  async medirLuz(blob){
    try {
      const bmp = await createImageBitmap(blob, { resizeWidth: this.LUZ.ancho, resizeQuality: 'medium' });
      const c = this.lienzo(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      bmp.close?.();
      return this.estadisticos(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    } catch (_) { return null; }
  },

  /* ---------- zonas pixeladas (espejo de zona_censura.dart) ---------- */

  ZONA: { radioMin: 0.04, radioMax: 0.5, radio: 0.12 },
  /* Centro dentro de la foto y radio dentro de los topes. */
  acotarZona(z){
    const ac = (v, a, b, n) => typeof v !== 'number' || !Number.isFinite(v) ? n : Math.max(a, Math.min(b, v));
    return { cx: ac(z.cx, 0, 1, 0.5), cy: ac(z.cy, 0, 1, 0.5), radio: ac(z.radio, this.ZONA.radioMin, this.ZONA.radioMax, this.ZONA.radio) };
  },
  /* Punto (x, y) del recuadro sin ajustar → dónde cae con el ajuste; y lo
     contrario. */
  aplicar(ajuste, x, y, w, h){
    const [a, b, c, d, e, f] = this.matriz(ajuste, w, h);
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  },
  deshacer(ajuste, x, y, w, h){
    const [a, b, c, d, e, f] = this.matriz(ajuste, w, h), det = a * d - b * c;
    const px = x - e, py = y - f;
    return { x: (d * px - c * py) / det, y: (a * py - b * px) / det };
  },
  /* La zona de una foto con encuadre `de` llevada a otra con encuadre `a`
     para que caiga en el mismo sitio de la pantalla. */
  trasladarZona(z, de, a){
    const p = this.aplicar(de, z.cx * 3, z.cy * 4, 3, 4), q = this.deshacer(a, p.x, p.y, 3, 4);
    return this.acotarZona({ cx: q.x / 3, cy: q.y / 4, radio: z.radio * (de?.escala || 1) / (a?.escala || 1) });
  },
  /* La zona bajo el punto (en la foto sin encuadrar, píxeles de w × h): la
     de encima si se solapan. */
  zonaEn(zonas, x, y, w, h){
    for (let i = zonas.length - 1; i >= 0; i--){
      const z = zonas[i];
      if (Math.hypot(x - z.cx * w, y - z.cy * h) <= z.radio * w) return i;
    }
    return -1;
  },
  /* Bloques del pixelado a lo ancho: pocos, para que no se pueda
     reconstruir lo de debajo. */
  BLOQUES: 20,

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

  LIMA: '#A3E020', CLARO: '#F4F6F4', CLARO2: 'rgba(244,246,244,0.85)', FONDO: '#0A0C0B',
  /* Proporciones del pintor de la app (relativas al ancho). */
  MEDIDAS: { marca: 0.0525, margen: 0.045, margenInferior: 0.09, fecha: 0.052, detalle: 0.036, hueco: 0.010, degradado: 0.32, titulo: 0.05 },
  /* Trazos de la T del icono (los mismos que el SVG de la cabecera). */
  T: {
    brazos: ['M28 32H44A2 2 0 0 1 46 34V42A2 2 0 0 1 44 44H32.2A2.8 2.8 0 0 1 29.7 42.5L26.2 35.5A2.4 2.4 0 0 1 28 32Z',
      'M80 32H64A2 2 0 0 0 62 34V42A2 2 0 0 0 64 44H75.8A2.8 2.8 0 0 0 78.3 42.5L81.8 35.5A2.4 2.4 0 0 0 80 32Z'],
    pie: 'M50 32H58A2 2 0 0 1 60 34V71.2A3 3 0 0 1 59.1 73.3L56.4 75.6A2 2 0 0 1 55.1 76H50A2 2 0 0 1 48 74V34A2 2 0 0 1 50 32Z',
    x0: 26.2, y0: 32, ancho: 55.6, alto: 44,
  },

  lienzo(w, h){
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
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
    return { tam, altoT, anchoT, hueco: tam * 0.05, rue, lift, ancho: anchoT + tam * 0.05 + rue + lift, alto: tam * 1.21 };
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

  /* Versión reducida de la imagen (BLOQUES de ancho) para el pixelado: se
     calcula una vez por imagen y proporción. */
  _mosaicos: typeof WeakMap !== 'undefined' ? new WeakMap() : null,
  mosaico(img, w, h){
    const bw = this.BLOQUES, bh = Math.max(1, Math.round(bw * h / w));
    let porAlto = this._mosaicos.get(img);
    if (!porAlto){ porAlto = new Map(); this._mosaicos.set(img, porAlto); }
    if (!porAlto.has(bh)){
      const c = this.lienzo(bw, bh), g = c.getContext('2d'), r = this.recorteCover(img.width, img.height, w, h);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, bw, bh);
      porAlto.set(bh, c);
    }
    return porAlto.get(bh);
  },
  /* Las zonas pixeladas, en el sistema en que se pintó la foto (antes del
     encuadre, que ya está en el lienzo). */
  pintarZonas(ctx, img, zonas, w, h){
    if (!img || !zonas?.length) return;
    ctx.save();
    ctx.beginPath();
    for (const z of zonas){ ctx.moveTo(z.cx * w + z.radio * w, z.cy * h); ctx.arc(z.cx * w, z.cy * h, z.radio * w, 0, Math.PI * 2); }
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mosaico(img, w, h), 0, 0, w, h);
    ctx.restore();
  },

  /* Una foto encuadrada en su recuadro (0, 0, w, h), con opacidad y zonas
     pixeladas. La imagen ya llega con su filtro de color aplicado. */
  pintarFoto(ctx, img, ajuste, w, h, opacidad = 1, zonas = []){
    if (opacidad <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.globalAlpha = opacidad;
    if (!img){ ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore(); return; }
    // Con opacidad, fondo, imagen y zonas se funden juntos, como un Opacity
    // sobre el widget: se componen aparte y se pegan de una vez.
    if (opacidad < 1 && (ajuste || zonas.length) && typeof OffscreenCanvas !== 'undefined'){
      const capa = new OffscreenCanvas(Math.ceil(w), Math.ceil(h)), c = capa.getContext('2d');
      this.pintarFoto(c, img, ajuste, w, h, 1, zonas);
      ctx.drawImage(capa, 0, 0);
      ctx.restore(); return;
    }
    if (ajuste){
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.transform(...this.matriz(ajuste, w, h));
    }
    const r = this.recorteCover(img.width, img.height, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
    this.pintarZonas(ctx, img, zonas, w, h);
    ctx.restore();
  },

  /* El fotograma m a tamaño de salida. imagen(i) da la imagen de la foto i
     (o null mientras carga: hueco negro); zonas(i), sus zonas pixeladas. */
  pintar(ctx, plan, m, imagen, { titulo = '', zonas = () => [] } = {}){
    const F = this.FORMATOS[plan.formato], W = F.ancho, H = F.alto, altoFoto = W * 4 / 3, M = this.MEDIDAS;
    const margen = W * M.margen, k = W / 720;
    ctx.save();
    ctx.fillStyle = this.FONDO; ctx.fillRect(0, 0, W, H);
    ctx.translate(0, F.banda);
    if (plan.n){
      this.pintarFoto(ctx, imagen(m.foto), plan.fotos[m.foto].ajuste, W, altoFoto, 1, zonas(m.foto) || []);
      if (m.siguiente != null) this.pintarFoto(ctx, imagen(m.siguiente), plan.fotos[m.siguiente].ajuste, W, altoFoto, m.mezcla, zonas(m.siguiente) || []);
    }
    ctx.restore();

    const marca = this.medirMarca(ctx, W * M.marca);
    const t1 = W * M.fecha, t2 = W * M.detalle, hueco = W * M.hueco;
    const l1 = t1 * 1.3, l2 = t2 * 1.3, altoRotulo = plan.rotulos && plan.n ? l1 + hueco + l2 : 0;
    // Textos de abajo: centrados en la banda inferior (9:16) o sobre la
    // foto, subidos a zona segura y con un degradado para leerse (3:4).
    let centro;
    if (F.banda){
      centro = F.banda + altoFoto + F.banda / 2;
      ctx.save();
      ctx.font = `800 ${W * M.titulo}px "Saira Condensed", Archivo, system-ui, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${1.2 * k}px`;
      ctx.fillStyle = this.CLARO; ctx.textBaseline = 'middle';
      ctx.fillText(titulo, margen, F.banda / 2, W - 2 * margen);
      ctx.restore();
    } else {
      const alto = altoFoto * M.degradado, g = ctx.createLinearGradient(0, altoFoto - alto, 0, altoFoto);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, altoFoto - alto, W, alto);
      centro = altoFoto - W * M.margenInferior - Math.max(altoRotulo, marca.alto) / 2;
    }
    if (altoRotulo){
      const max = W - 3 * margen - marca.ancho;
      const rotulo = (i, op) => {
        if (op <= 0) return;
        const r = this.rotulo(plan, i), arriba = centro - altoRotulo / 2;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * k;
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${t1}px "IBM Plex Mono", monospace`; ctx.fillStyle = this.CLARO;
        ctx.fillText(r.fecha, margen, arriba + l1 / 2, max);
        ctx.font = `500 ${t2}px "IBM Plex Mono", monospace`; ctx.fillStyle = this.CLARO2;
        ctx.fillText(r.detalle, margen, arriba + l1 + hueco + l2 / 2, max);
        ctx.restore();
      };
      rotulo(m.foto, 1 - m.mezcla);
      if (m.siguiente != null) rotulo(m.siguiente, m.mezcla);
    }
    // Marca fija a la derecha: no entra en el fundido.
    this.pintarMarca(ctx, W - margen - marca.ancho, centro + marca.altoT / 2, marca);
  },

  /* ---------- imágenes ---------- */

  /* Ancho al que se decodifica: el de salida y, si el encuadre amplía, más
     (hasta el doble), como anchoDecodificacion en la app. */
  anchoDecodificacion(ancho, escala){
    return Math.round(Math.max(ancho, Math.min(ancho * 2, ancho * Math.max(1, escala || 1))));
  },

  /* Cargador con ventana: solo las fotos que se ven y las dos siguientes.
     leer(archivo) → Blob. Cada imagen sale ya con su filtro de color (igualar
     luz, blanco y negro), aplicado una vez al decodificarla. */
  cargador(plan, leer, { ancho = this.FORMATOS[plan.formato].ancho } = {}){
    const listas = new Map(), pedidas = new Map();
    const decodificar = async (blob, f, i) => {
      const resizeWidth = this.anchoDecodificacion(ancho, f.ajuste?.escala);
      let img;
      try { img = await createImageBitmap(blob, { resizeWidth, resizeQuality: 'high' }); }
      catch (_) { img = await createImageBitmap(blob); }
      const m = this.filtro(plan, i);
      if (!m) return img;
      const c = this.lienzo(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      img.close?.();
      const datos = g.getImageData(0, 0, c.width, c.height);
      this.aplicarMatriz(datos.data, m);
      g.putImageData(datos, 0, 0);
      return c;
    };
    const pedir = i => {
      const f = plan.fotos[i];
      if (!f || listas.has(i) || pedidas.has(i)) return pedidas.get(i);
      const p = (async () => {
        const blob = await leer(f.archivo);
        const img = blob ? await decodificar(blob, f, i) : null;
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

  /* Reproduce el plan en el canvas (desde cero) a tiempo real. Con
     `musica` (AudioBuffer) y el plan con música, suena desde inicioMusica y
     su reloj manda (imagen y sonido no se separan). Si se pasa `grabar`, lo
     graba con MediaRecorder (imagen y, si suena, música) y resuelve con el
     Blob. alPaso(s) informa del segundo; parar() lo detiene (sin Blob). */
  reproducir(canvas, plan, cargador, { grabar = null, titulo = '', zonas = () => [], alPaso = null, musica = null } = {}){
    const ctx = canvas.getContext('2d');
    let parado = false, rec = null, audio = null, fuente = null;
    const trozos = [];
    const callar = () => {
      try { fuente?.stop(); } catch (_) { /* ya parada */ }
      audio?.close?.().catch(() => {});
      fuente = null; audio = null;
    };
    const fin = new Promise((resolver, rechazar) => {
      const empezar = async () => {
        await cargador.preparar(this.momento(plan, 0));
        if (parado){ resolver(null); return; }
        let destino = null;
        if (musica && plan.conMusica && typeof AudioContext !== 'undefined'){
          audio = new AudioContext();
          await audio.resume?.();
          fuente = audio.createBufferSource();
          fuente.buffer = musica;
          fuente.connect(audio.destination);
          if (grabar){ destino = audio.createMediaStreamDestination(); fuente.connect(destino); }
        }
        if (grabar){
          const pistas = [...canvas.captureStream(this.FPS).getVideoTracks(), ...(destino ? destino.stream.getAudioTracks() : [])];
          rec = new MediaRecorder(new MediaStream(pistas), { mimeType: grabar, videoBitsPerSecond: this.BITS, ...(destino ? { audioBitsPerSecond: this.BITS_AUDIO } : {}) });
          rec.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
          rec.onerror = e => { callar(); rechazar(e.error || new Error('grabación')); };
          rec.onstop = () => { callar(); resolver(parado ? null : new Blob(trozos, { type: grabar.split(';')[0] })); };
          rec.start(1000);
        }
        // Con música, su reloj; sin ella, el de la página.
        let reloj;
        if (fuente){
          const t0 = audio.currentTime + 0.05;
          fuente.start(t0, plan.inicioMusica);
          reloj = () => Math.max(0, audio.currentTime - t0);
        } else {
          const t0 = performance.now();
          reloj = () => (performance.now() - t0) / 1000;
        }
        const cuadro = () => {
          if (parado){ if (!rec){ callar(); resolver(null); } return; }
          const s = reloj();
          const m = this.momentoEn(plan, Math.min(s, plan.duracion));
          cargador.preparar(m);
          this.pintar(ctx, plan, m, i => cargador.imagen(i), { titulo, zonas });
          alPaso?.(Math.min(s, plan.duracion));
          if (s >= plan.duracion){
            if (rec) rec.stop(); else { callar(); resolver(true); }
            return;
          }
          requestAnimationFrame(cuadro);
        };
        requestAnimationFrame(cuadro);
      };
      empezar().catch(e => { callar(); rechazar(e); });
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

/* st: { pose, quitadas: Set, h, t, formato, rotulos, igualar, grises,
   musica, censura: Map, grabando, segundo, url, nombre, error, aviso }.
   galeria: la de FotosTL.resolver. */
VideoTL.html = function(galeria, st){
  const poses = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };
  const conImagen = galeria.filter(f => f.tieneImagen);
  const pose = poses[st.pose] ? st.pose
    : Object.keys(poses).reduce((m, p) => conImagen.filter(f => f.pose === p).length > conImagen.filter(f => f.pose === m).length ? p : m, 'frente');
  st.pose = pose;
  const dePose = this.ordenar(galeria.filter(f => f.pose === pose));
  const elegidas = dePose.filter(f => f.tieneImagen && !st.quitadas.has(f.archivo));
  const plan = this.plan({ fotos: elegidas, segundosFoto: st.h, segundosTransicion: st.t, rotulos: st.rotulos, formato: st.formato,
                           musica: st.musica, igualarLuz: st.igualar, grises: st.grises });
  const F = this.FORMATOS[plan.formato];
  const bloqueo = st.grabando ? ' disabled' : '';
  const num = v => v.toFixed(1).replace('.', ',');
  const rango = (id, texto, t, valor) =>
    `<div><label for="${id}">${texto} <output for="${id}">${num(valor)} s</output></label><input id="${id}" type="range" min="${t.min}" max="${t.max}" step="${this.PASO}" value="${valor}"${bloqueo}></div>`;
  const casilla = (id, activo, titulo, detalle) =>
    `<label class="video-check"><input type="checkbox" id="${id}"${activo ? ' checked' : ''}${bloqueo}> <span>${titulo}<small class="muted">${detalle}</small></span></label>`;
  const orden = new Map(plan.fotos.map((f, i) => [f.archivo, i + 1]));
  const filas = dePose.map(f => {
    const n = orden.get(f.archivo);
    const [y, m, d] = f.fecha.split('-');
    const pixelada = st.censura?.get(f.archivo)?.length > 0;
    const extra = [typeof f.pesoKg === 'number' ? `${num(f.pesoKg)} kg` : '', f.ajuste ? 'encuadrada' : '', pixelada ? 'pixelada' : '',
                   f.tieneImagen ? '' : 'imagen no importada'].filter(Boolean).join(' · ');
    return `<li><label><input type="checkbox" data-video-foto="${esc(f.archivo)}"${n ? ' checked' : ''}${f.tieneImagen && !st.grabando ? '' : ' disabled'}>
      <span class="video-num">${n || '–'}</span> ${d}/${m}/${y}${extra ? ` <span class="muted">· ${esc(extra)}</span>` : ''}</label>
      ${f.tieneImagen ? `<button class="btn-mini${pixelada ? ' activo' : ''}" type="button" data-video-pixelar="${esc(f.archivo)}" aria-label="Pixelar zonas de la foto del ${d}/${m}/${y}"${bloqueo}>Pixelar</button>` : ''}</li>`;
  }).join('');
  const porMes = this.unaPorMes(plan.fotos), rapido = this.tiemposQueCaben(plan.n, plan.segundosFoto, plan.segundosTransicion);
  const limite = plan.n && !plan.cabe ? `<div class="alerta ambar" id="videoLimite"><span>Son demasiadas fotos para un vídeo corto. Quédate con una por mes o pásalas más rápido.</span>
    <div class="fila-botones">${porMes.length < plan.n ? '<button class="btn sec" type="button" data-accion="video-una-por-mes">Una por mes</button>' : ''}${rapido ? '<button class="btn sec" type="button" data-accion="video-mas-rapido">Más rápido</button>' : ''}</div></div>` : '';
  // Música TrueLift: la casilla si cabe; si no, por qué y «Ajustar».
  const encaje = this.encajeMusica(plan.n, plan.segundosFoto, plan.segundosTransicion);
  const ajustar = encaje === 'cabe' ? null : this.tiemposParaMusica(plan.n, plan.segundosFoto, plan.segundosTransicion);
  const detalleMusica = encaje === 'cabe' ? 'El momento fuerte llega con tu última foto'
    : plan.n < 2 ? 'Añade más fotos para ponerle música'
    : encaje === 'corto' ? 'Para ponerla, el vídeo tiene que durar algo más' : 'Para ponerla, el vídeo tiene que ser más corto';
  const musica = plan.n ? `<div class="video-musica" id="videoMusicaFila">
      ${encaje === 'cabe' ? casilla('videoMusica', st.musica, 'Música TrueLift', detalleMusica)
        : `<span><strong>Música TrueLift</strong><small class="muted" id="videoMusicaDetalle">${detalleMusica}</small></span>
           ${ajustar ? `<button class="btn sec" type="button" data-accion="video-musica-ajustar"${bloqueo}>Ajustar</button>` : ''}`}
    </div>` : '';
  const sinEncuadre = plan.fotos.slice(1).filter(f => !f.ajuste).length;
  const sinImagen = dePose.filter(f => !f.tieneImagen).length;
  const avisos = [
    sinEncuadre ? `<p class="muted video-aviso">${sinEncuadre === 1 ? 'Una foto sin encuadrar' : `${sinEncuadre} fotos sin encuadrar`}: encuádralas en la app y vuelve a importar la copia para que el cuerpo no salte de una a otra.</p>` : '',
    sinImagen ? `<p class="muted video-aviso">${sinImagen === 1 ? 'Una foto sin imagen importada no entra' : `${sinImagen} fotos sin imagen importada no entran`} en el vídeo.</p>` : '',
  ].join('');
  const estado = st.grabando ? `Grabando… ${this.reloj(st.segundo || 0)} de ${this.reloj(plan.duracion)}`
    : st.error ? esc(st.error) : st.url ? `Vídeo listo.${st.aviso ? ` ${esc(st.aviso)}` : ''}` : '';
  return `<section class="card" id="videoProgreso"><h2>Vídeo de progreso</h2>
    <p class="muted">Tus fotos de una pose, una tras otra y con la misma luz, con el encuadre hecho en la app, en un vídeo para guardar o compartir. Se graba mientras se reproduce: tarda lo mismo que dura.</p>
    <div class="video-ajustes">
      <label for="videoPose">Pose<select id="videoPose"${bloqueo}>${Object.entries(poses).map(([k, t]) => `<option value="${k}"${k === pose ? ' selected' : ''}>${t} (${galeria.filter(f => f.pose === k && f.tieneImagen).length})</option>`).join('')}</select></label>
      <label for="videoFormato">Formato<select id="videoFormato"${bloqueo}>${Object.entries(this.FORMATOS).map(([k, f]) => `<option value="${k}"${k === plan.formato ? ' selected' : ''}>${f.texto}</option>`).join('')}</select></label>
    </div>
    <div class="video-opciones">
      ${casilla('videoIgualar', st.igualar, 'Igualar luz', 'Todas con la luz y el color de la primera')}
      ${casilla('videoGrises', st.grises, 'Blanco y negro', 'Sin color, para fijarte en la forma')}
      ${casilla('videoRotulos', st.rotulos, 'Rótulos', 'Fecha y peso de cada foto')}
    </div>
    <div class="video-tiempos">${rango('videoFoto', 'Cada foto', this.FOTO, plan.segundosFoto)}${rango('videoTransicion', 'Transición', this.TRANSICION, plan.segundosTransicion)}
      <p class="mono-peq" id="videoDuracion">${plan.n ? `Dura ${this.duracionTexto(plan.duracion)}` : 'Sin fotos con imagen en esta pose.'}</p></div>
    ${musica}
    ${limite}
    ${avisos}
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

/* Contenido del modal «Pixelar zonas» de una foto. */
VideoTL.htmlPixelar = function(f, varias){
  const [y, m, d] = f.fecha.split('-');
  return `<h2 id="modalTitulo">Pixelar zonas · ${d}/${m}/${y}</h2>
    <p class="muted" style="font-size:13px">Haz clic donde quieras tapar (la cara, una zona íntima…). Arrastra un círculo para moverlo y usa la rueda del ratón o las teclas + y − para cambiar su tamaño. Solo se pixela en el vídeo; la foto original no se modifica.</p>
    <div class="pixelar-marco"><canvas id="pixelarLienzo" width="600" height="800" tabindex="0" aria-label="Foto: haz clic para añadir un círculo pixelado; flechas para moverlo, + y − para su tamaño, Supr para quitarlo"></canvas></div>
    <p class="mono-peq muted" id="pixelarCuenta" role="status"></p>
    <div class="mod-acciones">
      <button class="btn sec" type="button" data-accion="pixelar-quitar" id="pixelarQuitar" disabled>Quitar círculo</button>
      ${varias ? '<button class="btn sec" type="button" data-accion="pixelar-todas">Usar en todas</button>' : ''}
      <button class="btn pri" type="button" data-accion="pixelar-listo" autofocus>Listo</button>
    </div>`;
};
