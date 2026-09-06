#!/usr/bin/env node
// Tests for swift-boundaries edge 8 — ArgoUI ⊥ the dev-tool targets beside it (#1085).
//
// The direction is the whole point: the specimen harness and the sample transcripts depend on
// ArgoUI, and ArgoUI depends on neither. While all three compiled into one module nothing could
// see the edge at all, which is how 7,300 lines of dev-tool code came to sit inside the library
// that draws the product. An import is the only way to cross it, so an import is what this reads.
//
// The last two cases are the ones that matter most: an edge whose subject is not there checks
// nothing, and would report the tree it cannot see as clean (docs/agents/quality-gates.md).
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { FIXTURES, run, SHELL, SPECIMENS, tree } from './swift-boundaries.fixture.mjs'

check('edge 8 fails when a view imports the specimens', () => {
  const result = run(
    tree({ [`${SHELL}/CockpitView.swift`]: 'import ArgoSpecimens\nimport SwiftUI\n' }),
  )
  assert.equal(result.status, 1, `a view reached the harness: ${result.output}`)
  assert.match(result.output, /ArgoUI imports a dev-tool target/)
})

check('edge 8 fails when a view imports the fixtures', () => {
  const result = run(
    tree({ [`${SHELL}/CockpitView.swift`]: 'import ArgoFixtures\nimport SwiftUI\n' }),
  )
  assert.equal(result.status, 1, `a view reached a fixture: ${result.output}`)
  assert.match(result.output, /ArgoUI imports a dev-tool target/)
})

// The leaf's own direction. A fixture that draws would put the whole of ArgoUI underneath the
// sample data, which is the arrow this half exists to keep pointed the other way.
// Every spelling crosses the edge as far as the bare one, so a gate matching only `import X`
// would name the way around itself.
check('edge 8 fails on a testable import, and on one behind an access modifier', () => {
  for (const line of ['@testable import ArgoSpecimens', 'internal import ArgoFixtures']) {
    const result = run(tree({ [`${SHELL}/CockpitView.swift`]: `${line}\nimport SwiftUI\n` }))
    assert.equal(result.status, 1, `${line} passed: ${result.output}`)
    assert.match(result.output, /ArgoUI imports a dev-tool target/)
  }
})

check('edge 8 fails on an import of one declaration out of a dev-tool target', () => {
  const result = run(
    tree({ [`${SHELL}/CockpitView.swift`]: 'import enum ArgoFixtures.TranscriptFixtures\n' }),
  )
  assert.equal(result.status, 1, `a single-declaration import passed: ${result.output}`)
  assert.match(result.output, /ArgoUI imports a dev-tool target/)
})

check('edge 8 fails when a fixture imports a UI module', () => {
  const result = run(
    tree({
      [`${FIXTURES}/TranscriptFixtures.swift`]: 'import ArgoUI\n\nenum TranscriptFixtures {}\n',
    }),
  )
  assert.equal(result.status, 1, `a fixture reached a view: ${result.output}`)
  assert.match(result.output, /ArgoFixtures imports a UI module/)
})

check('edge 8 fails when a fixture imports SwiftUI', () => {
  const result = run(
    tree({
      [`${FIXTURES}/TranscriptFixtures.swift`]: 'import SwiftUI\n\nenum TranscriptFixtures {}\n',
    }),
  )
  assert.equal(result.status, 1, `a fixture drew: ${result.output}`)
  assert.match(result.output, /ArgoFixtures imports a UI module/)
})

// The other direction is the shipping one and must stay silent, or the gate would forbid the
// arrangement it exists to protect.
check('edge 8 accepts the specimens importing ArgoUI', () => {
  const result = run(
    tree({ [`${SPECIMENS}/SpecimenRegistry.swift`]: 'import ArgoFixtures\nimport ArgoUI\n' }),
  )
  assert.equal(result.status, 0, `the shipping direction was refused: ${result.output}`)
})

check('edge 8 fails when the specimens target is not there to check', () => {
  const result = run(tree({ [`${SPECIMENS}/SpecimenRegistry.swift`]: null }))
  assert.equal(result.status, 1, `a missing target passed: ${result.output}`)
  assert.match(result.output, /edge 8 cannot see its own subject/)
})

check('edge 8 fails when the fixtures target is not there to check', () => {
  const result = run(tree({ [`${FIXTURES}/TranscriptFixtures.swift`]: null }))
  assert.equal(result.status, 1, `a missing target passed: ${result.output}`)
  assert.match(result.output, /edge 8 cannot see its own subject/)
})

report('swift boundaries direction')
