// Importar lo que respondió una inteligencia artificial: el texto pegado (con saludos, recuadros y nombres
// latinos) se convierte en canciones de Airrial. Las canciones de la prueba son inventadas.
const M = require(process.argv[2]), assert = require('assert');

const answer = `¡Claro! Acá tenés las dos canciones de la página:

\`\`\`
Título: Zamba de prueba
Autor: Juan Pérez
Ritmo: Zamba
Tonalidad: La menor
Compás: 6/8
Tempo: 60

[A]
|: Lam | Mi7 | Lam | Sol7 Do :|
[B]
| Fa | Mi7! | { Rem . Mi7 } | NC |
| 1.2. Lam | "Fine" % |

---

**Título:** "Otra"
Ritmo: Bolero
| C | Am | Dm G7 | Qx7 |
\`\`\`

Espero que te sirva.`;

const got = M.fromText(answer);
assert.equal(got.songs.length, 2);
const [a, b] = got.songs;
assert.deepEqual([a.title, a.composer, a.style, a.key, a.tempo, a.ts], ['Zamba de prueba', 'Juan Pérez', 'zamba', 'Am', 60, '6/8']);
assert.equal(a.chart, [
  '|: [A] Am | E7 | Am | { G7 C } :|',
  '| [B] F | E7! | { Dm . E7 } | N.C. |',
  '| 1.2. Am | "Fine" % |',
].join('\n'));
// lo convertido es un cifrado normal de Airrial: se vuelve a leer y escribir igual
assert.equal(M.serialize(M.parseChart(a.chart, [6, 8])), a.chart);

// sin tonalidad escrita se adivina; sin compás va 4/4; sin tempo queda en 0 (la app pone el de siempre)
assert.deepEqual([b.title, b.style, b.key, b.ts, b.tempo], ['Otra', 'bolero', 'C', '4/4', 0]);
// lo que no es un acorde se avisa, con la canción y el compás
assert.deepEqual(got.problems, [{ song: 'Otra', bar: 4, item: 'Qx7' }]);

// un cifrado suelto, sin datos, también entra (sin título)
const lone = M.fromText('| Dm7 | G7 | Cmaj7 | % |');
assert.equal(lone.songs.length, 1);
assert.equal(lone.songs[0].title, '');
assert.equal(lone.songs[0].chart, '| Dm7 | G7 | Cmaj7 | % |');

// ritmos escritos de otras formas
const style = name => M.fromText(`Título: X\nRitmo: ${name}\n| C |`).songs[0].style;
assert.equal(style('Chacarera'), 'chacarera');
assert.equal(style('Bossa nova'), 'bossa');
assert.equal(style('Vals criollo'), 'vals');
assert.equal(style('Son (clave 3-2)'), 'son32');
assert.equal(style('Balada'), 'balada');
assert.equal(style('Gato'), '');

// nada que importar
assert.equal(M.fromText('Hola, no pude leer la imagen.'), null);
assert.equal(M.fromText(''), null);

console.log('Importar texto: bien.');
