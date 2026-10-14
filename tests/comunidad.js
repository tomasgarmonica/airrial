// Pruebas de comunidad.js: qué se le pide al servidor y qué se hace con lo que contesta.
// No se conecta: el servidor es de mentira.  node tests/comunidad.js <carpeta del proyecto>
const assert = require('assert'), path = require('path');
const C = require(path.join(process.argv[2] || path.join(__dirname, '..'), 'comunidad.js'));

// buscar sin acentos ni mayúsculas, palabra por palabra
assert.strictEqual(C.plano('Águas de MARÇO'), 'aguas de marco');
assert.deepStrictEqual(C.words('  Águas, de (Março)* '), ['aguas', 'de', 'marco']);
assert.deepStrictEqual(C.words(''), []);
assert.strictEqual(C.words('a b c d e f g h').length, 6, 'tope de palabras');
let q = C.songsQuery({ texto: 'Águas Jobim' });
assert.ok(q.startsWith('canciones?select='), q);
assert.ok(q.includes('busqueda=like.*aguas*') && q.includes('busqueda=like.*jobim*'), q);
assert.ok(q.includes('order=fijada.desc,bajadas.desc,id.desc'), 'por defecto, las más bajadas con las fijadas arriba');
assert.ok(q.includes('limit=31&offset=0'), q);
// lo escrito no puede meter otros pedidos en la dirección
q = C.songsQuery({ texto: 'a&order=x,b', ritmo: 'bossa&x=1', artista: 'tom jobim, a.c.' });
assert.ok(!/&order=x/.test(q) && !q.includes('&x=1'), q);
assert.ok(q.includes('ritmo=eq.bossa%26x%3D1') && q.includes('artista=eq.tom%20jobim%2C%20a.c.'), q);
q = C.songsQuery({ orden: 'nuevas', pagina: 2 });
assert.ok(q.includes('order=id.desc') && q.includes('offset=60') && !q.includes('busqueda'), q);
assert.ok(C.songsQuery({ pagina: -3 }).includes('offset=0'));

// lo que llega pasa a los nombres de la app
assert.deepStrictEqual(C.toSong({ titulo: 'T', compositor: 'A', ritmo: 'bossa', tonalidad: 'C', tempo: 130, compas: '4/4', cifrado: '| C |', cols: 4 }),
  { title: 'T', composer: 'A', style: 'bossa', key: 'C', tempo: 130, ts: '4/4', chart: '| C |', cols: 4 });
assert.strictEqual(C.byWhom({ perfiles: null }), 'Airrial');
assert.strictEqual(C.byWhom({ perfiles: { nombre: 'Tomás' } }), 'Tomás');

(async () => {
  // servidor de mentira: guarda lo pedido y contesta lo que se le diga
  let asked = [], reply = () => ({ ok: true, status: 200, json: async () => [] });
  global.fetch = async (url, opts) => { asked.push({ url, opts }); return reply(url, opts); };

  const rows = Array.from({ length: 31 }, (_, i) => ({ id: i + 1, titulo: 't' + i }));
  reply = () => ({ ok: true, status: 200, json: async () => [...rows, null, { id: 'x' }] });
  let r = await C.buscar({ texto: 'x' });
  assert.strictEqual(r.filas.length, 30, 'una página');
  assert.strictEqual(r.mas, true, 'hay más');
  assert.ok(asked[0].url.startsWith('https://') && asked[0].url.includes('.supabase.co/rest/v1/canciones?'), asked[0].url);
  assert.ok(asked[0].opts.headers.apikey.startsWith('sb_publishable_'), 'manda la clave pública');
  assert.ok(!/secret|service_role/.test(JSON.stringify(asked[0].opts)), 'nunca una clave secreta');

  reply = () => ({ ok: true, status: 200, json: async () => [{ ritmo: 'bossa', cantidad: 3 }, { ritmo: 5 }, { ritmo: 'tango', cantidad: -2 }] });
  assert.deepStrictEqual(await C.ritmos(), [{ ritmo: 'bossa', cantidad: 3 }, { ritmo: 'tango', cantidad: 0 }]);
  reply = () => ({ ok: true, status: 200, json: async () => [{ compositor: 'Tom Jobim', clave: 'tom jobim', cantidad: 2 }, { clave: '' }] });
  assert.deepStrictEqual(await C.artistas(), [{ compositor: 'Tom Jobim', clave: 'tom jobim', cantidad: 2 }]);
  reply = () => ({ ok: true, status: 200, json: async () => ({ no: 'es una lista' }) });
  assert.deepStrictEqual(await C.ritmos(), [], 'respuesta rara');

  asked = [];
  reply = () => ({ ok: true, status: 200, json: async () => [] });
  assert.strictEqual(await C.cancion('7'), null, 'no está');
  assert.ok(asked[0].url.endsWith('&id=eq.7'), asked[0].url);
  assert.strictEqual(await C.cancion('7&x=1'), null, 'número raro');
  assert.strictEqual(asked.length, 1, 'con un número raro no pregunta');

  // si el servidor falla, buscar avisa; bajar no (la canción ya se guardó igual)
  reply = () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(C.buscar({}));
  asked = [];
  reply = () => { throw new TypeError('sin conexión'); };
  await C.bajar(4);
  assert.strictEqual(asked[0].opts.method, 'POST');
  assert.deepStrictEqual(JSON.parse(asked[0].opts.body), { que: 'cancion', cual: 4 });
  reply = () => ({ ok: true, status: 204, json: async () => { throw new Error('vacía'); } });
  assert.strictEqual(await C.bajar(4), null);

  console.log('comunidad: todo ok');
})().catch(e => { console.error(e); process.exit(1); });
