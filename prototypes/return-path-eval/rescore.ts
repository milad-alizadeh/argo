/**
 * Re-judge stored trials without re-running the router or the speaker.
 *
 * The rubric is the part of this rig most likely to be wrong, and it was: a real run produced
 * a first-person-to-second-person flip ("I did not touch the STT adapter" -> "You did not
 * touch the STT adapter") and all three contradiction judges scored it clean. Fixing that
 * meant editing `judges.ts` — and re-running the whole sweep to see the effect would have
 * re-paid for every router turn and every second of audio, for a change that touches neither.
 *
 * Stage 1 and 2 outputs are already on disk, so the council can be re-convened over them
 * directly. This is also what makes the rubric itself iterable: a judge blind spot found in
 * week three is a cheap re-score, not a decision to live with the old numbers.
 *
 *   bun rescore.ts results.jsonl rescored.jsonl
 */

import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { convene } from './council'
import type { Backend } from './llm'
import { mapLimit } from './llm'
import { readTrials } from './trial'

const inPath = join(import.meta.dir, process.argv[2] ?? 'results.jsonl')
const outPath = join(import.meta.dir, process.argv[3] ?? 'rescored.jsonl')
if (!existsSync(inPath)) throw new Error(`no results at ${inPath}`)

/**
 * `--panel claude` falls back to a single-vendor panel. Not the default and not as good — two
 * judges from one vendor are one lens — but the metered half of a mixed panel can die
 * mid-run (it did: the OpenAI account hit its quota and 357 of 588 votes came back 429, which
 * the report's unparsable counter caught before any of it was believed). A free single-vendor
 * re-score is worth more than no re-score, PROVIDED the report says which panel voted, which
 * it does.
 */
const PANEL: Backend[] =
  process.argv.includes('--panel') && process.argv[process.argv.indexOf('--panel') + 1] === 'claude'
    ? [
        { kind: 'claude-cli', model: 'sonnet', label: 'claude:sonnet' },
        { kind: 'claude-cli', model: 'haiku', label: 'claude:haiku' },
      ]
    : [
        { kind: 'openai', model: 'gpt-5', label: 'openai:gpt-5' },
        { kind: 'claude-cli', model: 'sonnet', label: 'claude:sonnet' },
      ]
console.log(`panel: ${PANEL.map((p) => p.label).join(' + ')}`)

const trials = await readTrials(inPath)

// Only trials that actually have a spoken line and a source to score it against. The source
// is not stored on the trial, so it is re-derived from the corpus by id.
const { loadCorpus } = await import('./corpus')
const sources = new Map(loadCorpus(['A-synthetic', 'B-real']).map((c) => [`${c.arm}/${c.id}`, c.source]))

const scorable = trials.filter((t) => t.spoken && sources.has(`${t.corpusArm}/${t.chunkId}`))
console.log(`re-judging ${scorable.length} of ${trials.length} trials (rest have no spoken line)`)

let n = 0
const rescored = await mapLimit(scorable, 4, async (t) => {
  const source = sources.get(`${t.corpusArm}/${t.chunkId}`) ?? ''
  const council = await convene(PANEL, source, t.spoken ?? '')
  n++
  const changed = council.axes.filter(
    (a) => a.violation !== t.council?.axes.find((o) => o.axis === a.axis)?.violation,
  )
  console.log(`[${n}/${scorable.length}] ${t.key}${changed.length > 0 ? `  CHANGED: ${changed.map((c) => c.axis).join(', ')}` : ''}`)
  return { ...t, council }
})

writeFileSync(outPath, `${rescored.map((t) => JSON.stringify(t)).join('\n')}\n`)
console.log(`\nwrote ${outPath}\nnext: bun report.ts ${outPath.split('/').pop()}`)
