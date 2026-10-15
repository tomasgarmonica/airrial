// Comunidad: habla con el servidor (Supabase) por su API, sin librerías. Acá solo se arma qué pedir y se trae;
// las pantallas están en app.js, y todo lo que llega pasa por cleanSong antes de mostrarse o guardarse.
// Las tablas y las reglas del servidor están en servidor/comunidad.sql.
const Comunidad = (() => {
  // La clave pública está pensada para ir en la app: lo que protege los datos son las reglas del servidor.
  const ROOT = 'https://cbiavmaznmbhgfytkwbl.supabase.co/';
  const BASE = ROOT + 'rest/v1/', AUTH = ROOT + 'auth/v1/';
  const KEY = 'sb_publishable_CgTYhMa7dyD5XcLxNXY_yw_KnXerWnA';
  const PAGE = 30;
  // Lo que se muestra en los renglones (el cifrado se trae recién al abrir una canción).
  const ROW = 'id,titulo,compositor,ritmo,compas,tonalidad,bajadas,fijada,perfiles(nombre)';
  const FULL = ROW + ',tempo,cifrado,cols';
  // Lo mismo para las listas: el renglón y, al abrirla, sus canciones.
  const LIST_ROW = 'id,nombre,cantidad,bajadas,fijada,perfiles(nombre)';
  const LIST_FULL = LIST_ROW + ',canciones';

  // Igual que public.plano en el servidor: minúsculas y sin acentos, para buscar.
  const plano = t => String(t == null ? '' : t).toLowerCase().replace(/[áéíóúàèìòùäëïöüâêîôûãõñç]/g, ch =>
    'aeiouaeiouaeiouaeiouaonc'['áéíóúàèìòùäëïöüâêîôûãõñç'.indexOf(ch)]);
  // Palabras de lo escrito en el buscador: cada una tiene que aparecer en el título o el autor, en cualquier orden.
  const words = text => plano(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 6).map(w => w.slice(0, 40));

  // Dirección de la búsqueda de canciones. `o`: { texto, ritmo, artista, orden: 'bajadas' | 'nuevas', pagina }.
  function songsQuery(o = {}) {
    const q = ['select=' + ROW];
    for (const w of words(o.texto)) q.push('busqueda=like.' + encodeURIComponent('*' + w + '*'));
    if (o.ritmo) q.push('ritmo=eq.' + encodeURIComponent(o.ritmo));
    if (o.artista) q.push('artista=eq.' + encodeURIComponent(o.artista));
    q.push('order=' + (o.orden === 'nuevas' ? 'id.desc' : 'fijada.desc,bajadas.desc,id.desc'));
    q.push('limit=' + (PAGE + 1), 'offset=' + PAGE * (Math.max(0, Math.floor(+o.pagina || 0))));
    return 'canciones?' + q.join('&');
  }
  // Lo mismo para las listas, que se buscan solo por nombre.
  function listsQuery(o = {}) {
    const q = ['select=' + LIST_ROW];
    for (const w of words(o.texto)) q.push('busqueda=like.' + encodeURIComponent('*' + w + '*'));
    q.push('order=' + (o.orden === 'nuevas' ? 'id.desc' : 'fijada.desc,bajadas.desc,id.desc'));
    q.push('limit=' + (PAGE + 1), 'offset=' + PAGE * (Math.max(0, Math.floor(+o.pagina || 0))));
    return 'listas?' + q.join('&');
  }

  // Un renglón del servidor → canción con los nombres de la app (sin revisar: eso lo hace cleanSong).
  const toSong = r => ({
    title: r.titulo, composer: r.compositor, style: r.ritmo, key: r.tonalidad, tempo: r.tempo, ts: r.compas,
    chart: r.cifrado, cols: r.cols,
  });
  // Al revés: una canción de la app → lo que se sube. No viajan etiquetas, teclado ni volúmenes (son de cada uno).
  const fromSong = s => ({
    titulo: String(s.title).trim(), compositor: String(s.composer || '').trim(), ritmo: s.style, compas: s.ts,
    tonalidad: s.key || '', tempo: s.tempo, cifrado: s.chart, cols: s.cols,
  });
  // Por qué no se puede subir una canción ('' si se puede).
  const check = s => {
    if (!/[A-G]/.test(String(s.chart).replace(/"[^"]*"/g, ''))) return 'La canción no tiene acordes.';
    return '';
  };
  // Quién la subió y cuántas veces se bajó, para mostrar.
  const byWhom = r => (r.perfiles && r.perfiles.nombre) || 'Airrial';
  const intOr0 = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

  // Pide algo al servidor; si no contesta en 15 s o contesta con error, falla. El error lleva `status` (0 si no
  // hubo conexión) y el mensaje del servidor en `said`.
  async function ask(url, opts = {}) {
    const ctl = typeof AbortController === 'undefined' ? null : new AbortController();
    const t = ctl && setTimeout(() => ctl.abort(), 15000);
    let res;
    try {
      res = await fetch(url.startsWith('http') ? url : BASE + url, {
        ...opts, signal: ctl && ctl.signal,
        headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
    } catch (e) {
      throw Object.assign(new Error('sin conexión'), { status: 0 });
    } finally {
      if (t) clearTimeout(t);
    }
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch { /* sin detalle */ }
      const said = String((body && (body.message || body.msg || body.error_description)) || '');
      throw Object.assign(new Error('servidor ' + res.status + ' ' + said), { status: res.status, said });
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const list = v => (Array.isArray(v) ? v : []);

  // --- cuenta ---
  // Se entra con un código que llega por mail. La sesión queda guardada en el teléfono (sin contraseña): un
  // permiso que dura una hora y otro para renovarlo.
  const SESSION = 'airrial.cuenta.v1';
  const disk = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
  let session = null;
  try { session = JSON.parse(disk().getItem(SESSION)); } catch { /* sin sesión */ }
  if (!session || typeof session.access !== 'string' || typeof session.id !== 'string') session = null;
  const keep = s => {
    session = s;
    try { if (s) disk().setItem(SESSION, JSON.stringify(s)); else disk().removeItem(SESSION); } catch { /* sin lugar */ }
  };
  const fromAuth = d => {
    if (!d || typeof d.access_token !== 'string' || typeof d.refresh_token !== 'string' || !d.user || typeof d.user.id !== 'string') {
      throw Object.assign(new Error('respuesta rara'), { status: 500 });
    }
    return { access: d.access_token, refresh: d.refresh_token, until: Date.now() + (intOr0(d.expires_in) || 3600) * 1000,
      id: d.user.id, email: String(d.user.email || '') };
  };
  // Permiso vigente (lo renueva si le falta menos de un minuto), o null si no hay cuenta o se venció del todo.
  let renewing = null;
  async function token() {
    if (!session) return null;
    if (session.until - Date.now() > 60000) return session.access;
    if (!renewing) {
      const s = session;
      renewing = ask(AUTH + 'token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh }) })
        .then(d => { if (session === s) keep(fromAuth(d)); })
        .catch(e => { if (e.status >= 400 && e.status < 500 && session === s) keep(null); else throw e; })
        .finally(() => { renewing = null; });
    }
    await renewing;
    return session && session.access;
  }
  // La cuenta de este teléfono; sin cuenta, falla como un pedido no autorizado.
  const me = () => { if (!session) throw Object.assign(new Error('sin cuenta'), { status: 401 }); return session.id; };
  // Pedido con la cuenta.
  async function mine(url, opts = {}) {
    const t = await token();
    if (!t) throw Object.assign(new Error('sin cuenta'), { status: 401 });
    return ask(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  }

  return {
    plano, words, songsQuery, listsQuery, toSong, fromSong, check, byWhom, PAGE,
    // { filas, mas }: una página de canciones y si hay más.
    buscar: async o => {
      const rows = list(await ask(songsQuery(o))).filter(r => r && Number.isFinite(r.id));
      return { filas: rows.slice(0, PAGE), mas: rows.length > PAGE };
    },
    // [{ ritmo, cantidad }] y [{ compositor, clave, cantidad }]
    ritmos: async () => list(await ask('ritmos?select=ritmo,cantidad&order=cantidad.desc'))
      .filter(r => r && typeof r.ritmo === 'string').map(r => ({ ritmo: r.ritmo, cantidad: intOr0(r.cantidad) })),
    artistas: async () => list(await ask('artistas?select=compositor,clave,cantidad&order=clave&limit=2000'))
      .filter(r => r && typeof r.clave === 'string' && r.clave).map(r => ({ compositor: String(r.compositor), clave: r.clave, cantidad: intOr0(r.cantidad) })),
    // Una canción entera, o null si no está (o la escondieron).
    cancion: async id => (/^\d{1,15}$/.test(id) ? list(await ask('canciones?select=' + FULL + '&id=eq.' + id))[0] || null : null),
    buscarListas: async o => {
      const rows = list(await ask(listsQuery(o))).filter(r => r && Number.isFinite(r.id));
      return { filas: rows.slice(0, PAGE), mas: rows.length > PAGE };
    },
    // Una lista entera (sus canciones vienen como filas: título, autor, estilo, tono, tempo, compás, cifrado, renglón).
    lista: async id => (/^\d{1,15}$/.test(id) ? list(await ask('listas?select=' + LIST_FULL + '&id=eq.' + id))[0] || null : null),
    // Suma una bajada (`que`: 'cancion' o 'lista'). Si falla no importa: ya quedó guardada.
    bajar: (id, que) => ask('rpc/bajar', { method: 'POST', body: JSON.stringify({ que: que === 'lista' ? 'lista' : 'cancion', cual: Math.floor(+id) }) }).catch(() => {}),

    // La cuenta con la que se entró en este teléfono ({ id, email }) o null.
    cuenta: () => (session ? { id: session.id, email: session.email } : null),
    pedirCodigo: email => ask(AUTH + 'otp', { method: 'POST', body: JSON.stringify({ email: String(email).trim(), create_user: true }) }),
    entrar: async (email, code) => {
      keep(fromAuth(await ask(AUTH + 'verify', { method: 'POST',
        body: JSON.stringify({ type: 'email', email: String(email).trim(), token: String(code).replace(/\D/g, '') }) })));
    },
    salir: () => {
      const t = session && session.access;
      keep(null);
      if (t) ask(AUTH + 'logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {});
    },
    // Denuncia una canción o una lista. Si ya la había denunciado esta cuenta, falla con status 409.
    denunciar: (que, cual, motivo, detalle) => mine('denuncias', { method: 'POST',
      body: JSON.stringify({ que: que === 'lista' ? 'lista' : 'cancion', cual: Math.floor(+cual), motivo, detalle: String(detalle || '').trim().slice(0, 500) }) }),
    // Borra la cuenta entera (mail, nombre y lo subido) y sale.
    borrarCuenta: async () => { await mine('rpc/borrar_cuenta', { method: 'POST', body: '{}' }); keep(null); },
    // El nombre para mostrar de esta cuenta ('' si todavía no eligió uno).
    miNombre: async () => {
      const r = list(await mine('perfiles?select=nombre&id=eq.' + me()))[0];
      return r && typeof r.nombre === 'string' ? r.nombre : '';
    },
    ponerNombre: (nombre, nuevo) => (nuevo
      ? mine('perfiles', { method: 'POST', body: JSON.stringify({ id: me(), nombre }) })
      : mine('perfiles?id=eq.' + me(), { method: 'PATCH', body: JSON.stringify({ nombre }) })),
    // Lo que subió esta cuenta, con el cifrado (para saber si una canción ya está subida).
    mias: async () => list(await mine('canciones?select=' + FULL + ',oculta&autor=eq.' + me() + '&order=id.desc&limit=1000'))
      .filter(r => r && Number.isFinite(r.id)),
    // Sube una canción y devuelve su número en la Comunidad.
    subir: async s => {
      const r = list(await mine('canciones', { method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...fromSong(s), autor: me() }) }))[0];
      if (!r || !Number.isFinite(r.id)) throw Object.assign(new Error('respuesta rara'), { status: 500 });
      return r.id;
    },
    // Reemplaza una canción ya subida por otra versión.
    actualizar: (id, s) => mine('canciones?id=eq.' + Math.floor(+id), { method: 'PATCH', body: JSON.stringify(fromSong(s)) }),
    borrar: id => mine('canciones?id=eq.' + Math.floor(+id), { method: 'DELETE' }),
    // Listas de esta cuenta. `l`: { nombre, canciones: [filas] }.
    misListas: async () => list(await mine('listas?select=' + LIST_FULL + ',oculta&autor=eq.' + me() + '&order=id.desc&limit=1000'))
      .filter(r => r && Number.isFinite(r.id)),
    subirLista: async l => {
      const r = list(await mine('listas', { method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ nombre: String(l.nombre).trim(), canciones: l.canciones, autor: me() }) }))[0];
      if (!r || !Number.isFinite(r.id)) throw Object.assign(new Error('respuesta rara'), { status: 500 });
      return r.id;
    },
    actualizarLista: (id, l) => mine('listas?id=eq.' + Math.floor(+id), { method: 'PATCH', body: JSON.stringify({ nombre: String(l.nombre).trim(), canciones: l.canciones }) }),
    borrarLista: id => mine('listas?id=eq.' + Math.floor(+id), { method: 'DELETE' }),
  };
})();

if (typeof module !== 'undefined') module.exports = Comunidad;
