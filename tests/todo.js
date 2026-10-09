// Corre todas las pruebas antes de publicar:  node tests/todo.js
// Si algo falla, se corta acá y no hay que publicar.
const { execFileSync } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..');
const run = (...args) => execFileSync(process.execPath, args, { stdio: 'inherit' });

// 1) que ningún archivo de la app tenga errores de escritura
for (const f of ['music.js', 'audio.js', 'export.js', 'app.js', 'sw.js']) run('--check', path.join(root, f));
// 2) que estén todas las funciones que la app usa de la lógica musical
const Music = require(path.join(root, 'music.js'));
for (const name of ['setView', 'markOf', 'normalize', 'serialize', 'parseChord', 'spell', 'transposeName', 'useFlats',
  'firstChord', 'positions', 'parseChart', 'intervals', 'resolve', 'unfold', 'guessKey', 'starts', 'grid', 'natural', 'split', 'join']) {
  if (typeof Music[name] !== 'function') throw new Error('Falta la función Music.' + name);
}
// 3) las pruebas de cada parte
run(path.join(__dirname, 'musica.js'), path.join(root, 'music.js'));
run(path.join(__dirname, 'saltos.js'), path.join(root, 'music.js'));
run(path.join(__dirname, 'tonalidad.js'), path.join(root, 'music.js'));
run(path.join(__dirname, 'tiempos.js'), path.join(root, 'music.js'));
run(path.join(__dirname, 'audio.js'), root);
run(path.join(__dirname, 'practica.js'), root);
run(path.join(__dirname, 'cortes.js'), root);
console.log('\nTodas las pruebas pasaron.');
