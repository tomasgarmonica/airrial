# Comunidad: diseño (borrador)

Borrador del 13 de octubre de 2026. El dueño lo aprobó el 14 de octubre de 2026 con las propuestas de
**Decidido** (abajo) y se empieza a construir por etapas.

## Qué es

Un lugar dentro de Airrial donde cualquiera puede **buscar y bajar** canciones y listas que subieron otros,
y **subir** las propias. Solo cifrados: sin letra, sin melodía, sin comentarios ni conversaciones (eso ya
estaba decidido; si al decir "foro" pensabas en que la gente pueda escribirse, hay que rediscutirlo, porque
cambia mucho el trabajo de moderación).

Lo que se baja queda guardado en el teléfono como cualquier otra canción y se puede usar sin conexión.
La Comunidad en sí necesita conexión; el resto de la app sigue andando igual sin ella.

## Cómo lo ve quien usa la app

**Entrar.** Un botón "Comunidad" en la pantalla principal, al lado de Canciones y Listas. No es un catálogo
metido en la biblioteca: es un buscador aparte, y lo que se baja aparece en Canciones como todo lo demás.

**Buscar.** Es un intercambio de archivos ordenado por estilo y por artista (pedido del dueño el 13 de
octubre de 2026). Arriba, un selector Canciones / Listas y un cuadro para escribir (título o artista). Abajo
se entra por dos caminos: **por estilo** (la lista de ritmos de la app, con cuántas canciones hay en cada uno)
o **por artista** (los nombres en orden alfabético, tomados del dato "Autor" de cada canción). Adentro de un
estilo o de un artista se ordena por "más bajadas" o "más nuevas". Cada renglón muestra título, autor, estilo,
tonalidad y compás, quién la subió y cuántas veces se bajó.

El mismo artista puede quedar escrito de varias maneras ("Jobim", "A. C. Jobim", "Tom Jobim"). Al subir, la
app propone los nombres que ya existen mientras se escribe, para que se junten; los que igual queden
duplicados los puede unir el dueño. Las listas no tienen artista: se buscan por nombre y, si se quiere, por
un estilo que elige quien la sube.

**Mirar antes de bajar.** Al tocar una canción se abre la hoja, igual que una propia, y se puede escuchar.
Abajo: "Guardar en mis canciones" y "Denunciar". Guardar usa el mismo mecanismo que hoy recibe un archivo:
nunca pisa nada, y si ya la tenías igual no la duplica.

**Subir.** En el menú Compartir de una canción o de una lista aparece "Subir a la Comunidad". La primera vez
pide entrar con una cuenta, elegir un nombre para mostrar y aceptar las reglas. Después es un toque.

**Mis subidas.** Una pantalla con lo que subiste, para actualizarlo o borrarlo.

**Para bajar no hace falta cuenta. Para subir, sí.** Así el que solo quiere repertorio no tiene que
registrarse, y el que sube queda identificado (es lo que permite frenar el spam).

## Qué se guarda de cada cosa

- **De una canción:** título, compositor, género, compás, tonalidad, tempo, el cifrado y los compases por
  renglón. Lo mismo que viaja hoy en un archivo compartido. No viajan las etiquetas personales ni el teclado
  elegido ni los volúmenes: eso es de cada uno.
- **De una lista:** el nombre y una copia de sus canciones adentro, en orden (como el archivo de lista de
  hoy). Es una foto del momento: si después cambiás una canción, la lista subida no cambia sola.
- **De una persona:** el mail (lo guarda Supabase para la cuenta; nadie más lo ve) y el nombre que eligió
  mostrar. Nada más.
- **Contadores:** cuántas veces se bajó cada cosa. No quién.

Una misma canción puede estar subida muchas veces por gente distinta (versiones, tonos, errores). No se
intenta unificarlas: se ven todas, y las más bajadas quedan arriba.

## Reglas y cuidado

- **Solo cifrados.** El formato casi no deja lugar para letra, salvo las anotaciones entre comillas
  ("Fine", "Solo de piano"). Las anotaciones no tienen tope de largo: el 15 de octubre de 2026 el dueño lo sacó,
  porque una letra no entra en la forma de un cifrado y las anotaciones sirven para otras cosas.
- **Límites por cuenta:** un tope de subidas por día (propuesta: 30 canciones y 5 listas) y de tamaño
  (los mismos que ya usa la app al recibir un archivo: 200 letras de título, listas de hasta 2000 temas, subido desde 300 el 15 de octubre de 2026).
  Los controla el servidor, no la app, así no se pueden saltear.
- **Denunciar:** cualquiera con cuenta puede denunciar algo, eligiendo un motivo (spam, contenido ofensivo,
  tiene letra o melodía, derechos de autor, otro). Si tres cuentas distintas denuncian lo mismo, se esconde
  solo hasta que lo revises.
- **Moderar:** al principio lo hacés vos desde la página de Supabase, que muestra las tablas como una planilla:
  ves las denuncias, escondés o borrás, y podés bloquear una cuenta. Una pantalla de moderación dentro de la
  app se hace más adelante, si el volumen lo pide.
- **Derechos de autor:** una secuencia de acordes con su título es lo mismo que publica cualquier cancionero
  de cifrados; el riesgo es bajo pero no es cero. Hace falta un camino claro para pedir una baja (el motivo
  "derechos de autor" de la denuncia y el formulario de Contactanos) y bajarla rápido cuando llegue un pedido.
- **Antes de abrir las subidas al público** tienen que existir dos páginas cortas: reglas de la Comunidad
  (qué se puede subir) y privacidad (qué se guarda y cómo borrar la cuenta). Las puedo redactar yo para que
  las revises; no reemplazan a un abogado.
- **Borrar la cuenta** borra también todo lo que esa persona subió.

## Decidido

El 14 de octubre de 2026 el dueño confirmó: **solo cifrados, sin comentarios** (al decir "foro" hablaba de
esto); el botón **"Comunidad" va en la pantalla principal**; la cuenta se entra con **código por mail**; y para
el resto (2 a 5) **va lo propuesto**. Abajo, cada punto con lo que se había planteado.

1. **Cómo se entra a la cuenta.**
   - *Código por mail* (propuesta): escribís tu mail, te llega un número de 6 cifras y lo ponés en la app.
     Anda igual en Android, en iPhone y en la app instalada, sin salir a otra ventana. Necesita un servicio
     que mande los mails (Resend, gratis hasta unos 3000 por mes) y agregar unos registros en Cloudflare.
   - *Botón de Google:* más cómodo en Android, pero en la app instalada del iPhone salta al navegador y puede
     repetir el problema que ya tuvimos de Safari por un lado y la app por otro. Además hay que configurarlo
     en la consola de Google. Se puede sumar después como segunda opción.
2. **Cómo se destaca lo bueno.** Propuesta: ordenar por cantidad de bajadas y que vos puedas "fijar" arriba
   las que te parezcan mejores. Sin estrellas ni votos por ahora (dan trabajo y se prestan a trampas).
3. **"Con enlace" desde el principio.** Estaba anotado en Pendientes: subir algo que no aparece en el
   buscador y se abre solo con un enlace corto (como un video no listado). Con esta estructura sale casi
   gratis. Propuesta: incluirlo, pero como última etapa.
4. **Las listas, ¿como foto o enlazadas?** Propuesta: como foto (la lista lleva su copia de las canciones).
   Es más simple y no se rompe si alguien borra una canción. La contra: las canciones de adentro de una lista
   no aparecen sueltas en el buscador, salvo que quien la sube también las suba una por una.
5. **Nombre para mostrar:** ¿libre (cada uno pone lo que quiere, con un filtro básico) o no se muestra quién
   subió? Propuesta: libre, hasta 30 letras, y se puede cambiar.
6. **El botón "Comunidad" en la pantalla principal.** Hay una decisión anterior de no tener pestaña de
   catálogo. Esto no es lo mismo (no mezcla canciones ajenas en tu biblioteca), pero suma un tercer botón
   arriba. La alternativa es ponerlo en el Menú, más escondido.

## En qué orden se construye

Cada etapa se publica y se prueba antes de pasar a la siguiente.

1. **Vos creás el proyecto en Supabase** (te paso los pasos de a uno) y yo te doy el texto para pegar que
   arma las tablas y las reglas.
2. **Bajar.** La pantalla Comunidad, solo para buscar, mirar y guardar. Sin cuentas todavía: las primeras
   canciones las cargamos nosotros. Ya sirve para que los que prueban la beta la vean.
3. **Cuentas y subir canciones**, con "Mis subidas". Antes de publicarla: las páginas de reglas y privacidad.
4. **Denuncias y límites.**
5. **Listas.**
6. **Con enlace.**

## Costo y riesgos

- **Supabase gratis** alcanza de sobra para empezar: una canción ocupa menos de 1 KB, y el plan gratuito
  trae unos 500 MB (cientos de miles de canciones). Los números exactos del plan hay que mirarlos el día
  que se cree el proyecto, porque los cambian.
- **El plan gratuito pausa el proyecto si pasa una semana sin uso.** Con gente usándolo no pasa; si pasara,
  se reactiva a mano desde la página de Supabase.
- **El plan gratuito no hace copias de seguridad.** Conviene una herramienta nuestra que baje todo a un
  archivo, para correr cada tanto.
- **Si Supabase se cae o se pausa,** la Comunidad no abre, pero la app y las canciones de cada uno siguen
  andando: nada de lo guardado en el teléfono depende del servidor.
- **Si algún día hay que mudarse** a otro servicio, los datos son tablas comunes y se llevan enteros.

## Notas técnicas (para quien programe)

- **El servidor está escrito en `servidor/comunidad.sql`** (tablas, reglas por fila, funciones y disparadores
  de todas las etapas). Se pega entero en el SQL Editor de Supabase y se puede volver a correr. Su prueba,
  `servidor/probar.mjs`, lo corre en un Postgres local y revisa las reglas (quién ve, sube, cambia y borra).

- **Sin dependencias:** la app habla con Supabase por `fetch` a su API (PostgREST y Auth), sin sumar la
  librería. El código de la Comunidad va en un archivo aparte (`comunidad.js`), sumado a `FILES` en `sw.js`.
  El service worker no tiene que guardar las respuestas de Supabase.
- **Claves:** la clave pública ("publishable"/"anon") va en el código y puede estar en el repositorio: está
  pensada para eso, y lo que protege los datos son las reglas por fila (RLS). La clave secreta
  ("service_role") no se pega nunca en el repositorio ni en la app.
- **Tablas (borrador):**
  - `perfiles`: `id` (el de la cuenta), `nombre`, `creado`, `bloqueado`.
  - `canciones`: `id`, `autor`, `titulo`, `compositor`, `ritmo`, `compas`, `tonalidad`, `tempo`, `cifrado`,
    `cols`, `visibilidad` (`publica` | `enlace`), `codigo` (para el enlace corto), `oculta`, `fijada`,
    `bajadas`, `creado`, `actualizado`. Con los mismos topes que `cleanSong` en `app.js`, como restricciones
    de la tabla.
  - `listas`: `id`, `autor`, `nombre`, `canciones` (jsonb: las filas, como `songRow`), `cantidad`,
    `visibilidad`, `codigo`, `oculta`, `fijada`, `bajadas`, `creado`, `actualizado`.
  - `denuncias`: `id`, `que` (`cancion` | `lista`), `cual`, `quien`, `motivo`, `detalle`, `creado`,
    `resuelta`. Una por cuenta y por cosa.
- **Reglas por fila:** leer lo público y no oculto, cualquiera; crear, con cuenta no bloqueada y `autor` igual
  a la propia; cambiar y borrar, solo lo propio (sin poder tocar `oculta`, `fijada` ni `bajadas`).
  Las denuncias se pueden crear y no se pueden leer.
- **Funciones en el servidor:** `bajar(id)` suma uno al contador; `por_enlace(codigo)` devuelve lo no listado
  (así no se puede listar, solo abrir sabiendo el código); un disparador cuenta las subidas del día y otro
  esconde lo que junta tres denuncias.
- **Búsqueda:** índice de texto sobre título y compositor, sin distinguir acentos ni mayúsculas.
- **Lo que llega del servidor pasa por `cleanSong`** antes de mostrarse o guardarse, igual que un archivo
  recibido: el servidor no se da por confiable.
- **Sesión:** si se entra con código por mail no hay redirecciones, así que no choca con las rutas `#/` de
  la app. Con Google habría que usar el flujo que vuelve con `?code=` y no con `#`.
- **Contador de uso:** sumar a `tally` los nombres fijos "Comunidad: abrir", "bajar" y "subir".
- **Pruebas:** la lógica que arma y valida lo que se sube va en `music.js` o en funciones puras con su prueba
  en `tests/`; la pantalla, en `tests/pantallas.html` con un servidor simulado.
