/* PROTOTYPE — what changes together, from git alone.
   CodeCharta's own coupling export reaches 240 of this repo's 1,547 files, which is too thin
   to cluster on, so the pair counting is done here where the two thresholds that decide the
   answer are ours: which commits are too broad to mean anything, and how many neighbours a
   file is allowed to keep. Nothing here knows which repo it is reading.
   Usage: node atlas-cochange.mjs <repo-root> <subtree> <ext> <out.json>
   Paths come out keyed the way the map keys them: relative to the subtree's parent, which is
   the map's own sourceRoot, so the two files join without either side knowing about the other. */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [REPO, SUB, EXT, OUT] = process.argv.slice(2);
const K = 20;               // neighbours kept per file — bounds the file, not the repo
const SUBTREE = SUB ? SUB.replace(/\/$/, '') + '/' : '';
const SOURCE_ROOT = SUBTREE.split('/').slice(0, -2).join('/');
const STRIP = SOURCE_ROOT ? SOURCE_ROOT + '/' : '';

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

/* One pass, newest first, so a rename is seen before the older name it replaces and the two
   halves of a file's history count as one file. Without this a renamed file looks like two
   files that never once changed together. */
const alias = new Map();
const canon = p => { let q = p, n = 0; while (alias.has(q) && n++ < 32) q = alias.get(q); return q; };

const wanted = p => p.startsWith(SUBTREE) && (!EXT || p.endsWith('.' + EXT));
const strip = p => p.slice(STRIP.length);

const log = git('log', '--no-merges', '--name-status', '--find-renames',
                '--pretty=format:%x00%H', '--', SUBTREE || '.');

const commits = [];
for (const block of log.split('\0')) {
  if (!block.trim()) continue;
  const lines = block.split('\n');
  const files = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts[0][0] === 'R' && parts.length === 3) {
      const [, from, to] = parts;
      if (wanted(from) && wanted(to)) alias.set(from, canon(to));
      if (wanted(to)) files.add(canon(to));
      continue;
    }
    const p = parts[parts.length - 1];
    if (wanted(p)) files.add(canon(p));
  }
  if (files.size > 1) commits.push([...files]);
}

/* A sweeping commit — a rename of a whole package, a formatter run, a licence header —
   couples everything it touches to everything else it touches, and one of them can outweigh
   the entire rest of the history. The cap is the repo's own 90th percentile rather than a
   number we chose, so a repo of small commits is not punished for it. */
const sizes = commits.map(c => c.length).sort((a, b) => a - b);
const cap = sizes.length ? sizes[Math.floor(sizes.length * 0.9)] : 0;
const kept = commits.filter(c => c.length <= cap);

const changes = new Map();
const pairs = new Map();
for (const files of kept) {
  for (const f of files) changes.set(f, (changes.get(f) || 0) + 1);
  const s = files.slice().sort();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const k = s[i] + '\0' + s[j];
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
}

/* Jaccard, not a raw count and not shared/max: a file that changes on every commit would
   otherwise look coupled to the whole repo, which is a fact about that file and never about
   the pair. */
const near = new Map();
for (const [k, shared] of pairs) {
  const [a, b] = k.split('\0');
  const j = shared / (changes.get(a) + changes.get(b) - shared);
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!near.has(x)) near.set(x, []);
    near.get(x).push([y, j]);
  }
}

/* Top-K per file, then the symmetric union, so the sidecar's size follows the file count and
   not how busy the history is. A global threshold instead makes an active repo enormous and
   a quiet one empty. */
const edges = new Map();
for (const [f, list] of near) {
  list.sort((p, q) => q[1] - p[1]);
  for (const [g, j] of list.slice(0, K)) {
    const k = f < g ? f + '\0' + g : g + '\0' + f;
    edges.set(k, j);
  }
}

/* Paths are interned. Written out in full, a ninety-character path appearing in forty edges
   is most of the file; the same data by index is a fifth of the size, and this is fetched on
   every page load. */
/* Not the working directory's name: in a worktree that is the branch's name, which is a
   different word every time. The common git directory belongs to the repository itself. */
function repoName() {
  const base = p => p.replace(/\/?\.git\/?$/, '').replace(/\/$/, '').split('/').pop();
  try { return base(git('rev-parse', '--path-format=absolute', '--git-common-dir').trim()); }
  catch { return base(REPO); }
}

const head = git('rev-parse', 'HEAD').trim();
const names = [...changes.keys()];
const idx = new Map(names.map((f, i) => [f, i]));
const out = {
  /* The repo's own name, which nothing else in the pipeline knows and no heuristic over the
     paths can recover: it is a perfectly ordinary, well-concentrated token that happens to
     name every domain equally, so it is the one word a domain must never be called. */
  built: { commit: head, at: new Date().toISOString(), subtree: SUB || '',
           repo: repoName(),
           commits: commits.length, kept: kept.length, cap, k: K },
  files: names.map(strip),
  changes: names.map(f => changes.get(f)),
  edges: [...edges].map(([k, j]) => { const [a, b] = k.split('\0');
    return [idx.get(a), idx.get(b), Math.round(j * 1000) / 1000]; }),
};
writeFileSync(OUT, JSON.stringify(out));
console.log('commits', commits.length, 'kept', kept.length, 'cap', cap,
            'files', names.length, 'edges', out.edges.length);
