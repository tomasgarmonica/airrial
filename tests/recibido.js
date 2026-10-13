// Saca de app.js las funciones que revisan lo recibido y las prueba con datos armados a propósito.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] + '/app.js', 'utf8');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('no encontré ' + from); return src.slice(a, b); };
const code = cut('  const colsOf', '  // Las canciones viajan') + cut('  const parseFile', '  // Nombre libre');
const STYLES = [['swing', 'Swing'], ['bossa', 'Bossa']], METERS = ['4/4', '3/4'];
let n = 0;
const newId = () => 'nuevo' + (++n), settings = { builtins: { 'demo-blues': '' } };
const Music = require(process.argv[2] + '/music.js');
const { cleanSong, readData, parseFile } = new Function('STYLES', 'METERS', 'newId', 'settings', 'Music', code + '\nreturn { cleanSong, readData, parseFile };')(STYLES, METERS, newId, settings, Music);

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
// un archivo de iReal Pro entra por el mismo lugar: canciones ya convertidas y, si trae varias, su lista
const ireal = readData(parseFile('<a href="irealb://' + encodeURIComponent('Uno=Autor==Medium Swing=C==1r34LbKcu7[C   |G7   Z=Jazz=120=3===Dos=Autor==Bossa Nova=F==1r34LbKcu7[F   Z=x=0=0===Mi lista') + '">x</a>'));
assert.deepEqual(ireal.songs.map(s => [s.title, s.style, s.key, s.chart].join(' / ')), ['Uno / swing / C / | C | G7 |', 'Dos / bossa / F / | F |']);
assert.deepEqual(ireal.lists.map(l => [l.name, l.songs.join()]), [['Mi lista', ireal.songs.map(s => s.id).join()]]);
assert.equal(readData(parseFile('irealb://' + encodeURIComponent('Sola=Autor==Swing=C==1r34LbKcu7[C   Z=x=0=0'))).lists.length, 0);
// y un archivo de Airrial se sigue leyendo como antes
assert.equal(readData(parseFile('<script type="application/json" id="airrial-data">{"songs":[{"chart":"| C |"}]}</script>')).songs.length, 1);
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
  // Todo lo guardado viaja en un solo código (de Safari a la app instalada, en iPhone) y llega igual: canciones
  // con sus etiquetas y su teclado, y las listas apuntando a las mismas canciones.
  const mine = [
    { id: 'mgk3x1ab', title: 'Tema', composer: 'Autor', style: 'bossa', key: 'Bb', tempo: 140, ts: '3/4', transpose: -2, chart: '| C | <<G7 |', cols: 4, tags: ['Peña'], keys: 'piano' },
    { id: 'mgk3x1ac', title: 'Otro', composer: '', style: 'swing', key: '', tempo: 120, ts: '4/4', transpose: 0, chart: '| F |', cols: 3, tags: [], keys: 'piano' }];
  const sets = [{ id: 'l1', name: 'Recital', songs: ['mgk3x1ac', 'mgk3x1ab'] }];
  const link = new Function('STYLES', 'METERS', 'newId', 'settings', 'Music', 'songs', 'lists', `const findSong = id => songs.find(s => s.id === id);
    ${cut('  const colsOf', '  // Las canciones viajan')}${cut('  const b64', '  function download')}${cut('  const parseFile', '  // Nombre libre')}
    return { packAll, unpack, packSong };`)(STYLES, METERS, newId, settings, Music, mine, sets);
  const code = await link.packAll();
  assert.match(code, /^b\.[\w-]+$/);
  assert.deepEqual((await link.unpack(code)).all, { songs: mine, lists: sets });
  // sin compresión (teléfonos viejos) también
  const flat = 'a.' + Buffer.from(JSON.stringify({ songs: mine, lists: sets })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.deepEqual((await link.unpack(flat)).all, { songs: mine, lists: sets });
  // un código de esos vacío o roto se rechaza, y los enlaces de una sola canción siguen andando
  await assert.rejects(link.unpack('a.' + Buffer.from('{"songs":[]}').toString('base64')));
  await assert.rejects(link.unpack('b.AAAA'));
  assert.equal((await link.unpack(await link.packSong(mine[0]))).song.chart, '| C | <<G7 |');
  console.log('enlaces: ok');
})().catch(e => { console.error(e); process.exit(1); });

// Lo recibido nunca pisa lo que ya había: lo idéntico se reconoce y lo que repite el título entra con un número.
{
  // `room` es cuántas canciones entran en el teléfono de mentira; `said` junta los avisos.
  const said = [];
  const lib = new Function('newId', 'alert', `let songs = [], lists = [], room = 99;
    const unsaved = new Set(), SONGS = 's', LISTS = 'l', findSong = id => songs.find(s => s.id === id);
    const saveSongs = () => { if (songs.length > room) unsaved.add(SONGS); else unsaved.delete(SONGS); }, saveLists = () => {};
    ${cut('  const baseName', '  // Cuadro con opciones')}
    return { mergeData, songs: () => songs, lists: () => lists, room: n => { room = n; }, unsaved };`)(newId, m => said.push(m));
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
  // la que entró con número, recibida de nuevo con su título original: se reconoce y no se duplica
  lib.mergeData({ songs: [{ id: 'q7', title: 'Tema', chart: '| E |' }], lists: [{ id: 'q8', name: 'Recital', songs: ['q7'] }] });
  assert.equal(lib.songs().length, 3);
  assert.equal(lib.lists().length, 3);
  assert.equal(lib.lists()[2].name, 'Recital (3)');
  lib.mergeData({ songs: [{ id: 'q7', title: 'Tema', chart: '| E |' }], lists: [{ id: 'q8', name: 'Recital', songs: ['q7'] }] });
  assert.equal(lib.lists().length, 3);
  // mismo id con otro título: entra aparte, sin número
  lib.mergeData({ songs: [{ id: 'a1', title: 'Otro', chart: '| C |' }], lists: [] });
  assert.equal(lib.songs()[3].title, 'Otro');
  assert.notEqual(lib.songs()[3].id, 'a1');
  console.log('repetidas: ok');
  // sin lugar en el teléfono: no entra nada, la biblioteca queda como estaba y se avisa
  lib.room(4);
  const was = JSON.stringify([lib.songs(), lib.lists()]);
  assert.equal(lib.mergeData({ songs: [{ id: 'n1', title: 'Nueva', chart: '| F |' }], lists: [{ id: 'l9', name: 'Otra', songs: ['n1'] }] }), null);
  assert.equal(JSON.stringify([lib.songs(), lib.lists()]), was);
  assert.equal(lib.unsaved.size, 0);
  assert.equal(said.length, 1);
  console.log('sin lugar: ok');
}
// Los identificadores nuevos no se repiten aunque se pidan muchos juntos.
{
  const mk = new Function(cut('  let idCount', '  const tsOf') + '\nreturn newId;')();
  const all = new Set(Array.from({ length: 5000 }, mk));
  assert.equal(all.size, 5000);
  for (const id of all) assert.match(id, /^[\w-]{1,40}$/);
}
