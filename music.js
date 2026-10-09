// Lógica musical: lectura del cifrado, acordes, transposición y repeticiones.
const Music = (() => {
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const CHORD = /^([A-G])([#b♯♭]?)([^/]*(?:\/(?![A-G])[^/]*)*)(?:\/([A-G])([#b♯♭]?))?$/;
  const TOKEN = /\[[^\]]*\]|"[^"]*"|:?\|+:?|[^\s|\[\]":]+/g;

  const accVal = a => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);
  const pretty = s => s.replace(/b/g, '♭').replace(/#/g, '♯');

  function parseChord(str) {
    const m = CHORD.exec(str);
    if (!m) return null;
    return {
      letter: m[1], acc: m[2], qual: m[3],
      num: (NOTE[m[1]] + accVal(m[2]) + 12) % 12,
      bassLetter: m[4] || null, bassAcc: m[5] || '',
      bassNum: m[4] ? (NOTE[m[4]] + accVal(m[5]) + 12) % 12 : null,
    };
  }

  // Nombre a mostrar de un acorde ya leído, transportado `semis` semitonos.
  // Cómo se muestran los acordes: 'letras' (C, Dm7), 'jazz' (△7, -7, ø), 'latino' (Do, Re, Mi) o 'grados' (I, IIm7, V7).
  // `key` es la tonalidad escrita de la canción; solo hace falta para los grados.
  let view = { notation: 'letras', key: '' };
  const setView = v => { view = { notation: (v && v.notation) || 'letras', key: (v && v.key) || '' }; };
  const LATIN = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const DEGREES = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  const jazzQual = q => q.replace(/^(min|m(?!aj))/, '-').replace(/maj|Maj|M(?=7|9|11|13)/g, '△')
    .replace(/-7b5|ø7?/, 'ø').replace(/dim/, 'o').replace(/aug/, '+');

  // Nombre a mostrar de un acorde ya leído, transportado `semis` semitonos.
  function spell(c, semis, flats) {
    const tonic = view.notation === 'grados' ? parseChord(view.key) : null;
    const name = (letter, acc, num) => {
      if (tonic) return DEGREES[(num - tonic.num + 12) % 12];
      const s = semis ? (flats ? FLATS : SHARPS)[(num + semis + 120) % 12] : letter + acc;
      return pretty(view.notation === 'latino' ? LATIN[s[0]] + s.slice(1) : s);
    };
    return {
      root: name(c.letter, c.acc, c.num),
      qual: pretty(view.notation === 'jazz' ? jazzQual(c.qual) : c.qual),
      bass: c.bassLetter ? name(c.bassLetter, c.bassAcc, c.bassNum) : '',
    };
  }

  function transposeName(str, semis, flats) {
    const c = parseChord(str);
    if (!c) return str;
    const was = view;
    view = { notation: 'letras', key: '' };
    const d = spell(c, semis, flats);
    view = was;
    return d.root + d.qual + (d.bass ? '/' + d.bass : '');
  }

  // ¿Conviene escribir con bemoles en la tonalidad de destino?
  function useFlats(key, semis) {
    const c = parseChord(key || '');
    if (!c) return true;
    const minor = /^(m(?!aj)|min|-)/.test(c.qual);
    const major = (c.num + semis + (minor ? 3 : 0) + 120) % 12;
    return ![7, 2, 9, 4, 11, 6].includes(major);
  }

  function firstChord(bars) {
    for (const b of bars) for (const it of b.items) if (parseChord(it)) return it;
    return '';
  }

  // Tiempo en el que cae cada elemento de un compás con `n` elementos.
  function positions(n, beats) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(n <= beats ? Math.floor(i * beats / n) : i * beats / n);
    return out;
  }

  function parseChart(text, defTs) {
    const bars = [];
    let pend = {};
    let ts = (defTs || [4, 4]).slice();
    String(text || '').split(/\r?\n/).forEach((line, row) => {
      let cur = null;
      const open = () => {
        if (!cur) { cur = Object.assign({ items: [], row, ts: ts.slice() }, pend); pend = {}; }
        return cur;
      };
      const close = () => { if (cur) { bars.push(cur); cur = null; } };
      const word = tk => {
        const e = /^(\d)\.(.*)$/.exec(tk);
        if (e) { pend.ending = +e[1]; if (e[2]) word(e[2]); return; }
        if (/^\d+\/\d+$/.test(tk)) {
          const [a, b] = tk.split('/').map(Number);
          if (a > 0 && a <= 16 && [2, 4, 8, 16].includes(b)) { ts = [a, b]; pend.showTs = pend.tsSet = true; return; }
        }
        const last = bars[bars.length - 1];
        if (/^x\d+$/i.test(tk) && !cur && last && last.repEnd) {
          last.times = Math.min(16, Math.max(2, +tk.slice(1)));
          return;
        }
        open().items.push(tk);
      };
      for (const tk of line.match(TOKEN) || []) {
        if (/^:?\|+:?$/.test(tk)) {
          if (tk[0] === ':') {
            if (cur) cur.repEnd = true;
            else if (bars.length) bars[bars.length - 1].repEnd = true;
          }
          close();
          if (tk[tk.length - 1] === ':') pend.repStart = true;
        } else if (tk[0] === '[') pend.section = tk.slice(1, -1).trim();
        else if (tk[0] === '"') pend.text = tk.slice(1, -1);
        else word(tk);
      }
      close();
    });
    if (bars.length) bars[0].showTs = true;
    return bars;
  }

  // Intervalos (en semitonos sobre la fundamental) que suenan en el acompañamiento.
  function intervals(q) {
    const s = (q || '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[()\s,]/g, '');
    if (s === "5") return [7, 7];
    let third = 4, fifth = 7, sev = null, nin = null;
    if (/add9|add2|6\/9|69/.test(s)) nin = 14;
    const core = s.replace(/add\d+|6\/9|69/g, m => (/6/.test(m) ? '6' : ''));
    const plain = core.replace(/[b#]\d+/g, '');
    if (/^(m(?!aj)|min|-)/.test(core)) third = 3;
    if (/sus2/.test(core)) third = 2; else if (/sus/.test(core)) third = 5;
    if (/7|9|11|13/.test(plain)) sev = /maj|Maj|M|△|Δ|\^/.test(core) ? 11 : 10;
    else if (/△|Δ|\^/.test(core)) sev = 11;
    else if (/6/.test(core)) sev = 9;
    if (/dim|°|^o/.test(core)) { third = 3; fifth = 6; if (/7/.test(core)) sev = 9; }
    if (/ø|^h/.test(core)) { third = 3; fifth = 6; sev = 10; }
    if (/b5/.test(core)) fifth = 6;
    if (/#5|aug|\+(?!\d)|\+5/.test(core)) fifth = 8;
    if (/b9|alt/.test(core)) nin = 13;
    else if (/#9/.test(core)) nin = 15;
    else if (/9|11|13/.test(plain)) nin = 14;
    const iv = [third, fifth];
    if (sev != null) iv.push(sev);
    if (nin != null) iv.push(nin);
    return iv;
  }

  // Compases listos para sonar: en qué tiempo entra cada acorde.
  function resolve(bars, semis) {
    const out = [];
    bars.forEach((b, i) => {
      const beats = b.ts[0];
      const real = b.items.filter(x => x !== '.');
      let slots = [];
      if (real.length === 1 && real[0] === '%' && i > 0) slots = out[i - 1].slots;
      else {
        const pos = positions(b.items.length, beats);
        b.items.forEach((it, k) => {
          if (it === '.' || it === '%') return;
          if (/^n\.?c\.?$/i.test(it)) { slots.push({ beat: pos[k], chord: null }); return; }
          const c = parseChord(it);
          if (!c) return;
          const root = (c.num + semis + 120) % 12;
          slots.push({
            beat: pos[k],
            chord: {
              root,
              bass: c.bassNum == null ? root : (c.bassNum + semis + 120) % 12,
              iv: intervals(c.qual),
            },
          });
        });
      }
      out.push({ beats, den: b.ts[1], slots });
    });
    return out;
  }

  // Qué indica la anotación de un compás: 'segno', 'coda', 'fine', 'alcoda', 'dc', 'ds' o '' (texto libre).
  function markOf(b) {
    const t = (b.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^d\.?\s?c\b/.test(t)) return 'dc';
    if (/^d\.?\s?s\b/.test(t)) return 'ds';
    return { segno: 'segno', coda: 'coda', fine: 'fine', 'al coda': 'alcoda' }[t] || '';
  }

  // Orden real de ejecución, con repeticiones, casillas y saltos (D.C., D.S., Fine, Coda).
  // Después de un D.C. o D.S. no se hacen las repeticiones: se toma la última casilla, se termina en "Fine"
  // y en "Al Coda" se salta al compás marcado "Coda".
  function unfold(bars) {
    const seq = [];
    let i = 0, start = 0, pass = 1, checked = -1, jumped = false;
    const later = (from, n) => {
      for (let j = from + 1; j < bars.length && !bars[j].repStart; j++) if (bars[j].ending === n) return j;
      return -1;
    };
    const segno = bars.findIndex(b => markOf(b) === 'segno'), coda = bars.findIndex(b => markOf(b) === 'coda');
    while (i < bars.length && seq.length < 4000) {
      const b = bars[i];
      if (b.repStart && start !== i) { start = i; pass = 1; }
      if (b.ending && jumped) {
        let last = i;
        for (let n = b.ending + 1, j; (j = later(last, n)) >= 0; n++) last = j;
        if (last !== i) { i = last; continue; }
      } else if (b.ending && checked !== i) {
        if (b.ending !== pass) {
          const j = later(i, pass);
          if (j >= 0) { i = j; continue; }
        } else if (pass > 1 && later(i, pass + 1) < 0) { start = i; pass = 1; checked = i; }
      }
      seq.push(i);
      const mark = markOf(b);
      if (jumped) {
        if (mark === 'fine') break;
        if (mark === 'alcoda' && coda >= 0) { i = coda; continue; }
      } else {
        if (b.repEnd) {
          const total = Math.max(b.times || 2, later(i, pass + 1) >= 0 ? pass + 1 : 0);
          if (pass < total) { pass++; i = start; continue; }
          pass = 1; start = i + 1;
        }
        if (mark === 'dc' || mark === 'ds') {
          jumped = true;
          i = mark === 'ds' && segno >= 0 ? segno : 0;
          start = i; pass = 1; checked = -1;
          continue;
        }
      }
      i++;
    }
    return seq;
  }

  // Recalcula el compás vigente en cada lugar después de editar la grilla.
  function normalize(bars, defTs) {
    let ts = (defTs || [4, 4]).slice();
    bars.forEach((b, i) => {
      if (b.tsSet) ts = b.ts.slice(); else b.ts = ts.slice();
      b.showTs = !!b.tsSet || i === 0;
    });
    return bars;
  }

  // Vuelve a escribir los compases como texto (el formato en que se guardan).
  function serialize(bars) {
    const lines = [];
    let row = null, line = "", open = false;
    for (const b of bars) {
      if (b.row !== row) {
        if (row !== null) lines.push(line + (open ? " |" : ""));
        line = "";
        row = b.row;
      } else line += " ";
      const parts = [];
      if (b.section) parts.push("[" + b.section + "]");
      if (b.text) parts.push("\"" + b.text + "\"");
      if (b.tsSet) parts.push(b.ts[0] + "/" + b.ts[1]);
      if (b.ending) parts.push(b.ending + ".");
      parts.push(...(b.items.length ? b.items : ["_"]));
      line += (b.repStart ? "|: " : "| ") + parts.join(" ");
      open = !b.repEnd;
      if (b.repEnd) line += " :|" + (b.times > 2 ? " x" + b.times : "");
    }
    if (row !== null) lines.push(line + (open ? " |" : ""));
    return lines.join('\n');
  }

  return { setView, markOf, normalize, serialize, parseChord, spell, transposeName, useFlats, firstChord, positions, parseChart, intervals, resolve, unfold };
})();

if (typeof module !== 'undefined') module.exports = Music;
