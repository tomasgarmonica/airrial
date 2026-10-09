// Tiempos dentro del compás: dividir, unir, y cómo se leen y se guardan.
const M = require(process.argv[2]), assert = require('assert');
const bar = (t, ts = [4, 4]) => M.parseChart(t, ts)[0];
const near = (a, b) => assert.ok(a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6), `${a} != ${b}`);
const beats = b => M.starts(b);

// --- lo escrito antes de esta versión se sigue leyendo igual ---
near(beats(bar('| C |')), [0]);
near(beats(bar('| C G |')), [0, 2]);
near(beats(bar('| C D E |')), [0, 1, 2]);                 // regla vieja: sobre los tiempos
assert.deepEqual(bar('| C . . G |').items, ['C', 'G']);   // el "." alarga al anterior
near(beats(bar('| C . . G |')), [0, 3]);
near(beats(bar('| Am Dm |', [3, 4])), [0, 1]);
near(beats(bar('| C _ G |')), [0, 1, 2]);                 // el caso del usuario: "+ acorde" dos veces
assert.deepEqual(bar('| C _ G |').items, ['C', '_', 'G']);

// --- dividir en 4/4: mitades, tiempos, corcheas, semicorcheas ---
let b = bar('| C |');
assert.ok(M.split(b, 0)); assert.deepEqual(b.items, ['C', '_']); near(beats(b), [0, 2]);
assert.ok(M.split(b, 1)); near(beats(b), [0, 2, 3]);
assert.ok(M.split(b, 2)); near(beats(b), [0, 2, 3, 3.5]);            // el "y" del 4
b.items[3] = 'G';
assert.ok(M.split(b, 3)); near(beats(b), [0, 2, 3, 3.5, 3.75]);      // semicorchea
assert.equal(M.split(b, 4), false);                                   // no más chico que una semicorchea
assert.deepEqual(b.items, ['C', '_', '_', 'G', '_']);

// --- se guarda entre llaves y se vuelve a leer igual ---
const text = M.serialize([Object.assign(b, { row: 0 })]);
assert.equal(text, '| { C . . . . . . . _ . . . _ . G _ } |');
const again = bar(text);
assert.deepEqual(again.items, b.items); near(again.lens, b.lens);
assert.equal(M.serialize([Object.assign(again, { row: 0 })]), text);
// un compás sin dividir se escribe como siempre
assert.equal(M.serialize(M.parseChart('| C | % |', [4, 4])), '| C | % |');
// lo viejo, al guardarse, pasa al formato nuevo sin cambiar dónde suena
const old = bar('| C D E |'), saved = bar(M.serialize([Object.assign(old, { row: 0 })]));
near(beats(saved), [0, 1, 2]); assert.deepEqual(saved.items, ['C', 'D', 'E']);

// --- unir deshace de adentro hacia afuera ---
assert.equal(M.join(b, 4), 3); assert.deepEqual(b.items, ['C', '_', '_', 'G']);
assert.equal(M.join(b, 3), 2); assert.deepEqual(b.items, ['C', '_', 'G']); near(beats(b), [0, 2, 3]);
assert.equal(M.join(b, 0), -1);                    // la primera mitad no se puede unir con partes más chicas
assert.equal(M.join(b, 2), 1); near(beats(b), [0, 2]); assert.deepEqual(b.items, ['C', 'G']);
assert.equal(M.join(b, 1), 0); assert.deepEqual(b.items, ['C']); near(b.lens, [1]);
assert.equal(M.join(b, 0), -1);                    // ya está entero

// --- compases que no se parten en dos ---
b = bar('| Am |', [3, 4]); M.split(b, 0); near(beats(b), [0, 1, 2]);            // 3/4: sus tres tiempos
M.split(b, 1); near(beats(b), [0, 1, 1.5, 2]);                                   // y cada tiempo en dos
b = bar('| Am |', [6, 8]); M.split(b, 0); near(beats(b), [0, 3]);               // 6/8: dos mitades
M.split(b, 1); near(beats(b), [0, 3, 4, 5]);                                     // cada mitad en tres corcheas
M.split(b, 3); near(beats(b), [0, 3, 4, 5, 5.5]);                                // corchea en dos semicorcheas
assert.equal(M.split(b, 4), false);
assert.equal(M.join(b, 2), -1);                                                  // hay una corchea dividida: primero esa
assert.equal(M.join(b, 4), 3); near(beats(b), [0, 3, 4, 5]);
assert.equal(M.join(b, 2), 1); near(beats(b), [0, 3]);                           // ahora sí, las tres corcheas
b = bar('| Am |', [5, 4]); M.split(b, 0); near(beats(b), [0, 1, 2, 3, 4]);      // 5/4: sus cinco tiempos
b = bar('| Am |', [12, 8]); M.split(b, 0); near(beats(b), [0, 6]); M.split(b, 0); near(beats(b), [0, 3, 6]);

// --- división en tres (tresillos) ---
b = bar('| C |'); M.split(b, 0); M.split(b, 0);            // tiempos 1 y 2, y la segunda mitad
assert.ok(M.split(b, 0, 3)); near(beats(b), [0, 1 / 3, 2 / 3, 1, 2]);            // tresillo de corchea en el tiempo 1
b.items = ['C', 'C', 'C', 'F', 'G'];
const trip = M.serialize([Object.assign(b, { row: 0 })]);
assert.equal(trip, '| { C C C F . . G . . . . . } |');
near(beats(bar(trip)), [0, 1 / 3, 2 / 3, 1, 2]);
assert.equal(M.join(b, 1), 0); near(beats(b), [0, 1, 2]);
b = bar('| C |'); assert.ok(M.split(b, 0, 3)); near(beats(b), [0, 4 / 3, 8 / 3]); // tresillo de blanca

// --- lo que suena ---
const r = M.resolve(M.parseChart('| { C . . . . . . G } | % |', [4, 4]), 0);
near(r[0].slots.map(s => s.beat), [0, 3.5]);
assert.equal(r[0].slots[1].chord.root, 7);
assert.equal(r[1].slots, r[0].slots);              // el % repite el compás entero, con su reparto
// los lugares vacíos no cortan el acorde anterior
near(M.resolve(M.parseChart('| { C _ _ G } |', [4, 4]), 0)[0].slots.map(s => s.beat), [0, 3]);
// --- cortes ---
const cut = M.parseChord('G7!');
assert.equal(cut.cut, true); assert.equal(cut.qual, '7'); assert.equal(cut.num, 7);
assert.equal(M.parseChord('G7').cut, false);
assert.equal(M.parseChord('Bb/D!').bassNum, 2);
assert.equal(M.parseChord('!'), null);
const withCut = M.parseChart('| { C . . . . . . G! } | _ | F |', [4, 4]);
assert.equal(M.serialize(withCut), '| { C . . . . . . G! } | _ | F |');
const rc = M.resolve(withCut, 2);
assert.deepEqual(rc[0].slots.map(s => !!s.cut), [false, true]);
assert.equal(rc[0].slots[1].chord.root, 9);          // el corte se transporta con el acorde
assert.equal(rc[1].slots.length, 0);                 // compás vacío: sigue el silencio
assert.equal(M.guessKey(M.parseChart('| C! | Am | F | G! |', [4, 4])), 'C');
// --- anticipaciones ---
const ant = M.parseChord('<G7');
assert.equal(ant.push, true); assert.equal(ant.cut, false); assert.equal(ant.qual, '7');
assert.deepEqual([M.parseChord('<Bb/D!').push, M.parseChord('<Bb/D!').cut, M.parseChord('<Bb/D!').bassNum], [true, true, 2]);
assert.equal(M.parseChord('G7').push, false); assert.equal(M.parseChord('<'), null);
const pushed = M.parseChart('| C | <G7 | { Am <Dm! } |', [4, 4]);
assert.equal(M.serialize(pushed), '| C | <G7 | { Am <Dm! } |');
assert.deepEqual(M.resolve(pushed, 0).map(x => x.slots.map(s => (s.push ? 'a' : '') + (s.cut ? 'c' : '')).join(',')), ['', 'a', ',ac']);
assert.equal(M.guessKey(M.parseChart('| <C | Am | F | <G |', [4, 4])), 'C');
console.log('tiempos del compás: ok');
