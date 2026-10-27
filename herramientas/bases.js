// Pasa a la app las bases escritas en MIDI: la percusión y, si las tiene, las pistas de bajo y teclado.
// Uso:  node herramientas/bases.js "G:/Mi unidad/Audios/Midi"
//
// En esa carpeta va un archivo "Base <ritmo>.mid" por ritmo, con una pista por grupo de instrumentos, y un
// "Notas bases.txt" que dice qué sonido es cada nota en cada pista. Un bloque por pista, que vale para todas
// las bases:
//     Notas Percu:
//     C3: piano palma y palo
//     F#3: chico palo
//
//     Notas batería:
//     C2: bombo
// El bloque se llama igual que la pista del MIDI. El nombre del sonido es el de la grabación; los que en la app
// se llaman distinto están en OTRO_NOMBRE.
// La intensidad de cada nota (velocity) es la fuerza del golpe. Sale bases.js, que no se edita a mano.
const fs = require('fs'), path = require('path');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'Notas bases.txt'))) { console.error('Falta la carpeta con las bases y "Notas bases.txt".'); process.exit(1); }
const root = path.join(__dirname, '..');
// Sonidos que tiene la app y por qué renglón de la mezcla sale cada uno (batería o percusión).
const known = new Map();
for (const g of Object.values(JSON.parse(fs.readFileSync(path.join(root, 'sonidos', 'indice.json'), 'utf8')))) Object.keys(g.sonidos).forEach(k => known.set(k, g.pista || 'drums'));
// Instrumento al que pertenece un sonido: "surdo_abierto" y "surdo_dedos" son el surdo; "tom1" y "tom2", los toms.
// (La misma regla está en audio.js.) En la mezcla el usuario le puede cambiar el volumen a cada instrumento.
const instOf = name => name.split('_')[0].replace(/[0-9]+$/, '');

const plain = s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
// "F#3" -> 54 (Do3 = 48, como lo muestra Reaper)
function midiOf(name) {
  const m = name.trim().toLowerCase().match(/^([a-g])([#b]?)(-?\d)$/);
  if (!m) throw new Error('No entiendo la nota "' + name + '"');
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (+m[3] + 1);
}

// Sonidos que en la app tienen otro nombre que en el texto del dueño.
const OTRO_NOMBRE = {
  'bombo aro': 'leguero_aro', 'bombo parche suave': 'leguero_suave', 'bombo parche medio': 'leguero_medio',
  'bombo parche fuerte': 'leguero_fuerte', 'bongo grave abierto': 'bongo_grave', 'tumbadora tono': 'tumba_tono',
  'guiro metal abajo': 'guiro_abajo', 'guiro metal arriba': 'guiro_arriba', 'guiro metal arrastre': 'guiro_arrastre',
  'guiro metal seco abajo': 'guiro_seco_abajo', jamblockr: 'jamblock',
  redoblante: 'redo', 'redoblante agudo': 'redo_agudo',
  // el surdo se regrabó con un solo golpe de mano ("Surdo dedos"), que reemplaza a los dos de antes
  'surdo palma': 'surdo_dedos', 'surdo pta dedo': 'surdo_dedos',
};
// Notas bases.txt -> { percu: { 48: ['piano_palma_y_palo', 'Piano palma y palo'], ... }, bateria: { ... } }
const maps = {};
let cur = null;
for (const line of fs.readFileSync(path.join(SRC, 'Notas bases.txt'), 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  const head = line.match(/^\s*notas\s+(.+?)\s*:?\s*$/i);
  if (head) { cur = maps[plain(head[1])] = {}; continue; }
  const [note, ...rest] = line.split(':');
  if (!cur || !rest.length) throw new Error('No entiendo este renglón de Notas bases.txt: ' + line);
  const said = rest.join(':').trim(), name = plain(said).replace(/\s+/g, ' ');
  cur[midiOf(note)] = [OTRO_NOMBRE[name] || name.replace(/ /g, '_'), said];
}

// Notas de un archivo MIDI: [momento en negras, nota, intensidad, pista, duración en negras], más el compás.
function readMidi(file) {
  const b = fs.readFileSync(file), ppq = b.readUInt16BE(12), notes = [];
  let p = 14, sig = [4, 4];
  while (p < b.length) {
    let q = p + 8, t = 0, run = 0, track = '';
    const mine = [], end = q + b.readUInt32BE(p + 4);
    p = end;
    const vlq = () => { let v = 0, c; do { c = b[q++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
    while (q < end) {
      t += vlq();
      let st = b[q];
      if (st & 128) q++; else st = run;
      if (st === 0xff) {
        const type = b[q++], len = vlq();
        if (type === 0x58) sig = [b[q], 1 << b[q + 1]];
        // el nombre de la pista puede venir en cualquiera de las dos formas de escribir los acentos
        if (type === 3) { track = b.toString('utf8', q, q + len); if (track.includes('�')) track = b.toString('latin1', q, q + len); }
        q += len;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { q += vlq(); continue; }
      run = st;
      const kind = st & 0xf0;
      if (kind === 0x90 || kind === 0x80) {
        const n = b[q++], v = b[q++];
        if (kind === 0x90 && v) mine.push([t / ppq, n, v]);
        // al soltarse la nota queda anotado cuánto duró (el bajo y el teclado lo usan)
        else { const on = mine.findLast(m => m[1] === n && m[3] == null); if (on) on[3] = t / ppq - on[0]; }
      }
      else q += kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    }
    for (const [at, n, v, len] of mine) notes.push([at, n, v, track, len || 0]);
  }
  return { notes, sig };
}

// Ajustes de volumen pedidos de oído por el dueño: se multiplican por la intensidad que trae el MIDI.
// Candombe: todo parejo (la madera venía más fuerte que el piano) y el chico bastante más abajo.
const AJUSTE = {
  // La batería vino escrita con intensidades más bajas que los tambores (marcan matices entre sus golpes, no
  // su volumen contra la percusión): bombo y redoblante se suben para quedar a la par de la cuerda de tambores.
  // El hi-hat, que toca casi todas las semicorcheas, se baja: de oído quedaba muy por encima del resto.
  // Chacarera: los tres golpes de parche (suave, medio, fuerte) están grabados a distinta fuerza pero en la app
  // quedan todos al mismo volumen, y el MIDI los trae con la misma intensidad: acá se les devuelve la diferencia.
  // El conjunto se sube para que el bombo, que es toda la percusión del ritmo, quede como estaba antes de la base.
  // El bajo y el teclado (chacarera 01) vinieron con intensidades de 75 a 96: se suben para que la nota más
  // fuerte quede como la más fuerte de los patrones de antes (y el bajo use su grabación fuerte en esas notas).
  chacarera: { leguero_fuerte: 2.3, leguero_medio: 1.4, leguero_suave: 0.6, bajo: 1.3, teclado: 1.3 },
  // Zamba: lo mismo, con otros números porque el MIDI vino con más intensidad (114 en lugar de 87).
  // Festejo: los golpes "normal" y "acentuado" del cajón, y las maracas "medio" y "fuerte", están grabados a
  // distinta fuerza pero en la app quedan al mismo volumen: se les devuelve la diferencia.
  festejo: { cajon_grave_normal: 0.6, cajon_agudo_normal: 0.75, maraca_medio_abajo: 0.35 },
  // Samba: el surdo es la base del ritmo y vino con poca intensidad: se sube, pero menos su golpe de dedos,
  // que es relleno. El pandeiro tapado toca tres de cada cuatro semicorcheas: se baja.
  samba: { surdo_abierto: 2, surdo_cerrado: 2, surdo_dedos: 0.9, pandeiro_tono_tapado: 0.6 },
  zamba: { leguero_fuerte: 1.76, leguero_medio: 1.07, leguero_suave: 0.46, leguero_aro: 0.77 },
  candombe: { chico_mano: 0.2, chico_palo: 0.2, repique_madera: 0.76, bombo: 2.7, redo: 2.7, hh_cerrado: 0.55 },
};

// Bases cuyos compases no van en fila sino que son variantes para alternar (la primera es la básica).
const ALTERNAR = ['zamba'];
// Bases con una versión distinta para cada momento del tema: un compás por versión, en este orden. En la app se
// elige cuál lleva cada parte de la canción (la primera es la que suena si no se elige nada).
const PARTES = { son: ['Abajo (estrofa)', 'Arriba (montuno)'] };

// Golpes que en un MIDI exportado quedaron corridos y el dueño pidió acomodar mientras no lo vuelva a exportar:
// { ritmo: [[sonido, dónde está, dónde va], ...] }, en tiempos desde el comienzo de la base. Hoy no hay ninguno.
const CORREGIR = {};

// Bajo y teclado van escritos sobre Do (Do3 es la fundamental) y la app los corre a cada acorde: no necesitan
// bloque en Notas bases.txt. Su intensidad se multiplica por AJUSTE[ritmo].bajo o .teclado, como los golpes.
const ARMONIA = ['bajo', 'teclado'], DO3 = 48;
// Teclas de EZbass que no suenan sino que cambian cómo se toca la nota del bajo que cae junto con ellas.
const ARTICULACION = { 15: 'chasquido', 16: 'muteado' };
// [tiempo, semitonos desde Do3, duración, fuerza]. En el teclado, las notas desde Sol3 que suenan juntas son un
// acorde, que la app arma a su manera (con la séptima si la tiene): [tiempo, "acorde", duración, fuerza]. En el
// bajo, una nota con articulación la lleva al final: [tiempo, semitonos, duración, fuerza, "muteado"].
function harmony(notes, per, chords, k, file) {
  const out = [], byTime = new Map();
  for (const n of notes) { const key = n[0].toFixed(4); if (!byTime.has(key)) byTime.set(key, []); byTime.get(key).push(n); }
  const force = list => +(list.reduce((a, n) => a + n[2], 0) / list.length / 127 * k).toFixed(2);
  for (const group of byTime.values()) {
    const high = chords ? group.filter(n => n[1] >= DO3 + 7) : [], chord = high.length >= 2 ? high : [];
    const at = +(group[0][0] / per).toFixed(4);
    const keys = chords ? [] : group.filter(n => n[1] < 24);
    for (const n of keys) if (!ARTICULACION[n[1]]) throw new Error(`${file}: en el bajo hay una nota muy grave (${n[1]}) que no sé qué articulación es`);
    const art = keys.length ? [ARTICULACION[keys[0][1]]] : [];
    if (chord.length) out.push([at, 'acorde', +(Math.max(...chord.map(n => n[4])) / per).toFixed(4), force(chord)]);
    for (const n of group) if (!chord.includes(n) && !keys.includes(n)) out.push([at, n[1] - DO3, +(n[4] / per).toFixed(4), force([n]), ...art]);
  }
  return out.sort((a, c) => a[0] - c[0]);
}
// Bajo y teclado de un archivo, de a un compás: { bajo: [[notas del compás 1], [del 2]], teclado: ... }, con los
// tiempos contados desde el principio de cada compás.
function harmonyBars(every, per, beats, style, file) {
  const out = {};
  for (const tr of ARMONIA) {
    const mine = every.filter(n => plain(n[3]) === tr);
    if (!mine.length) continue;
    out[tr] = [];
    for (const h of harmony(mine, per, tr === 'teclado', (AJUSTE[style] || {})[tr] || 1, file)) {
      const bar = Math.floor(h[0] / beats + 1e-6);
      (out[tr][bar] = out[tr][bar] || []).push([+(h[0] - bar * beats).toFixed(4), ...h.slice(1)]);
    }
  }
  return out;
}

// Cada ritmo va en un archivo "Base <ritmo>.mid" suelto (si hay varios numerados, vale el de número más alto),
// o en una carpeta con archivos numerados ("Chacarera/Base chacarera 01.mid", "... 02.mid"): ahí el 01 es la base
// y los que siguen son variaciones de bajo y teclado para alternar. La carpeta manda sobre el archivo suelto.
// Las carpetas con archivos sin número (Batería: "Base blues.mid") no se leen.
const numbered = f => plain(f.replace(/^base /i, '').replace(/\.mid$/i, '')).match(/^(.+?)(?:\s+(\d+))?$/);
const chosen = new Map();
for (const file of fs.readdirSync(SRC).filter(f => /^base .+\.mid$/i.test(f)).sort()) {
  const [, name, num] = numbered(file);
  const prev = chosen.get(name);
  if (prev && prev.num >= +(num || 0)) { console.log(`${name}: se usa "${prev.file}" y no "${file}"`); continue; }
  if (prev) console.log(`${name}: se usa "${file}" y no "${prev.file}"`);
  chosen.set(name, { file, num: +(num || 0), variaciones: [] });
}
for (const dir of fs.readdirSync(SRC).filter(d => fs.statSync(path.join(SRC, d)).isDirectory())) {
  const files = fs.readdirSync(path.join(SRC, dir)).filter(f => /^base .+\s\d+\.mid$/i.test(f))
    .map(f => [numbered(f), path.join(dir, f)]).sort((a, c) => a[0][2] - c[0][2]);
  if (!files.length) continue;
  const name = files[0][0][1];
  if (files.some(f => f[0][1] !== name)) throw new Error(`En la carpeta "${dir}" hay bases de más de un ritmo`);
  if (chosen.has(name)) console.log(`${name}: se usa la carpeta "${dir}" y no "${chosen.get(name).file}"`);
  chosen.set(name, { file: files[0][1], variaciones: files.slice(1).map(f => f[1]) });
}

const bases = {};
for (const [style, { file, variaciones }] of [...chosen].sort()) {
  const { notes: every, sig } = readMidi(path.join(SRC, file));
  const all = every.filter(n => !ARMONIA.includes(plain(n[3])));
  // Una pista cuyo bloque no existe o está vacío no se pasa, y se avisa.
  const empty = [...new Set(all.map(n => n[3]))].filter(tr => !Object.keys(maps[plain(tr)] || {}).length);
  for (const tr of empty) console.log(`${file}: la pista "${tr}" no tiene sus notas en Notas bases.txt (bloque "Notas ${tr}"): NO SE PASA`);
  const notes = all.filter(n => !empty.includes(n[3]));
  if (!notes.length) continue;
  // tiempos del compás, en la figura que marca el compás (negras en 4/4, corcheas en 6/8)
  const beats = sig[0], per = 4 / sig[1];
  const hits = notes.map(([t, n, v, tr]) => {
    const found = maps[plain(tr)][n];
    if (!found) throw new Error(`${file}, pista "${tr}": hay una nota (${n}) que no figura en su bloque de Notas bases.txt`);
    const [sound, said] = found;
    if (!known.has(sound)) throw new Error(`${file}: usa "${said}", que todavía no está en la app (falta sumarlo en herramientas/sonidos.js como ${sound})`);
    return [+(t / per).toFixed(4), sound, +(v / 127 * ((AJUSTE[style] || {})[sound] || 1)).toFixed(2)];
  }).sort((a, c) => a[0] - c[0]);
  for (const [sound, was, goes] of CORREGIR[style] || []) {
    for (const h of hits) if (h[1] === sound && Math.abs(h[0] - was) < 1e-3) { h[0] = goes; console.log(`${style}: ${sound} corrido de ${was} a ${goes}`); }
  }
  hits.sort((a, c) => a[0] - c[0]);
  const extra = {};
  for (const tr of ARMONIA) {
    const mine = every.filter(n => plain(n[3]) === tr);
    if (mine.length) extra[tr] = harmony(mine, per, tr === 'teclado', (AJUSTE[style] || {})[tr] || 1, file);
  }
  const last = Math.max(hits[hits.length - 1][0], ...Object.values(extra).map(l => l[l.length - 1][0]));
  const bars = Math.max(1, Math.ceil((last + 1e-3) / beats));
  const instrumentos = {};
  for (const h of hits) instrumentos[instOf(h[1])] = known.get(h[1]);
  if (PARTES[style] && PARTES[style].length !== bars) throw new Error(file + ': tiene ' + bars + ' compases y se esperaba uno por versión (' + PARTES[style].join(', ') + ')');
  bases[style] = { tiempos: beats, compases: bars, ...(ALTERNAR.includes(style) ? { alternar: true } : {}),
    ...(PARTES[style] ? { partes: PARTES[style] } : {}), instrumentos, golpes: hits, ...extra };
  console.log(`${style}: ${sig.join('/')}, ${bars} ${bars > 1 ? 'compases' : 'compás'}, ${hits.length} golpes` +
    Object.entries(extra).map(([tr, l]) => `, ${l.length} de ${tr}`).join(''));
  // Variaciones: cada compás de bajo o de teclado que no sea igual a uno de la base ni a otro ya anotado.
  if (!variaciones.length) continue;
  const seen = {}, vars = {};
  for (const [tr, list] of Object.entries(harmonyBars(every, per, beats, style, file))) seen[tr] = new Set(list.map(b => JSON.stringify(b)));
  for (const v of variaciones) {
    const read = readMidi(path.join(SRC, v));
    if (read.sig.join('/') !== sig.join('/')) throw new Error(`${v} está en ${read.sig.join('/')} y la base en ${sig.join('/')}`);
    const drums = read.notes.filter(n => !ARMONIA.includes(plain(n[3]))).map(n => n.slice(0, 4).join()).sort().join('|');
    if (drums !== all.map(n => n.slice(0, 4).join()).sort().join('|')) console.log(`${v}: la percusión no es igual a la de la base, y sus variaciones todavía no se usan`);
    for (const [tr, list] of Object.entries(harmonyBars(read.notes, per, beats, style, v))) {
      if (!extra[tr]) throw new Error(`${v} tiene ${tr} y la base no`);
      seen[tr] = seen[tr] || new Set();
      for (const b of list) {
        const key = JSON.stringify(b || []);
        if (!seen[tr].has(key)) { seen[tr].add(key); (vars[tr] = vars[tr] || []).push(b || []); }
      }
    }
  }
  bases[style].variaciones = vars;
  console.log(`${style}: variaciones de ` + (Object.entries(vars).map(([tr, l]) => `${tr}: ${l.length}`).join(', ') || 'nada (son iguales a la base)'));
}
fs.writeFileSync(path.join(root, 'bases.js'),
  '// Bases de percusión de cada ritmo. Lo genera herramientas/bases.js a partir de los MIDI: no editar a mano.\n' +
  '// Cada golpe: [tiempo dentro de la base, sonido grabado, fuerza]. "instrumentos" dice por qué renglón de la\n' +
  '// mezcla sale cada uno: drums (batería) o perc (percusión). Bajo y teclado, si los hay, escritos sobre Do:\n' +
  '// [tiempo, semitonos desde Do3 (o "acorde"), duración, fuerza, articulación del bajo si la tiene].\n' +
  '// "variaciones": compases de bajo o de teclado para alternar con los de la base, con los tiempos desde el 1.\n' +
  'const BASES = ' + JSON.stringify(bases).replace(/("[a-z0-9_]+":\{)/g, '\n  $1').replace(/\}\}$/, '},\n}') + ';\n');
