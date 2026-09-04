#!/usr/bin/env node
// Tests for `scripts/swift-scope.sh` — which packages a change can reach (#1377).
//
// A scope gate is the most dangerous kind of speed-up in this repo, because its failure is
// green: narrow the scope wrongly and the suites that would have caught the breach are the
// ones that do not run. So the cases below are weighted towards the answer ALL. Every way the
// script cannot see the whole picture has a case, and each asserts that it widens rather than
// guesses.
//
// The graph cases run against a FIXTURE packages directory, not the repo's own five packages:
// the thing under test is that the script reads `.package(path:)` edges rather than carrying a
// copy of them, and a fixture is the only way to tell those two apart.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = path.join(ROOT, 'scripts/swift-scope.sh')

// Run the script over `changed`, against `packagesDir`, and return its lines.
function scopeOf(changed, packagesDir = 'apps/macOS/Packages') {
  const out = execFileSync('sh', [SCOPE, packagesDir], {
    cwd: ROOT,
    encoding: 'utf8',
    input: changed.join('\n'),
  })
  return out.trim().split('\n').filter(Boolean)
}

// A throwaway packages directory: `graph` maps a package to the local packages it depends on.
function fixture(graph) {
  const dir = mkdtempSync(path.join(tmpdir(), 'swift-scope-'))
  for (const [name, deps] of Object.entries(graph)) {
    mkdirSync(path.join(dir, name), { recursive: true })
    const lines = deps.map((d) => `        .package(path: "../${d}"),`).join('\n')
    writeFileSync(
      path.join(dir, name, 'Package.swift'),
      `let package = Package(\n    name: "${name}",\n    dependencies: [\n${lines}\n    ]\n)\n`,
    )
  }
  return dir
}

check('a change in one package reaches that package', () => {
  const dir = fixture({ Alpha: [], Beta: [] })
  assert.deepEqual(scopeOf([`${dir}/Alpha/Sources/A.swift`], dir), ['Alpha'])
  rmSync(dir, { recursive: true, force: true })
})

check('a change reaches every package that depends on it, transitively', () => {
  // Alpha <- Beta <- Gamma, and a Delta that depends on nothing.
  const dir = fixture({ Alpha: [], Beta: ['Alpha'], Gamma: ['Beta'], Delta: [] })
  assert.deepEqual(scopeOf([`${dir}/Alpha/Sources/A.swift`], dir), ['Alpha', 'Beta', 'Gamma'])
  rmSync(dir, { recursive: true, force: true })
})

check('a change reaches nothing that merely depends on a sibling', () => {
  const dir = fixture({ Alpha: [], Beta: ['Alpha'], Gamma: ['Alpha'] })
  assert.deepEqual(scopeOf([`${dir}/Beta/Sources/B.swift`], dir), ['Beta'])
  rmSync(dir, { recursive: true, force: true })
})

check('two changed packages give the union of what each reaches', () => {
  const dir = fixture({ Alpha: [], Beta: ['Alpha'], Gamma: [], Delta: ['Gamma'] })
  assert.deepEqual(scopeOf([`${dir}/Alpha/S.swift`, `${dir}/Gamma/S.swift`], dir), [
    'Alpha',
    'Beta',
    'Delta',
    'Gamma',
  ])
  rmSync(dir, { recursive: true, force: true })
})

// The widening cases. Each is a way the script cannot see the whole picture, and each must
// answer ALL rather than narrow.
check('a change outside the packages is ALL', () => {
  const dir = fixture({ Alpha: [] })
  assert.deepEqual(scopeOf(['apps/macOS/Argo/AppDelegate.swift'], dir), ['ALL'])
  rmSync(dir, { recursive: true, force: true })
})

check('a change to a gate script is ALL', () => {
  assert.deepEqual(scopeOf(['scripts/swift-lint.sh']), ['ALL'])
})

check('a file sitting directly in the packages directory is ALL', () => {
  const dir = fixture({ Alpha: [] })
  assert.deepEqual(scopeOf(['README.md'], dir), ['ALL'])
  rmSync(dir, { recursive: true, force: true })
})

check('no changed paths at all is ALL, not nothing', () => {
  assert.deepEqual(scopeOf([]), ['ALL'])
})

check('one path outside the packages widens a list that is otherwise narrow', () => {
  const dir = fixture({ Alpha: [], Beta: [] })
  assert.deepEqual(scopeOf(['Alpha/S.swift', 'package.json'], dir), ['ALL'])
  rmSync(dir, { recursive: true, force: true })
})

// The repo's own graph, to catch a scope that is right about fixtures and wrong about here.
check("this repo's own ArgoEngine change reaches ArgoUI", () => {
  const reached = scopeOf(['apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/A.swift'])
  assert.ok(reached.includes('ArgoEngine'), `expected ArgoEngine in ${reached}`)
  assert.ok(reached.includes('ArgoUI'), `ArgoUI depends on ArgoEngine, got ${reached}`)
})

check("this repo's own ArgoDesign change reaches every package", () => {
  // Every package depends on ArgoDesign directly or through one hop, so this is the case
  // where a scope gate must buy nothing at all.
  const reached = scopeOf(['apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign/Token.swift'])
  for (const pkg of ['ArgoAtlas', 'ArgoDesign', 'ArgoEngine', 'ArgoMermaid', 'ArgoUI']) {
    assert.ok(reached.includes(pkg), `expected ${pkg} in ${reached}`)
  }
})

// The wiring. Without these the scope is a script nothing consults.
check('swift-gate.sh consults the scope and exports it', () => {
  const gate = readFileSync(path.join(ROOT, 'scripts/swift-gate.sh'), 'utf8')
  assert.match(gate, /swift-scope\.sh/, 'the gate must call swift-scope.sh')
  assert.match(gate, /export ARGO_TEST_SCOPE/, 'the gate must export the scope it computed')
  // ARGO_TEST_PACKAGES is swift-tool-guard.sh's constant list of packages that HAVE tests.
  // Writing the scope into that name would be overwritten by the guard, silently running
  // everything — a speed-up that quietly does not apply is worse than none.
  assert.doesNotMatch(
    gate,
    /^\s*export ARGO_TEST_PACKAGES/m,
    "the scope must not be written into swift-tool-guard.sh's constant",
  )
})

check('swift-test.sh honours the scope, and a named package still wins', () => {
  const tests = readFileSync(path.join(ROOT, 'apps/macOS/scripts/swift-test.sh'), 'utf8')
  assert.match(tests, /ARGO_TEST_SCOPE/, 'swift-test.sh must read the scope')
  // The scope is consulted only when no package was named on the command line.
  assert.match(
    tests,
    /if \[ -z "\$PACKAGES" \] && \[ -n "\$\{ARGO_TEST_SCOPE:-\}" \]/,
    'the scope must be a default, not an override',
  )
})

report('swift-scope')
