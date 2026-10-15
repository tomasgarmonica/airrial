// Pruebas de sincro.js: dos aparatos de mentira y un servidor de mentira que hace lo mismo que la tabla
// `biblioteca` (servidor/comunidad.sql): una versión más vieja no pisa, y cada guardado avanza la hora.
//   node tests/sincro.js <carpeta del proyecto>
const assert = require('assert'), path = require('path');
const S = require(path.join(process.argv[2] || path.join(__dirname, '..'), 'sincro.js'));

let reloj = Date.parse('2026-10-15T12:00:00Z'), hora = 0;
const server = new Map();
const guardar = filas => {
  for (const f of filas) {
    const k = f.tipo + '/' + f.id, old = server.get(k);
    if (old && f.cambiado < old.cambiado) continue;
    server.set(k, { tipo: f.tipo, id: f.id, datos: f.borrado ? null : JSON.parse(JSON.stringify(f.datos)), borrado: f.borrado,
      cambiado: f.cambiado, actualizado: new Date(Date.parse('2026-10-15T00:00:00Z') + 1000 * ++hora).toISOString().replace('Z', '123+00:00') });
  }
};
const traer = desde => [...server.values()].filter(f => !desde || Date.parse(f.actualizado.replace('123+00:00', 'Z')) >= Date.parse(desde))
  .map(f => JSON.parse(JSON.stringify(f)));
const limpiar = (tipo, d) => (tipo === 'lista' ? { id: d.id, name: String(d.name), songs: d.songs.filter(x => typeof x === 'string') }
  : { id: d.id, title: String(d.title), chart: String(d.chart) });

const aparato = () => ({ songs: [], lists: [], st: S.nuevo() });
const cosas = a => {
  const m = new Map();
  a.songs.forEach(s => m.set('c:' + s.id, s));
  a.lists.forEach(l => m.set('l:' + l.id, l));
  return m;
};
// Lo mismo que hace la app: anotar, traer, aplicar, mandar.
const sync = (a, juntar) => {
  S.anotar(a.st, cosas(a), juntar ? 0 : (reloj += 1000));
  const filas = traer(S.pedirDesde(a.st.desde));
  const ops = S.aplicar(a.st, filas, cosas(a), limpiar);
  for (const op of ops) {
    const arr = op.tipo === 'lista' ? a.lists : a.songs, i = arr.findIndex(x => x.id === op.id);
    if (!op.datos) arr.splice(i, 1);
    else if (i >= 0) { for (const k of Object.keys(arr[i])) delete arr[i][k]; Object.assign(arr[i], op.datos); } else arr.push(op.datos);
  }
  a.st.desde = S.masNueva(filas, a.st.desde);
  const p = S.pendientes(a.st, cosas(a));
  guardar(p);
  S.enviadas(a.st, p);
  return ops.length;
};
const titulos = a => a.songs.map(s => s.title).sort().join();

// la huella cambia con el contenido
assert.notStrictEqual(S.huella('a'), S.huella('b'));
assert.strictEqual(S.huella('Cmaj7'), S.huella('Cmaj7'));

// la PC sube todo la primera vez
const pc = aparato(), cel = aparato();
pc.songs.push({ id: 'a', title: 'Autumn', chart: '| Am7 |' }, { id: 'b', title: 'Blue', chart: '| F7 |' });
pc.lists.push({ id: 'L', name: 'Recital', songs: ['a', 'b'] });
sync(pc, true);
assert.strictEqual(server.size, 3);
// las canciones se mandan antes que las listas
assert.deepStrictEqual(S.pendientes({ sucias: { 'l:x': { t: 1, h: 'q' }, 'c:y': { t: 1, h: 'r' } } }, new Map([['l:x', {}], ['c:y', {}]])).map(f => f.tipo), ['cancion', 'lista']);

// el celular, que tenía una propia, se junta: queda con todo, y la suya sube
cel.songs.push({ id: 'c', title: 'Corcovado', chart: '| D9 |' });
sync(cel, true);
assert.strictEqual(titulos(cel), 'Autumn,Blue,Corcovado');
assert.deepStrictEqual(cel.lists[0].songs, ['a', 'b']);
sync(pc);
assert.strictEqual(titulos(pc), 'Autumn,Blue,Corcovado');

// editar en uno llega al otro, sin cambiar el objeto (las pantallas abiertas lo siguen teniendo)
const blueCel = cel.songs.find(s => s.id === 'b');
pc.songs.find(s => s.id === 'b').chart = '| F7 | Bb7 |';
sync(pc);
sync(cel);
assert.strictEqual(blueCel.chart, '| F7 | Bb7 |');
assert.strictEqual(cel.songs.find(s => s.id === 'b'), blueCel);

// sin cambios no se manda nada
const antes = hora;
sync(cel);
sync(pc);
assert.strictEqual(hora, antes, 'mandó algo sin cambios');

// borrar en uno borra en el otro (y en la lista)
cel.songs = cel.songs.filter(s => s.id !== 'a');
cel.lists[0].songs = ['b'];
sync(cel);
sync(pc);
assert.strictEqual(titulos(pc), 'Blue,Corcovado');
assert.deepStrictEqual(pc.lists[0].songs, ['b']);

// los dos cambian la misma: gana la que se guardó último, aunque se mande antes
cel.songs.find(s => s.id === 'c').title = 'Corcovado (cel)';
S.anotar(cel.st, cosas(cel), (reloj += 1000));
pc.songs.find(s => s.id === 'c').title = 'Corcovado (pc)';
S.anotar(pc.st, cosas(pc), (reloj += 1000));
sync(pc);
sync(cel); // el celular estaba sin conexión: su cambio es más viejo
sync(pc);
assert.strictEqual(titulos(cel), 'Blue,Corcovado (pc)');
assert.strictEqual(titulos(pc), 'Blue,Corcovado (pc)');
// y al revés: el más nuevo es el que llega tarde
pc.songs.find(s => s.id === 'c').title = 'Viejo';
S.anotar(pc.st, cosas(pc), (reloj += 1000));
cel.songs.find(s => s.id === 'c').title = 'Nuevo';
S.anotar(cel.st, cosas(cel), (reloj += 1000));
sync(pc);
sync(cel);
sync(pc);
assert.strictEqual(titulos(cel), 'Blue,Nuevo');
assert.strictEqual(titulos(pc), 'Blue,Nuevo');

// borrada en uno y editada después en el otro: vuelve
cel.songs = cel.songs.filter(s => s.id !== 'b');
S.anotar(cel.st, cosas(cel), (reloj += 1000));
pc.songs.find(s => s.id === 'b').title = 'Blue editada';
S.anotar(pc.st, cosas(pc), (reloj += 1000));
sync(cel);
sync(pc);
sync(cel);
assert.strictEqual(titulos(cel), 'Blue editada,Nuevo');

// creada y borrada antes de sincronizar: no viaja
cel.songs.push({ id: 'tmp', title: 'Borrador', chart: '| C |' });
S.anotar(cel.st, cosas(cel), (reloj += 1000));
cel.songs.pop();
sync(cel);
assert.ok(!server.has('cancion/tmp'));

// lo que vuelve de la cuenta igual a lo que hay (lo que este aparato acaba de mandar) no cambia nada, aunque
// la cuenta lo guarde distinto (otro orden, sin datos de más)
pc.songs.push({ chart: '| G |', extra: 1, title: 'Eco', id: 'e' });
sync(pc);
assert.strictEqual(sync(pc), 0, 'el eco cambió algo');
assert.strictEqual(pc.songs.find(s => s.id === 'e').extra, 1);
// dos aparatos que se juntan con la misma canción (misma hora: 0): gana la de la cuenta
const tv = aparato(), tv2 = aparato();
server.clear();
tv.songs.push({ id: 'd', title: 'Demo de la TV', chart: '| C |' });
sync(tv, true);
tv2.songs.push({ id: 'd', title: 'Demo de la otra', chart: '| C |' });
sync(tv2, true);
assert.strictEqual(titulos(tv2), 'Demo de la TV');

// lo que llega con datos raros pasa por limpiar, y los ids raros se ignoran
const raro = aparato();
const ops = S.aplicar(raro.st, [{ tipo: 'cancion', id: 'x', datos: { title: 5, chart: 7, extra: '<b>' }, cambiado: 1 },
  { tipo: 'cancion', id: '../mal', datos: { title: 'y' }, cambiado: 1 }, { tipo: 'otra', id: 'z', datos: {}, cambiado: 1 }, null], new Map(), limpiar);
assert.deepStrictEqual(ops, [{ tipo: 'cancion', id: 'x', datos: { id: 'x', title: '5', chart: '7' } }]);

// la hora: se pide un minuto antes de lo último traído; sin nada traído, todo
assert.strictEqual(S.pedirDesde(''), '');
assert.strictEqual(S.pedirDesde('2026-10-15T12:01:00.123456+00:00'), '2026-10-15T12:00:00.123Z');
assert.strictEqual(S.masNueva([{ actualizado: '2026-10-15T12:00:00.5+00:00' }, { actualizado: '2026-10-15T12:00:01+00:00' }], ''), '2026-10-15T12:00:01+00:00');
assert.strictEqual(S.masNueva([], 'x'), 'x');
console.log('sincro: ok');
