/**
 * Corpus arm B — real agent output, mined from local Claude Code transcripts.
 *
 * #224 says to reuse `../marker-drop-rate/`'s corpus, and half of that is right: its 42 chunks
 * are the only baseline #203's numbers are comparable against, so they stay as arm A. But they
 * are a median 41 words / 3 sentences, hand-authored to be reshapeable into one breath — and
 * at whole-sentence granularity the hull of their `faithfulCore` is a median 85% of the source,
 * with 16/42 at >=90%. There is almost no reduction job to do on them, so measuring span
 * SELECTION there measures nothing.
 *
 * The router's real input is the few-hundred-word eye-formatted report #216 observed shipping.
 * Measured on this machine: 129 such turns across 15 transcripts, median 327 words, p90 570,
 * max 1255 — 8x arm A. Real text is also unbiased in a way that matters here: arm A's chunks
 * were authored to CARRY protected markers, which is a thumb on the scale for the exact thing
 * under measurement.
 *
 * PRIVACY: these are the user's own transcripts. The mined file stays gitignored and local;
 * chunks leave the machine only as prompts to the router and judge models, which run on the
 * user's own subscription. Run with `--redact` to drop chunks matching a secret-ish pattern.
 *
 * Deterministic: chunks are ranked by a content hash, never by Math.random, so a re-run
 * produces the identical corpus and the sweep stays reproducible.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROJECTS = join(homedir(), '.claude', 'projects')
const MIN_WORDS = 150
const TARGET = 40

/** Cheap, stable, order-independent of the filesystem. Used for sampling, not security. */
const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length

/**
 * #192 rule 1: raw artifact is NEVER voiced, so a block that is mostly a code fence is not a
 * chunk the router would ever see. Filtering it here keeps the corpus honest rather than
 * padding it with inputs the design already excludes.
 */
const mostlyCode = (t: string): boolean => {
  const fenced = [...t.matchAll(/```[\s\S]*?```/g)].reduce((n, m) => n + m[0].length, 0)
  return fenced / Math.max(1, t.length) > 0.4
}

const SECRETISH = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/

type Mined = { readonly id: string; readonly source: string; readonly words: number }

function collect(): Mined[] {
  const seen = new Set<string>()
  const out: Mined[] = []
  for (const dir of readdirSync(PROJECTS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const dirPath = join(PROJECTS, dir.name)
    let files: string[]
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }
    for (const file of files) {
      let lines: string[]
      try {
        lines = readFileSync(join(dirPath, file), 'utf8').split('\n')
      } catch {
        continue
      }
      for (const line of lines) {
        if (!line.trim()) continue
        let obj: unknown
        try {
          obj = JSON.parse(line)
        } catch {
          continue
        }
        const rec = obj as { type?: string; message?: { content?: unknown } }
        if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) continue
        for (const block of rec.message.content as { type?: string; text?: string }[]) {
          const text = block?.type === 'text' ? block.text?.trim() : undefined
          if (!text || words(text) < MIN_WORDS || mostlyCode(text)) continue
          const key = text.slice(0, 200)
          if (seen.has(key)) continue
          seen.add(key)
          out.push({ id: `b-${hash(text).toString(36)}`, source: text, words: words(text) })
        }
      }
    }
  }
  return out
}

const redact = process.argv.includes('--redact')
const all = collect().filter((c) => !redact || !SECRETISH.test(c.source))

// Stratify by length so the corpus spans the real distribution instead of clustering at the
// floor: a 160-word turn and a 900-word one are different reduction problems.
const bands: [string, (w: number) => boolean][] = [
  ['short', (w) => w < 250],
  ['mid', (w) => w >= 250 && w < 450],
  ['long', (w) => w >= 450],
]
const perBand = Math.ceil(TARGET / bands.length)
const picked = bands.flatMap(([, inBand]) =>
  all
    .filter((c) => inBand(c.words))
    .sort((a, b) => hash(a.id) - hash(b.id))
    .slice(0, perBand),
)

const outPath = join(import.meta.dir, 'corpus-b.json')
writeFileSync(outPath, `${JSON.stringify(picked, null, 2)}\n`)

const ws = picked.map((c) => c.words).sort((a, b) => a - b)
console.log(`candidates: ${all.length}  picked: ${picked.length}`)
console.log(`words — min ${ws[0]} median ${ws[Math.floor(ws.length / 2)]} max ${ws[ws.length - 1]}`)
console.log(`wrote ${outPath}`)
