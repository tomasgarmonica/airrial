// Importar desde iReal Pro: arma un enlace como los de iReal (con el cifrado mezclado igual que lo mezcla iReal)
// y verifica que se convierta bien. Las canciones de la prueba son inventadas.
const M = require(process.argv[2]), assert = require('assert'), fs = require('fs'), path = require('path');

// La mezcla de iReal se deshace repitiéndola: sirve para ir y para volver.
const scramble = s => {
  let out = '';
  while (s.length > 50) {
    const p = s.slice(0, 50).split('');
    s = s.slice(50);
    if (s.length >= 2) for (const [a, b] of [[0, 5], [10, 24]]) for (let i = a; i < b; i++) [p[i], p[49 - i]] = [p[49 - i], p[i]];
    out += p.join('');
  }
  return out + s;
};
const song = (title, composer, style, key, chart, bpm) =>
  [title, composer, '', style, key, '', '1r34LbKcu7' + scramble(chart.replace(/ \|/g, 'LZ').replace(/   /g, 'XyQ')), 'Jazz-' + style, bpm, 3].join('=');
const link = (songs, name) => 'irealb://' + encodeURIComponent(songs.join('===') + (name == null ? '' : '===' + name));
const page = (songs, name) => `<html><body><a href="${link(songs, name)}">${name}</a></body></html>`;

// Una canción con casi todo: partes, compás, repetición con casillas (y los compases en blanco que acomodan la
// casilla 2), acordes en distintos tiempos, repetir compás, silencio, anotaciones, saltos y acordes alternativos.
const full = '*A{T44C^7   | x  |D-7 G7 |Eh7(Bb7) A7b9 |C6   |F7   |N1C6 A-7 |D-7 G7 }        |N2C6   |n   ]' +
  '*B[SF-7,Bb7,Eb^7,Ab^7,|Do7   |<Break>G7sus  Q |sC6,F7,lG7 |<D.S. al coda>Ab7   ][QC69   |C6/G   Z ';
const got = M.fromIreal(page([song('Tema Uno', 'Pérez Juan', 'Medium Swing', 'C', full, 132), song('Otro', 'Composer Unknown', 'Bossa Nova', 'D-', '[T34D-   |G-7   |A7   Z', 0)], 'Mi lista'));
assert.equal(got.name, 'Mi lista');
assert.equal(got.songs.length, 2);
const [a, b] = got.songs;
assert.deepEqual([a.title, a.composer, a.style, a.key, a.tempo, a.ts], ['Tema Uno', 'Juan Pérez', 'swing', 'C', 132, '4/4']);
assert.equal(a.chart, [
  '|: [A] Cmaj7 | % | { Dm7 G7 } | { Em7b5 A7b9 } |',
  '| C6 | F7 | 1. { C6 Am7 } | { Dm7 G7 } :|',
  '| _ | _ | 2. C6 | N.C. |',
  '| [B] "Segno" { Fm7 Bb7 Ebmaj7 Abmaj7 } | Ddim7 | "Al Coda" G7sus4 | { C6 F7 G7 . } |',
  '| "D.S. al Coda" Ab7 | "Coda" C6/9 | C6/G |',
].join('\n'));
// lo convertido es un cifrado normal de Airrial: se lee, se vuelve a escribir igual y el recorrido sigue los saltos
const bars = M.parseChart(a.chart, [4, 4]);
assert.equal(M.serialize(bars), a.chart);
assert.ok(bars.every(x => x.items.every(it => ['_', '%', 'N.C.'].includes(it) || M.parseChord(it))));
assert.equal(M.unfold(bars).join(' '), '0 1 2 3 4 5 6 7 0 1 2 3 4 5 10 11 12 13 14 15 16 12 13 14 17 18');
// compás, estilo y tonalidad menor; sin tempo, sale del estilo; sin autor conocido, queda vacío
assert.deepEqual([b.composer, b.style, b.key, b.tempo, b.ts, b.chart], ['', 'bossa', 'Dm', 120, '3/4', '| Dm | Gm7 | A7 |']);
// una canción suelta no trae nombre de lista
const one = M.fromIreal(link([song('Sola', 'Uno', 'Slow Swing', 'F', '[F7   |Bb7   Z', 0)]));
assert.deepEqual([one.name, one.songs.length, one.songs[0].tempo, one.songs[0].chart], ['', 1, 80, '| F7 | Bb7 |']);
// un compás vacío entre dos barras sostiene el acorde anterior; "r" repite los dos compases anteriores
const held = M.fromIreal(link([song('X', 'Y', 'Swing', 'C', '[C   |G7 F7 |    |   r|   |A-   Z', 0)])).songs[0].chart;
assert.equal(held, '| C | { G7 F7 } | F7 | { G7 F7 } |\n| F7 | Am |');
// lo que no es de iReal, o viene roto, no se toma
for (const bad of ['', 'hola', '{"songs":[]}', 'irealb://', 'irealb://a=b=c', 'irealb://%E0%A4%A']) assert.equal(M.fromIreal(bad), null);
// y un cifrado armado para trabar la lectura se convierte al instante
const t0 = Date.now();
M.fromIreal(link([song('Z', 'Z', 'Swing', 'C', '<'.repeat(20000) + '('.repeat(20000) + '*'.repeat(20000), 0)]));
assert.ok(Date.now() - t0 < 3000, 'la conversión tarda demasiado');

// Si en esta PC hay un archivo verdadero de iReal en pruebas/ (no se sube), se convierte entero como control.
const dir = path.join(path.dirname(process.argv[2]), 'pruebas');
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /\.html?$/i.test(x)) : []) {
  const real = M.fromIreal(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!real) continue;
  for (const s of real.songs) {
    const bs = M.parseChart(s.chart, s.ts.split('/').map(Number));
    assert.ok(bs.length > 3, f + ': ' + s.title + ' quedó casi vacío');
    assert.equal(M.serialize(bs), s.chart, f + ': ' + s.title);
    assert.ok(bs.every(x => x.items.every(it => ['_', '%', 'N.C.'].includes(it) || M.parseChord(it))), f + ': ' + s.title + ' tiene algo que no es un acorde');
    assert.ok(M.unfold(bs).length > 3);
  }
  console.log('archivo de iReal de control:', f, '·', real.songs.length, 'temas');
}
console.log('ireal: ok');
