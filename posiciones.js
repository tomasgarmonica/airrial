// Posiciones de piano (voicings) para Swing, Bossa y Balada, escritas sobre Do. Lo genera
// herramientas/posiciones.js a partir de los MIDI: no editar a mano. Cada una: nombre y notas MIDI.
const POSICIONES = [
  {"name":"C13","notes":[52,58,62,69]},
  {"name":"C6","notes":[64,67,69,74]},
  {"name":"C7(#11)","notes":[52,58,62,66]},
  {"name":"C7(#9)","notes":[52,58,63,67]},
  {"name":"C7(9)","notes":[52,58,62,67]},
  {"name":"C7(b9)","notes":[52,58,61,67]},
  {"name":"C7(b9b13)","notes":[52,58,63,68]},
  {"name":"C7sus4","notes":[60,62,65,70]},
  {"name":"Cdim7","notes":[60,63,66,69]},
  {"name":"Cm(maj7)","notes":[60,63,67,71]},
  {"name":"Cm6","notes":[63,67,69,74]},
  {"name":"Cm7(b5)","notes":[60,63,66,70]},
  {"name":"Cm7","notes":[55,58,62,63,67]},
  {"name":"Cmaj7(#11)","notes":[52,55,59,62,66]},
  {"name":"Cmaj7","notes":[64,67,71,74]},
];
if (typeof module !== 'undefined') module.exports = POSICIONES;
