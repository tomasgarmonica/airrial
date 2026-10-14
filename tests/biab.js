// Importar desde Band-in-a-Box: archivos armados a mano con su formato (los de verdad no se suben al repositorio).
const M = require(process.argv[2]), assert = require('assert'), fs = require('fs'), path = require('path');

// Lista comprimida del formato: cada valor ocupa un lugar; un cero seguido de n saltea n lugares.
const runs = (size, at) => {
  const out = [];
  let gap = 0;
  const skip = () => { while (gap > 0) { const n = Math.min(gap, 255); out.push(0, n); gap -= n; } };
  for (let k = 0; k < size; k++) {
    if (at[k]) { skip(); out.push(at[k]); } else gap++;
  }
  skip();
  return out;
};
// chords: { lugar: [fundamental, tipo] } (cuatro lugares por compás)
const file = ({ title = 'Tema - Autor', basic = 1, key = 1, bpm = 120, chords, start = 1, end, sty = 'ZZJAZZ.STY' }) => {
  const roots = {}, types = {};
  for (const [k, [r, t]] of Object.entries(chords)) { roots[k] = r; types[k] = t; }
  return Uint8Array.from([0x49, title.length, ...Buffer.from(title, 'latin1'), 0, 0x20, basic, key, bpm,
    ...runs(256, { 0: 1 }), ...runs(1020, types), ...runs(1021, roots), start, end, 2,
    ...Buffer.from('basura\x42' + String.fromCharCode(sty.length) + sty + '\0\xff\0', 'latin1')]);
};

// Do mayor siete; Rem7 y Sol7 por mitades; un compás vacío sigue con Sol7; La menor con Sol# en el bajo
const one = M.fromBiab(file({ chords: { 0: [1, 6], 4: [3, 19], 6: [8, 64], 12: [10 + 18 * 11, 16], 16: [1, 6] }, end: 5 }));
assert.equal(one.songs.length, 1);
const s = one.songs[0];
assert.deepEqual([s.title, s.composer, s.style, s.key, s.tempo, s.ts], ['Tema', 'Autor', 'swing', 'C', 120, '4/4']);
assert.equal(s.chart, '| Cmaj7 | { Dm7 G7 } | G7 | Am/G# |\n| Cmaj7 |');
// lo convertido se lee entero en Airrial y suena
const bars = M.parseChart(s.chart, [4, 4]);
assert.ok(bars.every(b => b.items.every(it => M.parseChord(it))));
assert.equal(M.unfold(bars).length, 5);

// con introducción: el coro empieza en el compás 3; lo que viene después del coro (el final) no se toma
const intro = M.fromBiab(file({ chords: { 0: [1, 1], 4: [8, 64], 8: [1, 6], 12: [6, 6], 16: [1, 14] }, start: 3, end: 4 })).songs[0];
assert.equal(intro.chart, '| [Intro] C | G7 |\n| [A] Cmaj7 | Fmaj7 |');
// un estilo de vals va en 3/4 (un acorde en el cuarto lugar pasa al tercero), y una bossa es bossa
const waltz = M.fromBiab(file({ chords: { 0: [6, 19], 4: [8, 19], 7: [1, 1] }, end: 2, sty: 'J_WALTZ2.STY' })).songs[0];
assert.deepEqual([waltz.style, waltz.ts, waltz.chart], ['vals', '3/4', '| Fm7 | { Gm7 . C } |']);
assert.equal(M.fromBiab(file({ chords: { 0: [1, 1] }, end: 1, basic: 4, sty: 'XXX.STY' })).songs[0].style, 'bossa');
// el tono viene como mayor; si los acordes dicen que es el relativo menor, se toma el menor
assert.equal(M.fromBiab(file({ key: 4, chords: { 0: [1, 19], 4: [6, 19], 8: [8, 64], 12: [1, 19] }, end: 4 })).songs[0].key, 'Cm');
// un tipo de acorde desconocido se toma por su familia
assert.equal(M.fromBiab(file({ chords: { 0: [1, 30], 4: [1, 120] }, end: 2 })).songs[0].chart, '| Cm | C7 |');

// lo que no es de Band-in-a-Box, o viene cortado o roto, no se toma (y no traba nada)
for (const bad of [new Uint8Array(0), Buffer.from('hola, esto es texto'), file({ chords: { 0: [1, 1] }, end: 1 }).slice(0, 24),
  file({ chords: {}, end: 4 }), file({ title: '', chords: { 0: [1, 1] }, end: 1 }), new Uint8Array(5000).fill(0)]) {
  assert.equal(M.fromBiab(bad), null);
}
const t0 = Date.now();
for (let k = 0; k < 200; k++) M.fromBiab(Uint8Array.from({ length: 4000 }, () => Math.random() * 256 | 0));
assert.ok(Date.now() - t0 < 3000, 'leer basura tarda demasiado');

// Si en esta PC hay archivos verdaderos de Band-in-a-Box en pruebas/ (no se suben), se convierten como control.
const dir = path.join(path.dirname(process.argv[2]), 'pruebas');
const real = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /\.(mgu|sgu)$/i.test(x)) : [];
for (const f of real) {
  const got = M.fromBiab(fs.readFileSync(path.join(dir, f)));
  assert.ok(got, f + ': no se pudo leer');
  const song = got.songs[0], bs = M.parseChart(song.chart, song.ts.split('/').map(Number));
  assert.equal(M.serialize(bs), song.chart, f);
  assert.ok(bs.every(b => b.items.every(it => ['_', 'N.C.'].includes(it) || M.parseChord(it))), f + ': tiene algo que no es un acorde');
  assert.ok(M.unfold(bs).length > 3, f + ': no suena');
}
if (real.length) console.log('archivos de Band-in-a-Box de control:', real.length);
console.log('band-in-a-box: ok');
