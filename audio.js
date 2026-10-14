// Banda de acompañamiento con Web Audio (bajo, teclado, batería, claqueta): sonidos grabados donde los hay
// (carpeta sonidos/) y sintetizados para el resto.
const Engine = (() => {
  let ctx = null, noise = null, out = null, bus = null, timer = null, raf = null, S = null;
  const vol = { bass: 0.8, keys: 0.6, drums: 0.7, perc: 0.7, click: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    // En iPhone el sonido de una página se apaga con el botón de silencio del costado, salvo que pida sonar como
    // un reproductor de música (iOS 17 en adelante). Una app de acompañamiento tiene que sonar igual.
    const nav = typeof navigator === 'undefined' ? {} : navigator;
    if (nav.audioSession && nav.audioSession.type !== 'playback') {
      try { nav.audioSession.type = 'playback'; } catch { /* navegador que no lo deja */ }
    }
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // "interrupted" es como lo deja el iPhone después de una llamada o al volver de otra app.
    if (ctx.state !== 'running') {
      const r = ctx.resume();
      if (r) r.catch(() => {});
    }
  }

  function makeBuses() {
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp);
    comp.connect(ctx.destination);
    bus = {};
    for (const k of ['bass', 'keys', 'drums', 'perc', 'click', 'fixed']) {
      const g = ctx.createGain();
      g.gain.value = k === 'fixed' ? 0.6 : vol[k];
      g.connect(out);
      bus[k] = g;
    }
  }

  function setVol(k, v) {
    vol[k] = v;
    if (bus && bus[k]) bus[k].gain.value = v;
  }

  // --- sonidos grabados ---
  // Vienen en grupos (batería, percusión, bajo y un grupo por teclado), cada uno en un archivo. Se bajan al
  // abrir una canción y se preparan al tocarla; de los teclados, solo el que usa esa canción. Lo que no esté
  // listo, o falle (sin conexión la primera vez, por ejemplo), suena sintetizado.
  let index = null, groups = null, preparing = null;
  const raw = {}, ready = {};   // por grupo: el archivo bajado (promesa) y sus sonidos ya preparados
  const get = async file => {
    const res = await fetch('sonidos/' + file);
    if (!res.ok) throw new Error(file);
    return res;
  };
  // Grupos que necesita una canción: todos los que no son teclados, más su teclado.
  const needed = keys => Object.keys(groups).filter(g => !groups[g].teclado || g === keys);
  function preload(keys) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('sin fetch'));
    if (!index) {
      index = get('indice.json').then(res => res.json()).then(all => { groups = all; });
      index.catch(() => { index = null; });
    }
    return index.then(() => Promise.all(needed(keys || 'piano').map(g => {
      if (!raw[g] && !ready[g]) {
        raw[g] = get(groups[g].archivo).then(res => res.arrayBuffer());
        raw[g].catch(() => { delete raw[g]; });
      }
      return raw[g];
    })));
  }
  // Cada archivo trae muchos sonidos en fila y una marca al principio (un clic): según el navegador, el audio
  // queda corrido unos milisegundos al abrirlo, y la marca dice cuánto.
  async function decode(g) {
    const info = groups[g], data = await raw[g];
    const buf = await new Promise((ok, no) => ctx.decodeAudioData(data, ok, no));
    const d = buf.getChannelData(0), b = {};
    let i = 0;
    while (i < d.length && Math.abs(d[i]) < 0.25) i++;
    const shift = i / buf.sampleRate - info.marca;
    if (!(Math.abs(shift) < 0.2)) throw new Error(info.archivo);
    for (const [name, [at, len]] of Object.entries(info.sonidos)) b[name] = { buf, at: at + shift, len, bus: info.pista || 'drums' };
    ready[g] = b;
    delete raw[g];
  }
  // De a una preparación por vez: si se pide otra mientras tanto, espera a que termine la anterior.
  function prepare(keys) {
    const run = async () => {
      await preload(keys);
      for (const g of needed(keys)) if (!ready[g]) await decode(g);
    };
    preparing = (preparing || Promise.resolve()).then(run).catch(() => {});
    return preparing;
  }
  const complete = keys => !!groups && needed(keys).every(g => ready[g]);
  // Lo que hay listo para una canción: los golpes por su nombre, las notas de bajo y las del teclado elegido.
  function bankFor(keys) {
    if (!groups) return null;
    const b = {};
    for (const g of Object.keys(groups)) if (!groups[g].teclado && ready[g]) Object.assign(b, ready[g]);
    // Notas de bajo, normales ("m") y fuertes ("f"): b['b41f'] es el Fa2 fuerte.
    b.bass = Object.keys(b).map(k => /^b(\d+)([mf])$/.exec(k)).filter(Boolean).map(r => ({ m: +r[1], hard: r[2] === 'f', s: b[r[0]] }));
    // Teclado: kb['60m'] es el Do central en su versión más fuerte y kb['60s'], en la más suave.
    const kb = groups[keys] && groups[keys].teclado && ready[keys];
    b.kb = kb || null;
    b.notes = kb ? Object.keys(kb).filter(k => /^\d+m$/.test(k)).map(k => parseInt(k, 10)) : [];
    return b;
  }

  // --- instrumentos ---
  function env(dest, t, peak, dur, rel) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.35, 0.0001), t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + rel);
    g.connect(dest);
    return g;
  }
  function osc(type, f, t, end, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }
  // Silencios del compás que se está programando, por los cortes: lo que empieza adentro no suena y lo que
  // venía sonando se apaga al llegar. Cada uno es [desde, hasta) en tiempo del reloj de audio.
  let quiet = [];
  const silent = t => quiet.some(q => t >= q[0] - 1e-4 && t < q[1] - 1e-4);
  const until = (t, dur) => Math.max(0.03, quiet.reduce((d, q) => (q[0] > t + 1e-4 ? Math.min(d, q[0] - t) : d), dur));

  // Ligaduras del compás que se está programando, por las anticipaciones: en esos momentos el bajo y el
  // teclado no vuelven a atacar, porque el acorde ya entró antes y sigue sonando. La batería no se liga.
  let ties = [];
  const tied = t => ties.some(x => Math.abs(t - x) < 2e-3);

  // Un golpe grabado. Devuelve false si ese sonido no está, y entonces lo toca el sintetizador.
  // Suena entero, salvo que se le ponga un tope (`cap`, en segundos) o que lo apague un corte.
  function shot(name, t, v, cap) {
    const s = S.bank && S.bank[name];
    if (!s) return false;
    if (silent(t)) return true;
    const dur = until(t, Math.min(cap || s.len, s.len));
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf;
    g.gain.setValueAtTime(v, t);
    if (dur < s.len) {
      g.gain.setValueAtTime(v, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    }
    src.connect(g); g.connect(bus[s.bus]);
    src.start(t, s.at, Math.min(s.len, dur + 0.04));
    return true;
  }
  // Percusión de un compás según la base escrita en MIDI para ese ritmo (bases.js). Devuelve false si el ritmo
  // no tiene base para este compás o si no están los sonidos grabados; entonces vale el patrón de más abajo.
  // Volumen que el usuario le dio a cada instrumento de la base que suena (1, o nada, es como viene).
  let trims = {};
  // "surdo_abierto" y "surdo_dedos" son el surdo; "tom1" y "tom2", los toms. (La misma regla está en herramientas/bases.js.)
  const instOf = name => name.split('_')[0].replace(/[0-9]+$/, '');
  // Opciones: `shift` corre la base esa cantidad de tiempos (el son 3-2 es el 2-3 empezado por la mitad) y
  // `split` reparte cada compás de la base en varios de la canción (el festejo, escrito en 12/8, en dos de 6/8).
  function base(style, t, bd, B, opt) {
    const p = typeof BASES !== 'undefined' && BASES[style];
    if (!p || !S.bank || !S.bank[p.golpes[0][1]]) return false;
    const shift = (opt && opt.shift) || 0, split = (opt && opt.split) || 1;
    // La base puede estar escrita en otro compás del mismo largo (3/4 para una canción en 6/8): se acomoda.
    // Los compases de la base suenan en orden y se repiten, salvo que sean variantes para alternar: ahí el
    // primero (el básico) suena la mitad de las veces y el resto se reparte entre los otros, sin repetir el último.
    // `place` es el lugar del compás contando desde el principio del tema (no desde donde se empezó a reproducir):
    // así una base de varios compases, o repartida en varios, queda alineada con la hoja al arrancar desde cualquier compás.
    const place = S.barNo + (S.o.startPos || 0);
    let bar = place % p.compases;
    // Una versión por momento del tema (abajo y arriba en el son): la canción dice cuál lleva cada compás.
    if (p.partes) bar = Math.min(p.compases - 1, (S.o.partAt && S.o.partAt(S.idx)) || 0);
    else if (p.alternar && p.compases > 1) {
      bar = 0;
      if (S.barNo && Math.random() < 0.5) {
        do bar = 1 + Math.floor(Math.random() * (p.compases - 1)); while (bar === S.variant && p.compases > 2);
      }
      S.variant = bar;
    }
    // De la base suena el tramo que le toca a este compás: toda, o una parte si está repartida.
    const T = p.tiempos, from = bar * T, len = T / split, first = (place % split) * len, step = bd * B / len;
    for (const [at, name, v] of p.golpes) {
      if (at < from - 1e-3 || at > from + T - 1e-3) continue;
      const pos = (((at - from - shift) % T) + T + 1e-3) % T - 1e-3 - first, k = trims[instOf(name)];
      if (pos > -1e-3 && pos < len - 1e-3) shot(name, t + pos * step, v * 0.5 * (k == null ? 1 : k));
    }
    return true;
  }
  // Ruido filtrado: platillos, aro, maracas. Va a la batería, salvo que se pida la pista de percusión.
  function nz(t, dur, type, freq, peak, q, perc) {
    if (silent(t)) return;
    dur = until(t, dur);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(perc ? bus.perc : bus.drums);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
  function kick(t, v) {
    if (shot('bombo', t, v) || silent(t)) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    g.connect(bus.drums);
    const o = osc('sine', 130, t, t + 0.25, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  }
  function snare(t, v) {
    if (shot('redo', t, v) || silent(t)) return;
    nz(t, 0.16, 'highpass', 1800, v);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    g.connect(bus.drums);
    osc('triangle', 190, t, t + 0.1, g);
  }
  const hat = (t, v, name) => shot(name || 'hh_cerrado', t, v) || nz(t, 0.04, 'highpass', 7500, v);
  // El ride que acompaña es el suave; el otro ("ride"), tocado más fuerte, queda para las bases.
  const ride = (t, v) => shot('ride_suave', t, v) || nz(t, 0.3, 'bandpass', 8500, v, 1.2);
  const rim = (t, v, name) => shot(name || 'aro', t, v) || nz(t, 0.03, 'bandpass', 1900, v, 4, !!name);
  // Los que siguen son percusión (en la mezcla van aparte de la batería) y llevan al final el nombre del sonido
  // grabado que los reemplaza, que cambia según el ritmo.
  const shaker = (t, v, dur, name) => shot(name, t, v, dur * 3) || nz(t, dur, 'bandpass', 6500, v, 0.8, true);
  // Parche: tambores de candombe, surdo, bombo legüero (según la altura).
  function tom(t, f, v, dur, name, cap) {
    if (shot(name, t, v, cap) || silent(t)) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bus.perc);
    const o = osc('sine', f * 1.5, t, t + dur + 0.02, g);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  }
  // Madera: clave, tamborim, cencerro.
  function wood(t, v, name) {
    if (shot(name, t, v) || silent(t)) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    g.connect(bus.perc);
    osc('triangle', 2300, t, t + 0.08, g);
  }
  function click(t, accent, dest) {
    const g = env(dest, t, 0.7, 0.03, 0.02);
    osc('sine', accent ? 1760 : 1175, t, t + 0.08, g);
  }
  function bassNote(t, m, dur, v) {
    if (silent(t) || tied(t)) return;
    dur = until(t, dur);
    if (S.bank && S.bank.bass.length) {
      // Grabado: la nota más cercana de las que hay, corrida de altura lo que haga falta. Las más fuertes usan
      // la grabación fuerte; si a una intensidad le falta esa nota, se prefiere la otra antes que irse lejos.
      const hard = v >= 0.95, cost = n => Math.abs(n.m - m) + (n.hard === hard ? 0 : 1.5);
      const n = S.bank.bass.reduce((a, c) => (cost(c) < cost(a) ? c : a));
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = n.s.buf;
      src.playbackRate.value = Math.pow(2, (m - n.m) / 12);
      g.gain.setValueAtTime(v * 1.2, t);
      g.gain.setTargetAtTime(0, t + dur, 0.03);
      src.connect(g); g.connect(bus.bass);
      src.start(t, n.s.at, n.s.len);
      src.stop(t + dur + 0.3);
      return;
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.connect(bus.bass);
    osc('sawtooth', mtof(m), t, t + dur + 0.1, env(f, t, v * 0.8, dur, 0.04));
  }
  // Nota de teclado grabada: la más cercana de las que hay, corrida de altura lo que haga falta.
  // Suena mientras dura la nota y se apaga rápido al soltarla, como al levantar el dedo de la tecla.
  function pianoNote(t, m, dur, v) {
    const b = S.bank;
    let root = b.notes[0];
    for (const n of b.notes) if (Math.abs(n - m) < Math.abs(root - m)) root = n;
    const s = b.kb[root + (v < 0.75 ? 's' : 'm')] || b.kb[root + 'm'];
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (m - root) / 12);
    g.gain.setValueAtTime(v * 0.6, t);
    g.gain.setTargetAtTime(0, t + dur, 0.05);
    src.connect(g); g.connect(bus.keys);
    src.start(t, s.at, s.len);
    src.stop(t + dur + 0.4);
  }
  function chordHit(t, notes, dur, v) {
    if (silent(t) || tied(t)) return;
    dur = until(t, dur);
    if (S.bank && S.bank.notes.length) {
      for (const m of notes) pianoNote(t, m, dur, v);
      return;
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    f.connect(bus.keys);
    for (const m of notes) {
      const g = env(f, t, v * 0.2, dur, 0.08);
      osc('triangle', mtof(m), t, t + dur + 0.15, g);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      g2.connect(g);
      osc('sine', mtof(m) * 2, t, t + dur + 0.15, g2);
    }
  }

  function voice(c) {
    let iv = c.iv.slice();
    if (iv.length < 3) iv.unshift(0);
    else if (iv.length > 3 && iv[1] === 7) iv.splice(1, 1);
    return iv.map(x => {
      let m = 48 + (c.root + x) % 12;
      while (m < 55) m += 12;
      return m;
    });
  }
  function near(pc, ref) {
    let best = null;
    for (let m = pc + 24; m <= 55; m += 12) {
      if (m < 30) continue;
      if (best == null || Math.abs(m - ref) < Math.abs(best - ref)) best = m;
    }
    return best;
  }
  const rootOf = c => near(c.bass, (S.lb + 38) / 2);
  const fifthOf = c => near((c.root + c.iv[1]) % 12, S.lb);
  function bass(t, m, dur, v) {
    S.lb = m;
    bassNote(t, m, dur, v);
  }

  // --- patrones por estilo (4/4) ---
  const patterns = {
    swing(t, bd, x) {
      for (let b = 0; b < 4; b++) {
        const tb = t + b * bd;
        ride(tb, 0.22);
        if (b % 2) { hat(tb, 0.3, 'hh_pedal'); ride(tb + bd * 2 / 3, 0.13); }
        const c = x.at(b);
        if (!c) continue;
        const prev = b ? x.at(b - 1) : null;
        const up = b < 3 ? x.at(b + 1) : x.next;
        let m;
        if (b === 0 || c !== prev) m = rootOf(c);
        else if (up && up !== c) m = near(up.bass, S.lb) + (Math.random() < 0.5 ? 1 : -1);
        else m = near((c.root + c.iv[b === 2 ? 1 : 0]) % 12, S.lb);
        bass(tb, m, bd * 0.9, 0.9);
      }
      for (const s of x.segs) {
        if (!s.chord) continue;
        const v = voice(s.chord);
        if (s.len >= 4 && x.barNo % 2) {
          chordHit(t + (s.beat + 1) * bd, v, bd * 0.5, 0.8);
          chordHit(t + (s.beat + 2 + 2 / 3) * bd, v, bd * 0.9, 0.9);
        } else {
          chordHit(t + s.beat * bd, v, bd * 0.6, 0.9);
          if (s.len >= 2) chordHit(t + (s.beat + 1 + 2 / 3) * bd, v, bd * 0.9, 0.8);
        }
      }
    },
    bossa(t, bd, x) {
      const e = bd / 2;
      for (let i = 0; i < 8; i++) hat(t + i * e, 0.12);
      for (const i of [0, 3, 4, 7]) kick(t + i * e, i % 4 ? 0.3 : 0.5);
      const hits = x.barNo % 2 ? [2, 5] : [0, 3, 6];
      for (const i of hits) {
        rim(t + i * e, 0.35);
        const c = x.at(i / 2);
        if (c) chordHit(t + i * e, voice(c), e * 1.6, 0.85);
      }
      const c0 = x.at(0), c2 = x.at(2);
      if (c0) bass(t, rootOf(c0), bd * 1.5, 0.9);
      if (c2) bass(t + 2 * bd, c2 !== c0 ? rootOf(c2) : fifthOf(c2), bd * 1.4, 0.85);
      const up = x.next || c2;
      if (up) bass(t + 3.5 * bd, rootOf(up), bd * 0.45, 0.6);
    },
    pop(t, bd, x) {
      const e = bd / 2;
      for (let i = 0; i < 8; i++) hat(t + i * e, i % 2 ? 0.1 : 0.18);
      kick(t, 0.9); kick(t + 2 * bd, 0.8); kick(t + 2.5 * bd, 0.5);
      snare(t + bd, 0.5); snare(t + 3 * bd, 0.5);
      const at = [0, 1.5, 2, 3.5];
      at.forEach((b, i) => {
        const c = x.at(b);
        if (c) bass(t + b * bd, rootOf(c), ((at[i + 1] || 4) - b) * bd * 0.9, 0.9);
      });
      for (const s of x.segs) if (s.chord) chordHit(t + s.beat * bd, voice(s.chord), s.len * bd * 0.95, 0.9);
    },
    balada(t, bd, x) {
      const e = bd / 2;
      for (let i = 0; i < 8; i++) hat(t + i * e, 0.08);
      kick(t, 0.7); kick(t + 2.5 * bd, 0.4);
      rim(t + bd, 0.3); rim(t + 3 * bd, 0.3);
      const c0 = x.at(0), c2 = x.at(2);
      if (c0) bass(t, rootOf(c0), bd * 1.9, 0.9);
      if (c2) bass(t + 2 * bd, rootOf(c2), bd * 1.8, 0.8);
      for (const s of x.segs) {
        if (!s.chord) continue;
        chordHit(t + s.beat * bd, voice(s.chord), s.len * bd * 0.95, 0.9);
        if (s.len >= 4) chordHit(t + (s.beat + 2) * bd, voice(s.chord), bd * 1.8, 0.5);
      }
    },
    // Samba, en 4/4 o en 2/4. Todo está escrito sobre las 16 semicorcheas del 4/4; en 2/4 cada compás toca una
    // mitad, alternando: la clave del tamborim ocupa dos compases (surdo y pandeiro son iguales en las dos mitades).
    samba(t, bd, x, B) {
      const s = bd / 4, n = B * 4, from = B === 2 ? (x.place % 2) * 8 : 0;
      // ¿la semicorchea i del dibujo entero cae en este compás?, y en qué momento
      const on = i => i >= from && i < from + n, tm = i => t + (i - from) * s;
      // Surdo, pandeiro y tamborim salen de la base escrita en MIDI. Sin sonidos grabados: maracas, surdo
      // (apagado en 1 y 3, abierto en 2 y 4) y tamborim sintetizados.
      if (!base('samba', t, bd, B, { split: 4 / B })) {
        for (let i = from; i < from + n; i++) shaker(tm(i), i % 4 === 0 ? 0.22 : i % 4 === 3 ? 0.18 : 0.1, 0.035);
        for (let b = 0; b < 4; b++) if (on(b * 4)) tom(tm(b * 4), b % 2 ? 80 : 85, b % 2 ? 0.8 : 0.6, b % 2 ? 0.3 : 0.08);
        for (const i of [0, 2, 3, 5, 7, 9, 10, 12, 14]) if (on(i)) wood(tm(i), 0.2);
      }
      const c0 = x.at(0);
      if (B === 2) {
        // El bajo hace lo mismo que en 4/4, repartido en dos compases: fundamental en el primero; en el segundo,
        // la quinta si el acorde sigue o la fundamental si cambió; y un levare hacia el compás que viene.
        const same = (a, b) => !!a && !!b && a.root === b.root && a.bass === b.bass;
        if (c0) bass(t, from && same(c0, x.prev) ? fifthOf(c0) : rootOf(c0), s * 6, from ? 0.9 : 0.95);
        if (x.next && from) bass(t + 7 * s, rootOf(x.next), s * 0.8, 0.55);
        else if (x.next) bassNote(t + 7 * s, same(x.next, c0) ? fifthOf(x.next) : rootOf(x.next), s * 0.8, 0.5);
      } else {
        const c2 = x.at(2);
        if (c0) bass(t, rootOf(c0), s * 6, 0.95);
        if (c2) {
          const m = c2 !== c0 ? rootOf(c2) : fifthOf(c2);
          bassNote(t + 7 * s, m, s * 0.8, 0.5);
          bass(t + 8 * s, m, s * 6, 0.9);
        }
        if (x.next) bass(t + 15 * s, rootOf(x.next), s * 0.8, 0.55);
      }
      for (const i of [0, 3, 6, 10, 13]) {
        if (!on(i)) continue;
        const c = x.at((i - from) / 4);
        if (c) chordHit(tm(i), voice(c), s * 2, 0.8);
      }
    },
    // Marcato en cuatro, con una síncopa cada cuatro compases y arrastre hacia el compás siguiente.
    tango(t, bd, x) {
      for (let b = 0; b < 4; b++) {
        const c = x.at(b);
        if (!c) continue;
        const strong = b % 2 === 0 || c !== x.at(b - 1);
        bass(t + b * bd, strong ? rootOf(c) : fifthOf(c), bd * 0.55, strong ? 1 : 0.7);
      }
      const hits = x.barNo % 4 === 3
        ? [[0, 0.3, 0.9], [0.5, 1.2, 1], [2, 0.4, 0.9], [3, 0.4, 0.8]]
        : [[0, 0.35, 1], [1, 0.3, 0.7], [2, 0.35, 0.95], [3, 0.3, 0.7]];
      for (const [b, d, v] of hits) {
        const c = x.at(b);
        if (c) chordHit(t + b * bd, voice(c), bd * d, v);
      }
      if (x.next) bass(t + 3.5 * bd, rootOf(x.next) - 1, bd * 0.4, 0.6);
    },
    // Bajo de habanera (3-3-2).
    milonga(t, bd, x) {
      const e = bd / 2, c0 = x.at(0);
      for (const [i, fifth, d, v] of [[0, 0, 1.4, 1], [3, 1, 0.45, 0.7], [4, 0, 0.9, 0.9], [6, 1, 0.9, 0.85]]) {
        const c = x.at(i / 2);
        if (c) bass(t + i * e, fifth && c === c0 ? fifthOf(c) : rootOf(c), e * d, v);
      }
      for (const [i, v] of [[0, 0.8], [3, 0.9], [6, 0.9], [7, 0.6]]) {
        const c = x.at(i / 2);
        if (c) chordHit(t + i * e, voice(c), e * 0.5, v);
      }
      for (const i of [0, 3, 6]) rim(t + i * e, 0.2);
    },
    // Los tambores salen de la base escrita en MIDI. Sin sonidos grabados: madera con la clave y los tres
    // tambores (chico, piano y repique) sintetizados.
    candombe(t, bd, x) {
      const s = bd / 4;
      if (!base('candombe', t, bd, 4)) {
        for (const i of [0, 3, 6, 10, 12]) wood(t + i * s, 0.45);
        for (let i = 0; i < 16; i++) if (i % 4) tom(t + i * s, 340, i % 4 === 2 ? 0.3 : 0.2, 0.07);
        for (const i of [0, 3, 6, 8, 11, 14]) tom(t + i * s, 95, i % 8 ? 0.5 : 0.75, 0.22);
        if (x.barNo % 2) for (const i of [10, 13, 15]) tom(t + i * s, 190, 0.4, 0.12);
      }
      for (const [i, fifth, d] of [[0, 0, 3], [3, 1, 3], [6, 0, 2], [8, 0, 3], [11, 1, 3], [14, 0, 2]]) {
        const c = x.at(i / 4);
        if (c) bass(t + i * s, fifth ? fifthOf(c) : rootOf(c), s * d * 0.9, fifth ? 0.75 : 0.95);
      }
      // Teclado planchado: el acorde entra en el 1 (o donde cambie) y queda sonando. A contratiempo sonaba a cumbia.
      for (const g of x.segs) if (g.chord) chordHit(t + g.beat * bd, voice(g.chord), g.len * bd * 0.95, 0.85);
    },
    // Güiro en "chiqui-chiqui", bombo en 1 y 3 y acordes a contratiempo. En 4/4 o en 2/4: en 2/4 cada compás
    // toca una mitad, alternando (la segunda mitad lleva un golpe más de conga).
    cumbia(t, bd, x, B) {
      const e = bd / 2, s = bd / 4, second = B === 2 && x.place % 2 === 1;
      for (let b = 0; b < B; b++) {
        const tb = t + b * bd;
        shaker(tb, 0.3, 0.09, 'guiro_arrastre'); shaker(tb + 2 * s, 0.18, 0.04, 'guiro_abajo'); shaker(tb + 3 * s, 0.18, 0.04, 'guiro_arriba');
        wood(tb, 0.15, 'campana_lomo');
      }
      // Bajo: fundamental, tercera y quinta en negra, corchea, corchea; dos veces por compás.
      for (let h = 0; h < B; h += 2) {
        const c = x.at(h), c1 = x.at(h + 1);
        if (c) bass(t + h * bd, rootOf(c), bd * 0.9, 1);
        if (!c1) continue;
        const r = c1 === c ? S.lb : rootOf(c1);
        const up = iv => near((c1.root + iv) % 12, r + iv);
        bass(t + (h + 1) * bd, c1 === c ? up(c1.iv[0]) : r, e * 0.9, 0.85);
        bass(t + (h + 1.5) * bd, up(c1.iv[1]), e * 0.9, 0.9);
      }
      kick(t, second ? 0.7 : 0.8);
      tom(t + 1.5 * bd, 200, 0.35, 0.12, 'conga_tono');
      if (second) tom(t + 1.75 * bd, 240, 0.3, 0.1, 'conga_tono');
      if (B === 4) { kick(t + 2 * bd, 0.7); tom(t + 3.5 * bd, 200, 0.35, 0.12, 'conga_tono'); tom(t + 3.75 * bd, 240, 0.3, 0.1, 'conga_tono'); }
      for (let i = 1; i < B * 2; i += 2) {
        const c = x.at(i / 2);
        if (c) chordHit(t + i * e, voice(c), e * 0.6, 0.85);
      }
    },
    // Corcheas atresilladas en el platillo, redoblante en 2 y 4 y bajo de boogie: en cada tiempo un par de
    // notas iguales que recorre fundamental, quinta, sexta y quinta (y vuelve a la fundamental al cambiar de acorde).
    shuffle(t, bd, x) {
      const late = bd * 2 / 3;
      let step = 0, root = null;
      for (let b = 0; b < 4; b++) {
        const tb = t + b * bd, c = x.at(b);
        hat(tb, 0.2); hat(tb + late, 0.12);
        if (b % 2) snare(tb, 0.55); else kick(tb, b ? 0.7 : 0.9);
        if (!c) { step = 0; continue; }
        if (b === 0 || c !== x.at(b - 1)) { step = 0; root = rootOf(c); }
        const iv = [0, c.iv[1], 9, c.iv[1]][step++ % 4];
        const m = iv ? near((c.root + iv) % 12, root + iv) : root;
        bass(tb, m, late * 0.9, 0.95);
        bass(tb + late, m, (bd - late) * 0.9, 0.7);
      }
      for (const s of x.segs) if (s.chord) chordHit(t + s.beat * bd, voice(s.chord), bd * 0.5, 0.8);
      for (const b of [1, 3]) {
        const c = x.at(b + 2 / 3);
        if (c) chordHit(t + b * bd + late, voice(c), bd * 0.25, 0.7);
      }
    },
    // Semicorcheas: bombo sincopado, redoblante en 2 y 4 con notas fantasma, bajo entrecortado con la octava
    // y acordes cortos a contratiempo.
    funk(t, bd, x) {
      const s = bd / 4;
      for (let i = 0; i < 16; i++) hat(t + i * s, i % 4 === 0 ? 0.2 : i % 2 ? 0.07 : 0.13);
      for (const [i, v] of [[0, 0.95], [3, 0.5], [6, 0.7], [10, 0.8]]) kick(t + i * s, v);
      snare(t + 4 * s, 0.6); snare(t + 12 * s, 0.6);
      for (const i of [7, 9, 15]) snare(t + i * s, 0.12);
      // [semicorchea, nota, duración en semicorcheas, fuerza]: f = fundamental, o = octava, q = quinta
      for (const [i, note, d, v] of [[0, 'f', 1.6, 1], [3, 'o', 0.7, 0.8], [6, 'f', 0.8, 0.9], [10, 'q', 0.8, 0.8], [11, 'f', 1.5, 0.95], [14, 'q', 0.8, 0.7]]) {
        const c = x.at(i / 4);
        if (!c) continue;
        const r = rootOf(c), m = note === 'o' ? (r + 12 <= 55 ? r + 12 : r) : note === 'q' ? near((c.root + c.iv[1]) % 12, r) : r;
        bass(t + i * s, m, s * d, v);
      }
      for (const i of [2, 7, 10, 13]) {
        const c = x.at(i / 4);
        if (c) chordHit(t + i * s, voice(c), s * 0.8, 0.8);
      }
    },
    // "One drop": bombo y aro juntos en el 3, acordes cortos en 2 y 4 (el skank) y un bajo que deja libre el 1.
    reggae(t, bd, x) {
      const e = bd / 2;
      for (let i = 0; i < 8; i++) hat(t + i * e, i % 2 ? 0.18 : 0.08);
      kick(t + 2 * bd, 0.9); rim(t + 2 * bd, 0.45);
      for (const b of [1, 3]) {
        const c = x.at(b), late = x.at(b + 0.5);
        if (c) chordHit(t + b * bd, voice(c), bd * 0.3, 0.9);
        if (late) chordHit(t + (b + 0.5) * bd, voice(late), bd * 0.2, 0.4);
      }
      // [tiempo, nota, duración en tiempos, fuerza]: f = fundamental, t = tercera, q = quinta
      for (const [b, note, d, v] of [[1, 'f', 0.45, 0.95], [1.5, 'f', 0.45, 0.8], [2, 't', 0.9, 0.9], [3, 'q', 0.45, 0.85], [3.5, 'f', 0.45, 0.8]]) {
        const c = x.at(b);
        if (!c) continue;
        const r = rootOf(c);
        bass(t + b * bd, note === 'f' ? r : near((c.root + c.iv[note === 't' ? 0 : 1]) % 12, r + 4), bd * d, v);
      }
    },
    // Maracas en corcheas, bajo en 1, 3 y 4, y el acorde arpegiado suave, una nota por corchea.
    bolero(t, bd, x) {
      const e = bd / 2;
      for (let i = 0; i < 8; i++) shaker(t + i * e, i % 2 ? 0.1 : 0.17, 0.05);
      rim(t + bd, 0.2); rim(t + 3 * bd, 0.2);
      tom(t + 3.5 * bd, 180, 0.25, 0.12, 'bongo_grave');
      const c0 = x.at(0), c2 = x.at(2), c3 = x.at(3);
      if (c0) bass(t, rootOf(c0), bd * 1.9, 1);
      if (c2) bass(t + 2 * bd, c2 === c0 ? fifthOf(c2) : rootOf(c2), bd * 0.9, 0.85);
      if (c3) bass(t + 3 * bd, rootOf(c3), bd * 0.9, 0.8);
      for (let i = 0; i < 8; i++) {
        const c = x.at(i / 2);
        if (!c) continue;
        const v = voice(c).slice().sort((a, b) => a - b);
        // sube y baja por las notas del acorde; la primera corchea de cada acorde suena un poco más
        chordHit(t + i * e, [v[[0, 1, 2, 1][i % 4] % v.length]], e * 1.8, i % 4 ? 0.6 : 0.8);
      }
    },
    // Seis corcheas por compás (6/8 o 3/4): bombo legüero con el parche en 2 y 3, bajo en negras.
    chacarera(t, bd, x, B) {
      const e = bd * B / 6, at = i => x.at(i * B / 6);
      // El bombo sale de la base escrita en MIDI; sin sonidos grabados, aro y parche sintetizados.
      if (!base('chacarera', t, bd, B)) {
        for (const [i, v] of [[0, 0.4], [3, 0.3], [5, 0.3]]) rim(t + i * e, v, 'leguero_aro');
        tom(t + 2 * e, 85, 0.7, 0.25, 'leguero_medio'); tom(t + 4 * e, 80, 0.85, 0.3, 'leguero_fuerte');
      }
      for (const i of [0, 2, 4]) {
        const c = at(i);
        if (c) bass(t + i * e, i === 2 && c === at(0) ? fifthOf(c) : rootOf(c), e * 1.8, i ? 0.8 : 1);
      }
      for (const [i, d, v] of [[0, 1.6, 1], [2, 0.5, 0.6], [3, 0.5, 0.9], [5, 0.5, 0.7]]) {
        const c = at(i);
        if (c) chordHit(t + i * e, voice(c), e * d, v);
      }
    },
    // Más lenta y en dos pulsos: parche en 1, bajo en negras con puntillo.
    zamba(t, bd, x, B) {
      const e = bd * B / 6, at = i => x.at(i * B / 6);
      // El bombo sale de la base escrita en MIDI; sin sonidos grabados, parche y aro sintetizados.
      if (!base('zamba', t, bd, B)) {
        tom(t, 80, 0.8, 0.35, 'leguero_fuerte'); tom(t + 4 * e, 85, 0.55, 0.3, 'leguero_medio');
        for (const [i, v] of [[2, 0.3], [3, 0.35], [5, 0.25]]) rim(t + i * e, v, 'leguero_aro');
      }
      const c0 = at(0), c3 = at(3);
      if (c0) bass(t, rootOf(c0), e * 2.8, 1);
      if (c3) bass(t + 3 * e, c3 === c0 ? fifthOf(c3) : rootOf(c3), e * 1.8, 0.8);
      if (x.next) bass(t + 5 * e, rootOf(x.next), e * 0.8, 0.55);
      for (const [i, d, v] of [[0, 2.6, 0.95], [3, 0.9, 0.75], [4, 0.8, 0.6], [5, 0.8, 0.6]]) {
        const c = at(i);
        if (c) chordHit(t + i * e, voice(c), e * d, v);
      }
    },
    // Son, con la clave escrita en semicorcheas (un compás de 4/4 es una clave entera). La percusión sale de la
    // base escrita en MIDI, que tiene una versión de abajo y otra de arriba; sin sonidos grabados, clave y maracas.
    // Bajo en tumbao: la quinta en el "y" del 2 y la fundamental del acorde que viene en el 4, anticipada y
    // ligada. El piano marca los acordes con ese mismo dibujo, sin montuno.
    son(t, bd, x, B, clave32) {
      const s = bd / 4;
      // La clave 3-2 es la misma base empezada por la mitad del compás.
      if (!base('son', t, bd, 4, { shift: clave32 ? 2 : 0 })) {
        for (const i of clave32 ? [0, 3, 6, 10, 12] : [2, 4, 8, 11, 14]) wood(t + i * s, 0.4);
        for (let i = 0; i < 16; i += 2) shaker(t + i * s, i % 4 ? 0.12 : 0.2, 0.04);
      }
      const c0 = x.at(0), c2 = x.at(2), up = x.next || c0;
      // [semicorchea, acorde, duración en semicorcheas, ¿fundamental?]
      const plan = [[3, c0, 2, false], [6, c2, 4.5, true], [11, c2, 2, false], [14, up, 4.5, true]];
      if (x.barNo === 0) plan.unshift([0, c0, 2.5, true]);
      for (const [i, c, d, root] of plan) {
        if (!c) continue;
        bass(t + i * s, root ? rootOf(c) : fifthOf(c), s * d, root ? 1 : 0.8);
        chordHit(t + i * s, voice(c), s * d * 0.9, root ? 0.85 : 0.7);
      }
    },
    son32(t, bd, x, B) { patterns.son(t, bd, x, B, true); },
    // Festejo, en 12/8 (o en 6/8, donde cada compás toca media base). La percusión sale de la base escrita en
    // MIDI; sin sonidos grabados, cajón sintetizado. Por cada mitad: bajo en el 1, quinta en el 4 y un levare
    // hacia lo que viene; el piano marca el acorde en el 1 y en el 4.
    festejo(t, bd, x, B) {
      if (!base('festejo', t, bd, B, { split: B === 6 ? 2 : 1 })) {
        for (let i = 0; i < B; i += 3) { tom(t + i * bd, 90, 0.7, 0.2); tom(t + (i + 2) * bd, 260, 0.35, 0.08); }
      }
      for (let h = 0; h < B; h += 6) {
        const c = x.at(h), c3 = x.at(h + 3), up = h + 6 < B ? x.at(h + 6) : x.next;
        if (c) { bass(t + h * bd, rootOf(c), bd * 2.7, 1); chordHit(t + h * bd, voice(c), bd * 2.6, 0.85); }
        if (c3) { bass(t + (h + 3) * bd, c3 === c ? fifthOf(c3) : rootOf(c3), bd * 1.8, 0.8); chordHit(t + (h + 3) * bd, voice(c3), bd * 2.6, 0.7); }
        if (up) bass(t + (h + 5) * bd, rootOf(up), bd * 0.9, 0.6);
      }
    },
    // Bajo en el 1 (alterna fundamental y quinta) y acordes en 2 y 3.
    vals(t, bd, x) {
      kick(t, 0.55); hat(t + bd, 0.14); hat(t + 2 * bd, 0.14);
      for (let b = 0; b < 3; b++) {
        const c = x.at(b);
        if (!c) continue;
        const same = x.prev && x.prev.root === c.root;
        if (b === 0) bass(t, x.barNo % 2 && same ? fifthOf(c) : rootOf(c), bd * 2.6, 1);
        else {
          if (c !== x.at(b - 1)) bass(t + b * bd, rootOf(c), bd * 0.9, 0.85);
          chordHit(t + b * bd, voice(c), bd * 0.6, b === 1 ? 0.75 : 0.65);
        }
      }
    },
  };
  // Compases que cada estilo sabe tocar; en cualquier otro suena el acompañamiento genérico.
  const METER = { samba: '4/4 2/4', cumbia: '4/4 2/4', chacarera: '6/8 3/4', zamba: '6/8 3/4', vals: '3/4', festejo: '12/8 6/8' };

  // Compases que no son 4/4: bajo en los acentos, acordes en el resto.
  function generic(t, bd, x, B) {
    const accents = B === 6 ? [0, 3] : B === 12 ? [0, 3, 6, 9] : B === 5 ? [0, 3] : B === 7 ? [0, 4] : [0];
    const oompah = B === 3 || B === 6 || B === 12;
    for (let b = 0; b < B; b++) {
      const tb = t + b * bd, acc = accents.includes(b), c = x.at(b);
      hat(tb, acc ? 0.2 : 0.12);
      if (acc) kick(tb, b ? 0.4 : 0.8);
      if (!c) continue;
      const change = b > 0 && c !== x.at(b - 1);
      if (acc || change) bass(tb, b === 0 || change ? rootOf(c) : fifthOf(c), bd * 0.95, 0.9);
      else if (oompah) chordHit(tb, voice(c), bd * 0.5, 0.7);
    }
    if (!oompah) for (const s of x.segs) if (s.chord) chordHit(t + s.beat * bd, voice(s.chord), s.len * bd * 0.95, 0.9);
  }

  function schedBar(bar, t, bd, next, ahead) {
    const B = bar.beats, carried = S.last;
    // Anticipaciones: un acorde marcado así entra una corchea antes de donde está escrito y queda ligado: se
    // sostiene mientras dura, sin volver a atacarse en su tiempo. Si está en el primer tiempo, entra al final
    // del compás anterior: `ahead` es ese acorde del compás que sigue (con `hold`, cuánto dura allá), y
    // `S.pushed` avisa después que el primer acorde ya entró.
    // La anticipación puede ser de una corchea o de una semicorchea (`semi`): `lead` es cuántos tiempos se adelanta.
    const lead = s => bar.den / (s.semi ? 16 : 8), came = S.pushed;
    const slots = bar.slots.map((s, i) => {
      if (!s.push) return s;
      if (s.beat > 0) return { ...s, beat: Math.max(s.beat - lead(s), 0), early: true, written: s.beat };
      return came && i === 0 ? { ...s, held: true } : s;
    });
    if (ahead) slots.push({ beat: B - lead(ahead), chord: ahead.chord, cut: ahead.cut, early: true, hold: ahead.hold });
    slots.sort((a, b) => a.beat - b.beat);
    S.pushed = !!ahead;
    const at = b => {
      let c = carried;
      for (const s of slots) { if (s.beat <= b + 1e-6) c = s.chord; else break; }
      return c;
    };
    const style = S.o.style;
    for (let b = 0; b < B; b++) click(t + b * bd, b === 0, style === 'click' ? bus.fixed : bus.click);
    // Cortes: en el acorde marcado toda la banda da un golpe seco y calla hasta el próximo acorde escrito
    // (si hace falta, varios compases: `S.hush` avisa que el silencio viene de antes). La claqueta sigue.
    // En swing, un corte escrito en el "y" de un tiempo cae atresillado, como el resto de las corcheas.
    const swing = (style === 'swing' || style === 'shuffle') && B === 4 && bar.den === 4;
    const when = beat => {
      const whole = Math.floor(beat + 1e-6), part = beat - whole;
      return t + (swing && Math.abs(part - 0.5) < 1e-6 ? whole + 2 / 3 : beat) * bd;
    };
    const hits = [], accents = [];
    let from = S.hush ? t : null;
    quiet = [];
    for (const s of slots) {
      // un corte que ya sonó anticipado en el compás anterior: no se repite el golpe, sigue el silencio
      if (s.held && s.cut) { if (from == null) from = t; continue; }
      if (from != null) { quiet.push([from, when(s.beat)]); from = null; }
      if (s.cut && s.chord) { hits.push([when(s.beat), s.chord]); from = when(s.beat); }
      else if (s.early && s.chord) {
        // dura hasta el próximo acorde del compás; si viene del compás siguiente, lo que dure allá
        const end = slots.find(o => o.beat > s.beat + 1e-6);
        accents.push([when(s.beat), s.chord, t + (end ? end.beat : B) * bd - when(s.beat) + (s.hold || 0)]);
      }
    }
    // No se vuelve a atacar: ni en el momento de la anticipación (lo toca el acento), ni en el tiempo escrito.
    ties = accents.map(a => a[0]);
    for (const s of slots) {
      if (s.written != null && !s.cut) ties.push(t + s.written * bd, when(s.written));
      if (s.held && !s.cut) ties.push(t);
    }
    if (from != null) quiet.push([from, t + B * bd]);
    S.hush = from != null;
    if (style !== 'click') {
      const segs = [];
      if (!slots.length || slots[0].beat > 0) segs.push({ beat: 0, chord: carried });
      for (const s of slots) segs.push({ beat: s.beat, chord: s.chord });
      segs.forEach((s, i) => { s.len = (i + 1 < segs.length ? segs[i + 1].beat : B) - s.beat; });
      const x = { at, segs, next, prev: carried, barNo: S.barNo, place: S.barNo + (S.o.startPos || 0) };
      const meters = (METER[style] || '4/4').split(' ');
      if (!patterns[style]) generic(t, bd, x, B);
      else if (meters.includes(B + '/' + bar.den)) patterns[style](t, bd, x, B);
      else if (bar.den === 4 && meters.includes(B * 3 + '/8')) {
        // Un ritmo ternario en un compás de negras se toca igual, con cada negra dividida en tres: 4/4 como
        // 12/8 y 2/4 como 6/8. El pulso es el mismo; al patrón se le pasa todo medido en esas corcheas.
        const third = { ...x, at: b => at(b / 3), segs: segs.map(g => ({ ...g, beat: g.beat * 3, len: g.len * 3 })) };
        patterns[style](t, bd / 3, third, B * 3);
      } else generic(t, bd, x, B);
    }
    quiet = [];
    ties = [];
    if (style !== 'click') {
      for (const [ht, chord] of hits) {
        chordHit(ht, voice(chord), 0.16, 1.1);
        bass(ht, rootOf(chord), 0.18, 1);
        kick(ht, 1);
        snare(ht, 0.7);
        if (!shot('hh_abierto', ht, 0.3, 0.1)) nz(ht, 0.1, 'highpass', 6000, 0.3);
      }
      // La anticipación se marca: acorde, bajo y bombo entran juntos antes de tiempo y el acorde queda sonando.
      for (const [pt, chord, dur] of accents) {
        chordHit(pt, voice(chord), dur * 0.95, 1);
        bass(pt, rootOf(chord), Math.min(dur * 0.95, bd * 1.5), 1);
        kick(pt, 0.8);
      }
    }
    S.last = at(B);
  }

  // Cuánto dura un tiempo del compás (una negra en 4/4, una corchea en 6/8). El tempo cuenta el pulso: la negra,
  // o la negra con puntillo en los compases compuestos (6/8, 9/8, 12/8), donde el pulso son tres corcheas.
  const beatDur = (tempo, bar) => (bar.den === 8 && bar.beats > 3 && bar.beats % 3 === 0 ? 20 : 240 / bar.den) / tempo;

  // Con la app en segundo plano el navegador frena los relojes: ahí se programa con más anticipación.
  function tick() {
    if (!flush() || S.done) return;
    const { o } = S;
    while (S.t < ctx.currentTime + (document.hidden ? 1.5 : 0.2)) {
      if (S.pos >= o.seq.length) {
        S.pos = 0;
        S.chorus++;
        if (S.chorus >= o.choruses) {
          // Cierre: un acorde largo sobre la tónica en lugar de cortar en seco.
          let tail = 0;
          const c = typeof o.finalChord === 'function' ? o.finalChord(S.chorus - 1) : o.finalChord;
          if (c && o.style !== 'click' && !S.hush) {
            const bd = 60 / o.getTempo(S.chorus - 1);
            chordHit(S.t, voice(c), bd * 4, 1);
            bass(S.t, rootOf(c), bd * 4, 0.9);
            kick(S.t, 0.8);
            if (!shot('crash1', S.t, 0.5)) ride(S.t, 0.3);
            tail = bd * 4 + 0.3;
          }
          S.q.push({ t: S.t, i: -1 });
          S.q.push({ t: S.t + tail, end: true });
          S.done = true;
          return;
        }
        // Vuelta nueva: en modo práctica puede traer otros acordes (otro tono) y otro tempo.
        S.bars = barsOf(o, S.chorus);
        S.q.push({ t: S.t, chorus: S.chorus });
      }
      const idx = o.seq[S.pos], bar = S.bars[idx];
      const bd = beatDur(o.getTempo(S.chorus), bar);
      let nextIdx = null, nextBars = S.bars;
      if (S.pos + 1 < o.seq.length) nextIdx = o.seq[S.pos + 1];
      else if (S.chorus + 1 < o.choruses) { nextIdx = o.seq[0]; nextBars = barsOf(o, S.chorus + 1); }
      const nb = nextIdx == null ? null : nextBars[nextIdx], ns = nb ? nb.slots[0] : null;
      // si el compás que sigue empieza con un acorde anticipado, entra en este: `hold` es cuánto dura allá
      const ahead = ns && ns.beat === 0 && ns.push
        ? { ...ns, hold: (nb.slots[1] ? nb.slots[1].beat : nb.beats) * beatDur(o.getTempo(S.chorus), nb) } : null;
      S.idx = idx;
      schedBar(bar, S.t, bd, ns && ns.beat === 0 ? ns.chord : null, ahead);
      S.q.push({ t: S.t, i: idx });
      S.t += bar.beats * bd;
      S.pos++;
      S.barNo++;
    }
  }

  // Avisa a la pantalla qué compás está sonando. Devuelve false si el tema terminó.
  function flush() {
    while (S.q.length && S.q[0].t <= ctx.currentTime) {
      const e = S.q.shift();
      if (e.end) {
        const cb = S.o.onEnd;
        stop();
        if (cb) cb();
        return false;
      }
      if (e.chorus != null) {
        if (S.o.onChorus) S.o.onChorus(e.chorus);
        continue;
      }
      S.o.onBar(e.i);
    }
    return true;
  }

  function frame() {
    if (S && flush()) raf = requestAnimationFrame(frame);
  }

  // Compases ya resueltos de una vuelta: los mismos siempre, o los que dé barsFor (modo práctica).
  const barsOf = (o, chorus) => (o.barsFor ? o.barsFor(chorus) : o.bars);

  // o: { seq, startPos, finalChord, bars, getTempo, style, keys, partAt, choruses, countIn, onBar, onEnd }
  // partAt(compás) dice qué versión de la base lleva ese compás, en los ritmos que tienen más de una (son).
  // keys es el teclado de la canción ('piano', 'rhodes' o 'cp80'; si falta, piano).
  // Opcionales para el modo práctica: barsFor(vuelta) en lugar de bars, getTempo(vuelta), finalChord(vuelta)
  // y onChorus(vuelta), que avisa cuando empieza a sonar cada vuelta (la primera es la 0).
  function play(o) {
    stop();
    if (!o.seq.length) return false;
    ensure();
    makeBuses();
    S = { o, pos: o.startPos || 0, chorus: 0, t: 0, barNo: 0, last: null, lb: 38, q: [], bars: barsOf(o, 0) };
    const mine = S, keys = o.keys || 'piano';
    const begin = () => {
      if (S !== mine) return;
      S.bank = bankFor(keys);
      S.t = ctx.currentTime + 0.1;
      if (o.countIn) {
        const b = S.bars[o.seq[S.pos]];
        const bd = beatDur(o.getTempo(0), b);
        for (let i = 0; i < b.beats; i++) click(S.t + i * bd, i === 0, bus.fixed);
        S.t += b.beats * bd;
      }
      S.q.push({ t: S.t, chorus: 0 });
      timer = setInterval(tick, 25);
      tick();
      raf = requestAnimationFrame(frame);
    };
    // La primera vez hay que preparar los sonidos grabados: se los espera un momento y, si tardan, este tema
    // arranca con los sintetizados (los grabados quedan para la próxima vez que se toque).
    if (typeof fetch !== 'function' || complete(keys)) begin();
    else Promise.race([prepare(keys), new Promise(ok => setTimeout(ok, 2500))]).then(begin);
    return true;
  }

  function stop() {
    if (timer) clearInterval(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = raf = null;
    if (out) {
      const o = out;
      o.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => o.disconnect(), 250);
      out = bus = null;
    }
    S = null;
  }

  // preload(teclado): va bajando los sonidos que necesita una canción, sin esperar a que se toque.
  // setTrims({ chico: 0.5, ... }): volumen de cada instrumento de la base, para el ritmo que se va a tocar.
  return { play, stop, setVol, setTrims: t => { trims = t || {}; }, preload: keys => { preload(keys).catch(() => {}); }, isPlaying: () => !!S };
})();
