// Corre el motor de audio con un AudioContext simulado: verifica que cada estilo programe notas sin errores.
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2];
const Music = require(path.join(dir, 'music.js'));

let now = 0, events = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error('rampa a ' + v); }, setTargetAtTime() {} });
const node = kind => ({ kind, gain: param(), frequency: param(), Q: param(), connect() {}, disconnect() {},
  start(t) { if (!(t >= 0)) throw new Error('start ' + t); events.push([kind, t]); }, stop() {} });
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

const charts = {
  '4/4': '| Cmaj7 | Am7 D7 | % | G7 . . F#dim7 |\n| N.C. | C/E | Dm7b5 G7b9 | C5 |',
  '6/8': '| Am | E7 | Am Dm | E7 Am |\n| % | C G | N.C. | Am |',
  '3/4': '| Am | Dm | E7 . Am | % |\n| F C | N.C. | E7 | Am |',
  '5/4': '| Am | Dm E7 | % | Am |',
};
const styles = ['swing', 'bossa', 'samba', 'pop', 'balada', 'tango', 'milonga', 'candombe', 'cumbia', 'chacarera', 'zamba', 'vals', 'click'];
let fail = 0;
for (const style of styles) for (const ts of Object.keys(charts)) {
  const tsn = ts.split('/').map(Number);
  const bars = Music.parseChart(charts[ts], tsn);
  events = []; now = 0;
  let seen = 0, ended = false;
  try {
    Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 3), getTempo: () => 140, style, choruses: 2, countIn: true,
      finalChord: { root: 0, bass: 0, iv: [4, 7] }, onBar: () => { seen++; }, onEnd: () => { ended = true; } });
    for (let k = 0; k < 3000 && tickFn; k++) { now += 0.05; tickFn(); }
    if (!ended || seen !== bars.length * 2 + 1) throw new Error(`fin=${ended} compases=${seen}`);
    console.log(style.padEnd(10), ts, String(events.length).padStart(5), 'sonidos');
  } catch (e) { fail++; console.log('FALLA', style, ts, e.message); }
}
console.log(fail ? `${fail} fallas` : 'todo ok');
