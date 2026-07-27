/**
 * The run: corpus x arm -> router -> speaker -> council.
 *
 * Two properties this rig needs and a naive script would not have.
 *
 * INCREMENTAL. Every trial is appended to a JSONL file as it completes and a re-run skips
 * trials already present. Stage 3 costs real money per line and the CLI router is slow, so a
 * crash forty minutes in must not throw away forty minutes.
 *
 * NEVER FABRICATES. A failed router call, an unreachable speaker or a dead judge produces a
 * trial marked with its error and NO scores — never a zero, never an empty transcript scored
 * as clean. #203's report flagged thinking-leaked rows for the same reason: a row that
 * measured something other than what it claims is worse than a missing row.
 *
 *   bun verify.ts                            # first, always
 *   bun sweep.ts --arms A --limit 6          # pilot
 *   bun sweep.ts --limit 20                  # both corpus arms
 *   bun sweep.ts --full                      # everything
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ARMS, type ArmId, runRouter } from './arms'
import { type Arm, type EvalChunk, loadCorpus } from './corpus'
import { checkAll, type SpanVerdict } from './containment'
import { convene, type CouncilResult } from './council'
import type { Backend } from './llm'
import { mapLimit } from './llm'
import { sessionInstructions, speakerFromEnv } from './speaker'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (name: string): boolean => argv.includes(`--${name}`)

const ROUTER: Backend = { kind: 'claude-cli', model: flag('router') ?? 'sonnet', label: `claude:${flag('router') ?? 'sonnet'}` }

/**
 * Mixed by default — see council.ts. The Claude arm judges the OpenAI speaker's output and the
 * OpenAI arm judges text produced by a Claude router, so neither vendor grades only its own
 * homework on the axis that carries three votes.
 */
const PANEL: Backend[] = [
  { kind: 'openai', model: flag('judge-openai') ?? 'gpt-5', label: `openai:${flag('judge-openai') ?? 'gpt-5'}` },
  { kind: 'claude-cli', model: flag('judge-claude') ?? 'sonnet', label: `claude:${flag('judge-claude') ?? 'sonnet'}` },
]

const OUT = join(import.meta.dir, flag('out') ?? 'results.jsonl')

export type Trial = {
  readonly key: string
  readonly chunkId: string
  readonly corpusArm: Arm
  readonly arm: ArmId
  readonly sourceWords: number
  readonly routerMs: number
  readonly routerProblems: readonly string[]
  /** Span arms only. */
  readonly spans?: readonly SpanVerdict[]
  readonly payload: string
  readonly payloadWords: number
  readonly spokenMs?: number
  readonly spoken?: string
  readonly spokenWords?: number
  readonly council?: CouncilResult
  readonly error?: string
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length

const done = new Set<string>(
  existsSync(OUT)
    ? readFileSync(OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => (JSON.parse(l) as Trial).key)
    : [],
)

const speaker = speakerFromEnv()
const scoreStage3 = !has('no-speak')

async function runTrial(chunk: EvalChunk, armId: ArmId): Promise<Trial> {
  const arm = ARMS.find((a) => a.id === armId)
  if (!arm) throw new Error(`unknown arm ${armId}`)
  const key = `${chunk.arm}/${chunk.id}/${armId}`
  const base = { key, chunkId: chunk.id, corpusArm: chunk.arm, arm: armId, sourceWords: words(chunk.source) }

  const router = await runRouter(arm, ROUTER, chunk.source)
  const common = {
    ...base,
    routerMs: router.ms,
    routerProblems: router.problems,
    payload: router.payload,
    payloadWords: words(router.payload),
    ...(router.reduced ? { spans: checkAll(chunk.source, router.reduced.spans) } : {}),
  }
  if (router.error) return { ...common, error: `router: ${router.error}` }
  if (!scoreStage3) return common

  try {
    const said = await speaker.speak(router.payload, sessionInstructions(arm.preReducedClause))
    const council = await convene(PANEL, chunk.source, said.transcript)
    return { ...common, spokenMs: said.ms, spoken: said.transcript, spokenWords: words(said.transcript), council }
  } catch (e) {
    return { ...common, error: `speaker: ${e instanceof Error ? e.message : String(e)}` }
  }
}

const corpusArms = ((flag('arms') ?? 'AB').toUpperCase().split('') as string[])
  .map((c) => (c === 'A' ? 'A-synthetic' : 'B-real') as Arm)
const limit = has('full') ? Number.POSITIVE_INFINITY : Number(flag('limit') ?? 6)

const corpus = loadCorpus(corpusArms)
const byArm = corpusArms.map((a) => corpus.filter((c) => c.arm === a).slice(0, limit)).flat()
const armIds = (flag('only')?.split(',') as ArmId[] | undefined) ?? ARMS.map((a) => a.id)
const work = byArm.flatMap((c) => armIds.map((a) => ({ chunk: c, arm: a }))).filter((w) => !done.has(`${w.chunk.arm}/${w.chunk.id}/${w.arm}`))

console.log(`router  ${ROUTER.label}`)
console.log(`panel   ${PANEL.map((p) => p.label).join(' + ')}`)
console.log(`speaker ${speaker.label}${scoreStage3 ? '' : ' (skipped: --no-speak)'}`)
console.log(`trials  ${work.length} to run, ${done.size} already in ${OUT}\n`)

let n = 0
await mapLimit(work, Number(flag('concurrency') ?? 3), async (w) => {
  const t = await runTrial(w.chunk, w.arm)
  appendFileSync(OUT, `${JSON.stringify(t)}\n`)
  n++
  const spanNote = t.spans ? ` spans ${t.spans.filter((s) => s.contained).length}/${t.spans.length}` : ''
  console.log(`[${n}/${work.length}] ${t.key}${spanNote}${t.error ? `  ERROR ${t.error.slice(0, 80)}` : ''}`)
})

console.log(`\ndone — ${OUT}\nnext: bun report.ts`)
