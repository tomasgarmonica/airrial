// Banda de acompañamiento con Web Audio (bajo, teclado, batería, claqueta): sonidos grabados donde los hay
// (carpeta sonidos/) y sintetizados para el resto.
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

  // --- sonidos grabados ---
  // Se bajan al abrir una canción y se preparan la primera vez que se toca. Mientras no estén, o si algo
  // falla (sin conexión la primera vez, por ejemplo), suena todo sintetizado.
  let bank = null, fetched = null, preparing = null;
  function preload() {
    if (!fetched && typeof fetch === 'function') {
      const get = async file => {
        const res = await fetch('sonidos/' + file);
        if (!res.ok) throw new Error(file);
        return res;
      };
      fetched = (async () => {
        const groups = Object.values(await (await get('indice.json')).json());
        const data = await Promise.all(groups.map(async g => (await get(g.archivo)).arrayBuffer()));
        return groups.map((g, i) => ({ ...g, data: data[i] }));
      })();
      fetched.catch(() => { fetched = null; });
    }
    return fetched;
  }
  // Cada archivo trae muchos sonidos en fila y una marca al principio (un clic): según el navegador, el audio
  // queda corrido unos milisegundos al abrirlo, y la marca dice cuánto.
  function prepare() {
    if (!preparing) {
      preparing = (async () => {
        const b = {};
        for (const g of await preload()) {
          const buf = await new Promise((ok, no) => ctx.decodeAudioData(g.data, ok, no));
          const d = buf.getChannelData(0);
          let i = 0;
          while (i < d.length && Math.abs(d[i]) < 0.25) i++;
          const shift = i / buf.sampleRate - g.marca;
          if (!(Math.abs(shift) < 0.2)) throw new Error(g.archivo);
          for (const [name, [at, len]] of Object.entries(g.sonidos)) b[name] = { buf, at: at + shift, len };
        }
        bank = b;
      })().catch(() => { fetched = null; }).then(() => { preparing = null; });
    }
    return preparing;
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
    src.connect(g); g.connect(bus.drums);
    src.start(t, s.at, Math.min(s.len, dur + 0.04));
    return true;
  }
  function nz(t, dur, type, freq, peak, q) {
    if (silent(t)) return;
    dur = until(t, dur);
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
  const ride = (t, v) => nz(t, 0.3, 'bandpass', 8500, v, 1.2);
  const rim = (t, v, name) => shot(name || 'aro', t, v) || nz(t, 0.03, 'bandpass', 1900, v, 4);
  // Los que siguen llevan al final el nombre del sonido grabado que los reemplaza, que cambia según el ritmo.
  const shaker = (t, v, dur, name) => shot(name, t, v, dur * 3) || nz(t, dur, 'bandpass', 6500, v, 0.8);
  // Parche: tambores de candombe, surdo, bombo legüero (según la altura).
  function tom(t, f, v, dur, name, cap) {
    if (shot(name, t, v, cap) || silent(t)) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bus.drums);
    const o = osc('sine', f * 1.5, t, t + dur + 0.02, g);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  }
  // Madera: clave, tamborim, cencerro.
  function wood(t, v, name) {
    if (shot(name, t, v) || silent(t)) return;
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
    if (silent(t) || tied(t)) return;
    dur = until(t, dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    f.connect(bus.bass);
    osc('sawtooth', mtof(m), t, t + dur + 0.1, env(f, t, v * 0.8, dur, 0.04));
  }
  function chordHit(t, notes, dur, v) {
    if (silent(t) || tied(t)) return;
    dur = until(t, dur);
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
    samba(t, bd, x) {
      const s = bd / 4;
      for (let i = 0; i < 16; i++) shaker(t + i * s, i % 4 === 0 ? 0.22 : i % 4 === 3 ? 0.18 : 0.1, 0.035, 'pandeiro_platinelas');
      for (let b = 0; b < 4; b++) tom(t + b * bd, b % 2 ? 80 : 85, b % 2 ? 0.8 : 0.35, b % 2 ? 0.3 : 0.08, 'chancha', b % 2 ? 1.2 : 0.1);
      for (const i of [0, 2, 3, 5, 7, 9, 10, 12, 14]) wood(t + i * s, 0.2, 'chico_palo');
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
      for (const i of [0, 3, 6, 10, 12]) wood(t + i * s, 0.45, 'clave');
      for (let i = 0; i < 16; i++) if (i % 4) tom(t + i * s, 340, i % 4 === 2 ? 0.3 : 0.2, 0.07, i % 4 === 1 ? 'chico_mano' : 'chico_palo');
      for (const i of [0, 3, 6, 8, 11, 14]) tom(t + i * s, 95, i % 8 ? 0.5 : 0.75, 0.22, 'tumba_tono');
      if (x.barNo % 2) for (const i of [10, 13, 15]) tom(t + i * s, 190, 0.4, 0.12, 'conga_tono');
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
        shaker(tb, 0.3, 0.09, 'guiro_arrastre'); shaker(tb + 2 * s, 0.18, 0.04, 'guiro_abajo'); shaker(tb + 3 * s, 0.18, 0.04, 'guiro_arriba');
        wood(tb, 0.15, 'campana_lomo');
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
      tom(t + 1.5 * bd, 200, 0.35, 0.12, 'conga_tono'); tom(t + 3.5 * bd, 200, 0.35, 0.12, 'conga_tono'); tom(t + 3.75 * bd, 240, 0.3, 0.1, 'conga_tono');
      for (const i of [1, 3, 5, 7]) {
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
      for (const [i, v] of [[0, 0.4], [3, 0.3], [5, 0.3]]) rim(t + i * e, v, 'leguero_aro');
      tom(t + 2 * e, 85, 0.7, 0.25, 'leguero_medio'); tom(t + 4 * e, 80, 0.85, 0.3, 'leguero_fuerte');
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
      tom(t, 80, 0.8, 0.35, 'leguero_fuerte'); tom(t + 4 * e, 85, 0.55, 0.3, 'leguero_medio');
      for (const [i, v] of [[2, 0.3], [3, 0.35], [5, 0.25]]) rim(t + i * e, v, 'leguero_aro');
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

  function schedBar(bar, t, bd, next, ahead) {
    const B = bar.beats, carried = S.last;
    // Anticipaciones: un acorde marcado así entra una corchea antes de donde está escrito y queda ligado: se
    // sostiene mientras dura, sin volver a atacarse en su tiempo. Si está en el primer tiempo, entra al final
    // del compás anterior: `ahead` es ese acorde del compás que sigue (con `hold`, cuánto dura allá), y
    // `S.pushed` avisa después que el primer acorde ya entró.
    const eighth = bar.den / 8, came = S.pushed;
    const slots = bar.slots.map((s, i) => {
      if (!s.push) return s;
      if (s.beat > 0) return { ...s, beat: Math.max(s.beat - eighth, 0), early: true, written: s.beat };
      return came && i === 0 ? { ...s, held: true } : s;
    });
    if (ahead) slots.push({ beat: B - eighth, chord: ahead.chord, cut: ahead.cut, early: true, hold: ahead.hold });
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
      const x = { at, segs, next, prev: carried, barNo: S.barNo };
      const fits = (METER[style] || '4/4').split(' ').includes(B + '/' + bar.den);
      if (fits && patterns[style]) patterns[style](t, bd, x, B);
      else generic(t, bd, x, B);
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
      const nb = nextIdx == null ? null : nextBars[nextIdx], ns = nb ? nb.slots[0] : null;
      // si el compás que sigue empieza con un acorde anticipado, entra en este: `hold` es cuánto dura allá
      const ahead = ns && ns.beat === 0 && ns.push
        ? { ...ns, hold: (nb.slots[1] ? nb.slots[1].beat : nb.beats) * bd * bar.den / nb.den } : null;
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

  // o: { seq, startPos, finalChord, bars, getTempo, style, choruses, countIn, onBar, onEnd }
  // Opcionales para el modo práctica: barsFor(vuelta) en lugar de bars, getTempo(vuelta), finalChord(vuelta)
  // y onChorus(vuelta), que avisa cuando empieza a sonar cada vuelta (la primera es la 0).
  function play(o) {
    stop();
    if (!o.seq.length) return false;
    ensure();
    makeBuses();
    S = { o, pos: o.startPos || 0, chorus: 0, t: 0, barNo: 0, last: null, lb: 38, q: [], bars: barsOf(o, 0) };
    const mine = S;
    const begin = () => {
      if (S !== mine) return;
      S.bank = bank;
      S.t = ctx.currentTime + 0.1;
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
    };
    // La primera vez hay que preparar los sonidos grabados: se los espera un momento y, si tardan, este tema
    // arranca con los sintetizados (los grabados quedan para la próxima vez que se toque).
    if (bank || typeof fetch !== 'function') begin();
    else Promise.race([prepare(), new Promise(ok => setTimeout(ok, 2500))]).then(begin);
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

  return { play, stop, setVol, preload, isPlaying: () => !!S };
})();
