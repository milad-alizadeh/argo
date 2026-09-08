#!/usr/bin/env node
// The two columns `metrics.sh` gained, run via `bun run test:hooks` (#1711).
//
// Every case here is the same claim from a different side: a row states a caller and a phase
// only when something set one. A file that recorded a word nobody used would put a number under
// a step that never ran, which is worse than the `unknown` these exist to keep honest.
import assert from 'node:assert/strict'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { appended, scratch } from './gate-callers.harness.mjs'
import { parseRow, readMetrics } from './gate-stats.mjs'

check('metrics.sh writes the caller and the phase it was given', () => {
  const file = path.join(scratch, 'written.tsv')
  appended(file, { ARGO_GATE_CALLER: 'ship', ARGO_GATE_PHASE: 'gate' })

  const [written] = readMetrics(file, 1)
  assert.equal(written.caller, 'ship')
  assert.equal(written.phase, 'gate')
})

check('a phase of its own is written, not the caller-wide one', () => {
  const file = path.join(scratch, 'phased.tsv')
  appended(file, { ARGO_GATE_CALLER: 'implement', ARGO_GATE_PHASE: 'cost' })

  const [written] = readMetrics(file, 1)
  assert.equal(written.phase, 'cost')
})

// A typo, and the one spelling that would have walked through: the membership test is a
// substring of a space-joined list, so two real words side by side match it whole.
for (const [why, caller] of [
  ['a typo', 'implememt'],
  ['two callers at once', 'ship push'],
  ['a leading space', ' ship'],
  ['nothing at all', ''],
]) {
  check(`${why} is recorded as unknown, never as itself`, () => {
    const file = path.join(scratch, `stranger-${caller.trim().replace(/\s/g, '-') || 'unset'}.tsv`)
    appended(file, { ARGO_GATE_CALLER: caller })

    const [written] = readMetrics(file, 1)
    assert.equal(written.caller, 'unknown')
    assert.equal(written.phase, 'unknown', 'an unset phase is unknown too')
  })
}

check('a phase nothing recognises is unknown too', () => {
  const file = path.join(scratch, 'strange-phase.tsv')
  appended(file, { ARGO_GATE_CALLER: 'ship', ARGO_GATE_PHASE: 'correctnes' })

  const [written] = readMetrics(file, 1)
  assert.equal(written.caller, 'ship', 'a bad phase does not cost the row its caller')
  assert.equal(written.phase, 'unknown')
})

// The file is a running record on a machine, not a schema anybody migrates, so the rows written
// before these columns existed have to keep reading.
check('a row written before the columns existed reads unknown rather than undefined', () => {
  const old = parseRow(
    ['2026-09-01T01:00:00Z', 'gate', 'gate', 'run', '191', '0', 'argo/old', '4.2', '60'].join('\t'),
  )
  assert.equal(old.caller, 'unknown')
  assert.equal(old.phase, 'unknown')
  assert.equal(old.arm, '-')
})

check('no metrics file at all is told apart from a file with no recent rows', () => {
  assert.equal(readMetrics(path.join(scratch, 'absent.tsv'), 7), null)
})

report('gate columns')
