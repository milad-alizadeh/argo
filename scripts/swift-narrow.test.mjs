#!/usr/bin/env node
// Tests for `swift-test.sh`'s narrow inner loop — `[Package…] [--filter PATTERN]` — run via
// `bun run test:hooks`. Its own file rather than a fourth section of `swift-tooling.test.mjs`,
// which is at the 150-line ceiling; all four Swift entrypoint suites share the one stub harness.
//
// Every case here is the same claim from a different side: a narrow run may fail, and it may
// pass, but it may never pass by having selected nothing. `swift test --filter` exits 0 on a
// pattern that matched no test (#1358), so without these the fast loop is the untrustworthy one.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { check, report } from './check-harness.mjs'
import { PACKAGES, REPORTING, run, scratch, suite, swiftWriting } from './swift-tooling.harness.mjs'

const TEST = 'apps/macOS/scripts/swift-test.sh'
const CLEAN = () => swiftWriting(suite('errors="0" tests="9" failures="0"'))

check('swift-test.sh runs one named package alone', () => {
  CLEAN()
  const result = run(TEST, { ...REPORTING, args: ['ArgoUI'] })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /ArgoUI clean/)
  for (const name of PACKAGES.filter((p) => p !== 'ArgoUI')) {
    assert.doesNotMatch(result.output, new RegExp(name))
  }
})

check('swift-test.sh passes a filter through, last', () => {
  CLEAN()
  const result = run(TEST, { ...REPORTING, args: ['ArgoUI', '--filter', 'MinimapReshapeTests'] })
  assert.equal(result.status, 0, result.output)
  // Last, so an unfiltered run's argv stays the one the configuration cases above assert on.
  assert.deepEqual(result.argv.slice(-2), ['--filter', 'MinimapReshapeTests'])
})

check('swift-test.sh fails a filter that matched nothing, though swift test exits 0', () => {
  swiftWriting(suite('errors="0" tests="0" failures="0"'))
  const result = run(TEST, { ...REPORTING, args: ['ArgoUI', '--filter', 'Minimap reshape'] })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /matched no test for --filter Minimap reshape/)
  // The reason it matched nothing, not just that it did: the display name is the mistake people
  // make, because it is the name the test output prints.
  assert.match(result.output, /matches type names/)
})

for (const [spelling, args] of [
  ['--filter ""', ['ArgoUI', '--filter', '']],
  ['--filter=', ['ArgoUI', '--filter=']],
]) {
  check(`swift-test.sh refuses ${spelling}, which would have run the whole package`, () => {
    // The one spelling that walked through the guard: an empty pattern left FILTER unset, so the
    // package check did not fire, no --filter reached `swift test`, and all 2440 tests ran and
    // reported clean under a command that had asked for a narrow run.
    CLEAN()
    const result = run(TEST, { ...REPORTING, args })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /an empty one is not a filter/)
    // And it refuses BEFORE reaching swift, rather than after running the package it did not mean.
    assert.deepEqual(result.argv, [])
  })
}

check('swift-test.sh refuses a filter with no package to run it in', () => {
  CLEAN()
  const result = run(TEST, { ...REPORTING, args: ['--filter', 'MinimapReshapeTests'] })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /--filter needs a package/)
})

check('swift-test.sh refuses a package it does not carry', () => {
  CLEAN()
  const result = run(TEST, { ...REPORTING, args: ['ArgoTerminal'] })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /is not one of/)
})

rmSync(scratch, { recursive: true, force: true })

report('swift narrow run')
