// Corre el motor de audio con un AudioContext simulado: verifica que cada estilo programe notas sin errores,
// primero con todo sintetizado y después con los sonidos grabados (los que anota sonidos/indice.json).
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2];
const Music = require(path.join(dir, 'music.js'));

let now = 0, events = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error('rampa a ' + v); }, setTargetAtTime() {} });
const node = kind => ({ kind, gain: param(), frequency: param(), Q: param(), playbackRate: param(), connect() {}, disconnect() {},
  start(t, at, len) {
    if (!(t >= 0)) throw new Error('start ' + t);
    if (this.buffer && this.buffer.grabado) {
      if (!places.has(this.buffer.grabado + at.toFixed(4)) || !(len > 0)) throw new Error('sonido grabado fuera de lugar: ' + at + ' ' + len);
      recorded++;
      if (this.buffer.grabado === index.piano.archivo) piano++;
      if (this.buffer.grabado === lastKeys) inKeys++;
    }
    events.push([kind, t]);
  }, stop() {} });
// Sonidos grabados de mentira: el índice es el verdadero, y el audio solo trae la marca del principio.
const RATE = 8000, index = JSON.parse(fs.readFileSync(path.join(dir, 'sonidos', 'indice.json'), 'utf8'));
const places = new Set(), wanted = [];
let recorded = 0, piano = 0, lastKeys = null, inKeys = 0;
for (const g of Object.values(index)) {
  if (!fs.existsSync(path.join(dir, 'sonidos', g.archivo))) throw new Error('Falta sonidos/' + g.archivo);
  for (const [at] of Object.values(g.sonidos)) places.add(g.archivo + at.toFixed(4));
}
const fakeFetch = async url => {
  const file = url.replace('sonidos/', '');
  wanted.push(file);
  return { ok: true, json: async () => index, arrayBuffer: async () => Object.values(index).find(g => g.archivo === file) };
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
  decodeAudioData(g, ok) {
    const d = new Float32Array(RATE);
    d[Math.round(g.marca * RATE)] = 1;
    ok({ grabado: g.archivo, sampleRate: RATE, getChannelData: () => d });
  }
  resume() {}
}
let tickFn = null;
const sandbox = { window: { AudioContext: Ctx }, document: { hidden: false }, setInterval: f => { tickFn = f; return 1; }, clearInterval() { tickFn = null; },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout() {}, Math, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, 'bases.js'), 'utf8') + fs.readFileSync(path.join(dir, 'audio.js'), 'utf8') + '\nthis.Engine = Engine; this.BASES = BASES;', sandbox);
// cada golpe de las bases tiene que ser un sonido que exista y caer dentro de la base
for (const [style, b] of Object.entries(sandbox.BASES)) for (const [at, name] of b.golpes) {
  if (!Object.values(index).some(g => g.sonidos[name])) throw new Error(`La base de ${style} usa "${name}", que no está en sonidos/`);
  if (!(at >= 0 && at < b.tiempos * b.compases)) throw new Error(`La base de ${style} tiene un golpe fuera de lugar`);
}
const Engine = sandbox.Engine;

const charts = {
  '4/4': '| Cmaj7 | Am7 D7 | % | G7 . . F#dim7 |\n| N.C. | C/E | Dm7b5 G7b9 | C5 |',
  '6/8': '| Am | E7 | Am Dm | E7 Am |\n| % | C G | N.C. | Am |',
  '3/4': '| Am | Dm | E7 . Am | % |\n| F C | N.C. | E7 | Am |',
  '5/4': '| Am | Dm E7 | % | Am |',
};
const styles = ['swing', 'shuffle', 'bossa', 'samba', 'pop', 'balada', 'funk', 'reggae', 'bolero', 'tango', 'milonga', 'candombe', 'cumbia', 'chacarera', 'zamba', 'vals', 'click'];
const pause = () => new Promise(done => setImmediate(done));
let fail = 0;
(async () => {
for (const sounds of [false, true]) {
if (sounds) { sandbox.fetch = fakeFetch; console.log('\ncon sonidos grabados'); }
for (const style of styles) for (const ts of Object.keys(charts)) {
  const tsn = ts.split('/').map(Number);
  const bars = Music.parseChart(charts[ts], tsn);
  events = []; now = 0; recorded = piano = 0;
  let seen = 0, ended = false;
  try {
    Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 3), getTempo: () => 140, style, choruses: 2, countIn: true,
      finalChord: { root: 0, bass: 0, iv: [4, 7] }, onBar: () => { seen++; }, onEnd: () => { ended = true; } });
    // la primera vez el motor espera a que los sonidos grabados estén listos
    for (let k = 0; k < 20 && !tickFn; k++) await pause();
    for (let k = 0; k < 3000 && tickFn; k++) { now += 0.05; tickFn(); }
    if (!ended || seen !== bars.length * 2 + 1) throw new Error(`fin=${ended} compases=${seen}`);
    if (sounds && style !== 'click' && !(recorded > piano && piano)) throw new Error(`grabados: ${recorded}, de piano: ${piano}`);
    console.log(style.padEnd(10), ts, String(events.length).padStart(5), 'sonidos' + (sounds ? `, ${recorded} grabados (${piano} de piano)` : ''));
  } catch (e) { fail++; console.log('FALLA', style, ts, e.message); }
}
}
// De los teclados solo tiene que haber bajado el piano, que es el que usan las canciones si no dicen otro.
const others = Object.keys(index).filter(g => index[g].teclado && g !== 'piano');
if (wanted.length !== Object.keys(index).length + 1 - others.length || others.some(g => wanted.includes(index[g].archivo))) {
  fail++; console.log('FALLA: pidió', wanted.join(' '));
}
// Cada uno de los otros teclados se baja recién cuando una canción lo pide, y ahí suena ese y no el piano.
for (const keys of others) {
  const bars = Music.parseChart(charts['4/4'], [4, 4]);
  events = []; now = 0; recorded = piano = 0; lastKeys = index[keys].archivo; inKeys = 0;
  Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 0), getTempo: () => 140, style: 'pop', keys, choruses: 1, countIn: false,
    finalChord: null, onBar() {}, onEnd() {} });
  for (let k = 0; k < 20 && !tickFn; k++) await pause();
  for (let k = 0; k < 3000 && tickFn; k++) { now += 0.05; tickFn(); }
  if (!wanted.includes(index[keys].archivo) || !inKeys || piano) { fail++; console.log('FALLA: teclado', keys, 'grabados', inKeys, 'de piano', piano); }
  else console.log('teclado', keys.padEnd(8), inKeys, 'notas grabadas');
}
console.log(fail ? `${fail} fallas` : 'todo ok');
if (fail) process.exit(1);
})();
