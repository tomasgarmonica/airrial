# Airrial: lista de mejoras

Lista de trabajo. El orden dentro de cada bloque es el sugerido.
Prioridad actual: primero la funcionalidad (bloques 1 a 3); el audio grabado depende de las
grabaciones (ver `GRABACION.md`).

## 1. Escritura
- [x] Editor por botones (acordes, modos, partes, repeticiones, casillas, anotaciones)
- [x] Deshacer y rehacer
- [x] Copiar y pegar un compás o una parte entera (también de una canción a otra)
- [x] Duplicar una canción (para hacer versiones)
- [x] Tonalidad por botones (nota, alteración, mayor o menor) en lugar de texto
- [x] Mover un compás (← →) o una parte entera (↑ ↓)
- [x] Dividir y Unir: el compás se parte en mitades (o como pida el compás, o en tres para un tresillo) hasta la semicorchea, para ubicar un acorde en un punto exacto. Reemplaza a "+ acorde" y "Alargar el anterior"
- [x] Sugerir la tonalidad a partir de los acordes escritos (el editor la propone y se acepta con un toque)
- [x] Cortes, paso 2: botón "Corte" sobre un acorde y la palabra "corte" chica debajo, en la hoja, el PDF y la imagen
- [x] Cortes, paso 3: sonido (golpe seco de toda la banda y silencio hasta el próximo acorde escrito; el metrónomo sigue)
- [x] Anticipación: un acorde marcado así queda escrito en su lugar y suena una corchea antes (atresillado en swing)
- [ ] Cortes y anticipaciones: escuchar cómo suenan en cada estilo y ajustarlos de oído
- [x] La anticipación queda ligada: el acorde y el bajo se sostienen y no se vuelven a atacar en el tiempo escrito
- [x] Anticipación de semicorchea: el botón "Anticipar" va pasando corchea → semicorchea → sin anticipar; se escribe `<<G7` y en la hoja dice "anticipa semi". En swing no se atresilla
- [x] Swing: un corte escrito en el "y" de un tiempo cae atresillado cuando el estilo es swing
- [x] Símbolos propios para Segno y Coda; Fine, D.C., D.S. y "al Coda" se muestran a la derecha del compás

## 2. Reproducción
- [x] Empezar a reproducir desde el compás que se toca
- [x] Repetir un tramo: toque largo en el primer compás y toque corto en el último
- [x] Final de tema: terminar en un acorde largo (necesita la tonalidad cargada)
- [x] Seguir sonando bien con la app en segundo plano
- [x] La reproducción sigue D.C., D.S., Fine y Coda (sin repeticiones después del salto)
- [x] Modo práctica: subir el tempo o cambiar de tono en cada vuelta (vale solo mientras suena; la hoja muestra el tono de la vuelta)
- [x] Silenciar instrumentos sueltos con un toque (el nombre del instrumento en la mezcla es el botón; el deslizador conserva su volumen)
- [x] Los compases en blanco no se tocan: sirven para acomodar la hoja (la casilla 2 debajo de la casilla 1). Los que siguen a un corte sí cuentan, como silencio
- [ ] Sumar la guitarra como otro instrumento armónico (ya se elige entre piano, Rhodes y CP-80)

## 3. Guardado y compartir
- [x] Compartir una canción por enlace (WhatsApp, mail) y abrirla directo en la app
- [x] Pedirle al navegador que no borre las canciones; aviso de hace cuánto fue la última copia
- [x] Enlaces de canción más cortos (comprimidos)
- [ ] Compartir "con enlace": la canción o lista se sube al servidor sin aparecer en el catálogo y se abre solo con un enlace corto (como un video no listado). Tres niveles: solo en mi celular / con enlace / pública. Definir vencimiento, cómo la borra quien la subió y qué pasa con denuncias
- [x] Importar canciones desde iReal Pro: Menú → Abrir un archivo reconoce el archivo de iReal (una canción o una lista entera, que entra con sus temas y su lista). Pasan partes, casillas, repeticiones, compás, anotaciones, Segno, Coda, Fine y D.C./D.S.; los acordes alternativos (los chiquitos de arriba) se descartan. Probado con una lista real de 30 temas
- [ ] iReal: los estilos que no son swing, bossa, samba y parecidos entran como Swing (por ejemplo "Latin"); afinar la tabla cuando aparezcan casos. Falta probar archivos en 3/4 y 6/8 verdaderos, y el formato viejo (`irealbook://`) no se lee
- [x] Importar desde Band-in-a-Box (.MGU y .SGU), 0.1.8: Menú → Abrir archivos (se pueden elegir varios a la vez). El formato no es público: se sigue lo descifrado por el módulo Data::BiaB. Trae título ("Título - Autor" se separa), acordes, tempo, tono (si los acordes dicen relativo menor, el menor), 3/4 si el estilo es de vals, y estilo por el nombre del .STY (vals, bossa, tango…; el resto, swing). Los compases antes del coro van como [Intro]; el final (lo que sigue al coro) y la melodía no se toman. Probado con 7 archivos reales del dueño (en `pruebas/`)
- [ ] Band-in-a-Box: falta que el dueño compare algunos temas con el original (sobre todo "A Ballad for a Jazz Festival", que trae 20 compases de introducción). En iPhone el selector de archivos podría no dejar elegir .MGU (no probado). Compartir un .MGU hacia Airrial desde otra app todavía no se reconoce. Los tipos de acorde que no están en la tabla se toman por familia (mayor, menor, dominante, sus)
- [ ] iReal: una Coda sin D.S. ni D.C. (en iReal se salta en la última vuelta) acá se toca de corrido en todas las vueltas
- [ ] Copia de seguridad automática y sincronización entre celular y PC (necesita servidor)
- [x] Mecanismo de canciones incluidas (`incluidas.json`): aparecen en Canciones con la marca "incluida", sin pestaña aparte
- [x] Compartir como archivo (además del enlace); Airrial aparece en el menú Compartir de Android para abrir archivos recibidos
- [x] Recibir en el celular con Compartir → Airrial: el dueño lo probó el 13 de octubre de 2026 con la lista de iReal y abrió bien
- [ ] Probar en celular real el envío de un archivo `.airrial.html` (compartir una canción propia y que otra persona la abra)
- [ ] Comunidad: secuencias subidas por usuarios. Solo cifrados (sin letra ni melodía), sin foro ni comentarios. Necesita servidor, cuentas, botón de denuncia y reglas contra spam y contenido violento. La app no trae canciones propias (decidido el 2026-10-09, por los posibles derechos): el repertorio llega por la comunidad
- [ ] Comunidad: destacar las canciones más completas o mejor puntuadas. Decidido el 14 de octubre de 2026: por cantidad de bajadas y fijadas por el dueño, sin estrellas ni votos. El diseño completo y las etapas están en `COMUNIDAD.md`
- [x] Comunidad, etapa 1 (14 de octubre de 2026): el dueño creó el proyecto en Supabase (`https://cbiavmaznmbhgfytkwbl.supabase.co`, región São Paulo, clave publishable `sb_publishable_CgTYhMa7dyD5XcLxNXY_yw_KnXerWnA`, que es pública) y corrió `servidor/comunidad.sql`. Revisado desde afuera: sin cuenta se leen canciones, listas, ritmos y artistas; no se puede subir ni leer denuncias. La contraseña de la base y la clave secreta las guarda el dueño y no van nunca al repositorio
- [ ] Comunidad, etapa 2 (bajar), en la rama `comunidad` sin publicar (pedido del dueño el 14 de octubre de 2026: no publicarla todavía). Hecho: botón Comunidad al lado de Canciones y Listas, recorrer por estilo y por artista, buscar, ver la hoja y "Guardar". Falta: que el dueño vuelva a correr `servidor/comunidad.sql` (se sumó la columna `artista`), cargar las primeras canciones (las escribe el dueño), escuchar una canción antes de guardarla (hoy se escucha después de guardar) y unir la rama a `main` cuando el dueño diga
- [ ] Comunidad, etapa 3 (cuentas y subir), también en la rama `comunidad`. Hecho: entrar con un código por mail (sin contraseña), elegir el nombre para mostrar y aceptar las reglas (resumidas en la app), "Subir a la Comunidad" en Compartir de una canción (si ya estaba subida igual no la duplica; si cambió, pregunta si reemplazarla), "Mis subidas" (abrir, borrar, cambiar el nombre, salir), y las anotaciones entre comillas con tope de 30 letras al subir. Falta: que el dueño ponga el código en el mail de Supabase (si no, llega un enlace en vez del número); por ahora los mails salen del servicio de Supabase, que solo manda a la cuenta del dueño y pocos por hora: para abrirlo a todos hace falta Resend; borrar la cuenta desde la app (lo promete la página de privacidad); revisar y terminar REGLAS.md y PRIVACIDAD.md y mostrarlas enteras; listas

## 4. Audio y pistas

**Sonidos grabados (hecho el 12 y 13 de octubre de 2026)**
- [x] La banda suena con grabaciones del dueño; lo que no cargue (o no esté grabado) suena sintetizado
- [x] Batería: bombo, redoblante, aro, hi-hat (cerrado, abierto, con el pie), ride suave, crash. Cargados y sin usar en patrones: redoblante agudo, toms, chancha, ride fuerte, campana del ride, segundo crash
- [x] Bajo, normal y fuerte, en todos los ritmos
- [x] Teclado por canción: piano, Rhodes o CP-80 (se elige desde el botón del teclado en la mezcla, que también lo silencia). Al compartir la canción no viaja
- [x] Percusión: tambores de candombe, bombo legüero, surdo, pandeiro, tamborim, congas, bongó, campana, cáscara, clave, güiros, maracas, cajón
- [x] Mezcla: percusión aparte de la batería, y "Volumen de cada instrumento" por ritmo en los ritmos con base (se guarda en el dispositivo)

**Bases de percusión escritas en MIDI por el dueño**
- [x] Candombe (tambores y batería), chacarera y zamba (bombo legüero; la zamba alterna cuatro variantes), samba (surdo, pandeiro, tamborim), son en clave 2-3 y 3-2 (con versión de abajo y de arriba, que se elige por parte tocando el nombre de la parte) y festejo
- [ ] Faltan las bases de: swing, shuffle, bossa, pop, balada, funk, reggae, bolero, tango, milonga, cumbia y vals. Siguen con el patrón escrito sin escuchar
- [ ] Los niveles de cada base se definen de oído a medida que se arma cada estilo: el dueño los prueba con "Volumen de cada instrumento" y pasa los valores, que se anotan en `AJUSTE` de `herramientas/bases.js`
- [ ] Variaciones: golpes de apoyo que suenen solo algunas veces (pista aparte en el MIDI) y frases de repique o remates que entren cada tantos compases. Conversado y aprobado, sin empezar. El mecanismo de alternar variantes ya existe (zamba)
- [ ] Candombe: los dos redoblantes suaves de la batería son apoyos; hoy suenan siempre

**Bajo y teclado**
- [ ] Swing: revisar el comping del piano y el bajo (lo notó el dueño el 13 de octubre de 2026 al escuchar la lista importada de iReal; falta que diga qué cambiar)
- [ ] Bajo y teclado desde MIDI, escritos sobre Do y trasladados a cada acorde. Conversado; el dueño eligió empezar solo por la percusión
- [ ] Bajo: usar las notas fantasma, el slap y el slap fantasma (ya cargados, falta escribir dónde van) y los slides (falta medir dónde llega la nota)
- [ ] Son y festejo: escuchar el bajo y el piano, escritos sin escuchar. En el son falta el montuno de piano
- [ ] Candombe: el teclado toca el acorde en el 1 y lo deja sonar (pedido por el dueño); se vuelve a tocar en cada compás

**Grabaciones para revisar o rehacer**
- [ ] Bajo: regrabar el Fa normal ("Bajo F3.wav", quedó un semitono y medio alto) y grabar el Si normal ("Bajo B2.wav", falta)
- [ ] CP-80 fuerte: las notas quedaron entre 10 y 24 centésimas altas respecto de las normales. Escuchar si molesta
- [ ] Ride suave: grabado muy bajo (picos a -38 dB) y guardado como `Batería/CampanaBoca.wav`. Si se le nota soplido, regrabar con más ganancia; conviene renombrarlo a `Ride suave.wav`
- [ ] Maraca "suave atrás": grabada muy baja (picos a -35 dB); regrabar si se va a usar
- [ ] Surdo "dedos": muy corto (0,08 s); el dueño dice que casi no se escucha pero que va bien
- [ ] Escobillas (giro, rápido, ataque): grabadas, sin cargar. El giro está muy bajo y el rápido trae dos golpes en un archivo
- [ ] Grabado sin cargar en la app (se suma cuando aparezca en una base): timbales, jam block, chacha, quijada, triángulo, pandeiro tapado y platinelas sueltas, golpes sueltos de conga, güiro de metal golpe y seco, guitarra
- [ ] Falta grabar: nada pedido por ahora (las maracas ya están; el bolero todavía usa las sintetizadas)

**Ritmos**
- [x] Ritmos: swing, shuffle, bossa, samba, pop, balada, funk, reggae, bolero, son (2-3 y 3-2), tango, milonga, candombe, cumbia, chacarera, zamba, festejo y vals
- [x] Los ritmos ternarios suenan también en compases de negras: festejo en 4/4 y 2/4, chacarera y zamba en 2/4
- [x] El tempo cuenta el pulso: la negra, o la negra con puntillo en 6/8, 9/8 y 12/8
- [ ] Chacarera y zamba en 4/4 (dos compases de 6/8 por compás): siguen en el acompañamiento genérico
- [ ] Revisar de oído cada ritmo sin base y corregir lo que no suene al género
- [ ] Bolero: pasar las maracas sintetizadas a las grabadas
- [ ] Más ritmos: salsa, chamamé, carnavalito/huayno, murga, vals peruano, afro 6/8
- [ ] Shuffle: que un corte o una anticipación en el "y" de un tiempo caiga atresillado, como en swing
- [ ] En un ritmo ternario tocado en 4/4, un acorde escrito en el "y" cae en la mitad exacta del tiempo, sin atresillar
- [x] Samba en 2/4: cada compás toca media base, alternando (la clave del tamborim ocupa dos compases); bajo y teclado hacen lo mismo que en 4/4, repartido
- [x] Las bases quedan alineadas con la hoja al reproducir desde cualquier compás (la clave del tamborim del samba en 2/4 no se corre al arrancar desde un compás par)
- [x] Cumbia en 2/4 (0.1.5): cada compás toca media base, alternando, y suena igual que en 4/4 (güiro, campana, bombo, conga, bajo y teclado). Falta que el dueño la escuche. Cuando se arme su base en MIDI tiene que seguir igual en los dos compases, como el samba
- [ ] Milonga en 2/4: a definir

## 5. Para tocar en vivo
- [x] Encabezado y panel de reproducción fijos; panel deslizable con estilo, vueltas y mezcla
- [x] Listas de temas con nombre y orden; se pasa de tema deslizando hacia los costados
- [x] La hoja no responde a los toques mientras suena la pista
- [x] Compartir una lista entera por enlace (o como archivo si es muy larga)
- [x] Reordenar la lista arrastrando
- [x] Buscador al elegir los temas de una lista
- [x] Los acordes se agrandan hasta ocupar el lugar que tienen en el compás (en pantalla, PDF e imagen)
- [x] Compases por renglón ajustables por canción (2 a 6), también en PDF e imagen
- [x] El % (repetir compás) está con los acordes y avanza solo al compás siguiente
- [x] Tamaño de la hoja ajustable (chico, normal, grande) al ver una canción: alto de los compases y tope de la letra
- [x] Otras formas de ver el cifrado: símbolos de jazz (△7, -7, ø), Do-Re-Mi y grados (I, IV, V), también en PDF e imagen
- [x] Exportar una canción a PDF o imagen (a tamaño hoja), y una lista entera a un solo PDF
- [x] El archivo para compartir es una página .html: muestra el título como enlace y el enlace lleva todo el contenido
- [x] Cartel de espera al generar imagen, PDF o archivo
- [x] Cartel para instalar la app cuando se usa desde el navegador (botón en Android, instrucción en iPhone)
- [x] Probado en Android: el archivo .html abre listas de hasta 1000 temas, y Airrial aparece en el menú Compartir tras reinstalar
- [x] Se quitó la opción de compartir como enlace suelto: queda Archivo, PDF e Imagen
- [x] Probado en iPhone: el archivo abre en Safari, pero lo guardado no pasa a la app instalada (son espacios separados)
- [x] iPhone: aviso al abrir algo compartido en Safari y botón "Abrir archivo recibido" en la app instalada
- [ ] iPhone: probar con un usuario real el camino Guardar en Archivos → Abrir archivo recibido
- [x] iPhone: pasar lo recibido de Safari a la app por el portapapeles (Copiar para la app → Pegar lo copiado)
- [ ] iPhone: probar con un usuario real el copiar y pegar
- [x] iPhone: llevar a la app TODO lo que alguien ya guardó en Safari antes de instalarla. En Safari, con canciones propias, aparece un cartel con "Copiar todo"; en la app instalada, "Pegar lo copiado" muestra cuántos temas y listas llegan y los guarda sin pisar ni duplicar
- [x] iPhone: sin sonido ni en Safari ni en Chrome (lo reportó un amigo del dueño el 14 de octubre de 2026). Desde la 0.1.7 la app pide sonar aunque el teléfono esté en silencio (iOS 17 en adelante) y despierta el audio cortado por una llamada; el mismo día confirmó que se escucha bien. Si aparece un iPhone con iOS anterior al 17 que solo suena con el silencio apagado, falta el truco para esos
- [ ] iPhone: probar "Copiar todo" con un iPhone real (se probó simulando el iPhone en la PC, con 300 temas; falta ver que Safari deje copiar)
- [x] Filtrar la biblioteca por género (y buscar por género escribiendo)
- [x] Borrar varias canciones a la vez desde la biblioteca (modo selección)
- [x] Etiquetas libres por canción (hasta 8), con filtro en la biblioteca, búsqueda por etiqueta y edición desde "Datos de la canción"
- [x] Etiquetas: renombrar o borrar una etiqueta en todas las canciones a la vez (Menú → Etiquetas; renombrar a una que ya existe las une)
- [x] Etiquetas, cuando son muchas (0.1.6, pedido del dueño): al editar se ven solo las de esa canción y las demás se suman desde "Agregar…"; en la biblioteca el filtro es un solo botón "Etiquetas" que abre la lista, con cuántos temas tiene cada una. Falta que el dueño lo pruebe con el dedo

## 6. Servidores, sistemas y seguridad
Hoy no hay servidor: la app son archivos fijos en GitHub Pages y cada canción vive en el teléfono de
quien la escribe. Eso es barato y seguro, pero casi todo lo de abajo aparece cuando haya cuentas o
catálogo público.

**Infraestructura**
- [x] Dominio propio: la app vive en https://airrial.ar (NIC Argentina → DNS en Cloudflare → GitHub Pages). La dirección vieja redirige
- [ ] Elegir servidor y base de datos para cuentas, sincronización y catálogo; estimar costo mensual
- [ ] Dónde alojar los sonidos grabados y cuánto pesan en el teléfono
- [x] Aviso cuando el teléfono no tiene lugar para guardar (cartel rojo hasta que se pueda); lo recibido que no entra no se guarda a medias
- [ ] Límite de espacio en el teléfono: medir cuántas canciones entran
- [x] Número de versión visible y recarga automática cuando hay una versión nueva
- [x] Pruebas automáticas en el proyecto (`node tests/todo.js`), que se corren antes de cada publicación
- [x] Pruebas automáticas de las pantallas: `tests/pantallas.html` maneja la app sola en un marco de 390 px (biblioteca, editor por botones, ver canción, listas, recibir un enlace, etiquetas, archivo de iReal) y avisa si algo se sale de la pantalla
- [ ] Pruebas de pantallas: sumar reproducción (necesita simular el audio), exportar a PDF e imagen, y el editor de texto

**Seguridad de los usuarios**
- [ ] Inicio de sesión sin guardar contraseñas propias (con Google o enlace por mail)
- [ ] Qué datos se guardan de cada persona, y que puedan bajarlos o borrarlos
- [ ] Política de privacidad y términos de uso
- [ ] Moderación y denuncias en el catálogo; límites contra spam y abuso
- [x] Revisar que una canción recibida por enlace o importada no pueda dañar la app de quien la abre (hecho el 13 de octubre de 2026: lo recibido se recorta, un cifrado o enlace armado para trabar la app ya no la cuelga, y nunca pisa lo que había: lo repetido entra como "Tema (2)")
- [x] Cartel rojo de falta de lugar a tamaño de celular: medido a 390 px en la PC (359 px de ancho, debajo del encabezado, sin tapar sus botones). No se vio en un teléfono real

**Seguridad del proyecto (la tuya)**
- [ ] Verificación en dos pasos en GitHub y en el mail asociado
- [ ] Copia del proyecto fuera de GitHub y de Google Drive
- [ ] Claves y contraseñas del servidor fuera del repositorio (que es público)
- [ ] Derechos de autor de las canciones que suban los usuarios: qué se permite y cómo se da de baja
- [ ] Licencia del código y de los sonidos grabados; registro del nombre
- [ ] Estadísticas de uso que respeten la privacidad
- [x] Contador de uso anónimo con GoatCounter (panel del dueño: airrial.goatcounter.com), desde la 0.1.1. Cuenta visitas (`/navegador` o `/instalada`) y acciones con nombre fijo: reproducir por ritmo, compartir, recibir, abrir archivo, escribir. Una vez por apertura y solo en airrial.ar; nunca títulos ni acordes (`tally` en `app.js`, prueba en `tests/contador.js`). No se carga el script de GoatCounter: la app manda el aviso sola. Falta que el dueño confirme que ve los números y que active "ignorar mi IP"; revisar la licencia gratuita cuando haya donaciones
- [x] Mezcla: silenciar con un toque cada instrumento de la base, por ritmo (0.1.2). Falta que el dueño lo pruebe de oído
- [x] Mezcla (0.1.4): tocar el nombre del teclado lo silencia, como a los demás; una flecha al lado abre la lista para elegir piano, Rhodes o CP-80. Los silenciados quedan solo tachados, sin el texto "silenciado". Falta que el dueño lo pruebe con el dedo
- [x] Botón "Contactanos" en el Menú (0.1.3): abre el formulario de Google del dueño ("Contacto Airrial", https://forms.gle/F6rjcZePUW9J3i3K8), para propuestas, preguntas y comentarios. Las respuestas le llegan a él en Google Forms
- [ ] Donaciones en formato "Invitame una birra", por MercadoPago y/o PayPal (pedido del dueño el 13 de octubre de 2026). Falta: crear los enlaces de cobro en cada servicio (los arma el dueño con sus cuentas), decidir dónde va el botón en la app y si el monto es fijo o libre. Por el orden de prioridades, va después de la Comunidad

## Problemas conocidos
- [x] El botón Atrás del teléfono sube un nivel, igual que la flecha de arriba
- [x] Salir del editor con cambios sin guardar (Cancelar o Atrás) ahora pregunta antes
- [x] Escribir cifrados en el celular: el dueño lo probó y "funciona bastante bien" (13 de octubre de 2026)
- [ ] Probar en celular real el sonido por el parlante
- [ ] En iPhone, un enlace compartido se abre en Safari y la canción queda ahí, no en la app instalada
