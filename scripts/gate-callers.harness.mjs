// The fixtures behind `gate-columns.test.mjs` and `gate-callers.test.mjs` (#1711): one row
// builder, and one way to run `metrics.sh` over a scratch file.
//
// Shared rather than copied because the row builder IS the column contract — a second copy of
// it would keep passing after the columns moved under it.
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRow } from './gate-stats.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const scratch = mkdtempSync(path.join(tmpdir(), 'argo-gate-callers-'))

// A row exactly as `metrics.sh` prints one, so a change to the column order breaks here.
export const row = ({
  when = '2026-09-08T01:00:00Z',
  event = 'gate',
  name = 'gate',
  outcome = 'run',
  seconds = 191,
  waited = 0,
  branch = 'argo/#1703-lane',
  load = '4.2',
  freeGb = '60',
  arm = '-',
  caller = 'implement',
  phase = 'gate',
} = {}) =>
  [when, event, name, outcome, seconds, waited, branch, load, freeGb, arm, caller, phase].join('\t')

export const gatesFrom = (lines) => lines.map(parseRow).filter((r) => r.event === 'gate')
export const rowsFrom = (lines) => lines.map(parseRow)
// `readMetrics` drops anything older than its window, so a case about the report needs today.
export const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')

// `metric_append` run for real, against a metrics file of the caller's own. Sourced rather than
// stubbed: what these cases are about is the row the shell writes.
export const appended = (file, env) =>
  execFileSync(
    '/bin/sh',
    ['-c', `. "${ROOT}/scripts/metrics.sh"; metric_append gate gate run 191 0`],
    { env: { ...process.env, ARGO_METRICS_FILE: file, ...env } },
  )
