// Posiciones de piano: qué notas lleva cada acorde escrito, de qué tipo es, y qué posición le toca de las
// escritas en MIDI (posiciones.js). Las posiciones de la prueba son inventadas, salvo la última parte.
const M = require(process.argv[2]), assert = require('assert'), path = require('path');

// notas de un acorde escrito, desde la fundamental
assert.deepEqual(M.tones(''), [0, 4, 7]);
assert.deepEqual(M.tones('m6'), [0, 3, 7, 9]);
assert.deepEqual(M.tones('7(b9)'), [0, 1, 4, 7, 10]);
assert.deepEqual(M.tones('13'), [0, 2, 4, 7, 9, 10]);
assert.deepEqual(M.tones('maj7#11'), [0, 4, 6, 7, 11]);
assert.deepEqual(M.tones('7alt'), [0, 1, 3, 4, 7, 8, 10]);
assert.deepEqual(M.tones('11'), [0, 2, 5, 7, 10]);          // C11 es un C9sus4
assert.deepEqual(M.tones('m7b5'), [0, 3, 6, 10]);
assert.deepEqual(M.tones('dim7'), [0, 3, 6, 9]);
assert.deepEqual(M.tones('6/9'), [0, 2, 4, 7, 9]);

// tipo de acorde, igual para un acorde escrito que para notas tocadas
const kind = q => M.kindOf(M.tones(q));
assert.deepEqual(kind(''), { base: 'maj', tens: [] });
assert.deepEqual(kind('7b9b13'), { base: 'dom', tens: ['b9', 'b13'] });
assert.deepEqual(kind('m9'), { base: 'm7', tens: ['9'] });
assert.deepEqual(kind('dim'), { base: 'dim7', tens: [] });
assert.deepEqual(kind('aug'), { base: '', tens: [] });
// una posición de C7 con Eb es un #9 aunque se llame b9
assert.deepEqual(M.kindOf([52, 58, 63, 68].map(n => n - 48)), { base: 'dom', tens: ['#9', 'b13'] });

// qué posición le toca a cada acorde
const shapes = [
  { name: 'C13', notes: [52, 58, 62, 69] },
  { name: 'C7(b9)', notes: [52, 58, 61, 67] },
  { name: 'C7(#9b13)', notes: [52, 58, 63, 68] },
  { name: 'C6', notes: [64, 67, 69, 74] },
  { name: 'Cm7', notes: [55, 58, 62, 63] },
];
const pick = q => (M.shapeFor(M.tones(q), shapes) || { name: null }).name;
assert.equal(pick('7'), 'C13');            // un 7 común lleva 9 y 13, nunca una alterada
assert.equal(pick('7b9'), 'C7(b9)');
assert.equal(pick('7b9b13'), 'C7(b9)');    // la del #9 contradice la b9 pedida
assert.equal(pick('7alt'), 'C7(#9b13)');   // la que trae más de lo pedido
assert.equal(pick('13b9'), 'C7(b9)');      // la 13 con 9 no sirve: choca con la b9
assert.equal(pick(''), 'C6');              // la tríada va con sexta y novena
assert.equal(pick('m9'), 'Cm7');
assert.equal(pick('7#5'), null);           // la quinta justa (y la 13) chocan con el #5: queda la de antes
assert.equal(pick('maj7'), null);          // no hay ninguna de ese tipo

// las posiciones de verdad: todas de un tipo que la app reconoce, escritas sobre Do
const real = require(path.join(path.dirname(process.argv[2]), 'posiciones.js'));
assert.ok(real.length);
for (const s of real) {
  assert.ok(M.kindOf(s.notes.map(n => n - 48)).base, s.name + ': tipo de acorde desconocido');
  assert.ok(s.notes.every((n, i) => Number.isInteger(n) && (!i || n > s.notes[i - 1])), s.name + ': notas desordenadas');
}

console.log('Posiciones de piano: bien.');
