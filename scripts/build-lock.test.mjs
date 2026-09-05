#!/usr/bin/env node
// Tests for `scripts/build-lock.sh` — the machine-wide cap on concurrent Swift builds (#1377).
//
// A lock is one of the few things whose failure is invisible from its own output: a broken one
// lets both callers through and every run still says it passed, just slower and, in a build,
// occasionally corrupt. So every case here observes the MUTUAL EXCLUSION itself, by having the
// locked section write a marker and checking that two holders never overlap.
//
// The three ways this lock could rot, each a case below:
//
//   - it stops excluding, and N lanes build at once again;
//   - it excludes too well, and a slot left behind by a killed gate blocks the machine forever;
//   - it fails CLOSED on a machine that cannot make the lock directory, turning a throughput
//     device into an outage.
//
// Which CALLERS take a slot is `build-lock-entrypoints.test.mjs`, and how one passes down a
// process tree is `build-lock-inheritance.test.mjs`. This file is the exclusion itself.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LOCK, withLock, workspace } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

// Two holders, one slot, each writing "in" and "out" around a sleep. If the lock works the
// markers nest as in/out/in/out; if it does not, they interleave as in/in/out/out.
check('one slot admits one holder at a time', () => {
  const dir = workspace()
  const log = path.join(dir, 'order')
  const holder = `
. "${LOCK}"
build_lock_acquire
echo "in $1" >> "${log}"
sleep 1
echo "out $1" >> "${log}"
`
  writeFileSync(path.join(dir, 'holder.sh'), holder)
  // Both start together; the second must wait for the first to leave its section.
  execFileSync('sh', ['-c', `sh "${dir}/holder.sh" a & sh "${dir}/holder.sh" b & wait`], {
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: '1',
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  assert.equal(lines.length, 4, `expected four markers, got ${JSON.stringify(lines)}`)
  assert.match(lines[0], /^in /)
  assert.match(lines[1], /^out /)
  assert.equal(
    lines[0].slice(3),
    lines[1].slice(4),
    `holder ${lines[0]} was interrupted by ${lines[1]}`,
  )
  rmSync(dir, { recursive: true, force: true })
})

// The cap is a count, not a mutex: two slots must admit two holders at once, or the machine
// idles cores between one lane's link and the next lane's parse.
check('two slots admit two holders at once', () => {
  const dir = workspace()
  const log = path.join(dir, 'order')
  const holder = `
. "${LOCK}"
build_lock_acquire
echo "in $1" >> "${log}"
sleep 1
echo "out $1" >> "${log}"
`
  writeFileSync(path.join(dir, 'holder.sh'), holder)
  execFileSync('sh', ['-c', `sh "${dir}/holder.sh" a & sh "${dir}/holder.sh" b & wait`], {
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: '2',
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  assert.equal(lines.length, 4)
  assert.match(lines[0], /^in /)
  assert.match(lines[1], /^in /, 'two slots must not serialise two holders')
  rmSync(dir, { recursive: true, force: true })
})

check('the slot is released when the holder exits', () => {
  const dir = workspace()
  withLock(dir, 'build_lock_acquire; echo held')
  // A second acquire in a fresh process would block forever if the first leaked its slot.
  const out = withLock(dir, 'build_lock_acquire; echo second')
  assert.match(out, /second/)
  rmSync(dir, { recursive: true, force: true })
})

// A gate killed with SIGKILL leaves its slot directory behind. Nothing else on the machine
// would ever clear it, so a lock that trusted the directory alone would wedge every future
// build on the machine — the failure that makes people delete the lock instead of fixing it.
check('a slot whose holder is gone is reclaimed', () => {
  const dir = workspace()
  const slot = path.join(dir, 'lock', 'slot-1')
  mkdirSync(slot, { recursive: true })
  // A pid that cannot be running: pid 0 is never a user process, and `kill -0 0` signals
  // the whole process group, so a pid from a long-dead process is used instead.
  const dead = execFileSync('sh', ['-c', 'sh -c "echo $$"'], { encoding: 'utf8' }).trim()
  writeFileSync(path.join(slot, 'pid'), `${dead}\n`)
  const out = withLock(dir, 'build_lock_acquire; echo reclaimed', { slots: 1 })
  assert.match(out, /reclaimed/)
  rmSync(dir, { recursive: true, force: true })
})

// The lock is a throughput device. If it cannot be created, the build must still run: a gate
// that refused to run because a lock directory was unwritable would be a gate switched off by
// a full disk, which is the very condition it exists to relieve.
check('an unusable lock root runs unserialised rather than failing', () => {
  const dir = workspace()
  // A regular file where the lock root should be: `mkdir -p` cannot succeed on it.
  const blocked = path.join(dir, 'not-a-dir')
  writeFileSync(blocked, 'x')
  const out = execFileSync('sh', ['-c', `. "${LOCK}"\nbuild_lock_acquire\necho ran`], {
    encoding: 'utf8',
    env: { ...process.env, ARGO_BUILD_LOCK_ROOT: blocked, ARGO_BUILD_LOCK_SLOTS: '1' },
  })
  assert.match(out, /ran/)
  rmSync(dir, { recursive: true, force: true })
})

report('build-lock')
