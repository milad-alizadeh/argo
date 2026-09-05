#!/usr/bin/env node
// How ONE slot passes down a process tree, and the ways that hand-off can go wrong. Which
// callers take a slot at all is `build-lock-entrypoints.test.mjs`; the exclusion itself is
// `build-lock.test.mjs`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { LOCK, withLock, workspace } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

// The deadlock this exists to prevent, and the reason wiring the children was not a one-line
// change. `swift-gate.sh` holds a slot and then runs `bun run build` and `bun run test` as CHILD
// PROCESSES. Without inheritance each child takes a second slot, so with the default of two one
// gate occupies both — and two gates each holding one would then wait forever for the other's.
// One slot here is the two-gate case in miniature: the child must return immediately, not block.
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

// `trap … EXIT` inside a function REPLACES the script-level one, so a lock that installed its
// cleanup plainly silently threw away the caller's. `swift-test.sh` removes its xunit report
// directory that way, set long before it asks for a slot — so every uncached `bun run test`
// leaked a temp directory, on exactly the path this cap was added to cover and on no other.
//
// Run under BOTH shells wherever dash is installed. `sh` is bash on macOS and dash on Linux, and
// they disagree about `trap` inside a command substitution, so this case passed locally and
// failed on CI for exactly one commit (#1431). macOS ships `/bin/dash`, so the disagreement is
// reachable from a developer's machine and does not need a Linux job to find.
for (const shell of ['sh', ...(existsSync('/bin/dash') ? ['/bin/dash'] : [])]) {
  check(`acquiring a slot keeps the caller's own EXIT trap (${shell})`, () => {
    const dir = workspace()
    const marker = path.join(dir, 'caller-cleanup-ran')
    const out = withLock(
      dir,
      `
trap 'echo ran > "${marker}"' EXIT
build_lock_acquire
echo acquired
`,
      { slots: 1, shell },
    )
    assert.match(out, /acquired/)
    assert.ok(existsSync(marker), "the caller's EXIT trap must still run after build_lock_acquire")
    // And the lock's own cleanup still happened, so chaining did not cost the release.
    assert.ok(!existsSync(path.join(dir, 'lock', 'slot-1')), 'the slot must still be released')
    rmSync(dir, { recursive: true, force: true })
  })
}

// A descendant keeps the exported marker for ever — `build_lock_release` can only unset it in
// its own shell. Trusting it on presence alone would let a process that outlived its acquirer
// build uncapped permanently, with nothing able to notice.
check('an inherited marker whose acquirer is gone is not trusted', () => {
  const dir = workspace()
  const dead = execFileSync('sh', ['-c', 'sh -c "echo $$"'], { encoding: 'utf8' }).trim()
  const out = withLock(dir, 'build_lock_acquire; echo "held:[$BUILD_LOCK_HELD]"', {
    slots: 1,
    env: { ARGO_BUILD_LOCK_HELD_BY: `${path.join(dir, 'lock')} ${dead}` },
    timeout: 20_000,
  })
  assert.match(
    out,
    /held:\[.*slot-1\]/,
    'a dead acquirer must not exempt this process from the cap',
  )
  rmSync(dir, { recursive: true, force: true })
})

// There is more than one pool, which is why the marker names its ROOT as well as its pid.
// `land.sh` holds a slot in a landing root of its own — one slot, one landing at a time — and
// then runs the gate, which has to queue for a MACHINE build slot like any lane. Honoured on
// presence alone, that live marker would exempt the gate outright and every landing would run
// `quality:swift`, a full `xcodebuild` and four `swift test` builds entirely outside the cap.
check('a live marker from another lock root does not exempt the holder', () => {
  const dir = workspace()
  const out = withLock(dir, 'build_lock_acquire; echo "held:[$BUILD_LOCK_HELD]"', {
    slots: 1,
    // Alive, and holding a slot — in a pool this caller is not queueing on.
    env: { ARGO_BUILD_LOCK_HELD_BY: `${path.join(dir, 'landing')} ${process.pid}` },
    timeout: 20_000,
  })
  assert.match(out, /held:\[.*slot-1\]/, "another pool's slot must not exempt this one")
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

// An inherited slot was not waited for, and the caller reports that figure in its metrics row.
// Left at the previous acquire's number it would bill one wait once per package that inherited
// the slot, and read as a cap four times as expensive as it is.
check('an inherited slot reports no wait', () => {
  const dir = workspace()
  const out = withLock(
    dir,
    `
build_lock_acquire
BUILD_LOCK_WAITED=42
build_lock_acquire
echo "waited:[$BUILD_LOCK_WAITED]"
`,
    { slots: 1 },
  )
  assert.match(out, /waited:\[0\]/, 'an acquire that waited for nothing must report 0')
  rmSync(dir, { recursive: true, force: true })
})

report('build-lock-inheritance')
