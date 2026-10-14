// Comunidad: habla con el servidor (Supabase) por su API, sin librerías. Acá solo se arma qué pedir y se trae;
// las pantallas están en app.js, y todo lo que llega pasa por cleanSong antes de mostrarse o guardarse.
// Las tablas y las reglas del servidor están en servidor/comunidad.sql.
const Comunidad = (() => {
  // La clave pública está pensada para ir en la app: lo que protege los datos son las reglas del servidor.
  const BASE = 'https://cbiavmaznmbhgfytkwbl.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_CgTYhMa7dyD5XcLxNXY_yw_KnXerWnA';
  const PAGE = 30;
  // Lo que se muestra en los renglones (el cifrado se trae recién al abrir una canción).
  const ROW = 'id,titulo,compositor,ritmo,compas,tonalidad,bajadas,fijada,perfiles(nombre)';
  const FULL = ROW + ',tempo,cifrado,cols';

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

  // Un renglón del servidor → canción con los nombres de la app (sin revisar: eso lo hace cleanSong).
  const toSong = r => ({
    title: r.titulo, composer: r.compositor, style: r.ritmo, key: r.tonalidad, tempo: r.tempo, ts: r.compas,
    chart: r.cifrado, cols: r.cols,
  });
  // Quién la subió y cuántas veces se bajó, para mostrar.
  const byWhom = r => (r.perfiles && r.perfiles.nombre) || 'Airrial';
  const intOr0 = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

  // Pide algo al servidor; si no contesta en 15 s o contesta con error, falla.
  async function ask(path, opts = {}) {
    const ctl = typeof AbortController === 'undefined' ? null : new AbortController();
    const t = ctl && setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(BASE + path, {
        ...opts, signal: ctl && ctl.signal,
        headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
      if (!res.ok) throw new Error('servidor ' + res.status);
      return res.status === 204 ? null : await res.json();
    } finally {
      if (t) clearTimeout(t);
    }
  }
  const list = v => (Array.isArray(v) ? v : []);

  return {
    plano, words, songsQuery, toSong, byWhom, PAGE,
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
    // Suma una bajada. Si falla no importa: la canción ya quedó guardada.
    bajar: id => ask('rpc/bajar', { method: 'POST', body: JSON.stringify({ que: 'cancion', cual: Math.floor(+id) }) }).catch(() => {}),
  };
})();

if (typeof module !== 'undefined') module.exports = Comunidad;
