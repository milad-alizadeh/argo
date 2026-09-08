import { readFileSync } from 'node:fs'

// Reading `scripts/metrics.sh`'s rows, and the three figures every reader of them wants.
//
// Shared with `gate-callers.mjs` rather than left in `gate-report.mjs`, so a second reader of
// the file cannot carry its own parse and go stale the next time a column is appended (#1711).

// The columns, in the order `metrics.sh` prints them. A row written before a column existed
// has fewer fields, so every one of them falls back rather than reading `undefined`: the file
// is a running record on a machine, not a schema anybody migrates.
export const parseRow = (line) => {
  const [when, event, name, outcome, seconds, waited, branch, load, freeGb, arm, caller, phase] =
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
    arm: arm ?? '-',
    caller: caller ?? 'unknown',
    phase: phase ?? 'unknown',
  }
}

// Every row in the file newer than `days`, or null when there is no file to read. Null rather
// than an empty list, because "no metrics yet" and "no rows this week" are different answers
// and the report says a different thing about each.
export const readMetrics = (file, days) => {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const since = new Date(Date.now() - days * 86_400_000)
  return text
    .split('\n')
    .filter(Boolean)
    .map(parseRow)
    .filter((row) => row.when >= since)
}

export const median = (values) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export const percentile = (values, p) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]
}

export const mmss = (s) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`
