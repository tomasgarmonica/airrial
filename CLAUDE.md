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
- **Archivos:** `music.js` (lectura del cifrado, tiempos, saltos, tonalidad), `audio.js` (banda sintetizada
  con Web Audio), `export.js` (PDF e imagen), `app.js` (pantallas), `sw.js` (uso sin conexión),
  `incluidas.json` (canciones de ejemplo), `tests/` (pruebas), `PENDIENTES.md` (lo hecho y lo que falta),
  `GRABACION.md` (instructivo para grabar los sonidos).
- **Fuera de git:** `grabaciones/` (audios originales) y `pruebas/` (archivos de prueba generados).

## Cómo se trabaja

- **De a una cosa por vez**, cada una con su commit. El dueño lo pidió expresamente después de que un
  reemplazo amplio borrara dos funciones.
- **Ediciones puntuales** sobre texto exacto que se haya leído antes. Nada de reemplazar "desde este
  marcador hasta aquel" sin mirar qué hay en el medio.
- **Antes de publicar:** `node tests/todo.js` tiene que terminar en "Todas las pruebas pasaron.".
  Al sumar lógica en `music.js`, agregar su prueba y el nombre de la función a la lista de `tests/todo.js`.
- **En cada publicación** sumar 0.01 a `VERSION` en `app.js` (se muestra en la biblioteca como "beta 0.NN").
  Si se agregan archivos a la app, sumarlos a `FILES` en `sw.js` y subir el número de `CACHE`.
- **Después del push**, esperar a que el sitio sirva la versión nueva antes de pedirle que pruebe:
  `curl -s https://airrial.ar/app.js | grep "const VERSION"`. GitHub tarda entre uno y varios minutos.
- **Commits** en castellano, con autor `tomasgarmonica <tomasgarmonica@users.noreply.github.com>` (para no
  exponer su mail en un repositorio público).
- **Las pantallas** se prueban a mano en el navegador, a 390 px de ancho, simulando toques. No se puede
  probar con el dedo ni escuchar el sonido: decirlo siempre al entregar, sin darlo por verificado.
- **Diseño dudoso:** preguntar antes de construir.
- **En una PC nueva:** trabajar sobre una copia bajada de GitHub en una carpeta local, no sobre la carpeta
  del Drive (el historial de git de la PC original está fuera del Drive y no se comparte).

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

## Formato del cifrado (lo que se guarda)

Texto: compases separados por `|`, un renglón de texto por renglón de la hoja.

- Partes `[A]`, repetición `|:` … `:|` (`x3`), casillas `1.` `2.`, cambio de compás `3/4`, anotación `"Fine"`.
- `%` repite el compás anterior, `N.C.` es silencio de armonía, `_` es un lugar vacío.
- Compás dividido: entre llaves sobre una grilla pareja, donde `.` alarga el acorde anterior:
  `{ C . . . . . . G }` pone el G en el "y" del 4. Sin llaves vale la regla vieja (los acordes caen sobre
  los tiempos).
- `!` al final del acorde es un corte (golpe seco y silencio hasta el próximo acorde).
- `<` adelante del acorde es una anticipación (entra una corchea antes y queda ligado).
- Saltos por anotación: `Segno`, `Coda`, `Al Coda`, `Fine`, `D.C. …`, `D.S. …`.
