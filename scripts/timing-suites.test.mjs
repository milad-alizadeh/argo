#!/usr/bin/env node
// The split between the parallel correctness suites and the serialised timing ones, run via
// `bun run test:hooks` (#1711).
//
// Written the way the cache suites are: what it proves is that the set is COMPLETE and
// SELECTABLE. Complete, because a timing test the derivation misses goes back into the
// parallel run and fails on a busy machine — which is the flake this ticket exists for.
// Selectable, because `swift test --filter` matches a suite's TYPE name and never the name in
// `@Suite("…")` (#1358), so a derived name that is not a type selects nothing at all.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = path.join(ROOT, 'apps/macOS/Packages')
const DERIVE = path.join(ROOT, 'apps/macOS/scripts/timing-suites.sh')

const derive = (pkg) =>
  execFileSync('/bin/sh', [DERIVE, path.join(PACKAGES, pkg)], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

// Where a package keeps its test sources, flattened: `ArgoEngine` has two test targets.
const testFiles = (pkg) => {
  const tests = path.join(PACKAGES, pkg, 'Tests')
  return readdirSync(tests, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((target) =>
      readdirSync(path.join(tests, target.name))
        .filter((file) => file.endsWith('.swift'))
        .map((file) => path.join(tests, target.name, file)),
    )
}

// The two tests #1703 lost three gate runs to. Named here rather than counted, because a
// derivation that grew or shrank is fine and a derivation that dropped one of these is not.
const REGRESSION = {
  ArgoUI: ['FeedRowShapeTests', 'FeedRowsCompareCostTests'],
}

check('the two suites that failed #1703 under load are in the timing set', () => {
  const derived = derive('ArgoUI')
  for (const suite of REGRESSION.ArgoUI) {
    assert.ok(derived.includes(suite), `${suite} is not in the timing set: ${derived.join(', ')}`)
  }
})

check('every derived name is a type `swift test --filter` can select', () => {
  for (const pkg of ['ArgoEngine', 'ArgoUI']) {
    for (const suite of derive(pkg)) {
      const file = testFiles(pkg).find((f) => path.basename(f, '.swift') === suite)
      assert.ok(file, `${pkg}: nothing declares ${suite}`)
      assert.match(
        readFileSync(file, 'utf8'),
        new RegExp(`struct ${suite}\\b`),
        `${pkg}/${suite} is not the name of a type in its own file`,
      )
    }
  }
})

check('a suite whose budgets are counts stays in the parallel run', () => {
  const derived = derive('ArgoUI')
  // It cites `cpuSeconds` in a doc comment to explain why it counts instead of timing, which is
  // exactly the mention a name-shaped derivation would have taken for a call.
  assert.ok(
    !derived.includes('MinimapCostTests'),
    'MinimapCostTests measures counts and must not be serialised',
  )
})

check('a clock helper is defined in one file per test target, so the set cannot split', () => {
  for (const pkg of ['ArgoEngine', 'ArgoUI']) {
    const defining = testFiles(pkg).filter((file) =>
      /func (leastCPUSeconds|pairedCPUSeconds|cpuSeconds|elapsedSeconds)\b/.test(
        readFileSync(file, 'utf8'),
      ),
    )
    assert.deepEqual(
      defining.map((f) => path.basename(f)),
      ['CostMeasure.swift'],
      `${pkg} defines a clock helper outside CostMeasure.swift`,
    )
  }
})

check('a package with no timing suite prints nothing and exits 0', () => {
  assert.deepEqual(derive('ArgoMermaid'), [])
  assert.deepEqual(derive('ArgoAtlas'), [])
})

check('a package with no Tests directory at all is not an error', () => {
  assert.deepEqual(derive('ArgoDesign'), [])
})

check('the derivation refuses to be called without a package', () => {
  assert.throws(() => execFileSync('/bin/sh', [DERIVE], { stdio: 'pipe' }))
})

report('timing suites')
