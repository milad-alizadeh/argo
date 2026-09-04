#!/usr/bin/env node
// What the gate has actually cost, from the rows `scripts/metrics.sh` writes (#1377).
//
// Six things changed about how the gate runs, and every one of them is the kind of change that
// FEELS faster. This is the file that says whether it was. It answers four questions, and each
// one has a number attached that a later run can be compared against:
//
//   1. How often does a gate run learn nothing?  — the hit rate. Before #1377 every run was a
//      full one, so every hit here is a full gate that did not happen.
//   2. What did that save?                        — hits and skipped steps, priced at the median
//      run of the same thing.
//   3. Is a full run getting faster or slower?    — the median and the worst case.
//   4. Is the machine being fought over?          — seconds spent queueing for a build slot, and
//      the load average while the gate ran.
//
// Usage: node scripts/gate-report.mjs [--days N] [--file PATH]
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const optionAfter = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const days = Number(optionAfter('--days') ?? 7)
const file =
  optionAfter('--file') ??
  `${process.env.ARGO_METRICS_FILE ?? `${process.env.HOME}/Library/Caches/argo-gate/metrics.tsv`}`

let rows = []
try {
  rows = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [when, event, name, outcome, seconds, waited, branch, load, freeGb] = line.split('\t')
      return {
        when: new Date(when),
        event,
        name,
        outcome,
        seconds: Number(seconds),
        waited: Number(waited),
        branch,
        load: Number(load),
        freeGb: Number(freeGb),
      }
    })
} catch {
  console.log(`gate-report: no metrics at ${file} yet — run the gate once and come back`)
  process.exit(0)
}

const since = new Date(Date.now() - days * 86_400_000)
rows = rows.filter((r) => r.when >= since)
if (rows.length === 0) {
  console.log(`gate-report: no rows in the last ${days} days`)
  process.exit(0)
}

const median = (values) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const percentile = (values, p) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]
}
const mmss = (s) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`

const gates = rows.filter((r) => r.event === 'gate')
const full = gates.filter((r) => r.outcome === 'run')
const hits = gates.filter((r) => r.outcome === 'hit')
const skips = gates.filter((r) => r.outcome === 'skip')
const fullSeconds = full.map((r) => r.seconds)
const medianFull = median(fullSeconds)

console.log(`\ngate-report — ${rows.length} rows over the last ${days} days\n`)

console.log('Gate runs')
console.log(
  `  full runs        ${full.length}  (median ${mmss(medianFull)}, worst ${mmss(percentile(fullSeconds, 95))})`,
)
console.log(`  answered by cache ${hits.length}`)
console.log(`  out of scope      ${skips.length}`)
const decided = full.length + hits.length
if (decided > 0) {
  console.log(
    `  hit rate          ${Math.round((hits.length / decided) * 100)}%  (of runs that had a tree to judge)`,
  )
}

// Every hit is a full gate that did not happen, priced at what a full one costs.
const gateSaved = hits.length * medianFull

// The steps, which is where a run an AGENT already did shows up: a suite it ran by hand is a
// step the gate then found recorded.
const steps = rows.filter((r) => r.event === 'step')
const stepNames = [...new Set(steps.map((r) => r.name))].sort()
let stepSaved = 0
if (stepNames.length > 0) {
  console.log('\nSteps')
  for (const name of stepNames) {
    const mine = steps.filter((r) => r.name === name)
    const ran = mine.filter((r) => r.outcome === 'run')
    const hit = mine.filter((r) => r.outcome === 'hit')
    const med = median(ran.map((r) => r.seconds))
    stepSaved += hit.length * med
    console.log(
      `  ${name.padEnd(32)} ran ${String(ran.length).padStart(3)}  skipped ${String(hit.length).padStart(3)}  median ${mmss(med)}`,
    )
  }
}

console.log('\nWhat that saved')
console.log(`  gate runs not taken   ${hits.length} × ${mmss(medianFull)} = ${mmss(gateSaved)}`)
console.log(`  steps not re-run      ${mmss(stepSaved)}`)
console.log(`  total                 ${mmss(gateSaved + stepSaved)}`)

// Per branch, because the cost #1377 set out to remove was lanes MULTIPLIED BY merges: one
// branch gated over and over as other lanes landed. A branch here should read 1 or 2.
const branches = [...new Set(gates.map((r) => r.branch))]
const perBranch = branches.map((b) => full.filter((r) => r.branch === b).length)
console.log('\nFull gate runs per branch')
console.log(`  branches seen     ${branches.length}`)
console.log(`  median per branch ${median(perBranch)}   worst ${Math.max(0, ...perBranch)}`)

const waits = full.map((r) => r.waited)
const loads = full.map((r) => r.load).filter((n) => n > 0)
console.log('\nThe machine while it ran')
console.log(
  `  queued for a build slot   median ${mmss(median(waits))}, worst ${mmss(Math.max(0, ...waits))}`,
)
console.log(`  load average              median ${median(loads).toFixed(1)}`)
console.log(`  free disk                 ${median(full.map((r) => r.freeGb))} GB`)

// The targets, so a reader does not have to remember what good looks like. These are the
// numbers #1377 set out to move, and the baseline column is what was measured before it.
console.log('\nAgainst the baseline (#1377, 2026-09-04)')
const rowsOut = [
  ['full gate runs per branch', 'lanes × merges (~8 × 90/day)', median(perBranch)],
  ['load average while gating', '178 on 12 cores', median(loads).toFixed(1)],
  ['free disk', '9 GB', `${median(full.map((r) => r.freeGb))} GB`],
]
for (const [what, was, now] of rowsOut) {
  console.log(`  ${what.padEnd(28)} was ${String(was).padEnd(30)} now ${now}`)
}
console.log('')
