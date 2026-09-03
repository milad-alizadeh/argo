/* PROTOTYPE — the type graph the class diagram is drawn from.
   Project-agnostic in shape: one LANG pack per language, and a repo with none of them
   produces an empty graph rather than a wrong one. Swift is written out because this repo
   is Swift; TS is here to prove the pack is a pack and not a disguise for one grammar.
   Usage: node atlas-types.mjs [subtree] [out.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync('git', ['-C', HERE, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SUB = process.argv[2] || process.env.ATLAS_SUBTREE || 'apps/macOS';
const OUT = process.argv[3] || join(HERE, 'atlas-types.json');

/* A comment or a string can hold anything a declaration can, so both are blanked before any
   pattern runs — kept the same LENGTH, so every offset below still points where it did. */
function blank(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      let k = 1; out += '  '; i += 2;
      while (i < n && k) {
        if (src[i] === '/' && src[i + 1] === '*') { k++; out += '  '; i += 2; continue; }
        if (src[i] === '*' && src[i + 1] === '/') { k--; out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      continue;
    }
    if (c === '"') {
      out += ' '; i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') { out += ' '; i++; }
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out += ' '; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

const KINDS = 'class|struct|enum|protocol|actor|extension';
const SWIFT = {
  ext: ['.swift'],
  decl: new RegExp(String.raw`(?:^|\n)([ ]*)((?:(?:public|package|internal|private|fileprivate|open|final|indirect|@\w+(?:\([^)]*\))?)\s+)*)(${KINDS})\s+([A-Za-z_]\w*)\s*(?:<[^>{]*>)?\s*(?::\s*([^{\n]+?))?\s*(?:where[^{]*)?\{`, 'g'),
  prop: /(?:^|\n)[ ]*((?:(?:public|package|internal|private|fileprivate|open|static|final|lazy|weak|unowned|@\w+(?:\([^)]*\))?)\s+)*)(let|var)\s+([A-Za-z_]\w*)\s*:\s*([^\n={]+)/g,
  func: /(?:^|\n)[ ]*((?:(?:public|package|internal|private|fileprivate|open|static|final|mutating|nonisolated|@\w+(?:\([^)]*\))?)\s+)*)func\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*((?:async|throws|rethrows|\s)*)(?:->\s*([^{\n]+))?/g,
  cases: /(?:^|\n)[ ]*case\s+([A-Za-z_]\w*)/g,
  module: p => {
    const m = p.match(/Packages\/([^/]+)\//);
    if (m) return m[1];
    const a = p.match(/apps\/[^/]+\/([^/]+)\//);
    return a ? a[1] : 'app';
  },
};
const TS = {
  ext: ['.ts', '.tsx'],
  decl: new RegExp(String.raw`(?:^|\n)([ ]*)((?:(?:export|default|abstract|declare)\s+)*)(class|interface|enum)\s+([A-Za-z_]\w*)\s*(?:<[^>{]*>)?\s*((?:(?:extends|implements)[^{\n]+)?)\{`, 'g'),
  prop: /(?:^|\n)[ ]*((?:(?:public|private|protected|readonly|static)\s+)*)()([A-Za-z_]\w*)\s*\??:\s*([^\n=;{(]+)/g,
  func: /(?:^|\n)[ ]*((?:(?:public|private|protected|static|async)\s+)*)([A-Za-z_]\w*)\s*\(([^)]*)\)\s*()(?::\s*([^\n{;]+))?/g,
  cases: /(?:^|\n)[ ]*([A-Z_][A-Z0-9_]*)\s*=/g,
  module: p => p.split('/').slice(0, 3).join('/'),
};
const PACKS = [SWIFT, TS];
const packFor = p => PACKS.find(L => L.ext.includes(extname(p)));

/* Where a declaration's body ends. Braces only: the comment and string blanking above is what
   makes that honest, and a file whose braces do not balance yields a body that runs to EOF. */
function bodyEnd(src, open) {
  let k = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') k++;
    else if (src[i] === '}') { k--; if (!k) return i; }
  }
  return src.length;
}

const files = execFileSync('git', ['-C', ROOT, 'ls-files', SUB], { encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n').filter(p => p && packFor(p) && !p.includes('/.build/'));

const types = new Map();
const raw = [];

for (const path of files) {
  const L = packFor(path);
  let src;
  try { src = blank(readFileSync(join(ROOT, path), 'utf8')); } catch { continue; }
  L.decl.lastIndex = 0;
  let m;
  while ((m = L.decl.exec(src))) {
    const [all, , mods, kind, name, sup] = m;
    const open = m.index + all.length - 1;
    const end = bodyEnd(src, open);
    raw.push({
      path, kind, name, mods: mods.trim(), sup: (sup || '').trim(),
      start: m.index, end, line: src.slice(0, m.index + 1).split('\n').length,
      body: src.slice(open + 1, end), module: L.module(path),
      lang: L === SWIFT ? 'swift' : 'ts',
    });
  }
}

const TYPEISH = /[A-Za-z_][\w.]*/g;
const NOISE = new Set(['String', 'Int', 'Double', 'Float', 'Bool', 'Void', 'Any', 'AnyObject',
  'Self', 'Date', 'URL', 'UUID', 'Data', 'CGFloat', 'Result', 'Optional', 'Array', 'Set',
  'Dictionary', 'number', 'string', 'boolean', 'void', 'unknown', 'never', 'null', 'undefined',
  'Promise', 'Record', 'Partial']);

function refs(text) {
  const out = [];
  for (const t of String(text).match(TYPEISH) || []) {
    const head = t.split('.')[0];
    if (!NOISE.has(head) && /^[A-Z]/.test(head)) out.push(head);
  }
  return out;
}
const arity = t => /\[|Array<|Set<|Dictionary<|Record</.test(t) ? 'many'
  : /\?\s*$/.test(t.trim()) ? 'maybe' : 'one';

for (const d of raw) {
  const id = d.name;
  if (!types.has(id)) {
    types.set(id, {
      id, name: d.name, kind: d.kind === 'extension' ? null : d.kind, module: d.module,
      lang: d.lang, path: d.path, line: d.line, access: 'internal', props: [], funcs: [],
      cases: [], conforms: [], parent: null, files: [], exts: 0, loc: 0,
    });
  }
  const T = types.get(id);
  if (d.kind === 'extension') T.exts++;
  else {
    T.kind = d.kind; T.path = d.path; T.line = d.line; T.module = d.module;
    T.access = (d.mods.match(/\b(open|public|package|private|fileprivate)\b/) || [, 'internal'])[1];
  }
  if (!T.files.includes(d.path)) T.files.push(d.path);
  T.loc += d.body.split('\n').length;

  /* Members of the types nested inside this body belong to THEM, so their ranges are blanked
     out before anything is counted here. By RANGE, because two nested types can be alike. */
  let body = d.body;
  const base = d.start + (d.body ? d.end - d.body.length - 1 : 0);
  for (const k of raw) {
    if (k === d || k.path !== d.path) continue;
    if (k.start <= d.start || k.end > d.end) continue;
    const a = k.start - base - 1, b = k.end - base - 1;
    if (a >= 0 && b <= body.length && b > a) body = body.slice(0, a) + ' '.repeat(b - a) + body.slice(b);
  }
  d.own = body;

  for (const s of d.sup.split(',').map(x => x.trim()).filter(Boolean)) {
    for (const r of refs(s)) if (!T.conforms.includes(r)) T.conforms.push(r);
  }

  const L = d.lang === 'swift' ? SWIFT : TS;
  for (const [re, sink] of [[L.prop, 'props'], [L.func, 'funcs'], [L.cases, 'cases']]) {
    re.lastIndex = 0;
    let x;
    while ((x = re.exec(body))) {
      if (sink === 'props') {
        T.props.push({
          mods: x[1].trim(), let: x[2] === 'let', name: x[3],
          type: x[4].trim().replace(/\s+/g, ' '), arity: arity(x[4]), refs: refs(x[4]),
        });
      } else if (sink === 'funcs') {
        T.funcs.push({
          mods: x[1].trim(), name: x[2], args: x[3].trim().replace(/\s+/g, ' '),
          ret: (x[5] || '').trim(), refs: [...refs(x[3]), ...refs(x[5] || '')],
        });
      } else T.cases.push(x[1]);
    }
  }
}

/* Nesting, from the declaration ranges rather than from names. */
for (const d of raw) {
  if (d.kind === 'extension') continue;
  let host = null;
  for (const k of raw) {
    if (k === d || k.path !== d.path || k.kind === 'extension') continue;
    if (k.start < d.start && k.end >= d.end && (!host || k.start > host.start)) host = k;
  }
  if (host && types.has(d.name) && host.name !== d.name) types.get(d.name).parent = host.name;
}

/* A name an EXTENSION alone introduced is not a type this project declares — `View`, `CGRect`.
   Left in, they were the two biggest hubs on the graph, which is a picture of SwiftUI rather
   than of the repo. They stay as a stereotype line on the box that conforms, never as a node. */
const declared = [...types.values()].filter(t => t.kind);
const known = new Set(declared.map(t => t.id));
for (const T of declared) {
  T.foreign = T.conforms.filter(c => !known.has(c));
  T.conforms = T.conforms.filter(c => known.has(c));
}
const edges = new Map();
const add = (from, to, rel, label) => {
  if (from === to || !known.has(to)) return;
  const k = `${from} ${to} ${rel}`;
  if (!edges.has(k)) edges.set(k, { from, to, rel, n: 0, labels: [] });
  const e = edges.get(k);
  e.n++;
  if (label && e.labels.length < 4 && !e.labels.includes(label)) e.labels.push(label);
};
for (const T of declared) {
  for (const c of T.conforms) {
    const k = types.get(c);
    add(T.id, c, k && k.kind === 'class' ? 'inherits' : 'conforms');
  }
  for (const p of T.props) {
    for (const r of new Set(p.refs)) {
      add(T.id, r, 'holds', `${p.name}${p.arity === 'many' ? ' *' : p.arity === 'maybe' ? ' ?' : ''}`);
    }
  }
  for (const f of T.funcs) for (const r of new Set(f.refs)) add(T.id, r, 'uses', f.name);
  if (T.parent) add(T.id, T.parent, 'nested');
}

const out = {
  generated: new Date().toISOString(), subtree: SUB,
  head: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  types: declared, edges: [...edges.values()],
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`${out.types.length} types, ${out.edges.length} edges, ${files.length} files -> ${OUT}`);
