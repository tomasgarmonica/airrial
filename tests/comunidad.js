// Pruebas de comunidad.js: qué se le pide al servidor y qué se hace con lo que contesta.
// No se conecta: el servidor es de mentira.  node tests/comunidad.js <carpeta del proyecto>
const assert = require('assert'), path = require('path');
// almacenamiento de mentira, para la sesión
const box = new Map();
global.localStorage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)), removeItem: k => box.delete(k) };
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
// las listas se buscan por nombre, y no traen sus canciones en el renglón
q = C.listsQuery({ texto: 'Peña del Sábado', orden: 'nuevas', pagina: 1 });
assert.ok(q.startsWith('listas?select=') && !q.includes('canciones') && q.includes('busqueda=like.*pena*') && q.includes('busqueda=like.*sabado*'), q);
assert.ok(q.includes('order=id.desc') && q.includes('offset=30'), q);

// lo que llega pasa a los nombres de la app, y lo que se sube al revés (sin etiquetas, teclado ni volúmenes)
assert.deepStrictEqual(C.toSong({ titulo: 'T', compositor: 'A', ritmo: 'bossa', tonalidad: 'C', tempo: 130, compas: '4/4', cifrado: '| C |', cols: 4 }),
  { title: 'T', composer: 'A', style: 'bossa', key: 'C', tempo: 130, ts: '4/4', chart: '| C |', cols: 4 });
const mySong = { id: 'x1', title: ' Mía ', composer: 'Yo', style: 'samba', key: 'A', tempo: 100, ts: '2/4', chart: '| A | E7 |', cols: 4,
  tags: ['privada'], keys: 'rhodes', transpose: 3 };
assert.deepStrictEqual(C.fromSong(mySong), { titulo: 'Mía', compositor: 'Yo', ritmo: 'samba', compas: '2/4', tonalidad: 'A', tempo: 100, cifrado: '| A | E7 |', cols: 4 });
assert.strictEqual(C.byWhom({ perfiles: null }), 'Airrial');
assert.strictEqual(C.byWhom({ perfiles: { nombre: 'Tomás' } }), 'Tomás');
// qué no se puede subir
assert.strictEqual(C.check(mySong), '');
assert.strictEqual(C.check({ chart: '| _ | _ |' }), 'La canción no tiene acordes.');
assert.strictEqual(C.check({ chart: '| "Fine" |' }), 'La canción no tiene acordes.', 'una anotación no es un acorde');
assert.strictEqual(C.check({ chart: '| "D.S. al Coda" C | "Solo de piano sobre la A" G |' }), '');
assert.ok(/hasta 30 letras/.test(C.check({ chart: '| "Yo te quiero tanto mi amor, no me dejes" C |' })), 'letra metida en una anotación');

const resp = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => (body == null ? '' : JSON.stringify(body)) });

(async () => {
  // servidor de mentira: guarda lo pedido y contesta lo que se le diga
  let asked = [], reply = () => resp(200, []);
  global.fetch = async (url, opts) => { asked.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : null }); return reply(url, opts); };

  const rows = Array.from({ length: 31 }, (_, i) => ({ id: i + 1, titulo: 't' + i }));
  reply = () => resp(200, [...rows, null, { id: 'x' }]);
  let r = await C.buscar({ texto: 'x' });
  assert.strictEqual(r.filas.length, 30, 'una página');
  assert.strictEqual(r.mas, true, 'hay más');
  assert.ok(asked[0].url.startsWith('https://') && asked[0].url.includes('.supabase.co/rest/v1/canciones?'), asked[0].url);
  assert.ok(asked[0].opts.headers.apikey.startsWith('sb_publishable_'), 'manda la clave pública');
  assert.ok(!asked[0].opts.headers.Authorization, 'buscar no usa la cuenta');
  assert.ok(!/secret|service_role/.test(JSON.stringify(asked[0].opts)), 'nunca una clave secreta');

  reply = () => resp(200, [{ ritmo: 'bossa', cantidad: 3 }, { ritmo: 5 }, { ritmo: 'tango', cantidad: -2 }]);
  assert.deepStrictEqual(await C.ritmos(), [{ ritmo: 'bossa', cantidad: 3 }, { ritmo: 'tango', cantidad: 0 }]);
  reply = () => resp(200, [{ compositor: 'Tom Jobim', clave: 'tom jobim', cantidad: 2 }, { clave: '' }]);
  assert.deepStrictEqual(await C.artistas(), [{ compositor: 'Tom Jobim', clave: 'tom jobim', cantidad: 2 }]);
  reply = () => resp(200, { no: 'es una lista' });
  assert.deepStrictEqual(await C.ritmos(), [], 'respuesta rara');

  asked = [];
  reply = () => resp(200, []);
  assert.strictEqual(await C.cancion('7'), null, 'no está');
  assert.ok(asked[0].url.endsWith('&id=eq.7'), asked[0].url);
  assert.strictEqual(await C.cancion('7&x=1'), null, 'número raro');
  assert.strictEqual(asked.length, 1, 'con un número raro no pregunta');

  // si el servidor falla, buscar avisa; bajar no (la canción ya se guardó igual)
  reply = () => resp(500, {});
  await assert.rejects(C.buscar({}), e => e.status === 500);
  reply = () => { throw new TypeError('sin conexión'); };
  await assert.rejects(C.buscar({}), e => e.status === 0, 'sin conexión, status 0');
  asked = [];
  await C.bajar(4);
  assert.strictEqual(asked[0].opts.method, 'POST');
  assert.deepStrictEqual(asked[0].body, { que: 'cancion', cual: 4 });
  reply = () => resp(204, null);
  assert.strictEqual(await C.bajar(4), null);
  asked = [];
  await C.bajar(9, 'lista');
  assert.deepStrictEqual(asked[0].body, { que: 'lista', cual: 9 });
  reply = () => resp(200, [{ id: 3, nombre: 'Peña', canciones: [['T', 'A', 'bossa', 'C', 120, '4/4', '| C |', 4]] }]);
  assert.strictEqual((await C.lista('3')).nombre, 'Peña');
  assert.ok(asked[1].url.includes('listas?select=') && asked[1].url.includes(',canciones&id=eq.3'), asked[1].url);
  assert.strictEqual(await C.lista('x'), null);
  reply = () => resp(200, [{ id: 1, nombre: 'a' }, { id: 'no' }]);
  assert.strictEqual((await C.buscarListas({})).filas.length, 1);

  // --- cuenta ---
  assert.strictEqual(C.cuenta(), null, 'sin cuenta al empezar');
  await assert.rejects(C.subir(mySong), e => e.status === 401, 'subir sin cuenta');
  asked = [];
  reply = () => resp(200, {});
  await C.pedirCodigo(' yo@mail.com ');
  assert.ok(asked[0].url.endsWith('/auth/v1/otp'), asked[0].url);
  assert.deepStrictEqual(asked[0].body, { email: 'yo@mail.com', create_user: true });
  // código equivocado: no entra, y el mensaje del servidor queda a mano
  reply = () => resp(403, { msg: 'Token has expired or is invalid' });
  await assert.rejects(C.entrar('yo@mail.com', '123456'), e => e.status === 403 && /expired/.test(e.said));
  assert.strictEqual(C.cuenta(), null);
  const U = 'aaaaaaaa-1111-2222-3333-444444444444';
  const auth = (n, secs) => resp(200, { access_token: 'acceso' + n, refresh_token: 'renovar' + n, expires_in: secs, user: { id: U, email: 'yo@mail.com' } });
  asked = [];
  reply = () => auth(1, 3600);
  await C.entrar('yo@mail.com', '12 34 56');
  assert.deepStrictEqual(asked[0].body, { type: 'email', email: 'yo@mail.com', token: '123456' });
  assert.deepStrictEqual(C.cuenta(), { id: U, email: 'yo@mail.com' });
  assert.ok(box.get('airrial.cuenta.v1').includes('acceso1'), 'la sesión queda guardada');

  // con cuenta: el nombre, subir, lo mío
  asked = [];
  reply = () => resp(200, []);
  assert.strictEqual(await C.miNombre(), '', 'sin nombre todavía');
  assert.strictEqual(asked[0].opts.headers.Authorization, 'Bearer acceso1');
  assert.ok(asked[0].url.endsWith('perfiles?select=nombre&id=eq.' + U), asked[0].url);
  reply = () => resp(201, null);
  await C.ponerNombre('Tomás', true);
  assert.strictEqual(asked[1].opts.method, 'POST');
  assert.deepStrictEqual(asked[1].body, { id: U, nombre: 'Tomás' });
  await C.ponerNombre('Tomi', false);
  assert.strictEqual(asked[2].opts.method, 'PATCH');
  assert.ok(asked[2].url.endsWith('perfiles?id=eq.' + U));
  asked = [];
  reply = () => resp(201, [{ id: 42 }]);
  assert.strictEqual(await C.subir(mySong), 42);
  assert.deepStrictEqual(asked[0].body, { ...C.fromSong(mySong), autor: U });
  assert.strictEqual(asked[0].opts.headers.Prefer, 'return=representation');
  // el tope del día llega con el mensaje del servidor
  reply = () => resp(400, { code: 'P0001', message: 'Llegaste al tope de 30 canciones por día. Probá mañana.' });
  await assert.rejects(C.subir(mySong), e => /tope de 30/.test(e.said));
  asked = [];
  reply = () => resp(204, null);
  await C.actualizar(42, mySong);
  await C.borrar('42');
  assert.deepStrictEqual([asked[0].opts.method, asked[0].body.titulo, asked[1].opts.method], ['PATCH', 'Mía', 'DELETE']);
  assert.ok(asked[1].url.endsWith('canciones?id=eq.42'));
  // listas con la cuenta
  const rowsOf = [['Mía', 'Yo', 'samba', 'A', 100, '2/4', '| A |', 4]];
  asked = [];
  reply = () => resp(201, [{ id: 5 }]);
  assert.strictEqual(await C.subirLista({ nombre: ' Peña ', canciones: rowsOf }), 5);
  assert.deepStrictEqual(asked[0].body, { nombre: 'Peña', canciones: rowsOf, autor: U });
  reply = () => resp(204, null);
  await C.actualizarLista(5, { nombre: 'Peña 2', canciones: rowsOf });
  await C.borrarLista(5);
  assert.deepStrictEqual([asked[1].opts.method, asked[1].body.nombre, asked[2].opts.method], ['PATCH', 'Peña 2', 'DELETE']);
  assert.ok(asked[2].url.endsWith('listas?id=eq.5') && !('autor' in asked[1].body));
  reply = () => resp(200, [{ id: 5, nombre: 'Peña' }]);
  assert.strictEqual((await C.misListas()).length, 1);
  assert.ok(asked[3].url.includes('autor=eq.' + U));

  // el permiso se renueva solo cuando está por vencer (una sola vez aunque se pidan dos cosas juntas)
  reply = () => auth(2, 30);
  await C.entrar('yo@mail.com', '111111');
  asked = [];
  reply = url => (url.includes('grant_type=refresh_token') ? auth(3, 3600) : resp(200, []));
  await Promise.all([C.mias(), C.mias()]);
  const renew = asked.filter(a => a.url.includes('grant_type=refresh_token'));
  assert.strictEqual(renew.length, 1, 'renovó ' + renew.length + ' veces');
  assert.deepStrictEqual(renew[0].body, { refresh_token: 'renovar2' });
  assert.ok(asked.filter(a => a.url.includes('/canciones?')).every(a => a.opts.headers.Authorization === 'Bearer acceso3'));
  // si el permiso para renovar ya no sirve, queda fuera de la cuenta
  reply = () => auth(4, 30);
  await C.entrar('yo@mail.com', '111111');
  reply = url => (url.includes('grant_type=refresh_token') ? resp(400, { msg: 'Invalid Refresh Token' }) : resp(200, []));
  await assert.rejects(C.mias(), e => e.status === 401);
  assert.strictEqual(C.cuenta(), null);
  assert.ok(!box.has('airrial.cuenta.v1'), 'se borró la sesión');
  // sin conexión no la pierde
  reply = () => auth(5, 30);
  await C.entrar('yo@mail.com', '111111');
  reply = () => { throw new TypeError('sin conexión'); };
  await assert.rejects(C.mias(), e => e.status === 0);
  assert.ok(C.cuenta(), 'sin conexión se perdió la cuenta');
  // salir
  asked = [];
  reply = () => resp(204, null);
  C.salir();
  assert.strictEqual(C.cuenta(), null);
  assert.ok(asked[0].url.endsWith('/auth/v1/logout'));
  // una respuesta rara al entrar no deja una sesión a medias
  reply = () => resp(200, { access_token: 'x' });
  await assert.rejects(C.entrar('yo@mail.com', '1'));
  assert.strictEqual(C.cuenta(), null);

  console.log('comunidad: todo ok');
})().catch(e => { console.error(e); process.exit(1); });
