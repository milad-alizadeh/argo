/* PROTOTYPE — the WHEEL view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
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
