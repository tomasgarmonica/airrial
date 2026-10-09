(() => {
  'use strict';

  // Sumar 0.01 en cada publicación mientras dure la beta: se muestra en la biblioteca para saber qué versión corre el teléfono.
  const VERSION = '0.32';
  const app = document.getElementById('app');
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STYLES = [
    ['swing', 'Swing'], ['bossa', 'Bossa'], ['samba', 'Samba'], ['pop', 'Pop / Rock'], ['balada', 'Balada'],
    ['tango', 'Tango'], ['milonga', 'Milonga'], ['candombe', 'Candombe'], ['cumbia', 'Cumbia'],
    ['chacarera', 'Chacarera (6/8)'], ['zamba', 'Zamba (6/8)'], ['vals', 'Vals (3/4)'], ['click', 'Solo metrónomo'],
  ];
  // Estilos que necesitan un compás distinto de 4/4.
  const STYLE_METER = { chacarera: '6/8', zamba: '6/8', vals: '3/4' };
  const METERS = ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8'];
  const styleName = id => (STYLES.find(s => s[0] === id) || STYLES[0])[1];

  // --- almacenamiento ---
  const SONGS = 'airrial.songs.v1', SETTINGS = 'airrial.settings.v1', LISTS = 'airrial.lists.v1';
  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };

  let songs = load(SONGS, null);
  const firstRun = !songs;
  if (firstRun) songs = [];
  const settings = Object.assign({ theme: 'dark', choruses: 3, countIn: true }, load(SETTINGS, {}));
  if (typeof settings.choruses !== 'number') settings.choruses = 3;
  settings.hints = settings.hints || {};
  if (!['letras', 'jazz', 'latino', 'grados'].includes(settings.notation)) settings.notation = 'letras';
  // Canciones incluidas ya entregadas a este teléfono: { id: huella del contenido }.
  // Quien venía de una versión anterior ya tuvo los tres ejemplos: no se le vuelven a agregar si los borró.
  if (!settings.builtins) settings.builtins = firstRun ? {} : { 'demo-blues': '', 'demo-bossa': '', 'demo-vals': '' };
  settings.vol = Object.assign({ bass: 0.8, keys: 0.6, drums: 0.7, click: 0 }, settings.vol);
  // Instrumentos silenciados con un toque: el deslizador conserva su volumen para cuando vuelven.
  settings.mute = Object.assign({}, settings.mute);
  const applyVol = k => Engine.setVol(k, settings.mute[k] ? 0 : settings.vol[k]);
  // Modo práctica: cuánto sube el tempo (bpm) y cuánto cambia el tono (semitonos) en cada vuelta. Cero = no cambia.
  settings.practice = Object.assign({ tempo: 0, key: 0 }, settings.practice);
  // Tamaño de la hoja al ver una canción: tope de la letra de los acordes, en píxeles. El alto del compás va por CSS.
  const SHEET_SIZES = { chico: 24, normal: 30, grande: 44 };
  if (!SHEET_SIZES[settings.size]) settings.size = 'normal';
  // Listas de temas: { id, name, songs: [ids en orden] }
  let lists = load(LISTS, []);
  const saveLists = () => store(LISTS, lists);
  const saveSongs = () => store(SONGS, songs);
  const saveSettings = () => store(SETTINGS, settings);
  const findSong = id => songs.find(s => s.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const tsOf = s => (s.ts || '4/4').split('/').map(Number);

  // --- recorrido ---
  // `trail` copia el historial del navegador para que "volver" suba un nivel (canción → lista → biblioteca)
  // en vez de repasar pantallas viejas: así el botón Atrás del teléfono hace lo mismo que la flecha de arriba.
  const here = () => location.hash || '#/';
  let trail = [], swapping = false, jumping = false, guard = null;
  try { trail = JSON.parse(sessionStorage.getItem('airrial.trail')) || []; } catch { /* sin recorrido guardado */ }
  if (trail[trail.length - 1] !== here()) trail = [here()];
  // Reemplaza la pantalla actual sin sumar un paso al historial.
  const swap = hash => {
    if (hash === here()) return;
    swapping = true;
    location.replace(hash);
  };
  // Vuelve a una pantalla anterior; si no está en el recorrido (se entró por un enlace), la pone en lugar de la actual.
  const up = parent => {
    const k = trail.lastIndexOf(parent, trail.length - 2);
    if (k < 0) { swap(parent); return; }
    const steps = k - (trail.length - 1);
    jumping = true;
    trail.length = k + 1;
    history.go(steps);
  };
  function syncTrail() {
    const h = here(), n = trail.length;
    if (jumping) jumping = false;
    else if (swapping) { swapping = false; trail[n - 1] = h; }
    else if (n > 1 && trail[n - 2] === h) trail.pop();
    else if (trail[n - 1] !== h) trail.push(h);
    try { sessionStorage.setItem('airrial.trail', JSON.stringify(trail)); } catch { /* sin espacio */ }
  }

  document.documentElement.dataset.theme = settings.theme;
  for (const k in settings.vol) applyVol(k);
  // Le pide al navegador que no borre las canciones cuando el teléfono se queda sin espacio.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // Compases por renglón de una canción (entre 2 y 6; 4 si no se eligió).
  const colsOf = s => Math.min(6, Math.max(2, Math.round(+s.cols) || 4));
  const cleanSong = s => ({
    id: String(s.id || newId()), title: String(s.title || 'Sin título'), composer: String(s.composer || ''),
    style: STYLES.some(x => x[0] === s.style) ? s.style : 'swing', key: String(s.key || ''),
    tempo: Math.min(360, Math.max(30, +s.tempo || 120)), ts: METERS.includes(s.ts) ? s.ts : '4/4',
    transpose: Math.round(+s.transpose || 0) % 12, chart: String(s.chart || ''),
    cols: colsOf(s),
    ...(s.builtin ? { builtin: true } : {}),
  });

  // Las canciones viajan dentro del enlace que lleva el archivo compartido: una sola, o una lista entera (comprimida).
  const b64 = bytes => {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64 = code => Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
  const pipe = async (bytes, stream) =>
    new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const songRow = s => [s.title, s.composer, s.style, s.key, s.tempo, s.ts, s.chart, colsOf(s)];
  const rowSong = a => cleanSong({ title: a[0], composer: a[1], style: a[2], key: a[3], tempo: a[4], ts: a[5], chart: a[6], cols: a[7] });
  // Formato corto: los datos separados por tabulaciones y comprimidos. Si el navegador no comprime, va el formato viejo.
  const packSong = async s => {
    try {
      const r = songRow(s).map(v => String(v).replace(/\t/g, ' '));
      const flat = ['4', ...r.slice(0, 6), r[7], r[6]].join('\t');
      return 'c.' + b64(await pipe(new TextEncoder().encode(flat), new CompressionStream('deflate-raw')));
    } catch {
      return b64(new TextEncoder().encode(JSON.stringify([1, ...songRow(s)])));
    }
  };
  const packList = async l => {
    const bytes = new TextEncoder().encode(JSON.stringify([2, l.name, l.songs.map(findSong).filter(Boolean).map(songRow)]));
    try { return 'z.' + b64(await pipe(bytes, new CompressionStream('deflate-raw'))); }
    catch { return 'j.' + b64(bytes); }
  };
  // Devuelve { song } o { name, songs }.
  const unpack = async code => {
    if (code.startsWith('c.')) {
      const bytes = await pipe(unb64(code.slice(2)), new DecompressionStream('deflate-raw'));
      const f = new TextDecoder().decode(bytes).split('\t');
      if (f[0] === '3' && f.length >= 8) return { song: rowSong([...f.slice(1, 7), f.slice(7).join('\t')]) };
      if (f[0] === '4' && f.length >= 9) return { song: rowSong([...f.slice(1, 7), f.slice(8).join('\t'), f[7]]) };
      throw new Error('formato');
    }
    const bytes = code.startsWith('z.') ? await pipe(unb64(code.slice(2)), new DecompressionStream('deflate-raw'))
      : unb64(code.startsWith('j.') ? code.slice(2) : code);
    const a = JSON.parse(new TextDecoder().decode(bytes));
    if (a[0] === 1) return { song: rowSong(a.slice(1)) };
    if (a[0] === 2 && Array.isArray(a[2])) return { name: String(a[1] || 'Lista'), songs: a[2].map(rowSong) };
    throw new Error('formato');
  };
  function download(name, data) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Texto de un archivo de Airrial → datos. Acepta la exportación (JSON) y la página .html que se comparte.
  const parseFile = text => {
    const m = /<script[^>]*id="airrial-data"[^>]*>([\s\S]*?)<\/script>/.exec(text);
    return JSON.parse(m ? m[1] : text);
  };
  // Canciones y listas de un archivo exportado o recibido, ya revisadas.
  const readData = data => ({
    songs: (Array.isArray(data) ? data : (data && data.songs) || []).filter(s => s && typeof s.chart === 'string').map(cleanSong),
    lists: (data && Array.isArray(data.lists) ? data.lists : []).filter(l => l && Array.isArray(l.songs))
      .map(l => ({ id: String(l.id || newId()), name: String(l.name || 'Lista'), songs: l.songs.map(String) })),
  });
  // Las suma a la biblioteca; lo que tiene el mismo id se reemplaza.
  function mergeData(incoming) {
    for (const song of incoming.songs) {
      const i = songs.findIndex(x => x.id === song.id);
      if (i >= 0) songs[i] = song; else songs.push(song);
    }
    for (const set of incoming.lists) {
      const i = lists.findIndex(x => x.id === set.id);
      if (i >= 0) lists[i] = set; else lists.push(set);
    }
    saveSongs();
    saveLists();
  }
  // Cuadro con opciones; devuelve la clave elegida o null.
  function choose(title, options) {
    return new Promise(done => {
      const d = document.createElement('dialog');
      d.innerHTML = `<div class="sheet"><p class="hint">${esc(title)}</p>${options.map(o =>
        `<button data-k="${o[0]}"><b>${esc(o[1])}</b><small>${esc(o[2])}</small></button>`).join('')}<button data-k="">Cancelar</button></div>`;
      document.body.appendChild(d);
      d.onclick = e => {
        const b = e.target.closest('button');
        if (b) { done(b.dataset.k || null); d.close(); }
      };
      d.onclose = () => { d.remove(); done(null); };
      d.showModal();
    });
  }
  const safeName = name => name.replace(/[\\/:*?"<>|]/g, '').trim() || 'airrial';
  // Comparte archivos ya armados (PDF, imágenes, página); si el teléfono no lo permite, los descarga.
  async function shareBlobs(items, title) {
    const files = items.map(([blob, name]) => new File([blob], name, { type: blob.type }));
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title }); return false; }
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
    for (const [blob, name] of items) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    return true;
  }
  const shareBlob = async (blob, name, title) => { if (await shareBlobs([[blob, name]], title)) toast('Archivo descargado.'); };
  // Páginas (o imagen larga) de una canción, tal como se ve: con su transposición actual.
  const drawSong = (s, paged) => {
    Music.setView({ notation: settings.notation, key: s.key });
    try {
      return Exporter.render(s, paged, { before: [s.composer, styleName(s.style).replace(/ \(.*/, '')], after: [s.ts, s.tempo + ' bpm'] });
    } finally {
      Music.setView(null);
    }
  };
  const SHARE_WAYS = [
    ['file', 'Archivo', 'Se abre en Airrial tocando el título'],
    ['pdf', 'PDF', 'Para ver o imprimir, sin la app'],
  ];
  // Archivo para compartir: una página con el título como enlace. El enlace lleva todo el contenido,
  // así que al tocarlo la app lo importa; la página también guarda los datos para Menú → Abrir un archivo.
  async function shareFile(name, data, pack) {
    const page = await busy('Preparando el archivo…', async () => {
    const url = location.origin + location.pathname + '#/i/' + await pack();
    const isList = data.lists && data.lists.length;
    const rows = isList ? data.songs.map((s, i) => `<li>${esc(s.title)}${s.composer ? ` <small>${esc(s.composer)}</small>` : ''}</li>`).join('') : '';
    const sub = isList ? count(data.songs.length) : [data.songs[0].composer, styleName(data.songs[0].style).replace(/ \(.*/, ''), data.songs[0].key].filter(Boolean).join(' · ');
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · Airrial</title>
<style>body{font:17px/1.5 system-ui,sans-serif;margin:0;padding:28px 20px;background:#111318;color:#f2f3f5}
main{max-width:520px;margin:0 auto}p{color:#9aa0ab;margin:.3em 0 1.4em}small{color:#9aa0ab}
a.open{display:block;background:#f5b942;color:#1a1300;font-weight:700;font-size:1.25rem;text-decoration:none;padding:18px 20px;border-radius:14px}
a.open span{display:block;font-weight:400;font-size:.85rem;margin-top:2px}ol{padding-left:1.4em;color:#f2f3f5}li{margin:.25em 0}</style></head>
<body><main>
<a class="open" href="${esc(url)}">${esc(name)}<span>Tocá para abrir en Airrial</span></a>
<p>${esc(sub)}</p>
${rows ? `<ol>${rows}</ol>` : ''}
<p>Si el botón no abre, entrá a airrial.ar, andá a Menú → Abrir un archivo y elegí este archivo.</p>
<p><b>En iPhone con la app instalada:</b> tocá el botón de arriba, después "Copiar para la app", abrí Airrial y tocá "Pegar lo copiado".</p>
</main>
<script type="application/json" id="airrial-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</body></html>`;
    });
    if (await shareBlobs([[new Blob([page], { type: 'text/html' }), safeName(name) + '.airrial.html']], name)) {
      toast('Archivo descargado. Mandalo como adjunto: quien lo reciba lo abre y toca el título.');
    }
  }

  // Cartel de espera mientras se arma algo pesado (imagen, PDF, archivo grande).
  // La pausa inicial le da tiempo a la pantalla para mostrarlo antes de que empiece el trabajo.
  async function busy(msg, work) {
    const el = document.createElement('div');
    el.className = 'busy';
    el.innerHTML = `<div><i></i>${esc(msg)}</div>`;
    document.body.appendChild(el);
    await new Promise(done => setTimeout(done, 50));
    try { return await work(); } finally { el.remove(); }
  }

  // --- instalación ---
  // A quien usa la app desde el navegador se le ofrece instalarla.
  let installEvent = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const hideInstall = () => document.querySelectorAll('.inst').forEach(el => el.remove());
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e;
    if (here() === '#/') route();
  });
  window.addEventListener('appinstalled', () => { installEvent = null; hideInstall(); });
  const installHtml = () => {
    const close = '<button class="x" data-a="noinstall" aria-label="No mostrar más">×</button>';
    if (standalone() || settings.noInstall) return '';
    if (installEvent) return `<div class="inst"><span>Instalá Airrial para tenerla a mano y usarla sin conexión.</span><button data-a="install">Instalar</button>${close}</div>`;
    if (isIos) return `<div class="inst"><span>Para instalar Airrial en iPhone: tocá Compartir y elegí "Agregar a inicio".</span>${close}</div>`;
    return '';
  };
  // En iPhone, al abrir algo compartido desde Safari: se copia y se pega en la app instalada,
  // porque el navegador y la app no comparten lo guardado.
  const iosNote = () => (isIos && !standalone() ? `<div class="inst col"><span><b>En iPhone:</b> para tenerlo en la app instalada,
    tocá <b>Copiar para la app</b>, abrí Airrial y tocá <b>Pegar lo copiado</b>.</span><button data-a="copyapp">Copiar para la app</button></div>` : '');
  // En la app instalada en iPhone: botones a la vista para traer lo recibido.
  const iosOpenHtml = () => (isIos && standalone() && !settings.noOpenTip
    ? `<div class="inst col"><span>¿Te mandaron una canción o una lista?</span>
      <div><button data-a="paste">Pegar lo copiado</button><button class="alt" data-a="import">Abrir archivo</button>
      <button class="x" data-a="noopentip" aria-label="No mostrar más">×</button></div></div>` : '');
  // Lee del portapapeles un enlace de Airrial y abre lo que trae. Si el teléfono no deja leerlo, pide pegarlo a mano.
  async function pasteShared() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* sin permiso para leer */ }
    if (!/#\/i\//.test(text)) text = prompt('Pegá acá lo que copiaste (mantené apretado y elegí Pegar):', '') || '';
    const m = /#\/i\/([\w.\-]+)/.exec(text);
    if (m) location.hash = '#/i/' + m[1];
    else if (text) toast('Eso no es una canción ni una lista de Airrial.');
  }
  const installActions = {
    install: async () => {
      const e = installEvent;
      if (!e) return;
      installEvent = null;
      e.prompt();
      await e.userChoice;
      hideInstall();
    },
    noinstall: () => { settings.noInstall = true; saveSettings(); hideInstall(); },
    paste: () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); pasteShared(); },
    noopentip: el => { settings.noOpenTip = true; saveSettings(); el.closest('.inst').remove(); },
  };

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }
  const backupAge = () => {
    if (!settings.lastExport) return 'Todavía no hiciste ninguna copia.';
    const d = Math.floor((Date.now() - settings.lastExport) / 864e5);
    return 'Última copia: ' + (d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`) + '.';
  };
  // Compases copiados en el editor; se conservan al pasar de una canción a otra.
  let clip = null;

  // --- dibujo del cifrado ---
  function tokHtml(tk, semis, flats) {
    if (tk === '_') return '';
    if (tk === '%') return '<span class="rp">%</span>';
    const c = Music.parseChord(tk);
    if (!c) return `<span class="nc">${esc(tk)}</span>`;
    const d = Music.spell(c, semis, flats), marks = [c.push && 'anticipa', c.cut && 'corte'].filter(Boolean).join(' · ');
    // `cn` envuelve el nombre del acorde (es lo que se mide para ajustar el tamaño); el corte va chiquito debajo.
    return `<span class="cn"><b>${esc(d.root)}</b>${d.qual ? `<i>${esc(d.qual)}</i>` : ''}${d.bass ? `<u>/${esc(d.bass)}</u>` : ''}${marks ? `<em class="cut">${marks}</em>` : ''}</span>`;
  }

  const SEGNO = '<svg class="mk" viewBox="0 0 24 24" role="img" aria-label="Segno"><path d="M16.5 7.5c-.8-2.6-7.5-2.9-7.5 1 0 3.6 7 2.6 7 6.8 0 3.8-6.6 3.6-7.6.9"/><path d="M6 20 18 4"/><circle class="dot" cx="6" cy="10.5" r="1.3"/><circle class="dot" cx="18" cy="13.5" r="1.3"/></svg>';
  const CODA = '<svg class="mk" viewBox="0 0 24 24" role="img" aria-label="Coda"><ellipse cx="12" cy="12" rx="5.5" ry="7.5"/><path d="M12 1.5v21M2 12h20"/></svg>';
  // Anotación de un compás: Segno y Coda van con su símbolo; Fine, D.C., D.S. y "al Coda" van a la derecha,
  // que es donde se leen (al terminar el compás); el texto libre queda en cursiva.
  function markHtml(b) {
    if (!b.text) return '';
    const m = Music.markOf(b);
    if (m === 'segno') return `<span class="txt mark">${SEGNO}</span>`;
    if (m === 'coda') return `<span class="txt mark">${CODA}</span>`;
    if (m === 'alcoda') return `<span class="txt jump">al ${CODA}</span>`;
    return `<span class="txt${m ? ' jump' : ''}">${esc(b.text)}</span>`;
  }

  // Con `sel` (lugar marcado, o -1) dibuja la versión editable: todos los lugares se pueden tocar.
  function barHtml(b, i, semis, flats, sel) {
    const edit = sel !== undefined;
    // El compás se dibuja sobre su grilla pareja: cada lugar ocupa las casillas que le tocan por su largo.
    const items = b.items, n = items.length, g = Music.grid(b);
    let chs = '', minSpan = g.n;
    items.forEach((it, k) => {
      if (edit) {
        // En el editor se ven todos los lugares, también los vacíos.
        chs += `<span class="ch${k === sel ? ' cur' : ''}" data-k="${k}" style="grid-column:${g.at[k] + 1}/span ${g.span[k]}">${tokHtml(it, semis, flats)}</span>`;
        return;
      }
      if (it === '_') return;
      // En la hoja, un acorde ocupa hasta donde empieza el siguiente.
      let end = g.n;
      for (let j = k + 1; j < n; j++) if (items[j] !== '_') { end = g.at[j]; break; }
      minSpan = Math.min(minSpan, end - g.at[k]);
      chs += `<span class="ch" style="grid-column:${g.at[k] + 1}/${end + 1}">${tokHtml(it, semis, flats)}</span>`;
    });
    const frac = edit ? Math.min(...g.span) / g.n : minSpan / g.n;
    // Los acordes largos (Bbmaj7/D) bajan un escalón de tamaño para no pisar al vecino.
    const long = items.some(it => it.length > 5) ? 1 : 0;
    const size = ['n1', 'n2', 'n3'][Math.min(2, (frac >= 1 ? 0 : frac >= 0.5 ? 1 : 2) + long)];
    const lab = (b.section ? `<span class="sec">${esc(b.section)}</span>` : '') +
      (b.ending ? `<span class="end">${b.ending}.</span>` : '') +
      markHtml(b);
    const cols = `grid-template-columns:repeat(${g.n},minmax(0,1fr))`;
    return `<div class="bar${b.repStart ? ' rs' : ''}${b.repEnd ? ' re' : ''}" data-i="${i}">` +
      `<div class="lab">${lab}</div><div class="cell ${size}">` +
      (b.showTs ? `<span class="ts"><b>${b.ts[0]}</b><b>${b.ts[1]}</b></span>` : '') +
      `<div class="chs" style="${cols}">${chs}</div>` +
      (b.repEnd && b.times > 2 ? `<span class="tm">x${b.times}</span>` : '') +
      '</div></div>';
  }

  // Ajusta la letra de cada acorde al lugar que tiene en su compás: lo más grande que entre, hasta un tope.
  // Dentro de un compás, los acordes con el mismo espacio quedan del mismo tamaño.
  // El tope sale de `data-fit` en la hoja (lo pone la vista de la canción según el tamaño elegido) o es el normal.
  const FIT_MAX = 30, FIT_MIN = 11;
  function fitChords(root) {
    const max = +root.dataset.fit || FIT_MAX;
    const all = [...root.querySelectorAll('.cell .ch')];
    for (const el of all) el.style.fontSize = max + 'px';
    const sized = all.map(el => {
      const room = el.clientWidth - 2;
      // Se mide el nombre del acorde, no la palabra "corte" que cuelga debajo.
      const name = el.querySelector('.cn'), need = (name ? Math.ceil(name.getBoundingClientRect().width) : el.scrollWidth) || 1;
      return { el, room, need, size: Math.max(FIT_MIN, Math.min(max, Math.floor(max * room / need))) };
    });
    const bars = new Map();
    for (const s of sized) {
      const k = s.el.parentElement;
      if (!bars.has(k)) bars.set(k, []);
      bars.get(k).push(s);
    }
    for (const group of bars.values()) {
      for (const s of group) s.final = Math.min(...group.filter(o => Math.abs(o.room - s.room) < 2).map(o => o.size));
    }
    for (const s of sized) {
      s.el.style.fontSize = s.final + 'px';
      // Si ni al mínimo entra y es el último del compás, se apoya contra la barra de la derecha
      // y ocupa lugar libre hacia la izquierda, en vez de salirse del compás.
      const spills = s.need * s.final / max > s.room + 2;
      s.el.style.justifySelf = spills && !s.el.nextElementSibling && s.el.previousElementSibling ? 'end' : '';
    }
    // La palabra "corte" va alineada a la izquierda del acorde; si así se pasa de la barra del compás, a la derecha.
    for (const mark of root.querySelectorAll('.cut')) {
      mark.classList.remove('r');
      if (mark.getBoundingClientRect().right > mark.closest('.cell').getBoundingClientRect().right - 2) mark.classList.add('r');
    }
  }
  window.addEventListener('resize', () => document.querySelectorAll('.chart').forEach(fitChords));

  // Renglones de la hoja: respeta los cortes del cifrado y además corta cada `cols` compases.
  function rowsHtml(bars, cols, draw) {
    let html = '', row = null, n = 0;
    bars.forEach((b, i) => {
      if (b.row !== row || n === cols) {
        html += (row === null ? '' : '</div>') + `<div class="row" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">`;
        row = b.row;
        n = 0;
      }
      html += draw(b, i);
      n++;
    });
    return html + '</div>';
  }
  function chartHtml(bars, semis, flats, cols) {
    if (!bars.length) return '<p class="empty">Todavía no hay compases escritos.</p>';
    return rowsHtml(bars, cols || 4, (b, i) => barHtml(b, i, semis, flats));
  }

  const keyOf = (song, bars) => song.key || Music.firstChord(bars);

  // --- pantalla encendida mientras se lee una canción ---
  let wakeLock = null, wantWake = false;
  async function wake(on) {
    wantWake = on;
    try {
      if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { /* no disponible */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantWake) wake(true);
  });

  function bind(actions) {
    app.onclick = e => {
      const el = e.target.closest('[data-a]');
      if (el && actions[el.dataset.a]) actions[el.dataset.a](el, e);
    };
    app.onchange = app.oninput = null;
  }

  // --- biblioteca ---
  let libTab = 'songs', libStyle = '';
  const songMeta = s => [s.composer, styleName(s.style), s.key, s.ts].filter(Boolean).join(' · ');
  const count = n => n + (n === 1 ? ' tema' : ' temas');

  function libraryView() {
    app.innerHTML = `
      <header class="top"><div class="ttl"><h1>Airrial</h1><p>Mis cifrados · beta ${VERSION}</p></div>
        <button class="tx" data-a="menu">Menú</button></header>
      <div class="seg tabs"><button data-a="tab" data-v="songs">Canciones</button><button data-a="tab" data-v="lists">Listas</button></div>
      <div class="search"><input id="q" type="search" autocomplete="off"></div>
      <div class="filt" id="filt"></div>
      ${installHtml()}${iosOpenHtml()}
      <div class="selbar" id="selbar" hidden><button class="tx" data-a="selcancel">Cancelar</button><span id="selcount"></span>
        <button class="tx" data-a="selall">Todas</button><button class="tx del" data-a="seldel">Borrar</button></div>
      <main class="list" id="list"></main>
      <button class="fab" data-a="new" aria-label="Agregar">+</button>
      <dialog id="menu"><div class="sheet">
        <button data-a="export">Exportar todo (copia de seguridad)</button>
        <p class="hint" id="age">${backupAge()}</p>
        <button data-a="import">Abrir un archivo (recibido o copia de seguridad)</button>
        <button data-a="paste">Pegar una canción o lista copiada</button>
        <button data-a="select">Seleccionar canciones para borrar</button>
        <button data-a="theme">Cambiar a tema claro / oscuro</button>
        <button data-a="close">Cerrar</button>
      </div></dialog>
      <input type="file" id="file" accept=".json,.txt,.html,.htm,application/json,text/plain,text/html" hidden>`;
    const list = $('#list'), q = $('#q');
    // Modo selección: `sel` tiene los ids marcados (null si no se está seleccionando). `shownIds` son las canciones a la vista.
    let sel = null, shownIds = [], held = false, hold = null, down = null;
    const draw = () => {
      const f = q.value.trim().toLowerCase(), onLists = libTab === 'lists';
      $('.tabs').hidden = $('.fab').hidden = !!sel;
      $('#selbar').hidden = !sel;
      if (sel) {
        $('#selcount').textContent = sel.size + (sel.size === 1 ? ' seleccionada' : ' seleccionadas');
        $('[data-a="seldel"]').disabled = !sel.size;
      }
      app.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === libTab));
      q.placeholder = onLists ? 'Buscar lista…' : 'Buscar canción, autor o género…';
      // Filtro por género: solo aparecen los géneros que hay en la biblioteca.
      const used = STYLES.filter(st => songs.some(s => s.style === st[0]));
      if (!used.some(st => st[0] === libStyle)) libStyle = '';
      $('#filt').hidden = onLists || used.length < 2;
      $('#filt').innerHTML = [['', 'Todos'], ...used].map(st =>
        `<button data-a="style" data-v="${st[0]}"${st[0] === libStyle ? ' class="on"' : ''}>${esc(st[1].replace(/ \(.*/, ''))}</button>`).join('');
      if (onLists) {
        const shown = lists.filter(l => !f || l.name.toLowerCase().includes(f));
        list.innerHTML = shown.length ? shown.map(l => `
          <a class="item" href="#/l/${esc(l.id)}"><b>${esc(l.name)}</b>
          <span>${count(l.songs.filter(findSong).length)}</span></a>`).join('')
          : `<p class="empty">${lists.length ? 'Ninguna lista coincide con la búsqueda.' : 'Todavía no armaste ninguna lista. Tocá + para crear una, por ejemplo para un recital.'}</p>`;
        return;
      }
      const shown = songs
        .filter(s => !libStyle || s.style === libStyle)
        .filter(s => !f || (s.title + ' ' + (s.composer || '') + ' ' + styleName(s.style)).toLowerCase().includes(f))
        .sort((a, b) => a.title.localeCompare(b.title, 'es'));
      shownIds = shown.map(s => s.id);
      list.innerHTML = shown.length ? shown.map(s => (sel
        ? `<div class="item pick${sel.has(s.id) ? ' on' : ''}" data-a="pick" data-v="${esc(s.id)}">`
        : `<a class="item" href="#/s/${esc(s.id)}" data-id="${esc(s.id)}">`) + `<b>${esc(s.title)}${s.builtin ? ' <em class="inc">incluida</em>' : ''}</b>
        <span>${esc(songMeta(s))}</span>${sel ? '</div>' : '</a>'}`).join('')
        : `<p class="empty">${songs.length ? 'Ninguna canción coincide con la búsqueda.' : 'No hay canciones. Tocá + para escribir la primera.'}</p>`;
    };
    draw();
    // Mantener apretada una canción entra al modo selección con esa marcada.
    const cancelHold = () => { clearTimeout(hold); hold = null; };
    list.onpointerdown = e => {
      const el = e.target.closest('a.item[data-id]');
      cancelHold();
      held = false;
      if (!el || sel) return;
      down = [e.clientX, e.clientY];
      hold = setTimeout(() => {
        hold = null;
        held = true;
        sel = new Set([el.dataset.id]);
        if (navigator.vibrate) navigator.vibrate(20);
        draw();
      }, 500);
    };
    list.onpointermove = e => { if (hold && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) cancelHold(); };
    list.onpointerup = list.onpointercancel = list.onpointerleave = list.onscroll = cancelHold;
    list.oncontextmenu = e => e.preventDefault();
    bind({
      ...installActions,
      select: () => { $('#menu').close(); libTab = 'songs'; sel = new Set(); draw(); },
      selcancel: () => { sel = null; draw(); },
      pick: el => {
        // el toque que termina un "mantener apretado" no cuenta como otro toque
        if (held) { held = false; return; }
        const id = el.dataset.v;
        if (sel.has(id)) sel.delete(id); else sel.add(id);
        draw();
      },
      // Marca todas las que se ven (con el buscador o el filtro puestos, solo esas); si ya están todas, las desmarca.
      selall: () => {
        const all = shownIds.every(id => sel.has(id));
        shownIds.forEach(id => { if (all) sel.delete(id); else sel.add(id); });
        draw();
      },
      seldel: () => {
        const n = sel.size;
        if (!n || !confirm(`¿Borrar ${n === 1 ? 'esta canción' : 'estas ' + n + ' canciones'}? No se puede deshacer.`)) return;
        songs = songs.filter(s => !sel.has(s.id));
        lists.forEach(l => { l.songs = l.songs.filter(id => !sel.has(id)); });
        saveSongs();
        saveLists();
        sel = null;
        draw();
        toast(n === 1 ? 'Canción borrada.' : n + ' canciones borradas.');
      },
      tab: el => { libTab = el.dataset.v; q.value = ''; draw(); },
      style: el => { libStyle = el.dataset.v; draw(); },
      new: () => {
        if (libTab !== 'lists') { location.hash = '#/e/new'; return; }
        const name = (prompt('Nombre de la lista:', '') || '').trim();
        if (!name) return;
        const l = { id: newId(), name, songs: [] };
        lists.push(l);
        saveLists();
        location.hash = '#/l/' + l.id;
      },
      menu: () => $('#menu').showModal(),
      close: () => $('#menu').close(),
      theme: () => {
        settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = settings.theme;
        saveSettings();
      },
      export: () => {
        download('airrial-canciones.json', { app: 'airrial', version: 1, songs, lists });
        settings.lastExport = Date.now();
        saveSettings();
        $('#age').textContent = backupAge();
      },
      import: () => $('#file').click(),
    });
    app.oninput = e => { if (e.target === q) draw(); };
    app.onchange = async e => {
      if (e.target.id !== 'file' || !e.target.files[0]) return;
      try {
        const incoming = readData(parseFile(await e.target.files[0].text()));
        mergeData(incoming);
        $('#menu').close();
        draw();
        const n = incoming.lists.length;
        alert(`Se importaron ${count(incoming.songs.length)}` + (n ? ` y ${n} ${n === 1 ? 'lista' : 'listas'}.` : '.'));
      } catch {
        alert('No se pudo leer ese archivo. Tiene que ser un archivo exportado desde Airrial.');
      }
      e.target.value = '';
    };
  }

  // --- lista de temas ---
  function listView(list) {
    app.innerHTML = `
      <header class="top"><button class="ic" data-a="back" aria-label="Volver">‹</button>
        <div class="ttl"><h1 id="lname"></h1><p id="lcount"></p></div>
        <button class="ic2" data-a="share" aria-label="Compartir la lista">${SHARE}</button>
        <button class="tx" data-a="rename">Nombre</button></header>
      <main class="list">
        <div id="rows"></div>
        <button class="ghost" data-a="add">Agregar o quitar temas</button>
        <button class="danger" data-a="dellist">Borrar esta lista</button>
      </main>
      <dialog id="pick"><div class="sheet">
        <input id="pq" type="search" placeholder="Buscar canción, autor o género…" autocomplete="off">
        <div class="picklist" id="picklist"></div>
        <p class="hint" id="picknone" hidden>Ninguna canción coincide.</p>
        <button class="pri" data-a="pickok">Listo</button>
      </div></dialog>`;
    const draw = () => {
      list.songs = list.songs.filter(findSong);
      const n = list.songs.length;
      $('#lname').textContent = list.name;
      $('#lcount').textContent = count(n);
      $('#rows').innerHTML = n ? list.songs.map((id, i) => {
        const s = findSong(id);
        return `<div class="lrow" data-id="${esc(id)}"><button class="hdl" aria-label="Arrastrar para ordenar">${GRIP}</button>
          <a class="item" href="#/s/${esc(id)}/${esc(list.id)}"><b>${i + 1}. ${esc(s.title)}</b>
          <span>${esc(songMeta(s))}</span></a>
          <button data-a="rm" data-v="${i}" aria-label="Quitar de la lista">×</button></div>`;
      }).join('') : '<p class="empty">La lista está vacía. Tocá "Agregar o quitar temas".</p>';
    };
    const change = fn => { fn(); saveLists(); draw(); };
    draw();

    // Ordenar arrastrando de la manija: la fila se levanta y sigue al dedo, las demás le hacen lugar,
    // y al soltar se guarda el orden.
    const rows = $('#rows'), main = rows.parentElement;
    let drag = null, grabDY = 0, lastY = 0;
    const follow = () => {
      const top = rows.getBoundingClientRect().top + drag.offsetTop;
      drag.style.transform = `translateY(${lastY - grabDY - top}px) scale(1.02)`;
    };
    // Mueve la fila dentro de la lista y desliza a las vecinas hasta su lugar nuevo.
    const place = next => {
      const others = [...rows.children].filter(el => el !== drag), before = others.map(el => el.offsetTop);
      if (next) rows.insertBefore(drag, next); else rows.appendChild(drag);
      others.forEach((el, i) => {
        const d = before[i] - el.offsetTop;
        if (!d) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${d}px)`;
        el.offsetHeight;
        el.style.transition = 'transform .15s';
        el.style.transform = '';
      });
    };
    const onMove = e => {
      lastY = e.clientY;
      const box = main.getBoundingClientRect();
      if (lastY < box.top + 50) main.scrollTop -= 12;
      else if (lastY > box.bottom - 50) main.scrollTop += 12;
      const top = rows.getBoundingClientRect().top;
      const next = [...rows.children].find(el => el !== drag && lastY < top + el.offsetTop + el.offsetHeight / 2);
      if (next ? drag.nextElementSibling !== next : rows.lastElementChild !== drag) place(next);
      follow();
    };
    const onEnd = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      if (!drag) return;
      drag = null;
      const order = [...rows.children].map(el => el.dataset.id);
      change(() => { list.songs = order; });
    };
    rows.onpointerdown = e => {
      const h = e.target.closest('.hdl');
      if (!h || drag) return;
      e.preventDefault();
      drag = h.closest('.lrow');
      grabDY = e.clientY - drag.getBoundingClientRect().top;
      lastY = e.clientY;
      drag.classList.add('drag');
      follow();
      if (navigator.vibrate) navigator.vibrate(15);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
    };
    bind({
      back: () => { libTab = 'lists'; up('#/'); },
      rename: () => {
        const name = (prompt('Nombre de la lista:', list.name) || '').trim();
        if (name) change(() => { list.name = name; });
      },
      share: async () => {
        const mine = list.songs.map(findSong).filter(Boolean);
        if (!mine.length) { toast('La lista está vacía: agregale temas antes de compartirla.'); return; }
        const pack = { app: 'airrial', version: 1, songs: mine, lists: [list] };
        const how = await choose('Compartir esta lista', SHARE_WAYS);
        if (how === 'file') { shareFile(list.name, pack, () => packList(list)); return; }
        // Todas las canciones de la lista en un solo PDF, cada una empezando en hoja nueva.
        if (how === 'pdf') {
          if (mine.length > 200) { toast('Son demasiados temas para un solo PDF (máximo 200). Armá listas más cortas.'); return; }
          // Las hojas se dibujan de a una para no llenar la memoria del teléfono.
          const sheets = function* () { for (const s of mine) yield* drawSong(s, true); };
          shareBlob(await busy('Generando el PDF…', () => Exporter.pdf(sheets())), safeName(list.name) + '.pdf', list.name);
          return;
        }
      },
      rm: el => change(() => { list.songs.splice(+el.dataset.v, 1); }),
      add: () => {
        const sorted = songs.slice().sort((a, b) => a.title.localeCompare(b.title, 'es'));
        $('#picklist').innerHTML = sorted.length ? sorted.map(s => `<label class="pick" data-f="${esc((s.title + ' ' + (s.composer || '') + ' ' + styleName(s.style)).toLowerCase())}">
          <input type="checkbox" value="${esc(s.id)}"${list.songs.includes(s.id) ? ' checked' : ''}>
          <span><b>${esc(s.title)}</b>${s.composer ? `<small>${esc(s.composer)}</small>` : ''}</span></label>`).join('')
          : '<p class="hint">Todavía no hay canciones escritas.</p>';
        $('#pq').value = '';
        $('#pick').showModal();
      },
      // Los que ya estaban conservan su orden; los nuevos se agregan al final.
      pickok: () => {
        const chosen = [...app.querySelectorAll('#picklist input:checked')].map(i => i.value);
        change(() => { list.songs = list.songs.filter(id => chosen.includes(id)).concat(chosen.filter(id => !list.songs.includes(id))); });
        $('#pick').close();
      },
      dellist: () => {
        if (!confirm(`¿Borrar la lista "${list.name}"? Las canciones no se borran.`)) return;
        lists = lists.filter(l => l.id !== list.id);
        saveLists();
        libTab = 'lists';
        up('#/');
      },
    });
    // El buscador solo oculta filas: lo que ya estaba tildado se conserva aunque no se vea.
    const filterPick = () => {
      const f = $('#pq').value.trim().toLowerCase();
      let shown = 0;
      app.querySelectorAll('#picklist .pick').forEach(el => { el.hidden = !!f && !el.dataset.f.includes(f); if (!el.hidden) shown++; });
      $('#picknone').hidden = shown > 0;
    };
    app.oninput = e => { if (e.target.id === 'pq') filterPick(); };
  }

  // --- canción ---
  const PLAY = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 4v16l14-8z" fill="currentColor"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 6h12v12H6z" fill="currentColor"/></svg>';
  const line = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const SHARE = line('M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7');
  const UNDO = line('M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
  const GRIP = line('M5 8h14M5 12h14M5 16h14');
  const REDO = line('m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3');

  function songView(song, list) {
    const vol = settings.vol;
    const ids = list ? list.songs.filter(findSong) : [], at = ids.indexOf(song.id);
    const goList = d => { if (ids[at + d]) swap('#/s/' + ids[at + d] + '/' + list.id); };
    // Cada renglón de la mezcla: el nombre es un botón que silencia o devuelve el instrumento.
    const slider = (k, name) => `<div class="mx${settings.mute[k] ? ' off' : ''}">
      <button type="button" data-a="mute" data-v="${k}" aria-pressed="${!!settings.mute[k]}" aria-label="Silenciar o activar: ${name}">${name}</button>
      <input type="range" min="0" max="1" step="0.05" data-vol="${k}" value="${vol[k]}" aria-label="Volumen: ${name}"></div>`;
    app.innerHTML = `
      <header class="top"><button class="ic" data-a="back" aria-label="Volver">‹</button>
        <div class="ttl"><h1>${esc(song.title)}</h1>
        <p>${esc([song.composer, song.ts].filter(Boolean).join(' · '))}</p></div>
        <button class="ic2" data-a="share" aria-label="Compartir">${SHARE}</button>
        <button class="tx" data-a="edit">Editar</button></header>
      ${list ? `<nav class="setnav"><button data-a="prevsong"${at > 0 ? '' : ' disabled'}>‹ Anterior</button>
        <span>${esc(list.name)} · ${at + 1} de ${ids.length}</span>
        <button data-a="nextsong"${at < ids.length - 1 ? '' : ' disabled'}>Siguiente ›</button></nav>` : ''}
      <main class="chart" id="chart"></main>
      <footer class="ctl${settings.sheetOpen ? ' open' : ''}" id="sheet">
        <button class="grab" data-a="sheet" aria-label="Mostrar u ocultar más opciones" aria-expanded="${!!settings.sheetOpen}">
          <i></i><span>Estilo, mezcla, práctica y más</span></button>
        <div class="r">
          <button class="play" data-a="play" id="play" aria-label="Reproducir o detener">${PLAY}</button>
          <div class="grp"><span>Tempo</span><div class="st">
            <button data-a="slower" aria-label="Más lento">−</button>
            <input id="tempo" type="number" inputmode="numeric" min="30" max="360" value="${song.tempo}" aria-label="Tempo">
            <button data-a="faster" aria-label="Más rápido">+</button></div></div>
          <div class="grp"><span>Tono</span><div class="st">
            <button data-a="down" aria-label="Bajar medio tono">−</button>
            <button id="key" class="val" data-a="reset" aria-label="Volver al tono original"></button>
            <button data-a="up" aria-label="Subir medio tono">+</button></div></div>
        </div>
        <p class="live" id="live" hidden></p>
        <div class="more"><div class="in">
          <div class="r">
            <label class="fld">Estilo<select id="style" aria-label="Estilo">${STYLES.map(s => `<option value="${s[0]}"${s[0] === song.style ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>
            <label class="fld">Vueltas<select id="reps" aria-label="Vueltas">${[1, 2, 3, 4, 6, 999].map(n => `<option value="${n}"${n === settings.choruses ? ' selected' : ''}>${n === 999 ? 'Sin fin' : n + (n === 1 ? ' vuelta' : ' vueltas')}</option>`).join('')}</select></label>
          </div>
          <div class="r">
            <label class="fld">Ver los acordes como<select id="notation">${[['letras', 'Letras: C, Dm7, Gmaj7'], ['jazz', 'Jazz: C, D-7, G△7'], ['latino', 'Do, Re, Mi: Do, Rem7, Solmaj7'], ['grados', 'Grados: I, IIm7, Vmaj7']]
              .map(o => `<option value="${o[0]}"${o[0] === settings.notation ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
            <label class="fld narrow">Tamaño de la hoja<select id="size">${[['chico', 'Chico'], ['normal', 'Normal'], ['grande', 'Grande']]
              .map(o => `<option value="${o[0]}"${o[0] === settings.size ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
          </div>
          <div class="r">
            <label class="fld">Subir el tempo por vuelta<select id="ptempo">${[[0, 'No'], [4, '+4 bpm'], [8, '+8 bpm'], [12, '+12 bpm']]
              .map(o => `<option value="${o[0]}"${o[0] === settings.practice.tempo ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
            <label class="fld">Cambiar de tono por vuelta<select id="pkey">${[[0, 'No'], [1, '+1 semitono'], [5, 'Una cuarta arriba'], [7, 'Una quinta arriba']]
              .map(o => `<option value="${o[0]}"${o[0] === settings.practice.key ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
          </div>
          <div class="mixer">
            ${slider('bass', 'Bajo')}${slider('keys', 'Teclado')}${slider('drums', 'Batería')}${slider('click', 'Claqueta')}
            <label class="chk"><input type="checkbox" id="countin"${settings.countIn ? ' checked' : ''}> Un compás de cuenta previa</label>
          </div>
        </div></div>
      </footer>`;

    const chart = $('#chart'), sheet = $('#sheet'), grab = $('.grab', sheet);
    let grabY = null, swiped = false;
    const setSheet = on => {
      settings.sheetOpen = on;
      saveSettings();
      sheet.classList.toggle('open', on);
      grab.setAttribute('aria-expanded', on);
    };
    const setMute = (k, on) => {
      settings.mute[k] = on;
      saveSettings();
      applyVol(k);
      const btn = $(`[data-a="mute"][data-v="${k}"]`, sheet);
      btn.setAttribute('aria-pressed', on);
      btn.parentElement.classList.toggle('off', on);
    };
    // from: compás desde el que arranca. range: tramo [a, b] a repetir; b queda en null hasta que se toca el final.
    let bars = [], from = null, range = null;
    const markFrom = () => {
      chart.querySelectorAll('.bar').forEach(el => {
        const i = +el.dataset.i;
        el.classList.toggle('from', i === from);
        el.classList.toggle('rng', !!range && range.b != null && i >= range.a && i <= range.b);
        el.classList.toggle('rng0', !!range && range.b == null && i === range.a);
      });
    };
    // Los carteles de ayuda se muestran una sola vez.
    const hint = (key, msg) => {
      if (settings.hints[key]) return;
      settings.hints[key] = true;
      saveSettings();
      toast(msg);
    };
    // Modo práctica: mientras suena, `liveSemis` es el tono de la vuelta que se escucha (null = el guardado).
    let liveSemis = null;
    const draw = () => {
      bars = Music.parseChart(song.chart, tsOf(song));
      const semis = liveSemis != null ? liveSemis : (song.transpose || 0);
      const key = keyOf(song, bars);
      const flats = Music.useFlats(key, semis);
      Music.setView({ notation: settings.notation, key: song.key });
      chart.innerHTML = chartHtml(bars, semis, flats, colsOf(song));
      Music.setView(null);
      // Tamaño elegido: cambia el alto de los compases (CSS) y hasta dónde puede crecer la letra.
      chart.dataset.size = settings.size;
      chart.dataset.fit = SHEET_SIZES[settings.size];
      fitChords(chart);
      markFrom();
      $('#key').textContent = song.key ? Music.transposeName(song.key, semis, flats) : (semis > 0 ? '+' : '') + semis;
    };
    // Al parar, la hoja vuelve al tono guardado y se va el cartel de la vuelta.
    const endLive = () => {
      $('#live').hidden = true;
      if (liveSemis == null) return;
      liveSemis = null;
      draw();
    };
    const setPlaying = on => {
      $('#play').innerHTML = on ? STOP : PLAY;
      $('#play').classList.toggle('on', on);
      if (!on) { chart.querySelectorAll('.bar.on').forEach(el => el.classList.remove('on')); endLive(); }
    };
    const restart = () => { if (Engine.isPlaying()) start(); };
    const start = () => {
      endLive();
      const semis = song.transpose || 0, practice = settings.practice, resolved = {};
      // Tono y tempo de cada vuelta (la primera es la 0). Sin modo práctica son siempre los guardados.
      const semisAt = n => ((semis + n * practice.key) % 12 + 12) % 12;
      const tempoAt = n => Math.min(360, song.tempo + (n || 0) * practice.tempo);
      let seq, choruses = settings.choruses, finalChord = null;
      if (range && range.b != null) {
        // El tramo suena de corrido, sin las repeticiones ni casillas que tenga adentro.
        seq = bars.slice(range.a, range.b + 1).map((_, i) => i + range.a);
      } else {
        seq = Music.unfold(bars);
        const k = Music.parseChord(song.key || '');
        if (k && choruses !== 999) {
          finalChord = n => {
            const root = (k.num + semisAt(n)) % 12;
            return { root, bass: root, iv: Music.intervals(k.qual) };
          };
        }
      }
      const ok = Engine.play({
        seq,
        startPos: from == null ? 0 : Math.max(0, seq.indexOf(from)),
        finalChord,
        barsFor: n => resolved[semisAt(n)] || (resolved[semisAt(n)] = Music.resolve(bars, semisAt(n))),
        getTempo: tempoAt,
        style: song.style,
        choruses,
        countIn: settings.countIn,
        // Llega cuando empieza a sonar cada vuelta: en modo práctica se muestra su tempo y la hoja pasa a su tono.
        onChorus: n => {
          if (!practice.tempo && !practice.key) return;
          const now = semisAt(n), shown = liveSemis != null ? liveSemis : semisAt(0);
          if (now !== shown) { liveSemis = now; draw(); }
          const parts = ['Práctica · vuelta ' + (n + 1)];
          if (practice.tempo) parts.push(tempoAt(n) + ' bpm');
          if (practice.key) parts.push('tono ' + $('#key').textContent);
          $('#live').textContent = parts.join(' · ');
          $('#live').hidden = false;
        },
        onBar: i => {
          chart.querySelectorAll('.bar.on').forEach(el => el.classList.remove('on'));
          const el = chart.querySelector(`.bar[data-i="${i}"]`);
          if (el) { el.classList.add('on'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        },
        onEnd: () => setPlaying(false),
      });
      setPlaying(ok);
    };
    const setTempo = v => {
      song.tempo = Math.min(360, Math.max(30, Math.round(v) || 120));
      $('#tempo').value = song.tempo;
      saveSongs();
    };
    const shift = d => {
      song.transpose = d === 0 ? 0 : ((song.transpose || 0) + d + 18) % 12 - 6;
      saveSongs();
      draw();
      restart();
    };

    draw();
    wake(true);
    if (list) hint('swipe', 'Deslizá la hoja hacia los costados para pasar de tema.');
    bind({
      back: () => up(list ? '#/l/' + list.id : '#/'),
      prevsong: () => goList(-1),
      nextsong: () => goList(1),
      edit: () => { location.hash = '#/e/' + song.id; },
      share: async () => {
        const how = await choose('Compartir esta canción', [...SHARE_WAYS, ['png', 'Imagen', 'Para ver en cualquier chat']]);
        if (how === 'file') shareFile(song.title, { app: 'airrial', version: 1, songs: [song] }, () => packSong(song));
        else if (how === 'pdf') shareBlob(await busy('Generando el PDF…', () => Exporter.pdf(drawSong(song, true))), safeName(song.title) + '.pdf', song.title);
        else if (how === 'png') {
          // Una imagen por hoja, del mismo tamaño que las del PDF.
          const items = await busy('Generando la imagen…', async () => {
            const pages = drawSong(song, true), out = [];
            for (let i = 0; i < pages.length; i++) {
              out.push([await Exporter.png(pages[i]), safeName(song.title) + (pages.length > 1 ? ` (${i + 1})` : '') + '.png']);
            }
            return out;
          });
          if (await shareBlobs(items, song.title)) toast(items.length > 1 ? 'Imágenes descargadas.' : 'Imagen descargada.');
        }
      },
      play: () => { if (Engine.isPlaying()) { Engine.stop(); setPlaying(false); } else start(); },
      slower: () => setTempo(song.tempo - 4),
      faster: () => setTempo(song.tempo + 4),
      down: () => shift(-1),
      up: () => shift(1),
      reset: () => shift(0),
      sheet: () => {
        if (swiped) { swiped = false; return; }
        setSheet(!settings.sheetOpen);
      },
      mute: el => setMute(el.dataset.v, !settings.mute[el.dataset.v]),
    });
    // La manija del panel responde al toque y también a deslizar hacia arriba o hacia abajo.
    grab.onpointerdown = e => { grabY = e.clientY; swiped = false; grab.setPointerCapture(e.pointerId); };
    grab.onpointermove = e => {
      if (grabY == null || Math.abs(e.clientY - grabY) < 24) return;
      setSheet(e.clientY < grabY);
      swiped = true;
      grabY = null;
    };
    grab.onpointerup = grab.onpointercancel = () => { grabY = null; };
    // Toque corto: empezar desde ese compás (o cerrar el tramo que se está marcando).
    // Toque largo: empezar a marcar un tramo, que termina en el próximo compás que se toque.
    const locked = () => {
      if (!Engine.isPlaying()) return false;
      hint('lock', 'Mientras suena, la hoja no responde a los toques. Detené la reproducción para marcar un compás.');
      return true;
    };
    const tapBar = i => {
      if (locked()) return;
      if (range && range.b == null) {
        range = { a: Math.min(range.a, i), b: Math.max(range.a, i) };
        from = null;
      } else {
        const same = from === i && !range;
        range = null;
        from = same ? null : i;
        if (from != null) hint('from', 'Va a empezar desde este compás. Tocalo de nuevo para quitar la marca.');
      }
      markFrom();
    };
    const holdBar = i => {
      range = { a: i, b: null };
      from = null;
      markFrom();
      if (navigator.vibrate) navigator.vibrate(30);
      hint('range', 'Ahora tocá el compás donde termina el tramo.');
    };
    let hold = null, held = false, down = null;
    const cancelHold = () => { clearTimeout(hold); hold = null; };
    chart.onpointerdown = e => {
      const el = e.target.closest('.bar');
      cancelHold();
      held = false;
      down = [e.clientX, e.clientY];
      if (!el || Engine.isPlaying()) return;
      hold = setTimeout(() => { held = true; hold = null; holdBar(+el.dataset.i); }, 500);
    };
    chart.onpointermove = e => {
      if (hold && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 14) cancelHold();
    };
    // Dentro de una lista, deslizar hacia los costados pasa al tema siguiente o al anterior.
    chart.onpointerup = e => {
      cancelHold();
      if (!list || !down || Engine.isPlaying()) return;
      const dx = e.clientX - down[0], dy = e.clientY - down[1];
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) { held = true; goList(dx < 0 ? 1 : -1); }
    };
    chart.onpointercancel = chart.onpointerleave = cancelHold;
    chart.onscroll = cancelHold;
    chart.oncontextmenu = e => e.preventDefault();
    chart.onclick = e => {
      const el = e.target.closest('.bar');
      if (held) { held = false; return; }
      if (el) tapBar(+el.dataset.i);
    };
    app.oninput = e => {
      const k = e.target.dataset.vol;
      if (!k) return;
      vol[k] = +e.target.value;
      // Mover el deslizador de un instrumento silenciado lo vuelve a activar.
      if (settings.mute[k]) setMute(k, false);
      else { applyVol(k); saveSettings(); }
    };
    app.onchange = e => {
      const t = e.target;
      if (t.id === 'tempo') setTempo(+t.value);
      else if (t.id === 'style') { song.style = t.value; saveSongs(); restart(); }
      else if (t.id === 'reps') { settings.choruses = +t.value; saveSettings(); restart(); }
      else if (t.id === 'countin') { settings.countIn = t.checked; saveSettings(); }
      else if (t.id === 'size') { settings.size = t.value; saveSettings(); draw(); }
      else if (t.id === 'ptempo' || t.id === 'pkey') {
        settings.practice[t.id === 'ptempo' ? 'tempo' : 'key'] = +t.value;
        saveSettings();
        restart();
      }
      else if (t.id === 'notation') {
        settings.notation = t.value;
        saveSettings();
        draw();
        if (t.value === 'grados' && !song.key) toast('Para ver los grados, cargá la tonalidad de la canción en Editar.');
      }
    };
  }

  // --- canción o lista recibida por enlace ---
  async function importView(code) {
    let data = null;
    try { data = await unpack(code || ''); } catch { /* enlace roto */ }
    if (location.hash !== '#/i/' + (code || '')) return;
    const head = (title, save) => `<header class="top"><button class="tx" data-a="cancel">Cancelar</button>
      <div class="ttl"><h1>${title}</h1></div>${save ? '<button class="tx pri" data-a="save">Guardar</button>' : ''}</header>`;
    const actions = { ...installActions, cancel: () => up('#/') };
    actions.copyapp = async () => {
      const url = location.origin + location.pathname + '#/i/' + code;
      try {
        await navigator.clipboard.writeText(url);
        toast('Copiado. Ahora abrí la app Airrial y tocá "Pegar lo copiado".');
      } catch {
        prompt('No se pudo copiar solo. Mantené apretado, elegí Seleccionar todo y Copiar:', url);
      }
    };
    // Si ya tengo una canción idéntica, uso esa en lugar de duplicarla.
    const keep = s => {
      const same = songs.find(x => x.title === s.title && x.chart === s.chart);
      if (same) return same.id;
      s.id = newId();
      songs.push(s);
      return s.id;
    };
    if (!data) {
      app.innerHTML = head('Enlace no válido') + '<main><p class="empty">Este enlace está incompleto o no es de Airrial. Pedí que te lo manden de nuevo.</p></main>';
    } else if (data.song) {
      const song = data.song;
      app.innerHTML = head('Canción compartida', true) + (iosNote() || installHtml()) + `<main class="chart">
        <div class="shared"><b>${esc(song.title)}</b>
        <span>${esc([songMeta(song), song.tempo + ' bpm'].join(' · '))}</span></div>
        ${chartHtml(Music.parseChart(song.chart, tsOf(song)), 0, true, colsOf(song))}</main>`;
      actions.save = () => {
        const id = keep(song);
        saveSongs();
        swap('#/s/' + id);
      };
    } else {
      app.innerHTML = head('Lista compartida', true) + (iosNote() || installHtml()) + `<main class="list">
        <div class="shared"><b>${esc(data.name)}</b><span>${count(data.songs.length)}</span></div>
        ${data.songs.map((s, i) => `<div class="item"><b>${i + 1}. ${esc(s.title)}</b><span>${esc(songMeta(s))}</span></div>`).join('')}</main>`;
      actions.save = () => {
        const l = { id: newId(), name: data.name, songs: data.songs.map(keep) };
        saveSongs();
        lists.push(l);
        saveLists();
        swap('#/l/' + l.id);
      };
    }
    fitChords(app);
    bind(actions);
  }

  // --- archivo recibido (compartido hacia Airrial desde otra app) ---
  // El service worker deja el archivo en una bandeja; acá se muestra y se guarda.
  async function receiveView() {
    let got = null;
    try {
      const box = await caches.open('airrial-inbox'), res = await box.match('recibido');
      if (!res) { if (here() === '#/r') swap('#/'); return; }
      await box.delete('recibido');
      got = readData(parseFile(await res.text()));
    } catch { /* archivo ilegible */ }
    if (here() !== '#/r') return;
    const head = (title, save) => `<header class="top"><button class="tx" data-a="cancel">${save ? 'Cancelar' : 'Volver'}</button>
      <div class="ttl"><h1>${title}</h1></div>${save ? '<button class="tx pri" data-a="save">Guardar</button>' : ''}</header>`;
    const actions = { cancel: () => up('#/') };
    if (!got || !(got.songs.length + got.lists.length)) {
      app.innerHTML = head('Archivo no reconocido') + '<main><p class="empty">Ese archivo no es de Airrial, o está dañado. Tiene que ser un archivo compartido o exportado desde la app.</p></main>';
    } else {
      const one = got.songs.length === 1 && !got.lists.length ? got.songs[0] : null;
      app.innerHTML = head('Archivo recibido', true) + (one ? `<main class="chart">
        <div class="shared"><b>${esc(one.title)}</b><span>${esc([songMeta(one), one.tempo + ' bpm'].join(' · '))}</span></div>
        ${chartHtml(Music.parseChart(one.chart, tsOf(one)), 0, true, colsOf(one))}</main>` : `<main class="list">
        ${got.lists.map(l => `<div class="shared"><b>${esc(l.name)}</b><span>Lista · ${count(l.songs.length)}</span></div>`).join('')}
        ${got.songs.map((s, i) => `<div class="item"><b>${i + 1}. ${esc(s.title)}</b><span>${esc(songMeta(s))}</span></div>`).join('')}</main>`);
      actions.save = () => {
        mergeData(got);
        if (got.lists.length === 1) swap('#/l/' + got.lists[0].id);
        else if (one) swap('#/s/' + one.id);
        else swap('#/');
      };
    }
    fitChords(app);
    bind(actions);
  }

  // --- editor ---
  const INSERTS = [
    ['|', ' | '], ['|:', '|: '], [':|', ' :|'], ['%', '% '], ['[A]', '[]', 1], ['1.', '1. '], ['2.', '2. '],
    ['#', '#'], ['b', 'b'], ['m', 'm'], ['7', '7'], ['m7', 'm7'], ['maj7', 'maj7'], ['m7b5', 'm7b5'],
    ['dim', 'dim'], ['sus4', 'sus4'], ['6', '6'], ['9', '9'], ['/', '/'], ['{ }', '{  }', 2], ['.', ' . '], ['_', ' _ '], ['N.C.', 'N.C. '], ['↵', '\n'],
  ];
  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALS = [
    '', 'm', '7', 'maj7', 'm7', '6', 'm6', '9', 'm9', 'maj9',
    'sus4', '7sus4', 'dim', 'm7b5', 'dim7', 'aug', '7b9', '7#9', '13', 'add9',
    'sus2', '7#5', '7b5', '7#11', '11', 'm11', 'mMaj7', '6/9', '7alt', '5',
  ];
  const PARTS = ['A', 'B', 'C', 'D', 'Intro', 'Estribillo', 'Puente', 'Solo', 'Final'];
  const NOTES = ['Segno', 'Coda', 'Al Coda', 'Fine', 'D.C.', 'D.C. al Fine', 'D.C. al Coda', 'D.S.', 'D.S. al Fine', 'D.S. al Coda'];
  const plainAcc = a => (a === '♯' ? '#' : a === '♭' ? 'b' : a);
  const chordText = c => (c.push ? '<' : '') + c.letter + plainAcc(c.acc) + c.qual +
    (c.bassLetter ? '/' + c.bassLetter + plainAcc(c.bassAcc) : '') + (c.cut ? '!' : '');
  const HELP =`<details class="help"><summary>Cómo se escribe</summary>
    <ul>
      <li>Separá los compases con <code>|</code>. Cada renglón de texto es un renglón de la partitura.</li>
      <li>Dos acordes en un compás se reparten por la mitad: <code>| Dm7 G7 |</code>.</li>
      <li>Para ubicar un acorde en un punto exacto, escribí el compás entre llaves como una grilla pareja: cada lugar vale lo mismo, <code>.</code> alarga el acorde anterior y <code>_</code> es un lugar vacío. Un acorde en el 1 y otro en el "y" del 4: <code>| { C . . . . . . G } |</code>.</li>
      <li><code>%</code> repite el compás anterior. <code>N.C.</code> es silencio de la banda. <code>_</code> es un compás vacío.</li>
      <li>Partes: <code>[A]</code>, <code>[Estribillo]</code>. Repetición: <code>|:</code> … <code>:|</code> (o <code>:| x3</code>).</li>
      <li>Casillas: <code>1.</code> y <code>2.</code> al empezar el compás.</li>
      <li>Cambio de compás: <code>3/4</code> al empezar el compás. Texto libre entre comillas: <code>"Fine"</code>.</li>
      <li>Acordes: <code>C</code> <code>F#m7</code> <code>Bbmaj7</code> <code>E7b9</code> <code>Am7b5</code> <code>Gsus4</code> <code>D/F#</code>.</li>
      <li>Corte (golpe seco y silencio hasta el próximo acorde): un <code>!</code> pegado al acorde, por ejemplo <code>G7!</code>.</li>
      <li>Anticipación (el acorde suena una corchea antes de donde está escrito): un <code>&lt;</code> adelante, por ejemplo <code>&lt;G7</code>.</li>
    </ul></details>`;

  function editView(id) {
    const existing = findSong(id);
    const song = existing ? { ...existing } : {
      id: newId(), title: '', composer: '', style: 'swing', key: '', tempo: 120, ts: '4/4', transpose: 0, chart: '',
    };
    app.innerHTML = `
      <header class="top"><button class="tx" data-a="cancel">Cancelar</button>
        <div class="ttl"><h1>${existing ? 'Editar canción' : 'Nueva canción'}</h1></div>
        <button class="tx pri" data-a="save">Guardar</button></header>
      <main class="edit">
        <details class="meta"${existing ? '' : ' open'}><summary>Datos de la canción</summary>
        <div class="fields">
          <label class="w">Título<input id="f-title" value="${esc(song.title)}" autocomplete="off"></label>
          <label class="w">Autor<input id="f-composer" value="${esc(song.composer)}" autocomplete="off"></label>
          <label>Estilo<select id="f-style">${STYLES.map(s => `<option value="${s[0]}"${s[0] === song.style ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>
          <label>Compás<select id="f-ts">${METERS.map(m => `<option${m === song.ts ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <div class="w keypick"><span>Compases por renglón</span>
            <div class="kb kcols">${[2, 3, 4, 5, 6].map(n => `<button type="button" data-a="cols" data-v="${n}">${n}</button>`).join('')}</div></div>
          <label class="w">Tempo<input id="f-tempo" type="number" inputmode="numeric" min="30" max="360" value="${song.tempo}"></label>
          <div class="w keypick"><span>Tonalidad</span><input type="hidden" id="f-key" value="${esc(song.key)}">
            <div class="kb k7">${ROOTS.map(r => `<button type="button" data-a="knote" data-v="${r}">${r}</button>`).join('')}</div>
            <div class="kb kmods"><button type="button" data-a="kacc" data-v="b">♭</button><button type="button" data-a="kacc" data-v="#">♯</button>
              <button type="button" data-a="kmode" data-v="">Mayor</button><button type="button" data-a="kmode" data-v="m">Menor</button>
              <button type="button" data-a="knone">Ninguna</button></div>
            <button type="button" class="khint" data-a="kuse" hidden></button></div>
        </div></details>
        <div class="seg"><button data-a="mode" data-v="grid">Botones</button><button data-a="mode" data-v="text">Texto</button></div>
        <div id="body"></div>
        ${existing ? '<button class="ghost" data-a="dup">Duplicar esta canción</button><button class="danger" data-a="delete">Borrar esta canción</button>' : ''}
      </main>
      <footer class="pad" id="pad"></footer>`;

    const body = $('#body'), pad = $('#pad');
    let bars = [], cur = { b: 0, k: 0, fresh: true }, target = 'root', tab = 'chords', mode = 'grid', undo = [], redo = [];

    const blank = row => ({ items: ['_'], lens: [1], row, ts: [4, 4] });
    const isEmpty = b => b.items.every(x => x === '_') &&
      !(b.section || b.repStart || b.repEnd || b.ending || b.text || b.tsSet);
    const readFields = () => {
      song.title = $('#f-title').value.trim();
      song.composer = $('#f-composer').value.trim();
      song.style = $('#f-style').value;
      song.ts = $('#f-ts').value;
      song.key = $('#f-key').value.trim();
      song.tempo = Math.min(360, Math.max(30, Math.round(+$('#f-tempo').value) || 120));
    };
    const loadModel = () => {
      bars = Music.parseChart(song.chart, tsOf(song));
      if (!bars.length) bars = [blank(0)];
      cur = { b: 0, k: 0, fresh: true };
      target = 'root';
      undo = [];
      redo = [];
    };
    const item = () => bars[cur.b].items[cur.k];
    const setItem = v => { bars[cur.b].items[cur.k] = v; };
    const go = (b, k) => { cur = { b, k, fresh: true }; target = 'root'; };
    const nextPos = () => {
      if (cur.k + 1 < bars[cur.b].items.length) return { b: cur.b, k: cur.k + 1 };
      return cur.b + 1 < bars.length ? { b: cur.b + 1, k: 0 } : null;
    };
    const appendBar = () => {
      const last = bars[bars.length - 1];
      const inRow = bars.filter(b => b.row === last.row).length;
      bars.push(blank(last.row + (inRow >= colsOf(song) ? 1 : 0)));
      return { b: bars.length - 1, k: 0 };
    };

    // --- panel de botones ---
    const btn = (a, v, label, on) =>
      `<button type="button" data-a="${a}" data-v="${esc(v)}"${on ? ' class="on"' : ''}>${esc(label)}</button>`;
    const chordsPad = c => {
      const bass = target === 'bass';
      const letter = c && (bass ? c.bassLetter : c.letter);
      const acc = c ? plainAcc(bass ? c.bassAcc : c.acc) : '';
      return `<div class="kb k7">${ROOTS.map(r => btn('root', r, r, letter === r)).join('')}</div>
        <div class="kb k5">${btn('acc', 'b', '♭', acc === 'b')}${btn('acc', '#', '♯', acc === '#')}
          ${btn('bass', '', '/ bajo', bass)}${btn('rep', '', '%', item() === '%')}</div>
        <div class="kb k3">${btn('divide', '', 'Dividir')}${btn('push', '', 'Anticipar', !!(c && c.push))}${btn('cut', '', 'Corte', !!(c && c.cut))}${btn('del', '', 'Borrar')}</div>
        ${bass ? `<p class="hint">Elegí arriba la nota del bajo. ${btn('nobass', '', 'Sin bajo')}</p>`
          : c ? `<div class="kb quals scroll">${QUALS.map(q => btn('qual', q, q ? q.replace(/b/g, '♭').replace(/#/g, '♯') : 'mayor', c.qual === q)).join('')}</div>`
          : '<p class="hint">Tocá una nota para escribir el acorde en el lugar marcado.</p>'}`;
    };
    const otherPad = () => {
      const b = bars[cur.b], it = item();
      const meter = b.tsSet ? b.ts.join('/') : '';
      const group = (title, html) => `<h3>${title}</h3><div class="chips">${html}</div>`;
      return `<div class="other scroll">` +
        group('Parte', PARTS.map(s => btn('sec', s, s, b.section === s)).join('') +
          btn('sec', '?', 'Otra…', !!b.section && !PARTS.includes(b.section))) +
        group('Repetición', btn('rs', '', '|: Inicio', b.repStart) + btn('re', '', ':| Fin', b.repEnd) +
          (b.repEnd ? [2, 3, 4].map(n => btn('times', n, 'x' + n, (b.times || 2) === n)).join('') : '')) +
        group('Casilla', [1, 2, 3].map(n => btn('end', n, n + '.', b.ending === n)).join('')) +
        group('En el lugar marcado',
          btn('sym', 'N.C.', 'N.C. Silencio', it === 'N.C.')) +
        group('Dividir el compás', btn('divide', '', 'Dividir') + btn('divide', 3, 'Dividir en 3 (tresillo)') + btn('merge', '', 'Unir')) +
        group('Saltos y anotaciones', NOTES.map(s => btn('txt', s, s, b.text === s)).join('') +
          btn('txt', '?', 'Otra…', !!b.text && !NOTES.includes(b.text))) +
        group('Cambio de compás', METERS.map(m => btn('ts', m, m, meter === m)).join('')) +
        group('Compases', btn('insb', '', '+ Antes') + btn('insa', '', '+ Después') + btn('brk', '', 'Pasar a renglón nuevo') +
          btn('join', '', 'Subir al renglón anterior') + btn('delbar', '', 'Borrar compás') +
          btn('movl', '', '← Mover compás') + btn('movr', '', 'Mover compás →') +
          btn('partup', '', '↑ Subir parte') + btn('partdn', '', '↓ Bajar parte') +
          btn('copy', '', 'Copiar compás') + btn('copypart', '', 'Copiar parte') +
          (clip ? btn('paste', '', clip.length === 1 ? 'Pegar compás' : `Pegar ${clip.length} compases`) : '')) +
        '</div>';
    };

    // Con el compás dividido, una tira ancha muestra sus lugares para elegir en cuál escribir
    // (en la hoja los más cortos quedan muy chicos para tocarlos).
    const stripHtml = () => {
      const b = bars[cur.b];
      if (b.items.length < 2) return '';
      return `<div class="strip">${b.items.map((it, k) => `<button type="button" data-a="slot" data-v="${k}" style="flex:${b.lens[k]}" class="${k === cur.k ? 'on' : ''}${/^<|!$/.test(it) ? ' cut' : ''}">${it === '_' ? '' : esc(it.replace(/^<|!$/g, '').replace(/b/g, '♭').replace(/#/g, '♯'))}</button>`).join('')}</div>`;
    };
    const draw = () => {
      if (mode !== 'grid') return;
      Music.normalize(bars, tsOf(song));
      song.chart = Music.serialize(bars);
      $('#grid').innerHTML = rowsHtml(bars, colsOf(song), (b, i) => barHtml(b, i, 0, true, i === cur.b ? cur.k : -1));
      fitChords($('#grid'));
      keyHint();
      const old = $('.scroll', pad), keep = old && old.dataset.tab === tab ? old.scrollTop : 0;
      pad.innerHTML = `<div class="ptabs">${btn('tab', 'chords', 'Acordes', tab === 'chords')}${btn('tab', 'other', 'Otros', tab === 'other')}
        <span class="sp"></span><button type="button" data-a="undo" aria-label="Deshacer"${undo.length ? '' : ' disabled'}>${UNDO}</button>
        <button type="button" data-a="redo" aria-label="Rehacer"${redo.length ? '' : ' disabled'}>${REDO}</button>${btn('prev', '', '‹')}${btn('next', '', '›')}</div>` +
        stripHtml() + (tab === 'chords' ? chordsPad(Music.parseChord(item())) : otherPad());
      const sc = $('.scroll', pad);
      if (sc) { sc.dataset.tab = tab; sc.scrollTop = keep; }
      const el = $('#grid .ch.cur');
      if (el) el.scrollIntoView({ block: 'nearest' });
    };

    const preview = () => {
      song.chart = $('#f-chart').value;
      $('#preview').innerHTML = chartHtml(Music.parseChart(song.chart, tsOf(song)), 0, true, colsOf(song));
      fitChords($('#preview'));
      keyHint();
    };
    const drawBody = () => {
      $('.seg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
      pad.hidden = mode !== 'grid';
      if (mode === 'grid') {
        body.innerHTML = '<div class="chart ed" id="grid"></div>';
        loadModel();
        draw();
        return;
      }
      pad.innerHTML = '';
      body.innerHTML = `<div class="keys">${INSERTS.map((b, i) => `<button type="button" data-ins="${i}">${esc(b[0])}</button>`).join('')}</div>
        <textarea id="f-chart" rows="8" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Cifrado"></textarea>
        ${HELP}<h2>Vista previa</h2><div class="chart" id="preview"></div>`;
      const ta = $('#f-chart');
      ta.value = song.chart;
      // pointerdown + preventDefault: el teclado del celular no se cierra al tocar un botón.
      $('.keys').onpointerdown = e => {
        const el = e.target.closest('[data-ins]');
        if (!el) return;
        e.preventDefault();
        const [, text, back] = INSERTS[+el.dataset.ins];
        ta.focus();
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        if (back) ta.selectionStart = ta.selectionEnd = ta.selectionEnd - back;
        preview();
      };
      preview();
    };

    // Al salir del editor se vuelve a la canción tal como se había abierto (suelta o dentro de una lista).
    const before = trail.slice(0, -1).reverse();
    const songHash = before.find(h => h.startsWith('#/s/' + song.id)) || '#/s/' + song.id;
    // Lo que hay ahora en el editor, para saber si cambió algo desde que se abrió.
    let clean = '';
    const snapshot = () => {
      readFields();
      return JSON.stringify([song.title, song.composer, song.style, song.ts, song.key, song.tempo, colsOf(song),
        mode === 'grid' ? Music.serialize(bars) : $('#f-chart').value]);
    };
    const mayLeave = () => snapshot() === clean || confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?');
    const leave = () => {
      if (!mayLeave()) return;
      guard = null;
      up(existing ? songHash : '#/');
    };
    const ask = (msg, val, bad) => {
      const r = prompt(msg, val || '');
      return r === null ? null : r.replace(bad, '').trim();
    };
    // Cambia de lugar el compás marcado con su vecino; cada uno ocupa el renglón que tenía el otro.
    const moveBar = d => {
      const i = cur.b, j = i + d;
      if (j < 0 || j >= bars.length) return;
      [bars[i].row, bars[j].row] = [bars[j].row, bars[i].row];
      [bars[i], bars[j]] = [bars[j], bars[i]];
      go(j, cur.k);
    };
    // Cambia de lugar la parte del compás marcado con la de al lado. Una parte va desde su letra de ensayo
    // hasta la siguiente; cada una conserva sus cortes de renglón y empieza en renglón nuevo.
    const movePart = d => {
      const starts = [];
      bars.forEach((b, i) => { if (i === 0 || b.section) starts.push(i); });
      const chunks = starts.map((a, n) => bars.slice(a, n + 1 < starts.length ? starts[n + 1] : bars.length));
      const p = chunks.findIndex(ch => ch.includes(bars[cur.b])), q = p + d;
      if (q < 0 || q >= chunks.length) return;
      const marked = bars[cur.b];
      [chunks[p], chunks[q]] = [chunks[q], chunks[p]];
      let row = -1;
      bars = chunks.flatMap(chunk => {
        let was = null;
        return chunk.map(b => {
          if (b.row !== was) { row++; was = b.row; }
          b.row = row;
          return b;
        });
      });
      go(bars.indexOf(marked), cur.k);
    };
    // Con algo recién escrito en el lugar marcado, lo siguiente pasa al próximo lugar si está libre.
    const advance = () => {
      if (item() === '_' || cur.fresh) return;
      const p = nextPos();
      if (!p) cur = { ...appendBar() };
      else if (bars[p.b].items[p.k] === '_') cur = { ...p };
    };
    // Cada acción del panel modifica los compases; después se redibuja todo.
    const edits = {
      tab: el => { tab = el.dataset.v; target = 'root'; },
      prev: () => {
        if (cur.k > 0) go(cur.b, cur.k - 1);
        else if (cur.b > 0) go(cur.b - 1, bars[cur.b - 1].items.length - 1);
      },
      next: () => { const p = nextPos() || appendBar(); go(p.b, p.k); },
      root: el => {
        const c = Music.parseChord(item());
        if (target === 'bass') {
          if (c) { c.bassLetter = el.dataset.v; c.bassAcc = ''; setItem(chordText(c)); }
          return;
        }
        advance();
        setItem(el.dataset.v);
        cur.fresh = false;
      },
      // Repetir el compás anterior: se escribe igual que un acorde, así se pueden encadenar varios.
      rep: () => {
        target = 'root';
        advance();
        if (bars[cur.b].items.length > 1) { toast('El % repite un compás entero: usalo en un compás sin dividir.'); return; }
        setItem('%');
        cur.fresh = false;
      },
      acc: el => {
        const c = Music.parseChord(item());
        if (!c) return;
        const v = el.dataset.v;
        if (target === 'bass') { if (!c.bassLetter) return; c.bassAcc = plainAcc(c.bassAcc) === v ? '' : v; }
        else c.acc = plainAcc(c.acc) === v ? '' : v;
        setItem(chordText(c));
        cur.fresh = false;
      },
      qual: el => {
        const c = Music.parseChord(item());
        if (!c) return;
        c.qual = el.dataset.v;
        setItem(chordText(c));
        cur.fresh = false;
      },
      bass: () => { if (Music.parseChord(item())) target = target === 'bass' ? 'root' : 'bass'; },
      // Anticipación: el acorde queda escrito en su lugar pero empieza a sonar una corchea antes.
      push: () => {
        const c = Music.parseChord(item());
        if (!c) { toast('La anticipación se pone sobre un acorde: escribilo primero.'); return; }
        c.push = !c.push;
        setItem(chordText(c));
        cur.fresh = false;
      },
      // Corte: golpe seco de la banda en este acorde y silencio hasta el próximo acorde escrito.
      cut: () => {
        const c = Music.parseChord(item());
        if (!c) { toast('El corte se pone sobre un acorde: escribilo primero.'); return; }
        c.cut = !c.cut;
        setItem(chordText(c));
        cur.fresh = false;
      },
      nobass: () => {
        const c = Music.parseChord(item());
        if (c) { c.bassLetter = null; setItem(chordText(c)); }
        target = 'root';
      },
      // Parte el lugar marcado (por la mitad, o como pida el compás) y pasa a la segunda parte, lista para escribir.
      divide: el => {
        if (Music.split(bars[cur.b], cur.k, +el.dataset.v || 0)) go(cur.b, cur.k + 1);
        else toast('No se puede dividir más chico que una semicorchea.');
      },
      // Deshace la división del lugar marcado.
      merge: () => {
        const k = Music.join(bars[cur.b], cur.k);
        if (k >= 0) go(cur.b, k);
        else toast(bars[cur.b].items.length > 1 ? 'Primero uní las partes más chicas de al lado.' : 'Este compás no está dividido.');
      },
      slot: el => go(cur.b, +el.dataset.v),
      del: () => {
        const b = bars[cur.b];
        if (item() !== '_') { setItem('_'); go(cur.b, cur.k); }
        else if (b.items.length > 1) { const k = Music.join(b, cur.k); if (k >= 0) go(cur.b, k); }
        else if (bars.length > 1 && isEmpty(b)) {
          bars.splice(cur.b, 1);
          const i = Math.max(0, cur.b - 1);
          go(i, bars[i].items.length - 1);
        }
      },
      sec: el => {
        const b = bars[cur.b];
        let v = el.dataset.v;
        if (v === '?') { v = ask('Nombre de la parte:', b.section, /[\[\]"|]/g); if (v === null) return; b.section = v || undefined; }
        else b.section = b.section === v ? undefined : v;
      },
      txt: el => {
        const b = bars[cur.b];
        let v = el.dataset.v;
        if (v === '?') { v = ask('Anotación sobre el compás:', b.text, /"/g); if (v === null) return; b.text = v || undefined; }
        else b.text = b.text === v ? undefined : v;
      },
      rs: () => { bars[cur.b].repStart = !bars[cur.b].repStart; },
      re: () => { const b = bars[cur.b]; b.repEnd = !b.repEnd; delete b.times; },
      times: el => { bars[cur.b].times = +el.dataset.v; },
      end: el => { const b = bars[cur.b], n = +el.dataset.v; b.ending = b.ending === n ? undefined : n; },
      sym: el => { setItem(item() === el.dataset.v ? '_' : el.dataset.v); cur.fresh = true; },
      ts: el => {
        const b = bars[cur.b], v = el.dataset.v;
        if (b.tsSet && b.ts.join('/') === v) b.tsSet = false;
        else { b.ts = v.split('/').map(Number); b.tsSet = true; }
      },
      insb: () => { bars.splice(cur.b, 0, blank(bars[cur.b].row)); go(cur.b, 0); },
      insa: () => { bars.splice(cur.b + 1, 0, blank(bars[cur.b].row)); go(cur.b + 1, 0); },
      brk: () => {
        if (cur.b > 0 && bars[cur.b - 1].row === bars[cur.b].row) for (let j = cur.b; j < bars.length; j++) bars[j].row++;
      },
      join: () => {
        if (cur.b === 0) return;
        const d = bars[cur.b].row - bars[cur.b - 1].row;
        for (let j = cur.b; j < bars.length; j++) bars[j].row -= d;
      },
      copy: () => { clip = JSON.parse(JSON.stringify([bars[cur.b]])); toast('Compás copiado.'); },
      copypart: () => {
        let a = cur.b, b = a + 1;
        while (a > 0 && !bars[a].section) a--;
        while (b < bars.length && !bars[b].section) b++;
        clip = JSON.parse(JSON.stringify(bars.slice(a, b)));
        toast(`Parte copiada (${clip.length} compases).`);
      },
      // Un compás se pega al lado; una parte se pega en renglones nuevos, al terminar la parte actual.
      paste: () => {
        if (!clip) return;
        const copies = JSON.parse(JSON.stringify(clip));
        if (copies.length === 1) {
          copies[0].row = bars[cur.b].row;
          bars.splice(cur.b + 1, 0, copies[0]);
          go(cur.b + 1, 0);
          return;
        }
        let end = cur.b;
        while (end + 1 < bars.length && !bars[end + 1].section) end++;
        const here = bars[end].row, first = copies[0].row;
        copies.forEach(c => { c.row += here + 1 - first; });
        const split = end + 1 < bars.length && bars[end + 1].row === here ? 1 : 0;
        const span = copies[copies.length - 1].row - here + split;
        for (let j = end + 1; j < bars.length; j++) bars[j].row += span;
        bars.splice(end + 1, 0, ...copies);
        go(end + 1, 0);
      },
      movl: () => moveBar(-1),
      movr: () => moveBar(1),
      partup: () => movePart(-1),
      partdn: () => movePart(1),
      delbar: () => {
        if (bars.length > 1) bars.splice(cur.b, 1); else bars = [blank(0)];
        go(Math.min(cur.b, bars.length - 1), 0);
      },
    };
    const actions = {
      cancel: leave,
      mode: el => {
        if (el.dataset.v === mode) return;
        mode = el.dataset.v;
        drawBody();
      },
      save: () => {
        readFields();
        if (mode === 'grid') {
          const kept = bars.slice();
          while (kept.length && isEmpty(kept[kept.length - 1])) kept.pop();
          song.chart = Music.serialize(kept);
        } else song.chart = $('#f-chart').value;
        if (!song.title) song.title = 'Sin título';
        const i = songs.findIndex(s => s.id === song.id);
        if (i >= 0) songs[i] = song; else songs.push(song);
        saveSongs();
        guard = null;
        if (existing) up(songHash); else swap('#/s/' + song.id);
      },
      delete: () => {
        if (!confirm(`¿Borrar "${song.title}"? No se puede deshacer.`)) return;
        songs = songs.filter(s => s.id !== song.id);
        saveSongs();
        lists.forEach(l => { l.songs = l.songs.filter(x => x !== song.id); });
        saveLists();
        guard = null;
        up(before.find(h => !h.startsWith('#/s/' + song.id) && !h.startsWith('#/e/')) || '#/');
      },
      // La copia lleva lo que hay en pantalla; la original queda como estaba guardada.
      dup: () => {
        readFields();
        const chart = mode === 'grid' ? Music.serialize(bars) : $('#f-chart').value;
        const copy = { ...song, id: newId(), title: (song.title || 'Sin título') + ' (copia)', chart };
        songs.push(copy);
        saveSongs();
        guard = null;
        swap('#/e/' + copy.id);
      },
    };
    for (const k in edits) actions[k] = el => {
      const before = JSON.stringify(bars), at = { ...cur };
      edits[k](el);
      if (JSON.stringify(bars) !== before) {
        undo.push({ bars: before, cur: at });
        if (undo.length > 100) undo.shift();
        redo = [];
      }
      draw();
    };
    const restore = (from, to) => {
      if (!from.length) return;
      to.push({ bars: JSON.stringify(bars), cur: { ...cur } });
      const s = from.pop();
      bars = JSON.parse(s.bars);
      cur = { ...s.cur, fresh: true };
      target = 'root';
      draw();
    };
    actions.undo = () => restore(undo, redo);
    actions.redo = () => restore(redo, undo);

    // Compases por renglón: al cambiarlo se reacomoda toda la hoja (cada parte sigue empezando en renglón nuevo).
    const drawCols = () => app.querySelectorAll('[data-a="cols"]').forEach(b => b.classList.toggle('on', +b.dataset.v === colsOf(song)));
    actions.cols = el => {
      song.cols = +el.dataset.v;
      drawCols();
      if (mode !== 'grid') { preview(); return; }
      const before = JSON.stringify(bars), at = { ...cur };
      let row = -1, n = 0;
      for (const b of bars) {
        if (n === 0 || n >= song.cols || b.section) { row++; n = 0; }
        b.row = row;
        n++;
      }
      if (JSON.stringify(bars) !== before) { undo.push({ bars: before, cur: at }); redo = []; }
      draw();
    };
    drawCols();

    // Tonalidad por botones: nota, alteración y modo. Se guarda como texto ("Bb", "F#m") en el campo oculto.
    const k0 = Music.parseChord(song.key || '');
    let key = k0 ? { note: k0.letter, acc: plainAcc(k0.acc), minor: /^(m(?!aj)|min|-)/.test(k0.qual) } : null;
    // Si no hay tonalidad elegida, propone la que surge de los acordes escritos.
    const keyHint = () => {
      const el = $('.khint'), ta = $('#f-chart');
      const g = key ? '' : Music.guessKey(mode === 'grid' ? bars : Music.parseChart(ta ? ta.value : '', tsOf(song)));
      el.hidden = !g;
      el.dataset.v = g;
      el.textContent = g ? `Sugerida por los acordes: ${g.replace('b', '♭').replace('#', '♯')} · Usar` : '';
    };
    const drawKey = () => {
      $('#f-key').value = key ? key.note + key.acc + (key.minor ? 'm' : '') : '';
      keyHint();
      app.querySelectorAll('.keypick button[data-a^="k"]').forEach(b => {
        const a = b.dataset.a, v = b.dataset.v;
        if (a === 'kuse') return;
        b.classList.toggle('on', a === 'knone' ? !key : !!key &&
          (a === 'knote' ? key.note === v : a === 'kacc' ? key.acc === v : key.minor === (v === 'm')));
        if (a === 'kacc' || a === 'kmode') b.disabled = !key;
      });
      readFields();
    };
    Object.assign(actions, {
      knote: el => { key = { note: el.dataset.v, acc: '', minor: key ? key.minor : false }; drawKey(); },
      kacc: el => { if (key) { key.acc = key.acc === el.dataset.v ? '' : el.dataset.v; drawKey(); } },
      kmode: el => { if (key) { key.minor = el.dataset.v === 'm'; drawKey(); } },
      knone: () => { key = null; drawKey(); },
      kuse: el => {
        const c = Music.parseChord(el.dataset.v);
        if (c) { key = { note: c.letter, acc: plainAcc(c.acc), minor: c.qual === 'm' }; drawKey(); }
      },
    });
    drawKey();
    bind(actions);

    body.onclick = e => {
      const bar = mode === 'grid' && e.target.closest('.bar');
      if (!bar) return;
      const ch = e.target.closest('.ch');
      go(+bar.dataset.i, ch ? +ch.dataset.k : 0);
      draw();
    };
    app.oninput = e => {
      // Al elegir un estilo que no se toca en 4/4, el compás de la canción lo acompaña.
      const need = e.target.id === 'f-style' && STYLE_METER[e.target.value];
      if (need && $('#f-ts').value === '4/4') {
        $('#f-ts').value = need;
        toast(`Compás cambiado a ${need}, que es el de este estilo.`);
      }
      readFields();
      if (mode === 'text') preview();
      else if (e.target.id === 'f-ts' || need) draw();
    };
    drawBody();
    clean = snapshot();
    guard = mayLeave;
  }

  // --- navegación ---
  function route() {
    guard = null;
    Engine.stop();
    wake(false);
    const [kind, id, extra] = location.hash.slice(2).split('/');
    const song = findSong(id), set = lists.find(l => l.id === (kind === 'l' ? id : extra));
    if (kind === 's' && song) songView(song, set);
    else if (kind === 'l' && set) listView(set);
    else if (kind === 'e') editView(id);
    else if (kind === 'i') importView(id);
    else if (kind === 'r') receiveView();
    else libraryView();
    window.scrollTo(0, 0);
  }
  // `guard` lo pone el editor: con cambios sin guardar, pregunta antes de dejar salir con el botón Atrás.
  // Si la persona se arrepiente, se vuelve a la dirección del editor sin redibujar nada.
  let restoring = false;
  window.addEventListener('hashchange', () => {
    if (restoring) { restoring = false; return; }
    const n = trail.length, back = n > 1 && trail[n - 2] === here();
    if (guard && back && !guard()) { restoring = true; history.forward(); return; }
    syncTrail();
    route();
  });
  route();

  // --- canciones incluidas con la app (incluidas.json) ---
  // Cada una se agrega una sola vez. Si el usuario la borra, no vuelve; si la edita, una versión nueva no la pisa;
  // si no la tocó y la app trae una corrección, se actualiza.
  const stamp = s => {
    const t = JSON.stringify(songRow(s));
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = (h * 33 ^ t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };
  (async () => {
    let data;
    try { data = await (await fetch('incluidas.json')).json(); } catch { return; }
    const seen = settings.builtins;
    let changed = false;
    for (const raw of Array.isArray(data.songs) ? data.songs : []) {
      if (!raw || !raw.id || typeof raw.chart !== 'string') continue;
      const s = { ...cleanSong(raw), transpose: 0, builtin: true }, h = stamp(s), mine = findSong(s.id);
      if (seen[s.id] === h) continue;
      if (!(s.id in seen)) {
        if (!mine) { songs.push(s); changed = true; }
      } else if (mine && stamp(mine) === seen[s.id]) {
        songs[songs.indexOf(mine)] = s;
        changed = true;
      }
      seen[s.id] = h;
    }
    saveSettings();
    if (!changed) return;
    saveSongs();
    if (here() === '#/') route();
  })();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // Cuando llega una versión nueva mientras se mira la biblioteca, se recarga sola para mostrarla.
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadWorker && location.hash.length < 3) location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
