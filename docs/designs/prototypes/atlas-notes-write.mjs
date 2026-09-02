/* PROTOTYPE — answers the questions the picker raised, one short note per subject.
   This is the only step in the atlas with a model in it, which is why it is a separate file
   with a separate output: the map is drawn from measurements and never from this. Each note
   is stamped with the hash of what was read, so the page can say when a note went stale. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join } from 'node:path';

const todo = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const REPO = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const MODEL = process.env.ATLAS_MODEL || 'sonnet';
const CHARS = 24000;

const disk = p => join(REPO, todo.sourceRoot || '', p.replace(/^\//, ''));
const read = p => readFileSync(disk(p), 'utf8').slice(0, CHARS);

/* The rules are strict because a note that hedges is worse than no note: the reader is
   already looking at the file's numbers, and anything that restates them costs a line and
   says nothing. */
const RULES = `Write for someone reading a map of an unfamiliar codebase.
Two sentences, at most 45 words total. No preamble, no markdown, no quotes.
Say what this code is for and why it exists as its own file, in plain words.
Never mention line counts, complexity scores, commit counts, or any number.
Never say "this file" or "this code" - start with the subject itself.
If the reason it was flagged has a visible cause in the source, name that cause.`;

/* Source code goes in as an argument, never through a shell. A file full of backticks and
   $( is a script the shell will happily run, and the first sign of it is a note that reads
   like nonsense rather than an error. */
function ask(prompt) {
  return execFileSync('claude', ['-p', '--model', MODEL, prompt],
    { encoding: 'utf8', maxBuffer: 1 << 22 }).trim().replace(/\s+/g, ' ');
}

const notes = { of: todo.of, at: new Date().toISOString().slice(0, 10), model: MODEL,
                folders: {}, files: {}, pairs: [] };

/* A caption answers the question a folder name raises and never repeats it: the reader can
   already see that a folder is called Feed, and what they want is what a feed is here. */
const CAPTION = `Write a caption for one folder on a map of an unfamiliar codebase.
One sentence, at most 30 words. No preamble, no markdown, no quotes, no numbers.
Say what lives here and why it is a place of its own, in plain words.
Do not repeat the folder's name back and do not say "this folder" or "contains".`;

for (const f of todo.folders || []) {
  const seen = f.sample.filter(x => existsSync(disk(x)));
  if (!seen.length) continue;
  notes.folders[f.path] = { files: f.files.length,
    note: ask(`${CAPTION}\n\nFolder: ${f.path}\nIt holds: ${f.files.join(', ')}\n\n`
      + seen.map(x => `--- ${x}\n${read(x).slice(0, 5000)}`).join('\n\n')) };
  console.log('\u25ab', f.path.split('/').pop());
}

for (const f of todo.files) {
  if (!existsSync(disk(f.path))) continue;
  notes.files[f.path] = { hash: f.hash, why: f.why,
    note: ask(`${RULES}\n\nFlagged because: ${f.why.join(' ')}\n\n--- ${f.path}\n${read(f.path)}`) };
  console.log('·', f.path.split('/').pop());
}

/* A pair is not two subjects. The only thing worth writing is the shared idea that makes
   one unusable without the other, which is exactly what a list of names cannot show. */
for (const p of todo.pairs) {
  if (!p.pair.every(x => existsSync(disk(x)))) continue;
  notes.pairs.push({ pair: p.pair, strength: p.strength, hash: p.hash,
    note: ask(`These two files keep being changed in the same commit. In one sentence of at most
30 words, say what they share that makes them move together. No preamble, no markdown, no
numbers, no file names.\n\n--- ${p.pair[0]}\n${read(p.pair[0])}\n\n--- ${p.pair[1]}\n${read(p.pair[1])}`) });
  console.log('·', p.pair.map(x => x.split('/').pop()).join(' + '));
}

writeFileSync(out, JSON.stringify(notes, null, 2));
console.log('wrote', Object.keys(notes.folders).length, 'captions,',
            Object.keys(notes.files).length, 'notes and', notes.pairs.length, 'pairs');
