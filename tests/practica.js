// Modo práctica: el motor usa otro tempo y otros acordes en cada vuelta, y avisa cuándo empieza cada una.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const dir = process.argv[2];
const Music = require(path.join(dir, 'music.js'));

// AudioContext simulado: anota cada oscilador que arranca (tipo, frecuencia, momento).
let now = 0;
const notes = [];
const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => {
  const n = { type: '', gain: param(), frequency: param(), Q: param(), connect() {}, disconnect() {}, stop() {} };
  n.start = t => { if (n.type) notes.push({ type: n.type, f: n.frequency.value, t }); };
  return n;
};
class Ctx {
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
  get currentTime() { return now; }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createGain() { return node(); }
  createOscillator() { return node(); }
  createBufferSource() { return node(); }
  createBiquadFilter() { return node(); }
  createDynamicsCompressor() { return node(); }
  resume() {}
}
let tickFn = null;
const sandbox = { window: { AudioContext: Ctx }, document: { hidden: false }, setInterval: f => { tickFn = f; return 1; }, clearInterval() { tickFn = null; },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout() {}, Math, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, 'audio.js'), 'utf8') + '\nthis.Engine = Engine;', sandbox);
const Engine = sandbox.Engine;

function run(o) {
  notes.length = 0;
  now = 0;
  const log = [];
  let ended = false;
  Engine.play({ ...o, onBar: i => log.push({ bar: i, t: now }), onChorus: n => log.push({ chorus: n, t: now }), onEnd: () => { ended = true; } });
  for (let k = 0; k < 40000 && tickFn; k++) { now += 0.01; tickFn(); }
  assert(ended, 'la reproducción tiene que terminar');
  return log;
}

// Dos compases de Do, tres vueltas: +30 bpm y una cuarta arriba por vuelta.
const bars = Music.parseChart('| C | C |', [4, 4]);
const asked = [];
const log = run({
  seq: Music.unfold(bars),
  barsFor: n => { asked.push(n); return Music.resolve(bars, (n * 5) % 12); },
  getTempo: n => 120 + n * 30,
  finalChord: n => { asked.push('final ' + n); const root = (n * 5) % 12; return { root, bass: root, iv: [4, 7] }; },
  style: 'pop', choruses: 3, countIn: false,
});

// 1) avisa cada vuelta, en orden, justo antes de su primer compás
const order = log.map(e => (e.chorus != null ? 'v' + e.chorus : 'c' + e.bar)).join(' ');
assert.equal(order, 'v0 c0 c1 v1 c0 c1 v2 c0 c1 c-1');

// 2) el tempo cambia por vuelta: un compás de 4/4 dura 240 / tempo segundos
const starts = log.filter(e => e.bar === 0).map(e => e.t), seconds = log.filter(e => e.bar === 1).map(e => e.t);
[120, 150, 180].forEach((tempo, n) => {
  const dur = seconds[n] - starts[n];
  assert(Math.abs(dur - 240 / tempo) < 0.03, `vuelta ${n + 1}: el compás dura ${dur.toFixed(2)} s y debería durar ${(240 / tempo).toFixed(2)}`);
});

// 3) el tono cambia por vuelta: la primera nota del bajo de cada vuelta sube una cuarta (5 semitonos)
assert.deepEqual([...new Set(asked.filter(x => typeof x === 'number'))], [0, 1, 2]);
const bassAt = t => notes.filter(n => n.type === 'sawtooth' && Math.abs(n.t - t) < 0.2).sort((a, b) => a.t - b.t)[0];
const pcs = starts.map(t => ((Math.round(12 * Math.log2(bassAt(t).f / 440)) + 69) % 12 + 12) % 12);
assert.deepEqual(pcs, [0, 5, 10]);

// 4) el acorde final se pide para la última vuelta
assert(asked.includes('final 2'));

// 5) sin modo práctica todo sigue como antes: mismos acordes y mismo tempo en todas las vueltas
const plain = run({ seq: Music.unfold(bars), bars: Music.resolve(bars, 0), getTempo: () => 120, style: 'pop', choruses: 2, countIn: true });
const p0 = plain.filter(e => e.bar === 0).map(e => e.t), p1 = plain.filter(e => e.bar === 1).map(e => e.t);
assert(Math.abs((p1[0] - p0[0]) - 2) < 0.03 && Math.abs((p1[1] - p0[1]) - 2) < 0.03);
assert.equal(plain.filter(e => e.chorus != null).map(e => e.chorus).join(), '0,1');

console.log('modo práctica: ok');
