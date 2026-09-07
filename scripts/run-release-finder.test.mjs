#!/usr/bin/env node
// Tests that `run-release.sh` finds the copy of its own build it is replacing, run via
// `bun run test:hooks`.
//
// The bug this pins (#1568) is invisible to every other gate: the script asked `pgrep -x Argo`,
// which on the machine that reported it answers nothing while two Argos are running, so the
// previous copy was never ended, `open -n` added a second one, and neither half of the block
// printed anything. The fix is asking `ps` instead, and which copy the script reaches is only
// checkable by watching what it does to a process table. The tree it reads one in, and the stubs
// that record the run, are `run-release-finder.fixture.mjs`.
import assert from 'node:assert/strict'
import { check } from './check-harness.mjs'
import {
  asked,
  BINARY,
  isRunning,
  OTHER_BINARY,
  PRODUCT,
  report,
  run,
  settled,
  startArgo,
} from './run-release-finder.fixture.mjs'

const mine = startArgo()
const theirs = startArgo()
const replaced = run([
  ['live', mine, BINARY],
  ['live', theirs, OTHER_BINARY],
  // A process on its way out: `ps` reports `(Argo)` in the path column, which is not the name.
  ['always', '99999', '(Argo)'],
])

check('ends the previous run of this build', () => {
  assert.equal(replaced.status, 0, replaced.output)
  assert.match(
    replaced.output,
    new RegExp(`ending the previous run of this build \\(pid ${mine}\\)`),
  )
  assert.ok(settled(mine), 'the previous run of this build was left running')
})

check('never asks by name, which is what could not see it', () => {
  assert.deepEqual(asked(replaced.calls, 'pgrep'), [], 'the script still asks pgrep')
})

check('leaves an Argo it did not build alone', () => {
  assert.match(replaced.output, new RegExp(`another Argo is running from ${OTHER_BINARY} `))
  assert.ok(isRunning(theirs), 'the script ended an Argo that was not its own build')
})

check('says nothing about a process on its way out', () => {
  assert.doesNotMatch(replaced.output, /\(Argo\)/)
  assert.doesNotMatch(replaced.output, /pid 99999/)
})

check('opens the build it just made, as a new instance', () => {
  assert.deepEqual(asked(replaced.calls, 'open'), [`open -n ${PRODUCT}`])
})

const alone = run([['live', theirs, OTHER_BINARY]])

check('waits only on copies of this build', () => {
  assert.equal(alone.status, 0, alone.output)
  // Somebody else's Argo is never going to go, so the settle loop must not spin its ten rounds
  // waiting for it: one reading for the kill loop, one for the settle loop, and no more.
  assert.equal(asked(alone.calls, 'ps').length, 2, alone.calls.join(' | '))
})

check('a table with no Argo at all ends nothing and still opens', () => {
  const empty = run([['always', '4242', '/usr/bin/Argonaut']])
  assert.equal(empty.status, 0, empty.output)
  assert.doesNotMatch(empty.output, /ending the previous run|leaving it alone/)
  assert.deepEqual(asked(empty.calls, 'open'), [`open -n ${PRODUCT}`])
})

check('--probe opens with the frame probe on', () => {
  const probed = run([], ['--probe'])
  assert.equal(probed.status, 0, probed.output)
  assert.deepEqual(asked(probed.calls, 'open'), [`open --env ARGO_FRAME_PROBE=1 -n ${PRODUCT}`])
})

report('run-release finder')
