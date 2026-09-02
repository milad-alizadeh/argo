/* PROTOTYPE — serves the atlas and rebuilds it on request, one reportable step at a time.
   The page is drawn from atlas-cc.json, so a stale file is a wrong map with no way to tell.
   This server both serves that file uncached and knows what it was built from, which is the
   only way the page can say "you are looking at last week" before anybody clicks. */
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, writeFileSync, renameSync,
         rmSync, statSync, mkdtempSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.ATLAS_PORT || 8731);
const MAP = join(HERE, 'atlas-cc.json');
const NOTES = join(HERE, 'atlas-notes.json');
/* The subtree and the language are the pipeline's only repo-specific knobs, and both stay
   env-settable so this serves a repo that has neither apps/macOS nor any Swift in it. */
const SUBTREE = process.env.ATLAS_SUBTREE || 'apps/macOS';
const EXT = process.env.ATLAS_EXT || 'swift';

/* Nothing here ever reaches /bin/sh: repository content becomes an argv element or nothing.
   A file full of $( is a script the shell would run, and the first sign is a corrupt map. */
const exec = (bin, args, opts = {}) => new Promise((res, rej) =>
  execFile(bin, args, { maxBuffer: 1 << 24, ...opts },
    (e, out) => e ? rej(e) : res(String(out).trim())));

const HINT = {
  ccsh: 'nothing — npx fetches it, but it needs a JDK 11+ and npx on PATH',
  java: 'a JDK 11 or newer — brew install openjdk',
  node: 'Node 18 or newer',
  claude: 'the Claude Code CLI — npm i -g @anthropic-ai/claude-code',
  git: 'git',
};

function which(bin) {
  for (const dir of (process.env.PATH || '').split(':')) {
    if (!dir) continue;
    try { accessSync(join(dir, bin), constants.X_OK); return join(dir, bin); } catch { /* next */ }
  }
  return null;
}

const missing = tools => tools.filter(t => !which(t));

/* ---------- what the repo is now ---------- */

async function repoRoot() { return exec('git', ['-C', HERE, 'rev-parse', '--show-toplevel']); }

async function repoState() {
  const root = await repoRoot();
  const head = await exec('git', ['-C', root, 'rev-parse', 'HEAD']);
  const dirty = (await exec('git', ['-C', root, 'status', '--porcelain'])).length > 0;
  return { root, head, dirty };
}

const mtime = p => existsSync(p) ? statSync(p).mtimeMs : null;
const readJSON = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/* ---------- staleness ---------- */

/* The picker already stamps every subject with a hash of the file it read, so asking it again
   and diffing the stamps is the whole staleness test. Re-deriving those hashes here would be
   a second implementation of the one rule that has to agree with the writer. */
async function pickNow() {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-pick-'));
  const out = join(dir, 'todo.json');
  try {
    await exec(process.execPath, [join(HERE, 'atlas-notes-pick.mjs'), MAP, out], { cwd: HERE });
    return readJSON(out);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function noteDiff(todo, notes) {
  const changed = { files: [], pairs: [], folders: [] };
  for (const f of todo.files || []) {
    const had = (notes.files || {})[f.path];
    if (!had || had.hash !== f.hash) changed.files.push(f);
  }
  for (const p of todo.pairs || []) {
    const had = (notes.pairs || []).find(n => n.pair[0] === p.pair[0] && n.pair[1] === p.pair[1]);
    if (!had || had.hash !== p.hash) changed.pairs.push(p);
  }
  /* A caption is written from what a folder holds, and a folder has no content hash of its
     own, so its file list standing in for one is the cheapest honest test. */
  for (const f of todo.folders || []) {
    const had = (notes.folders || {})[f.path];
    if (!had || had.files !== f.files.length) changed.folders.push(f);
  }
  return changed;
}

/* ccsh arriving through npx is not a missing tool, so it is only reported when npx is gone too. */
const mapTools = () => missing(['java', 'git']).concat(which('ccsh') || which('npx') ? [] : ['ccsh']);

async function status() {
  const map = readJSON(MAP);
  const built = (map && map.built) || null;
  const repo = await repoState().catch(() => null);
  const s = {
    ok: true, subtree: (map && map.projectName) || SUBTREE, built,
    head: repo && repo.head, dirty: repo && repo.dirty,
    mapAt: mtime(MAP), notesAt: mtime(NOTES),
    tools: { map: mapTools(), notes: missing(['claude']) },
    behind: null, notesStale: 0, notesTotal: 0, reasons: [],
  };
  if (built && repo && built.commit !== repo.head) {
    s.behind = +(await exec('git', ['-C', repo.root, 'rev-list', '--count', `${built.commit}..HEAD`])
      .catch(() => '0')) || null;
    s.reasons.push(s.behind ? `${s.behind} commit${s.behind > 1 ? 's' : ''} behind` : 'built from another commit');
  }
  if (!map) s.reasons.push('no map built yet');
  else if (!built) s.reasons.push('built from an unrecorded commit');
  if (repo && repo.dirty) s.reasons.push('working tree is dirty');
  const notes = readJSON(NOTES);
  if (notes && map) {
    const todo = await pickNow().catch(() => null);
    if (todo) {
      const changed = noteDiff(todo, notes);
      s.notesStale = changed.files.length + changed.pairs.length + changed.folders.length;
      s.notesTotal = (todo.files || []).length + (todo.pairs || []).length + (todo.folders || []).length;
      if (s.notesStale) s.reasons.push(`${s.notesStale} note${s.notesStale > 1 ? 's' : ''} stale`);
    }
  }
  s.stale = s.reasons.length > 0;
  return s;
}

/* ---------- the rebuild ---------- */

/* Progress is per line rather than per step because the parsers are silent for minutes at a
   time, and a button that says nothing for two minutes reads as a hang. */
function runStreaming(bin, args, cwd, say) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const feed = buf => {
      tail += buf;
      const lines = tail.split('\n'); tail = lines.pop();
      for (const l of lines) if (l.trim()) say(l.trim().slice(0, 220));
    };
    p.stdout.on('data', d => feed(String(d)));
    p.stderr.on('data', d => feed(String(d)));
    p.on('error', e => rej(new Error(`${bin}: ${e.message}`)));
    p.on('close', c => c === 0 ? res() : rej(new Error(`${bin} exited ${c}`)));
  });
}

/* The map is built beside the live one and moved on top of it only once every step passed,
   so a parser that dies halfway leaves the page drawing the last good city. */
function stampAndPlace(from, repo) {
  const map = JSON.parse(readFileSync(from, 'utf8'));
  map.built = { commit: repo.head, dirty: repo.dirty, subtree: SUBTREE, at: new Date().toISOString() };
  const tmp = MAP + '.tmp';
  writeFileSync(tmp, JSON.stringify(map));
  renameSync(tmp, MAP);
  return map;
}

/* ccsh needs no install: npx fetches the package on demand. A local or global one is used
   when it is there, because npx re-resolves the registry on a cold cache and that is slow. */
const CCSH = which('ccsh')
  ? { bin: 'ccsh', pre: [] }
  : { bin: 'npx', pre: ['-y', '-p', 'codecharta-analysis', 'ccsh'] };
const ccsh = (args, say) => runStreaming(CCSH.bin, [...CCSH.pre, ...args], HERE, l => say('log', l));

async function buildMap(work, repo, say) {
  const metrics = join(work, 'metrics'), churn = join(work, 'churn'), merged = join(work, 'argo');
  say('step', 'Measuring the code');
  await ccsh(['unifiedparser', repo.root, '-fe', EXT, '-nc', '-o', metrics], say);
  say('step', 'Reading the git history');
  await ccsh(['gitlogparser', 'repo-scan', '--repo-path', repo.root, '-nc', '-o', churn], say);
  say('step', 'Merging the two');
  await ccsh(['merge', `${metrics}.cc.json`, `${churn}.cc.json`, '-nc', '-o', merged], say);
  say('step', `Trimming to ${SUBTREE}`);
  const trimmed = join(work, 'trimmed.json');
  await runStreaming(process.execPath, [join(HERE, 'atlas-cc-trim.mjs'), `${merged}.cc.json`, trimmed], HERE,
    l => say('log', l));
  stampAndPlace(trimmed, repo);
}

/* Only the subjects whose file actually changed are handed to the writer, and the rest of
   the notes are carried over untouched: a rewrite of all of them is real money spent to
   re-say what is already on disk. */
async function buildNotes(work, say) {
  const notes = readJSON(NOTES) || { folders: {}, files: {}, pairs: [] };
  say('step', 'Choosing what to explain');
  const todo = await pickNow();
  const changed = noteDiff(todo, notes);
  const n = changed.files.length + changed.pairs.length + changed.folders.length;
  const kept = (todo.files || []).length + (todo.pairs || []).length + (todo.folders || []).length - n;
  if (!n) { say('step', `All ${kept} notes still match their files`); return { written: 0, kept }; }
  say('step', `Writing ${n} note${n > 1 ? 's' : ''}, keeping ${kept}`);
  const subset = join(work, 'todo.json'), fresh = join(work, 'notes.json');
  writeFileSync(subset, JSON.stringify({ ...todo, ...changed }));
  await runStreaming(process.execPath, [join(HERE, 'atlas-notes-write.mjs'), subset, fresh], HERE,
    l => say('log', l));
  const got = JSON.parse(readFileSync(fresh, 'utf8'));
  const merged = { ...notes, at: got.at, model: got.model,
    folders: { ...notes.folders, ...got.folders }, files: { ...notes.files, ...got.files },
    pairs: [...(notes.pairs || []).filter(p =>
      !(got.pairs || []).some(g => g.pair[0] === p.pair[0] && g.pair[1] === p.pair[1])),
      ...(got.pairs || [])] };
  const tmp = NOTES + '.tmp';
  writeFileSync(tmp, JSON.stringify(merged, null, 2));
  renameSync(tmp, NOTES);
  return { written: n, kept };
}

let running = false;

async function regenerate(mode, say) {
  const gone = mapTools().concat(mode === 'notes' ? missing(['claude']) : []);
  if (gone.length) throw new Error(gone.map(t => `${t} is not installed — install ${HINT[t]}`).join('; '));
  const repo = await repoState();
  const work = mkdtempSync(join(tmpdir(), 'atlas-regen-'));
  try {
    const t0 = Date.now();
    await buildMap(work, repo, say);
    const map = readJSON(MAP);
    let notes = null;
    if (mode === 'notes') notes = await buildNotes(work, say);
    return { seconds: Math.round((Date.now() - t0) / 1000),
             files: (map && map.nodes) ? count(map.nodes[0]) : 0, notes };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

const count = n => n.type === 'File' ? 1 : (n.children || []).reduce((s, c) => s + count(c), 0);

/* ---------- http ---------- */

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8' };

/* Every response is uncached, data and page alike: a browser holding yesterday's atlas-cc.json
   after a rebuild is exactly the failure this button exists to end. */
const NOCACHE = { 'cache-control': 'no-store, no-cache, must-revalidate', pragma: 'no-cache', expires: '0' };

function serveFile(req, res, url) {
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(HERE, rel === '/' ? 'atlas-holo.html' : rel);
  if (!file.startsWith(HERE) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain', ...NOCACHE }); return res.end('not here');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...NOCACHE });
  res.end(readFileSync(file));
}

async function serveRegen(req, res, url) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', ...NOCACHE });
  const say = (kind, text) => res.write(JSON.stringify({ kind, text }) + '\n');
  if (running) { say('error', 'A rebuild is already running.'); return res.end(); }
  running = true;
  try {
    const done = await regenerate(url.searchParams.get('mode') === 'notes' ? 'notes' : 'map', say);
    say('done', JSON.stringify(done));
  } catch (e) {
    say('error', e.message || String(e));
  } finally { running = false; res.end(); }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/_atlas/status') {
      const s = await status();
      res.writeHead(200, { 'content-type': 'application/json', ...NOCACHE });
      return res.end(JSON.stringify({ ...s, running }));
    }
    if (url.pathname === '/_atlas/regen') return void await serveRegen(req, res, url);
    serveFile(req, res, url);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain', ...NOCACHE });
    res.end(String(e && e.message || e));
  }
}).listen(PORT, () => console.log(`atlas on http://localhost:${PORT}/atlas-holo.html`));
