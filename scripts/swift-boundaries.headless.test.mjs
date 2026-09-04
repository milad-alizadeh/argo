#!/usr/bin/env node
// Tests for swift-boundaries edge 2 — the headless modules import no UI framework (ADR-0022).
//
// Three subjects, one implementation: `ArgoEngine` is the ADR's own, and `MermaidLayout` (#1087)
// and `AtlasLayout` (#1143) are there for the same argument. Their cases are here rather than
// beside edge 5's because a loop over several directories has a failure mode a single grep does
// not — a module that has moved is a scan over nothing, which reads exactly like a clean tree.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { check, report } from './check-harness.mjs'
import {
  ATLAS,
  ATLAS_VIEW,
  ENGINE,
  MERMAID,
  MERMAID_VIEW,
  run,
  tree,
} from './swift-boundaries.fixture.mjs'

// The two renderers, each as (headless half, drawing half). One list for all three cases below,
// so a package added to the gate cannot reach one of them and miss the others.
const RENDERERS = [
  ['MermaidLayout', MERMAID, 'MermaidView', MERMAID_VIEW],
  ['AtlasLayout', ATLAS, 'AtlasView', ATLAS_VIEW],
]

for (const [name, sources] of [['ArgoEngine', ENGINE], ...RENDERERS.map(([n, s]) => [n, s])]) {
  for (const framework of ['SwiftUI', 'AppKit', 'ArgoUI']) {
    check(`edge 2 fails on ${name} importing ${framework}`, () => {
      const result = run(tree({ [`${sources}/Drawn.swift`]: `import ${framework}\n` }))
      assert.equal(result.status, 1, `a UI import passed: ${result.output}`)
      assert.match(result.output, new RegExp(`${name} imports a UI framework`))
    })
  }
}

// A layout half may not reach for its own drawing half either: that import is how a `Path`
// arrives without any of the three framework names appearing.
for (const [name, sources, sibling] of RENDERERS) {
  check(`edge 2 fails on ${name} importing ${sibling}`, () => {
    const result = run(tree({ [`${sources}/Drawn.swift`]: `import ${sibling}\n` }))
    assert.equal(result.status, 1, `the sibling import passed: ${result.output}`)
    assert.match(result.output, new RegExp(`${name} imports a UI framework`))
  })
}

// The drawing halves draw. Neither is a subject, and an edge that reported one would be an edge
// nobody could satisfy.
for (const [, , name, sources] of RENDERERS) {
  check(`edge 2 leaves ${name} alone`, () => {
    const result = run(tree({ [`${sources}/Drawn.swift`]: 'import SwiftUI\n' }))
    assert.equal(result.status, 0, `the drawing half was reported: ${result.output}`)
  })
}

// A module that has moved is the failure this loop can hide: `grep -r` over a path that is not
// there matches nothing and exits clean, which is a gate that checks nothing and says so. Stated
// for the two renderers alone, because removing the engine's sources takes edge 5's subject with
// them and the tree would then fail for a reason these cases are not about.
for (const [name, sources] of RENDERERS) {
  check(`edge 2 fails when ${name} has moved`, () => {
    const root = tree()
    rmSync(`${root}/${sources}`, { recursive: true, force: true })
    const result = run(root)
    assert.equal(result.status, 1, `a missing module passed: ${result.output}`)
    assert.match(result.output, /edge 2 cannot see/)
  })
}

report('swift boundaries: the headless modules')
