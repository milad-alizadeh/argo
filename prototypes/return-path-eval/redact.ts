/**
 * Produce a committable copy of a run.
 *
 * The raw `results.jsonl` cannot be committed: arm-B rows embed excerpts of the user's own
 * transcripts in `payload`, `spoken`, the span text and the judges' evidence quotes. But
 * leaving the numbers to survive only as prose in a ticket means nobody can re-run `report.ts`,
 * check the arithmetic, or re-score later — and re-creating the run costs real money.
 *
 * So: split by arm rather than dropping the file.
 *
 *   arm A  kept whole. Its sources are the committed synthetic corpus; nothing is private.
 *   arm B  every text field removed, every metric kept — word counts, span verdicts, judge
 *          verdicts, latencies. Anything the report reads that is DERIVED from text (the
 *          verbatim comparison) is precomputed here, so the report needs no text to run.
 *
 * The result reproduces every number in the #224 resolution and reveals none of the corpus.
 *
 *   bun redact.ts results.jsonl results-public.jsonl
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readTrials, type Trial } from './trial'

const inPath = join(import.meta.dir, process.argv[2] ?? 'results.jsonl')
const outPath = join(import.meta.dir, process.argv[3] ?? 'results-public.jsonl')

/** The report's verbatim test, evaluated here so the redacted row does not need the text. */
const spokenBody = (t: Trial): string =>
  (t.payload.startsWith('[REDUCED]')
    ? t.payload.split('\n\n').slice(1).join('\n\n')
    : t.payload
  ).trim()

const redactRow = (t: Trial): Record<string, unknown> => {
  const verbatim = t.spoken !== undefined && t.spoken.trim() === spokenBody(t)
  if (t.corpusArm === 'A-synthetic') return { ...t, verbatim }
  const { payload: _p, spoken: _s, ...rest } = t
  return {
    ...rest,
    verbatim,
    redacted: true,
    // Span verdicts without the quoted text. The booleans are the measurement; the span was
    // only ever the evidence for them.
    spans: t.spans?.map(({ span: _span, ...v }) => v),
    council: t.council
      ? {
          ...t.council,
          axes: t.council.axes.map(({ evidence: _e, ...a }) => ({
            ...a,
            evidenceCount: _e.length,
          })),
        }
      : undefined,
  }
}

const rows = (await readTrials(inPath)).map(redactRow)
writeFileSync(outPath, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)

const armB = rows.filter((r) => r.corpusArm === 'B-real')
console.log(`wrote ${rows.length} rows to ${outPath}`)
console.log(`  arm A kept whole:  ${rows.length - armB.length}`)
console.log(`  arm B redacted:    ${armB.length}`)
const leak = rows.filter(
  (r) => r.corpusArm === 'B-real' && (r.payload !== undefined || r.spoken !== undefined),
)
console.log(
  leak.length === 0
    ? '  no arm-B text present — safe to commit'
    : `  !!! ${leak.length} ROWS STILL CARRY TEXT`,
)
