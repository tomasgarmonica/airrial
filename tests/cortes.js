// Cortes: golpe seco de toda la banda en el acorde marcado y silencio hasta el próximo acorde escrito.
// La claqueta es lo único que sigue.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const dir = process.argv[2];
const Music = require(path.join(dir, 'music.js'));

// AudioContext simulado: anota cada sonido que arranca (oscilador o ruido), con su frecuencia y su momento.
let now = 0;
const sounds = [];
const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = kind => {
  const n = { kind, type: '', gain: param(), frequency: param(), Q: param(), connect() {}, disconnect() {}, stop() {} };
  n.start = t => sounds.push({ kind, f: n.frequency.value, t });
  return n;
};
class Ctx {
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
  get currentTime() { return now; }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createGain() { return node('gain'); }
  createOscillator() { return node('osc'); }
  createBufferSource() { return node('noise'); }
  createBiquadFilter() { return node('filter'); }
  createDynamicsCompressor() { return node('comp'); }
  resume() {}
}
let tickFn = null;
const sandbox = { window: { AudioContext: Ctx }, document: { hidden: false }, setInterval: f => { tickFn = f; return 1; }, clearInterval() { tickFn = null; },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout() {}, Math, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, 'audio.js'), 'utf8') + '\nthis.Engine = Engine;', sandbox);
const Engine = sandbox.Engine;

const T0 = 0.1;                                   // el motor arranca una décima después de "ahora"
const isClick = s => s.kind === 'osc' && (s.f === 1760 || s.f === 1175);
function play(chart, style, ts = [4, 4], extra = {}) {
  const bars = Music.parseChart(chart, ts);
  sounds.length = 0;
  now = 0;
  let ended = false;
  Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 0), getTempo: () => 120, style, choruses: 1, countIn: false,
    onBar() {}, onEnd: () => { ended = true; }, ...extra });
  for (let k = 0; k < 40000 && tickFn; k++) { now += 0.01; tickFn(); }
  assert(ended, 'la reproducción tiene que terminar');
  const band = sounds.filter(s => !isClick(s)), clicks = sounds.filter(isClick);
  const between = (list, a, b) => list.filter(s => s.t > T0 + a + 1e-3 && s.t < T0 + b - 1e-3).length;
  const at = (list, a) => list.filter(s => Math.abs(s.t - T0 - a) < 1e-3).length;
  return { band: (a, b) => between(band, a, b), hit: a => at(band, a), clicks: (a, b) => between(clicks, a, b) };
}

// A 120, un compás de 4/4 dura 2 segundos y cada tiempo medio segundo.
const STYLES = ['swing', 'shuffle', 'bossa', 'samba', 'pop', 'balada', 'funk', 'reggae', 'bolero', 'tango', 'milonga', 'candombe', 'cumbia'];

// 1) corte en el "y" del 4, un compás vacío, y vuelve en el compás siguiente
for (const style of STYLES) {
  const swing = style === 'swing' || style === 'shuffle', cut = 2 + (swing ? 3 + 2 / 3 : 3.5) * 0.5;
  const r = play('| C | { F . . . . . . G! } | _ | Am |', style);
  assert(r.band(2, cut) > 3, style + ': antes del corte la banda toca');
  assert(r.hit(cut) >= 4, style + ': en el corte suena el golpe de toda la banda');
  assert.equal(r.band(cut, 6), 0, style + ': después del corte hay silencio hasta el próximo acorde');
  assert.equal(r.clicks(cut, 6), 4, style + ': la claqueta sigue durante el silencio');
  assert(r.band(6 - 0.01, 8) > 3, style + ': con el acorde siguiente la banda vuelve');
}

// 2) corte en el primer tiempo: el resto del compás en silencio
let r = play('| C | G! | Am |', 'pop');
assert(r.hit(2) >= 4); assert.equal(r.band(2, 4), 0); assert(r.band(4 - 0.01, 6) > 3);

// 3) varios cortes seguidos (un obligado): solo suenan los golpes
r = play('| { C! . C! . . . G! . } | Am |', 'pop');
for (const t of [0, 0.5, 1.5]) assert(r.hit(t) >= 4, 'golpe en ' + t);
assert.equal(r.band(0, 0.5) + r.band(0.5, 1.5) + r.band(1.5, 2), 0, 'entre golpes, silencio');

// 4) el % repite también el corte
r = play('| G! | % | Am |', 'bossa');
assert(r.hit(0) >= 4); assert(r.hit(2) >= 4); assert.equal(r.band(0, 2) + r.band(2, 4), 0);

// 5) si el tema termina en un corte, no se agrega el acorde final
r = play('| C | G! |', 'pop', [4, 4], { finalChord: { root: 0, bass: 0, iv: [4, 7] } });
assert(r.hit(2) >= 4); assert.equal(r.band(2, 60), 0);
// ...y sin corte, el acorde final sigue estando
r = play('| C | G |', 'pop', [4, 4], { finalChord: { root: 0, bass: 0, iv: [4, 7] } });
assert(r.hit(4) >= 3, 'acorde final');

// 6) en 6/8 (cada corchea dura un cuarto de segundo a 120)
for (const style of ['chacarera', 'zamba']) {
  r = play('| Am | { E7 . . Am! . . } | Am |', style, [6, 8]);
  assert(r.hit(1.5 + 0.75) >= 4, style); assert.equal(r.band(2.25, 3), 0, style); assert(r.band(3 - 0.01, 4.5) > 3, style);
}
// 7) vals en 3/4, corte en el tiempo 3
r = play('| Am | { Dm . E7! } | Am |', 'vals', [3, 4]);
assert(r.hit(1.5 + 1) >= 4); assert.equal(r.band(2.5, 3), 0);

// 8) solo metrónomo: no hay banda, la claqueta no cambia
r = play('| C | G! | Am |', 'click');
assert.equal(r.band(0, 6), 0); assert.equal(r.clicks(-0.01, 6), 12);

// 9) sin cortes nada cambia: ningún compás queda en silencio
r = play('| C | F G | Am | Dm |', 'pop');
for (let b = 0; b < 4; b++) assert(r.band(b * 2 - 0.01, b * 2 + 2) > 3);

// --- anticipaciones: el acorde escrito en el 1 entra en el "y" del 4 anterior ---
// en pop, sin anticipación, en el "y" del 4 solo hay un bajo y un hi-hat
r = play('| C | G | Am |', 'pop');
const plain = r.hit(1.75);
r = play('| C | <G | Am |', 'pop');
assert(r.hit(1.75) >= plain + 5, 'la anticipación suma acorde, bajo y bombo en el "y" del 4');
assert(r.band(2 - 0.01, 4) > 3, 'el compás del acorde anticipado suena normal');
// en swing cae atresillada
r = play('| C | <G | Am |', 'swing');
assert(r.hit((3 + 2 / 3) * 0.5) >= 5, 'swing: anticipación en el último tercio del tiempo 4');
// dentro del compás: un acorde escrito en el 3 entra en el "y" del 2
r = play('| { C <G } | Am |', 'balada');
assert(r.hit(0.75) >= 5);
// anticipación con corte: el golpe se adelanta, no se repite en el 1, y hay silencio hasta el próximo acorde
r = play('| C | <G! | _ | Am |', 'pop');
assert(r.hit(1.75) >= 4); assert.equal(r.band(1.75, 6), 0); assert(r.band(6 - 0.01, 8) > 3);
// en 6/8 la anticipación es de una corchea (un cuarto de segundo a 120)
r = play('| Am | <E7 | Am |', 'chacarera', [6, 8]);
assert(r.hit(1.5 - 0.25) >= 5);
// con repeticiones, el compás anterior es el que suena antes, no el que está escrito antes
r = play('|: <C | G :| Am |', 'pop');
assert(r.hit(3.75) >= plain + 5, 'al repetir, la anticipación entra al final del compás que vuelve');

// --- la anticipación queda ligada: en el tiempo escrito no se vuelve a atacar el acorde ni el bajo ---
// en pop, al empezar un compás suenan bombo, hi-hat, bajo y acorde
r = play('| C | G | Am |', 'pop');
const downbeat = r.hit(2);
r = play('| C | <G | Am |', 'pop');
assert(r.hit(2) >= 1, 'la batería sigue marcando el primer tiempo');
assert(r.hit(2) <= downbeat - 6, 'el acorde y el bajo no se repiten en el primer tiempo');
assert(r.hit(4) >= downbeat - 1, 'el compás siguiente, sin anticipar, ataca normal');
// lo mismo dentro del compás: escrito en el 3, entra en el "y" del 2 y no se repite en el 3
r = play('| { C G } | Am |', 'pop');
const third = r.hit(1);
r = play('| { C <G } | Am |', 'pop');
assert(r.hit(0.75) >= 5); assert(r.hit(1) >= 1); assert(r.hit(1) <= third - 6);
// en los demás estilos de 4/4 tampoco hay un segundo ataque de teclado en el primer tiempo
for (const style of STYLES) {
  const a = play('| C | G | Am |', style).hit(2), b = play('| C | <G | Am |', style).hit(2);
  assert(b < a || a <= 2, style + ': el primer tiempo queda más liviano con la anticipación');
}
// con shuffle, la anticipación cae atresillada
r = play('| C | <G | Am |', 'shuffle');
assert(r.hit((3 + 2 / 3) * 0.5) >= 5);
console.log('cortes: ok');
