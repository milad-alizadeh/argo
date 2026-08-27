#!/usr/bin/env node
// Tests for swift-boundaries edge 5 — the Hub → cockpit projection is total, and each fact handed
// straight through lands on the slot of its own name (ADR-0027, amended by #755).
//
// Edge 5 matches Swift by TEXT, which is the only way to see a computed `var` and the price of
// seeing it. Text matching fails silently: a declaration spelled a way the pattern misses reads
// as "nothing to report". Every case below is a way the projection can fall behind that must
// still be loud. Edge 6's own cases are in `swift-boundaries.cap.test.mjs`.
import assert from 'node:assert/strict'
import {
  check,
  ENGINE,
  HUB_MODE,
  HUB_SESSION,
  PROJECTED,
  PROJECTION,
  projected,
  projection,
  report,
  run,
  tree,
  withFact,
} from './swift-boundaries.fixture.mjs'

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

// Totality proves a fact was mentioned; only this proves it reached the slot it was named for. The
// swap below is the failure it exists for, and it leaves both facts accounted for.
check('edge 5 fails on two same-typed facts swapped between slots', () => {
  const swapped = PROJECTION.replace(
    'self.init(id: session.id, mode: session.mode)',
    'self.init(id: session.mode, mode: session.id)',
  )
  const result = run(tree(projection(swapped)))
  assert.equal(result.status, 1, `a swap passed: ${result.output}`)
  assert.match(result.output, /land on a slot of another name/)
  assert.match(result.output, /id <- mode/)
})

check('edge 5 accepts a rename the projection declares', () => {
  const renamed = PROJECTION.replace('mode: session.mode', 'rung: session.mode').replace(
    '/// not-projected:',
    '/// renamed: rung <- mode — a rung is what it is.\n    /// not-projected:',
  )
  const result = run(tree(projection(renamed)))
  assert.equal(result.status, 0, result.output)
})

check('edge 5 fails on a renamed entry for a rename no longer made', () => {
  const stale = PROJECTION.replace(
    '/// not-projected:',
    '/// renamed: rung <- mode — a rename that is not made.\n    /// not-projected:',
  )
  const result = run(tree(projection(stale)))
  assert.equal(result.status, 1, `a stale marker passed: ${result.output}`)
  assert.match(result.output, /no longer makes/)
})

// A derivation is not a pass-through: the name on an expression is the projection's to choose, so
// the check must let one through rather than demanding a marker for every one in the mapping.
check('edge 5 leaves a derived argument alone', () => {
  const derived = PROJECTION.replace('mode: session.mode', 'mode: Mode(session.mode)')
  const result = run(tree(projection(derived)))
  assert.equal(result.status, 0, result.output)
})

// A fact crosses two hands: named into the init, then unpacked out of a grouped value in its body.
// Guarding only the first leaves the second free to drop it on the wrong slot, silently.
check('edge 5 fails on a fact unpacked onto the wrong slot in the init body', () => {
  const swapped = PROJECTED.replace('self.mode = chain.mode', 'self.mode = chain.rung')
  const result = run(tree(projected(swapped)))
  assert.equal(result.status, 1, `an unpacking swap passed: ${result.output}`)
  assert.match(result.output, /land on a slot of another name/)
  assert.match(result.output, /mode <- rung/)
})

check('edge 5 accepts an unpacking rename the init declares', () => {
  const renamed = PROJECTED.replace(
    '        public init(',
    '        /// renamed: mode <- rung — a rung alone would not say whose.\n        public init(',
  ).replace('self.mode = chain.mode', 'self.mode = chain.rung')
  const result = run(tree(projected(renamed)))
  assert.equal(result.status, 0, result.output)
})

check('edge 5 fails when the value it projects onto has moved', () => {
  const result = run(tree(projected(null)))
  assert.equal(result.status, 1, `a missing subject passed: ${result.output}`)
  assert.match(result.output, /cannot see its own subjects/)
})

report('swift boundaries')
