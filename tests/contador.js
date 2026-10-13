// Contador de uso: qué sale hacia GoatCounter. Saca la función de app.js y mira las direcciones que arma.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] + '/app.js', 'utf8');
const a = src.indexOf('  const counted'), b = src.indexOf('  const STYLES', a);
if (a < 0 || b < 0) throw new Error('no encontré el contador en app.js');
const sent = [];
const make = (hostname, referrer) => new Function('location', 'document', 'screen', 'Image', src.slice(a, b) + '\nreturn tally;')(
  { hostname, hash: '#/i/b.SECRETO', href: 'https://airrial.ar/#/i/b.SECRETO' }, { referrer, title: 'Tema secreto' }, { width: 390 },
  class { set src(v) { sent.push(new URL(v)); } });

// fuera del sitio publicado (pruebas, la PC de quien programa) no sale nada
make('127.0.0.1', '')('/navegador', true);
make('localhost', '')('Reproducir · samba');
assert.equal(sent.length, 0);

// la visita: va el nombre, el ancho de pantalla y de qué sitio llegó (solo el nombre del sitio)
let tally = make('airrial.ar', 'https://buscador.example/resultados?q=algo+privado');
tally('/navegador', true);
assert.equal(sent.length, 1);
assert.equal(sent[0].origin + sent[0].pathname, 'https://airrial.goatcounter.com/count');
assert.deepEqual([...sent[0].searchParams.keys()].sort(), ['p', 'r', 'rnd', 's', 't']);
assert.equal(sent[0].searchParams.get('p'), '/navegador');
assert.equal(sent[0].searchParams.get('r'), 'buscador.example');
assert.equal(sent[0].searchParams.get('t'), 'Airrial');
// una acción: va marcada como tal y sin el sitio de origen
tally('Reproducir · samba');
assert.deepEqual([...sent[1].searchParams.keys()].sort(), ['e', 'p', 'rnd', 's', 't']);
assert.equal(sent[1].searchParams.get('p'), 'Reproducir · samba');
// cada cosa, una sola vez por apertura de la app
tally('Reproducir · samba'); tally('/navegador', true);
assert.equal(sent.length, 2);
tally('Reproducir · bossa');
assert.equal(sent.length, 3);
// nunca viaja lo compartido, ni el título de la página, ni la dirección completa de donde vino
for (const u of sent) assert.ok(!/SECRETO|secreto|privado|resultados/.test(decodeURIComponent(u.href)), u.href);
// quien llega directo (sin sitio de origen) se cuenta igual
sent.length = 0;
make('airrial.ar', '')('/instalada', true);
assert.deepEqual([...sent[0].searchParams.keys()].sort(), ['p', 'rnd', 's', 't']);

// y en app.js todo lo que se cuenta es un nombre fijo: nada que salga de una canción o una lista
const calls = src.match(/tally\([^;]*\);/g).filter(c => !c.includes('=>'));
assert.ok(calls.length >= 10, 'esperaba más llamadas al contador');
for (const c of calls) assert.ok(!/title|name\b|chart|composer|tags|hash|code|\.id/.test(c), 'el contador no puede llevar esto: ' + c);
console.log('contador: ok (' + calls.length + ' lugares)');
