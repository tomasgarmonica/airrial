// Prueba servidor/comunidad.sql en un Postgres local (PGlite), imitando lo que Supabase trae de fábrica.
// No es parte de la app ni de tests/todo.js: necesita PGlite, que se instala aparte, fuera del proyecto. En una
// carpeta temporal: `npm install @electric-sql/pglite@0.5.8`, copiar este archivo ahí (Node busca el paquete
// al lado del archivo) y correr `node probar.mjs "<proyecto>/servidor/comunidad.sql"`.
// Tiene que terminar en "servidor: todo ok".
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const sql = fs.readFileSync(process.argv[2], 'utf8');
const db = new PGlite();
const q = (s, p) => db.query(s, p);
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const err = async (s, re, msg) => { try { await db.exec(s); fails.push(msg + ' (no dio error)'); } catch (e) { if (re && !re.test(e.message)) fails.push(msg + ': ' + e.message); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(sql);
await db.exec(sql); // se puede correr dos veces
// y sobre una base armada antes de que existiera la columna `artista` (como la del proyecto real)
await db.exec(`drop view public.artistas; alter table public.canciones drop column artista`);
// y con el tope viejo de 300 temas por lista
await db.exec(`alter table public.listas drop constraint listas_canciones_check; alter table public.listas add constraint listas_canciones_check check (jsonb_array_length(canciones) between 1 and 300)`);
await db.exec(sql);
const U = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'];
for (const u of U) await q('insert into auth.users values ($1, $2)', [u, u.slice(0, 1) + '@x.com']);
// el dueño carga canciones desde la página de Supabase (sin reglas)
await db.exec(`insert into public.canciones (titulo, compositor, ritmo, compas, tonalidad, tempo, cifrado) values
  ('Águas de Março', 'Tom Jobim', 'bossa', '4/4', 'C', 138, '| C | C7 |'), ('Garota', 'Jobim', 'bossa', '4/4', 'F', 130, '| F |'),
  ('Oculta', 'X', 'swing', '4/4', '', 120, '| C |')`);
await db.exec(`update public.canciones set oculta = true where titulo = 'Oculta'`);
const as = async (role, user) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user || ''}', false); set role ${role};`); };

// cualquiera (sin cuenta) ve lo público, busca sin acentos y recorre por ritmo y artista
await as('anon');
let r = await q(`select titulo from public.canciones order by id`);
ok(r.rows.map(x => x.titulo).join() === 'Águas de Março,Garota', 'anon ve: ' + r.rows.map(x => x.titulo));
r = await q(`select titulo from public.canciones where busqueda like '%aguas de marco%'`);
ok(r.rows.length === 1, 'busqueda sin acentos');
r = await q(`select ritmo, cantidad from public.ritmos`);
ok(JSON.stringify(r.rows) === '[{"ritmo":"bossa","cantidad":2}]', 'ritmos ' + JSON.stringify(r.rows));
r = await q(`select compositor, cantidad from public.artistas order by clave`);
ok(r.rows.length === 2, 'artistas ' + JSON.stringify(r.rows));
r = await q(`select titulo from public.canciones where artista = 'tom jobim'`);
ok(r.rows.length === 1, 'filtrar por artista');
await q(`select public.bajar('cancion', 1)`);
await err(`insert into public.canciones (titulo, ritmo, compas, tempo, cifrado) values ('a', 'swing', '4/4', 120, '| C |')`, /permission|policy/, 'anon no sube');
await err(`update public.canciones set bajadas = 99`, /permission/, 'anon no toca bajadas');
await err(`select * from public.denuncias`, /permission/, 'anon no lee denuncias');
await err(`select email from auth.users`, /permission/, 'anon no ve mails');

// una cuenta: crea su perfil, sube, no puede tocar oculta ni bajadas, ni subir a nombre de otro
await as('authenticated', U[0]);
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[0]}', 'sin perfil', 'swing', '4/4', 120, '| C |')`, /policy/, 'sin perfil no sube');
await db.exec(`insert into public.perfiles (id, nombre) values ('${U[0]}', 'Tomás')`);
await err(`insert into public.perfiles (id, nombre) values ('${U[1]}', 'Otro')`, /policy/, 'perfil ajeno');
await db.exec(`insert into public.canciones (autor, titulo, compositor, ritmo, compas, tempo, cifrado) values ('${U[0]}', 'Mía', 'Yo', 'samba', '2/4', 100, '| A |')`);
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[1]}', 'ajena', 'swing', '4/4', 120, '| C |')`, /policy/, 'subir a nombre de otro');
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado, oculta) values ('${U[0]}', 'x', 'swing', '4/4', 120, '| C |', false)`, /permission/, 'elegir oculta al subir');
await err(`update public.canciones set fijada = true where titulo = 'Mía'`, /permission/, 'fijar la propia');
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[0]}', 'x', 'Swing!', '4/4', 120, '| C |')`, /check/, 'ritmo raro');
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[0]}', 'x', 'swing', '4/4', 999, '| C |')`, /check/, 'tempo raro');
await db.exec(`update public.canciones set tempo = 104 where titulo = 'Mía'`);
r = await q(`update public.canciones set tempo = 50 where titulo = 'Garota' returning id`);
ok(r.rows.length === 0, 'cambió una ajena');
r = await q(`delete from public.canciones where titulo = 'Garota' returning id`);
ok(r.rows.length === 0, 'borró una ajena');
// tope por día
for (let k = 0; k < 29; k++) await db.exec(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[0]}', 't${k}', 'swing', '4/4', 120, '| C |')`);
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[0]}', 'la 31', 'swing', '4/4', 120, '| C |')`, /tope de 30/, 'tope de 30 por día');
// listas largas: 2000 temas entran, 2001 no
const big = n => JSON.stringify(Array.from({ length: n }, (_, k) => ['Tema ' + k, 'Autor', 'swing', 'C', 120, '4/4', '| Cmaj7 | Dm7 G7 | Em7 A7 | Dm7 G7 |', 4]));
await db.exec(`insert into public.listas (autor, nombre, canciones) values ('${U[0]}', 'Grande', '${big(2000)}')`);
await err(`insert into public.listas (autor, nombre, canciones) values ('${U[0]}', 'Enorme', '${big(2001)}')`, /check/, 'lista de 2001');
await db.exec(`reset role; delete from public.listas`);
await as('authenticated', U[0]);
// con enlace: no aparece en el buscador, se abre con el código
await db.exec(`insert into public.listas (autor, nombre, canciones, visibilidad, codigo) values ('${U[0]}', 'Secreta', '[["T","A","swing","C",120,"4/4","| C |",4]]', 'enlace', 'abc123XY')`);
await as('anon');
r = await q(`select * from public.listas`);
ok(r.rows.length === 0, 'la lista con enlace se ve en el buscador');
r = await q(`select public.por_enlace('abc123XY') as x`);
ok(r.rows[0].x && r.rows[0].x.nombre === 'Secreta' && r.rows[0].x.que === 'lista' && !('autor' in r.rows[0].x), 'por_enlace ' + JSON.stringify(r.rows[0].x));
r = await q(`select public.por_enlace('noexiste') as x`);
ok(r.rows[0].x === null, 'código inexistente');
// tres denuncias de cuentas distintas la esconden; dos no
await as('authenticated', U[0]);
const garota = (await q(`select id from public.canciones where titulo = 'Garota'`)).rows[0].id;
for (const u of U.slice(1)) { await as('authenticated', u); await db.exec(`insert into public.perfiles (id, nombre) values ('${u}', 'P${u[0]}')`); }
for (const [i, u] of U.slice(0, 3).entries()) {
  await as('authenticated', u);
  await db.exec(`insert into public.denuncias (que, cual, motivo) values ('cancion', ${garota}, 'spam')`);
  if (i === 0) await err(`insert into public.denuncias (que, cual, motivo) values ('cancion', ${garota}, 'spam')`, /duplicate|unique/, 'denunciar dos veces');
  await as('anon');
  r = await q(`select id from public.canciones where id = ${garota}`);
  ok(r.rows.length === (i < 2 ? 1 : 0), 'denuncias ' + (i + 1));
}
// una cuenta bloqueada no sube
await db.exec(`reset role; update public.perfiles set bloqueado = true where id = '${U[3]}'`);
await as('authenticated', U[3]);
await err(`insert into public.canciones (autor, titulo, ritmo, compas, tempo, cifrado) values ('${U[3]}', 'x', 'swing', '4/4', 120, '| C |')`, /policy/, 'bloqueado sube');
// borrar la cuenta borra lo que subió
await db.exec(`reset role; delete from auth.users where id = '${U[0]}'`);
r = await q(`select count(*)::int as n from public.canciones where autor is not null`);
ok(r.rows[0].n === 0, 'quedaron canciones de la cuenta borrada');
r = await q(`select bajadas from public.canciones where id = 1`);
ok(r.rows[0].bajadas === 1, 'bajadas');

console.log(fails.length ? 'FALLAS:\n' + fails.join('\n') : 'servidor: todo ok');
