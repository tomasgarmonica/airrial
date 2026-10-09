// Sugerencia de tonalidad a partir de los acordes escritos.
const M = require(process.argv[2]), assert = require('assert');
const key = t => M.guessKey(M.parseChart(t, [4, 4]));

assert.equal(key('| C | Am | F | G |'), 'C');
assert.equal(key('| Am | Dm | E7 | Am |'), 'Am');
assert.equal(key('| Dm7 | G7 | Cmaj7 | % |'), 'C');
assert.equal(key('| G | D | Em | C |'), 'G');
assert.equal(key('| Em7b5 | A7 | Dm | % |'), 'Dm');
// blues: los tres acordes son de séptima
assert.equal(key('| F7 | Bb7 | F7 | % |\n| Bb7 | % | F7 | % |\n| C7 | Bb7 | F7 | C7 |'), 'F');
// respeta cómo está escrita la tónica
assert.equal(key('| Bbmaj7 | Gm7 | Cm7 | F7 |'), 'Bb');
assert.equal(key('| F#m | Bm | C#7 | F#m |'), 'F#m');
// menor con el relativo mayor adentro
assert.equal(key('| Am | G | F | E7 |\n| Am | C | Dm | E7 |'), 'Am');
// muy poco material: no sugiere nada
assert.equal(key('| C |'), '');
assert.equal(key('| N.C. | % |'), '');
assert.equal(key(''), '');
console.log('tonalidad sugerida: ok');
