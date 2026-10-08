(() => {
  'use strict';

  // Subir este número en cada publicación: se muestra en la biblioteca para saber qué versión corre el teléfono.
  const VERSION = 8;
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

  const DEMOS = [
    {
      id: 'demo-blues', title: 'Blues en Fa (ejemplo)', composer: 'Tradicional', style: 'swing',
      key: 'F', tempo: 132, ts: '4/4', transpose: 0,
      chart: '[A]\n| F7 | Bb7 | F7 | Cm7 F7 |\n| Bb7 | Bdim7 | F7 | Am7 D7 |\n| Gm7 | C7 | F7 D7 | Gm7 C7 |',
    },
    {
      id: 'demo-bossa', title: 'Bossa con casillas (ejemplo)', composer: '', style: 'bossa',
      key: 'C', tempo: 126, ts: '4/4', transpose: 0,
      chart: '[A]\n|: Cmaj7 | % | D7 | % |\n| Dm7 | G7 | 1. Cmaj7 | Dm7 G7 :|\n| 2. Cmaj7 | % |\n[B]\n| Gm7 | C7 | Fmaj7 | % |\n| Fm7 | Bb7 | Em7 A7 | Dm7 G7 |',
    },
    {
      id: 'demo-vals', title: 'Vals en La menor (ejemplo)', composer: '', style: 'balada',
      key: 'Am', tempo: 140, ts: '3/4', transpose: 0,
      chart: '[A]\n|: Am | Dm | E7 | Am |\n| F | C | E7 | Am :|',
    },
  ];

  // --- almacenamiento ---
  const SONGS = 'airrial.songs.v1', SETTINGS = 'airrial.settings.v1';
  const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };

  let songs = load(SONGS, null);
  if (!songs) { songs = DEMOS.map(d => ({ ...d })); store(SONGS, songs); }
  const settings = Object.assign({ theme: 'dark', choruses: 3, countIn: true }, load(SETTINGS, {}));
  if (typeof settings.choruses !== 'number') settings.choruses = 3;
  settings.hints = settings.hints || {};
  settings.vol = Object.assign({ bass: 0.8, keys: 0.6, drums: 0.7, click: 0 }, settings.vol);
  const saveSongs = () => store(SONGS, songs);
  const saveSettings = () => store(SETTINGS, settings);
  const findSong = id => songs.find(s => s.id === id);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const tsOf = s => (s.ts || '4/4').split('/').map(Number);

  document.documentElement.dataset.theme = settings.theme;
  for (const k in settings.vol) Engine.setVol(k, settings.vol[k]);
  // Le pide al navegador que no borre las canciones cuando el teléfono se queda sin espacio.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const cleanSong = s => ({
    id: String(s.id || newId()), title: String(s.title || 'Sin título'), composer: String(s.composer || ''),
    style: STYLES.some(x => x[0] === s.style) ? s.style : 'swing', key: String(s.key || ''),
    tempo: Math.min(360, Math.max(30, +s.tempo || 120)), ts: METERS.includes(s.ts) ? s.ts : '4/4',
    transpose: Math.round(+s.transpose || 0) % 12, chart: String(s.chart || ''),
  });

  // Una canción entera viaja dentro del enlace que se comparte.
  const packSong = s => {
    const bytes = new TextEncoder().encode(JSON.stringify([1, s.title, s.composer, s.style, s.key, s.tempo, s.ts, s.chart]));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unpackSong = code => {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const a = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
    if (!Array.isArray(a) || a[0] !== 1) throw new Error('formato');
    return cleanSong({ title: a[1], composer: a[2], style: a[3], key: a[4], tempo: a[5], ts: a[6], chart: a[7] });
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
    const d = Music.spell(c, semis, flats);
    return `<b>${esc(d.root)}</b>${d.qual ? `<i>${esc(d.qual)}</i>` : ''}${d.bass ? `<u>/${esc(d.bass)}</u>` : ''}`;
  }

  // Con `sel` (lugar marcado, o -1) dibuja la versión editable: todos los lugares se pueden tocar.
  function barHtml(b, i, semis, flats, sel) {
    const edit = sel !== undefined;
    const B = b.ts[0], items = b.items, n = items.length, pos = Music.positions(n, B);
    let chs = '', minSpan = B;
    items.forEach((it, k) => {
      if (edit) {
        const inner = it === '.' ? '<span class="rp">·</span>' : tokHtml(it, semis, flats);
        chs += `<span class="ch${k === sel ? ' cur' : ''}" data-k="${k}">${inner}</span>`;
        return;
      }
      if (it === '.') return;
      let end = B;
      for (let j = k + 1; j < n; j++) if (items[j] !== '.') { end = pos[j]; break; }
      minSpan = Math.min(minSpan, end - pos[k]);
      const place = n <= B ? ` style="grid-column:${pos[k] + 1}/${end + 1}"` : '';
      chs += `<span class="ch"${place}>${tokHtml(it, semis, flats)}</span>`;
    });
    const frac = edit ? 1 / n : minSpan / B;
    // Los acordes largos (Bbmaj7/D) bajan un escalón de tamaño para no pisar al vecino.
    const long = items.some(it => it.length > 5) ? 1 : 0;
    const size = ['n1', 'n2', 'n3'][Math.min(2, (frac >= 1 ? 0 : frac >= 0.5 ? 1 : 2) + long)];
    const lab = (b.section ? `<span class="sec">${esc(b.section)}</span>` : '') +
      (b.ending ? `<span class="end">${b.ending}.</span>` : '') +
      (b.text ? `<span class="txt">${esc(b.text)}</span>` : '');
    const cols = !edit && n <= B ? `grid-template-columns:repeat(${B},1fr)` : 'grid-auto-flow:column;grid-auto-columns:1fr';
    return `<div class="bar${b.repStart ? ' rs' : ''}${b.repEnd ? ' re' : ''}" data-i="${i}">` +
      `<div class="lab">${lab}</div><div class="cell ${size}">` +
      (b.showTs ? `<span class="ts"><b>${b.ts[0]}</b><b>${b.ts[1]}</b></span>` : '') +
      `<div class="chs" style="${cols}">${chs}</div>` +
      (b.repEnd && b.times > 2 ? `<span class="tm">x${b.times}</span>` : '') +
      '</div></div>';
  }

  function chartHtml(bars, semis, flats) {
    if (!bars.length) return '<p class="empty">Todavía no hay compases escritos.</p>';
    let html = '', row = null;
    bars.forEach((b, i) => {
      if (b.row !== row) { html += (row === null ? '' : '</div>') + '<div class="row">'; row = b.row; }
      html += barHtml(b, i, semis, flats);
    });
    return html + '</div>';
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
  function libraryView() {
    app.innerHTML = `
      <header class="top"><div class="ttl"><h1>Airrial</h1><p>Mis cifrados · versión ${VERSION}</p></div>
        <button class="tx" data-a="menu">Menú</button></header>
      <div class="search"><input id="q" type="search" placeholder="Buscar canción o autor…" autocomplete="off"></div>
      <main class="list" id="list"></main>
      <button class="fab" data-a="new" aria-label="Nueva canción">+</button>
      <dialog id="menu"><div class="sheet">
        <button data-a="export">Exportar todas (copia de seguridad)</button>
        <p class="hint" id="age">${backupAge()}</p>
        <button data-a="import">Importar canciones</button>
        <button data-a="theme">Cambiar a tema claro / oscuro</button>
        <button data-a="close">Cerrar</button>
        <input type="file" id="file" accept=".json,application/json" hidden>
      </div></dialog>`;
    const list = $('#list'), q = $('#q');
    const draw = () => {
      const f = q.value.trim().toLowerCase();
      const shown = songs
        .filter(s => !f || (s.title + ' ' + (s.composer || '')).toLowerCase().includes(f))
        .sort((a, b) => a.title.localeCompare(b.title, 'es'));
      list.innerHTML = shown.length ? shown.map(s => `
        <a class="item" href="#/s/${esc(s.id)}"><b>${esc(s.title)}</b>
        <span>${esc([s.composer, styleName(s.style), s.key, s.ts].filter(Boolean).join(' · '))}</span></a>`).join('')
        : `<p class="empty">${songs.length ? 'Ninguna canción coincide con la búsqueda.' : 'No hay canciones. Tocá + para escribir la primera.'}</p>`;
    };
    draw();
    bind({
      new: () => { location.hash = '#/e/new'; },
      menu: () => $('#menu').showModal(),
      close: () => $('#menu').close(),
      theme: () => {
        settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = settings.theme;
        saveSettings();
      },
      export: () => {
        const blob = new Blob([JSON.stringify({ app: 'airrial', version: 1, songs }, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'airrial-canciones.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
        const data = JSON.parse(await e.target.files[0].text());
        const incoming = (Array.isArray(data) ? data : data.songs).filter(s => s && typeof s.chart === 'string');
        for (const s of incoming) {
          const song = cleanSong(s);
          const i = songs.findIndex(x => x.id === song.id);
          if (i >= 0) songs[i] = song; else songs.push(song);
        }
        saveSongs();
        $('#menu').close();
        draw();
        alert(`Se importaron ${incoming.length} canciones.`);
      } catch {
        alert('No se pudo leer ese archivo. Tiene que ser un archivo exportado desde Airrial.');
      }
      e.target.value = '';
    };
  }

  // --- canción ---
  const PLAY = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 4v16l14-8z" fill="currentColor"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 6h12v12H6z" fill="currentColor"/></svg>';
  const line = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const SHARE = line('M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7');
  const UNDO = line('M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
  const REDO = line('m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3');

  function songView(song) {
    const vol = settings.vol;
    const slider = (k, name) => `<label>${name}<input type="range" min="0" max="1" step="0.05" data-vol="${k}" value="${vol[k]}"></label>`;
    app.innerHTML = `
      <header class="top"><button class="ic" data-a="back" aria-label="Volver">‹</button>
        <div class="ttl"><h1>${esc(song.title)}</h1>
        <p>${esc([song.composer, song.ts].filter(Boolean).join(' · '))}</p></div>
        <button class="ic2" data-a="share" aria-label="Compartir">${SHARE}</button>
        <button class="tx" data-a="edit">Editar</button></header>
      <main class="chart" id="chart"></main>
      <footer class="ctl${settings.sheetOpen ? ' open' : ''}" id="sheet">
        <button class="grab" data-a="sheet" aria-label="Mostrar u ocultar más opciones" aria-expanded="${!!settings.sheetOpen}">
          <i></i><span>Estilo, vueltas y mezcla</span></button>
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
        <div class="more"><div class="in">
          <div class="r">
            <label class="fld">Estilo<select id="style" aria-label="Estilo">${STYLES.map(s => `<option value="${s[0]}"${s[0] === song.style ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>
            <label class="fld">Vueltas<select id="reps" aria-label="Vueltas">${[1, 2, 3, 4, 6, 999].map(n => `<option value="${n}"${n === settings.choruses ? ' selected' : ''}>${n === 999 ? 'Sin fin' : n + (n === 1 ? ' vuelta' : ' vueltas')}</option>`).join('')}</select></label>
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
    const draw = () => {
      bars = Music.parseChart(song.chart, tsOf(song));
      const semis = song.transpose || 0;
      const key = keyOf(song, bars);
      const flats = Music.useFlats(key, semis);
      chart.innerHTML = chartHtml(bars, semis, flats);
      markFrom();
      $('#key').textContent = song.key ? Music.transposeName(song.key, semis, flats) : (semis > 0 ? '+' : '') + semis;
    };
    const setPlaying = on => {
      $('#play').innerHTML = on ? STOP : PLAY;
      $('#play').classList.toggle('on', on);
      if (!on) chart.querySelectorAll('.bar.on').forEach(el => el.classList.remove('on'));
    };
    const restart = () => { if (Engine.isPlaying()) start(); };
    const start = () => {
      const semis = song.transpose || 0;
      let seq, choruses = settings.choruses, finalChord = null;
      if (range && range.b != null) {
        // El tramo suena de corrido, sin las repeticiones ni casillas que tenga adentro.
        seq = bars.slice(range.a, range.b + 1).map((_, i) => i + range.a);
      } else {
        seq = Music.unfold(bars);
        const k = Music.parseChord(song.key || '');
        if (k && choruses !== 999) {
          const root = (k.num + semis + 120) % 12;
          finalChord = { root, bass: root, iv: Music.intervals(k.qual) };
        }
      }
      const ok = Engine.play({
        seq,
        startPos: from == null ? 0 : Math.max(0, seq.indexOf(from)),
        finalChord,
        bars: Music.resolve(bars, semis),
        getTempo: () => song.tempo,
        style: song.style,
        choruses,
        countIn: settings.countIn,
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
    bind({
      back: () => { location.hash = '#/'; },
      edit: () => { location.hash = '#/e/' + song.id; },
      share: async () => {
        const url = location.origin + location.pathname + '#/i/' + packSong(song);
        try {
          if (navigator.share) { await navigator.share({ title: song.title, text: `${song.title} (cifrado en Airrial)`, url }); return; }
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
        try { await navigator.clipboard.writeText(url); toast('Enlace copiado. Pegalo donde quieras compartirlo.'); }
        catch { prompt('Copiá este enlace para compartir la canción:', url); }
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
    const tapBar = i => {
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
      restart();
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
      if (!el) return;
      down = [e.clientX, e.clientY];
      hold = setTimeout(() => { held = true; hold = null; holdBar(+el.dataset.i); }, 500);
    };
    chart.onpointermove = e => {
      if (hold && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 14) cancelHold();
    };
    chart.onpointerup = chart.onpointercancel = chart.onpointerleave = cancelHold;
    chart.onscroll = cancelHold;
    chart.oncontextmenu = e => e.preventDefault();
    chart.onclick = e => {
      const el = e.target.closest('.bar');
      if (held) { held = false; return; }
      if (el) tapBar(+el.dataset.i);
    };
    app.oninput = e => {
      const k = e.target.dataset.vol;
      if (k) { vol[k] = +e.target.value; Engine.setVol(k, vol[k]); saveSettings(); }
    };
    app.onchange = e => {
      const t = e.target;
      if (t.id === 'tempo') setTempo(+t.value);
      else if (t.id === 'style') { song.style = t.value; saveSongs(); restart(); }
      else if (t.id === 'reps') { settings.choruses = +t.value; saveSettings(); restart(); }
      else if (t.id === 'countin') { settings.countIn = t.checked; saveSettings(); }
    };
  }

  // --- canción recibida por enlace ---
  function importView(code) {
    let song = null;
    try { song = unpackSong(code || ''); } catch { /* enlace roto */ }
    const head = (title, save) => `<header class="top"><button class="tx" data-a="cancel">Cancelar</button>
      <div class="ttl"><h1>${title}</h1></div>${save ? '<button class="tx pri" data-a="save">Guardar</button>' : ''}</header>`;
    const actions = { cancel: () => { location.hash = '#/'; } };
    if (!song) {
      app.innerHTML = head('Enlace no válido') + '<main><p class="empty">Este enlace está incompleto o no es de Airrial. Pedí que te lo manden de nuevo.</p></main>';
      bind(actions);
      return;
    }
    const bars = Music.parseChart(song.chart, tsOf(song));
    app.innerHTML = head('Canción compartida', true) + `<main class="chart">
      <div class="shared"><b>${esc(song.title)}</b>
      <span>${esc([song.composer, styleName(song.style), song.key, song.ts, song.tempo + ' bpm'].filter(Boolean).join(' · '))}</span></div>
      ${chartHtml(bars, 0, true)}</main>`;
    actions.save = () => {
      const same = songs.find(s => s.title === song.title && s.chart === song.chart);
      if (!same) { song.id = newId(); songs.push(song); saveSongs(); }
      location.replace('#/s/' + (same || song).id);
    };
    bind(actions);
  }

  // --- editor ---
  const INSERTS = [
    ['|', ' | '], ['|:', '|: '], [':|', ' :|'], ['%', '% '], ['[A]', '[]', 1], ['1.', '1. '], ['2.', '2. '],
    ['#', '#'], ['b', 'b'], ['m', 'm'], ['7', '7'], ['m7', 'm7'], ['maj7', 'maj7'], ['m7b5', 'm7b5'],
    ['dim', 'dim'], ['sus4', 'sus4'], ['6', '6'], ['9', '9'], ['/', '/'], ['.', ' . '], ['N.C.', 'N.C. '], ['↵', '\n'],
  ];
  const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const QUALS = [
    '', 'm', '7', 'maj7', 'm7', '6', 'm6', '9', 'm9', 'maj9',
    'sus4', '7sus4', 'dim', 'm7b5', 'dim7', 'aug', '7b9', '7#9', '13', 'add9',
    'sus2', '7#5', '7b5', '7#11', '11', 'm11', 'mMaj7', '6/9', '7alt', '5',
  ];
  const PARTS = ['A', 'B', 'C', 'D', 'Intro', 'Estribillo', 'Puente', 'Solo', 'Final'];
  const NOTES = ['Fine', 'D.C.', 'D.S.', 'Segno', 'Coda', 'Al Coda'];
  const plainAcc = a => (a === '♯' ? '#' : a === '♭' ? 'b' : a);
  const chordText = c => c.letter + plainAcc(c.acc) + c.qual +
    (c.bassLetter ? '/' + c.bassLetter + plainAcc(c.bassAcc) : '');
  const HELP = `<details class="help"><summary>Cómo se escribe</summary>
    <ul>
      <li>Separá los compases con <code>|</code>. Cada renglón de texto es un renglón de la partitura.</li>
      <li>Dos acordes en un compás se reparten por la mitad: <code>| Dm7 G7 |</code>. Con <code>.</code> alargás el acorde anterior un tiempo: <code>| C . . G7 |</code>.</li>
      <li><code>%</code> repite el compás anterior. <code>N.C.</code> es silencio de la banda. <code>_</code> es un compás vacío.</li>
      <li>Partes: <code>[A]</code>, <code>[Estribillo]</code>. Repetición: <code>|:</code> … <code>:|</code> (o <code>:| x3</code>).</li>
      <li>Casillas: <code>1.</code> y <code>2.</code> al empezar el compás.</li>
      <li>Cambio de compás: <code>3/4</code> al empezar el compás. Texto libre entre comillas: <code>"Fine"</code>.</li>
      <li>Acordes: <code>C</code> <code>F#m7</code> <code>Bbmaj7</code> <code>E7b9</code> <code>Am7b5</code> <code>Gsus4</code> <code>D/F#</code>.</li>
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
          <label>Tonalidad<input id="f-key" value="${esc(song.key)}" placeholder="C, Am, Bb…" autocomplete="off" autocapitalize="off"></label>
          <label>Tempo<input id="f-tempo" type="number" inputmode="numeric" min="30" max="360" value="${song.tempo}"></label>
        </div></details>
        <div class="seg"><button data-a="mode" data-v="grid">Botones</button><button data-a="mode" data-v="text">Texto</button></div>
        <div id="body"></div>
        ${existing ? '<button class="ghost" data-a="dup">Duplicar esta canción</button><button class="danger" data-a="delete">Borrar esta canción</button>' : ''}
      </main>
      <footer class="pad" id="pad"></footer>`;

    const body = $('#body'), pad = $('#pad');
    let bars = [], cur = { b: 0, k: 0, fresh: true }, target = 'root', tab = 'chords', mode = 'grid', undo = [], redo = [];

    const blank = row => ({ items: ['_'], row, ts: [4, 4] });
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
      bars.push(blank(last.row + (inRow >= 4 ? 1 : 0)));
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
          ${btn('bass', '', '/ bajo', bass)}${btn('add', '', '+ acorde')}${btn('del', '', 'Borrar')}</div>
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
        group('En el lugar marcado', btn('sym', '%', '% Repetir compás', it === '%') +
          btn('sym', 'N.C.', 'N.C. Silencio', it === 'N.C.') + btn('sym', '.', '· Alargar el anterior', it === '.')) +
        group('Anotación', NOTES.map(s => btn('txt', s, s, b.text === s)).join('') +
          btn('txt', '?', 'Otra…', !!b.text && !NOTES.includes(b.text))) +
        group('Cambio de compás', METERS.map(m => btn('ts', m, m, meter === m)).join('')) +
        group('Compases', btn('insb', '', '+ Antes') + btn('insa', '', '+ Después') + btn('brk', '', 'Pasar a renglón nuevo') +
          btn('join', '', 'Subir al renglón anterior') + btn('delbar', '', 'Borrar compás') +
          btn('copy', '', 'Copiar compás') + btn('copypart', '', 'Copiar parte') +
          (clip ? btn('paste', '', clip.length === 1 ? 'Pegar compás' : `Pegar ${clip.length} compases`) : '')) +
        '</div>';
    };

    const draw = () => {
      if (mode !== 'grid') return;
      Music.normalize(bars, tsOf(song));
      song.chart = Music.serialize(bars);
      let html = '', row = null;
      bars.forEach((b, i) => {
        if (b.row !== row) { html += (row === null ? '' : '</div>') + '<div class="row">'; row = b.row; }
        html += barHtml(b, i, 0, true, i === cur.b ? cur.k : -1);
      });
      $('#grid').innerHTML = html + '</div>';
      const old = $('.scroll', pad), keep = old && old.dataset.tab === tab ? old.scrollTop : 0;
      pad.innerHTML = `<div class="ptabs">${btn('tab', 'chords', 'Acordes', tab === 'chords')}${btn('tab', 'other', 'Otros', tab === 'other')}
        <span class="sp"></span><button type="button" data-a="undo" aria-label="Deshacer"${undo.length ? '' : ' disabled'}>${UNDO}</button>
        <button type="button" data-a="redo" aria-label="Rehacer"${redo.length ? '' : ' disabled'}>${REDO}</button>${btn('prev', '', '‹')}${btn('next', '', '›')}</div>` +
        (tab === 'chords' ? chordsPad(Music.parseChord(item())) : otherPad());
      const sc = $('.scroll', pad);
      if (sc) { sc.dataset.tab = tab; sc.scrollTop = keep; }
      const el = $('#grid .ch.cur');
      if (el) el.scrollIntoView({ block: 'nearest' });
    };

    const preview = () => {
      song.chart = $('#f-chart').value;
      $('#preview').innerHTML = chartHtml(Music.parseChart(song.chart, tsOf(song)), 0, true);
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

    const leave = () => { location.hash = existing ? '#/s/' + song.id : '#/'; };
    const ask = (msg, val, bad) => {
      const r = prompt(msg, val || '');
      return r === null ? null : r.replace(bad, '').trim();
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
        // Con un acorde recién escrito, la nota siguiente pasa al próximo lugar si está libre.
        if (c && !cur.fresh) {
          const p = nextPos();
          if (!p) cur = { ...appendBar() };
          else if (bars[p.b].items[p.k] === '_') cur = { ...p };
        }
        setItem(el.dataset.v);
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
      nobass: () => {
        const c = Music.parseChord(item());
        if (c) { c.bassLetter = null; setItem(chordText(c)); }
        target = 'root';
      },
      add: () => {
        const b = bars[cur.b];
        if (b.items.length >= 8) return;
        b.items.splice(cur.k + 1, 0, '_');
        go(cur.b, cur.k + 1);
      },
      del: () => {
        const b = bars[cur.b];
        if (item() !== '_') { setItem('_'); go(cur.b, cur.k); }
        else if (b.items.length > 1) { b.items.splice(cur.k, 1); go(cur.b, Math.max(0, cur.k - 1)); }
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
        location.hash = '#/s/' + song.id;
      },
      delete: () => {
        if (!confirm(`¿Borrar "${song.title}"? No se puede deshacer.`)) return;
        songs = songs.filter(s => s.id !== song.id);
        saveSongs();
        location.hash = '#/';
      },
      // La copia lleva lo que hay en pantalla; la original queda como estaba guardada.
      dup: () => {
        readFields();
        const chart = mode === 'grid' ? Music.serialize(bars) : $('#f-chart').value;
        const copy = { ...song, id: newId(), title: (song.title || 'Sin título') + ' (copia)', chart };
        songs.push(copy);
        saveSongs();
        location.hash = '#/e/' + copy.id;
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
  }

  // --- navegación ---
  function route() {
    Engine.stop();
    wake(false);
    const [kind, id] = location.hash.slice(2).split('/');
    const song = findSong(id);
    if (kind === 's' && song) songView(song);
    else if (kind === 'e') editView(id);
    else if (kind === 'i') importView(id);
    else libraryView();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // Cuando llega una versión nueva mientras se mira la biblioteca, se recarga sola para mostrarla.
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadWorker && location.hash.length < 3) location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
