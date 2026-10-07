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
  };

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
      const x = { at, segs, next, barNo: S.barNo };
      if (B === 4 && bar.den === 4 && patterns[style]) patterns[style](t, bd, x);
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
          const c = o.finalChord;
          if (c && o.style !== 'click') {
            const bd = 60 / o.getTempo();
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
      }
      const idx = o.seq[S.pos], bar = o.bars[idx];
      const bd = 60 / o.getTempo() * 4 / bar.den;
      let nextIdx = null;
      if (S.pos + 1 < o.seq.length) nextIdx = o.seq[S.pos + 1];
      else if (S.chorus + 1 < o.choruses) nextIdx = o.seq[0];
      const ns = nextIdx == null ? null : o.bars[nextIdx].slots[0];
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
      S.o.onBar(e.i);
    }
    return true;
  }

  function frame() {
    if (S && flush()) raf = requestAnimationFrame(frame);
  }

  // o: { seq, startPos, finalChord, bars, getTempo, style, choruses, countIn, onBar, onEnd }
  function play(o) {
    stop();
    if (!o.seq.length) return false;
    ensure();
    makeBuses();
    S = { o, pos: o.startPos || 0, chorus: 0, t: ctx.currentTime + 0.1, barNo: 0, last: null, lb: 38, q: [] };
    if (o.countIn) {
      const b = o.bars[o.seq[S.pos]];
      const bd = 60 / o.getTempo() * 4 / b.den;
      for (let i = 0; i < b.beats; i++) click(S.t + i * bd, i === 0, bus.fixed);
      S.t += b.beats * bd;
    }
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
