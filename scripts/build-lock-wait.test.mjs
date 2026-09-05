#!/usr/bin/env node
// How long `build_lock_acquire` will queue before it gives up (#1450). The exclusion itself is
// `build-lock.test.mjs`; which callers take a slot is `build-lock-entrypoints.test.mjs`; how one
// passes down a process tree is `build-lock-inheritance.test.mjs`.
//
// The limit exists because `bun run warm` is orphaned to pid 1 a second after it starts and
// nobody is waiting on it. Unbounded, those workers queue behind lanes that began hours later:
// thirty-three of them accumulated on one machine, the oldest three hours old, two naming a
// worktree that had already been deleted. The queue they formed was most of why a gate could sit
// 23 minutes waiting for a slot.
//
// Both halves matter, and the second more than the first: a limit that leaked into the GATE
// would turn contention into skipped checks, which is worse than the leak it fixes.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LOCK, workspace } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

// A holder that is alive and will never let go: this very process. `kill -0` finds it, so the
// slot is never reclaimed as stale and the waiter has nothing to win.
function wedged(dir) {
  const slot = path.join(dir, 'lock', 'slot-1')
  mkdirSync(slot, { recursive: true })
  writeFileSync(path.join(slot, 'pid'), `${process.pid}\n`)
  return {
    ...process.env,
    ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
    ARGO_BUILD_LOCK_SLOTS: '1',
  }
}

// The refusal is the point. `build_lock_acquire` returns non-zero rather than building anyway,
// so a caller that ignores the status still gets a serialised build rather than a free one.
check('a wait limit gives up rather than queueing for ever', () => {
  const dir = workspace()
  const out = execFileSync(
    'sh',
    ['-c', `. "${LOCK}"\nif build_lock_acquire; then echo took; else echo refused; fi`],
    {
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...wedged(dir), ARGO_BUILD_LOCK_WAIT_LIMIT: '5' },
    },
  )
  assert.match(out, /refused/, 'the acquire must report the refusal, not swallow it')
  assert.doesNotMatch(out, /took/, 'it must not report a slot it never got')
  rmSync(dir, { recursive: true, force: true })
})

// And the DEFAULT is forever. A gate that started skipping its own checks under contention would
// be worse than the leak this limit exists to stop, so it has to be opted into.
check('the default wait is unbounded', () => {
  assert.match(
    readFileSync(LOCK, 'utf8'),
    /ARGO_BUILD_LOCK_WAIT_LIMIT:-0/,
    'the wait limit must default to 0, which means forever',
  )
  const dir = workspace()
  // With no limit this must STILL be waiting when the timeout fires. A timeout is how a case
  // whose regression is "it returned too early" reports a failure rather than hanging the suite.
  assert.throws(
    () =>
      execFileSync('sh', ['-c', `. "${LOCK}"\nbuild_lock_acquire\necho took`], {
        encoding: 'utf8',
        timeout: 12_000,
        env: wedged(dir),
      }),
    /ETIMEDOUT|timed out/i,
    'with no limit the acquire must still be waiting, not have given up',
  )
  rmSync(dir, { recursive: true, force: true })
})

// The warm is the one caller that opts in, and it has to HANDLE the refusal rather than build
// on regardless — a warm that ignored it would take no slot and compile anyway, which is the
// uncapped build the whole cap exists to prevent.
check('warm-build.sh sets a limit and handles the refusal', () => {
  const warm = readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), 'warm-build.sh'),
    'utf8',
  ).replace(/^\s*#.*$/gm, '')
  assert.match(warm, /ARGO_BUILD_LOCK_WAIT_LIMIT=/, 'warm-build.sh must set a wait limit')
  assert.match(
    warm,
    /if ! build_lock_acquire; then/,
    'warm-build.sh must branch on the refusal, not call the acquire bare',
  )
  rmSync(workspace(), { recursive: true, force: true })
})

report('build-lock-wait')
