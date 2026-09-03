/* PROTOTYPE — three readings of one type graph. See atlas-class.html for the question. */

const $ = id => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const el = (n, a = {}, kids = []) => {
  const e = document.createElementNS(SVG, n);
  for (const k in a) if (a[k] !== undefined && a[k] !== null) e.setAttribute(k, a[k]);
  for (const c of [].concat(kids)) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
};
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const KINDS = ['struct', 'class', 'enum', 'protocol', 'actor'];
const KCOLOR = { struct: '#7fe8ff', class: '#ffb061', enum: '#b79bff', protocol: '#5ce6a8', actor: '#ff7a9c' };
const RELS = ['conforms', 'inherits', 'nested', 'holds', 'uses'];
const RCOLOR = { conforms: '#5ce6a8', inherits: '#5ce6a8', nested: '#b79bff', holds: '#7fe8ff', uses: '#5b6f7d' };
const RDASH = { uses: '5 4', nested: '2 4' };
/* UML says the diamond sits on the WHOLE, the hollow triangle on the GENERAL, and a dependency
   is a dashed line with an open head. Keeping that is the whole point of the plate: a reader who
   knows the notation should not have to learn a private one to read this repository. */
const RHEAD = { conforms: 'tri', inherits: 'tri', holds: 'none', uses: 'open', nested: 'circle' };
const RTAIL = { holds: 'diamond' };

const state = {
  v: 'plate', sel: null, q: '',
  kinds: new Set(KINDS), tests: false,
};

let D = null, BY = new Map(), OUT = new Map(), IN = new Map(), DEG = new Map(), MODULES = [];

/* ---------------------------------------------------------------- boot */

fetch('atlas-types.json', { cache: 'no-store' }).then(r => r.json()).then(j => {
  D = j;
  for (const t of D.types) {
    t.test = /\/Tests?\//.test(t.path) || /Tests$/.test(t.module);
    t.members = t.props.length + t.funcs.length + t.cases.length;
    BY.set(t.id, t);
    OUT.set(t.id, []); IN.set(t.id, []); DEG.set(t.id, 0);
  }
  for (const e of D.edges) {
    if (!BY.has(e.from) || !BY.has(e.to)) continue;
    OUT.get(e.from).push(e); IN.get(e.to).push(e);
    DEG.set(e.from, DEG.get(e.from) + 1); DEG.set(e.to, DEG.get(e.to) + 1);
  }
  const seen = new Map();
  for (const t of D.types) seen.set(t.module, (seen.get(t.module) || 0) + 1);
  MODULES = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);

  readURL();
  if (!state.sel) {
    const best = D.types.filter(t => !t.test).sort((a, b) => DEG.get(b.id) - DEG.get(a.id))[0];
    state.sel = best ? best.id : null;
  }
  chrome();
  render();
});

function readURL() {
  const p = new URLSearchParams(location.search);
  if (['plate', 'wheel', 'ledger'].includes(p.get('v'))) state.v = p.get('v');
  if (p.get('t') && BY.has(p.get('t'))) state.sel = p.get('t');
}
/* Stamped once per gesture, never per frame: a replaceState on every pointer move stalls the
   renderer for whole seconds with nothing in the console to say why. */
function stampURL() {
  const p = new URLSearchParams();
  p.set('v', state.v);
  if (state.sel) p.set('t', state.sel);
  history.replaceState(null, '', '?' + p);
}

/* ---------------------------------------------------------------- chrome */

/* Three SCALES, not three skins: one type, one module, the whole repository. A reader who has
   the plate open and wants the next question answered has to change scale to ask it. */
const VIEWS = [
  ['plate', 'Plate', 'one type, drafted'],
  ['wheel', 'Wheel', 'one module, chorded'],
  ['ledger', 'Ledger', 'the whole matrix'],
];

function chrome() {
  $('bar').innerHTML = VIEWS.map(([k, n, s]) =>
    `<button data-v="${k}" aria-pressed="${state.v === k}">${n}<small>${s}</small></button>`).join('');
  for (const b of $('bar').children) b.onclick = () => { state.v = b.dataset.v; stampURL(); render(); };

  const chips = KINDS.map(k =>
    `<button class="chip k-${k}" data-kind="${k}" aria-pressed="${state.kinds.has(k)}">${k}</button>`).join('')
    + `<button class="chip plain" data-tests aria-pressed="${state.tests}">tests</button>`;
  $('filters').innerHTML = chips;
  for (const b of $('filters').children) {
    b.onclick = () => {
      if (b.dataset.tests !== undefined) state.tests = !state.tests;
      else state.kinds.has(b.dataset.kind) ? state.kinds.delete(b.dataset.kind) : state.kinds.add(b.dataset.kind);
      chrome(); render();
    };
  }
  $('q').oninput = () => { state.q = $('q').value.trim(); rail(); if (state.v === 'ledger') render(); };
}

const passes = t => state.kinds.has(t.kind) && (state.tests || !t.test)
  && (!state.q || t.name.toLowerCase().includes(state.q.toLowerCase())
    || t.module.toLowerCase().includes(state.q.toLowerCase()));

/* ---------------------------------------------------------------- the index rail */

function rail() {
  const hits = D.types.filter(passes);
  $('count').textContent = `${hits.length} types · ${D.edges.length} relations`;
  const byMod = new Map();
  for (const t of hits) (byMod.get(t.module) || byMod.set(t.module, []).get(t.module)).push(t);
  let html = '', n = 0;
  for (const m of MODULES) {
    const list = (byMod.get(m) || []).sort((a, b) => DEG.get(b.id) - DEG.get(a.id));
    if (!list.length) continue;
    html += `<div class="grp">${esc(m)} <span style="float:right;opacity:.7">${list.length}</span></div>`;
    for (const t of list) {
      if (n++ > 420) break;
      html += `<div class="row${t.test ? ' dim' : ''}" data-id="${esc(t.id)}" aria-selected="${state.sel === t.id}">`
        + `<i class="dot" style="background:${KCOLOR[t.kind]}"></i>`
        + `<span class="nm">${esc(t.name)}</span><span class="dg">${DEG.get(t.id)}</span></div>`;
    }
    if (n > 420) break;
  }
  if (n > 420) html += `<div class="grp" style="position:static">…${hits.length - 420} more — narrow the search</div>`;
  $('list').innerHTML = html;
  for (const r of $('list').querySelectorAll('.row')) r.onclick = () => select(r.dataset.id);
}

function select(id) {
  state.sel = id;
  stampURL();
  render();
  const r = $('list').querySelector(`.row[data-id="${CSS.escape(id)}"]`);
  if (r) r.scrollIntoView({ block: 'nearest' });
}

/* ---------------------------------------------------------------- the reading card */

function card() {
  const c = $('card');
  const t = BY.get(state.sel);
  if (!t) { c.hidden = true; return; }
  c.hidden = false;
  const sig = f => `${f.name}(${f.args.split(',').length && f.args ? '…' : ''})${f.ret ? ' → ' + esc(f.ret.slice(0, 26)) : ''}`;
  const rel = (list, dir) => {
    const seen = new Map();
    for (const e of list) {
      const k = dir === 'out' ? e.to : e.from;
      seen.set(k, (seen.get(k) || 0) + e.n);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
      .map(([k, n]) => `<span class="lnk" data-go="${esc(k)}">${esc(k)}</span><span style="color:var(--mute)"> ${n}</span>`).join('  ');
  };
  c.innerHTML = `<div class="kind" style="color:${KCOLOR[t.kind]}">${t.kind}${t.test ? ' · test' : ''}</div>`
    + `<h2>${esc(t.name)}</h2>`
    + `<div class="where">${esc(t.path)}:${t.line}</div>`
    + `<dl><dt>module</dt><dd>${esc(t.module)}</dd>`
    + `<dt>access</dt><dd>${esc(t.access)}</dd>`
    + `<dt>size</dt><dd>${t.loc} lines · ${t.files.length} file${t.files.length > 1 ? 's' : ''}${t.exts ? ` · ${t.exts} ext` : ''}</dd>`
    + (t.foreign && t.foreign.length ? `<dt>adopts</dt><dd>${esc(t.foreign.join(', '))}</dd>` : '')
    + (t.parent ? `<dt>inside</dt><dd><span class="lnk" data-go="${esc(t.parent)}">${esc(t.parent)}</span></dd>` : '')
    + `</dl>`
    + (t.props.length ? `<h3>holds ${t.props.length}</h3><div class="mem">`
      + t.props.slice(0, 12).map(p => `<b>${esc(p.name)}</b>: ${esc(p.type.slice(0, 30))}`).join('<br>')
      + (t.props.length > 12 ? `<br>…${t.props.length - 12} more` : '') + '</div>' : '')
    + (t.cases.length ? `<h3>cases ${t.cases.length}</h3><div class="mem">${t.cases.slice(0, 14).map(esc).join(' · ')}</div>` : '')
    + (t.funcs.length ? `<h3>does ${t.funcs.length}</h3><div class="mem">`
      + t.funcs.slice(0, 10).map(f => `<b>${sig(f)}</b>`).join('<br>')
      + (t.funcs.length > 10 ? `<br>…${t.funcs.length - 10} more` : '') + '</div>' : '')
    + (OUT.get(t.id).length ? `<h3>needs</h3><div class="mem">${rel(OUT.get(t.id), 'out')}</div>` : '')
    + (IN.get(t.id).length ? `<h3>needed by</h3><div class="mem">${rel(IN.get(t.id), 'in')}</div>` : '');
  for (const a of c.querySelectorAll('.lnk')) a.onclick = () => select(a.dataset.go);
}

/* ---------------------------------------------------------------- render */

function render() {
  rail();
  for (const b of $('bar').children) b.setAttribute('aria-pressed', String(state.v === b.dataset.v));
  $('view').textContent = '';
  if (state.v === 'ledger') ledger();
  else if (!BY.get(state.sel)) $('view').appendChild(Object.assign(document.createElement('div'), { id: 'empty', textContent: 'pick a type' }));
  else if (state.v === 'plate') plate();
  else wheel();
  card();
}

/* neighbours of a type, folded to one entry per partner, heaviest first */
function neighbours(id, dir) {
  const list = dir === 'out' ? OUT.get(id) : IN.get(id);
  const by = new Map();
  for (const e of list) {
    const k = dir === 'out' ? e.to : e.from;
    if (!BY.get(k) || !passes(BY.get(k))) continue;
    if (!by.has(k)) by.set(k, { id: k, n: 0, rels: new Map() });
    const r = by.get(k);
    r.n += e.n;
    r.rels.set(e.rel, (r.rels.get(e.rel) || 0) + e.n);
    if (e.labels.length) r.label = (r.label || []).concat(e.labels).slice(0, 3);
  }
  for (const r of by.values()) r.top = RELS.find(k => r.rels.has(k)) || 'uses';
  return [...by.values()].sort((a, b) => b.n - a.n);
}

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

/* ================================================================ WHEEL
   The plate can only ever show one neighbourhood and the ledger cannot show an edge, so the
   scale between them needs its own notation: ONE MODULE, every type it declares set round a
   circle, and every relation between two of them drawn as a chord across the middle. What you
   read here is shape — a module whose chords all cross the centre is a module with no interior
   structure, and one whose chords hug the rim is a module that is really several. */

const WR = 372, WLAB = 384;

function wheel() {
  const home = BY.get(state.sel);
  const mod = home.module;
  const all = D.types.filter(t => t.module === mod && passes(t));
  const CAP = 96;
  const shown = all.slice().sort((x, y) => DEG.get(y.id) - DEG.get(x.id)).slice(0, CAP);
  if (!shown.some(t => t.id === home.id)) shown[shown.length - 1] = home;
  /* Round the rim by KIND, so the wheel's own quadrants mean something before a single chord
     is followed: the protocols sit together, and you can see at a glance how few there are. */
  shown.sort((x, y) => (KINDS.indexOf(x.kind) - KINDS.indexOf(y.kind))
    || (DEG.get(y.id) - DEG.get(x.id)) || x.name.localeCompare(y.name));
  const N = shown.length;
  const at = new Map(shown.map((t, i) => [t.id, i]));
  const ang = i => -Math.PI / 2 + (i + .5) * (Math.PI * 2 / N);
  const P = (i, r) => [Math.cos(ang(i)) * r, Math.sin(ang(i)) * r];

  const VW = 1500, VH = 1080;
  const svg = el('svg', { viewBox: `${-VW / 2} ${-VH / 2} ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
  svg.appendChild(el('rect', { x: -VW / 2, y: -VH / 2, width: VW, height: VH, fill: '#0b0f12' }));

  /* Kind bands: one arc per contiguous run of the same kind. */
  const step = Math.PI * 2 / N;
  let run = 0;
  for (let i = 1; i <= N; i++) {
    if (i < N && shown[i].kind === shown[run].kind) continue;
    const a0 = ang(run) - step / 2, a1 = ang(i - 1) + step / 2;
    const arc = (r, s0, s1) => `${Math.cos(s0) * r} ${Math.sin(s0) * r} A ${r} ${r} 0 ${s1 - s0 > Math.PI ? 1 : 0} 1 ${Math.cos(s1) * r} ${Math.sin(s1) * r}`;
    svg.appendChild(el('path', {
      d: `M ${arc(WR + 8, a0 + .004, a1 - .004)}`, fill: 'none',
      stroke: KCOLOR[shown[run].kind], 'stroke-width': 3, opacity: .8,
    }));
    run = i;
  }

  /* Chords under the rim, so a name is never covered by a line. */
  const chords = el('g');
  const lit = new Set([home.id]);
  const edges = D.edges.filter(e => at.has(e.from) && at.has(e.to));
  for (const e of edges) {
    const on = e.from === home.id || e.to === home.id;
    const [x1, y1] = P(at.get(e.from), WR - 4), [x2, y2] = P(at.get(e.to), WR - 4);
    if (on) { lit.add(e.from); lit.add(e.to); }
    chords.appendChild(el('path', {
      d: `M${x1} ${y1} Q 0 0 ${x2} ${y2}`, fill: 'none', stroke: RCOLOR[e.rel],
      'stroke-width': on ? 1.7 : .75, opacity: on ? .95 : .10,
    }));
  }
  svg.appendChild(chords);

  shown.forEach((t, i) => {
    const on = lit.has(t.id), me = t.id === home.id;
    const [nx, ny] = P(i, WR - 4);
    const g = el('g', { class: 'hit' });
    g.appendChild(el('circle', { cx: nx, cy: ny, r: me ? 5.5 : on ? 3.4 : 2.2, fill: KCOLOR[t.kind], opacity: on ? 1 : .45 }));
    const a = ang(i), flip = Math.cos(a) < 0;
    const [lx, ly] = P(i, WLAB);
    g.appendChild(el('text', {
      class: 'sat', x: flip ? -6 : 6, y: 3.4,
      transform: `translate(${lx} ${ly}) rotate(${(flip ? a + Math.PI : a) * 180 / Math.PI})`,
      'text-anchor': flip ? 'end' : 'start',
      fill: me ? '#ffffff' : on ? '#d8e4ec' : '#55666f',
      style: me ? 'font-weight:600' : '',
    }, t.name));
    g.onclick = () => select(t.id);
    svg.appendChild(g);
  });

  const inner = edges.filter(e => e.from === home.id || e.to === home.id).length;
  $('view').appendChild(svg);
  /* Set in the middle of the wheel this caption was crossed by forty chords. It is a caption,
     not a hub, and nothing is gained by drawing it where the lines are densest. */
  const cap = document.createElement('div');
  cap.id = 'caption';
  cap.innerHTML = `<h4>${esc(mod)}</h4>`
    + `<div>${all.length} types · ${edges.length} relations between them</div>`
    + `<div style="color:#7fe8ff">${esc(home.name)} — ${inner} of them</div>`
    + (all.length > N ? `<div style="color:#5f717e">rim shows the ${N} most connected</div>` : '');
  $('view').appendChild(cap);
}

/* ================================================================ LEDGER
   Neither of the other two can show more than one neighbourhood, and a repository is not one
   neighbourhood. So: no edges at all. Every type is a row AND a column, ordered so that what a
   thing needs sits above it — which puts every cycle in the codebase above the diagonal, in
   rose, where you can count them. */

function ledger() {
  const types = D.types.filter(passes);
  const rank = order(types);
  const N = rank.length;
  if (!N) { $('view').appendChild(Object.assign(document.createElement('div'), { id: 'empty', textContent: 'nothing matches' })); return; }
  const idx = new Map(rank.map((t, i) => [t.id, i]));

  const wrap = document.createElement('div');
  const cv = document.createElement('canvas');
  wrap.appendChild(cv);
  const legend = document.createElement('div');
  legend.id = 'legend';
  legend.innerHTML = '<h4>relation</h4>'
    + [['holds', 'holds'], ['uses', 'uses'], ['conforms', 'is a'], ['nested', 'inside']]
      .map(([r, n]) => `<div><i class="sw" style="background:${RCOLOR[r]}"></i>${n}</div>`).join('')
    + `<div><i class="sw" style="background:#ff7a9c"></i>back edge — a cycle</div>`;
  wrap.appendChild(legend);
  const out = document.createElement('div');
  out.id = 'readout';
  out.innerHTML = `<b>${N}</b> types · <b>${D.edges.length}</b> relations<br><span style="color:var(--mute)">hover a cell</span>`;
  wrap.appendChild(out);
  $('view').appendChild(wrap);

  const dpr = devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);

  const pad = 58;
  const size = Math.min(W - pad * 2, H - pad * 2);
  const s = size / N;
  const X = i => pad + i * s, Y = i => pad + i * s;

  g.fillStyle = '#0b0f12'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0d141a'; g.fillRect(pad, pad, size, size);

  /* Module blocks first, so a cell always reads on top of the neighbourhood it belongs to. */
  let run = 0;
  const blocks = [];
  for (let i = 0; i < N; i++) {
    if (i && rank[i].module !== rank[i - 1].module) { blocks.push([run, i, rank[i - 1].module]); run = i; }
  }
  if (N) blocks.push([run, N, rank[N - 1].module]);
  for (const [a, b] of blocks) {
    g.fillStyle = 'rgba(255,255,255,.022)';
    g.fillRect(X(a), Y(a), (b - a) * s, (b - a) * s);
  }

  const cells = [];
  for (const e of D.edges) {
    const i = idx.get(e.from), j = idx.get(e.to);
    if (i === undefined || j === undefined) continue;
    const back = j < i;
    g.fillStyle = back ? '#ff7a9c' : RCOLOR[e.rel];
    g.globalAlpha = e.rel === 'uses' ? .55 : .9;
    g.fillRect(X(j), Y(i), Math.max(1.2, s), Math.max(1.2, s));
    cells.push([i, j, e]);
  }
  g.globalAlpha = 1;

  g.strokeStyle = '#243039'; g.lineWidth = 1;
  /* A block narrower than its own name gets no name: three module labels overprinted in the
     corner said less than none, and the block outline is the fact that matters. */
  for (const [a, b, m] of blocks) {
    g.strokeRect(X(a) + .5, Y(a) + .5, (b - a) * s, (b - a) * s);
    if ((b - a) * s < 62) continue;
    g.fillStyle = '#7c8c97'; g.font = '600 9px -apple-system, system-ui';
    g.save(); g.translate(X(a) + 4, pad - 8); g.fillText(m.toUpperCase(), 0, 0); g.restore();
    g.save(); g.translate(pad - 8, Y(a) + 4); g.rotate(-Math.PI / 2);
    g.fillText(m.toUpperCase(), -((b - a) * s) + 2, 0); g.restore();
  }
  g.strokeStyle = '#33434e';
  g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(N), Y(N)); g.stroke();

  /* The selection is marked HERE too, or the rail and the matrix are two pages of one book
     with no page numbers: a name picked in the list has to be findable in the grid. */
  const me = idx.get(state.sel);
  if (me !== undefined) {
    g.fillStyle = 'rgba(127,232,255,.13)';
    g.fillRect(pad, Y(me) - .5, size, Math.max(1.6, s));
    g.fillRect(X(me) - .5, pad, Math.max(1.6, s), size);
    g.fillStyle = '#7fe8ff'; g.font = '600 10px ui-monospace, Menlo, monospace';
    g.fillText(rank[me].name, pad + 6, Y(me) - 6);
  }

  const marks = document.createElement('canvas');
  marks.width = cv.width; marks.height = cv.height;
  marks.style.cssText = 'position:absolute;inset:0';
  wrap.appendChild(marks);
  const mg = marks.getContext('2d'); mg.scale(dpr, dpr);

  const back = cells.filter(c => c[1] < c[0]).length;
  const cross = (i, j) => {
    mg.clearRect(0, 0, W, H);
    if (i === null) return;
    mg.fillStyle = 'rgba(127,232,255,.10)';
    mg.fillRect(pad, Y(i), size, Math.max(1, s));
    mg.fillRect(X(j), pad, Math.max(1, s), size);
  };

  marks.onmousemove = ev => {
    const r = marks.getBoundingClientRect();
    const i = Math.floor((ev.clientY - r.top - pad) / s), j = Math.floor((ev.clientX - r.left - pad) / s);
    if (i < 0 || j < 0 || i >= N || j >= N) { cross(null); return; }
    cross(i, j);
    const from = rank[i], to = rank[j];
    const e = D.edges.find(x => x.from === from.id && x.to === to.id);
    out.innerHTML = `<b>${esc(from.name)}</b> <span style="color:var(--mute)">${esc(from.module)}</span><br>`
      + (e ? `<span class="rel" style="color:${j < i ? '#ff7a9c' : RCOLOR[e.rel]}">${j < i ? 'back edge · ' : ''}${e.rel}</span> `
        + `<b>${esc(to.name)}</b>${e.labels.length ? ` <span style="color:var(--mute)">${esc(e.labels.join(', '))}</span>` : ''}`
        : `<span style="color:var(--mute)">no relation to</span> ${esc(to.name)}`)
      + `<br><span style="color:var(--mute)">${N} types · ${back} back edges</span>`;
  };
  marks.onmouseleave = () => cross(null);
  marks.onclick = ev => {
    const r = marks.getBoundingClientRect();
    const i = Math.floor((ev.clientY - r.top - pad) / s);
    if (i >= 0 && i < N) select(rank[i].id);
  };
}

/* Types sorted so dependencies climb: module first (the blocks are what a reader recognises),
   then by how deep in the need-chain a type sits. Cycles make "deep" ill-defined, so the walk
   is bounded rather than exact — an ordering that is nearly right shows nearly all the cycles,
   and an exact one is a solver this prototype does not need. */
function order(types) {
  const set = new Set(types.map(t => t.id));
  const depth = new Map(types.map(t => [t.id, 0]));
  for (let pass = 0; pass < 6; pass++) {
    for (const t of types) {
      let d = 0;
      for (const e of OUT.get(t.id)) if (set.has(e.to) && e.to !== t.id) d = Math.max(d, depth.get(e.to) + 1);
      depth.set(t.id, d);
    }
  }
  const mi = new Map(MODULES.map((m, i) => [m, i]));
  return types.slice().sort((a, b) =>
    (mi.get(a.module) - mi.get(b.module))
    || (depth.get(b.id) - depth.get(a.id))
    || a.name.localeCompare(b.name));
}

/* ---------------------------------------------------------------- keys */

addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); $('q').select(); }
  else if (e.key === 'Escape') { $('q').value = ''; state.q = ''; $('q').blur(); rail(); if (state.v === 'ledger') render(); }
  else if (!e.metaKey && !e.ctrlKey && '123'.includes(e.key) && document.activeElement !== $('q')) {
    state.v = VIEWS[+e.key - 1][0]; stampURL(); render();
  }
});
addEventListener('resize', () => { if (state.v === 'ledger') render(); });
