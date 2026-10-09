// Dibuja el cifrado como imagen, siempre en negro sobre blanco, para exportarlo a PNG o PDF.
const Exporter = (() => {
  // Medidas de una hoja A4 a 150 puntos por pulgada.
  const W = 1240, PAGE_H = 1754, M = 70;
  const BAR_H = 104, LAB_H = 38, ROW_H = LAB_H + BAR_H + 14;
  const CHORD_MAX = 50;
  const HEAD = 130, HEAD_NEXT = 64, FOOT = 56;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function sheet(h) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, h);
    g.fillStyle = g.strokeStyle = '#000';
    g.textBaseline = 'alphabetic';
    return [c, g];
  }
  const vline = (g, x, y0, y1, w) => { g.fillRect(x - w / 2, y0, w, y1 - y0); };
  const dots = (g, x, mid) => {
    for (const d of [-14, 14]) { g.beginPath(); g.arc(x, mid + d, 4.5, 0, 7); g.fill(); }
  };

  function drawCoda(g, cx, cy) {
    g.save();
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(cx, cy, 8, 11, 0, 0, 7); g.stroke();
    g.fillRect(cx - 1.25, cy - 16, 2.5, 32);
    g.fillRect(cx - 14, cy - 1.25, 28, 2.5);
    g.restore();
  }
  function drawSegno(g, cx, cy) {
    g.save();
    g.font = `italic bold 30px Georgia, 'Times New Roman', serif`;
    g.textAlign = 'center';
    g.fillText('S', cx, cy + 11);
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - 11, cy + 14); g.lineTo(cx + 11, cy - 14); g.stroke();
    for (const [dx, dy] of [[-11, -3], [11, 3]]) { g.beginPath(); g.arc(cx + dx, cy + dy, 2.4, 0, 7); g.fill(); }
    g.restore();
  }

  // Renglones de hasta `cols` compases, respetando los cortes de renglón del cifrado.
  function rowsOf(bars, cols) {
    const rows = [];
    let cur = null, row = null;
    for (const b of bars) {
      if (b.row !== row || cur.length === cols) { cur = []; rows.push(cur); row = b.row; }
      cur.push(b);
    }
    return rows;
  }

  // Partes de un acorde (texto, fuente, desplazamiento, color) al tamaño s.
  function pieces(tk, s, semis, flats) {
    const c = Music.parseChord(tk);
    if (tk === '%' || !c) return [[tk, `${Math.round(s * (tk === '%' ? 0.9 : 0.5))}px ${FONT}`, 0, '#555']];
    const d = Music.spell(c, semis, flats);
    return [
      [d.root, `bold ${s}px ${FONT}`, 0],
      [d.qual, `600 ${Math.round(s * 0.6)}px ${FONT}`, -s * 0.3],
      [d.bass ? '/' + d.bass : '', `600 ${Math.round(s * 0.7)}px ${FONT}`, 0],
    ];
  }
  // El tamaño más grande, hasta el tope, con el que el acorde entra en su lugar.
  function fitSize(g, tk, room, semis, flats) {
    let s = CHORD_MAX;
    const width = () => pieces(tk, s, semis, flats).reduce((w, p) => { g.font = p[1]; return w + g.measureText(p[0]).width; }, 0);
    while (s > 16 && width() > room) s -= 2;
    return s;
  }
  function drawToken(g, tk, x, base, s, semis, flats) {
    if (tk === '_') return;
    for (const [text, font, dy, color] of pieces(tk, s, semis, flats)) {
      g.font = font;
      g.fillStyle = color || '#000';
      g.fillText(text, x, base + dy);
      x += g.measureText(text).width;
    }
    g.fillStyle = '#000';
  }

  function drawBar(g, b, x, y, w, last, semis, flats) {
    const top = y + LAB_H, bot = top + BAR_H, mid = top + BAR_H / 2;
    // letra de ensayo, casilla y anotación
    let lx = x + 4;
    if (b.section) {
      g.font = `bold 23px ${FONT}`;
      const tw = g.measureText(b.section).width + 16;
      g.fillRect(lx, y + 5, tw, 28);
      g.fillStyle = '#fff';
      g.fillText(b.section, lx + 8, y + 27);
      g.fillStyle = '#000';
      lx += tw + 10;
    }
    if (b.ending) {
      g.fillRect(lx, y + 6, 2, LAB_H - 6);
      g.fillRect(lx, y + 6, x + w - 8 - lx, 2);
      g.font = `bold 22px ${FONT}`;
      g.fillText(b.ending + '.', lx + 8, y + 31);
      lx += 44;
    }
    if (b.text) {
      const mark = Music.markOf(b);
      if (mark === 'segno') drawSegno(g, lx + 14, y + 20);
      else if (mark === 'coda') drawCoda(g, lx + 14, y + 20);
      else {
        // Fine, D.C., D.S. y "al Coda" van a la derecha; el texto libre, a la izquierda y en cursiva.
        const label = mark === 'alcoda' ? 'al' : b.text, sign = mark === 'alcoda' ? 30 : 0;
        g.font = `${mark ? '600' : 'italic'} 22px ${FONT}`;
        g.fillStyle = mark ? '#000' : '#444';
        const tw = g.measureText(label).width, tx = mark ? x + w - 12 - tw - sign : lx;
        g.fillText(label, tx, y + 30);
        if (sign) drawCoda(g, tx + tw + 18, y + 21);
        g.fillStyle = '#000';
      }
    }
    // barras de compás y repeticiones
    let left = x + 12, right = x + w - 8;
    if (b.repStart) { vline(g, x + 3, top, bot, 6); vline(g, x + 12, top, bot, 2); dots(g, x + 23, mid); left = x + 36; }
    else vline(g, x, top, bot, 2);
    if (b.repEnd) {
      vline(g, x + w - 3, top, bot, 6); vline(g, x + w - 12, top, bot, 2); dots(g, x + w - 23, mid);
      right = x + w - 34;
      if (b.times > 2) { g.font = `600 20px ${FONT}`; g.fillText('x' + b.times, x + w - 60, top + 22); }
    } else if (last) vline(g, x + w, top, bot, 2);
    if (b.showTs) {
      g.font = `bold 30px ${FONT}`;
      g.fillText(b.ts[0], left, mid - 4);
      g.fillText(b.ts[1], left, mid + 26);
      left += 34;
    }
    // acordes, ubicados según el tiempo en que entran
    const B = b.ts[0], n = b.items.length, pos = Music.positions(n, B), inner = right - left;
    const shown = [];
    b.items.forEach((it, k) => { if (it !== '.') shown.push(k); });
    const rooms = shown.map((k, j) => ((j + 1 < shown.length ? pos[shown[j + 1]] : B) - pos[k]) / B * inner - 8);
    const sizes = shown.map((k, j) => fitSize(g, b.items[k], rooms[j], semis, flats));
    shown.forEach((k, j) => {
      // los acordes con el mismo espacio quedan del mismo tamaño
      const s = Math.min(...sizes.filter((_, i) => Math.abs(rooms[i] - rooms[j]) < 1));
      drawToken(g, b.items[k], left + pos[k] / B * inner, mid + s * 0.36, s, semis, flats);
    });
  }

  // Devuelve una imagen por página (paged) o una sola imagen larga.
  // info: { before: [...], after: [...] } son datos que van en el renglón de abajo del título.
  function render(song, paged, info) {
    const ts = (song.ts || '4/4').split('/').map(Number), semis = song.transpose || 0;
    const bars = Music.parseChart(song.chart, ts);
    const flats = Music.useFlats(song.key || Music.firstChord(bars), semis);
    const key = song.key ? 'Tono: ' + Music.transposeName(song.key, semis, flats) : '';
    const meta = [...(info.before || []), key, ...(info.after || [])].filter(Boolean).join('  ·  ');
    const cols = Math.min(6, Math.max(2, Math.round(+song.cols) || 4));
    const rows = rowsOf(bars, cols), bw = (W - 2 * M) / cols;

    const pages = [];
    if (!paged) pages.push(rows);
    else {
      let cap = Math.floor((PAGE_H - M - HEAD - FOOT) / ROW_H), rest = rows.slice();
      do {
        pages.push(rest.splice(0, cap));
        cap = Math.floor((PAGE_H - M - HEAD_NEXT - FOOT) / ROW_H);
      } while (rest.length);
    }
    return pages.map((pageRows, p) => {
      const [c, g] = sheet(paged ? PAGE_H : M + HEAD + pageRows.length * ROW_H + FOOT);
      let y = M;
      if (p === 0) {
        g.font = `bold 46px ${FONT}`;
        g.fillText(song.title, M, y + 44, W - 2 * M);
        g.font = `24px ${FONT}`;
        g.fillStyle = '#444';
        g.fillText(meta, M, y + 84, W - 2 * M);
        y += HEAD;
      } else {
        g.font = `600 24px ${FONT}`;
        g.fillStyle = '#444';
        g.fillText(song.title, M, y + 26, W - 2 * M);
        y += HEAD_NEXT;
      }
      g.fillStyle = '#000';
      for (const row of pageRows) {
        row.forEach((b, i) => drawBar(g, b, M + i * bw, y, bw, i === row.length - 1, semis, flats));
        y += ROW_H;
      }
      g.font = `20px ${FONT}`;
      g.fillStyle = '#777';
      g.fillText('airrial.ar', M, c.height - 30);
      if (pages.length > 1) {
        const label = `${p + 1} / ${pages.length}`;
        g.fillText(label, W - M - g.measureText(label).width, c.height - 30);
      }
      return c;
    });
  }

  const blobOf = (canvas, type, quality) => new Promise(done => canvas.toBlob(done, type, quality));
  const png = canvas => blobOf(canvas, 'image/png');

  // PDF mínimo: una página A4 por imagen. Recibe las hojas en una lista o de a una (generador).
  async function pdf(canvases) {
    const enc = new TextEncoder(), parts = [], at = [];
    let len = 0;
    const put = d => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
    const obj = (n, ...body) => { at[n] = len; put(`${n} 0 obj\n`); body.forEach(put); put('\nendobj\n'); };
    // Cada hoja se pasa a JPEG apenas llega y se descarta, para no tenerlas todas en memoria.
    const pages = [];
    for (const c of canvases) {
      pages.push({ w: c.width, h: c.height, jpg: new Uint8Array(await (await blobOf(c, 'image/jpeg', 0.9)).arrayBuffer()) });
    }
    const n = pages.length, draw = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
    pages.forEach((c, i) => {
      const p = 3 + 3 * i;
      obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
      obj(p + 1, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
      obj(p + 2, `<< /Type /XObject /Subtype /Image /Width ${c.w} /Height ${c.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${c.jpg.length} >>\nstream\n`, c.jpg, '\nendstream');
    });
    const total = 2 + 3 * n, xref = len;
    put(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
    for (let k = 1; k <= total; k++) put(String(at[k]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  return { render, png, pdf };
})();
