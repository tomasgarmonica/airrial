// Arma los sonidos livianos que usa la app a partir de las grabaciones originales (que no se tocan).
// Uso:  node herramientas/sonidos.js "G:/Mi unidad/Audios"      (necesita ffmpeg instalado)
//
// Por cada grupo (batería, percusión, piano) sale un solo archivo MP3 con todos los golpes o notas en fila,
// y en sonidos/indice.json queda anotado dónde empieza y cuánto dura cada uno. Al principio de cada archivo
// va una marca (un clic corto) para que la app pueda ubicarse aunque el navegador corra el audio unos
// milisegundos al abrirlo.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) { console.error('Falta la carpeta de las grabaciones.'); process.exit(1); }
const OUT = path.join(__dirname, '..', 'sonidos');
const SR = 44100, MARK = 0.1, FIRST = 0.3, GAP = 0.06, CEIL = Math.pow(10, -2 / 20);

// nombre en la app: archivo grabado
const BATERIA = {
  bombo: 'Batería/Bombo.wav', redo: 'Batería/Redo.wav', redo_agudo: 'Batería/Redo agudo.wav', aro: 'Batería/Aro.wav',
  hh_cerrado: 'Batería/HH cerrado.wav', hh_abierto: 'Batería/HH abierto.wav', hh_pedal: 'Batería/HH pedal.wav',
  tom1: 'Batería/Tom1.wav', tom2: 'Batería/Tom2.wav', chancha: 'Batería/Chancha.wav',
};
// Solo lo que hoy usa algún ritmo. El resto de lo grabado se suma acá cuando se escriba su ritmo.
const PERCUSION = {
  clave: 'Percu/Clave.wav', chico_mano: 'Percu/chico mano.wav', chico_palo: 'Percu/chico palo.wav',
  tumba_tono: 'Percu/tumba tono.wav', conga_tono: 'Percu/conga tono.wav', bongo_grave: 'Percu/bongo grave abierto.wav',
  leguero_aro: 'Percu/bombo aro.wav', leguero_medio: 'Percu/bombo parche medio.wav', leguero_fuerte: 'Percu/bombo parche fuerte.wav',
  pandeiro_platinelas: 'Percu/pandeiro platinelas.wav', campana_lomo: 'Percu/Campana lomo.wav',
  surdo_cerrado: 'Percu/Surdo cerrado.wav', surdo_abierto: 'Percu/Surdo abierto.wav',
  surdo_pta_dedo: 'Percu/Surdo pta dedo.wav', surdo_palma: 'Percu/Surdo palma.wav',
  // tambores de candombe (el chico está más arriba)
  piano_tono: 'Percu/piano tono.wav', piano_palma: 'Percu/piano palma.wav', piano_pta_dedo: 'Percu/piano pta dedo.wav',
  piano_palma_y_palo: 'Percu/piano palma y palo.wav', piano_palo_abierto: 'Percu/piano palo abierto.wav',
  piano_palo_cerrado: 'Percu/piano palo cerrado.wav', piano_madera: 'Percu/piano madera.wav',
  repique_palo: 'Percu/repique palo.wav', repique_mano: 'Percu/repique mano.wav',
  repique_rim: 'Percu/repique rim.wav', repique_madera: 'Percu/repique madera.wav',
  guiro_arrastre: 'Percu/Guiro Metal arrastre.wav', guiro_abajo: 'Percu/Guiro Metal abajo.wav', guiro_arriba: 'Percu/Guiro Metal arriba.wav',
};
// Piano: las notas que alcanzan los acordes de hoy (cada una cubre también el semitono de arriba y el de abajo),
// en dos intensidades: "s" suave y "m" media.
const PIANO = {};
for (const [midi, name] of [[54, 'F#3'], [57, 'A3'], [60, 'C4'], [63, 'Eb4'], [66, 'F#4']]) {
  PIANO[midi + 'm'] = `Piano/Piano ${name}.wav`;
  PIANO[midi + 's'] = `Piano/Piano ${name} suave.wav`;
}

function readWav(p) {
  const b = fs.readFileSync(p);
  let q = 12, fmt = null, data = null;
  while (q + 8 <= b.length) {
    const id = b.toString('ascii', q, q + 4), sz = b.readUInt32LE(q + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(q + 10), sr: b.readUInt32LE(q + 12), bits: b.readUInt16LE(q + 22) };
    if (id === 'data') { data = b.subarray(q + 8, Math.min(q + 8 + sz, b.length)); break; }
    q += 8 + sz + (sz & 1);
  }
  if (fmt.sr !== SR) throw new Error(`${p}: está a ${fmt.sr} Hz y se esperaba ${SR}`);
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch)), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bps;
      s += bps === 3 ? data.readIntLE(o, 3) / 8388608 : data.readInt16LE(o) / 32768;
    }
    x[i] = s / fmt.ch;
  }
  return x;
}
function writeWav(p, x) {
  const h = Buffer.alloc(44), d = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), i * 2);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(p, Buffer.concat([h, d]));
}
const peakOf = x => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; };

// Recorta desde el ataque hasta que el sonido se apaga (60 dB por debajo de su pico), con un tope de `max`
// segundos, y le hace una salida suave para que no termine en un chasquido.
function trim(x, max) {
  const pk = peakOf(x);
  let a = 0; while (a < x.length && Math.abs(x[a]) < pk * 0.02) a++;
  a = Math.max(0, a - Math.floor(0.002 * SR));
  let b = x.length - 1; while (b > a && Math.abs(x[b]) < pk * 0.001) b--;
  b = Math.min(x.length, b + Math.floor(0.05 * SR), a + Math.floor(max * SR));
  const y = Float32Array.from(x.subarray(a, b)), fade = Math.min(Math.floor(0.04 * SR), Math.floor(y.length / 5));
  for (let i = 0; i < fade; i++) y[y.length - 1 - i] *= i / fade;
  return y;
}
const scale = (x, g) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; };

// Golpes: cada uno a su máximo, así la fuerza la decide la app al tocarlo.
function hits(map) {
  const out = {};
  for (const [name, file] of Object.entries(map)) {
    const y = trim(readWav(path.join(SRC, file)), 4);
    out[name] = scale(y, CEIL / peakOf(y));
  }
  return out;
}
// Notas: todas a la misma sonoridad (medida en el primer segundo), para que un acorde suene parejo.
function notes(map) {
  const out = {}, rms = {};
  for (const [name, file] of Object.entries(map)) {
    const y = out[name] = trim(readWav(path.join(SRC, file)), 3.5), n = Math.min(y.length, SR);
    let s = 0; for (let i = 0; i < n; i++) s += y[i] * y[i];
    rms[name] = Math.sqrt(s / n);
  }
  const target = Math.min(...Object.keys(out).map(k => CEIL * rms[k] / peakOf(out[k])));
  for (const k of Object.keys(out)) scale(out[k], target / rms[k]);
  return out;
}

// Dónde cae la marca en un audio: la primera muestra que pasa de la cuarta parte del máximo.
const markAt = x => { let i = 0; while (i < x.length && Math.abs(x[i]) < 0.25) i++; return i / SR; };

function pack(group, sounds, quality) {
  const names = Object.keys(sounds), index = {};
  let len = Math.floor(FIRST * SR);
  for (const k of names) { index[k] = [+(len / SR).toFixed(4), +(sounds[k].length / SR).toFixed(4)]; len += sounds[k].length + Math.floor(GAP * SR); }
  const all = new Float32Array(len);
  for (let i = 0; i < Math.floor(0.005 * SR); i++) all[Math.floor(MARK * SR) + i] = 0.9 * Math.sin(2 * Math.PI * 2000 * i / SR);
  for (const k of names) all.set(sounds[k], Math.round(index[k][0] * SR));
  const tmp = path.join(os.tmpdir(), `airrial_${group}.wav`), back = path.join(os.tmpdir(), `airrial_${group}_vuelta.wav`);
  const mp3 = path.join(OUT, group + '.mp3');
  writeWav(tmp, all);
  const ff = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr || 'no se pudo correr ffmpeg'); };
  ff(['-i', tmp, '-c:a', 'libmp3lame', '-q:a', String(quality), '-ac', '1', mp3]);
  // La marca se mide sobre el MP3 ya hecho, igual que la va a medir la app.
  ff(['-i', mp3, '-c:a', 'pcm_s16le', back]);
  const marca = +markAt(readWav(back)).toFixed(4);
  fs.unlinkSync(tmp); fs.unlinkSync(back);
  console.log(`${group.padEnd(10)} ${String(names.length).padStart(2)} sonidos  ${(len / SR).toFixed(1).padStart(5)} s  ${(fs.statSync(mp3).size / 1024).toFixed(0).padStart(4)} KB  marca en ${marca} s`);
  return { archivo: group + '.mp3', marca, sonidos: index };
}

fs.mkdirSync(OUT, { recursive: true });
const indice = {
  bateria: pack('bateria', hits(BATERIA), 2),
  percusion: pack('percusion', hits(PERCUSION), 2),
  piano: pack('piano', notes(PIANO), 3),
};
fs.writeFileSync(path.join(OUT, 'indice.json'), JSON.stringify(indice) + '\n');
