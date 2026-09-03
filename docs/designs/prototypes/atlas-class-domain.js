/* PROTOTYPE — the DOMAIN view. Globals come from atlas-class.js. */
/* ================================================================ DOMAIN
   One inferred domain, at two scales, and the second scale is the PLATE.

   Three things the research settled, and this file obeys all three. Force-directed layout is the
   documented way to make a hairball out of a dependency graph, so the overview is CONCENTRIC:
   ranked by degree, the most-connected types in the middle, which is the one layout family where
   "hubs in the centre" is a real feature rather than a hope (Cytoscape's `concentric` scores by
   degree the same way). Forty edges ending at one point on a box must cross each other to reach
   their sources, which is a port problem and not a line problem — ELK's FIXED_ORDER ports are
   the fix, and the Plate already has them. And the type of a relation belongs in the arrowhead,
   never in a word repeated down every line: "comprehensiveness is the enemy of comprehensibility"
   (Fowler), so a label earns its place only by removing a real ambiguity — a role name, or a
   multiplicity that is not 1. The Plate obeys all of that already, so drilling into a type hands
   over to it rather than drawing a worse second version of the same diagram. */

let domCache = null;

function domainView() {
  if (!state.dom) {
    $('view').appendChild(Object.assign(document.createElement('div'),
      { id: 'empty', textContent: 'pick a domain on the left' }));
    return;
  }
  /* The drill IS the plate — same sheet, same ELK, same UML. The button back to the domain is
     appended by plate() itself, because ELK's layout is asynchronous and the sheet does not
     exist yet at the point this returns. */
  if (state.focus && BY.get(state.focus)) { plate(); return; }
  const key = [state.dom, [...state.kinds].sort().join(','), state.tests, state.q, domCols()].join('|');
  if (!domCache || domCache.key !== key) domCache = { key, ...domLayout() };
  drawDomain(domCache);
}

/* ---------------------------------------------------------------- the domain, ranked */

/* The force layout and the concentric one both failed the same way: 115 boxes and 170 faint
   lines is a texture, not a reading — every box lands somewhere arbitrary and the lines cross
   the whole field. The literature is blunt about this. Past roughly fifteen edges into a node
   you change REPRESENTATION rather than compress the drawing, and CodeCity's answer to the same
   problem was to stop drawing relationship lines altogether and let position carry the meaning.

   So the overview is a rank, not a graph: grouped by module because that is the one grouping
   UML itself sanctions, ordered by degree inside each group so the types that hold the domain
   together read first, and the relations are drawn only for the box under the pointer. Every
   box is one click from the Plate, which is where relations are drawn properly. */

const DBW = 208, DBH = 32, DGAPX = 10, DGAPY = 8, DHEAD = 40;

/* The grid is laid to the WIDTH of the stage and read at 1:1, because a grid scaled to fit its
   own height is a grid nobody can read — that was the whole complaint about the last two. It
   grows downwards instead, which is the one direction a reader already knows how to travel. */
const domCols = () => Math.max(3, Math.floor((($('view').clientWidth || 1180) - 70) / (DBW + DGAPX)));

function domLayout() {
  const hits = D.types.filter(passes);
  const on = new Set(hits.map(t => t.id));
  const byMod = new Map();
  for (const t of hits) (byMod.get(t.module) || byMod.set(t.module, []).get(t.module)).push(t);

  const cols = domCols();
  const nodes = [], heads = [];
  let y = 0;
  for (const m of MODULES) {
    const list = (byMod.get(m) || []).sort((a, b) => (DEG.get(b.id) || 0) - (DEG.get(a.id) || 0)
      || (a.name < b.name ? -1 : 1));
    if (!list.length) continue;
    heads.push({ text: `${m} — ${list.length}`, x: 0, y: y + 22 });
    y += DHEAD;
    list.forEach((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      nodes.push({ id: t.id, name: t.name, kind: t.kind, module: t.module, deg: DEG.get(t.id) || 0,
        x: c * (DBW + DGAPX), y: y + r * (DBH + DGAPY), w: DBW, h: DBH });
    });
    y += Math.ceil(list.length / cols) * (DBH + DGAPY) + 26;
  }

  /* One entry per partner, at the strongest relation, so hovering a box lights each neighbour
     once however many ways the two are wired together. */
  const near = new Map(nodes.map(n => [n.id, new Map()]));
  for (const e of D.edges) {
    if (!on.has(e.from) || !on.has(e.to) || e.from === e.to) continue;
    for (const [a, b, dir] of [[e.from, e.to, 'out'], [e.to, e.from, 'in']]) {
      const m = near.get(a), p = m.get(b);
      if (!p) m.set(b, { id: b, rel: e.rel, dir });
      else if (RELS.indexOf(e.rel) < RELS.indexOf(p.rel)) p.rel = e.rel;
    }
  }
  const w = cols * (DBW + DGAPX) - DGAPX;
  return { nodes, heads, near, bbox: [-40, -40, w + 40, y + 40] };
}

function drawDomain(cache) {
  const { nodes, heads, near, bbox } = cache;
  const at = new Map(nodes.map(n => [n.id, n]));
  const svg = el('svg');
  const zoomG = el('g');
  zoomG.appendChild(gridBG());

  for (const h of heads) zoomG.appendChild(el('text', { class: 'colhead', x: h.x, y: h.y }, h.text));

  /* Relations live in their own layer above the boxes and are empty until a box is pointed at:
     drawn all at once they were 170 hairlines across the whole sheet, which said nothing. */
  const wires = el('g');
  const boxes = el('g');
  const clear = () => { wires.textContent = ''; for (const g of boxes.children) g.setAttribute('opacity', 1); };

  /* Elbows, not diagonals: a horizontal run out of the box, one turn, a vertical run in. Over a
     grid that reads as wiring; the diagonal version read as scribble. */
  const light = n => {
    clear();
    const lit = new Set([n.id]);
    for (const p of near.get(n.id).values()) if (at.has(p.id)) lit.add(p.id);
    for (const g of boxes.children) if (!lit.has(g.dataset.id)) g.setAttribute('opacity', 0.22);
    const a = at.get(n.id);
    for (const p of near.get(n.id).values()) {
      const b = at.get(p.id);
      if (!b) continue;
      const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
      const mid = (y1 + y2) / 2;
      wires.appendChild(el('path', {
        d: `M${x1} ${y1} L${x1} ${mid} L${x2} ${mid} L${x2} ${y2}`, fill: 'none',
        stroke: RCOLOR[p.rel], 'stroke-width': 1.3,
        'stroke-dasharray': RDASH[p.rel] || null, opacity: 0.9,
      }));
    }
  };

  for (const n of nodes) {
    const g = el('g', { class: 'hit', transform: `translate(${n.x} ${n.y})` });
    g.dataset.id = n.id;
    g.appendChild(el('rect', { class: 'box-fill', width: n.w, height: n.h, rx: 3 },
      [el('title', {}, `${n.id} · ${n.module} · ${n.deg} relation${n.deg === 1 ? '' : 's'}`)]));
    g.appendChild(el('rect', { width: 3, height: n.h, fill: KCOLOR[n.kind] }));
    g.appendChild(el('text', { class: 'name', x: 12, y: 14, style: 'font-size:11px' }, n.name.slice(0, 26)));
    g.appendChild(el('text', { class: 'stereo', x: 12, y: 25 }, `«${n.kind}» ${n.deg}`));
    g.onclick = () => { state.focus = n.id; select(n.id); };
    g.onmouseenter = () => light(n);
    g.onmouseleave = clear;
    boxes.appendChild(g);
  }

  zoomG.appendChild(boxes);
  zoomG.appendChild(wires);
  svg.appendChild(zoomG);

  $('view').appendChild(canvasWrap(svg));
  /* Open on the first screenful at 1:1 rather than fitting the whole column of boxes: handing
     setupZoom a viewport-sized rectangle at the top-left is what asks it for exactly that. */
  const view = $('view');
  setupZoom(svg, zoomG, bbox[0], bbox[1], view.clientWidth || 1180, view.clientHeight || 560, 1);
}

/* The way out is a control, not a gesture to be guessed at: a reader who drilled in has to be
   able to see how to get back without trying anything. */
function domainBack() {
  const b = document.createElement('button');
  b.className = 'back-btn';
  const n = DOMCOUNT.get(state.dom) || 0;
  b.innerHTML = `<span>←</span> all of ${esc(state.dom)}<b>${n} types</b>`;
  b.onclick = () => { state.focus = null; render(); };
  return b;
}
