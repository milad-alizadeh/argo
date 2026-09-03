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

/* ---------------------------------------------------------------- keys */

addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); $('q').select(); }
  else if (e.key === 'Escape') { $('q').value = ''; state.q = ''; $('q').blur(); rail(); if (state.v === 'ledger') render(); }
  else if (!e.metaKey && !e.ctrlKey && '123'.includes(e.key) && document.activeElement !== $('q')) {
    state.v = VIEWS[+e.key - 1][0]; stampURL(); render();
  }
});
addEventListener('resize', () => { if (state.v === 'ledger') render(); });
