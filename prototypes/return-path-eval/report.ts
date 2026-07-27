/**
 * Aggregation into the numbers #224 asked for. Deliberately plain text — this gets pasted into
 * a ticket resolution, not rendered.
 *
 * Every rate prints its denominator. A "0%" over four trials and a "0%" over four hundred are
 * different claims, and #203's resolution turned on exactly that distinction.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AXES } from './judges'
import { readTrials, type Trial } from './trial'

const path = join(import.meta.dir, process.argv[2] ?? 'results.jsonl')
if (!existsSync(path)) throw new Error(`no results at ${path} — run sweep.ts first`)
const trials = await readTrials(path)

const pct = (n: number, d: number): string => (d === 0 ? '   n/a' : `${((100 * n) / d).toFixed(1).padStart(5)}%`)
const rate = (n: number, d: number): string => `${pct(n, d)}  (${n}/${d})`
const groups = <T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x])
  return m
}
const median = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

const ok = trials.filter((t) => !t.error)
const failed = trials.filter((t) => t.error)

console.log(`# #224 return-path eval — ${trials.length} trials (${failed.length} errored, excluded from rates)\n`)

// ---------------------------------------------------------------- 1. quotation fidelity
console.log('## 1. Quotation fidelity — does the router actually quote? (#224 unknown 1)\n')
const spanTrials = ok.filter((t) => t.spans && t.spans.length > 0)
for (const [k, ts] of groups(spanTrials, (t) => `${t.corpusArm} / ${t.arm}`)) {
  const spans = ts.flatMap((t) => t.spans ?? [])
  const contained = spans.filter((s) => s.contained)
  const rescued = spans.filter((s) => s.normalisationRescued)
  const drift = spans.filter((s) => !s.contained)
  console.log(`  ${k}   ${ts.length} trials, ${spans.length} spans`)
  console.log(`    contained (normalised) ${rate(contained.length, spans.length)}`)
  console.log(`    contained (strict)     ${rate(spans.filter((s) => s.exact).length, spans.length)}`)
  console.log(`    rescued by normaliser  ${rate(rescued.length, spans.length)}   <- what the leniency bought`)
  console.log(`    trials with >=1 miss   ${rate(ts.filter((t) => (t.spans ?? []).some((s) => !s.contained)).length, ts.length)}`)
  if (drift.length > 0) {
    console.log(`    of the misses: median ${median(drift.map((s) => s.matchedPrefixWords))} words copied before drift`)
  }
}
const parseProblems = ok.filter((t) => t.routerProblems.length > 0)
console.log(`\n  router replies with a format problem: ${rate(parseProblems.length, ok.length)}`)
for (const [p, ts] of groups(parseProblems.flatMap((t) => t.routerProblems.map((p) => ({ p }))), (x) => x.p.replace(/\d+/g, 'N'))) {
  console.log(`    ${ts.length}x  ${p}`)
}

// ---------------------------------------------------------------- 2. reduction
console.log('\n## 2. Reduction — did anything actually get reduced?\n')
for (const [k, ts] of groups(ok, (t) => `${t.corpusArm} / ${t.arm}`)) {
  const ratios = ts.map((t) => t.payloadWords / Math.max(1, t.sourceWords))
  const spoken = ts.filter((t) => t.spokenWords !== undefined)
  console.log(
    `  ${k}   source ${median(ts.map((t) => t.sourceWords))}w -> payload ${median(ts.map((t) => t.payloadWords))}w` +
      ` (${(100 * median(ratios)).toFixed(0)}%)` +
      (spoken.length > 0 ? ` -> spoken ${median(spoken.map((t) => t.spokenWords ?? 0))}w` : ''),
  )
}

// ------------------------------------------- 3. does the audio model change what it was given?
console.log('\n## 3. Stage 3 — what the audio model did to the payload (#224 unknown 2)\n')
// Keyed on `spokenWords`, not `spoken`: the redacted run drops the transcript but keeps its
// length, and "did stage 3 produce a line" is what this section is actually asking.
const spokenTrials = ok.filter((t) => t.spokenWords !== undefined)
for (const [k, ts] of groups(spokenTrials, (t) => `${t.corpusArm} / ${t.arm}`)) {
  // Strip the `[REDUCED] ...` header only for the span arms, which have one. The control's
  // payload is a bare written line, and blindly slicing off a first paragraph emptied it —
  // which made the control read as 0% verbatim by construction rather than by measurement.
  //
  // `verbatim` is precomputed by `redact.ts` for rows whose text was removed before commit, so
  // the committed run reproduces this number without carrying the transcripts that produced it.
  const spokenBody = (t: Trial): string =>
    ((t.payload ?? '').startsWith('[REDUCED]') ? (t.payload ?? '').split('\n\n').slice(1).join('\n\n') : t.payload ?? '').trim()
  const verbatim = ts.filter((t) => t.verbatim ?? (t.spoken ?? '').trim() === spokenBody(t))
  const shrank = ts.filter((t) => (t.spokenWords ?? 0) < 0.8 * t.payloadWords)
  console.log(`  ${k}   ${ts.length} trials`)
  console.log(`    spoke the payload verbatim   ${rate(verbatim.length, ts.length)}`)
  console.log(`    compressed by >20%           ${rate(shrank.length, ts.length)}   <- what §3's clause is meant to stop`)
  console.log(`    median latency               ${Math.round(median(ts.map((t) => t.spokenMs ?? 0)))}ms`)
}

// ---------------------------------------------------------------- 4. the council
console.log('\n## 4. Council verdicts — violation rates by axis (#192/#199 as rubric)\n')
const judged = ok.filter((t) => t.council)
const armKeys = [...groups(judged, (t) => `${t.corpusArm} / ${t.arm}`).keys()]
const width = Math.max(22, ...armKeys.map((k) => k.length))
console.log(`  ${'axis'.padEnd(22)}${armKeys.map((k) => k.padEnd(width)).join('')}`)
for (const axis of AXES) {
  const cells = armKeys.map((k) => {
    const ts = groups(judged, (t) => `${t.corpusArm} / ${t.arm}`).get(k) ?? []
    const v = ts.filter((t) => t.council?.axes.find((a) => a.axis === axis.id)?.violation)
    return rate(v.length, ts.length).padEnd(width)
  })
  console.log(`  ${axis.id.padEnd(22)}${cells.join('')}`)
}
const contested = judged.flatMap((t) => t.council?.axes ?? []).filter((a) => a.contested)
const unparsable = judged.flatMap((t) => t.council?.axes ?? []).reduce((n, a) => n + a.unparsableVotes, 0)
console.log(`\n  contested (panel split): ${contested.length} axis-verdicts`)
console.log(`  unparsable judge votes:  ${unparsable}  <- counted as "no violation"; non-zero means rates are floors`)
const vendors = [...new Set(judged.flatMap((t) => t.council?.axes ?? []).flatMap((a) => a.vendors))]
console.log(`  panel vendors:           ${vendors.join(' + ')}${vendors.length < 2 ? '   <- SINGLE VENDOR: not an adversarial panel' : ''}`)

// ---------------------------------------------------------------- 5. errors
if (failed.length > 0) {
  console.log('\n## 5. Errored trials (excluded above)\n')
  for (const [e, ts] of groups(failed, (t) => (t.error ?? '').split(':').slice(0, 2).join(':').slice(0, 70))) {
    console.log(`  ${ts.length}x  ${e}`)
  }
}
