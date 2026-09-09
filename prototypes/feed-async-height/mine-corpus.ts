/**
 * Corpus for #1793 — every mermaid diagram and fenced code block a real Feed would have to
 * draw, mined from the local Claude Code transcripts.
 *
 * The ticket asks for "the render cost of every mermaid diagram in a real transcript". Two
 * things about that phrase decide the shape of this file.
 *
 * A hand-written diagram set would answer nothing. Mermaid's cost is dominated by the graph
 * layout, so the only honest input is the size distribution agents actually emit — which is
 * long-tailed, and the tail is what the ≤3s pass has to survive. So the corpus is mined,
 * and the report quotes its distribution rather than an average.
 *
 * "A transcript" is singular in the ticket and plural here. One transcript has too few
 * distinct diagrams to say anything about a tail, and ADR-0030's own subject — the 63 MB
 * Session — is not a mermaid-heavy one. So the sweep is over every project, and the report
 * carries BOTH readings: the worst single transcript (what one Session's pass pays) and the
 * whole mined set (what the cost curve looks like).
 *
 * PRIVACY: the repo is public and these are the user's own transcripts, so `corpus.json` is
 * gitignored, exactly as `return-path-eval` does it. What is committed is `results-*.json`,
 * which holds per-diagram METRICS ONLY — kind, source size, node and edge counts, rendered
 * geometry, timings — and never a line of the source. That keeps the numbers reproducible in
 * shape without publishing anyone's prose.
 *
 * Deterministic: diagrams are keyed and ordered by a content hash, so a re-run over an
 * unchanged transcript set produces byte-identical output and the timings stay comparable.
 *
 * Run: `bun mine-corpus.ts`
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROJECTS = join(homedir(), '.claude', 'projects')
const OUT = join(new URL('.', import.meta.url).pathname, 'corpus.json')

/** Cheap, stable, order-independent of the filesystem. Used for identity, not security. */
const hash = (s: string): string => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * A secret pasted into a transcript must not reach `corpus.json`, which is a plain file on
 * disk that a later run reads back. Diagram sources are the least likely place for one, so
 * this is a seatbelt rather than the privacy story — the gitignore is that.
 */
const SECRETISH = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/

export type Block = {
  readonly id: string
  /** `mermaid`, or the fence's language tag for a code block. */
  readonly lang: string
  readonly source: string
  readonly bytes: number
  readonly lines: number
  /** How many transcripts emitted this exact source. An agent repeats a diagram it is editing. */
  readonly seen: number
  /** The transcript that first carried it, as an opaque id — never a path. */
  readonly transcript: string
}

/** Every `text` string a Feed would draw as prose, from one transcript line. */
function textsOf(record: unknown): string[] {
  if (typeof record !== 'object' || record === null) return []
  const message = (record as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return []
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []
  return content
    .filter((part): part is { type: string; text: string } => {
      if (typeof part !== 'object' || part === null) return false
      const p = part as { type?: unknown; text?: unknown }
      return p.type === 'text' && typeof p.text === 'string'
    })
    .map((part) => part.text)
}

/** Every fenced block in one prose string, with its language tag. */
function* fences(text: string): Generator<{ lang: string; source: string }> {
  const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([A-Za-z0-9_+-]*)[ \t]*\n([\s\S]*?)^\1\2[ \t]*$/gm
  for (const match of text.matchAll(FENCE)) {
    const lang = (match[3] || '').toLowerCase()
    const source = match[4].replace(/\s+$/, '')
    if (source) yield { lang, source }
  }
}

function* transcriptFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* transcriptFiles(path)
    else if (entry.name.endsWith('.jsonl')) yield path
  }
}

function collect(): Block[] {
  const byId = new Map<string, { block: Block; transcripts: Set<string> }>()
  for (const file of transcriptFiles(PROJECTS)) {
    if (statSync(file).size === 0) continue
    const transcript = hash(file)
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.startsWith('{')) continue
      let record: unknown
      try {
        record = JSON.parse(line)
      } catch {
        continue
      }
      for (const text of textsOf(record)) {
        for (const { lang, source } of fences(text)) {
          if (SECRETISH.test(source)) continue
          const id = `${lang || 'plain'}-${hash(source)}`
          const existing = byId.get(id)
          if (existing) {
            existing.transcripts.add(transcript)
            continue
          }
          byId.set(id, {
            transcripts: new Set([transcript]),
            block: {
              id,
              lang: lang || 'plain',
              source,
              bytes: Buffer.byteLength(source, 'utf8'),
              lines: source.split('\n').length,
              seen: 1,
              transcript,
            },
          })
        }
      }
    }
  }
  return [...byId.values()]
    .map(({ block, transcripts }) => ({ ...block, seen: transcripts.size }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

const blocks = collect()
const mermaid = blocks.filter((b) => b.lang === 'mermaid')
writeFileSync(OUT, JSON.stringify({ minedAt: new Date().toISOString(), blocks }, null, 2))
console.log(`${blocks.length} distinct fenced blocks, ${mermaid.length} mermaid → ${OUT}`)
const langs = new Map<string, number>()
for (const b of blocks) langs.set(b.lang, (langs.get(b.lang) ?? 0) + 1)
console.log(
  [...langs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([l, n]) => `${l}:${n}`)
    .join(' '),
)
