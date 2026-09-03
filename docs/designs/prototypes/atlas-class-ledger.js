/* PROTOTYPE — the LEDGER view. One view per file: three of these are rewritten in parallel, and a
   shared file would mean three writers on one page. Globals come from atlas-class.js. */
/* ================================================================ LEDGER
   Neither of the other two can show more than one neighbourhood, and a repository is not one
   neighbourhood. So: no edges at all. Every type is a row AND a column, ordered so that what a
   thing needs sits above it — which puts every cycle in the codebase above the diagonal, in
   rose, where you can count them. */

/* Three orderings, because the ordering IS the reading: the same relations draw a different
   picture under each, and the only way to answer "is the depth walk good enough" is to put it
   and the exact one on the same screen, one keypress apart. */
const ORDERS = ['blocks', 'global', 'depth'];
const ONAME = {
  blocks: 'module blocks · topological · RCM',
  global: 'topological · no module blocks',
  depth: 'six-pass depth walk · the old sort',
};
let ORD = 'blocks';

function ledger() {
  const types = D.types.filter(passes);
  const t0 = performance.now();
  const rank = order(types);
  const ms = performance.now() - t0;
  const N = rank.length;
  if (!N) { $('view').appendChild(Object.assign(document.createElement('div'), { id: 'empty', textContent: 'nothing matches' })); return; }
  const idx = new Map(rank.map((t, i) => [t.id, i]));
  const cyc = cycles(types);

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
  /* The view bar is centred over the right half of this corner, so the panel wraps rather than
     runs under it — a count that is only half readable is worse than a count on two lines. */
  out.style.maxWidth = '340px';
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
  /* Two numbers, because one of them cannot be read alone: a rose cell means a cycle only if
     both its types are in the same strongly connected component, and under the old sort most of
     them were not. The second number is the one that is a fact about the repository. */
  const real = cells.filter(([i, j, e]) =>
    j < i && cyc.cid.has(e.from) && cyc.cid.get(e.from) === cyc.cid.get(e.to)).length;
  const foot = () => `<span style="color:var(--mute)">${N} types · <b>${back}</b> back edges`
    + ` · ${real} truly cyclic, in ${cyc.n} components`
    + `<br>${ONAME[ORD]} · ${ms.toFixed(0)} ms · press <b>o</b></span>`;
  out.innerHTML = `<b>${N}</b> types · <b>${cells.length}</b> relations drawn<br>`
    + `<span style="color:var(--mute)">hover a cell</span><br>` + foot();

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
      + `<br>` + foot();
  };
  marks.onmouseleave = () => cross(null);
  marks.onclick = ev => {
    const r = marks.getBoundingClientRect();
    const i = Math.floor((ev.clientY - r.top - pad) / s);
    if (i >= 0 && i < N) select(rank[i].id);
  };
}

addEventListener('keydown', e => {
  if (e.key !== 'o' || e.metaKey || e.ctrlKey || state.v !== 'ledger' || document.activeElement === $('q')) return;
  ORD = ORDERS[(ORDERS.indexOf(ORD) + 1) % ORDERS.length];
  render();
});

/* ---------------------------------------------------------------- ordering */

function order(types) {
  if (ORD === 'depth') return depthWalk(types);
  if (ORD === 'global') return seriate(graphOf(types)).map(id => BY.get(id));
  const by = new Map();
  for (const t of types) (by.get(t.module) || by.set(t.module, []).get(t.module)).push(t);
  const seq = [];
  for (const m of seriate(moduleGraph(types)))
    for (const id of seriate(graphOf(by.get(m)))) seq.push(BY.get(id));
  return seq;
}

/* One directed edge per pair, self-loops dropped: multiplicity says how strong a dependency is
   and nothing about which way the matrix should sort. `und` is the same graph with the direction
   forgotten, which is what RCM reads. */
function graphOf(types) {
  const ids = types.map(t => t.id);
  const set = new Set(ids);
  const o = new Map(), i = new Map(), u = new Map();
  for (const id of ids) { o.set(id, new Set()); i.set(id, new Set()); u.set(id, new Set()); }
  for (const t of types) for (const e of OUT.get(t.id)) {
    if (!set.has(e.to) || e.to === t.id) continue;
    o.get(t.id).add(e.to); i.get(e.to).add(t.id);
    u.get(t.id).add(e.to); u.get(e.to).add(t.id);
  }
  return arrays(ids, o, i, u);
}

/* Modules sort by the same machinery as the types inside them, so the blocks on the diagonal
   climb in the direction the cells do. Ordering them by size instead — which is what MODULES
   gives you — makes every relation between two modules rose in one of the two directions, and
   those cells are not cycles. */
function moduleGraph(types) {
  const home = new Map(types.map(t => [t.id, t.module]));
  const ids = [...new Set(types.map(t => t.module))];
  const o = new Map(), i = new Map(), u = new Map();
  for (const m of ids) { o.set(m, new Set()); i.set(m, new Set()); u.set(m, new Set()); }
  for (const t of types) for (const e of OUT.get(t.id)) {
    const m = home.get(e.to);
    if (!m || m === t.module) continue;
    o.get(t.module).add(m); i.get(m).add(t.module);
    u.get(t.module).add(m); u.get(m).add(t.module);
  }
  return arrays(ids, o, i, u);
}

const arrays = (ids, o, i, u) => ({
  ids,
  out: new Map(ids.map(k => [k, [...o.get(k)]])),
  inn: new Map(ids.map(k => [k, [...i.get(k)]])),
  und: new Map(ids.map(k => [k, [...u.get(k)]])),
});

/* Stage one is exact where the old walk was approximate: condense the strongly connected
   components and what is left is a DAG, so "how deep in the need chain" is a longest path with
   an answer rather than six passes of relaxation. Stage two is the clustering — inside one level
   nothing constrains the order, so barycenter pulls a component next to whatever already needs
   it and RCM breaks the ties, and neither can invent a back edge the levels forbid. */
function seriate({ ids, out, inn, und }) {
  const comps = sccs(ids, out);
  const cid = new Map();
  comps.forEach((c, k) => c.forEach(v => cid.set(v, k)));
  const level = new Array(comps.length).fill(0);
  for (let k = comps.length - 1; k >= 0; k--) {
    for (const v of comps[k]) for (const w of out.get(v)) {
      const j = cid.get(w);
      if (j !== k) level[j] = Math.max(level[j], level[k] + 1);
    }
  }
  const cluster = rcm(ids, und);
  const byLevel = new Map();
  comps.forEach((c, k) => (byLevel.get(level[k]) || byLevel.set(level[k], []).get(level[k])).push(c));

  const pos = new Map(), seq = [];
  for (const L of [...byLevel.keys()].sort((a, b) => a - b)) {
    const group = byLevel.get(L).map(c => {
      let sum = 0, n = 0;
      for (const v of c) for (const w of inn.get(v)) if (pos.has(w)) { sum += pos.get(w); n++; }
      return { c, bary: n ? sum / n : Infinity, near: Math.min(...c.map(v => cluster.get(v))) };
    });
    group.sort((a, b) => (a.bary - b.bary) || (a.near - b.near));
    for (const { c } of group) {
      for (const v of c.length > 1 ? greedyFAS(c, out) : c) { pos.set(v, seq.length); seq.push(v); }
    }
  }
  return seq;
}

/* Tarjan, iterative: 1349 nodes is well past the recursion depth the same algorithm written the
   natural way would want, and a blown stack here is a blank view rather than a slow one.
   Components come out in reverse topological order, which is why the level pass above walks the
   array backwards. */
function sccs(ids, adj) {
  const idx = new Map(), low = new Map(), on = new Set(), st = [], comps = [];
  let n = 0;
  for (const root of ids) {
    if (idx.has(root)) continue;
    idx.set(root, n); low.set(root, n); n++; st.push(root); on.add(root);
    const work = [{ v: root, e: 0 }];
    while (work.length) {
      const f = work[work.length - 1];
      const es = adj.get(f.v);
      if (f.e < es.length) {
        const w = es[f.e++];
        if (!idx.has(w)) {
          idx.set(w, n); low.set(w, n); n++; st.push(w); on.add(w);
          work.push({ v: w, e: 0 });
        } else if (on.has(w)) low.set(f.v, Math.min(low.get(f.v), idx.get(w)));
        continue;
      }
      work.pop();
      if (low.get(f.v) === idx.get(f.v)) {
        const c = [];
        for (;;) { const w = st.pop(); on.delete(w); c.push(w); if (w === f.v) break; }
        comps.push(c);
      }
      if (work.length) {
        const p = work[work.length - 1];
        low.set(p.v, Math.min(low.get(p.v), low.get(f.v)));
      }
    }
  }
  return comps;
}

/* Eades–Lin–Smyth. Inside a component every order leaves some relation pointing back, so the
   only question is how few: peel sinks onto the tail and sources onto the head, and otherwise
   take whichever node needs the most and is needed the least. That lands near the minimum
   feedback arc set, which is NP-hard and not worth a solver here. */
function greedyFAS(nodes, out) {
  const set = new Set(nodes);
  const o = new Map(), i = new Map();
  for (const v of nodes) { o.set(v, []); i.set(v, []); }
  for (const v of nodes) for (const w of out.get(v)) if (set.has(w)) { o.get(v).push(w); i.get(w).push(v); }
  const od = new Map(nodes.map(v => [v, o.get(v).length]));
  const id = new Map(nodes.map(v => [v, i.get(v).length]));
  const left = new Set(nodes), head = [], tail = [];
  const drop = v => {
    left.delete(v);
    for (const w of o.get(v)) if (left.has(w)) id.set(w, id.get(w) - 1);
    for (const w of i.get(v)) if (left.has(w)) od.set(w, od.get(w) - 1);
  };
  while (left.size) {
    for (let moved = true; moved;) {
      moved = false;
      for (const v of [...left]) if (left.has(v) && !od.get(v)) { tail.unshift(v); drop(v); moved = true; }
      for (const v of [...left]) if (left.has(v) && !id.get(v)) { head.push(v); drop(v); moved = true; }
    }
    if (!left.size) break;
    let best = null, gain = -Infinity;
    for (const v of left) if (od.get(v) - id.get(v) > gain) { gain = od.get(v) - id.get(v); best = v; }
    head.push(best); drop(best);
  }
  return head.concat(tail);
}

/* Reverse Cuthill–McKee: breadth-first from the least connected node, neighbours taken in degree
   order, the whole thing reversed. It only ever breaks a tie here — the levels above own the
   ordering — but a tie broken by adjacency is what turns scatter inside a block into a band along
   the diagonal, and a tie broken alphabetically is what the old sort did instead. */
function rcm(ids, und) {
  const deg = v => und.get(v).length;
  const seen = new Set(), seq = [];
  for (const start of ids.slice().sort((a, b) => deg(a) - deg(b))) {
    if (seen.has(start)) continue;
    seen.add(start);
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      seq.push(q[h]);
      for (const w of und.get(q[h]).slice().sort((a, b) => deg(a) - deg(b))) {
        if (!seen.has(w)) { seen.add(w); q.push(w); }
      }
    }
  }
  seq.reverse();
  return new Map(seq.map((v, i) => [v, i]));
}

/* The components are the same whatever the sort does, which is what makes them the yardstick:
   a back edge inside one is a cycle, and a back edge across two is the ordering's own doing. */
function cycles(types) {
  const g = graphOf(types);
  const comps = sccs(g.ids, g.out);
  const cid = new Map();
  comps.forEach((c, k) => { if (c.length > 1) c.forEach(v => cid.set(v, k)); });
  return { cid, n: comps.filter(c => c.length > 1).length };
}

/* The ordering the prototype started with, kept as the third setting rather than deleted: the
   claim that six passes of relaxation are "nearly right" is only checkable against the exact
   one, and a reader can now flip between them on one screen. */
function depthWalk(types) {
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
