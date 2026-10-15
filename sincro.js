// Sincronización: tener las mismas canciones y listas en varios aparatos, guardándolas en la cuenta de la
// Comunidad. Acá solo se decide qué mandar y qué traer; los pedidos al servidor están en comunidad.js y el resto
// (cuándo se sincroniza, la pantalla) en app.js.
//
// Cada canción o lista es un renglón con su clave ("c:" o "l:" más su id). El estado que se guarda en el aparato:
// - `hechas`: { clave: huella } de cómo quedó cada cosa la última vez que el aparato y la cuenta coincidieron.
// - `sucias`: { clave: { t, h } } lo cambiado acá y todavía no mandado: cuándo (t, en milisegundos) y su huella
//   (h; vacía si se borró).
// - `desde`: hasta qué hora del servidor ya se trajo lo cambiado en otros aparatos.
// Si una misma cosa cambió acá y en otro aparato, gana la que se guardó último.
const Sincro = (() => {
  // Huella de un texto (53 bits): para saber si algo cambió sin guardar una copia entera.
  const huella = text => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  const de = o => huella(JSON.stringify(o));
  const clave = (tipo, id) => (tipo === 'lista' ? 'l:' : 'c:') + id;
  const tipoDe = k => (k.startsWith('l:') ? 'lista' : 'cancion');
  const nuevo = () => ({ hechas: {}, sucias: {}, desde: '' });

  // Anota lo que cambió en el aparato desde la última vez. `cosas`: Map clave → canción o lista, como están ahora.
  // `ahora`: la hora del cambio (0 al juntar un aparato con una cuenta que ya tiene cosas: lo de la cuenta gana).
  function anotar(st, cosas, ahora) {
    for (const [k, o] of cosas) {
      const h = de(o);
      if (st.hechas[k] === h) delete st.sucias[k];
      else if (!st.sucias[k] || st.sucias[k].h !== h) st.sucias[k] = { t: ahora, h };
    }
    for (const k in st.hechas) {
      if (!cosas.has(k) && (!st.sucias[k] || st.sucias[k].h !== '')) st.sucias[k] = { t: ahora, h: '' };
    }
    for (const k in st.sucias) if (!cosas.has(k) && !(k in st.hechas)) delete st.sucias[k];
  }

  // Lo que hay que mandar: renglones para el servidor, primero las canciones (así una lista nunca llega antes que
  // sus canciones). Cada uno lleva su huella (`h`) para `enviadas`.
  function pendientes(st, cosas) {
    const out = [];
    for (const [k, s] of Object.entries(st.sucias)) {
      const o = cosas.get(k);
      if (s.h && !o) continue;
      out.push({ tipo: tipoDe(k), id: k.slice(2), datos: s.h ? o : null, borrado: !s.h, cambiado: Math.max(0, Math.floor(s.t)), h: s.h });
    }
    return out.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'cancion' ? -1 : 1));
  }

  // Lo mandado ya quedó en la cuenta. Si mientras viajaba se volvió a cambiar, sigue pendiente.
  function enviadas(st, filas) {
    for (const f of filas) {
      const k = clave(f.tipo, f.id);
      if (st.sucias[k] && st.sucias[k].h === f.h) delete st.sucias[k];
      if (f.h) st.hechas[k] = f.h; else delete st.hechas[k];
    }
  }

  // Lo que llegó de la cuenta → qué cambiar en el aparato: [{ tipo, id, datos }] (datos null: borrarla).
  // `limpiar(tipo, datos)` revisa lo que llega como cualquier cosa de afuera (y siempre arma el resultado en el
  // mismo orden, para poder comparar). Deja `hechas` al día. Si se cambió lo mismo acá y en otro aparato, gana el
  // que se guardó último; si los dos tienen la misma hora (dos aparatos que se juntan), gana la cuenta.
  function aplicar(st, filas, cosas, limpiar) {
    const ops = [];
    for (const f of filas) {
      if (!f || (f.tipo !== 'cancion' && f.tipo !== 'lista') || typeof f.id !== 'string' || !/^[\w-]{1,40}$/.test(f.id)) continue;
      const k = clave(f.tipo, f.id), mia = st.sucias[k];
      if (mia && mia.t > +f.cambiado) continue;
      delete st.sucias[k];
      if (f.borrado || !f.datos || typeof f.datos !== 'object') {
        delete st.hechas[k];
        if (cosas.has(k)) { ops.push({ tipo: f.tipo, id: f.id, datos: null }); cosas.delete(k); }
        continue;
      }
      // Si es lo mismo que ya hay (por ejemplo, lo que este aparato acaba de mandar), queda como está.
      const o = limpiar(f.tipo, { ...f.datos, id: f.id }), h = de(o), cur = cosas.get(k);
      if (cur && de(limpiar(f.tipo, { ...cur })) === h) { st.hechas[k] = de(cur); continue; }
      st.hechas[k] = h;
      ops.push({ tipo: f.tipo, id: f.id, datos: o });
      cosas.set(k, o);
    }
    return ops;
  }

  // La hora más nueva de lo traído (para pedir después solo lo que cambió), o `antes` si no hay nada más nuevo.
  const ms = t => Date.parse(String(t).replace(/(\.\d{3})\d+/, '$1')) || 0;
  const masNueva = (filas, antes) => filas.reduce((m, f) => (f && ms(f.actualizado) > ms(m) ? f.actualizado : m), antes || '');
  // Desde qué hora pedir: un minuto antes de lo último traído, por si algo se guardó en el servidor al mismo
  // tiempo y apareció tarde (traerlo dos veces no cambia nada).
  const pedirDesde = desde => (ms(desde) ? new Date(ms(desde) - 60000).toISOString() : '');

  return { huella, clave, nuevo, anotar, pendientes, enviadas, aplicar, masNueva, pedirDesde };
})();

if (typeof module !== 'undefined') module.exports = Sincro;
