#!/usr/bin/env node
// Which callers of `build-lock.sh` actually take a slot, and how one slot passes down a process
// tree. The exclusion itself is `build-lock.test.mjs`; this is the wiring around it, split off
// when the pair went past the line ceiling (#998's precedent).
//
// The cap existed from #1377 but was wired to one caller: `swift-gate.sh`, the push path. The
// commands a lane spends its day on — `bun run build`, `bun run test`, `bun run warm` — never
// sourced it. Measured on a twelve-core machine with six lanes in flight: load average 137, 65
// concurrent `swift-frontend`, and not one lock directory anywhere on the disk, which is what
// says no caller had ever taken a slot rather than that the cap was too loose.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { LOCK, ROOT, withLock, workspace } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

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
    // COMMENTS STRIPPED FIRST. Searching the raw text for `build_lock_acquire` found the prose
    // explaining the call rather than the call, so deleting the call outright left this green —
    // a check that read its own documentation and reported the mechanism present.
    const code = readFileSync(path.join(ROOT, script), 'utf8').replace(/^\s*#.*$/gm, '')
    assert.match(code, /build-lock\.sh"/, `${script} must source build-lock.sh`)
    const call = /^[ \t]*build_lock_acquire[ \t]*$/m
    assert.match(code, call, `${script} must CALL build_lock_acquire, not merely mention it`)
    const acquireAt = code.search(call)
    const toolAt = code.indexOf(tool, acquireAt)
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

// `trap … EXIT` inside a function REPLACES the script-level one, so a lock that installed its
// cleanup plainly silently threw away the caller's. `swift-test.sh` removes its xunit report
// directory that way, set long before it asks for a slot — so every uncached `bun run test`
// leaked a temp directory, on exactly the path this cap was added to cover and on no other.
check("acquiring a slot keeps the caller's own EXIT trap", () => {
  const dir = workspace()
  const marker = path.join(dir, 'caller-cleanup-ran')
  const out = withLock(
    dir,
    `
trap 'echo ran > "${marker}"' EXIT
build_lock_acquire
echo acquired
`,
    { slots: 1 },
  )
  assert.match(out, /acquired/)
  assert.ok(existsSync(marker), "the caller's EXIT trap must still run after build_lock_acquire")
  // And the lock's own cleanup still happened, so chaining did not cost the release.
  assert.ok(!existsSync(path.join(dir, 'lock', 'slot-1')), 'the slot must still be released')
  rmSync(dir, { recursive: true, force: true })
})

// A descendant keeps the exported marker for ever — `build_lock_release` can only unset it in
// its own shell. Trusting it on presence alone would let a process that outlived its acquirer
// build uncapped permanently, with nothing able to notice.
check('an inherited marker whose acquirer is gone is not trusted', () => {
  const dir = workspace()
  const dead = execFileSync('sh', ['-c', 'sh -c "echo $$"'], { encoding: 'utf8' }).trim()
  const out = withLock(dir, 'build_lock_acquire; echo "held:[$BUILD_LOCK_HELD]"', {
    slots: 1,
    env: { ARGO_BUILD_LOCK_HELD_BY: dead },
    timeout: 20_000,
  })
  assert.match(
    out,
    /held:\[.*slot-1\]/,
    'a dead acquirer must not exempt this process from the cap',
  )
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

report('build-lock-entrypoints')
