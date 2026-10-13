// Saca de app.js las funciones que revisan lo recibido y las prueba con datos armados a propósito.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] + '/app.js', 'utf8');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('no encontré ' + from); return src.slice(a, b); };
const code = cut('  const colsOf', '  // Las canciones viajan') + cut('  const readData', '  // Nombre libre');
const STYLES = [['swing', 'Swing'], ['bossa', 'Bossa']], METERS = ['4/4', '3/4'];
let n = 0;
const newId = () => 'nuevo' + (++n), settings = { builtins: { 'demo-blues': '' } };
const { cleanSong, readData } = new Function('STYLES', 'METERS', 'newId', 'settings', code + '\nreturn { cleanSong, readData };')(STYLES, METERS, newId, settings);

const evil = JSON.parse(`{"id":"<img src=x onerror=alert(1)>/../x","title":"${'T'.repeat(5000)}","composer":{"a":1},"key":"${'K'.repeat(999)}",
  "tempo":1e999,"transpose":1e999,"ts":"99/1","style":"<b>","chart":"${'['.repeat(100000)}","cols":1e999,"builtin":true,
  "tags":["<script>", 7, null],"keys":"x","parts":{"__proto__":3,"constructor":2,"A":1,"B":1e999}}`);
const s = cleanSong(evil);
assert.match(s.id, /^nuevo\d+$/);
assert.equal(s.title.length, 200);
assert.equal(s.composer, '[object Object]');
assert.equal(s.key.length, 12);
assert.equal(s.tempo, 360);
assert.equal(s.transpose, 0);
assert.equal(s.ts, '4/4');
assert.equal(s.style, 'swing');
assert.equal(s.chart.length, 40000);
assert.equal(s.cols, 6);
assert.equal(s.builtin, undefined);
assert.deepEqual(s.tags, ['script', '7']);
assert.equal(s.keys, 'piano');
assert.deepEqual(Object.keys(s.parts).sort(), ['A', 'constructor']);
assert.equal(Object.getPrototypeOf(s.parts), Object.prototype);
// una canción normal pasa sin cambios, y la incluida conserva su marca
const ok = { id: 'mgk3x1ab', title: 'Tema', composer: 'Autor', style: 'bossa', key: 'Bb', tempo: 140, ts: '3/4', transpose: -2, chart: '| C | G7 |', cols: 4, tags: ['Peña'], keys: 'piano' };
assert.deepEqual(cleanSong(ok), ok);
assert.equal(cleanSong({ id: 'demo-blues', chart: '', builtin: true }).builtin, true);
assert.equal(cleanSong({ chart: '' }).title, 'Sin título');
// listas: ids raros afuera
const d = readData({ songs: [ok, null, 5, { chart: 3 }], lists: [{ id: 'a/b', name: '', songs: ['mgk3x1ab', '../x', 9] }, { songs: 'x' }] });
assert.equal(d.songs.length, 1);
assert.equal(d.lists.length, 1);
assert.match(d.lists[0].id, /^nuevo/);
assert.deepEqual(d.lists[0].songs, ['mgk3x1ab', '9']);
assert.equal(d.lists[0].name, 'Lista');
console.log('lo recibido: ok');

// Enlaces: lo que se empaqueta se vuelve a leer igual, y un enlace que al descomprimirse ocupa demasiado se rechaza.
(async () => {
  const pack = new Function(cut('  const b64', '  const songRow') + '\nreturn { b64, unb64, pipe };')();
  const text = 'hola\t| C | G7 |'.repeat(500);
  const small = await pack.pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  const back = await pack.pipe(pack.unb64(pack.b64(small)), new DecompressionStream('deflate-raw'));
  assert.equal(new TextDecoder().decode(back), text);
  const bomb = await new Response(new Blob([new Uint8Array(60e6)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  assert.ok(bomb.byteLength < 100000);
  await assert.rejects(pack.pipe(new Uint8Array(bomb), new DecompressionStream('deflate-raw')), /demasiado grande/);
  console.log('enlaces: ok');
})().catch(e => { console.error(e); process.exit(1); });

// Lo recibido nunca pisa lo que ya había: lo idéntico se reconoce y lo que repite el título entra con un número.
{
  const lib = new Function('newId', `let songs = [], lists = [];
    const findSong = id => songs.find(s => s.id === id), saveSongs = () => {}, saveLists = () => {};
    ${cut('  const freeName', '  // Cuadro con opciones')}
    return { mergeData, songs: () => songs, lists: () => lists };`)(newId);
  const mine = { id: 'a1', title: 'Tema', chart: '| C |' };
  lib.mergeData({ songs: [mine], lists: [{ id: 'l1', name: 'Recital', songs: ['a1'] }] });
  // la misma otra vez: no se duplica nada
  lib.mergeData({ songs: [{ ...mine }], lists: [{ id: 'l1', name: 'Recital', songs: ['a1'] }] });
  assert.equal(lib.songs().length, 1);
  assert.equal(lib.lists().length, 1);
  // mismo id y mismo título con otro cifrado: la mía queda y la otra entra como "Tema (2)", y después "Tema (3)"
  const kept = lib.mergeData({ songs: [{ id: 'a1', title: 'Tema', chart: '| D |' }], lists: [{ id: 'l1', name: 'Recital', songs: ['a1'] }] });
  lib.mergeData({ songs: [{ id: 'zz', title: 'Tema', chart: '| E |' }], lists: [] });
  assert.deepEqual(lib.songs().map(s => s.title + ' ' + s.chart), ['Tema | C |', 'Tema (2) | D |', 'Tema (3) | E |']);
  assert.equal(new Set(lib.songs().map(s => s.id)).size, 3);
  assert.notEqual(kept.songs[0], 'a1');
  // la lista recibida apunta a la canción nueva, y también entra con número
  assert.deepEqual(lib.lists().map(l => l.name + ':' + l.songs.join()), ['Recital:a1', 'Recital (2):' + kept.songs[0]]);
  assert.equal(new Set(lib.lists().map(l => l.id)).size, 2);
  // mismo id con otro título: entra aparte, sin número
  lib.mergeData({ songs: [{ id: 'a1', title: 'Otro', chart: '| C |' }], lists: [] });
  assert.equal(lib.songs()[3].title, 'Otro');
  assert.notEqual(lib.songs()[3].id, 'a1');
  console.log('repetidas: ok');
}
// Los identificadores nuevos no se repiten aunque se pidan muchos juntos.
{
  const mk = new Function(cut('  let idCount', '  const tsOf') + '\nreturn newId;')();
  const all = new Set(Array.from({ length: 5000 }, mk));
  assert.equal(all.size, 5000);
  for (const id of all) assert.match(id, /^[\w-]{1,40}$/);
}
