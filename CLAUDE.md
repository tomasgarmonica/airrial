# Airrial

App web instalable (PWA) para escribir cifrados de canciones y escucharlos con una banda de acompañamiento,
al estilo de iReal Pro. JavaScript puro, sin paso de compilación ni dependencias.

El dueño del proyecto es músico, no programador: hablarle en castellano rioplatense, sin jerga técnica,
y explicarle los pasos que le toquen de a uno.

## Dónde está cada cosa

- **Publicado en** https://airrial.ar (GitHub Pages desde `main`, raíz). Subir es `git push`.
- **Repositorio:** https://github.com/tomasgarmonica/airrial (público).
- **Dominio:** registrado en NIC Argentina, DNS en Cloudflare (cuatro registros A a GitHub y un CNAME `www`,
  con el proxy apagado). El archivo `CNAME` del repositorio mantiene el dominio conectado: no borrarlo.
- **Archivos:** `music.js` (lectura del cifrado, tiempos, saltos, tonalidad), `audio.js` (la banda: sonidos grabados y sintetizados,
  con Web Audio), `bases.js` (bases de percusión, generado), `export.js` (PDF e imagen), `app.js` (pantallas), `sw.js` (uso sin conexión),
  `incluidas.json` (canciones de ejemplo), `tests/` (pruebas), `PENDIENTES.md` (lo hecho y lo que falta),
  `GRABACION.md` (instructivo para grabar los sonidos).
- **Sonidos grabados:** los originales los graba el dueño y están en la carpeta `Audios` del Drive, fuera del
  proyecto (`Batería`, `Percu`, `Piano` con los tres teclados, `Bajo`, `Guitarra`; `Media` son las tomas crudas
  de Reaper). `node herramientas/sonidos.js "<carpeta Audios>"` arma con ellos los archivos livianos de
  `sonidos/`: un MP3 por grupo (batería, percusión, bajo y uno por teclado) con todos los sonidos en fila, más
  `indice.json` con el lugar de cada uno. Necesita `ffmpeg`. Para sumar un sonido: agregarlo a la lista de esa
  herramienta y correrla.
- **Bases de percusión:** el dueño las escribe en MIDI en `Audios/Midi` (`Base <ritmo>.mid`, con una pista
  "Percu" y otra "Batería"). `Notas bases.txt`, en esa carpeta, dice qué sonido es cada nota, con un bloque por
  pista ("Notas Percu", "Notas batería") que vale para todas las bases: **es del dueño, no editarlo**.
  `node herramientas/bases.js "<carpeta Audios>/Midi"` las pasa a `bases.js`. Arriba de esa herramienta están las
  tablas que hay que tocar a mano: `OTRO_NOMBRE` (sonidos que en la app se llaman distinto), `AJUSTE` (volúmenes
  pedidos de oído, por ritmo), `ALTERNAR` (bases cuyos compases son variantes), `PARTES` (bases con una versión
  por momento del tema, como el son) y `CORREGIR`.
- **La carpeta `Audios` cambia de ruta según la PC** (`G:/Mi unidad/Audios` o `G:/My Drive/Audios`).
- **Fuera de git:** `grabaciones/` y `pruebas/` (archivos de prueba generados).

## Sonidos y bases: cómo funciona

- **En la app:** `audio.js` baja los sonidos al abrir una canción (de los teclados, solo el de esa canción) y
  toca cada golpe o nota por su nombre (`shot`, y las notas de bajo y teclado corridas de altura). Si un sonido
  no está, toca el sintetizado. Un ritmo con base la usa para toda su percusión (`base()`); bajo y teclado
  siguen saliendo de los patrones escritos en `audio.js`.
- **Circuito con el dueño:** él graba o exporta al Drive y avisa; se corre la herramienta que corresponda, se
  prueba, se publica y se le cuenta qué se leyó (en una grilla) para que confirme. Si una base usa un sonido que
  la app no tiene, `bases.js` avisa cuál falta.
- **Volumen:** cada sonido se lleva a su máximo al prepararlo, así que dos golpes del mismo instrumento
  grabados a distinta fuerza ("suave" y "fuerte") quedan igual de fuertes: la diferencia se devuelve en
  `AJUSTE`. La intensidad de cada nota del MIDI es la fuerza del golpe. El dueño escucha todo parejo en Reaper
  (su sampler no responde a la intensidad), así que el equilibrio se termina de oído en la app.
- **Medir en lugar de escuchar:** no se puede oír, pero sí medir. Sirve revisar cada grabación nueva antes de
  usarla (nivel, saturación, afinación, si está cortada, si el nombre coincide con lo que suena) y avisarle lo
  que se encuentre.
- **Cuidado con el Drive:** el dueño suele estar editando sus archivos mientras se trabaja. Leerlos de nuevo
  justo antes de usarlos y no escribir en su carpeta `Audios`.

## Cómo se trabaja

- **De a una cosa por vez**, cada una con su commit. El dueño lo pidió expresamente después de que un
  reemplazo amplio borrara dos funciones.
- **Ediciones puntuales** sobre texto exacto que se haya leído antes. Nada de reemplazar "desde este
  marcador hasta aquel" sin mirar qué hay en el medio.
- **Antes de publicar:** `node tests/todo.js` tiene que terminar en "Todas las pruebas pasaron.".
  Al sumar lógica en `music.js`, agregar su prueba y el nombre de la función a la lista de `tests/todo.js`.
- **En cada publicación** sumar 1 al último número de `VERSION` en `app.js` (0.0.60 → 0.0.61; se muestra en la
  biblioteca como "beta 0.0.NN"). El número del medio pasa a 1 ("beta 0.1.x") cuando el dueño decida que la app
  está para compartir con gente que la pruebe: eso lo decide él.
  Si se agregan archivos a la app, sumarlos a `FILES` en `sw.js` y subir el número de `CACHE`.
- **Después del push**, esperar a que el sitio sirva la versión nueva antes de pedirle que pruebe:
  `curl -s https://airrial.ar/app.js | grep "const VERSION"`. GitHub tarda entre uno y varios minutos.
- **Commits** en castellano, con autor `tomasgarmonica <tomasgarmonica@users.noreply.github.com>` (para no
  exponer su mail en un repositorio público).
- **Las pantallas** se prueban a mano en el navegador, a 390 px de ancho, simulando toques. No se puede
  probar con el dedo ni escuchar el sonido: decirlo siempre al entregar, sin darlo por verificado.
- **Diseño dudoso:** preguntar antes de construir.
- **Al empezar en cualquier PC, primero `git pull`**: se trabaja desde dos computadoras. En la PC original la
  carpeta del proyecto está en el Drive y su historial de git afuera (`C:/Users/USUARIO/.airrial-git`); en la
  otra hay una copia bajada de GitHub en `C:/Users/huevo/dev/airrial`, y ahí la carpeta del Drive no sirve
  (no tiene historial). En una PC nueva: bajar una copia de GitHub a una carpeta local y trabajar ahí.
- **Editar con cuidado en la consola:** los textos con barras invertidas (expresiones regulares, saltos de
  línea) se rompen al pasarlos por un comando; conviene escribir el cambio en un archivo y ejecutarlo.

## Decisiones tomadas (no volver a discutirlas)

- **Solo acompañamiento.** Nada de melodías ni letras, ni siquiera como notas privadas.
- **Sin repertorio propio.** La app no trae canciones, por los posibles derechos. El repertorio queda para
  una futura Comunidad: solo secuencias de acordes subidas por usuarios, sin foro ni comentarios.
- **El nombre es Airrial.**
- **Se difunde de boca en boca** como app web. Tiendas, servidor y cuentas quedan para más adelante.
- **Compartir** es por archivo `.airrial.html` (una página cuyo botón lleva todo el contenido), más PDF e
  imagen. No hay opción de enlace suelto.
- **Sin pestaña de catálogo:** todo lo que haya aparece en Canciones, con filtros por género y etiqueta.
- **Editor por botones** como modo principal; el de texto es secundario.
- **Orden de prioridades:** terminar la app, después el audio grabado, después la Comunidad, y recién
  entonces donaciones.
- **Las bases las escribe el dueño en MIDI**, por ahora solo percusión y batería; bajo y teclado siguen con
  patrones de la app. Bases estables primero; las variaciones (apoyos, frases) quedan para después.
- **Los niveles de cada base se definen de oído** a medida que se arma cada estilo, no todos juntos.
- **Teclado por canción** (piano, Rhodes, CP-80), elegido desde su botón de la mezcla.
- **Volumen de cada instrumento: por instrumento** (no por golpe) **y por ritmo** (no por canción), guardado
  en el dispositivo de cada usuario.
- **Bases con versión de abajo y de arriba (son): se elige por parte**, tocando el nombre de la parte.
- **Un compás en blanco no se toca** (sirve para acomodar la hoja), salvo después de un corte.
- **El tempo cuenta el pulso:** la negra, o la negra con puntillo en 6/8, 9/8 y 12/8.

## Formato del cifrado (lo que se guarda)

Texto: compases separados por `|`, un renglón de texto por renglón de la hoja.

- Partes `[A]`, repetición `|:` … `:|` (`x3`), casillas `1.` `2.`, cambio de compás `3/4`, anotación `"Fine"`.
- `%` repite el compás anterior, `N.C.` es silencio de armonía, `_` es un lugar vacío. Un compás que solo
  tiene `_` está en blanco y la reproducción lo saltea (salvo después de un corte, donde es silencio).
- Compás dividido: entre llaves sobre una grilla pareja, donde `.` alarga el acorde anterior:
  `{ C . . . . . . G }` pone el G en el "y" del 4. Sin llaves vale la regla vieja (los acordes caen sobre
  los tiempos).
- `!` al final del acorde es un corte (golpe seco y silencio hasta el próximo acorde).
- `<` adelante del acorde es una anticipación (entra una corchea antes y queda ligado).
- Saltos por anotación: `Segno`, `Coda`, `Al Coda`, `Fine`, `D.C. …`, `D.S. …`.
