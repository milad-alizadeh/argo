/* PROTOTYPE — the PLATE view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
/* ================================================================ PLATE
   A drafting sheet. Incoming on the left because that is where a reader starts a sentence,
   outgoing on the right, the subject in the middle drawn as a full UML box, and a title block
   in the corner saying which revision of which repository this sheet was plotted from. */

const PW = 250, CW = 400, GAP = 120, ROWH = 17, HEADH = 34;

function plate() {
  const t = BY.get(state.sel);
  const ins = neighbours(t.id, 'in').slice(0, 9);
  const outs = neighbours(t.id, 'out').slice(0, 9);
  const insAll = neighbours(t.id, 'in').length, outsAll = neighbours(t.id, 'out').length;

  const satH = 44;
  const col = (list, x) => {
    const h = list.length * satH + (list.length - 1) * 14;
    let y = -h / 2;
    return list.map(r => { const b = { ...r, x, y, w: PW, h: satH }; y += satH + 14; return b; });
  };
  const L = col(ins, 0), R = col(outs, PW + CW + GAP * 2);

  const props = t.props.slice(0, 9), funcs = t.funcs.slice(0, 7), cases = t.cases.slice(0, 8);
  const lines = props.length + funcs.length + (cases.length ? 1 : 0);
  const secs = [props.length, funcs.length, cases.length].filter(Boolean).length;
  const cH = HEADH + 14 + lines * ROWH + secs * 10 + 20;
  const C = { x: PW + GAP, y: -cH / 2, w: CW, h: cH };

  const svg = el('svg');
  const defs = el('defs');
  for (const r of RELS) {
    defs.appendChild(el('marker', { id: 'h-' + r, viewBox: '0 0 12 12', refX: 11, refY: 6,
      markerWidth: 9, markerHeight: 9, orient: 'auto-start-reverse' },
      RHEAD[r] === 'tri' ? [el('path', { d: 'M1 1 L11 6 L1 11 Z', fill: '#0e141a', stroke: RCOLOR[r] })]
        : RHEAD[r] === 'circle' ? [el('circle', { cx: 6, cy: 6, r: 4, fill: 'none', stroke: RCOLOR[r] }),
          el('path', { d: 'M6 2.5 L6 9.5 M2.5 6 L9.5 6', stroke: RCOLOR[r] })]
          : RHEAD[r] === 'open' ? [el('path', { d: 'M2 2 L11 6 L2 10', fill: 'none', stroke: RCOLOR[r] })]
            : []));
    defs.appendChild(el('marker', { id: 't-' + r, viewBox: '0 0 14 12', refX: 1, refY: 6,
      markerWidth: 11, markerHeight: 11, orient: 'auto-start-reverse' },
      RTAIL[r] === 'diamond' ? [el('path', { d: 'M1 6 L7 2 L13 6 L7 10 Z', fill: RCOLOR[r], stroke: RCOLOR[r] })] : []));
  }
  svg.appendChild(defs);

  const all = [...L, ...R, C];
  const x0 = Math.min(...all.map(b => b.x)) - 190;
  const x1 = Math.max(...all.map(b => b.x + b.w)) + 190;
  const y0 = Math.min(...all.map(b => b.y)) - 96;
  const y1 = Math.max(...all.map(b => b.y + b.h)) + 128;
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svg.appendChild(el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'sheet-bg' }));
  const grid = el('g', { class: 'grid' });
  for (let gx = Math.ceil(x0 / 40) * 40; gx < x1; gx += 40) grid.appendChild(el('line', { x1: gx, y1: y0, x2: gx, y2: y1 }));
  for (let gy = Math.ceil(y0 / 40) * 40; gy < y1; gy += 40) grid.appendChild(el('line', { x1: x0, y1: gy, x2: x1, y2: gy }));
  svg.appendChild(grid);
  /* Corner ticks — a plotted sheet is trimmed to them, and they are the cheapest possible
     signal that what you are looking at claims to be a drawing rather than a picture. */
  for (const [cx, cy, dx, dy] of [[x0 + 14, y0 + 14, 1, 1], [x1 - 14, y0 + 14, -1, 1],
    [x0 + 14, y1 - 14, 1, -1], [x1 - 14, y1 - 14, -1, -1]]) {
    svg.appendChild(el('path', { class: 'tick', d: `M${cx} ${cy + 26 * dy} L${cx} ${cy} L${cx + 26 * dx} ${cy}`, fill: 'none' }));
  }

  svg.appendChild(el('text', { class: 'colhead', x: 0, y: y0 + 62 }, `NEEDED BY — ${insAll}`));
  svg.appendChild(el('text', { class: 'colhead', x: PW + CW + GAP * 2, y: y0 + 62 }, `NEEDS — ${outsAll}`));

  /* Every run lands on its OWN point along the centre box's edge. Converged on one point they
     drew a single fan, and a fan cannot be read one line at a time. */
  const port = (i, n) => C.y + (C.h * (i + 1)) / (n + 1);
  const wires = el('g');
  L.forEach((b, i) => wires.appendChild(wire(b.x + b.w, b.y + b.h / 2, C.x, port(i, L.length), b, 'start')));
  R.forEach((b, i) => wires.appendChild(wire(C.x + C.w, port(i, R.length), b.x, b.y + b.h / 2, b, 'end')));
  svg.appendChild(wires);

  for (const b of [...L, ...R]) svg.appendChild(satellite(b));
  svg.appendChild(centre(t, C, props, funcs, cases));
  svg.appendChild(titleBlock(t, x1, y1, insAll + outsAll));

  if (insAll > L.length) svg.appendChild(el('text', { class: 'more', x: 0, y: L[L.length - 1].y + satH + 26 }, `+${insAll - L.length} more`));
  if (outsAll > R.length) svg.appendChild(el('text', { class: 'more', x: PW + CW + GAP * 2, y: R[R.length - 1].y + satH + 26 }, `+${outsAll - R.length} more`));
  $('view').appendChild(svg);
}

/* One drafted run: out of the box, along a channel, into the next. The elbow is a quarter
   turn of radius 8 — a curve reads as a hand-drawn line, a mitre reads as a drawn one. */
function wire(x1, y1, x2, y2, r, satAt) {
  const mx = x1 + (x2 - x1) / 2;
  const R = Math.min(8, Math.abs(y2 - y1) / 2, Math.abs(mx - x1), Math.abs(x2 - mx)) || 0;
  const s = Math.sign(y2 - y1) || 1;
  const d = Math.abs(y2 - y1) < 1
    ? `M${x1} ${y1} L${x2} ${y2}`
    : `M${x1} ${y1} L${mx - R} ${y1} Q${mx} ${y1} ${mx} ${y1 + R * s} L${mx} ${y2 - R * s} Q${mx} ${y2} ${mx + R} ${y2} L${x2} ${y2}`;
  const g = el('g');
  g.appendChild(el('path', {
    d, fill: 'none', stroke: RCOLOR[r.top], 'stroke-width': 1.25,
    'stroke-dasharray': RDASH[r.top] || null,
    'marker-end': `url(#h-${r.top})`, 'marker-start': RTAIL[r.top] ? `url(#t-${r.top})` : null,
    opacity: .95,
  }));
  const lab = r.label ? r.label[0] : (r.rels.size > 1 ? [...r.rels.keys()].join('+') : r.top);
  const at = satAt === 'start' ? [x1 + 10, y1 - 6, 'start'] : [x2 - 10, y2 - 6, 'end'];
  g.appendChild(el('text', { class: 'elabel', x: at[0], y: at[1], 'text-anchor': at[2] }, lab));
  return g;
}

function satellite(b) {
  const t = BY.get(b.id);
  const g = el('g', { class: 'hit', transform: `translate(${b.x} ${b.y})` });
  g.appendChild(el('rect', { class: 'box-fill', width: b.w, height: b.h, rx: 3 }));
  g.appendChild(el('rect', { width: 3, height: b.h, fill: KCOLOR[t.kind] }));
  g.appendChild(el('text', { class: 'name', x: 13, y: 20 }, t.name.slice(0, 26)));
  g.appendChild(el('text', { class: 'stereo', x: 13, y: 34 }, `«${t.kind}» ${t.module} · ${t.members}`));
  g.onclick = () => select(b.id);
  return g;
}

function centre(t, C, props, funcs, cases) {
  const g = el('g', { transform: `translate(${C.x} ${C.y})` });
  g.appendChild(el('rect', { class: 'box-fill on', width: C.w, height: C.h, rx: 3 }));
  g.appendChild(el('rect', { width: C.w, height: 3, fill: KCOLOR[t.kind] }));
  g.appendChild(el('text', { class: 'stereo', x: 14, y: 19 }, `«${t.kind}»  ${t.access}  ${t.module}`));
  g.appendChild(el('text', { class: 'name', x: 14, y: 36, style: 'font-size:15px' }, t.name));
  let y = HEADH + 16;
  const rule = () => { g.appendChild(el('line', { x1: 0, y1: y - 11, x2: C.w, y2: y - 11, stroke: '#22303a' })); };
  const put = s => { g.appendChild(el('text', { class: 'member', x: 14, y }, s)); y += ROWH; };
  if (props.length) {
    rule();
    for (const p of props) put(`${p.mods.includes('static') ? '+ ' : '- '}${p.name}: ${p.type.slice(0, 34)}${p.arity === 'many' ? '  [*]' : p.arity === 'maybe' ? '  [0..1]' : ''}`);
    if (t.props.length > props.length) { g.appendChild(el('text', { class: 'more', x: 14, y: y - 3 }, `…${t.props.length - props.length} more`)); y += 14; }
  }
  if (cases.length) {
    rule(); y += 4;
    put(cases.join(' · ').slice(0, 52) + (t.cases.length > cases.length ? ` …${t.cases.length - cases.length}` : ''));
    y += 4;
  }
  if (funcs.length) {
    rule();
    for (const f of funcs) put(`${f.name}(${f.args ? '…' : ''})${f.ret ? ' → ' + f.ret.slice(0, 20) : ''}`);
    if (t.funcs.length > funcs.length) g.appendChild(el('text', { class: 'more', x: 14, y: y - 3 }, `…${t.funcs.length - funcs.length} more`));
  }
  return g;
}

function titleBlock(t, x1, y1, rels) {
  const w = 320, h = 86, x = x1 - w - 22, y = y1 - h - 22;
  const g = el('g', { class: 'titleblock', transform: `translate(${x} ${y})` });
  g.appendChild(el('rect', { width: w, height: h, fill: '#0c1217', stroke: '#2a3742' }));
  const rows = [
    ['SUBJECT', t.name], ['MODULE', `${t.module} · ${t.access}`],
    ['SHEET', `${t.members} members · ${rels} relations`],
    ['PLOTTED FROM', `${(D.head || '').slice(0, 7)}  ${(D.generated || '').slice(0, 10)}`],
  ];
  rows.forEach(([k, v], i) => {
    const ry = 20 + i * 18;
    g.appendChild(el('text', { class: 'k', x: 12, y: ry }, k));
    g.appendChild(el('text', { class: 'v', x: 116, y: ry }, String(v).slice(0, 30)));
    if (i) g.appendChild(el('line', { x1: 0, y1: ry - 13, x2: w, y2: ry - 13 }));
  });
  g.appendChild(el('line', { x1: 106, y1: 0, x2: 106, y2: h }));
  return g;
}
