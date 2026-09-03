/* PROTOTYPE — the LEDGER view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
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
