#!/usr/bin/env node
// The two phases `swift-test.sh` runs each package in (#1711), run via `bun run test:hooks`.
// Its own file rather than a fifth section of `swift-tooling.test.mjs`, which is at the
// 150-line ceiling; all five Swift entrypoint suites share the one stub harness.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { check, report } from './check-harness.mjs'
import { REPORTING, run, scratch, suite, swiftWriting } from './swift-tooling.harness.mjs'

const TEST = 'apps/macOS/scripts/swift-test.sh'
const CACHE_ENV = { ARGO_SWIFT_CACHE_DIR: '/tmp/argo-swift-cache-under-test' }

// The whole point of the second phase (#1711). A budget measured in seconds reads the machine,
// and the parallel run is the loudest thing on it: two of these failed the #1703 lane three
// times and passed alone in 6.8s. `--no-parallel` is what makes the second run isolated rather
// than merely narrower, so it is asserted by name — dropped, the phase would still pass.
check('swift-test.sh runs the timing suites alone, and serialised', () => {
  swiftWriting(suite('errors="0" tests="9" failures="0"'))
  const result = run(TEST, { ...REPORTING, env: CACHE_ENV })
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /ArgoUI cost clean, 0 failures across 9 reported tests/)

  // Asserted against the argv the SCRIPT built, not against the harness's own idea of it: the
  // pattern is derived in both places, and comparing the two would pass with neither reaching
  // `swift test`. `--no-parallel` sits ahead of `--filter` in the run that carries a timing
  // suite, and in no other.
  const serialised = result.argv.flatMap((arg, at) =>
    arg === '--no-parallel' ? [result.argv.slice(at, at + 3)] : [],
  )
  assert.equal(serialised.length, 2, `one cost phase per package with timing suites: ${serialised}`)
  for (const [flag, filter, pattern] of serialised) {
    assert.deepEqual([flag, filter], ['--no-parallel', '--filter'])
    assert.doesNotMatch(pattern, /^--/, 'the pattern, not the next flag')
  }
  assert.match(
    serialised.map(([, , pattern]) => pattern).join(' '),
    /FeedRowsCompareCostTests/,
    'no timing suite reached a --filter',
  )
  // And the correctness phase is that same set REMOVED, not a second full run of it.
  const skipped = result.argv.flatMap((arg, at) => (arg === '--skip' ? [result.argv[at + 1]] : []))
  assert.deepEqual(
    skipped,
    serialised.map(([, , pattern]) => pattern),
  )
})

rmSync(scratch, { recursive: true, force: true })

report('swift phases')
