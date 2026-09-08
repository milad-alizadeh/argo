// Which STEP paid for a gate run, and which branch paid twice (#1711).
//
// `metrics.sh` stamps a caller and a phase on every row; these read them back. What they are
// for, and the lane that motivated them: `docs/agents/code-review.md`.

import { median, mmss } from './gate-stats.mjs'

const OUTCOMES = ['run', 'hit', 'skip']

// One tally per caller-and-phase pair that appears, ordered by the pair's name so two runs over
// one file print the same table. The median prices what a full run of that pair costs.
//
// It reads STEP rows as well as gate ones, and has to: only `swift-gate.sh` writes an
// `event=gate` row and it writes them all under the phase `gate`, so a table of gate rows alone
// would have one phase in it. `correctness`, `cost`, `quality` and `build` are stamped by the
// steps themselves, and the phase is what says which unit a row counts.
export const byCallerAndPhase = (rows) => {
  const pairs = new Map()
  for (const row of rows) {
    if (row.event !== 'gate' && row.event !== 'step') continue
    if (!OUTCOMES.includes(row.outcome)) continue
    const key = `${row.caller}\t${row.phase}`
    const tally = pairs.get(key) ?? { caller: row.caller, phase: row.phase, seconds: [] }
    tally[row.outcome] = (tally[row.outcome] ?? 0) + 1
    if (row.outcome === 'run') tally.seconds.push(row.seconds)
    pairs.set(key, tally)
  }
  return [...pairs.keys()]
    .sort()
    .map((key) => pairs.get(key))
    .map(({ caller, phase, seconds, ...counts }) => ({
      caller,
      phase,
      full: counts.run ?? 0,
      hits: counts.hit ?? 0,
      skips: counts.skip ?? 0,
      median: median(seconds),
    }))
}

// The branches that paid for more than one FULL gate, worst first, each with the runs that cost
// them — the caller and phase of every full gate that branch paid, which is the "why".
export const repeatedFullGates = (gates) => {
  const branches = new Map()
  for (const row of gates.filter((r) => r.outcome === 'run')) {
    branches.set(row.branch, [...(branches.get(row.branch) ?? []), row])
  }
  return [...branches.entries()]
    .filter(([, runs]) => runs.length > 1)
    .map(([branch, runs]) => ({
      branch,
      runs: [...runs].sort((a, b) => a.when - b.when),
      seconds: runs.reduce((total, r) => total + r.seconds, 0),
    }))
    .sort((a, b) => b.runs.length - a.runs.length || b.seconds - a.seconds)
}

export const renderCallerPhases = (metrics) => {
  const rows = byCallerAndPhase(metrics)
  if (rows.length === 0) return []
  const lines = ['\nBy caller and phase (`gate` is the whole gate; the rest are its steps)']
  for (const { caller, phase, full, hits, skips, median: med } of rows) {
    lines.push(
      `  ${`${caller}/${phase}`.padEnd(26)} full ${String(full).padStart(3)}` +
        `  cached ${String(hits).padStart(3)}  out of scope ${String(skips).padStart(3)}` +
        `  median ${mmss(med)}`,
    )
  }
  // `unknown` is not a bug in the report, so it says what it means rather than leaving a reader
  // to guess: the row was written by something that named no caller.
  if (rows.some((r) => r.caller === 'unknown')) {
    lines.push('  unknown = nothing set ARGO_GATE_CALLER — a gate run by hand, or an older row')
  }
  return lines
}

export const renderRepeatedFullGates = (gates) => {
  const repeated = repeatedFullGates(gates)
  const lines = ['\nBranches that paid more than one full gate']
  if (repeated.length === 0) {
    lines.push('  none — every branch in this window paid at most one')
    return lines
  }
  for (const { branch, runs, seconds } of repeated) {
    lines.push(`  ${branch}  ${runs.length} full gates, ${mmss(seconds)} in total`)
    for (const run of runs) {
      lines.push(
        `    ${run.when.toISOString().slice(0, 19)}Z  ${run.caller}/${run.phase}` +
          `  ${mmss(run.seconds)}`,
      )
    }
  }
  return lines
}
