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
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCK = path.join(ROOT, 'scripts/build-lock.sh')

function workspace() {
  return mkdtempSync(path.join(tmpdir(), 'argo-build-lock-'))
}

// Run `body` inside a shell that has sourced the lock, with the lock root and slot count set.
// Returns the process's stdout.
// `timeout` matters for any case whose REGRESSION is a wait rather than a wrong answer.
// `build_lock_acquire` blocks until a slot frees, by design and for ever, so a test that
// asserts something does not block would hang the suite instead of failing it — and a suite
// that hangs is one somebody kills, not one somebody reads.
function withLock(dir, body, { slots = 1, env = {}, timeout } = {}) {
  const script = `
set -e
. "${LOCK}"
${body}
`
  return execFileSync('sh', ['-c', script], {
    encoding: 'utf8',
    ...(timeout ? { timeout } : {}),
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: String(slots),
      ...env,
    },
  })
}

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

// The gate has to actually take the lock, or every case above tests a device nothing calls.
check('swift-gate.sh takes a build slot', () => {
  const gate = readFileSync(path.join(ROOT, 'scripts/swift-gate.sh'), 'utf8')
  assert.match(gate, /\.\s+"\$GATE_DIR\/build-lock\.sh"/, 'swift-gate.sh must source build-lock.sh')
  assert.match(gate, /^build_lock_acquire$/m, 'swift-gate.sh must call build_lock_acquire')
  const acquireAt = gate.indexOf('build_lock_acquire')
  const buildAt = gate.indexOf('bun run build')
  assert.ok(acquireAt < buildAt, 'the slot must be held before the build starts, not after')
  assert.ok(existsSync(LOCK))
})

// The three entrypoints an agent actually runs. The cap existed from #1377 but was wired only
// to `swift-gate.sh` — the push path — so `bun run build`, `bun run test` and `bun run warm`
// each fanned out to every core uncapped. Measured on a twelve-core machine with six lanes:
// 65 concurrent `swift-frontend`, load average 137, and not one lock directory on the disk.
//
// Asserted structurally, the way the gate above is: the alternative is a test that runs a real
// Swift build, which costs minutes and needs a toolchain the Linux jobs do not have.
for (const [script, tool] of [
  ['apps/macOS/scripts/build.sh', 'xcodebuild'],
  ['apps/macOS/scripts/swift-test.sh', 'swift test'],
  ['scripts/warm-build.sh', 'swift build'],
]) {
  check(`${script} takes a build slot`, () => {
    const text = readFileSync(path.join(ROOT, script), 'utf8')
    assert.match(text, /build-lock\.sh"/, `${script} must source build-lock.sh`)
    const acquireAt = text.indexOf('build_lock_acquire')
    assert.ok(acquireAt !== -1, `${script} must call build_lock_acquire`)
    const toolAt = text.indexOf(tool, acquireAt)
    assert.ok(toolAt > acquireAt, `${script} must hold the slot before it runs ${tool}`)
  })
}

// The deadlock this guard exists to prevent, and the reason wiring the children was not a
// one-line change. `swift-gate.sh` holds a slot and then runs `bun run build` and `bun run
// test` as CHILD PROCESSES. Without inheritance each child takes a second slot, so with the
// default of two one gate occupies both — and two gates each holding one would then wait
// forever for the other's. One slot here is the two-gate case in miniature: the child must
// return immediately, not block.
check('a child of a slot holder does not take a second slot', () => {
  const dir = workspace()
  const out = withLock(
    dir,
    `
build_lock_acquire
sh -c '. "${LOCK}"; build_lock_acquire; echo child-ran'
echo parent-done
`,
    { slots: 1, timeout: 20_000 },
  )
  assert.match(out, /child-ran/, "the child must proceed inside its parent's slot")
  assert.match(out, /parent-done/, 'the parent must not have deadlocked behind its own child')
  rmSync(dir, { recursive: true, force: true })
})

// The marker is cleared with the slot. A script that releases and then acquires again is asking
// for a real second slot, and a stale inherited marker would hand it none — the lock would read
// as held by a process that let it go, and two lanes would build believing they were serialised.
check('releasing a slot clears the inherited marker', () => {
  const dir = workspace()
  const out = withLock(
    dir,
    `
build_lock_acquire
build_lock_release
echo "after-release:[\${ARGO_BUILD_LOCK_HELD_BY:-unset}]"
build_lock_acquire
echo "reacquired:[$BUILD_LOCK_HELD]"
`,
    { slots: 1 },
  )
  assert.match(out, /after-release:\[unset\]/, 'release must unset ARGO_BUILD_LOCK_HELD_BY')
  assert.match(
    out,
    /reacquired:\[.*slot-1\]/,
    'a released holder must be able to take a real slot again',
  )
  rmSync(dir, { recursive: true, force: true })
})

report('build-lock')
