const M = require(process.argv[2]), assert = require('assert');
const strip = bs => bs.map(b => { const o = { ...b }; delete o.row; return o; });
const charts = [
  '[A]\n|: Cmaj7 | % | D7 | % |\n| Dm7 | G7 | 1. Cmaj7 | Dm7 G7 :|\n| 2. Cmaj7 | % |\n[B]\n| Gm7 | C7 | Fmaj7 | % |',
  '| C | G :| x3\n| "Fine" 3/4 F . Am | _ | N.C. |',
  '|: A | B :|: C | D/F# :| E6/9 |',
];
for (const t of charts) {
  const a = M.parseChart(t, [4, 4]);
  const txt = M.serialize(a);
  const b = M.parseChart(txt, [4, 4]);
  assert.deepEqual(strip(b), strip(a));
  assert.equal(M.serialize(b), txt);
  assert.deepEqual(M.unfold(b), M.unfold(a));
  assert.deepEqual(b.map(x => x.row).map((r, i, all) => i && r !== all[i - 1]), a.map(x => x.row).map((r, i, all) => i && r !== all[i - 1]));
  console.log(txt + '\n--');
}
const n = M.normalize(M.parseChart('| C | 3/4 D | E |', [4, 4]), [6, 8]);
assert.deepEqual(n.map(b => b.ts.join('/')), ['6/8', '3/4', '3/4']);
assert.deepEqual(M.intervals('5'), [7, 7]);
// un cifrado armado para trabar la lectura (corchetes o comillas sin cerrar) se lee al instante
for (const bad of ['[', '"', '[A', '{', '/x']) {
  const t0 = Date.now();
  M.parseChart(bad.repeat(200000), [4, 4]);
  M.parseChord('C' + bad.repeat(200000));
  assert.ok(Date.now() - t0 < 3000, 'la lectura tarda demasiado con: ' + bad);
}
// y las partes se siguen leyendo igual
assert.equal(M.parseChart('[Estribillo] | C | [B] D |', [4, 4]).map(b => b.section).join(), 'Estribillo,B');
console.log('ok');
