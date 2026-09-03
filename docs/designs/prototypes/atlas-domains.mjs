/* PROTOTYPE — domains, inferred from two signals every repository has: what files are called,
   and what changes together. Neither is a dependency graph, and that is deliberate — the
   recovery literature's lexical techniques hold their own against the dependency-based ones,
   and a lexical pass needs no toolchain, no build and no language support.
   Nothing here is measured. Every number this file produces is a guess with a confidence. */

/* Directory tokens are off by default. Feed them in and a file in payments/ gets the token
   "payments" free, the clustering rediscovers the folder tree, and "domains cut across
   folders" becomes a statement about the input rather than a finding about the repo. */
export function tokens(path, dirWeight = 0) {
  const parts = path.split('/');
  const file = parts.pop().replace(/\.[^.]*$/, '');
  const out = new Map();
  const add = (s, w) => { for (const t of split(s)) out.set(t, (out.get(t) || 0) + w); };
  add(file, 1);
  if (dirWeight > 0) for (const d of parts) add(d, dirWeight);
  return out;
}

const split = s => s
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .split(/[^A-Za-z0-9]+/).map(t => t.toLowerCase())
  .filter(t => t.length > 2 && !/^\d+$/.test(t));

/* No stop-word list. TF-IDF already flattens a token that is everywhere, and a hand-written
   list of words to ignore is the project-specific assumption this whole map refuses. */
export function vectors(paths, dirWeight) {
  const raw = paths.map(p => tokens(p, dirWeight));
  const df = new Map();
  for (const m of raw) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = paths.length;
  return raw.map(m => {
    const v = new Map();
    let norm = 0;
    for (const [t, tf] of m) {
      const n = df.get(t);
      if (n === N) continue;                       // a token in every file says nothing
      const w = tf * Math.log(N / n);
      v.set(t, w); norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  });
}

/* An inverted index, so the top-K neighbour search touches only files that share a token
   instead of all 1.2 million pairs. */
export function nameEdges(vecs, K = 20) {
  const post = new Map();
  vecs.forEach((v, i) => { for (const [t, w] of v) {
    if (!post.has(t)) post.set(t, []); post.get(t).push([i, w]);
  } });
  const out = new Map();
  vecs.forEach((v, i) => {
    const acc = new Map();
    for (const [t, w] of v) for (const [j, u] of post.get(t)) {
      if (j !== i) acc.set(j, (acc.get(j) || 0) + w * u);
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, K);
    for (const [j, s] of top) out.set(i < j ? i + ',' + j : j + ',' + i, s);
  });
  return out;
}

/* ---------- Louvain ---------- */
/* Modularity optimisation with a resolution parameter, which is the knob the plateau sweep
   below turns. Two phases repeated: move every node to its best neighbouring community,
   then collapse each community to one node and do it again. */
function louvain(n, edges, gamma) {
  let nodes = n, adj = buildAdj(nodes, edges);
  let map = new Array(n).fill(0).map((_, i) => i);
  for (let round = 0; round < 12; round++) {
    const com = localMove(nodes, adj, gamma);
    const ids = new Map();
    for (const c of com) if (!ids.has(c)) ids.set(c, ids.size);
    const next = com.map(c => ids.get(c));
    if (ids.size === nodes) break;
    map = map.map(c => next[c]);
    const agg = new Map();
    for (const [k, w] of adj.pairs) {
      const [a, b] = k.split(',').map(Number);
      const [x, y] = [next[a], next[b]];
      const kk = x < y ? x + ',' + y : y + ',' + x;
      agg.set(kk, (agg.get(kk) || 0) + w);
    }
    nodes = ids.size; adj = buildAdj(nodes, agg);
  }
  return map;
}

function buildAdj(n, pairs) {
  const nb = Array.from({ length: n }, () => []);
  const deg = new Float64Array(n);
  let m2 = 0;
  for (const [k, w] of pairs) {
    const [a, b] = k.split(',').map(Number);
    if (a === b) { deg[a] += 2 * w; m2 += 2 * w; continue; }
    nb[a].push([b, w]); nb[b].push([a, w]);
    deg[a] += w; deg[b] += w; m2 += 2 * w;
  }
  return { nb, deg, m2: m2 || 1, pairs };
}

function localMove(n, adj, gamma) {
  const com = new Array(n).fill(0).map((_, i) => i);
  const tot = Float64Array.from(adj.deg);
  for (let pass = 0; pass < 20; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const links = new Map();
      for (const [j, w] of adj.nb[i]) links.set(com[j], (links.get(com[j]) || 0) + w);
      const mine = com[i];
      tot[mine] -= adj.deg[i];
      let best = mine, gain = (links.get(mine) || 0) - gamma * tot[mine] * adj.deg[i] / adj.m2;
      for (const [c, w] of links) {
        const g = w - gamma * tot[c] * adj.deg[i] / adj.m2;
        if (g > gain + 1e-12) { gain = g; best = c; }
      }
      tot[best] += adj.deg[i];
      if (best !== mine) { com[i] = best; moved++; }
    }
    if (!moved) break;
  }
  return com;
}

/* ---------- the blended graph ---------- */
export function graph(paths, cochange, alpha, dirWeight, K = 20) {
  const index = new Map(paths.map((p, i) => [p, i]));
  const vecs = vectors(paths, dirWeight);
  const edges = new Map();
  for (const [k, s] of nameEdges(vecs, K)) edges.set(k, alpha * s);
  for (const [a, b, j] of (cochange || [])) {
    const x = index.get(a), y = index.get(b);
    if (x === undefined || y === undefined) continue;
    const k = x < y ? x + ',' + y : y + ',' + x;
    edges.set(k, (edges.get(k) || 0) + (1 - alpha) * j);
  }
  return { vecs, edges, index };
}

/* ---------- resolution by plateau ---------- */
/* Maximum modularity reliably over-splits, and a target cluster count is a constant wearing a
   formula's clothes. A plateau is the repo answering for itself: the grain at which its own
   structure stops changing as you turn the knob. No plateau is a real answer too. */
/* The plateau is in the *partition*, not in the cluster count. Count rises monotonically with
   resolution for almost any graph, so a flat stretch of it is a thing that hardly ever exists;
   what does exist is a stretch where turning the knob stops moving files between domains. */
export function plateau(n, edges, floor = 3) {
  const steps = [];
  for (let g = 0.4; g <= 2.01; g += 0.2) {
    const com = louvain(n, edges, g);
    const size = new Map();
    for (const c of com) size.set(c, (size.get(c) || 0) + 1);
    const prev = steps.length ? steps[steps.length - 1].com : null;
    steps.push({ gamma: Math.round(g * 10) / 10, com,
      count: [...size.values()].filter(v => v >= floor).length,
      held: prev ? agree(com, prev) : 1 });
  }
  let best = { i: 0, j: 0 };
  for (let i = 0; i < steps.length; i++) {
    let j = i;
    while (j + 1 < steps.length && steps[j + 1].held >= 0.9) j++;
    if (j - i > best.j - best.i) best = { i, j };
  }
  const run = best.j - best.i + 1;
  const pick = steps[(best.i + best.j) >> 1];
  return { steps: steps.map(({ com, ...s }) => s), gamma: pick.gamma, com: pick.com,
           run, stable: run >= 3 };
}

/* ---------- membership, with a file allowed to belong to nothing ---------- */
/* A file keeps its community only if it is more that community than the runner-up. The test
   is a ratio, so it carries no repo-specific scale, and the same number becomes the
   saturation the map draws it with. */
export function membership(com, adj, floor = 3, minMargin = 0.15) {
  const size = new Map();
  for (const c of com) size.set(c, (size.get(c) || 0) + 1);
  const of = new Array(com.length).fill(-1);
  const conf = new Float64Array(com.length);
  for (let i = 0; i < com.length; i++) {
    if ((size.get(com[i]) || 0) < floor) continue;
    const links = new Map();
    for (const [j, w] of adj.nb[i]) if ((size.get(com[j]) || 0) >= floor)
      links.set(com[j], (links.get(com[j]) || 0) + w);
    const mine = links.get(com[i]) || 0;
    let second = 0;
    for (const [c, w] of links) if (c !== com[i] && w > second) second = w;
    const margin = mine + second > 0 ? (mine - second) / (mine + second) : 0;
    if (margin >= minMargin) { of[i] = com[i]; conf[i] = margin; }
  }
  return { of, conf };
}

/* A domain's name has to be the token that is *concentrated* here, not merely the heaviest —
   those are different, and the difference is the project's own name. It is in a sixth of the
   filenames, so it wins any sum, and it names nothing: every domain is an Argo domain. So the
   score is weight in this cluster times the share of that token's whole weight that falls in
   it, which no token spread across the repo can win. */
export function name(members, vecs, spread, house) {
  const acc = new Map();
  for (const i of members) for (const [t, w] of vecs[i]) acc.set(t, (acc.get(t) || 0) + w);
  return [...acc].filter(([t]) => !house.has(t))
    .map(([t, w]) => [t, w * (w / (spread.get(t) || w))])
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
}

/* A house word can be concentrated enough to win a name and still name nothing. Two kinds,
   and they need different tests because a frequency bar tight enough to catch the first
   throws away good names: "mermaid" is in a tenth of the filenames here and is exactly right.

   The first kind is a word on a quarter of the files — "tests" — which is a layer, not a
   subject. The second is the product's own name, which is not rare, not evenly spread, and
   not detectable from the paths at all: every domain in the repo is one of its domains. That
   one is a fact rather than a heuristic, so it is passed in rather than guessed at.

   Both stay in the vectors, where they are harmless. They are barred only from the label. */
function houseWords(paths, dirWeight, given = []) {
  const df = new Map();
  for (const p of paths) for (const t of tokens(p, dirWeight).keys())
    df.set(t, (df.get(t) || 0) + 1);
  const out = new Set();
  for (const [t, n] of df) if (n / paths.length >= 0.2) out.add(t);
  for (const g of given) for (const t of split(String(g))) out.add(t);
  return out;
}

/* Every token's total weight across the whole repo, which is the denominator above. */
function spreadOf(vecs) {
  const all = new Map();
  for (const v of vecs) for (const [t, w] of v) all.set(t, (all.get(t) || 0) + w);
  return all;
}

/* A description nobody had to write: what the domain holds and where it lives. It is derived,
   so it can never go stale against the map, and it says the one thing the name cannot — that
   a domain is spread over folders that have nothing to do with each other. */
function describe(members, paths) {
  const where = new Map();
  for (const i of members) {
    const d = paths[i].split('/').slice(0, -1).join('/');
    where.set(d, (where.get(d) || 0) + 1);
  }
  const top = [...where].sort((a, b) => b[1] - a[1]);
  const say = top.slice(0, 2).map(([d, n]) => `${d.split('/').slice(-2).join('/')} (${n})`);
  return { folders: where.size, top,
    text: `${members.length} files across ${where.size} folder${where.size > 1 ? 's' : ''}`
      + (where.size > 1 ? `, mostly ${say.join(' and ')}.` : '.') };
}

/* A domain's identity across rebuilds, for the written layer to hang off. Membership churns
   — one new file must not orphan a caption that is still true — so the key is the core: the
   five largest members, sorted. FNV-1a rather than a real digest because both the picker and
   the page must compute it, and one of them has no crypto that is not asynchronous. */
export function coreKey(members, paths, size) {
  const core = [...members].sort((a, b) => (size(b) - size(a)) || (paths[a] < paths[b] ? -1 : 1))
    .slice(0, 5).map(i => paths[i]).sort().join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < core.length; i++) {
    h ^= core.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

/* ---------- the one call the page makes ---------- */
export function cluster(paths, cochange, opts = {}) {
  const alpha = opts.alpha ?? 0.6, dirWeight = opts.dirWeight ?? 0, floor = opts.floor ?? 3;
  const size = opts.size || (() => 0);
  const { vecs, edges } = graph(paths, cochange, alpha, dirWeight);
  const adj = buildAdj(paths.length, edges);
  const plat = opts.gamma ? { gamma: opts.gamma, stable: true, steps: [], run: 0 }
                          : plateau(paths.length, edges, floor);
  const com = plat.com || louvain(paths.length, edges, plat.gamma);
  const { of, conf } = membership(com, adj, floor, opts.minMargin ?? 0.15);

  const byId = new Map();
  of.forEach((c, i) => { if (c < 0) return;
    if (!byId.has(c)) byId.set(c, []); byId.get(c).push(i); });
  const spread = spreadOf(vecs);
  const house = houseWords(paths, dirWeight, opts.house || []);
  const used = new Set();
  const clusters = [...byId.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, members]) => {
      const words = name(members, vecs, spread, house).filter(t => !used.has(t));
      used.add(words[0]);
      const d = describe(members, paths);
      return { id, members, tokens: words, name: words[0] || 'domain ' + id,
               key: coreKey(members, paths, size),
               about: d.text, folders: d.folders, where: d.top,
               confidence: members.reduce((s, i) => s + conf[i], 0) / members.length };
    });

  /* Two signals that agree are evidence; the rate at which they disagree is the only honest
     accuracy number available without a human answer key. */
  const agreement = opts.skipAgreement ? null
    : agree(of, cluster(paths, null, { ...opts, alpha: 1, skipAgreement: true, gamma: plat.gamma }).of);

  return { of, conf, clusters, plateau: plat, agreement,
           unassigned: of.reduce((n, c) => n + (c < 0 ? 1 : 0), 0) };
}

/* Pairwise agreement: over file pairs the two clusterings both have an opinion about, how
   often do they agree that the pair does — or does not — belong together. The Rand index,
   computed exactly from the contingency table rather than sampled. Sampling it made the
   resolution sweep below random, and two runs over one unchanged repo drew different maps —
   which is disqualifying for the one number here that stands in for accuracy. */
function agree(a, b) {
  const pair = n => (n * (n - 1)) / 2;
  const cell = new Map(), rows = new Map(), cols = new Map();
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) continue;
    n++;
    const k = a[i] + ',' + b[i];
    cell.set(k, (cell.get(k) || 0) + 1);
    rows.set(a[i], (rows.get(a[i]) || 0) + 1);
    cols.set(b[i], (cols.get(b[i]) || 0) + 1);
  }
  if (n < 2) return null;
  const sum = m => [...m.values()].reduce((s, v) => s + pair(v), 0);
  const both = sum(cell);
  return (pair(n) - sum(rows) - sum(cols) + 2 * both) / pair(n);
}
