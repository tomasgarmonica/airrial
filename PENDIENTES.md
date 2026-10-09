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
- [ ] Mover compases o partes de lugar
- [ ] Repartir los tiempos de un compás de forma desigual con un control propio (hoy: "Alargar el anterior")
- [ ] Sugerir la tonalidad a partir de los acordes escritos
- [ ] Símbolos propios para Segno y Coda en lugar de texto

## 2. Reproducción
- [x] Empezar a reproducir desde el compás que se toca
- [x] Repetir un tramo: toque largo en el primer compás y toque corto en el último
- [x] Final de tema: terminar en un acorde largo (necesita la tonalidad cargada)
- [x] Seguir sonando bien con la app en segundo plano
- [ ] Que la reproducción siga D.C., D.S. y Coda
- [ ] Modo práctica: subir el tempo o cambiar de tono en cada vuelta
- [ ] Silenciar instrumentos sueltos con un toque
- [ ] Elegir instrumento armónico (piano o guitarra)

## 3. Guardado y compartir
- [x] Compartir una canción por enlace (WhatsApp, mail) y abrirla directo en la app
- [x] Pedirle al navegador que no borre las canciones; aviso de hace cuánto fue la última copia
- [x] Enlaces de canción más cortos (comprimidos)
- [ ] Compartir "con enlace": la canción o lista se sube al servidor sin aparecer en el catálogo y se abre solo con un enlace corto (como un video no listado). Tres niveles: solo en mi celular / con enlace / pública. Definir vencimiento, cómo la borra quien la subió y qué pasa con denuncias
- [ ] Importar canciones desde iReal Pro
- [ ] Copia de seguridad automática y sincronización entre celular y PC (necesita servidor)
- [x] Mecanismo de canciones incluidas (`incluidas.json`): aparecen en Canciones con la marca "incluida", sin pestaña aparte
- [ ] Cargar la selección inicial: armar en la app una lista llamada "Iniciales", exportar y dejar el archivo en la carpeta
- [ ] Enlace corto para las canciones incluidas
- [x] Compartir como archivo (además del enlace); Airrial aparece en el menú Compartir de Android para abrir archivos recibidos
- [ ] Probar en celular real el archivo compartido: enviar, y recibir con Compartir → Airrial
- [ ] Comunidad: secuencias subidas por usuarios, separadas del catálogo curado. Solo cifrados (sin letra ni melodía), sin foro ni comentarios. Necesita servidor, cuentas, botón de denuncia y reglas contra spam y contenido violento

## 4. Audio y pistas
- [ ] Instrumentos grabados en lugar de sonidos sintetizados (ver `GRABACION.md`)
- [ ] Patrones más musicales por estilo, con variaciones y remates al final de cada parte
- [x] Ritmos nuevos: samba, tango, milonga, candombe, cumbia, chacarera, zamba y vals (falta afinarlos de oído)
- [ ] Revisar de oído cada ritmo nuevo y corregir lo que no suene al género
- [ ] Más ritmos: blues/shuffle, funk, reggae, bolero, salsa/son, chamamé, carnavalito/huayno, murga, vals peruano, afro 6/8
- [ ] Milonga, samba y cumbia en 2/4 (hoy solo en 4/4)

## 5. Para tocar en vivo
- [x] Encabezado y panel de reproducción fijos; panel deslizable con estilo, vueltas y mezcla
- [x] Listas de temas con nombre y orden; se pasa de tema deslizando hacia los costados
- [x] La hoja no responde a los toques mientras suena la pista
- [x] Compartir una lista entera por enlace (o como archivo si es muy larga)
- [x] Reordenar la lista arrastrando
- [x] Buscador al elegir los temas de una lista
- [ ] Tamaño de letra y cantidad de compases por renglón ajustables
- [ ] Notas por tema (letra, forma, indicaciones)
- [ ] Otras formas de ver el cifrado: símbolos de jazz (△7, -7, ø), Do-Re-Mi, grados (I, IV, V)
- [x] Exportar una canción a PDF o imagen (a tamaño hoja), y una lista entera a un solo PDF
- [x] El archivo para compartir es una página .html: muestra el título como enlace y el enlace lleva todo el contenido
- [ ] Probar en celulares reales cómo se abre el .html recibido (Android e iPhone) y hasta qué tamaño de lista funciona el enlace
- [x] Filtrar la biblioteca por género (y buscar por género escribiendo)
- [ ] Carpetas o etiquetas en la biblioteca

## 6. Servidores, sistemas y seguridad
Hoy no hay servidor: la app son archivos fijos en GitHub Pages y cada canción vive en el teléfono de
quien la escribe. Eso es barato y seguro, pero casi todo lo de abajo aparece cuando haya cuentas o
catálogo público.

**Infraestructura**
- [x] Dominio propio: la app vive en https://airrial.ar (NIC Argentina → DNS en Cloudflare → GitHub Pages). La dirección vieja redirige
- [ ] Elegir servidor y base de datos para cuentas, sincronización y catálogo; estimar costo mensual
- [ ] Dónde alojar los sonidos grabados y cuánto pesan en el teléfono
- [ ] Límite de espacio en el teléfono: cuántas canciones entran y qué pasa cuando se llena
- [x] Número de versión visible y recarga automática cuando hay una versión nueva
- [ ] Pruebas automáticas antes de publicar, para no romper lo que ya anda

**Seguridad de los usuarios**
- [ ] Inicio de sesión sin guardar contraseñas propias (con Google o enlace por mail)
- [ ] Qué datos se guardan de cada persona, y que puedan bajarlos o borrarlos
- [ ] Política de privacidad y términos de uso
- [ ] Moderación y denuncias en el catálogo; límites contra spam y abuso
- [ ] Revisar que una canción recibida por enlace o importada no pueda dañar la app de quien la abre

**Seguridad del proyecto (la tuya)**
- [ ] Verificación en dos pasos en GitHub y en el mail asociado
- [ ] Copia del proyecto fuera de GitHub y de Google Drive
- [ ] Claves y contraseñas del servidor fuera del repositorio (que es público)
- [ ] Derechos de autor de las canciones que suban los usuarios: qué se permite y cómo se da de baja
- [ ] Licencia del código y de los sonidos grabados; registro del nombre
- [ ] Estadísticas de uso que respeten la privacidad
- [ ] Botón de donaciones (falta definir servicio y enlace)

## Problemas conocidos
- [x] El botón Atrás del teléfono sube un nivel, igual que la flecha de arriba
- [ ] Salir del editor con cambios sin guardar (Cancelar o Atrás) los descarta sin preguntar
- [ ] Probar en celular real: lectura del cifrado, tamaño de los botones del editor y sonido por el parlante
- [ ] En iPhone, un enlace compartido se abre en Safari y la canción queda ahí, no en la app instalada
