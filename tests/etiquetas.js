// Etiquetas: renombrar o borrar una en todas las canciones a la vez. Saca las funciones de app.js y las prueba.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] + '/app.js', 'utf8');
const a = src.indexOf('  const cleanTag'), b = src.indexOf('  // Teclados grabados', a);
if (a < 0 || b < 0) throw new Error('no encontré las funciones de etiquetas en app.js');
let saved = 0;
const lib = new Function('saveSongs', `let songs = [
    { title: 'Uno', tags: ['Peña', 'Estudiar'] }, { title: 'Dos', tags: ['Peña'] }, { title: 'Tres', tags: ['Jazz', 'Estudiar'] }, { title: 'Cuatro' }];
  ${src.slice(a, b)}
  return { retag, allTags, tags: () => songs.map(s => (s.tags || []).join(',')) };`)(() => { saved++; });

// renombrar: cambia en todas las que la tienen y deja a las demás como estaban
assert.equal(lib.retag('Peña', 'Fogón'), 2);
assert.deepEqual(lib.tags(), ['Fogón,Estudiar', 'Fogón', 'Jazz,Estudiar', '']);
assert.deepEqual(lib.allTags(), ['Estudiar', 'Fogón', 'Jazz']);
// renombrar a una que ya existe: quedan unidas, sin repetirse en la misma canción
assert.equal(lib.retag('Fogón', 'Estudiar'), 2);
assert.deepEqual(lib.tags(), ['Estudiar', 'Estudiar', 'Jazz,Estudiar', '']);
// borrar: se quita de todas; las canciones siguen
assert.equal(lib.retag('Estudiar', ''), 3);
assert.deepEqual(lib.tags(), ['', '', 'Jazz', '']);
// una etiqueta que no está no cambia nada ni guarda
const before = saved;
assert.equal(lib.retag('Nada', 'Algo'), 0);
assert.equal(saved, before);
assert.equal(saved, 3);
console.log('etiquetas: ok');
