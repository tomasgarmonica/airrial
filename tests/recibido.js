// Saca de app.js las funciones que revisan lo recibido y las prueba con datos armados a propósito.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(process.argv[2] + '/app.js', 'utf8');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('no encontré ' + from); return src.slice(a, b); };
const code = cut('  const colsOf', '  // Las canciones viajan') + cut('  const readData', '  // Las suma a la biblioteca');
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
