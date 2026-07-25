/**
 * The #203 sweep: marker-drop rate × word-cap × model (× temperature).
 *
 * Independent variable is the cap, because #193 named the mechanism: "the brevity cap makes the
 * model choose what to keep." The uncapped arm is what separates "the cap is mis-set" from
 * "this is a capacity floor" — without it a high rate is uninterpretable.
 *
 * Also measures #199's retry (does naming the violated marker actually rescue the line?) so the
 * ~2.3s it costs on the violation path can be justified or dropped.
 *
 * Usage:
 *   bun sweep.ts --models qwen3.5-4b,gemma4-e4b,haiku [--temps] [--out results.json]
 */

import { CAPS, type Cap } from './contract'
import { type Chunk, CORPUS } from './corpus'
import {
  checkLine,
  extractExpected,
  extractiveFallback,
  isViolation,
  type MarkerResult,
  namedRetryNote,
} from './markers'
import { availableLocalKeys, MODELS, type ModelId, type ModelSpec, reshape } from './models'

export type Trial = {
  readonly chunk: string
  readonly type: Chunk['type']
  readonly model: ModelId
  readonly cap: Cap
  readonly temp: number
  readonly line: string
  readonly words: number
  readonly ms: number
  readonly thoughtLeaked: boolean
  readonly markers: readonly MarkerResult[]
  readonly violation: boolean
  /** Populated only when the first pass violated (#199 §4). */
  readonly retry?: {
    readonly line: string
    readonly ms: number
    readonly markers: readonly MarkerResult[]
    readonly rescued: boolean
  }
  readonly fellBackToExtractive?: boolean
  readonly error?: string
}

const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length

async function pool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      const item = items[i]
      if (item === undefined) break
      out[i] = await fn(item, i)
    }
  })
  await Promise.all(workers)
  return out
}

type Cell = {
  readonly chunk: Chunk
  readonly model: ModelSpec
  readonly cap: Cap
  readonly temp: number
}

async function runCell({ chunk, model, cap, temp }: Cell): Promise<Trial> {
  const expected = extractExpected(chunk.faithfulCore)
  const first = await reshape(model, cap, chunk.source, temp)

  const base = {
    chunk: chunk.id,
    type: chunk.type,
    model: model.id,
    cap,
    temp,
    line: first.line,
    words: wordCount(first.line),
    ms: first.ms,
    thoughtLeaked: first.thoughtLeaked,
  } as const

  if (first.error || !first.line) {
    return { ...base, markers: [], violation: false, error: first.error ?? 'empty line' }
  }

  const markers = checkLine(expected, first.line)
  const violation = isViolation(markers)
  if (!violation) return { ...base, markers, violation: false }

  // #199 §4: one named retry, then the model-free extractive fallback.
  const retryTurns = [
    { role: 'assistant' as const, content: first.line },
    { role: 'user' as const, content: namedRetryNote(markers) },
  ]
  const second = await reshape(model, cap, chunk.source, temp, retryTurns)
  const retryMarkers = second.line ? checkLine(expected, second.line) : []
  const rescued = second.line !== '' && !isViolation(retryMarkers)

  return {
    ...base,
    markers,
    violation: true,
    retry: { line: second.line, ms: second.ms, markers: retryMarkers, rescued },
    ...(rescued ? {} : { fellBackToExtractive: true }),
  }
}

async function main() {
  const argv = Bun.argv.slice(2)
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const requested = (arg('--models') ?? 'qwen3.5-4b,gemma4-e4b,haiku')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ModelId[]
  const withTemps = argv.includes('--temps')
  const outPath = arg('--out') ?? 'results.json'

  const localKeys = await availableLocalKeys()
  const specs: ModelSpec[] = []
  for (const id of requested) {
    const spec = MODELS[id]
    if (!spec) throw new Error(`unknown model: ${id}`)
    const key = spec.key
    if (spec.transport === 'lmstudio' && (!key || !localKeys.some((k) => k.includes(key)))) {
      console.error(
        `SKIP ${spec.label} — not loaded in LM Studio (have: ${localKeys.join(', ') || 'none'})`,
      )
      continue
    }
    specs.push(spec)
  }
  if (specs.length === 0) throw new Error('no runnable models')

  const cells: Cell[] = []
  for (const model of specs) {
    for (const cap of CAPS) {
      for (const chunk of CORPUS) {
        cells.push({ chunk, model, cap, temp: 0 })
        // The temp dial is local-only: the claude CLI exposes no temperature flag.
        if (withTemps && model.recommendedTemp !== undefined) {
          cells.push({ chunk, model, cap, temp: model.recommendedTemp })
        }
      }
    }
  }

  console.error(
    `${cells.length} trials — ${specs.length} model(s) × ${CAPS.length} caps × ${CORPUS.length} chunks${withTemps ? ' × temps' : ''}`,
  )

  let done = 0
  const trials = await pool(cells, 4, async (cell) => {
    const t = await runCell(cell)
    done += 1
    if (done % 20 === 0) console.error(`  ${done}/${cells.length}`)
    return t
  })

  await Bun.write(outPath, JSON.stringify({ corpus: CORPUS.length, trials }, null, 2))
  console.error(`wrote ${outPath}`)

  const errs = trials.filter((t) => t.error)
  if (errs.length) console.error(`${errs.length} trials errored — first: ${errs[0]?.error}`)
}

if (import.meta.main) await main()

export { extractiveFallback, runCell }
