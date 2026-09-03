/* PROTOTYPE — the PLATE view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
/* ================================================================ PLATE
   A drafting sheet. Incoming on the left because that is where a reader starts a sentence,
   outgoing on the right, the subject in the middle drawn as a full UML box, and a title block
   in the corner saying which revision of which repository this sheet was plotted from. */

const PW = 250, CW = 400, ROWH = 17, HEADH = 34, SATH = 44, CAP = 9;
const elk = new ELK();

/* The layout is ELK's, not ours. The hand-rolled version ran every left-hand elbow down the
   same mid-channel, so nine runs stacked into one line and only the top one could be traced. */
const SHEET = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': 20,
  'elk.layered.spacing.nodeNodeBetweenLayers': 190,
  'elk.spacing.edgeNode': 28,
  'elk.spacing.edgeEdge': 12,
  'elk.layered.spacing.edgeNodeBetweenLayers': 28,
  'elk.layered.spacing.edgeEdgeBetweenLayers': 12,
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
};

/* render() clears the stage and calls this without awaiting, so a click landing during a layout
   would otherwise paint the previous type's sheet over the new one — or, if the click was a view
   switch, over the wheel. */
let plateRun = 0;
/* elkjs round-trips the graph through its own model and hands back only the keys it knows, so
   the neighbour record each box and run stands for is kept beside the graph, not inside it. */
const plateRel = new Map();

async function plate() {
  const mine = ++plateRun;
  const t = BY.get(state.sel);
  const allIn = neighbours(t.id, 'in'), allOut = neighbours(t.id, 'out');
  const ins = allIn.slice(0, CAP), outs = allOut.slice(0, CAP);

  const props = t.props.slice(0, 9), funcs = t.funcs.slice(0, 7), cases = t.cases.slice(0, 8);
  const lines = props.length + funcs.length + (cases.length ? 1 : 0);
  const secs = [props.length, funcs.length, cases.length].filter(Boolean).length;
  const cH = HEADH + 14 + lines * ROWH + secs * 10 + 20;

  const laid = await elk.layout(sheet(ins, outs, cH));
  if (mine !== plateRun || state.v !== 'plate') return;
  draw(t, laid, ins, outs, allIn.length, allOut.length, props, funcs, cases);
}

/* Ports, one per relation, are the whole reason for ELK here: FIXED_ORDER keeps the heaviest
   partner topmost while ELK still chooses where each run leaves the box. ELK numbers ports
   clockwise from the top-left corner, so EAST runs top-down and WEST reads bottom-up. */
function sheet(ins, outs, cH) {
  const ports = [
    ...outs.map((_, i) => port('o' + i, 'EAST', i)),
    ...ins.map((_, i) => port('i' + i, 'WEST', outs.length + ins.length - 1 - i)),
  ];
  plateRel.clear();
  ins.forEach((r, i) => { plateRel.set('in:' + r.id, r); plateRel.set('ei' + i, r); });
  outs.forEach((r, i) => { plateRel.set('out:' + r.id, r); plateRel.set('eo' + i, r); });
  const sat = (r, side) => ({ id: side + r.id, width: PW, height: SATH });
  return {
    id: 'sheet',
    layoutOptions: SHEET,
    children: [
      ...ins.map(r => sat(r, 'in:')),
      { id: 'centre', width: CW, height: cH, ports,
        layoutOptions: { 'elk.portConstraints': 'FIXED_ORDER', 'elk.portAlignment.default': 'DISTRIBUTED' } },
      ...outs.map(r => sat(r, 'out:')),
    ],
    edges: [
      ...ins.map((r, i) => ({ id: 'ei' + i, sources: ['in:' + r.id], targets: ['i' + i], labels: [label(r, 'TAIL')] })),
      ...outs.map((r, i) => ({ id: 'eo' + i, sources: ['o' + i], targets: ['out:' + r.id], labels: [label(r, 'HEAD')] })),
    ],
  };
}

const port = (id, side, index) => ({ id, width: 1, height: 1,
  layoutOptions: { 'elk.port.side': side, 'elk.port.index': String(index) } });

/* The label names the member, so it belongs where the member is declared — the satellite end,
   which is the TAIL of an incoming run and the HEAD of an outgoing one. Handing it to ELK as a
   sized label is what keeps nine of them off each other and off the runs. */
function label(r, placement) {
  const text = r.label ? r.label[0] : (r.rels.size > 1 ? [...r.rels.keys()].join('+') : r.top);
  return { text, width: text.length * 5.8 + 6, height: 13,
    layoutOptions: { 'elk.edgeLabels.placement': placement } };
}

function draw(t, g, ins, outs, insAll, outsAll, props, funcs, cases) {
  const nodes = new Map(g.children.map(n => [n.id, n]));
  const C = nodes.get('centre');
  const svg = el('svg');
  svg.appendChild(markers());

  /* The sheet has a floor size, so clicking from a 39-relation type to a lone one keeps the
     scale: type that doubles between selections reads as a different drawing, not the next one. */
  const padX = Math.max(190, (1180 - g.width) / 2 + 190);
  const padY = Math.max(96, (560 - g.height) / 2 + 96);
  const x0 = -padX, x1 = g.width + padX, y0 = -padY, y1 = g.height + padY + 32;
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.appendChild(el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'sheet-bg' }));
  svg.appendChild(grid(x0, y0, x1, y1));

  for (const n of g.children) if (n.id !== 'centre') svg.appendChild(satellite(n));
  svg.appendChild(centre(t, C, props, funcs, cases));

  /* The runs go on TOP of the boxes. A tail marker is drawn backwards from the start point, so
     under the boxes the filled diamond that says which end is the whole was never once visible;
     ELK's routes stay out of every box, so there is nothing for them to hide. */
  const runs = el('g', { class: 'runs' });
  for (const e of g.edges) runs.appendChild(wire(e));
  svg.appendChild(runs);

  /* An empty column has no box to sit over, so its header falls back to the centre box's edge —
     both at x=0 they printed on top of each other and read as one word. */
  const colX = (list, side, away) => list.length ? nodes.get(side + list[0].id).x : away;
  svg.appendChild(el('text', { class: 'colhead', x: colX(ins, 'in:', x0 + 60), y: y0 + 62 }, `NEEDED BY — ${insAll}`));
  svg.appendChild(el('text', { class: 'colhead', x: colX(outs, 'out:', C.x + C.width + 40), y: y0 + 62 }, `NEEDS — ${outsAll}`));
  more(svg, nodes, ins, 'in:', insAll);
  more(svg, nodes, outs, 'out:', outsAll);
  svg.appendChild(titleBlock(t, x1, y1, insAll + outsAll));
  $('view').appendChild(svg);
}

function more(svg, nodes, list, side, all) {
  if (all <= list.length) return;
  const last = nodes.get(side + list[list.length - 1].id);
  svg.appendChild(el('text', { class: 'more', x: last.x, y: last.y + last.height + 26 }, `+${all - list.length} more`));
}

function markers() {
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
  return defs;
}

/* Corner ticks — a plotted sheet is trimmed to them, and they are the cheapest possible
   signal that what you are looking at claims to be a drawing rather than a picture. */
function grid(x0, y0, x1, y1) {
  const g = el('g');
  const lines = el('g', { class: 'grid' });
  for (let gx = Math.ceil(x0 / 40) * 40; gx < x1; gx += 40) lines.appendChild(el('line', { x1: gx, y1: y0, x2: gx, y2: y1 }));
  for (let gy = Math.ceil(y0 / 40) * 40; gy < y1; gy += 40) lines.appendChild(el('line', { x1: x0, y1: gy, x2: x1, y2: gy }));
  g.appendChild(lines);
  for (const [cx, cy, dx, dy] of [[x0 + 14, y0 + 14, 1, 1], [x1 - 14, y0 + 14, -1, 1],
    [x0 + 14, y1 - 14, 1, -1], [x1 - 14, y1 - 14, -1, -1]]) {
    g.appendChild(el('path', { class: 'tick', d: `M${cx} ${cy + 26 * dy} L${cx} ${cy} L${cx + 26 * dx} ${cy}`, fill: 'none' }));
  }
  return g;
}

/* One drafted run, on ELK's route. The elbow is a quarter turn of radius 8 — a curve reads as a
   hand-drawn line, a mitre reads as a drawn one. */
function wire(e) {
  const s = e.sections[0];
  const pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint];
  const r = plateRel.get(e.id);
  const g = el('g');
  g.appendChild(el('path', {
    d: elbows(pts), fill: 'none', stroke: RCOLOR[r.top], 'stroke-width': 1.25,
    'stroke-dasharray': RDASH[r.top] || null,
    'marker-end': `url(#h-${r.top})`, 'marker-start': RTAIL[r.top] ? `url(#t-${r.top})` : null,
    opacity: .95,
  }));
  const l = e.labels && e.labels[0];
  /* ELK butts the label against the box it belongs to; the 8 is the gap that keeps the first
     letter off the border, and it goes the other way on the outgoing side. */
  const inset = e.id.startsWith('ei') ? 8 : -8;
  if (l) g.appendChild(el('text', { class: 'elabel', x: l.x + inset, y: l.y + 10 }, l.text));
  return g;
}

function elbows(pts) {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const inLen = Math.hypot(b.x - a.x, b.y - a.y), outLen = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(8, inLen / 2, outLen / 2);
    const u = { x: (b.x - a.x) / (inLen || 1), y: (b.y - a.y) / (inLen || 1) };
    const v = { x: (c.x - b.x) / (outLen || 1), y: (c.y - b.y) / (outLen || 1) };
    d += ` L${b.x - u.x * r} ${b.y - u.y * r} Q${b.x} ${b.y} ${b.x + v.x * r} ${b.y + v.y * r}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last.x} ${last.y}`;
}

function satellite(n) {
  const id = plateRel.get(n.id).id;
  const t = BY.get(id);
  const g = el('g', { class: 'hit', transform: `translate(${n.x} ${n.y})` });
  g.appendChild(el('rect', { class: 'box-fill', width: n.width, height: n.height, rx: 3 }));
  g.appendChild(el('rect', { width: 3, height: n.height, fill: KCOLOR[t.kind] }));
  g.appendChild(el('text', { class: 'name', x: 13, y: 20 }, t.name.slice(0, 26)));
  g.appendChild(el('text', { class: 'stereo', x: 13, y: 34 }, `«${t.kind}» ${t.module} · ${t.members}`));
  g.onclick = () => select(id);
  return g;
}

function centre(t, C, props, funcs, cases) {
  const g = el('g', { transform: `translate(${C.x} ${C.y})` });
  g.appendChild(el('rect', { class: 'box-fill on', width: C.width, height: C.height, rx: 3 }));
  g.appendChild(el('rect', { width: C.width, height: 3, fill: KCOLOR[t.kind] }));
  g.appendChild(el('text', { class: 'stereo', x: 14, y: 19 }, `«${t.kind}»  ${t.access}  ${t.module}`));
  g.appendChild(el('text', { class: 'name', x: 14, y: 36, style: 'font-size:15px' }, t.name));
  let y = HEADH + 16;
  const rule = () => { g.appendChild(el('line', { x1: 0, y1: y - 11, x2: C.width, y2: y - 11, stroke: '#22303a' })); };
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
