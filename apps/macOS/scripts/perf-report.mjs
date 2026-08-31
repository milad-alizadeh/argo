#!/usr/bin/env node
// Joins one probe summary with one driver log and prints the figures a budget is read off.
//
//   node perf-report.mjs <frames.json> <drive.log>
//
// The join is the clock: the probe stamps every frame with `Date().timeIntervalSince1970` and the
// driver prints `at=` on the same one, so a click and the frames after it are directly comparable
// without a second instrument.
import { readFileSync } from 'node:fs'

const [framesPath, drivePath] = process.argv.slice(2)
const summary = JSON.parse(readFileSync(framesPath, 'utf8'))
const stamps = summary.timestamps
const budget = summary.frameBudgetMS

/// Settled = the first frame after the click from which the cadence stays inside 1.5x the budget
/// for a whole `CALM_MS`. A shorter run would call a gap between two hitches "settled"; a longer
/// one would charge a switch for the next interaction's work.
const CALM_MS = 100
const CALM_FACTOR = 1.5

function settledAfter(clickAt) {
  const first = stamps.findIndex((t) => t > clickAt)
  if (first < 0) return null
  for (let i = first; i < stamps.length; i++) {
    let j = i
    let calm = true
    while (j + 1 < stamps.length && (stamps[j] - stamps[i]) * 1000 < CALM_MS) {
      if ((stamps[j + 1] - stamps[j]) * 1000 > budget * CALM_FACTOR) {
        calm = false
        break
      }
      j++
    }
    if (calm && (stamps[j] - stamps[i]) * 1000 >= CALM_MS) {
      return (stamps[i] - clickAt) * 1000
    }
  }
  return null
}

const lines = readFileSync(drivePath, 'utf8').split('\n')
// An unsettled line keeps the column in step with the clicks: the nth settle belongs to the nth
// click, and a switch that never held still must not silently take the next one's number.
const settles = lines
  .filter((line) => /event=(settled|unsettled)/.test(line))
  .map((line) =>
    line.includes('event=unsettled') ? NaN : Number(/ after_ms=(-?[0-9]+)/.exec(line)?.[1]),
  )

const clicks = lines
  .filter((line) => line.startsWith('perf-drive event=click'))
  .map((line, index) => ({
    at: Number(/ at=([0-9.]+)/.exec(line)?.[1]),
    target: /target="([^"]*)"/.exec(line)?.[1] ?? '?',
    // The driver's own answer to "when did the surface stop changing", in the order it clicked.
    surface: settles[index],
  }))

/// One scroll profile's own frames. A whole-run figure is dominated by whatever the mount cost,
/// which is a different question from how a fast scroll behaves.
const phases = []
for (const line of lines) {
  const at = Number(/ at=([0-9.]+)/.exec(line)?.[1])
  const profile = /profile=(\S+)/.exec(line)?.[1]
  if (line.includes('event=scroll-begin')) phases.push({ profile, from: at, to: at })
  if (line.includes('event=scroll-end') && phases.length > 0) phases.at(-1).to = at
}

function statistics(from, to) {
  const window = stamps.filter((stamp) => stamp >= from && stamp <= to)
  const intervals = window.slice(1).map((stamp, index) => (stamp - window[index]) * 1000)
  const sorted = [...intervals].sort((a, b) => a - b)
  const at = (fraction) =>
    sorted[Math.min(Math.ceil(fraction * sorted.length) - 1, sorted.length - 1)] ?? 0
  return {
    fps: intervals.length / (to - from),
    p50: at(0.5),
    p99: at(0.99),
    max: sorted.at(-1) ?? 0,
    dropped: intervals.filter((interval) => interval > budget * 2).length,
  }
}

const ms = (value) =>
  value === null || value === undefined || Number.isNaN(value) ? '  —' : `${value.toFixed(1)} ms`
const over = (multiple) => summary.overruns.find((entry) => entry.multiple === multiple)

console.log(`display ceiling      ${summary.displayMaxFPS} fps (${budget.toFixed(2)} ms budget)`)
console.log(`frames               ${summary.frameCount} over ${summary.wallSeconds.toFixed(1)} s`)
console.log(`effective fps        ${summary.effectiveFPS.toFixed(1)}`)
console.log(
  `interval ms          p50 ${summary.p50MS.toFixed(2)}  p95 ${summary.p95MS.toFixed(2)}  ` +
    `p99 ${summary.p99MS.toFixed(2)}  max ${summary.maxMS.toFixed(1)}`,
)
for (const multiple of [1, 2, 4]) {
  const bucket = over(multiple)
  console.log(
    `over ${multiple}x budget       ${String(bucket.count).padStart(5)} frames, ` +
      `${bucket.totalMS.toFixed(0)} ms total`,
  )
}
if (phases.length > 0) {
  console.log('\nper scroll profile      fps    p50      p99      max    frames >2x')
  for (const phase of phases) {
    const figures = statistics(phase.from, phase.to)
    console.log(
      `  ${phase.profile.padEnd(20)} ${figures.fps.toFixed(1).padStart(4)}  ` +
        `${figures.p50.toFixed(2).padStart(6)}  ${figures.p99.toFixed(1).padStart(7)}  ` +
        `${figures.max.toFixed(1).padStart(7)}  ${String(figures.dropped).padStart(6)}`,
    )
  }
}

if (clicks.length > 0) {
  console.log('\nclick-to-settled        cadence     surface   target')
  console.log(
    '  (cadence = when frame intervals return to idle; surface = when the AX tree stops changing)',
  )
  for (const click of clicks) {
    console.log(
      `  ${ms(settledAfter(click.at)).padStart(12)}  ${ms(click.surface).padStart(10)}   ` +
        `${click.target.slice(0, 56)}`,
    )
  }
}
