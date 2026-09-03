/* PROTOTYPE — the WHEEL view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
/* ================================================================ WHEEL
   The plate can only ever show one neighbourhood and the ledger cannot show an edge, so the
   scale between them needs its own notation: ONE MODULE, every type it declares set round a
   circle, and every relation between two of them drawn as a chord across the middle. What you
   read here is shape — a module whose chords all cross the centre is a module with no interior
   structure, and one whose chords hug the rim is a module that is really several. */

const WR = 380, WLAB = 392;

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
  const edges = D.edges.filter(e => at.has(e.from) && at.has(e.to));

  const M = Array.from({ length: N }, () => new Array(N).fill(0));
  const top = new Map();
  let weight = 0;
  for (const e of edges) {
    const i = at.get(e.from), j = at.get(e.to), k = i * N + j;
    M[i][j] += e.n;
    weight += e.n;
    if (!top.has(k) || RELS.indexOf(e.rel) < RELS.indexOf(top.get(k))) top.set(k, e.rel);
  }
  /* A chord layout gives a type angle in proportion to its traffic, and half of any module's
     types have no traffic inside it at all — left alone their groups are a zero-width slot and
     their names land on top of the neighbour's. The diagonal is space nobody can see (a chord
     from a type to itself is dropped below), so it is where a floor can be paid: every name
     keeps a slot, and real traffic still decides most of the circle. */
  const floor = Math.max(1, weight * 1.3 / N);
  for (let i = 0; i < N; i++) M[i][i] += floor;

  /* Sorted subgroups put a type's heaviest partner at the leading edge of its own arc, so the
     ribbons leave a hub fanned by weight rather than by rim order. */
  const layout = d3.chordDirected()
    .padAngle(Math.PI * 2 * 0.07 / N)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending)(M);
  const arc = d3.arc();
  const ribbon = d3.ribbonArrow().radius(WR - 6).padAngle(1 / WR).headRadius(15);
  const mid = g => (g.startAngle + g.endAngle) / 2;
  const P = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r];

  /* The view bar floats over the bottom of the stage, which is exactly where the six o'clock
     names land. There is headroom at the top and none at the bottom, so the wheel is set off
     centre rather than made smaller — a smaller wheel costs every name, not three. */
  const VW = 1200, VH = 1160, LIFT = 34;
  const svg = el('svg', { viewBox: `${-VW / 2} ${-VH / 2 + LIFT} ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
  svg.appendChild(el('rect', { x: -VW / 2, y: -VH / 2 + LIFT, width: VW, height: VH, fill: '#0b0f12' }));

  /* Kind bands: one arc per contiguous run of the same kind. */
  let run = 0;
  for (let i = 1; i <= N; i++) {
    if (i < N && shown[i].kind === shown[run].kind) continue;
    svg.appendChild(el('path', {
      d: arc({
        innerRadius: WR + 5, outerRadius: WR + 8,
        startAngle: layout.groups[run].startAngle, endAngle: layout.groups[i - 1].endAngle,
      }),
      fill: KCOLOR[shown[run].kind], opacity: .8,
    }));
    run = i;
  }

  /* Chords under the rim, so a name is never covered by a line. The layout's own draw order
     puts the heaviest at the bottom; the selection's own chords need to be above ALL of them,
     which is a second pass and not a sort key the layout can take. */
  const dim = el('g'), lit = el('g');
  const near = new Set([home.id]);
  for (const c of layout) {
    if (c.source.index === c.target.index) continue;
    const a = shown[c.source.index], b = shown[c.target.index];
    const on = a.id === home.id || b.id === home.id;
    if (on) { near.add(a.id); near.add(b.id); }
    const ink = RCOLOR[top.get(c.source.index * N + c.target.index)];
    /* A ribbon is as wide as the relation is heavy, so a single `holds` between two types is a
       hairline and the selection's own chord can be the thinnest thing on the page. The stroke
       is a floor on visibility, not decoration: without it the lit set is invisible on a module
       whose types touch each other once. */
    (on ? lit : dim).appendChild(el('path', {
      d: ribbon(c), fill: ink, opacity: on ? .9 : .16,
      stroke: on ? ink : null, 'stroke-width': on ? 1.4 : null,
    }));
  }
  svg.appendChild(dim);
  svg.appendChild(lit);

  shown.forEach((t, i) => {
    const g = layout.groups[i], a = mid(g);
    const on = near.has(t.id), me = t.id === home.id;
    const [nx, ny] = P(a, WR);
    const node = el('g', { class: 'hit' });
    /* The dot is two pixels across and the name is set away from it, so the whole slot is the
       target: on a rim of 96 anything smaller is a click nobody can land. */
    node.appendChild(el('path', {
      d: arc({ innerRadius: WR - 10, outerRadius: WR + 14, startAngle: g.startAngle, endAngle: g.endAngle }),
      fill: '#0b0f12', opacity: 0,
    }));
    node.appendChild(el('circle', { cx: nx, cy: ny, r: me ? 5.5 : on ? 3.4 : 2.2, fill: KCOLOR[t.kind], opacity: on ? 1 : .45 }));
    const flip = a > Math.PI;
    const [lx, ly] = P(a, WLAB);
    node.appendChild(el('text', {
      class: 'sat', x: flip ? -6 : 6, y: 3.6,
      transform: `translate(${lx} ${ly}) rotate(${a * 180 / Math.PI - 90 + (flip ? 180 : 0)})`,
      'text-anchor': flip ? 'end' : 'start',
      fill: me ? '#ffffff' : on ? '#d8e4ec' : '#55666f',
      style: me ? 'font-weight:600' : '',
    }, t.name));
    node.onclick = () => select(t.id);
    svg.appendChild(node);
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
