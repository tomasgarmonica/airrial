// Banda de acompañamiento sintetizada con Web Audio (bajo, teclado, batería, claqueta).
const Engine = (() => {
  let ctx = null, noise = null, out = null, bus = null, timer = null, raf = null, S = null;
  const vol = { bass: 0.8, keys: 0.6, drums: 0.7, click: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function makeBuses() {
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp);
    comp.connect(ctx.destination);
    bus = {};
    for (const k of ['bass', 'keys', 'drums', 'click', 'fixed']) {
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
  function nz(t, dur, type, freq, peak, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus.drums);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
  function kick(t, v) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    g.connect(bus.drums);
    const o = osc('sine', 130, t, t + 0.25, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  }
  function snare(t, v) {
    nz(t, 0.16, 'highpass', 1800, v);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    g.connect(bus.drums);
    osc('triangle', 190, t, t + 0.1, g);
  }
  const hat = (t, v) => nz(t, 0.04, 'highpass', 7500, v);
  const ride = (t, v) => nz(t, 0.3, 'bandpass', 8500, v, 1.2);
  const rim = (t, v) => nz(t, 0.03, 'bandpass', 1900, v, 4);
  const shaker = (t, v, dur) => nz(t, dur, 'bandpass', 6500, v, 0.8);
  // Parche: tambores de candombe, surdo, bombo legüero (según la altura).
  function tom(t, f, v, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bus.drums);
    const o = osc('sine', f * 1.5, t, t + dur + 0.02, g);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  }
  // Madera: clave, tamborim, cencerro.
  function wood(t, v) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    g.connect(bus.drums);
    osc('triangle', 2300, t, t + 0.08, g);
  }
  function click(t, accent, dest) {
    const g = env(dest, t, 0.7, 0.03, 0.02);
    osc('sine', accent ? 1760 : 1175, t, t + 0.08, g);
  }
  function bassNote(t, m, dur, v) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.connect(bus.bass);
    osc('sawtooth', mtof(m), t, t + dur + 0.1, env(f, t, v * 0.8, dur, 0.04));
  }
  function chordHit(t, notes, dur, v) {
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
        if (b % 2) { hat(tb, 0.3); ride(tb + bd * 2 / 3, 0.13); }
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
    samba(t, bd, x) {
      const s = bd / 4;
      for (let i = 0; i < 16; i++) shaker(t + i * s, i % 4 === 0 ? 0.22 : i % 4 === 3 ? 0.18 : 0.1, 0.035);
      for (let b = 0; b < 4; b++) tom(t + b * bd, b % 2 ? 80 : 85, b % 2 ? 0.8 : 0.35, b % 2 ? 0.3 : 0.08);
      for (const i of [0, 2, 3, 5, 7, 9, 10, 12, 14]) wood(t + i * s, 0.2);
      const c0 = x.at(0), c2 = x.at(2);
      if (c0) bass(t, rootOf(c0), s * 6, 0.95);
      if (c2) {
        const m = c2 !== c0 ? rootOf(c2) : fifthOf(c2);
        bassNote(t + 7 * s, m, s * 0.8, 0.5);
        bass(t + 8 * s, m, s * 6, 0.9);
      }
      if (x.next) bass(t + 15 * s, rootOf(x.next), s * 0.8, 0.55);
      for (const i of [0, 3, 6, 10, 13]) {
        const c = x.at(i / 4);
        if (c) chordHit(t + i * s, voice(c), s * 2, 0.8);
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
    // Madera con la clave, y los tres tambores: chico, piano y repique.
    candombe(t, bd, x) {
      const s = bd / 4;
      for (const i of [0, 3, 6, 10, 12]) wood(t + i * s, 0.45);
      for (let i = 0; i < 16; i++) if (i % 4) tom(t + i * s, 340, i % 4 === 2 ? 0.3 : 0.2, 0.07);
      for (const i of [0, 3, 6, 8, 11, 14]) tom(t + i * s, 95, i % 8 ? 0.5 : 0.75, 0.22);
      if (x.barNo % 2) for (const i of [10, 13, 15]) tom(t + i * s, 190, 0.4, 0.12);
      for (const [i, fifth, d] of [[0, 0, 3], [3, 1, 3], [6, 0, 2], [8, 0, 3], [11, 1, 3], [14, 0, 2]]) {
        const c = x.at(i / 4);
        if (c) bass(t + i * s, fifth ? fifthOf(c) : rootOf(c), s * d * 0.9, fifth ? 0.75 : 0.95);
      }
      for (const i of [2, 6, 10, 14]) {
        const c = x.at(i / 4);
        if (c) chordHit(t + i * s, voice(c), s * 1.5, 0.8);
      }
    },
    // Güiro en "chiqui-chiqui", bombo en 1 y 3 y acordes a contratiempo.
    cumbia(t, bd, x) {
      const e = bd / 2, s = bd / 4;
      for (let b = 0; b < 4; b++) {
        const tb = t + b * bd;
        shaker(tb, 0.3, 0.09); shaker(tb + 2 * s, 0.18, 0.04); shaker(tb + 3 * s, 0.18, 0.04);
        wood(tb, 0.15);
      }
      // Bajo: fundamental, tercera y quinta en negra, corchea, corchea; dos veces por compás.
      for (const h of [0, 2]) {
        const c = x.at(h), c1 = x.at(h + 1);
        if (c) bass(t + h * bd, rootOf(c), bd * 0.9, 1);
        if (!c1) continue;
        const r = c1 === c ? S.lb : rootOf(c1);
        const up = iv => near((c1.root + iv) % 12, r + iv);
        bass(t + (h + 1) * bd, c1 === c ? up(c1.iv[0]) : r, e * 0.9, 0.85);
        bass(t + (h + 1.5) * bd, up(c1.iv[1]), e * 0.9, 0.9);
      }
      kick(t, 0.8); kick(t + 2 * bd, 0.7);
      tom(t + 1.5 * bd, 200, 0.35, 0.12); tom(t + 3.5 * bd, 200, 0.35, 0.12); tom(t + 3.75 * bd, 240, 0.3, 0.1);
      for (const i of [1, 3, 5, 7]) {
        const c = x.at(i / 2);
        if (c) chordHit(t + i * e, voice(c), e * 0.6, 0.85);
      }
    },
    // Seis corcheas por compás (6/8 o 3/4): bombo legüero con el parche en 2 y 3, bajo en negras.
    chacarera(t, bd, x, B) {
      const e = bd * B / 6, at = i => x.at(i * B / 6);
      for (const [i, v] of [[0, 0.4], [3, 0.3], [5, 0.3]]) rim(t + i * e, v);
      tom(t + 2 * e, 85, 0.7, 0.25); tom(t + 4 * e, 80, 0.85, 0.3);
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
      tom(t, 80, 0.8, 0.35); tom(t + 4 * e, 85, 0.55, 0.3);
      for (const [i, v] of [[2, 0.3], [3, 0.35], [5, 0.25]]) rim(t + i * e, v);
      const c0 = at(0), c3 = at(3);
      if (c0) bass(t, rootOf(c0), e * 2.8, 1);
      if (c3) bass(t + 3 * e, c3 === c0 ? fifthOf(c3) : rootOf(c3), e * 1.8, 0.8);
      if (x.next) bass(t + 5 * e, rootOf(x.next), e * 0.8, 0.55);
      for (const [i, d, v] of [[0, 2.6, 0.95], [3, 0.9, 0.75], [4, 0.8, 0.6], [5, 0.8, 0.6]]) {
        const c = at(i);
        if (c) chordHit(t + i * e, voice(c), e * d, v);
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
  const METER = { chacarera: '6/8 3/4', zamba: '6/8 3/4', vals: '3/4' };

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

  function schedBar(bar, t, bd, next) {
    const B = bar.beats, slots = bar.slots, carried = S.last;
    const at = b => {
      let c = carried;
      for (const s of slots) { if (s.beat <= b + 1e-6) c = s.chord; else break; }
      return c;
    };
    const style = S.o.style;
    for (let b = 0; b < B; b++) click(t + b * bd, b === 0, style === 'click' ? bus.fixed : bus.click);
    if (style !== 'click') {
      const segs = [];
      if (!slots.length || slots[0].beat > 0) segs.push({ beat: 0, chord: carried });
      for (const s of slots) segs.push({ beat: s.beat, chord: s.chord });
      segs.forEach((s, i) => { s.len = (i + 1 < segs.length ? segs[i + 1].beat : B) - s.beat; });
      const x = { at, segs, next, prev: carried, barNo: S.barNo };
      const fits = (METER[style] || '4/4').split(' ').includes(B + '/' + bar.den);
      if (fits && patterns[style]) patterns[style](t, bd, x, B);
      else generic(t, bd, x, B);
    }
    S.last = at(B);
  }

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
          if (c && o.style !== 'click') {
            const bd = 60 / o.getTempo(S.chorus - 1);
            chordHit(S.t, voice(c), bd * 4, 1);
            bass(S.t, rootOf(c), bd * 4, 0.9);
            kick(S.t, 0.8);
            ride(S.t, 0.3);
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
      const bd = 60 / o.getTempo(S.chorus) * 4 / bar.den;
      let nextIdx = null, nextBars = S.bars;
      if (S.pos + 1 < o.seq.length) nextIdx = o.seq[S.pos + 1];
      else if (S.chorus + 1 < o.choruses) { nextIdx = o.seq[0]; nextBars = barsOf(o, S.chorus + 1); }
      const ns = nextIdx == null ? null : nextBars[nextIdx].slots[0];
      schedBar(bar, S.t, bd, ns && ns.beat === 0 ? ns.chord : null);
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

  // o: { seq, startPos, finalChord, bars, getTempo, style, choruses, countIn, onBar, onEnd }
  // Opcionales para el modo práctica: barsFor(vuelta) en lugar de bars, getTempo(vuelta), finalChord(vuelta)
  // y onChorus(vuelta), que avisa cuando empieza a sonar cada vuelta (la primera es la 0).
  function play(o) {
    stop();
    if (!o.seq.length) return false;
    ensure();
    makeBuses();
    S = { o, pos: o.startPos || 0, chorus: 0, t: ctx.currentTime + 0.1, barNo: 0, last: null, lb: 38, q: [], bars: barsOf(o, 0) };
    if (o.countIn) {
      const b = S.bars[o.seq[S.pos]];
      const bd = 60 / o.getTempo(0) * 4 / b.den;
      for (let i = 0; i < b.beats; i++) click(S.t + i * bd, i === 0, bus.fixed);
      S.t += b.beats * bd;
    }
    S.q.push({ t: S.t, chorus: 0 });
    timer = setInterval(tick, 25);
    tick();
    raf = requestAnimationFrame(frame);
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

  return { play, stop, setVol, isPlaying: () => !!S };
})();
