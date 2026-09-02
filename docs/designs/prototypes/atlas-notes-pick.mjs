/* PROTOTYPE — picks the files worth explaining, from the measurements alone.
   The point of the split is that a model never chooses what is interesting. It is handed a
   short list the numbers already flagged, and it answers the question the map raised.
   Nothing here knows it is looking at Argo: every rule reads the analysis, not the repo. */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const map = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const REPO = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const files = [];
/* Every folder that holds files of its own, which is exactly the set the map draws as a
   plate. A folder of nothing but folders belongs to the build, not to the code, and the map
   does not draw it, so there is nothing there to caption. */
const folders = [];
(function walk(n, path) {
  const here = path ? path + '/' + n.name : n.name;
  if (n.type === 'File') { files.push({ path: here, a: n.attributes || {} }); return; }
  const kids = n.children || [];
  const own = kids.filter(c => c.type === 'File');
  if (own.length) folders.push({ path: here, files: own.map(c => c.name), inside: kids.length });
  kids.forEach(c => walk(c, here));
})(map.nodes[0], '');

const at = (f, k) => f.a[k] || 0;
const has = k => files.some(f => at(f, k) > 0);
const top = (k, n) => [...files].sort((x, y) => at(y, k) - at(x, k)).slice(0, n);

/* A file that is complex *for its size* is a different finding from a file that is merely
   long. The line of best fit through the whole repo is the repo's own normal, so the ones
   furthest above it are dense in a way no single number reports. */
function offTheLine(sizeKey, key, n) {
  const pts = files.filter(f => at(f, sizeKey) > 0);
  if (pts.length < 20 || !has(key)) return [];
  const mx = pts.reduce((s, f) => s + at(f, sizeKey), 0) / pts.length;
  const my = pts.reduce((s, f) => s + at(f, key), 0) / pts.length;
  let num = 0, den = 0;
  for (const f of pts) {
    const dx = at(f, sizeKey) - mx;
    num += dx * (at(f, key) - my); den += dx * dx;
  }
  if (!den) return [];
  const slope = num / den, base = my - slope * mx;
  return pts.map(f => ({ f, r: at(f, key) - (base + slope * at(f, sizeKey)) }))
    .sort((a, b) => b.r - a.r).slice(0, n).map(x => x.f);
}

/* Each rule states the question the reader is left with, in the reader's words. The rule is
   what gets shown beside the answer, so a note can never look like an unprompted opinion. */
const RULES = [
  { why: 'One of the most complex files here.', key: 'complexity', pick: () => top('complexity', 8) },
  { why: 'Denser than its size explains.', key: 'complexity', pick: () => offTheLine('rloc', 'complexity', 6) },
  { why: 'One of the largest files here.', key: 'rloc', pick: () => top('rloc', 6) },
  { why: 'Changed more often than almost anything else.', key: 'number_of_commits', pick: () => top('number_of_commits', 8) },
  { why: 'Touched by more people than almost anything else.', key: 'number_of_authors', pick: () => top('number_of_authors', 6) },
];

const picked = new Map();
for (const rule of RULES) {
  if (!has(rule.key)) continue;
  for (const f of rule.pick()) {
    if (!at(f, rule.key)) continue;
    if (!picked.has(f.path)) picked.set(f.path, { path: f.path, why: [] });
    picked.get(f.path).why.push(rule.why);
  }
}

/* A pair is its own subject. The arcs say two files move together and the panel says how
   often; neither can say why, and the why is the only part a reader cannot derive. */
const pairs = (map.edges || []).slice(0, 8)
  .map(([a, b, v]) => ({ pair: [a, b], strength: v }));

const disk = p => join(REPO, map.sourceRoot || '', p.replace(/^\//, ''));
function stamp(p) {
  const f = disk(p);
  if (!existsSync(f) || statSync(f).isDirectory()) return null;
  return createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
}

/* A caption is written from what the folder holds, so the sample is the few files that
   carry most of its code — reading all of them costs more and says the same thing. */
const size = new Map(files.map(f => [f.path, at(f, 'rloc')]));
const sample = f => f.files.map(n => f.path + '/' + n)
  .sort((a, b) => (size.get(b) || 0) - (size.get(a) || 0)).slice(0, 5);

const todo = { of: map.projectName || '', sourceRoot: map.sourceRoot || '', at: new Date().toISOString().slice(0, 10),
  folders: folders.map(f => ({ path: f.path, files: f.files, sample: sample(f) })),
  files: [...picked.values()].map(e => ({ ...e, hash: stamp(e.path) })).filter(e => e.hash),
  pairs: pairs.filter(p => p.pair.every(stamp)).map(p => ({ ...p, hash: p.pair.map(stamp).join('-') })) };

writeFileSync(out, JSON.stringify(todo, null, 2));
console.log('folders', todo.folders.length, 'files', todo.files.length,
            'pairs', todo.pairs.length, 'of', files.length, 'measured');
