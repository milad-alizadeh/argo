#!/usr/bin/env node
// Tests for `scripts/land.sh` — the serialized landing lane (#1377).
//
// Everything this script does is hard to take back: it force-pushes a rebased branch and then
// merges it. So the cases below are mostly about what it must REFUSE to do — merge a branch it
// could not rebase, merge one that failed the gate on the new base, merge anything at all under
// --dry-run — and about the two properties that make it safe to run while eight lanes are
// working: it never leaves a half-finished rebase behind, and it never touches their trees.
//
// The repository, the stubs and the runner are in `land-scenario.harness.mjs`.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { landScenario } from './land-scenario.harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scenario = landScenario

check('it refuses to land anything without being told what', () => {
  const s = scenario()
  const result = s.run([])
  assert.equal(result.status, 2, result.output)
  assert.match(result.output, /name the PRs to land/)
  assert.doesNotMatch(s.gh(), /pr merge/)
  s.cleanup()
})

check('a clean rebase is gated and then merged', () => {
  const s = scenario()
  const result = s.run(['1'])
  assert.equal(result.status, 0, result.output)
  assert.equal(s.gated(), 1, 'the gate must run once, on the rebased tree')
  assert.match(s.gh(), /pr merge 1 --squash/, `no merge in: ${s.gh()}`)
  assert.match(result.output, /1 landed, 0 left/)
  s.cleanup()
})

check('the landing happens in its own worktree, not the checkout', () => {
  const s = scenario()
  const before = s.git(s.clone, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
  s.run(['1'])
  const after = s.git(s.clone, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
  assert.equal(after, before, 'the checkout must be left on the branch it was on')
  assert.ok(
    existsSync(path.join(s.clone, '.claude/worktrees/landing')),
    'the landing worktree must be where the work happened',
  )
  s.cleanup()
})

check('a conflicting branch is neither gated nor merged, and leaves no rebase behind', () => {
  const s = scenario({ conflicting: true })
  const result = s.run(['1'])
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /conflicts on main/)
  assert.equal(s.gated(), 0, 'a branch that would not rebase must not be gated')
  assert.doesNotMatch(s.gh(), /pr merge/)
  // An abandoned rebase in the landing tree would wedge every later run.
  const landing = path.join(s.clone, '.claude/worktrees/landing')
  assert.ok(!existsSync(path.join(landing, '.git/rebase-merge')), 'rebase left in progress')
  assert.match(result.output, /0 landed, 1 left/)
  s.cleanup()
})

check('a branch that fails the gate on the new base is not merged', () => {
  const s = scenario()
  const result = s.run(['1'], { STUB_GATE_STATUS: '1' })
  assert.equal(result.status, 0, result.output)
  assert.equal(s.gated(), 1, 'the gate must have been given its chance')
  assert.doesNotMatch(s.gh(), /pr merge/, 'a red gate must not merge')
  assert.match(result.output, /fails the gate/)
  s.cleanup()
})

check('--dry-run gates but merges nothing', () => {
  const s = scenario()
  const result = s.run(['1', '--dry-run'])
  assert.equal(result.status, 0, result.output)
  assert.equal(s.gated(), 1)
  assert.doesNotMatch(s.gh(), /pr merge/)
  assert.match(result.output, /would be pushed and merged/)
  s.cleanup()
})

// The bug this catches, found in review: land.sh took a one-slot lock and EXPORTED its root
// and count, so the gate it ran as a child inherited them, waited for slot-1, and found it
// held by a process `kill -0` reports as very much alive — its own parent. Every landing hung.
// It survived the first round of these tests because the stub gate did not take a lock at all.
check('the gate does not wait for the landing lock its own parent holds', () => {
  const s = scenario()
  const result = s.run(['1'])
  assert.equal(result.timedOut, false, result.output)
  assert.equal(result.status, 0, result.output)
  assert.equal(s.gated(), 1, 'the gate must have got through')
  // And it queued for a BUILD slot rather than for the landing one, which is what puts a
  // landing in the same queue as the lanes instead of beside it.
  for (const line of s.lockLines()) {
    assert.doesNotMatch(line, /land-lock/, `the gate inherited the landing lock: ${line}`)
  }
})

check('only one landing runs at a time', () => {
  // Asserted from the script rather than by racing two of them: the lock itself is proved in
  // build-lock.test.mjs, and what matters here is that the landing lane asks for ONE slot.
  const land = readFileSync(path.join(ROOT, 'scripts/land.sh'), 'utf8')
  assert.match(land, /ARGO_BUILD_LOCK_SLOTS=1/, 'the landing lane must take exactly one slot')
  assert.match(land, /build_lock_acquire/, 'the landing lane must take the lock at all')
  assert.match(
    land,
    /ARGO_BUILD_LOCK_ROOT=\$\{ARGO_LAND_LOCK_ROOT/,
    'landing must not compete for the build slots it is about to use',
  )
})

report('land')
