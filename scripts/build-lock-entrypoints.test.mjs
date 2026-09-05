#!/usr/bin/env node
// WHICH callers of `build-lock.sh` take a slot. The exclusion itself is `build-lock.test.mjs`;
// how a slot passes down a process tree is `build-lock-inheritance.test.mjs`.
//
// The cap existed from #1377 but was wired to one caller: `swift-gate.sh`, the push path. The
// commands a lane spends its day on — `bun run build`, `bun run test`, `bun run warm`, and the
// renders `/pixel-review` needs — never sourced it. Measured on a twelve-core machine with six
// lanes in flight: load average 137, 65 concurrent `swift-frontend`, and not one lock directory
// anywhere on the disk, which is what says no caller had ever taken a slot rather than that the
// cap was set too loose.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { LOCK, ROOT } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

// Asserted over the SOURCE, a deliberate exception to house.md's "assert what happened, never
// that a function was called". The behaviour each of these would have to show is a real
// `xcodebuild` or `swift build` queueing behind a held slot: minutes per case, and a toolchain
// the Linux jobs do not have. What is checked instead is the one thing a wiring mistake breaks —
// that the call is there, on its own line, ahead of the build — and the exclusion it buys is
// proved behaviourally in the other two suites.
for (const [script, tool] of [
  ['scripts/swift-gate.sh', 'bun run build'],
  ['apps/macOS/scripts/build.sh', 'xcodebuild'],
  ['apps/macOS/scripts/swift-test.sh', 'swift test'],
  ['scripts/warm-build.sh', 'swift build'],
  ['apps/macOS/scripts/specimens.sh', 'xcodebuild'],
  ['apps/macOS/scripts/screenshot.sh', 'xcodebuild'],
  ['apps/macOS/scripts/record-figures.sh', 'swift build'],
  ['apps/macOS/scripts/e2e-test.sh', 'xcodebuild'],
]) {
  check(`${script} takes a build slot`, () => {
    // COMMENTS STRIPPED FIRST. Searching the raw text found the prose explaining the call rather
    // than the call, so deleting the call outright left this green — a check that read its own
    // documentation and reported the mechanism present.
    const code = readFileSync(path.join(ROOT, script), 'utf8').replace(/^\s*#.*$/gm, '')
    assert.match(code, /build-lock\.sh"/, `${script} must source build-lock.sh`)
    const call = /^[ \t]*build_lock_acquire[ \t]*$/m
    assert.match(code, call, `${script} must CALL build_lock_acquire, not merely mention it`)
    const acquireAt = code.search(call)
    const toolAt = code.indexOf(tool, acquireAt)
    assert.ok(toolAt > acquireAt, `${script} must hold the slot before it runs ${tool}`)
  })
}

check('the lock the entrypoints source exists', () => {
  assert.ok(existsSync(LOCK), `${LOCK} is what every case above names`)
})

report('build-lock-entrypoints')
