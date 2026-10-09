const M = require(process.argv[2]), assert = require('assert');
const seq = t => M.unfold(M.parseChart(t, [4, 4])).join(' ');
// lo de antes sigue igual
assert.equal(seq('|: C | D | 1. E :| 2. F | G |'), '0 1 2 0 1 3 4');
assert.equal(seq('| C | G :| x3\n| F |'), '0 1 0 1 0 1 2');
// D.C. al Fine
assert.equal(seq('| A | "Fine" B | C | "D.C. al Fine" D |'), '0 1 2 3 0 1');
// D.C. sin Fine: vuelve y toca hasta el final, una sola vez
assert.equal(seq('| A | B | "D.C." C |'), '0 1 2 0 1 2');
// D.S. al Coda: 0 intro, 1 segno, 3 al coda, 5 D.S., 6 coda
assert.equal(seq('| I | "Segno" A | B | "Al Coda" C | D | "D.S. al Coda" E | "Coda" X | Y |'), '0 1 2 3 4 5 1 2 3 6 7');
// D.S. sin segno marcado: se comporta como D.C.
assert.equal(seq('| A | "Fine" B | "D.S." C |'), '0 1 2 0 1');
// después del salto no se repite y se toma la última casilla
assert.equal(seq('|: A | 1. B :| 2. C | "D.C. al Fine" D |'), '0 1 0 2 3 0 2 3');
assert.equal(seq('|: A | "Fine" B :| C | "D.C." D |'), '0 1 0 1 2 3 0 1');
// repetición y D.C. en el mismo compás: primero repite, después salta
assert.equal(seq('| "Fine" A |: B | "D.C." C :|'), '0 1 2 1 2 0');
// anotación libre no hace nada
assert.equal(seq('| "Dulce" A | "Descanso" B |'), '0 1');
// formas de mostrar
const sp = (tk, v, semis = 0) => { M.setView(v); const d = M.spell(M.parseChord(tk), semis, true); M.setView(null); return d.root + d.qual + (d.bass ? '/' + d.bass : ''); };
assert.equal(sp('Bbmaj7', { notation: 'letras' }), 'B♭maj7');
assert.equal(sp('Bbmaj7', { notation: 'jazz' }), 'B♭△7');
assert.equal(sp('F#m7b5', { notation: 'jazz' }), 'F♯ø');
assert.equal(sp('Dm7', { notation: 'jazz' }), 'D-7');
assert.equal(sp('Bdim7', { notation: 'jazz' }), 'Bo7');
assert.equal(sp('CmMaj7', { notation: 'jazz' }), 'C-△7');
assert.equal(sp('Bbm7/Db', { notation: 'latino' }), 'Si♭m7/Re♭');
assert.equal(sp('G7', { notation: 'latino' }, 2), 'La7');
assert.equal(sp('Dm7', { notation: 'grados', key: 'C' }), 'IIm7');
assert.equal(sp('G7/B', { notation: 'grados', key: 'C' }), 'V7/VII');
assert.equal(sp('C', { notation: 'grados', key: 'Am' }), '♭III');
assert.equal(sp('E7', { notation: 'grados', key: 'Am' }, 3), 'V7');
assert.equal(sp('Dm7', { notation: 'grados', key: '' }), 'Dm7');
M.setView({ notation: 'grados', key: 'C' });
assert.equal(M.transposeName('Bb', 2, true), 'C');
M.setView(null);
console.log('saltos y formas de mostrar: ok');
