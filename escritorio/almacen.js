'use strict';
/* ================================================================
   TrueLift Escritorio — almacen.js
   Persistencia local en IndexedDB (base 'truelift-escritorio').

   - Escrituras ATÓMICAS: cada importación es una lista de operaciones
     que se aplica en una sola transacción. Si algo falla (cuota llena,
     disco, pestaña cerrada) la transacción se aborta y no queda nada a
     medias: el estado anterior sigue intacto.
   - Las imágenes se guardan como Blob, nunca como base64.
   - Migraciones por versión en onupgradeneeded: nunca se borra un
     almacén con datos al subir de versión.
   - Si IndexedDB no está disponible, MODO TEMPORAL en memoria; la
     interfaz lo dice expresamente (nada sobrevive al cerrar).
   - No toca localStorage: la cartera del Coach ('tlcoach_clientes')
     queda intacta.
   ================================================================ */

const Almacen = {

  NOMBRE: 'truelift-escritorio',
  VERSION: 1,
  ALMACENES: ['meta', 'espacios', 'instantaneas', 'fotos', 'imagenes', 'miniaturas', 'importaciones', 'borradores'],

  db: null,
  modo: null,              // 'persistente' | 'temporal'
  motivoTemporal: null,
  _mem: null,              // modo temporal: Map(almacén → Map(clave → valor))
  _falloSimulado: null,    // solo pruebas: nombre del error a provocar en la próxima escritura
  alCambiarVersion: null,  // callback si otra pestaña abre una versión más nueva

  // ---------- apertura y migraciones ----------

  async abrir(){
    if (typeof indexedDB === 'undefined'){
      return this._temporal('Este navegador no permite guardar datos de forma local.');
    }
    try {
      this.db = await new Promise((ok, ko) => {
        const req = indexedDB.open(this.NOMBRE, this.VERSION);
        req.onupgradeneeded = ev => this._migrar(req.result, ev.oldVersion, req.transaction);
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ko(req.error);
        req.onblocked = () => ko(new Error('Hay otra pestaña del escritorio abierta con una versión anterior. Ciérrala y vuelve a cargar.'));
      });
      this.db.onversionchange = () => {
        this.db.close();
        this.db = null;
        if (this.alCambiarVersion) this.alCambiarVersion();
      };
      this.modo = 'persistente';
      return { modo: this.modo };
    } catch (e) {
      return this._temporal(`No se pudo abrir el almacenamiento local (${e && e.message ? e.message : e}).`);
    }
  },

  _temporal(motivo){
    this.modo = 'temporal';
    this.motivoTemporal = motivo;
    this._mem = new Map(this.ALMACENES.map(n => [n, new Map()]));
    return { modo: this.modo, motivo };
  },

  /* Cada versión añade lo suyo; nunca se elimina un almacén con datos. */
  _migrar(db, desde){
    if (desde < 1){
      db.createObjectStore('meta', { keyPath: 'clave' });
      db.createObjectStore('espacios', { keyPath: 'id' });
      const inst = db.createObjectStore('instantaneas', { keyPath: 'id' });
      inst.createIndex('espacioId', 'espacioId');
      db.createObjectStore('fotos', { keyPath: ['espacioId', 'archivo'] });
      db.createObjectStore('imagenes', { keyPath: ['espacioId', 'archivo'] });
      db.createObjectStore('miniaturas', { keyPath: ['espacioId', 'archivo'] });
      const imp = db.createObjectStore('importaciones', { keyPath: 'id', autoIncrement: true });
      imp.createIndex('espacioId', 'espacioId');
      const bor = db.createObjectStore('borradores', { keyPath: 'id' });
      bor.createIndex('espacioId', 'espacioId');
    }
    // if (desde < 2) { … futuras migraciones … }
  },

  // ---------- lectura ----------

  _clave(almacen, valor){
    const kp = { fotos: ['espacioId','archivo'], imagenes: ['espacioId','archivo'],
                 miniaturas: ['espacioId','archivo'], meta: 'clave' }[almacen] || 'id';
    return Array.isArray(kp) ? JSON.stringify(kp.map(k => valor[k])) : valor[kp];
  },
  _claveMem(clave){ return Array.isArray(clave) ? JSON.stringify(clave) : clave; },

  async leer(almacen, clave){
    if (this.modo === 'temporal') return this._mem.get(almacen).get(this._claveMem(clave)) ?? null;
    return new Promise((ok, ko) => {
      const r = this.db.transaction(almacen).objectStore(almacen).get(clave);
      r.onsuccess = () => ok(r.result ?? null);
      r.onerror = () => ko(r.error);
    });
  },

  /* Todos los registros de un almacén; con `espacioId` filtra por espacio
     (rango de clave compuesta o índice). */
  async todos(almacen, espacioId = null){
    if (this.modo === 'temporal'){
      const v = [...this._mem.get(almacen).values()];
      return espacioId == null ? v : v.filter(x => x.espacioId === espacioId);
    }
    return new Promise((ok, ko) => {
      const st = this.db.transaction(almacen).objectStore(almacen);
      let r;
      if (espacioId == null) r = st.getAll();
      else if (Array.isArray(st.keyPath)) r = st.getAll(IDBKeyRange.bound([espacioId], [espacioId, []]));
      else r = st.index('espacioId').getAll(espacioId);
      r.onsuccess = () => ok(r.result || []);
      r.onerror = () => ko(r.error);
    });
  },

  // ---------- escritura atómica ----------

  /* ops: [{ almacen, put: valor } | { almacen, del: clave } |
           { almacen, delEspacio: espacioId }]
     Todo o nada. Rechaza con el error de la transacción (p. ej.
     QuotaExceededError) y entonces no se ha guardado nada. */
  async escribir(ops){
    const simulado = this._falloSimulado;
    this._falloSimulado = null;
    if (this.modo === 'temporal'){
      if (simulado) throw this._errorSimulado(simulado);
      // Se aplica sobre copias y se sustituye al final: también atómico.
      const copia = new Map([...this._mem].map(([n, m]) => [n, new Map(m)]));
      for (const op of ops){
        const m = copia.get(op.almacen);
        if ('put' in op){
          const v = op.almacen === 'importaciones' && op.put.id == null
            ? { ...op.put, id: (m.size ? Math.max(...[...m.values()].map(x => x.id)) : 0) + 1 } : op.put;
          m.set(this._clave(op.almacen, v), v);
        } else if ('del' in op) m.delete(this._claveMem(op.del));
        else if ('delEspacio' in op){
          for (const [k, v] of m) if (v.espacioId === op.delEspacio) m.delete(k);
        }
      }
      this._mem = copia;
      return;
    }
    const nombres = [...new Set(ops.map(o => o.almacen))];
    if (!nombres.length) return;
    await new Promise((ok, ko) => {
      let tx;
      try { tx = this.db.transaction(nombres, 'readwrite', { durability: 'strict' }); }
      catch (e) { ko(e); return; }
      tx.oncomplete = () => ok();
      tx.onabort = () => ko(tx.error || this._errorSimulado(simulado || 'AbortError'));
      tx.onerror = ev => { ev.preventDefault(); };
      try {
        for (const op of ops){
          const st = tx.objectStore(op.almacen);
          if ('put' in op) st.put(op.put);
          else if ('del' in op) st.delete(op.del);
          else if ('delEspacio' in op){
            if (Array.isArray(st.keyPath)) st.delete(IDBKeyRange.bound([op.delEspacio], [op.delEspacio, []]));
            else {
              const c = st.index('espacioId').openKeyCursor(IDBKeyRange.only(op.delEspacio));
              c.onsuccess = () => { const cur = c.result; if (cur){ st.delete(cur.primaryKey); cur.continue(); } };
            }
          }
        }
        // Prueba de fallo a mitad de escritura: las operaciones ya
        // emitidas deben deshacerse.
        if (simulado) tx.abort();
      } catch (e) {
        try { tx.abort(); } catch (_) { /* ya abortada */ }
        ko(e);
      }
    });
  },

  _errorSimulado(nombre){
    try { return new DOMException('Fallo simulado de escritura', nombre); }
    catch (_) { const e = new Error('Fallo simulado de escritura'); e.name = nombre; return e; }
  },

  /* Solo para pruebas automáticas: la próxima escritura falla con este
     error después de emitir sus operaciones. */
  simularFalloEscritura(nombre = 'QuotaExceededError'){ this._falloSimulado = nombre; },

  esErrorCuota(e){
    return !!e && (e.name === 'QuotaExceededError' ||
      (e.inner && e.inner.name === 'QuotaExceededError') || /quota/i.test(String(e.message || '')));
  },

  // ---------- cuota y persistencia ----------

  async estimacion(){
    try {
      if (navigator.storage && navigator.storage.estimate){
        const { usage = null, quota = null } = await navigator.storage.estimate();
        return { uso: usage, cuota: quota, libre: (quota != null && usage != null) ? Math.max(0, quota - usage) : null };
      }
    } catch (_) { /* sin API */ }
    return { uso: null, cuota: null, libre: null };
  },

  /* ¿Caben `bytes` con margen? null si el navegador no lo dice. */
  async cabe(bytes){
    const e = await this.estimacion();
    if (e.libre == null) return null;
    return bytes * 1.2 + 5 * 1024 * 1024 <= e.libre;
  },

  async persistido(){
    try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; }
    catch (_) { return null; }
  },
  async pedirPersistencia(){
    try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : null; }
    catch (_) { return null; }
  },

  // ---------- borrado ----------

  opsBorrarEspacio(espacioId){
    return [
      ...['instantaneas', 'fotos', 'imagenes', 'miniaturas', 'importaciones', 'borradores']
        .map(a => ({ almacen: a, delEspacio: espacioId })),
      { almacen: 'espacios', del: espacioId },
    ];
  },

  async borrarTodo(){
    if (this.modo === 'temporal'){ this._temporal(this.motivoTemporal); return; }
    if (this.db){ this.db.close(); this.db = null; }
    await new Promise((ok, ko) => {
      const r = indexedDB.deleteDatabase(this.NOMBRE);
      r.onsuccess = () => ok();
      r.onerror = () => ko(r.error);
      r.onblocked = () => ko(new Error('Cierra las demás pestañas del escritorio y vuelve a intentarlo.'));
    });
  },
};
