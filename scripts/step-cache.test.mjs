#!/usr/bin/env node
// Tests for the per-step memory in `scripts/gate-cache.sh`, as `swift-test.sh` and `build.sh`
// use it (#1377).
//
// The pair it closes: an agent finishes a ticket and runs the suites itself, then `git push`
// fires the pre-push gate, which ran the same suites over the same bytes again. The second run
// is the one a person waits on, and it can learn nothing the first did not.
//
// Which makes this the most dangerous cache in the repo, because its whole purpose is to NOT
// run a test somebody asked for. Every case below is a way that must still happen: the tree
// moved, the tree is dirty, a filter was asked for, the report said failure, the toolchain
// changed, the caller stood in another directory, or the built app is no longer on disk.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { buildScenario, PACKAGES, scenario } from './step-cache.harness.mjs'

check('a suite that passed this tree is not run again', () => {
  const s = scenario()
  const first = s.run()
  assert.equal(first.status, 0, first.output)
  assert.equal(s.ran().length, PACKAGES.length, 'the first run must run every package')
  const second = s.run()
  assert.equal(second.status, 0, second.output)
  assert.equal(s.ran().length, PACKAGES.length, 'the second run must run none of them')
  assert.match(second.output, /passed this tree at .* — not run again/)
  s.cleanup()
})

check('a changed tree runs every suite again', () => {
  const s = scenario()
  s.run()
  const after = s.ran().length
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 2\n')
  s.run()
  assert.equal(s.ran().length, after + PACKAGES.length, 'a new tree must run all four')
  s.cleanup()
})

// The key is taken from the repository root whatever directory the caller stands in. This is
// the case that catches a pathspec read relative to `apps/macOS`, where `git status` matches
// nothing — and a status that matches nothing reports a tree as clean.
check('an uncommitted change is not cached, though the script runs from apps/macOS', () => {
  const s = scenario()
  s.write('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 99\n')
  s.run()
  const after = s.ran().length
  s.run()
  assert.equal(s.ran().length, after + PACKAGES.length, 'a dirty tree must be run every time')
  s.cleanup()
})

check('a filtered run neither reads nor records a verdict', () => {
  const s = scenario()
  s.run()
  const after = s.ran().length
  // Asked for by name, so it runs even though the tree has passed.
  const filtered = s.run(['ArgoUI', '--filter', 'MinimapTests'])
  assert.equal(filtered.status, 0, filtered.output)
  assert.equal(s.ran().length, after + 1, 'a filter must not be answered from the cache')
  s.cleanup()
})

check('a failing report records nothing', () => {
  const s = scenario()
  const failed = s.run([], {
    STUB_REPORT:
      '<testsuites><testsuite name="s" tests="9" failures="2" errors="0"></testsuite></testsuites>',
  })
  assert.notEqual(failed.status, 0, 'the stub reported failures')
  const after = s.ran().length
  s.run()
  assert.ok(s.ran().length > after, 'the retry must run, not read a verdict nothing earned')
  s.cleanup()
})

check('a new toolchain runs every suite again', () => {
  const s = scenario()
  s.run()
  const after = s.ran().length
  s.run([], { STUB_SWIFT_VERSION: '6.3.0' })
  assert.equal(s.ran().length, after + PACKAGES.length, 'a different compiler proves nothing yet')
  s.cleanup()
})

check('ARGO_GATE_CACHE=off runs every suite', () => {
  const s = scenario()
  s.run()
  const after = s.ran().length
  s.run([], { ARGO_GATE_CACHE: 'off' })
  assert.equal(s.ran().length, after + PACKAGES.length)
  s.cleanup()
})

// The debug and release runs are different verdicts about different code, so one must never
// answer for the other.
check('a release verdict does not answer for a debug one', () => {
  const s = scenario()
  s.run([], { ARGO_TEST_CONFIGURATION: 'release' })
  const after = s.ran().length
  s.run()
  assert.equal(s.ran().length, after + PACKAGES.length, 'debug must run on its own account')
  s.cleanup()
})

check('a tree already built is not built again', () => {
  const s = buildScenario()
  assert.equal(s.build().status, 0)
  assert.equal(s.builds(), 1)
  const second = s.build()
  assert.equal(second.status, 0, second.stdout + second.stderr)
  assert.equal(s.builds(), 1, 'the second build must read the verdict')
  assert.match(second.stdout, /up to date for this tree/)
  s.cleanup()
})

check('a verdict with no app on disk builds again', () => {
  const s = buildScenario()
  s.build()
  // What `worktree-gc --artifacts` does. The verdict survives; the product does not.
  rmSync(path.join(s.dir, 'apps/macOS/build'), { recursive: true, force: true })
  assert.equal(s.build().status, 0)
  assert.equal(s.builds(), 2, 'a verdict is not an app')
  s.cleanup()
})

// The step memory is the MACHINE's — one directory behind every worktree, which is what keying
// on content is for — and the product is one checkout's. So a verdict recorded by the lane that
// built this tree must not let a different lane skip its own build and keep an app compiled from
// the tree it happened to build last. `bun run build` printed "up to date" over a two-day-old
// binary, and the screenshot taken next was of that binary.
check('a verdict earned on another tree does not stand in for this app', () => {
  const s = buildScenario()
  s.build()
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 2\n')
  s.build()
  assert.equal(s.builds(), 2, 'a changed tree builds')
  // Back to the first tree, whose verdict is still in the machine's cache — but the app on disk
  // is the second tree's, as it would be in a worktree that never built the first. The content
  // is committed back rather than reset to, because a reset would take the untracked record of
  // what ran with it and the case would then prove nothing.
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 1\n')
  const third = s.build()
  assert.equal(third.status, 0, third.stdout + third.stderr)
  assert.equal(s.builds(), 3, "a verdict is not this worktree's app")
  s.cleanup()
})

// The same hole from the other side: a run that could not be keyed still REPLACES the product,
// so it must not leave the previous label on it.
check('an unkeyable build leaves no stamp for an older verdict to match', () => {
  const s = buildScenario()
  s.build()
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 2\n')
  s.build({ ARGO_GATE_CACHE: 'off' })
  assert.equal(s.builds(), 2)
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 1\n')
  assert.equal(s.build().status, 0)
  assert.equal(s.builds(), 3, "the app is the uncached build's, whatever the verdict says")
  s.cleanup()
})

check('a build that wrote no app fails, whatever xcodebuild exited', () => {
  const s = buildScenario()
  // An `xcodebuild` that exits 0 having written nothing. Believing it would record a verdict
  // that skips the next build too, so one bad run would become every run.
  writeFileSync(path.join(s.dir, 'bin/xcodebuild'), '#!/bin/sh\nexit 0\n')
  execFileSync('chmod', ['+x', path.join(s.dir, 'bin/xcodebuild')])
  const result = s.build()
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /wrote no /)
  s.cleanup()
})

report('step cache')
