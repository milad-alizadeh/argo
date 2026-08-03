/**
 * Two corpus arms, because the interesting number is a curve rather than a rate.
 *
 * arm A — `../marker-drop-rate/corpus.ts`, 42 synthetic chunks, median 41 words. Kept solely
 *         for comparability: #203's 15.7-21.3% is the only prior number this design can be
 *         measured against, and a different corpus would confound the design change with the
 *         input change.
 * arm B — 42 real assistant turns mined from local transcripts, median 335 words, max 1255.
 *         The job the router actually has (#216's eye-formatted report).
 *
 * Reporting reduction ratio as a function of source length across both arms is what turns
 * "the router quotes 85% of the source" from an alarming finding into a length artifact, or
 * confirms it is not one.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORPUS as SYNTHETIC } from '../marker-drop-rate/corpus'

export type Arm = 'A-synthetic' | 'B-real'

export type EvalChunk = {
  readonly id: string
  readonly arm: Arm
  readonly source: string
  /**
   * Arm A only. #224's judges score against the SOURCE, so no annotation is required — this
   * survives purely as arm A's legacy hook back to #203's instrument.
   */
  readonly faithfulCore?: string
}

const armB = (): EvalChunk[] => {
  const path = join(import.meta.dir, 'corpus-b.json')
  if (!existsSync(path)) {
    console.warn(
      'corpus-b.json absent — run `bun mine-transcripts.ts --redact` first. Arm B skipped.',
    )
    return []
  }
  const rows = JSON.parse(readFileSync(path, 'utf8')) as { id: string; source: string }[]
  return rows.map((r) => ({ id: r.id, arm: 'B-real' as const, source: r.source }))
}

export const loadCorpus = (arms: readonly Arm[]): EvalChunk[] => [
  ...(arms.includes('A-synthetic')
    ? SYNTHETIC.map((c) => ({
        id: c.id,
        arm: 'A-synthetic' as const,
        source: c.source,
        faithfulCore: c.faithfulCore,
      }))
    : []),
  ...(arms.includes('B-real') ? armB() : []),
]
