#!/usr/bin/env node
// Tests for swift-boundaries edge 5 — the Hub → cockpit projection is total (ADR-0027).
//
// Edge 5 matches Swift by TEXT, which is the only way to see a computed `var` and the price of
// seeing it. Text matching fails silently: a declaration spelled a way the pattern misses reads
// as "nothing to report". Every case below is a way the projection can fall behind that must
// still be loud, run against a synthetic tree rather than the real one so the expected failures
// are failures of the gate and not of the app.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(REPO_ROOT, 'scripts/swift-boundaries.sh')
const ENGINE = 'apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Hub'
const SHELL = 'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell'

// `internalOnly` is the trap: keyword-less at struct indentation, and internal to the engine, so
// ArgoUI cannot see it and the gate must not demand it. `HubSession`'s own `resumeID` is this.
const HUB_SESSION = `public struct HubSession: Equatable {
    public let id: String
    public internal(set) var liveness: Int = 0
    private var hidden: Int = 0
    var internalOnly: Int { 0 }
}
`
const HUB_MODE = `public extension HubSession {
    var mode: Int { 0 }
}
`
const PROJECTION = `extension CockpitPresentation.Session {
    /// not-projected: liveness — an input to a fold whose result lands instead.
    init(observed session: HubSession) {
        self.init(id: session.id, mode: session.mode)
    }
}
`

// A fresh tree per case: the cases mutate it, and a leaked mutation would make the next one lie.
function tree(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-boundaries-'))
  const written = {
    [`${ENGINE}/HubSession.swift`]: HUB_SESSION,
    [`${ENGINE}/HubSession+Mode.swift`]: HUB_MODE,
    [`${SHELL}/CockpitPresentation+Hub.swift`]: PROJECTION,
    'apps/macOS/Argo/ArgoApp.swift': '@main struct ArgoApp {}\n',
    ...files,
  }
  for (const [relative, contents] of Object.entries(written)) {
    if (contents === null) continue
    const file = path.join(root, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, contents)
  }
  return root
}

// A declaration added just before a file's closing brace, which in both fixtures is the
// declaration's enclosing scope.
const withFact = (source, declaration) => source.replace(/^}/m, `${declaration}\n}`)
const hubFile = (declaration) => ({
  [`${ENGINE}/HubSession.swift`]: withFact(HUB_SESSION, declaration),
})
const modeFile = (declaration) => ({
  [`${ENGINE}/HubSession+Mode.swift`]: withFact(HUB_MODE, declaration),
})
// The same public extension, but living in HubSession.swift rather than a `HubSession+*.swift`.
const hubExtension = (declaration) => ({
  [`${ENGINE}/HubSession.swift`]: HUB_SESSION + withFact(HUB_MODE, declaration),
})
const projection = (contents) => ({ [`${SHELL}/CockpitPresentation+Hub.swift`]: contents })

function run(root) {
  const result = spawnSync('/bin/sh', [SCRIPT], { cwd: root, encoding: 'utf8' })
  rmSync(root, { recursive: true, force: true })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

check('a projection that accounts for every fact passes', () => {
  const result = run(tree())
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /swift-boundaries: ok/)
})

// Each of these is one way a fact can go unaccounted for. They fail for the same reason, so they
// assert the same message — what differs is the declaration shape the gate has to notice.
for (const [name, files] of [
  ['a new public stored fact', hubFile('    public internal(set) var fresh: Int = 0')],
  ['a keyword-less computed fact in an extension file', modeFile('    var fresh: Int { 0 }')],
  // The `public` is redundant inside a `public extension`, and Swift allows it either way.
  ['a computed fact spelling `public`', modeFile('    public var fresh: Int { 0 }')],
  // A `public extension HubSession` need not live in a `HubSession+*.swift` file.
  [
    'a public extension appended to HubSession.swift itself',
    hubExtension('    var fresh: Int { 0 }'),
  ],
]) {
  check(`edge 5 fails on ${name}`, () => {
    const result = run(tree(files))
    assert.equal(result.status, 1, `expected a failure, got: ${result.output}`)
    assert.match(result.output, /reach no cockpit surface/)
    assert.match(result.output, /\bfresh\b/)
  })
}

check('edge 5 fails when a landed fact is dropped from the mapping', () => {
  const result = run(tree(projection(PROJECTION.replace(', mode: session.mode', ''))))
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /reach no cockpit surface/)
  assert.match(result.output, /\bmode\b/)
})

// Prose may NAME a fact — the file is full of prose about facts. Only the mapping lands one.
check('edge 5 is not satisfied by a fact named only in a comment', () => {
  const mentioned = PROJECTION.replace(', mode: session.mode', '').replace(
    '    init(',
    '    /// The rung is session.mode, read elsewhere.\n    init(',
  )
  const result = run(tree(projection(mentioned)))
  assert.equal(result.status, 1, `a comment counted as a landing: ${result.output}`)
  assert.match(result.output, /\bmode\b/)
})

check('edge 5 fails on a not-projected entry naming a fact that is gone', () => {
  const stale = PROJECTION.replace('not-projected: liveness', 'not-projected: goneFact')
  const result = run(tree(projection(stale)))
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /no longer has/)
  assert.match(result.output, /goneFact/)
})

check('edge 5 fails on a fact that is both mapped and not-projected', () => {
  const both = PROJECTION.replace('not-projected: liveness', 'not-projected: mode')
  const result = run(tree(projection(both)))
  assert.equal(result.status, 1, `a contradiction passed: ${result.output}`)
  assert.match(result.output, /AND listed/)
})

// The two ways the gate can check nothing at all and report success for it.
check('edge 5 fails when HubSession.swift has moved', () => {
  const result = run(tree({ [`${ENGINE}/HubSession.swift`]: null }))
  assert.equal(result.status, 1, `a missing subject passed: ${result.output}`)
  assert.match(result.output, /cannot see its own subjects/)
})

check('edge 5 fails when it matches no declaration at all', () => {
  const reshaped = 'public struct HubSession: Equatable { public let id: String }\n'
  const result = run(
    tree({ [`${ENGINE}/HubSession.swift`]: reshaped, [`${ENGINE}/HubSession+Mode.swift`]: null }),
  )
  assert.equal(result.status, 1, `an empty fact list passed: ${result.output}`)
  assert.match(result.output, /read no public facts/)
})

if (failures) {
  console.error(`\n${failures} swift-boundaries test(s) failed`)
  process.exit(1)
}
console.log('  swift boundaries: all checks passed')
