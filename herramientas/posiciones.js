// Pasa a la app las posiciones de piano (voicings) escritas en MIDI.
// Uso:  node herramientas/posiciones.js "G:/Mi unidad/Audios/Midi/Piano"
//
// En esa carpeta va un archivo por acorde, escrito sobre Do y con el nombre del acorde ("C7(b9).mid",
// "Cm7.mid", "Cmaj7(#11).mid"). Se toman las notas que suenan juntas (el primer acorde del archivo), de abajo hacia
// arriba. La app las usa en Swing, Bossa y Balada, pasadas a cada tonalidad; el tipo de acorde de cada posición
// sale de sus notas, no del nombre: si el nombre dice otra cosa, se avisa. Sale posiciones.js, que no se edita a mano.
const fs = require('fs'), path = require('path');
const Music = require('../music.js');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('Falta la carpeta con las posiciones.'); process.exit(1); }
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = n => NAMES[n % 12] + (Math.floor(n / 12) - 1);
const kindText = k => k.base + (k.tens.length ? ' (' + k.tens.join(', ') + ')' : '');

// Notas de un MIDI: [momento en negras, nota].
function readMidi(file) {
  const b = fs.readFileSync(file), ppq = b.readUInt16BE(12), notes = [];
  let p = 14;
  while (p < b.length) {
    let q = p + 8, t = 0, run = 0;
    const end = q + b.readUInt32BE(p + 4);
    p = end;
    const vlq = () => { let v = 0, c; do { c = b[q++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (q < end) {
      t += vlq();
      let st = b[q];
      if (st & 128) q++; else st = run;
      // (el largo se lee antes de sumarlo: `q += vlq()` tomaría q antes de que vlq lo corra)
      if (st === 0xff) { q++; const len = vlq(); q += len; continue; }
      if (st === 0xf0 || st === 0xf7) { const len = vlq(); q += len; continue; }
      run = st;
      const kind = st & 0xf0;
      if (kind === 0x90 || kind === 0x80) { const n = b[q++], v = b[q++]; if (kind === 0x90 && v) notes.push([t / ppq, n]); }
      else q += kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    }
  }
  return notes;
}

const shapes = [];
let warned = 0;
for (const file of fs.readdirSync(SRC).filter(f => /\.mid$/i.test(f)).sort()) {
  const name = file.replace(/\.mid$/i, ''), chord = Music.parseChord(name);
  if (!chord || chord.num !== 0 || chord.bassLetter) { console.log(`${file}: el nombre tiene que ser un acorde sobre C (como "C7(b9)"): NO SE PASA`); warned++; continue; }
  const all = readMidi(path.join(SRC, file));
  if (!all.length) { console.log(`${file}: no tiene notas: NO SE PASA`); warned++; continue; }
  // las notas del primer acorde: las que entran dentro de una corchea desde la primera (tocadas a mano no caen juntas)
  const t0 = Math.min(...all.map(n => n[0]));
  const notes = [...new Set(all.filter(n => n[0] - t0 < 0.5).map(n => n[1]))].sort((a, c) => a - c);
  const said = Music.kindOf(Music.tones(chord.qual)), got = Music.kindOf(notes.map(n => n - 48));
  const line = `${name.padEnd(14)} ${notes.map(noteName).join(' ').padEnd(24)} ${kindText(got)}`;
  if (!got.base) { console.log(line + '  ← no es un tipo de acorde que la app reconozca: NO SE PASA'); warned++; continue; }
  // Que agregue una 9 o una 13 que el nombre no dice está bien (es lo común); que le falte una tensión del nombre,
  // o que traiga una alterada que el nombre no pide, no.
  const off = said.base !== got.base || said.tens.some(t => !got.tens.includes(t)) || got.tens.some(t => /[b#]/.test(t) && !said.tens.includes(t));
  if (off) { console.log(line + `  ← el nombre dice ${kindText(said)}`); warned++; }
  else console.log(line);
  shapes.push({ name, notes });
}
fs.writeFileSync(path.join(__dirname, '..', 'posiciones.js'),
  '// Posiciones de piano (voicings) para Swing, Bossa y Balada, escritas sobre Do. Lo genera\n' +
  '// herramientas/posiciones.js a partir de los MIDI: no editar a mano. Cada una: nombre y notas MIDI.\n' +
  'const POSICIONES = [\n' + shapes.map(s => '  ' + JSON.stringify(s) + ',\n').join('') + '];\n' +
  "if (typeof module !== 'undefined') module.exports = POSICIONES;\n");
console.log(`\n${shapes.length} posiciones${warned ? `, ${warned} con aviso` : ''}.`);
