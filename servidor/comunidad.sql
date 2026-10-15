-- Airrial · Comunidad: tablas, reglas y funciones del servidor (Supabase).
-- Se pega entero en Supabase → SQL Editor → Run. Se puede volver a correr sin perder nada.
-- Diseño y razones: COMUNIDAD.md. Lo que llega de acá la app lo vuelve a revisar (cleanSong): el servidor no se
-- da por confiable, pero tampoco deja guardar cualquier cosa.

-- Sin acentos y en minúsculas, para buscar ("Águas" encuentra "aguas").
create or replace function public.plano(t text) returns text
  language sql immutable parallel safe
  set search_path = ''
  as $$ select translate(lower(coalesce(t, '')), 'áéíóúàèìòùäëïöüâêîôûãõñç', 'aeiouaeiouaeiouaeiouaonc') $$;

-- Quien sube: el nombre que eligió mostrar. El mail queda en la cuenta (auth.users) y no se ve.
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 30),
  creado timestamptz not null default now(),
  bloqueado boolean not null default false
);

-- Canciones: los mismos datos y topes que un archivo compartido. `autor` vacío: la cargó Airrial.
create table if not exists public.canciones (
  id bigint generated always as identity primary key,
  autor uuid references public.perfiles (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  compositor text not null default '' check (char_length(compositor) <= 200),
  ritmo text not null check (ritmo ~ '^[a-z0-9]{1,20}$'),
  compas text not null check (compas in ('4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8')),
  tonalidad text not null default '' check (char_length(tonalidad) <= 12),
  tempo int not null check (tempo between 30 and 360),
  cifrado text not null check (char_length(cifrado) between 1 and 40000),
  cols int not null default 4 check (cols between 2 and 6),
  visibilidad text not null default 'publica' check (visibilidad in ('publica', 'enlace')),
  codigo text unique check (codigo ~ '^[A-Za-z0-9]{6,16}$'),
  oculta boolean not null default false,
  fijada boolean not null default false,
  bajadas int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  busqueda text generated always as (public.plano(titulo || ' ' || compositor)) stored
);
-- El artista sin acentos ni mayúsculas, para juntar "Jobim" y "jobim" al recorrer por artista (agregado después:
-- por eso va aparte, así se suma a la tabla si ya estaba creada).
alter table public.canciones add column if not exists artista text generated always as (public.plano(compositor)) stored;
create index if not exists canciones_ritmo on public.canciones (ritmo);
create index if not exists canciones_artista on public.canciones (artista);
drop index if exists public.canciones_compositor;
create index if not exists canciones_autor on public.canciones (autor);

-- Listas: nombre y una copia de sus canciones (como el archivo de lista: filas de songRow).
create table if not exists public.listas (
  id bigint generated always as identity primary key,
  autor uuid references public.perfiles (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 200),
  ritmo text check (ritmo ~ '^[a-z0-9]{1,20}$'),
  canciones jsonb not null check (jsonb_typeof(canciones) = 'array' and jsonb_array_length(canciones) between 1 and 2000
    and octet_length(canciones::text) <= 3000000),
  cantidad int generated always as (jsonb_array_length(canciones)) stored,
  visibilidad text not null default 'publica' check (visibilidad in ('publica', 'enlace')),
  codigo text unique check (codigo ~ '^[A-Za-z0-9]{6,16}$'),
  oculta boolean not null default false,
  fijada boolean not null default false,
  bajadas int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  busqueda text generated always as (public.plano(nombre)) stored
);
create index if not exists listas_autor on public.listas (autor);
-- Listas de hasta 2000 temas (al principio eran 300): se cambia el tope en una base ya armada.
alter table public.listas drop constraint if exists listas_canciones_check;
alter table public.listas add constraint listas_canciones_check check (jsonb_typeof(canciones) = 'array' and jsonb_array_length(canciones) between 1 and 2000
    and octet_length(canciones::text) <= 3000000);

-- Denuncias: una por cuenta y por cosa. Nadie las puede leer desde la app (se miran en la página de Supabase).
create table if not exists public.denuncias (
  id bigint generated always as identity primary key,
  que text not null check (que in ('cancion', 'lista')),
  cual bigint not null,
  quien uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  motivo text not null check (motivo in ('spam', 'ofensivo', 'letra o melodia', 'derechos de autor', 'otro')),
  detalle text not null default '' check (char_length(detalle) <= 500),
  creado timestamptz not null default now(),
  resuelta boolean not null default false,
  unique (que, cual, quien)
);

-- Biblioteca de cada cuenta, para tener las mismas canciones y listas en varios aparatos. Es privada: cada
-- cuenta ve y cambia solo lo suyo. Un renglón por canción o lista, con el mismo id que tiene en el aparato; lo
-- borrado queda como marca (`borrado`, sin datos) para que los otros aparatos se enteren. `cambiado` es cuándo se
-- guardó en el aparato (milisegundos): si llega una versión más vieja que la que hay, no la pisa.
create table if not exists public.biblioteca (
  dueno uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('cancion', 'lista')),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  datos jsonb check (datos is null or jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 200000),
  borrado boolean not null default false,
  cambiado bigint not null check (cambiado >= 0),
  actualizado timestamptz not null default now(),
  primary key (dueno, tipo, id)
);
create index if not exists biblioteca_al_dia on public.biblioteca (dueno, actualizado);

-- Cuántas canciones hay de cada ritmo y de cada artista (para recorrer la Comunidad). Respetan las reglas de
-- abajo: solo cuentan lo público y no oculto.
create or replace view public.ritmos with (security_invoker = true) as
  select ritmo, count(*)::int as cantidad from public.canciones group by ritmo;
create or replace view public.artistas with (security_invoker = true) as
  select min(compositor) as compositor, artista as clave, count(*)::int as cantidad
  from public.canciones where btrim(compositor) <> '' group by artista;

-- --- Reglas por fila ---
alter table public.perfiles enable row level security;
alter table public.canciones enable row level security;
alter table public.listas enable row level security;
alter table public.denuncias enable row level security;
alter table public.biblioteca enable row level security;

-- Una cuenta puede subir si tiene perfil y no está bloqueada.
create or replace function public.puede_subir() returns boolean
  language sql stable security definer
  set search_path = ''
  as $$ select exists (select 1 from public.perfiles where id = auth.uid() and not bloqueado) $$;

drop policy if exists "ver nombres" on public.perfiles;
create policy "ver nombres" on public.perfiles for select using (true);
drop policy if exists "crear mi perfil" on public.perfiles;
create policy "crear mi perfil" on public.perfiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "cambiar mi nombre" on public.perfiles;
create policy "cambiar mi nombre" on public.perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['canciones', 'listas'] loop
    execute format('drop policy if exists "ver lo publico" on public.%I', t);
    execute format('create policy "ver lo publico" on public.%I for select using (visibilidad = ''publica'' and not oculta or autor = auth.uid())', t);
    execute format('drop policy if exists "subir" on public.%I', t);
    execute format('create policy "subir" on public.%I for insert to authenticated with check (autor = auth.uid() and public.puede_subir())', t);
    execute format('drop policy if exists "cambiar lo mio" on public.%I', t);
    execute format('create policy "cambiar lo mio" on public.%I for update to authenticated using (autor = auth.uid()) with check (autor = auth.uid() and public.puede_subir())', t);
    execute format('drop policy if exists "borrar lo mio" on public.%I', t);
    execute format('create policy "borrar lo mio" on public.%I for delete to authenticated using (autor = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "denunciar" on public.denuncias;
create policy "denunciar" on public.denuncias for insert to authenticated with check (quien = auth.uid() and public.puede_subir());

drop policy if exists "solo lo mio" on public.biblioteca;
create policy "solo lo mio" on public.biblioteca for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());

-- Qué columnas puede tocar cada uno: nadie cambia desde la app si algo está oculto o fijado, ni sus bajadas.
revoke all on public.perfiles, public.canciones, public.listas, public.denuncias from anon, authenticated;
grant select (id, nombre) on public.perfiles to anon, authenticated;
grant insert (id, nombre), update (nombre) on public.perfiles to authenticated;
grant select on public.canciones, public.listas to anon, authenticated;
grant insert (autor, titulo, compositor, ritmo, compas, tonalidad, tempo, cifrado, cols, visibilidad, codigo),
  update (titulo, compositor, ritmo, compas, tonalidad, tempo, cifrado, cols, visibilidad, codigo),
  delete on public.canciones to authenticated;
grant insert (autor, nombre, ritmo, canciones, visibilidad, codigo),
  update (nombre, ritmo, canciones, visibilidad, codigo),
  delete on public.listas to authenticated;
grant insert (que, cual, quien, motivo, detalle) on public.denuncias to authenticated;
revoke all on public.biblioteca from anon, authenticated;
grant select, delete, insert (dueno, tipo, id, datos, borrado, cambiado), update (dueno, tipo, id, datos, borrado, cambiado)
  on public.biblioteca to authenticated;
grant select on public.ritmos, public.artistas to anon, authenticated;

-- --- Funciones ---
-- Sumar una bajada (la puede llamar cualquiera; no guarda quién).
create or replace function public.bajar(que text, cual bigint) returns void
  language plpgsql security definer
  set search_path = ''
  as $$
begin
  if que = 'cancion' then update public.canciones set bajadas = bajadas + 1 where id = cual and not oculta;
  elsif que = 'lista' then update public.listas set bajadas = bajadas + 1 where id = cual and not oculta;
  end if;
end $$;

-- Abrir algo "con enlace" sabiendo su código (así no se puede listar, solo abrir).
create or replace function public.por_enlace(codigo text) returns jsonb
  language sql stable security definer
  set search_path = ''
  as $$
  select coalesce(
    (select to_jsonb(c) - 'autor' - 'busqueda' - 'artista' || jsonb_build_object('que', 'cancion') from public.canciones c
      where c.codigo = por_enlace.codigo and not c.oculta),
    (select to_jsonb(l) - 'autor' - 'busqueda' || jsonb_build_object('que', 'lista') from public.listas l
      where l.codigo = por_enlace.codigo and not l.oculta))
$$;

-- Al subir: tope por día, y la fecha de cambio al día.
create or replace function public.al_subir() returns trigger
  language plpgsql security definer
  set search_path = ''
  as $$
declare hoy int;
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    if tg_table_name = 'canciones' then
      select count(*) into hoy from public.canciones where autor = auth.uid() and creado > now() - interval '1 day';
      if hoy >= 30 then raise exception 'Llegaste al tope de 30 canciones por día. Probá mañana.'; end if;
    else
      select count(*) into hoy from public.listas where autor = auth.uid() and creado > now() - interval '1 day';
      if hoy >= 5 then raise exception 'Llegaste al tope de 5 listas por día. Probá mañana.'; end if;
    end if;
  end if;
  new.actualizado := now();
  return new;
end $$;
drop trigger if exists al_subir on public.canciones;
create trigger al_subir before insert or update on public.canciones for each row execute function public.al_subir();
drop trigger if exists al_subir on public.listas;
create trigger al_subir before insert or update on public.listas for each row execute function public.al_subir();

-- Al guardar en la biblioteca: la hora del servidor (los aparatos traen lo cambiado desde la última vez que
-- miraron), un tope de renglones por cuenta, y una versión más vieja que la guardada no la pisa.
create or replace function public.al_guardar() returns trigger
  language plpgsql security definer
  set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.biblioteca where dueno = new.dueno) >= 20000 then
    raise exception 'Llegaste al tope de 20000 canciones y listas guardadas en tu cuenta.';
  end if;
  if tg_op = 'UPDATE' and new.cambiado < old.cambiado then return null; end if;
  if new.borrado then new.datos := null; end if;
  new.actualizado := clock_timestamp();
  return new;
end $$;
drop trigger if exists al_guardar on public.biblioteca;
create trigger al_guardar before insert or update on public.biblioteca for each row execute function public.al_guardar();

-- Con tres denuncias de cuentas distintas, se esconde hasta que el dueño la revise.
create or replace function public.al_denunciar() returns trigger
  language plpgsql security definer
  set search_path = ''
  as $$
begin
  if (select count(*) from public.denuncias where que = new.que and cual = new.cual and not resuelta) >= 3 then
    if new.que = 'cancion' then update public.canciones set oculta = true where id = new.cual;
    else update public.listas set oculta = true where id = new.cual;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists al_denunciar on public.denuncias;
create trigger al_denunciar after insert on public.denuncias for each row execute function public.al_denunciar();

-- Borrar la cuenta propia desde la app: se va el mail y, en cascada, el nombre, lo subido y las denuncias hechas.
create or replace function public.borrar_cuenta() returns void
  language sql security definer
  set search_path = ''
  as $$ delete from auth.users where id = auth.uid() $$;

-- (Supabase les da permiso a anon y authenticated sobre toda función nueva: hay que sacárselo a cada uno)
revoke all on function public.bajar(text, bigint), public.por_enlace(text), public.puede_subir(), public.borrar_cuenta() from public, anon, authenticated;
grant execute on function public.bajar(text, bigint), public.por_enlace(text) to anon, authenticated;
grant execute on function public.puede_subir(), public.borrar_cuenta() to authenticated;
