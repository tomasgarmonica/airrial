// Lógica musical: lectura del cifrado, acordes, transposición y repeticiones.
const Music = (() => {
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const CHORD = /^([A-G])([#b♯♭]?)([^/]*(?:\/(?![A-G])[^/]*)*)(?:\/([A-G])([#b♯♭]?))?$/;
  // El nombre de una parte no puede tener otro "[" adentro: así un texto lleno de corchetes sin cerrar se lee de
  // una pasada (si no, cada corchete obliga a recorrer el resto del renglón y un cifrado armado así cuelga la app).
  const TOKEN = /\[[^\[\]]*\]|"[^"]*"|:?\|+:?|[{}]|[^\s|\[\]":{}]+/g;

  const accVal = a => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);
  const pretty = s => s.replace(/b/g, '♭').replace(/#/g, '♯');

  // Un "!" al final marca un corte: la banda da un golpe seco en ese acorde y calla hasta el próximo.
  // Un "<" adelante marca una anticipación: el acorde está escrito en su lugar pero empieza a sonar una corchea antes.
  // Con "<<" la anticipación es de una semicorchea (`semi`).
  function parseChord(str) {
    let s = typeof str === 'string' ? str : '';
    const push = s.length > 1 && s[0] === '<', semi = push && s.length > 2 && s[1] === '<';
    if (push) s = s.slice(semi ? 2 : 1);
    const cut = s.length > 1 && s.endsWith('!');
    const m = CHORD.exec(cut ? s.slice(0, -1) : s);
    if (!m) return null;
    return {
      cut, push, semi, letter: m[1], acc: m[2], qual: m[3],
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

  // --- tiempos dentro del compás ---
  // Cada compás tiene `items` (acordes, '_' para un lugar vacío) y `lens`, el largo de cada uno como fracción
  // del compás. Los lugares nacen de dividir el compás en partes iguales, y esas partes de nuevo.

  // Reparte los elementos leídos de un compás. Entre llaves la grilla es pareja y exacta, y "." alarga al
  // anterior. Sin llaves vale la regla vieja: los elementos caen sobre los tiempos (tres acordes en 4/4 van
  // en los tiempos 1, 2 y 3).
  function measure(items, beats, grid) {
    const n = items.length, at = i => (grid || n > beats ? i / n : Math.floor(i * beats / n) / beats);
    const out = { items: [], lens: [] };
    items.forEach((it, i) => {
      if (it === '.' && out.items.length) return;
      let j = i + 1;
      while (j < n && items[j] === '.') j++;
      out.items.push(it === '.' ? '_' : it);
      out.lens.push((j < n ? at(j) : 1) - at(i));
    });
    return out.items.length ? out : { items: ['_'], lens: [1] };
  }
  const lensOf = b => b.lens || b.items.map(() => 1 / b.items.length);
  // Tiempo del compás en que empieza cada elemento.
  function starts(b) {
    let t = 0;
    return lensOf(b).map(len => { const s = t; t += len; return s * b.ts[0]; });
  }
  // Grilla pareja más chica en la que entran todos los elementos: cuántas casillas tiene y cuántas ocupa cada uno.
  function grid(b) {
    const lens = lensOf(b), whole = n => lens.every(l => Math.round(l * n) >= 1 && Math.abs(l * n - Math.round(l * n)) < 1e-6);
    let n = 1;
    while (n < 96 && !whole(n)) n++;
    const span = lens.map(l => Math.max(1, Math.round(l * n)));
    let t = 0;
    return { n, span, at: span.map(s => { const a = t; t += s; return a; }) };
  }
  // En cuántas partes se divide naturalmente un lugar que dura `beats` tiempos: por la mitad, salvo donde el
  // compás es ternario (3/4 en sus tres tiempos, la mitad de un 6/8 en tres corcheas, 5/4 en sus cinco tiempos).
  function natural(beats) {
    const r = Math.round(beats);
    return Math.abs(beats - r) < 1e-6 && r > 1 ? (r % 2 === 0 ? 2 : r % 3 === 0 ? 3 : r) : 2;
  }
  // Divide el elemento k en partes iguales: las naturales del compás, o las que se pidan (3 para un tresillo).
  // El acorde queda en la primera parte. No divide más chico que una semicorchea (o un tresillo de semicorchea).
  function split(b, k, parts) {
    b.lens = lensOf(b).slice();
    const len = b.lens[k], n = parts || natural(len * b.ts[0]);
    if (len / n * b.ts[0] * 4 / b.ts[1] < (n === 3 ? 1 / 6 : 1 / 4) - 1e-6) return false;
    b.items.splice(k, 1, b.items[k], ...Array(n - 1).fill('_'));
    b.lens.splice(k, 1, ...Array(n).fill(len / n));
    return true;
  }
  // Deshace la división que contiene al elemento k: lo une con sus vecinos iguales del mismo bloque y deja el
  // primer acorde que haya. Devuelve el lugar resultante, o -1 si el elemento no viene de una división.
  function join(b, k) {
    const E = 1e-6, lens = lensOf(b), len = lens[k], st = [];
    lens.reduce((t, l, i) => { st[i] = t; return t + l; }, 0);
    // Se baja desde el compás entero, dividiendo cada bloque como se habría dividido al escribirlo, hasta
    // encontrar el bloque del que el elemento k es una parte directa.
    let from = 0, size = 1;
    while (size > len + E) {
      const inside = lens.map((_, i) => i).filter(i => st[i] > from - E && st[i] + lens[i] < from + size + E);
      const part = n => size / n, cell = (x, n) => Math.floor((x - from) / part(n) + E);
      // una división vale si ningún elemento del bloque queda partido por sus bordes
      const n = [natural(size * b.ts[0]), 3, 2].find(m => inside.every(i => cell(st[i], m) === cell(st[i] + lens[i] - 2 * E, m)));
      if (!n || part(n) < len - E) return -1;
      if (Math.abs(part(n) - len) < E) {
        if (inside.length !== n || !inside.every(i => Math.abs(lens[i] - len) < E)) return -1;
        const keep = inside.map(i => b.items[i]).find(t => t !== '_') || '_';
        b.items.splice(inside[0], n, keep);
        b.lens = lens.slice();
        b.lens.splice(inside[0], n, size);
        return inside[0];
      }
      from += cell(st[k], n) * part(n);
      size = part(n);
    }
    return -1;
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
      const close = () => {
        if (!cur) return;
        Object.assign(cur, measure(cur.items, cur.ts[0], cur.grid));
        delete cur.grid;
        bars.push(cur);
        cur = null;
      };
      const word = tk => {
        const e = /^(\d)\.(.*)$/.exec(tk);
        if (e) { pend.ending = endings((pend.ending || []).concat(+e[1])); if (e[2]) word(e[2]); return; }
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
        else if (tk === '{') open().grid = true;
        else if (tk !== '}') word(tk);
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

  // Notas de un acorde como clases de altura desde la fundamental (0 a 11), con las tensiones escritas: "7(b9)" es
  // [0, 1, 4, 7, 10]. Una 13 o una 11 sin alterar traen también la 9, como se toca en jazz; el 11 de un dominante
  // va sin tercera (C11 es un C9sus4); "alt" es b9, #9 y b13.
  function tones(q) {
    const s = (q || '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[()\s,]/g, '');
    const out = new Set([0]);
    if (s === '5' || /no3/.test(s)) { out.add(7); if (/7/.test(s)) out.add(10); return [...out].sort((a, b) => a - b); }
    const core = s.replace(/add\d+|6\/9|69/g, m => (/6/.test(m) ? '6' : ''));
    const plain = core.replace(/[b#]\d+|alt/g, '');
    const minor = /^(m(?!aj)|min|-)/.test(core), dim = /dim|°|^o/.test(core), half = /ø|^h/.test(core);
    const dom = !minor && !dim && !half && /7|9|11|13/.test(plain) && !/maj|Maj|M|△|Δ|\^/.test(core);
    let third = minor || dim || half ? 3 : 4, fifth = 7, sev = null;
    if (/sus2/.test(core)) third = 2; else if (/sus/.test(core) || (dom && /11/.test(plain) && !/13/.test(plain))) third = 5;
    if (/7|9|11|13/.test(plain)) sev = /maj|Maj|M|△|Δ|\^/.test(core) ? 11 : 10;
    else if (/△|Δ|\^/.test(core)) sev = 11;
    else if (/6/.test(core)) sev = 9;
    if (dim) { fifth = 6; if (/7/.test(core)) sev = 9; }
    if (half) { fifth = 6; sev = 10; }
    if (/b5/.test(core)) fifth = 6;
    if (/#5|aug|\+(?!\d)|\+5/.test(core)) fifth = 8;
    out.add(third); out.add(fifth);
    if (sev != null) out.add(sev);
    if (/9|11|13/.test(plain) || /add9|add2|6\/9|69/.test(s)) out.add(2);
    if (/11/.test(plain) && third !== 5) out.add(5);
    if (/13/.test(plain)) out.add(9);
    if (/b9/.test(s)) { out.delete(2); out.add(1); }
    if (/#9/.test(s)) { out.delete(2); out.add(3); }
    if (/#11/.test(s)) out.add(6);
    if (/b13/.test(s)) out.add(8);
    if (/alt/.test(s)) [1, 3, 8].forEach(x => out.add(x));
    return [...out].sort((a, b) => a - b);
  }
  // Tipo de un acorde según sus notas (desde la fundamental): { base, tens }. `base` es 'maj' (tríada o sexta),
  // 'maj7', 'dom', 'min' (tríada o sexta menor), 'm7', 'mMaj7', 'm7b5', 'dim7', 'sus' o '' (otro: aumentado,
  // dominante con quinta alterada sin la quinta justa…). `tens` son las tensiones: 'b9', '9', '#9', '11', '#11',
  // 'b13', '13'. Sirve igual para un acorde escrito (con `tones`) que para una posición tocada en el piano.
  function kindOf(list) {
    const has = new Set(list.map(x => ((x % 12) + 12) % 12));
    const maj = has.has(4), min = has.has(3) && !maj, b7 = has.has(10), M7 = has.has(11);
    let base = '';
    if (maj && b7) base = 'dom';
    else if (maj && M7) base = 'maj7';
    else if (maj && !has.has(8)) base = 'maj';
    else if (min && has.has(6) && b7) base = 'm7b5';
    else if (min && has.has(6) && !has.has(7)) base = 'dim7';
    else if (min && b7) base = 'm7';
    else if (min && M7) base = 'mMaj7';
    else if (min && !has.has(6)) base = 'min';
    else if (has.has(5) && !maj && !min) base = 'sus';
    const tens = [];
    if (has.has(1)) tens.push('b9');
    if (has.has(2)) tens.push('9');
    if (has.has(3) && maj) tens.push('#9');
    if (has.has(5) && (maj || min)) tens.push('11');
    if (has.has(6) && base !== 'm7b5' && base !== 'dim7') tens.push('#11');
    if (has.has(8) && has.has(7) || (has.has(8) && base === 'dom')) tens.push('b13');
    if (has.has(9) && base !== 'dim7' && (b7 || M7)) tens.push('13');
    return { base, tens };
  }

  // De las posiciones escritas ([{ name, notes }], notas MIDI con la fundamental en Do), la que corresponde a un
  // acorde (sus notas, como las da `tones`), o null si ninguna sirve. Tiene que ser del mismo tipo y no tener
  // notas que choquen con el acorde: solo puede agregar una 9, una 13 (o sexta), una 11 en los menores y
  // suspendidos, o la quinta, y siempre que el acorde no tenga ya esa nota alterada (una 9 donde se pidió b9, la
  // quinta justa donde se pidió #5). De las que quedan, la que trae más de las tensiones pedidas y, entre iguales,
  // la más completa.
  function shapeFor(list, shapes) {
    const want = kindOf(list), has = new Set(list.map(x => ((x % 12) + 12) % 12));
    if (!want.base) return null;
    const minorish = want.base !== 'maj' && want.base !== 'maj7' && want.base !== 'dom';
    const ok = p => has.has(p)
      || (p === 2 && !has.has(1) && !(has.has(3) && has.has(4)))
      || (p === 9 && !has.has(8) && want.base !== 'm7b5')
      || (p === 5 && minorish && want.base !== 'dim7')
      || (p === 7 && !has.has(6) && !has.has(8));
    let best = null, score = -Infinity;
    for (const sh of shapes) {
      const k = kindOf(sh.notes.map(n => n - 48));
      if (k.base !== want.base || !sh.notes.every(n => ok(((n % 12) + 12) % 12))) continue;
      const s = 2 * want.tens.filter(t => k.tens.includes(t)).length - want.tens.filter(t => !k.tens.includes(t)).length
        + k.tens.length / 100;
      if (s > score) { score = s; best = sh; }
    }
    return best;
  }

  // Compases listos para sonar: en qué tiempo entra cada acorde.
  function resolve(bars, semis) {
    const out = [];
    bars.forEach((b, i) => {
      const beats = b.ts[0];
      let slots = [];
      if (b.items.length === 1 && b.items[0] === '%' && i > 0) slots = out[i - 1].slots;
      else {
        const pos = starts(b);
        b.items.forEach((it, k) => {
          if (it === '_' || it === '%') return;
          if (/^n\.?c\.?$/i.test(it)) { slots.push({ beat: pos[k], chord: null }); return; }
          const c = parseChord(it);
          if (!c) return;
          const root = (c.num + semis + 120) % 12;
          slots.push({
            beat: pos[k],
            cut: c.cut,
            push: c.push,
            semi: c.semi,
            chord: {
              root,
              bass: c.bassNum == null ? root : (c.bassNum + semis + 120) % 12,
              iv: intervals(c.qual),
              // todas sus notas, con las tensiones: para elegir la posición de piano escrita (shapeFor)
              tones: tones(c.qual),
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

  // Un compás en blanco no tiene nada escrito (ni un acorde, ni "%", ni "N.C."). Sirve para acomodar la hoja,
  // por ejemplo para que la casilla 2 quede debajo de la casilla 1, y no se toca. La excepción: los que vienen
  // justo después de un corte sí cuentan, porque son el silencio que deja el corte.
  // De una lista de compases en el orden en que suenan, deja los que de verdad se tocan.
  function audible(bars, seq) {
    let hush = false;
    return seq.filter(k => {
      const written = bars[k].items.filter(it => it !== '_');
      if (!written.length) return hush;
      hush = /!$/.test(written[written.length - 1]);
      return true;
    });
  }

  // Las vueltas en que se toca una casilla ("1.2." vale para la primera y la segunda), ordenadas y sin repetir;
  // undefined si no queda ninguna.
  function endings(list) {
    const ns = [...new Set((list || []).filter(n => n >= 1 && n <= 9))].sort((a, b) => a - b);
    return ns.length ? ns : undefined;
  }

  // Orden real de ejecución, con repeticiones, casillas y saltos (D.C., D.S., Fine, Coda).
  // Después de un D.C. o D.S. no se hacen las repeticiones: se toma la última casilla, se termina en "Fine"
  // y en "Al Coda" se salta al compás marcado "Coda". Los compases en blanco no se tocan (ver audible), pero
  // lo que tengan marcado (repetición, casilla, salto) vale igual.
  function unfold(bars) {
    const seq = [];
    let i = 0, start = 0, pass = 1, checked = -1, jumped = false;
    const later = (from, n) => {
      for (let j = from + 1; j < bars.length && !bars[j].repStart; j++) if (has(bars[j], n)) return j;
      return -1;
    };
    const has = (b, n) => !!b.ending && b.ending.includes(n);
    // La casilla en la que se está: la última marcada desde el comienzo de la repetición hasta acá.
    const inside = to => {
      for (let j = to; j >= start; j--) if (bars[j].ending) return bars[j];
      return null;
    };
    const segno = bars.findIndex(b => markOf(b) === 'segno'), coda = bars.findIndex(b => markOf(b) === 'coda');
    while (i < bars.length && seq.length < 4000) {
      const b = bars[i];
      if (b.repStart && start !== i) { start = i; pass = 1; }
      if (b.ending && jumped) {
        let last = i;
        for (let n = Math.max(...b.ending) + 1, j; (j = later(last, n)) >= 0; n++) last = j;
        if (last !== i) { i = last; continue; }
      } else if (b.ending && checked !== i) {
        if (!has(b, pass)) {
          const j = later(i, pass);
          if (j >= 0) { i = j; continue; }
        } else if (pass > 1 && !has(b, pass + 1) && later(i, pass + 1) < 0) { start = i; pass = 1; checked = i; }
      }
      seq.push(i);
      const mark = markOf(b);
      if (jumped) {
        if (mark === 'fine') break;
        if (mark === 'alcoda' && coda >= 0) { i = coda; continue; }
      } else {
        if (b.repEnd) {
          const box = inside(i), more = (box && has(box, pass + 1)) || later(i, pass + 1) >= 0;
          const total = Math.max(b.times || 2, more ? pass + 1 : 0);
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
    return audible(bars, seq);
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
      if (b.ending) parts.push(b.ending.map(n => n + ".").join(""));
      if (b.items.length < 2) parts.push(b.items[0] || "_");
      else {
        // Compás dividido: se escribe sobre su grilla pareja, entre llaves, con "." donde un acorde sigue sonando.
        const g = grid(b);
        parts.push("{");
        b.items.forEach((it, i) => { parts.push(it); for (let k = 1; k < g.span[i]; k++) parts.push("."); });
        parts.push("}");
      }
      line += (b.repStart ? "|: " : "| ") + parts.join(" ");
      open = !b.repEnd;
      if (b.repEnd) line += " :|" + (b.times > 2 ? " x" + b.times : "");
    }
    if (row !== null) lines.push(line + (open ? " |" : ""));
    return lines.join('\n');
  }

  // Cuánto encaja cada tipo de acorde en cada grado (semitonos desde la tónica) de una tonalidad mayor o menor.
  const FITS = {
    major: { 0: { maj: 1, dom: 0.7 }, 2: { min: 1 }, 4: { min: 1 }, 5: { maj: 1, dom: 0.7 }, 7: { maj: 1, dom: 1 }, 9: { min: 1 }, 11: { dim: 1 } },
    minor: { 0: { min: 1 }, 2: { dim: 1, min: 0.5 }, 3: { maj: 1 }, 5: { min: 1 }, 7: { dom: 1, maj: 0.8, min: 0.8 }, 8: { maj: 1 }, 10: { maj: 1, dom: 0.8 } },
  };
  const KEY_NAMES = {
    major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  };

  // Tonalidad más probable según los acordes escritos, por ejemplo 'Bb' o 'F#m' ('' si hay muy poco material).
  // Suma cuántos acordes son propios de cada tonalidad y premia empezar o terminar en la tónica y las
  // resoluciones de dominante a tónica.
  function guessKey(bars) {
    const chords = [];
    for (const b of bars) for (const it of b.items) { const c = parseChord(it); if (c) chords.push(c); }
    if (chords.length < 3) return '';
    const kinds = chords.map(c => {
      const iv = intervals(c.qual);
      return iv[0] === 3 ? (iv[1] === 6 ? 'dim' : 'min') : iv[2] === 10 ? 'dom' : 'maj';
    });
    let best = null;
    for (const mode of ['major', 'minor']) {
      const home = mode === 'major' ? 'maj' : 'min';
      for (let tonic = 0; tonic < 12; tonic++) {
        const isHome = i => chords[i].num === tonic && kinds[i] === home;
        let score = 0;
        chords.forEach((c, i) => {
          score += (FITS[mode][(c.num - tonic + 12) % 12] || {})[kinds[i]] || 0;
          if (i && isHome(i) && chords[i - 1].num === (tonic + 7) % 12 && kinds[i - 1] !== 'min' && kinds[i - 1] !== 'dim') score += 1;
        });
        if (isHome(0) || (mode === 'major' && chords[0].num === tonic && kinds[0] === 'dom')) score += 1.5;
        if (isHome(chords.length - 1)) score += 2;
        if (!best || score > best.score) best = { score, mode, tonic };
      }
    }
    const written = chords.find(c => c.num === best.tonic);
    const name = written ? written.letter + written.acc.replace('♯', '#').replace('♭', 'b') : KEY_NAMES[best.mode][best.tonic];
    return name + (best.mode === 'minor' ? 'm' : '');
  }

  // --- importar desde iReal Pro ---
  // Un archivo o enlace de iReal trae todo en una dirección "irealb://": las canciones separadas por "===" y, al
  // final, el nombre de la lista. Cada canción son campos separados por "=": título, autor (apellido primero),
  // estilo, tonalidad, el cifrado (mezclado, con una marca adelante), la pista, el tempo y las vueltas.
  const IREAL_MARK = '1r34LbKcu7';
  // El cifrado viene mezclado de a tramos de 50 letras, con algunas cambiadas de punta a punta.
  function irealPlain(s) {
    let out = '';
    while (s.length > 50) {
      const p = s.slice(0, 50).split('');
      s = s.slice(50);
      if (s.length >= 2) for (const [a, b] of [[0, 5], [10, 24]]) for (let i = a; i < b; i++) [p[i], p[49 - i]] = [p[49 - i], p[i]];
      out += p.join('');
    }
    return (out + s).replace(/XyQ/g, '   ').replace(/LZ/g, ' |').replace(/Kcl/g, '| x');
  }
  // "C-7" → "Cm7", "C^7" → "Cmaj7", "Ch7" → "Cm7b5", "Co7" → "Cdim7".
  const irealChord = c => c.replace(/h7?/, 'm7b5').replace(/o/, 'dim').replace(/-\^/, 'mMaj').replace(/-/, 'm')
    .replace(/\^(?!\d)/, 'maj7').replace(/\^/, 'maj').replace(/\+/, 'aug').replace(/sus(?!\d)/, 'sus4').replace(/69/, '6/9');
  const IREAL_CHORD = /^[A-G][b#]?(?:\^|-|\+|o|h|\d+|[#b]\d+|sus|add|alt)*(?:\/[A-G][#b]?)?/;
  // Estilo de Airrial más cercano al de iReal; lo que no se reconoce queda en swing.
  function irealStyle(name) {
    const s = name.toLowerCase();
    for (const [re, id] of [[/bossa/, 'bossa'], [/samba/, 'samba'], [/shuffle|blues/, 'shuffle'], [/funk/, 'funk'], [/reggae/, 'reggae'],
      [/bolero/, 'bolero'], [/tango/, 'tango'], [/milonga/, 'milonga'], [/cumbia/, 'cumbia'], [/wal[tz]+|vals/, 'vals'],
      [/3-2/, 'son32'], [/salsa|son\b|montuno|mambo|cha cha|guaracha/, 'son'], [/ballad/, 'balada'], [/rock|pop|soul|r&b|country|disco/, 'pop']]) {
      if (re.test(s)) return id;
    }
    return 'swing';
  }
  // Cifrado de iReal (ya ordenado) → texto de Airrial. En iReal cada acorde y cada espacio ocupan una casilla del
  // compás: de ahí sale en qué tiempo cae cada acorde.
  function irealChart(src, defTs) {
    const bars = [], codas = (src.match(/Q/g) || []).length;
    // `opener` es la barra que abrió el compás que se está leyendo.
    let ts = defTs.slice(), pend = {}, cells = [], notes = [], seenCoda = 0, twice = 0, opener = '';
    const flush = () => {
      const chords = cells.filter(c => c !== ' ' && c !== '.');
      const blank = !chords.length && !notes.length && !pend.ending && !pend.section;
      if (!cells.length && !notes.length) return;
      // Un tramo sin nada escrito, después de cerrar una repetición o una parte (o más largo que un compás), son
      // compases en blanco que iReal usa para acomodar la hoja (la casilla 2 debajo de la 1). Un compás vacío
      // suelto, entre dos barras comunes, es otra cosa: sigue sonando el acorde anterior, y acá se escribe.
      const last = bars[bars.length - 1], held = last && last.items.filter(it => it !== '_').pop();
      if (blank && held && cells.length <= 4 && opener === '|' && !twice) cells = [held];
      for (let k = blank ? Math.max(1, Math.round(cells.length / 4)) : 1; k > 0; k--) {
        const b = Object.assign({ items: [], lens: [], ts: ts.slice() }, pend);
        pend = {};
        // "r" repite los dos compases anteriores y ocupa dos: cada uno copia al que está dos lugares atrás
        const prev2 = bars[bars.length - 2];
        if ((twice || chords.includes('r')) && prev2) { b.items = prev2.items.slice(); b.lens = prev2.lens.slice(); twice = twice ? 0 : 1; }
        else if (chords.includes('x') || chords.includes('r')) { b.items = ['%']; b.lens = [1]; twice = chords.includes('r') ? 1 : 0; }
        else {
          cells.forEach(c => {
            if (c === ' ' || c === '.') { if (b.items.length) b.lens[b.lens.length - 1]++; else { b.items.push('_'); b.lens.push(1); } }
            else if (c !== 'x' && c !== 'r') { b.items.push(c); b.lens.push(1); }
          });
          if (!b.items.length) { b.items = ['_']; b.lens = [1]; }
          const n = b.lens.reduce((a, l) => a + l, 0);
          b.lens = b.lens.map(l => l / n);
        }
        // de las anotaciones del compás vale primero la que cambia el recorrido (salto, Fine, Coda, Segno)
        const mark = notes.find(t => markOf({ text: t }));
        if (mark || notes.length) b.text = mark || notes.join(' ');
        bars.push(b);
      }
      cells = [];
      notes = [];
    };
    for (let i = 0; i < src.length;) {
      // Se mira de a un tramo corto, y las anotaciones y los paréntesis tienen tope de largo: así un cifrado
      // armado con mala intención (lleno de "<" sin cerrar) se lee de una pasada.
      const rest = src.slice(i, i + 220), ch = src[i];
      let m;
      if ((m = /^<([^<>]{0,200})>/.exec(rest))) {
        const t = m[1].replace(/^\*\d\d/, '').replace(/["\[\]|{}]/g, '').replace(/\s+/g, ' ').trim();
        const jump = /^d\.?\s*([cs])\.?(?:\s*al\s*(fine|coda))?$/i.exec(t);
        if (jump) notes.push('D.' + jump[1].toUpperCase() + '.' + (jump[2] ? ' al ' + jump[2][0].toUpperCase() + jump[2].slice(1).toLowerCase() : ''));
        else if (/^fine$/i.test(t)) notes.push('Fine');
        else if (t) notes.push(t);
      } else if ((m = /^\([^()]{0,60}\)/.exec(rest))) { /* acorde alternativo: Airrial no los tiene */ }
      else if ((m = /^\*([A-Za-z])/.exec(rest))) pend.section = { i: 'Intro', v: 'Verso' }[m[1]] || m[1].toUpperCase();
      else if ((m = /^T(\d)(\d)/.exec(rest))) {
        const now = m[0] === 'T12' ? [12, 8] : [+m[1], +m[2]];
        if (now[0] > 0 && [2, 4, 8].includes(now[1]) && now.join() !== ts.join()) { ts = now; pend.tsSet = true; pend.ts = now; }
      } else if ((m = /^N(\d)/.exec(rest))) { if (+m[1]) pend.ending = [+m[1]]; }
      else if ((m = IREAL_CHORD.exec(rest))) cells.push(irealChord(m[0]));
      else if (ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === '|' || ch === 'Z') {
        flush();
        if (ch === '{') pend.repStart = true;
        if (ch === '}' && bars.length) bars[bars.length - 1].repEnd = true;
        opener = ch === 'Z' ? ']' : ch;
        m = [ch];
      } else {
        if (ch === ' ' || ch === 'x' || ch === 'r') cells.push(ch);
        else if (ch === 'n') cells.push('N.C.');
        else if (ch === 'p' || ch === 'W') cells.push('.');
        else if (ch === 'S') notes.push('Segno');
        else if (ch === 'Q') notes.push(++seenCoda < codas ? 'Al Coda' : 'Coda');
        m = [ch];
      }
      i += m[0].length;
    }
    flush();
    // Los compases en blanco del final no acomodan nada: se quitan.
    const empty = b => b.items.every(it => it === '_') && !(b.section || b.ending || b.text || b.repStart || b.repEnd || b.tsSet);
    while (bars.length && empty(bars[bars.length - 1])) bars.pop();
    // Renglones de a cuatro compases; cada parte empieza en renglón nuevo.
    let row = -1, n = 0;
    for (const b of bars) {
      if (n === 0 || n >= 4 || b.section) { row++; n = 0; }
      b.row = row;
      n++;
    }
    return serialize(bars);
  }
  // Texto de un archivo o enlace de iReal → { name, songs: [{ title, composer, style, key, tempo, ts, chart }] },
  // o null si no es de iReal. `name` es el nombre de la lista ('' si es una canción suelta).
  function fromIreal(text) {
    const m = /irealb:\/\/([^"<>\s]+)/.exec(String(text || ''));
    if (!m) return null;
    const decode = s => { try { return decodeURIComponent(s); } catch { return s; } };
    const parts = decode(m[1].replace(/&amp;/g, '&')).split('===');
    const name = parts.length > 1 ? parts.pop().trim() : '';
    const songs = [];
    for (const p of parts) {
      const f = p.split('='), i = f.findIndex(x => x.startsWith(IREAL_MARK));
      if (i < 4 || !f[0].trim()) continue;
      const src = irealPlain(f[i].slice(IREAL_MARK.length)), first = /T(\d)(\d)/.exec(src);
      const tsn = !first ? [4, 4] : first[0] === 'T12' ? [12, 8] : [+first[1], +first[2]];
      const ts = ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8'].includes(tsn.join('/')) ? tsn : [4, 4];
      const who = f[1].trim(), style = (f[i - 3] || '') + ' ' + (f[i + 1] || ''), slow = style.toLowerCase();
      // iReal guarda "Apellido Nombre"; con más de dos palabras (o guiones y barras) se deja como viene.
      const composer = /^composer unknown$/i.test(who) ? '' : /^[^\s\-\/]+ [^\s\-\/]+$/.test(who) ? who.split(' ').reverse().join(' ') : who;
      const bpm = +f[i + 2] || (/ballad|slow/.test(slow) ? 80 : /medium up/.test(slow) ? 160 : /up tempo|fast/.test(slow) ? 200 : 120);
      songs.push({
        title: f[0].trim(), composer, style: irealStyle(f[i - 3] || f[i + 1] || ''), key: irealChord((f[i - 2] || '').trim()),
        tempo: bpm, ts: ts.join('/'), chart: irealChart(src, ts),
      });
    }
    return songs.length ? { name, songs } : null;
  }

  // --- importar lo que escribió una inteligencia artificial ---
  // La persona le pasa una foto o un PDF a ChatGPT, Claude u otra junto con el pedido que da la app, y pega la
  // respuesta: cada canción empieza con "Título:", sigue con sus datos ("Autor:", "Ritmo:", "Tonalidad:",
  // "Compás:", "Tempo:") y después el cifrado en el formato de Airrial. Lo demás (saludos, explicaciones, las
  // marcas del recuadro) se ignora.
  const TEXT_FIELD = /^(t[ií]tulo|autor|ritmo|estilo|tonalidad|tono|comp[aá]s|tempo)\s*:\s*(.*)$/i;
  const LATIN_ROOT = { Do: 'C', Re: 'D', Mi: 'E', Fa: 'F', Sol: 'G', La: 'A', Si: 'B' };
  // Acorde con nombres latinos ("Lam7", "Sib", "Fa#m/Do#") → letras. Va antes de leerlo: "Do7" o "Fa" también
  // parecen acordes con letras (D y F), pero escritos así nunca lo son.
  const fromLatin = tk => tk.replace(/(^<{0,2}|\/)(Do|Re|Mi|Fa|Sol|La|Si)/g, (m, a, n) => a + LATIN_ROOT[n]);
  // "NC" o "N.C" son N.C.; el resto, con los nombres latinos pasados a letras.
  const textItem = it => (/^n\.?c\.?$/i.test(it) ? 'N.C.' : fromLatin(it));
  // Ritmo de Airrial más cercano al nombre escrito; '' si no se reconoce.
  function textStyle(name) {
    const s = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [re, id] of [[/chacarera/, 'chacarera'], [/zamba/, 'zamba'], [/festejo/, 'festejo'], [/candombe/, 'candombe'],
      [/metronomo|click/, 'click'], [/balada/, 'balada'], [/pop|rock/, 'pop'], [/swing|jazz/, 'swing']]) {
      if (re.test(s)) return id;
    }
    const id = s ? irealStyle(s) : 'swing';
    return id === 'swing' && !/swing/.test(s) ? '' : id;
  }
  // Texto pegado → { songs: [{ title, composer, style, key, tempo, ts, chart }], problems: [{ song, bar, item }] },
  // o null si no trae ningún cifrado. `problems` son los acordes que no se entendieron (compás contado desde 1).
  function fromText(text) {
    const found = [];
    let cur = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/\*\*/g, '').trim(), f = TEXT_FIELD.exec(line);
      if (f) {
        const k = f[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (k === 'titulo' || !cur) found.push(cur = { lines: [] });
        cur[{ titulo: 'title', autor: 'composer', ritmo: 'style', estilo: 'style', tonalidad: 'key', tono: 'key', compas: 'ts', tempo: 'tempo' }[k]] = f[2].trim();
      } else if (line.includes('|') || /^\[[^\]]*\]$/.test(line)) {
        if (!cur) found.push(cur = { lines: [] });
        cur.lines.push(line);
      }
    }
    const songs = [], problems = [];
    for (const s of found) {
      const tsText = /(\d+)\s*\/\s*(\d+)/.exec(s.ts || '') || /(?:^|\s)(\d+)\/(\d+)(?=\s|$)/.exec(s.lines.join(' '));
      const tsn = tsText ? [+tsText[1], +tsText[2]] : [4, 4];
      const ts = ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8'].includes(tsn.join('/')) ? tsn : [4, 4];
      const bars = parseChart(s.lines.join('\n'), ts);
      if (!bars.some(b => b.items.some(it => it !== '_'))) continue;
      const title = (s.title || '').replace(/^["'«]+|["'»]+$/g, '').trim();
      bars.forEach((b, i) => {
        b.items = b.items.map(textItem);
        for (const it of b.items) if (!['_', '%', 'N.C.'].includes(it) && !parseChord(it)) problems.push({ song: title, bar: i + 1, item: it });
      });
      const key = fromLatin((s.key || '').replace(/\s*(mayor|major)$/i, '').replace(/\s*(menor|minor)$/i, 'm').replace(/\s+/g, ''));
      songs.push({
        title, composer: s.composer || '', style: textStyle(s.style), key: parseChord(key) ? key : guessKey(bars),
        tempo: Math.round(parseFloat(s.tempo)) || 0, ts: ts.join('/'), chart: serialize(bars),
      });
    }
    return songs.length ? { songs, problems } : null;
  }

  // --- importar desde Band-in-a-Box ---
  // Sus archivos (.MGU, .SGU) son binarios y el formato no es público: esto sigue lo que se descifró de afuera
  // (el módulo Data::BiaB, de Johan Vromans). Trae título, ritmo, tono, tempo, el nombre del estilo, los acordes
  // en 255 compases de cuatro lugares cada uno, y qué compases son el coro (lo de antes es la introducción y lo
  // de después, el final). La melodía que pueda traer no se toma.
  const BIAB_QUAL = {
    1: '', 2: '', 3: 'b5', 4: 'aug', 5: '6', 6: 'maj7', 7: 'maj9', 8: 'maj9#11', 9: 'maj13#11', 10: 'maj13', 12: 'aug',
    13: 'maj7#5', 14: '6/9', 15: 'add9', 16: 'm', 17: 'm#5', 18: 'mMaj7', 19: 'm7', 20: 'm9', 21: 'm11', 22: 'm13', 23: 'm6',
    24: 'm#5', 25: 'm7#5', 26: 'm6/9', 32: 'm7b5', 33: 'dim', 34: 'm9b5', 40: '5', 56: '7#5', 57: 'aug', 58: '13#5', 64: '7',
    65: '13', 66: '7b13', 67: '7#11', 70: '9', 73: '9#11', 74: '13#11', 76: '7b9', 77: '13b9', 79: '7b9#11', 82: '7#9', 83: '13#9',
    84: '7#9b13', 85: '9#11', 88: '7b5', 89: '13b5', 91: '9b5', 93: '7b5b9', 96: '7b5#9', 99: '7#5', 103: '9#5', 105: '7#5b9',
    109: '7#5#9', 113: '7alt', 128: '7sus4', 129: '13sus4', 134: '11', 140: '7sus4b9', 146: '7sus4#9', 163: '7sus4#5',
    177: 'sus4', 184: 'sus4',
  };
  // Un tipo que no está en la tabla se toma por su familia: mayores, menores, dominantes y suspendidos.
  const biabQual = t => (t in BIAB_QUAL ? BIAB_QUAL[t] : t < 16 ? '' : t < 32 ? 'm' : t < 40 ? 'm7b5' : t < 128 ? '7' : '7sus4');
  const BIAB_ROOT = ['', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C#', 'D#', 'F#', 'G#', 'A#'];
  // Bajo distinto de la fundamental: viene sumado de a 18 y se cuenta desde Si.
  const BIAB_BASS = { b: ['B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb'], '#': ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#'] };
  function biabChord(n, t) {
    const root = BIAB_ROOT[n % 18];
    if (!root) return null;
    const bass = n >= 18 ? '/' + BIAB_BASS[root.includes('b') ? 'b' : '#'][(Math.floor(n / 18) + n % 18) % 12] : '';
    return root + biabQual(t) + bass;
  }
  // Estilo de Airrial según el nombre del estilo de Band-in-a-Box (o su número de ritmo básico).
  function biabStyle(file, basic) {
    const s = file.toLowerCase();
    if (/wal/.test(s) || basic === 8 || basic === 17) return 'vals';
    if (/bos/.test(s) || basic === 4) return 'bossa';
    if (/tang/.test(s)) return 'tango';
    if (/samb/.test(s)) return 'samba';
    if (/reg/.test(s)) return 'reggae';
    if (/funk/.test(s)) return 'funk';
    if (/bolero/.test(s)) return 'bolero';
    if (/salsa|mamb|cha|son/.test(s)) return 'son';
    if (/shuf|blu/.test(s)) return 'shuffle';
    if (/rock|pop/.test(s)) return 'pop';
    return 'swing';
  }
  // Bytes de un archivo de Band-in-a-Box → { name: '', songs: [una canción] }, o null si no se puede leer.
  function fromBiab(bytes) {
    const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let i = 0;
    const gb = () => { if (i >= d.length) throw new Error('corto'); return d[i++]; };
    // Lista comprimida: un valor distinto de cero ocupa un lugar; un cero seguido de n saltea n lugares.
    const runs = size => {
      const out = [];
      for (let k = 0; k < size;) {
        const v = gb();
        if (v) out[k++] = v;
        else { const n = gb(); if (!n) throw new Error('formato'); k += n; }
      }
      return out;
    };
    try {
      i = 1;
      const len = gb();
      let title = '';
      for (let k = 0; k < len; k++) title += String.fromCharCode(gb());
      i += 2;
      const basic = gb(), key = gb(), bpm = gb();
      runs(256);                            // estilo de cada compás (a o b): Airrial no lo usa
      const types = runs(1020), roots = runs(1021);
      const start = gb(), end = gb();
      // El nombre del archivo de estilo ("TANGO.STY") viene un poco más adelante.
      const after = String.fromCharCode(...d.subarray(i, i + 3000));
      const sty = (/([A-Z0-9_~\-]{1,8})\.STY/i.exec(after) || [])[1] || '';
      const style = biabStyle(sty, basic), beats = style === 'vals' ? 3 : 4;
      const last = Math.min(end || 0, 255);
      if (!title.trim() || !(start >= 1) || last < start) return null;
      const bars = [];
      let held = null;
      for (let b = 0; b < last; b++) {
        const cells = [];
        for (let s = 0; s < 4; s++) {
          const c = roots[b * 4 + s] ? biabChord(roots[b * 4 + s], types[b * 4 + s] || 1) : null;
          // en 3/4 el cuarto lugar no se usa; si trae algo, va al tercer tiempo
          if (s < beats) cells.push(c); else if (c) cells[beats - 1] = c;
        }
        // un compás sin acordes sigue con el último que sonó; uno que empieza vacío, también hasta su primer acorde
        if (!cells.some(Boolean)) { if (held) cells[0] = held; else cells[0] = 'N.C.'; }
        // (el mismo acorde repetido en el compás se escribe una vez)
        const items = [], lens = [];
        cells.forEach(c => {
          if (c && c !== items[items.length - 1]) { items.push(c); lens.push(1); held = c; } else if (items.length) lens[lens.length - 1]++; else { items.push('_'); lens.push(1); }
        });
        const bar = { items, lens: lens.map(l => l / beats), ts: [beats, 4] };
        if (b === 0 && start > 1) bar.section = 'Intro';
        if (b === start - 1 && start > 1) bar.section = 'A';
        bars.push(bar);
      }
      if (!bars.some(b => b.items.some(it => it !== '_' && it !== 'N.C.'))) return null;
      let row = -1, n = 0;
      for (const b of bars) {
        if (n === 0 || n >= 4 || b.section) { row++; n = 0; }
        b.row = row;
        n++;
      }
      // "Título - Autor" es la forma habitual de nombrar los temas en Band-in-a-Box.
      const parts = title.trim().split(' - ');
      const chart = serialize(bars);
      // El tono viene siempre como mayor: si los acordes dicen que es su relativo menor, se toma el menor.
      const written = BIAB_ROOT[key] || '', guess = guessKey(parseChart(chart, [beats, 4]));
      const g = parseChord(guess), w = parseChord(written);
      const tone = g && w && /m$/.test(guess) && (g.num + 3) % 12 === w.num ? guess : written || guess;
      return {
        name: '', songs: [{
          title: parts.length === 2 ? parts[0].trim() : title.trim(), composer: parts.length === 2 ? parts[1].trim() : '',
          style, key: tone, tempo: Math.min(360, Math.max(30, bpm || 120)),
          ts: beats + '/4', chart,
        }],
      };
    } catch {
      return null;
    }
  }

  return { fromBiab, fromIreal, fromText, tones, kindOf, shapeFor, endings, starts, grid, natural, split, join, guessKey, setView, markOf, normalize, serialize, parseChord, spell, transposeName, useFlats, firstChord, positions, parseChart, intervals, resolve, unfold, audible };
})();

if (typeof module !== 'undefined') module.exports = Music;
