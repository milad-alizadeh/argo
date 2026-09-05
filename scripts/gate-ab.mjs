#!/usr/bin/env node
// Does the build cap actually buy anything? (#1440)
//
// #1377 built the cap and #1427 wired it to every command that starts a compiler. Both measured
// that it WORKS — the exclusion holds, the callers take slots — which is a different claim from
// the one that justifies it. The first ninety minutes of real data said the median gate went
// from 207s to 431s with the extra 260s spent queueing, and said nothing about what that bought,
// because the window before the change sat inside an editor-indexing storm at load 236 and the
// window after it was a quiet machine at load 34.
//
// So the arms are INTERLEAVED, per run, machine-wide, and this file compares them by ratio. A
// spike lands in both arms; a ratio between them survives it. What it must never do is report a
// difference from an experiment that was not balanced, so the load and the run counts per arm
// are printed beside the result rather than assumed — an arm that saw twice the load is not a
// comparison, whatever the seconds say.
//
// Turn the experiment on with ARGO_BUILD_LOCK_AB=on, leave it for a few dozen gates, then:
//   node scripts/gate-ab.mjs [--days N] [--file PATH]
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
      const [when, event, name, outcome, seconds, waited, branch, load, freeGb, arm] =
        line.split('\t')
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
        arm,
      }
    })
} catch {
  console.log(`gate-ab — no metrics at ${file}`)
  process.exit(0)
}

const since = Date.now() - days * 86_400_000
const gates = rows.filter(
  (r) =>
    r.when.getTime() >= since &&
    r.event === 'gate' &&
    r.outcome === 'run' &&
    (r.arm === 'capped' || r.arm === 'uncapped'),
)

if (gates.length === 0) {
  console.log(`\ngate-ab — no A/B rows in the last ${days} days.`)
  console.log('Run the gate with ARGO_BUILD_LOCK_AB=on to start the experiment.\n')
  process.exit(0)
}

const median = (xs) => {
  if (xs.length === 0) return Number.NaN
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const secs = (n) => (Number.isNaN(n) ? '   n/a' : `${Math.round(n)}s`.padStart(6))

function arm(name) {
  const rs = gates.filter((r) => r.arm === name)
  return {
    name,
    runs: rs.length,
    total: median(rs.map((r) => r.seconds)),
    // The number the cap can actually move. Total is what a person waits; work is what the
    // machine did, and a cap that helps must show up here — less contention, less thrash.
    work: median(rs.map((r) => r.seconds - r.waited)),
    queued: median(rs.map((r) => r.waited)),
    load: median(rs.map((r) => r.load)),
  }
}

const capped = arm('capped')
const uncapped = arm('uncapped')

console.log(`\ngate-ab — ${gates.length} full gate runs over the last ${days} days\n`)
console.log('                    runs   total    work  queued    load')
for (const a of [capped, uncapped]) {
  console.log(
    `  ${a.name.padEnd(16)}${String(a.runs).padStart(4)}  ${secs(a.total)}  ${secs(a.work)}  ${secs(
      a.queued,
    )}  ${a.load.toFixed(1).padStart(6)}`,
  )
}

// Ratios, not differences: the absolute seconds move with whatever else is on the machine, and
// the point of interleaving is that whatever that is hit both arms.
const ratio = (a, b) => (b === 0 ? Number.NaN : a / b)
const workRatio = ratio(capped.work, uncapped.work)
const totalRatio = ratio(capped.total, uncapped.total)

console.log('\n  capped ÷ uncapped')
console.log(`    work    ${workRatio.toFixed(2)}×   ${verdict(workRatio)}`)
console.log(`    total   ${totalRatio.toFixed(2)}×   ${verdict(totalRatio)}`)

function verdict(r) {
  if (Number.isNaN(r)) return ''
  if (r < 0.95) return 'the cap is ahead'
  if (r > 1.05) return 'the cap is behind'
  return 'no difference worth having'
}

// An unbalanced experiment reports a difference between two machines, not between two arms.
console.log('\n  Is the experiment balanced?')
const loadGap = Math.abs(capped.load - uncapped.load) / Math.max(capped.load, uncapped.load, 1)
console.log(
  `    load medians ${capped.load.toFixed(1)} vs ${uncapped.load.toFixed(1)} — ${
    loadGap > 0.25
      ? 'NOT balanced: the arms did not see the same machine, so the ratios above mean nothing yet'
      : 'close enough to compare'
  }`,
)
const runGap = Math.abs(capped.runs - uncapped.runs)
console.log(
  `    run counts ${capped.runs} vs ${uncapped.runs} — ${
    runGap > Math.max(3, gates.length * 0.2)
      ? 'lopsided: the alternation is not holding, check the ab counter'
      : 'alternating as intended'
  }`,
)
if (gates.length < 20) {
  console.log(`\n  ${gates.length} runs is too few to conclude anything. Leave it running.`)
}
console.log('')
