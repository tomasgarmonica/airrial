// Pasa a la app las bases de percusión escritas en MIDI.
// Uso:  node herramientas/bases.js "G:/Mi unidad/Audios/Midi"
//
// En esa carpeta va un archivo "Base <ritmo>.mid" por ritmo y un "Notas bases.txt" que dice qué sonido es cada
// nota, con un bloque por base:
//     Base Candombe:
//     C3: piano palma y palo
//     F#3: chico palo
// El nombre del sonido es el de la grabación (el mismo que figura en herramientas/sonidos.js, con espacios).
// La intensidad de cada nota (velocity) es la fuerza del golpe. Sale bases.js, que no se edita a mano.
const fs = require('fs'), path = require('path');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'Notas bases.txt'))) { console.error('Falta la carpeta con las bases y "Notas bases.txt".'); process.exit(1); }
const root = path.join(__dirname, '..');
const known = new Set();
for (const g of Object.values(JSON.parse(fs.readFileSync(path.join(root, 'sonidos', 'indice.json'), 'utf8')))) Object.keys(g.sonidos).forEach(k => known.add(k));

const plain = s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
// "F#3" -> 54 (Do3 = 48, como lo muestra Reaper)
function midiOf(name) {
  const m = name.trim().toLowerCase().match(/^([a-g])([#b]?)(-?\d)$/);
  if (!m) throw new Error('No entiendo la nota "' + name + '"');
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (+m[3] + 1);
}

// Notas bases.txt -> { candombe: { 48: 'piano_palma_y_palo', ... } }
const maps = {};
let cur = null;
for (const line of fs.readFileSync(path.join(SRC, 'Notas bases.txt'), 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  const head = line.match(/^\s*base\s+(.+?)\s*:\s*$/i);
  if (head) { cur = maps[plain(head[1])] = {}; continue; }
  const [note, ...rest] = line.split(':');
  if (!cur || !rest.length) throw new Error('No entiendo este renglón de Notas bases.txt: ' + line);
  const sound = plain(rest.join(':')).replace(/\s+/g, '_');
  if (!known.has(sound)) throw new Error(`"${rest.join(':').trim()}" no es un sonido de la app (falta sumarlo en herramientas/sonidos.js)`);
  cur[midiOf(note)] = sound;
}

// Notas de un archivo MIDI: [momento en negras, nota, intensidad], más el compás y el largo.
function readMidi(file) {
  const b = fs.readFileSync(file), ppq = b.readUInt16BE(12), notes = [];
  let p = 14, sig = [4, 4];
  while (p < b.length) {
    let q = p + 8, t = 0, run = 0;
    const end = q + b.readUInt32BE(p + 4);
    p = end;
    const vlq = () => { let v = 0, c; do { c = b[q++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (q < end) {
      t += vlq();
      let st = b[q];
      if (st & 128) q++; else st = run;
      if (st === 0xff) { const type = b[q++], len = vlq(); if (type === 0x58) sig = [b[q], 1 << b[q + 1]]; q += len; continue; }
      if (st === 0xf0 || st === 0xf7) { q += vlq(); continue; }
      run = st;
      const kind = st & 0xf0;
      if (kind === 0x90 || kind === 0x80) { const n = b[q++], v = b[q++]; if (kind === 0x90 && v) notes.push([t / ppq, n, v]); }
      else q += kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    }
  }
  return { notes, sig };
}

// Ajustes de volumen pedidos de oído por el dueño: se multiplican por la intensidad que trae el MIDI.
// Candombe: todo parejo (la madera venía más fuerte que el piano) y el chico bastante más abajo.
const AJUSTE = {
  candombe: { chico_mano: 0.35, chico_palo: 0.35, repique_madera: 0.76 },
};

const bases = {};
for (const file of fs.readdirSync(SRC).filter(f => /^base .+\.mid$/i.test(f)).sort()) {
  const style = plain(file.replace(/^base /i, '').replace(/\.mid$/i, '')), map = maps[style];
  if (!map) { console.log(`${file}: sin bloque en Notas bases.txt, no se pasa`); continue; }
  const { notes, sig } = readMidi(path.join(SRC, file));
  // tiempos del compás, en la figura que marca el compás (negras en 4/4, corcheas en 6/8)
  const beats = sig[0], per = 4 / sig[1];
  const hits = notes.map(([t, n, v]) => {
    if (!map[n]) throw new Error(`${file}: hay una nota (${n}) que no figura en Notas bases.txt`);
    return [+(t / per).toFixed(4), map[n], +(v / 127 * ((AJUSTE[style] || {})[map[n]] || 1)).toFixed(2)];
  }).sort((a, c) => a[0] - c[0]);
  const bars = Math.max(1, Math.ceil((hits[hits.length - 1][0] + 1e-3) / beats));
  bases[style] = { tiempos: beats, compases: bars, golpes: hits };
  console.log(`${style}: ${sig.join('/')}, ${bars} ${bars > 1 ? 'compases' : 'compás'}, ${hits.length} golpes`);
}
fs.writeFileSync(path.join(root, 'bases.js'),
  '// Bases de percusión de cada ritmo. Lo genera herramientas/bases.js a partir de los MIDI: no editar a mano.\n' +
  '// Cada golpe: [tiempo dentro de la base, sonido grabado, fuerza de 0 a 1].\n' +
  'const BASES = ' + JSON.stringify(bases).replace(/("[a-z0-9_]+":\{)/g, '\n  $1').replace(/\}\}$/, '},\n}') + ';\n');
