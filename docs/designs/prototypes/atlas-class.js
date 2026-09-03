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
  kinds: new Set(KINDS), mods: null, tests: false, dom: null, tab: 'types', focus: null,
};

let D = null, BY = new Map(), OUT = new Map(), IN = new Map(), DEG = new Map(), MODULES = [], MODCOUNT = new Map();
let DOMAINS = null, DOMLIST = [], DOMCOUNT = new Map();

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
  MODCOUNT = seen;
  state.mods = new Set(MODULES);

  readURL();
  if (!state.sel) {
    const best = D.types.filter(t => !t.test).sort((a, b) => DEG.get(b.id) - DEG.get(a.id))[0];
    state.sel = best ? best.id : null;
  }
  chrome();
  render();
  buildDomains();
});

/* ---------------------------------------------------------------- domains */
/* The same inference atlas-holo.html uses on the whole repo — TF-IDF over filenames blended
   with git co-change, resolved by Louvain at a plateau resolution — run here on just the types
   this map already knows about. Picking one is not a filter but a reading: the Domain view
   draws exactly its types and the relations between them. */
function domHue(rank) { return Math.round((rank * 137.508) % 360); }

function buildDomains() {
  Promise.all([
    import('./atlas-domains.mjs'),
    fetch('atlas-cochange.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
  ]).then(([lib, co]) => {
    const paths = [...new Set(D.types.map(t => t.path))];
    const norm = p => p.replace(/^apps\//, '');
    const cochange = co ? co.edges.map(([a, b, j]) => [co.files[a], co.files[b], j]) : [];
    const house = co && co.built && co.built.repo ? [co.built.repo] : [];
    const r = lib.cluster(paths.map(norm), cochange, { alpha: 0.6, dirWeight: 0, house });
    const rank = new Map(r.clusters.map((c, i) => [c.id, i]));
    const byPath = new Map();
    paths.forEach((p, i) => byPath.set(p, r.of[i] >= 0 ? r.clusters[rank.get(r.of[i])] : null));
    const count = new Map();
    for (const t of D.types) {
      const c = byPath.get(t.path);
      t.domain = c ? c.name : 'unassigned';
      count.set(t.domain, (count.get(t.domain) || 0) + 1);
    }
    DOMLIST = r.clusters.map((c, i) => ({ name: c.name, hue: domHue(i) }));
    if (count.has('unassigned')) DOMLIST.push({ name: 'unassigned', hue: null });
    DOMCOUNT = count;
    DOMAINS = r;
    chrome();
    render();
  }).catch(() => {});
}

function readURL() {
  const p = new URLSearchParams(location.search);
  if (['plate', 'wheel', 'ledger', 'domain'].includes(p.get('v'))) state.v = p.get('v');
  if (p.get('t') && BY.has(p.get('t'))) state.sel = p.get('t');
  if (p.get('d')) state.dom = p.get('d');
}
/* Stamped once per gesture, never per frame: a replaceState on every pointer move stalls the
   renderer for whole seconds with nothing in the console to say why. */
function stampURL() {
  const p = new URLSearchParams();
  p.set('v', state.v);
  if (state.sel) p.set('t', state.sel);
  if (state.dom) p.set('d', state.dom);
  history.replaceState(null, '', '?' + p);
}

/* ---------------------------------------------------------------- chrome */

/* Three SCALES, not three skins: one type, one module, the whole repository. A reader who has
   the plate open and wants the next question answered has to change scale to ask it. */
const VIEWS = [
  ['plate', 'Plate', 'one type, drafted'],
  ['wheel', 'Wheel', 'one module, chorded'],
  ['ledger', 'Ledger', 'the whole matrix'],
  ['domain', 'Domain', 'one domain, wired'],
];

/* One list at a time, at full height. Kind stays out of it: five toggles beside the search. */
const TABS = [['types', 'Types'], ['domains', 'Domains'], ['modules', 'Modules']];

function chrome() {
  $('bar').innerHTML = VIEWS.map(([k, n, s]) =>
    `<button data-v="${k}" aria-pressed="${state.v === k}">${n}<small>${s}</small></button>`).join('');
  for (const b of $('bar').children) b.onclick = () => { state.v = b.dataset.v; stampURL(); render(); };

  const kindTog = k => `<button class="ktog" data-kind="${k}" aria-pressed="${state.kinds.has(k)}">`
    + `<i style="background:${KCOLOR[k]}"></i>${k}</button>`;
  $('kinds').innerHTML = KINDS.map(kindTog).join('')
    + `<button class="ktog" data-tests aria-pressed="${state.tests}"><i class="dim"></i>tests</button>`;
  for (const b of $('kinds').querySelectorAll('[data-kind]')) {
    b.onclick = () => { state.kinds.has(b.dataset.kind) ? state.kinds.delete(b.dataset.kind) : state.kinds.add(b.dataset.kind); chrome(); render(); };
  }
  $('kinds').querySelector('[data-tests]').onclick = () => { state.tests = !state.tests; chrome(); render(); };

  $('tabs').innerHTML = TABS.map(([k, n]) =>
    `<button data-tab="${k}" aria-pressed="${state.tab === k}">${n}</button>`).join('');
  for (const b of $('tabs').children) b.onclick = () => { state.tab = b.dataset.tab; rail(); };

  $('q').oninput = () => { state.q = $('q').value.trim(); rail(); if (state.v === 'ledger') render(); };
}

/* Two predicates, because a focused reading crosses domains: a type's relations do not stop at
   the edge of the cluster it was inferred into, and hiding the ones that leave would be the map
   lying about what the code does. Kind, module and tests still apply to both. */
const passesBase = t => state.kinds.has(t.kind) && state.mods.has(t.module) && (state.tests || !t.test);

const passes = t => passesBase(t)
  && (!state.dom || t.domain === state.dom)
  && (!state.q || t.name.toLowerCase().includes(state.q.toLowerCase())
    || t.module.toLowerCase().includes(state.q.toLowerCase()));

/* ---------------------------------------------------------------- the index rail */

function rail() {
  const hits = D.types.filter(passes);
  /* The relation count has to be the count of what the filter LEFT, or the header reads
     "1349 types · 4041 relations" while 2890 of them are the only ones any view can draw. */
  const on = new Set(hits.map(t => t.id));
  const rel = D.edges.filter(e => on.has(e.from) && on.has(e.to)).length;
  $('count').textContent = `${hits.length} types · ${rel} relations`
    + (state.dom ? ` · in ${state.dom}` : '');
  for (const b of $('tabs').children) b.setAttribute('aria-pressed', String(state.tab === b.dataset.tab));
  if (state.tab === 'domains') domainRows();
  else if (state.tab === 'modules') moduleRows();
  else typeRows(hits);
}

function typeRows(hits) {
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

/* A domain row is not a checkbox: clicking one opens it, which is the whole reason the
   clustering is here. Clicking the open one again closes it back to the whole repository. */
function domainRows() {
  if (!DOMAINS) {
    $('list').innerHTML = `<div class="grp" style="position:static">inferring domains…</div>`;
    return;
  }
  $('list').innerHTML = `<div class="grp">${DOMLIST.length} inferred <span style="float:right;opacity:.7">click to open</span></div>`
    + DOMLIST.map(d => `<div class="row" data-dom="${esc(d.name)}" aria-selected="${state.dom === d.name}">`
      + `<i class="dot" style="background:${d.hue === null ? 'var(--mid)' : `hsl(${d.hue} 45% 62%)`}"></i>`
      + `<span class="nm">${esc(d.name)}</span><span class="dg">${DOMCOUNT.get(d.name) || 0}</span></div>`).join('');
  for (const r of $('list').querySelectorAll('[data-dom]')) r.onclick = () => openDomain(r.dataset.dom);
}

function openDomain(name) {
  const off = state.dom === name;
  state.dom = off ? null : name;
  state.focus = null;
  if (off) { if (state.v === 'domain') state.v = 'plate'; } else state.v = 'domain';
  const cur = BY.get(state.sel);
  if (!off && (!cur || !passes(cur))) {
    const best = D.types.filter(passes).sort((a, b) => DEG.get(b.id) - DEG.get(a.id))[0];
    if (best) state.sel = best.id;
  }
  stampURL(); render();
}

function moduleRows() {
  $('list').innerHTML = `<div class="grp">${MODULES.length} modules <span style="float:right;opacity:.7">click to filter</span></div>`
    + MODULES.map(m => `<div class="row${state.mods.has(m) ? '' : ' dim'}" data-mod="${esc(m)}" aria-selected="${state.mods.has(m)}">`
      + `<i class="dot" style="background:${state.mods.has(m) ? 'var(--mid)' : 'transparent'};border:1px solid var(--rule2)"></i>`
      + `<span class="nm">${esc(m)}</span><span class="dg">${MODCOUNT.get(m) || 0}</span></div>`).join('');
  for (const r of $('list').querySelectorAll('[data-mod]')) {
    r.onclick = () => { state.mods.has(r.dataset.mod) ? state.mods.delete(r.dataset.mod) : state.mods.add(r.dataset.mod); render(); };
  }
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
    + (t.doc ? `<p class="doc">${esc(t.doc)}</p>` : '')
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
  /* A resize can arrive before the fetch does — the window manager does not wait for us. */
  if (!D) return;
  rail();
  for (const b of $('bar').children) b.setAttribute('aria-pressed', String(state.v === b.dataset.v));
  $('view').textContent = '';
  if (state.v === 'ledger') ledger();
  else if (state.v === 'domain') domainView();
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

/* ---------------------------------------------------------------- pan & zoom (plate) */

/* A grid tied to the DRAWING, not the viewport: it lives inside the zoomed group so panning or
   zooming slides and scales it exactly like graph paper under the content, and it is drawn far
   past any content bounds so the screen is never bigger than the paper, at any pan a person
   can reach. */
function gridBG() {
  const g = el('g');
  const defs = el('defs');
  defs.appendChild(el('pattern', { id: 'gridpat', width: 40, height: 40, patternUnits: 'userSpaceOnUse' },
    [el('path', { d: 'M40 0 L0 0 0 40', fill: 'none', stroke: '#131c23', 'stroke-width': 1 })]));
  g.appendChild(defs);
  g.appendChild(el('rect', { x: -60000, y: -60000, width: 120000, height: 120000, fill: 'var(--sheet)' }));
  g.appendChild(el('rect', { x: -60000, y: -60000, width: 120000, height: 120000, fill: 'url(#gridpat)' }));
  return g;
}

/* Pan (drag) and zoom (wheel, pinch, or the HUD buttons) on the content's own group. d3-zoom owns
   the gesture math; this only ever writes the one CSS transform it hands back. */
function setupZoom(svg, zoomG, x0, y0, w, h, maxScale = 1.6) {
  const view = $('view');
  const vw = view.clientWidth || 1180, vh = view.clientHeight || 560;
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  const fit = Math.min(vw / w, vh / h, maxScale);
  const start = d3.zoomIdentity
    .translate(vw / 2 - (x0 + w / 2) * fit, vh / 2 - (y0 + h / 2) * fit)
    .scale(fit);

  const zoom = d3.zoom().scaleExtent([0.03, 6])
    .on('zoom', ev => zoomG.setAttribute('transform', ev.transform));
  const sel = d3.select(svg).call(zoom).call(zoom.transform, start);
  sel.on('dblclick.zoom', null);

  const step = k => sel.transition().duration(180).call(zoom.scaleBy, k);
  const hud = svg.parentNode.querySelector('.zoom-hud');
  hud.querySelector('[data-z="in"]').onclick = () => step(1.4);
  hud.querySelector('[data-z="out"]').onclick = () => step(1 / 1.4);
  hud.querySelector('[data-z="reset"]').onclick = () => sel.transition().duration(220).call(zoom.transform, start);
  return { zoom, sel, start };
}

function zoomHUD() {
  const hud = document.createElement('div');
  hud.className = 'zoom-hud';
  for (const [z, title, label] of [['in', 'Zoom in', '+'], ['out', 'Zoom out', '−'], ['reset', 'Reset view', '⤾']]) {
    const b = document.createElement('button');
    b.dataset.z = z; b.title = title; b.textContent = label;
    hud.appendChild(b);
  }
  return hud;
}

/* Same bug once, so written once: el() builds SVG-namespaced elements — right everywhere else in
   these views, wrong for an HTML wrapper or button, which need real HTML elements to take CSS
   position at all. */
function canvasWrap(svg) {
  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  wrap.appendChild(svg);
  wrap.appendChild(zoomHUD());
  return wrap;
}

/* ---------------------------------------------------------------- keys */

addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); $('q').select(); }
  else if (e.key === 'Escape') { $('q').value = ''; state.q = ''; $('q').blur(); rail(); if (state.v === 'ledger') render(); }
  else if (!e.metaKey && !e.ctrlKey && '1234'.includes(e.key) && document.activeElement !== $('q')) {
    state.v = VIEWS[+e.key - 1][0]; stampURL(); render();
  }
});
addEventListener('resize', () => { if (['ledger', 'plate', 'domain'].includes(state.v)) render(); });
