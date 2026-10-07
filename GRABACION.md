# Instructivo para grabar los sonidos de Airrial

## Cómo suena la app (y por qué importa para grabar)

La app no reproduce pistas grabadas. Funciona con la misma idea que el MIDI: a partir del cifrado
calcula qué nota toca cada instrumento, en qué momento, cuánto dura y con qué fuerza, y dispara un
sonido por cada nota. No usa archivos ni cables MIDI: esa "partitura" la genera sola.

Por eso lo que hay que grabar **no son bases ni loops**, sino **notas y golpes sueltos**. Con esas
notas la app arma cualquier acorde, en cualquier tono y a cualquier tempo.

## Qué grabar

### Bajo (contrabajo o bajo eléctrico)
- 10 notas, una cada tercera menor: **E1, G1, A#1, C#2, E2, G2, A#2, C#3, E3, G3**.
  Las notas intermedias las obtiene la app subiendo o bajando un semitono.
- Tocadas con el dedo, dejando sonar unos 3 segundos.
- Dos intensidades: media y fuerte.
- Opcional: una nota muerta (apagada) y un glissando corto, para darle vida al walking.

### Piano o teclado
- 13 notas, una cada tercera menor entre C3 y C6:
  **C3, D#3, F#3, A3, C4, D#4, F#4, A4, C5, D#5, F#5, A5, C6**.
- Dejando sonar unos 5 segundos, sin pedal.
- Dos intensidades: suave y media-fuerte.

### Guitarra (opcional, como alternativa al piano)
- 13 notas, una cada tercera menor entre E2 y E5:
  **E2, G2, A#2, C#3, E3, G3, A#3, C#4, E4, G4, A#4, C#5, E5**.
- Dejando sonar unos 4 segundos. Dos intensidades.

### Batería
Un golpe por archivo, dejando que el sonido se apague solo.

| Pieza | Variantes |
|---|---|
| Bombo | suave, fuerte |
| Redoblante | suave, medio, fuerte, y una nota fantasma |
| Aro (cross-stick) | medio |
| Hi-hat cerrado | suave, medio, fuerte |
| Hi-hat abierto | medio |
| Hi-hat con el pie | medio |
| Ride (cuerpo) | suave, medio |
| Ride (campana) | medio |
| Crash | medio |
| Toms (agudo, medio, de piso) | medio |
| Escobillas: arrastre y golpe | medio (para swing y baladas) |

De hi-hat cerrado, redoblante y ride conviene grabar **3 tomas de cada intensidad**: la app las va
alternando y así no suena a máquina.

### Percusión para ritmos de acá (cuando lleguemos a esa parte)
Bombo legüero (parche y aro), shaker, clave, cencerro, güiro, congas (abierto y tapado), cajón.

## Cómo grabar

- **Formato:** WAV, 44.1 o 48 kHz, 24 bits. Bajo en mono; piano y batería pueden ir en estéreo.
- **Sin efectos:** sin reverb, sin compresión fuerte y sin limitador. Eso se puede agregar después;
  sacarlo, no.
- **Nivel:** que los picos queden cerca de -6 dB y nunca saturen.
- **Parejo:** mismo micrófono, misma posición y misma ganancia para todas las notas de un instrumento.
  Si una nota queda más fuerte que la vecina, se nota al tocar un acorde.
- **Afinación:** La = 440 Hz. Conviene revisar con afinador antes de cada nota del bajo.
- **Silencio:** grabar en el lugar más silencioso posible y dejar un segundo de aire antes y después
  de cada nota. El recorte fino lo hago yo.
- **Una nota por archivo.** Si resulta más cómodo grabar todo de corrido en un solo archivo, también
  sirve: dejá un par de segundos de silencio entre notas y anotá el orden.

## Cómo nombrar los archivos

`instrumento_nota_intensidad_toma.wav`, todo en minúscula y sin espacios. La intensidad va como
`s` (suave), `m` (media) o `f` (fuerte). La toma solo hace falta si hay más de una.

Ejemplos:

```
bajo_e1_m.wav
bajo_a#1_f.wav
piano_c4_s.wav
guitarra_g3_m.wav
bateria_bombo_f.wav
bateria_hihat-cerrado_m_2.wav
bateria_ride-campana_m.wav
```

Guardalos en una carpeta `G:\My Drive\Airrial\grabaciones\` (no se sube al sitio: yo armo desde ahí
las versiones livianas que usa la app).

## Si en vez de grabar usás instrumentos virtuales

Se puede generar todo esto con un instrumento virtual disparado por MIDI y exportar cada nota. Antes
de hacerlo hay que revisar la licencia: muchas librerías de sonidos prohíben redistribuir sus notas
sueltas, que es exactamente lo que haría la app. Grabaciones propias no tienen ese problema.

## Por dónde empezar

Lo mínimo para escuchar la diferencia: **las 10 notas del bajo en una intensidad, y bombo,
redoblante, hi-hat cerrado y ride**. Con eso ya puedo conectar los sonidos a la app y ajustamos el
resto con algo real para escuchar.

Peso total estimado en la app, ya comprimido: entre 5 y 10 MB.
