#!/usr/bin/env node
// Tests for swift-boundaries edge 5b — a fact handed straight through lands on the slot of its OWN
// name (ADR-0027, amended by #755). Edge 5's totality cases are in `swift-boundaries.test.mjs` and
// edge 6's in `swift-boundaries.cap.test.mjs`.
//
// Totality proves a fact was MENTIONED; only these prove it reached the field it was named for. A
// swap leaves both facts accounted for, so no case here can be caught by the totality half.
//
// A fact crosses three hands — named into the mapping, unpacked out of a grouped value in the
// projected init's body, and unpacked again inside a group that groups its own parameters — and
// every hand needs its own case, because each lives in a different file.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import {
  PROJECTED,
  PROJECTION,
  projected,
  projection,
  run,
  tree,
  VALUES,
  values,
} from './swift-boundaries.fixture.mjs'

// The first hand, and the failure the whole check exists for.
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

// The second hand. Guarding only the first leaves this one free to drop a fact on the wrong slot.
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

// The third hand: a group that groups its OWN parameters unpacks them one file further out, so a
// swap made there arrives in both files above already made (#1051).
check('edge 5 fails on a fact unpacked onto the wrong slot inside a grouped value', () => {
  const swapped = VALUES.replace('self.mode = program.mode', 'self.mode = program.rung')
  const result = run(tree(values(swapped)))
  assert.equal(result.status, 1, `a swap in a grouped value passed: ${result.output}`)
  assert.match(result.output, /land on a slot of another name/)
  assert.match(result.output, /mode <- rung/)
})

check('edge 5 accepts a rename a grouped value declares', () => {
  const renamed = VALUES.replace(
    '        public init(',
    '        /// renamed: mode <- rung — a rung alone would not say whose.\n        public init(',
  ).replace('self.mode = program.mode', 'self.mode = program.rung')
  const result = run(tree(values(renamed)))
  assert.equal(result.status, 0, result.output)
})

check('edge 5 fails when the grouped values have moved', () => {
  const result = run(tree(values(null)))
  assert.equal(result.status, 1, `a missing subject passed: ${result.output}`)
  assert.match(result.output, /cannot see its own subjects/)
})

report('swift boundaries: the slot check')
