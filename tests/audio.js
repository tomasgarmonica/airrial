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
    events.push([kind, t, this.buffer && this.buffer.grabado ? this.buffer.grabado + '@' + at.toFixed(4) : '']);
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
  '12/8': '| Am | Dm E7 | % | Am G |',
  '2/4': '| Am | Dm E7 | % | Am |',
};
const styles = ['swing', 'shuffle', 'bossa', 'samba', 'pop', 'balada', 'funk', 'reggae', 'bolero', 'son', 'son32', 'festejo', 'tango', 'milonga', 'candombe', 'cumbia', 'chacarera', 'zamba', 'vals', 'click'];
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
// Samba en 2/4: dos compases tienen que sonar igual que uno de 4/4 (la clave del tamborim ocupa dos compases),
// golpe por golpe en la percusión, y con la misma cantidad de notas de bajo y de teclado.
{
  const run = async (chart, ts, startPos) => {
    const bars = Music.parseChart(chart, ts);
    events = []; now = 0; lastKeys = null;
    Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 0), getTempo: () => 100, style: 'samba', startPos, choruses: 1, countIn: false,
      finalChord: null, onBar() {}, onEnd() {} });
    for (let k = 0; k < 20 && !tickFn; k++) await pause();
    for (let k = 0; k < 3000 && tickFn; k++) { now += 0.05; tickFn(); }
    const t0 = Math.min(...events.map(e => e[1]));
    const of = file => events.filter(e => e[2].startsWith(file + '@')).map(e => (e[1] - t0).toFixed(3) + ' ' + e[2]).sort();
    return { perc: of(index.percusion.archivo), bajo: of(index.bajo.archivo).length, piano: of(index.piano.archivo).length };
  };
  const four = await run('| Am | Dm | G7 G7 | C |', [4, 4]);
  const two = await run('| Am | Am | Dm | Dm | G7 | G7 | C | C |', [2, 4]);
  if (!four.perc.length || four.perc.join('\n') !== two.perc.join('\n')) { fail++; console.log('FALLA: samba en 2/4, la percusión no coincide con la de 4/4', four.perc.length, two.perc.length); }
  else if (four.bajo !== two.bajo || four.piano !== two.piano) { fail++; console.log('FALLA: samba en 2/4, bajo o teclado', JSON.stringify([four.bajo, two.bajo, four.piano, two.piano])); }
  // arrancando desde el segundo compás, la clave del tamborim sigue alineada con la hoja: suena lo mismo que
  // sonaba ahí tocando el tema desde el principio (a 100 por minuto, un compás de 2/4 dura 1,2 segundos)
  const late = await run('| Am | Am | Dm | Dm | G7 | G7 | C | C |', [2, 4], 1);
  const tail = two.perc.map(e => [+e.split(' ')[0] - 1.2, e.split(' ')[1]]).filter(e => e[0] > -1e-6).map(e => e[0].toFixed(3) + ' ' + e[1]).sort();
  if (late.perc.join('|') !== tail.join('|')) { fail++; console.log('FALLA: samba en 2/4 desde el segundo compás, la clave queda corrida', late.perc.length, tail.length); }
  else console.log('samba 2/4 = 4/4:', four.perc.length, 'golpes de percusión,', four.bajo, 'notas de bajo,', four.piano, 'de teclado');
}
// Cumbia en 2/4: dos compases tienen que sonar igual que uno de 4/4, sonido por sonido (percusión, batería,
// bajo y teclado), y arrancando desde el segundo compás sigue alineada con la hoja.
{
  const run = async (chart, ts, startPos) => {
    const bars = Music.parseChart(chart, ts);
    events = []; now = 0; lastKeys = null;
    Engine.play({ seq: Music.unfold(bars), bars: Music.resolve(bars, 0), getTempo: () => 100, style: 'cumbia', startPos, choruses: 1, countIn: false,
      finalChord: null, onBar() {}, onEnd() {} });
    for (let k = 0; k < 20 && !tickFn; k++) await pause();
    for (let k = 0; k < 3000 && tickFn; k++) { now += 0.05; tickFn(); }
    const t0 = Math.min(...events.map(e => e[1]));
    return events.filter(e => e[2]).map(e => [e[1] - t0, e[2]]);
  };
  const show = list => list.map(e => e[0].toFixed(3) + ' ' + e[1]).sort().join('\n');
  const four = await run('| Am | Dm | G7 C | C |', [4, 4]);
  const two = await run('| Am | Am | Dm | Dm | G7 | C | C | C |', [2, 4]);
  const late = await run('| Am | Am | Dm | Dm | G7 | C | C | C |', [2, 4], 1);
  const perc = list => list.filter(e => !e[1].startsWith(index.bajo.archivo) && !e[1].startsWith(index.piano.archivo));
  const tail = perc(two).map(e => [e[0] - 1.2, e[1]]).filter(e => e[0] > -1e-6);
  if (!perc(four).length || show(four) !== show(two)) { fail++; console.log('FALLA: cumbia en 2/4, no suena igual que en 4/4', four.length, two.length); }
  else if (show(perc(late)) !== show(tail)) { fail++; console.log('FALLA: cumbia en 2/4 desde el segundo compás, queda corrida', late.length, tail.length); }
  else console.log('cumbia 2/4 = 4/4:', four.length, 'sonidos,', perc(four).length, 'de percusión y batería');
}
// En iPhone: pide sonar aunque el teléfono esté en silencio.
{
  const session = { type: 'auto' };
  sandbox.navigator = { audioSession: session };
  Engine.play({ seq: [0], bars: Music.resolve(Music.parseChart('| C |', [4, 4]), 0), getTempo: () => 100, style: 'click', choruses: 1, countIn: false, finalChord: null, onBar() {}, onEnd() {} });
  Engine.stop();
  sandbox.navigator = undefined;
  if (session.type !== 'playback') { fail++; console.log('FALLA: en iPhone no pide sonar con el teléfono en silencio'); }
  else console.log('iPhone en silencio: ok');
}
console.log(fail ? `${fail} fallas` : 'todo ok');
if (fail) process.exit(1);
})();
