#!/usr/bin/env node
// Tests for swift-boundaries edge 2 — the headless modules import no UI framework (ADR-0022).
//
// Two subjects, one implementation: `ArgoEngine` is the ADR's own, and `MermaidLayout` is there for
// the same argument (#1087). Its cases are here rather than beside edge 5's because a loop over
// two directories has a failure mode a single grep does not — a module that has moved is a scan
// over nothing, which reads exactly like a clean tree.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { check, report } from './check-harness.mjs'
import { ENGINE, MERMAID, MERMAID_VIEW, run, tree } from './swift-boundaries.fixture.mjs'

for (const [name, sources] of [
  ['ArgoEngine', ENGINE],
  ['MermaidLayout', MERMAID],
]) {
  for (const framework of ['SwiftUI', 'AppKit', 'ArgoUI']) {
    check(`edge 2 fails on ${name} importing ${framework}`, () => {
      const result = run(tree({ [`${sources}/Drawn.swift`]: `import ${framework}\n` }))
      assert.equal(result.status, 1, `a UI import passed: ${result.output}`)
      assert.match(result.output, new RegExp(`${name} imports a UI framework`))
    })
  }
}

// The layout half may not reach for the drawing half either: that import is how a `Path` arrives
// without any of the three framework names appearing.
check('edge 2 fails on MermaidLayout importing MermaidView', () => {
  const result = run(tree({ [`${MERMAID}/Drawn.swift`]: 'import MermaidView\n' }))
  assert.equal(result.status, 1, `the sibling import passed: ${result.output}`)
  assert.match(result.output, /MermaidLayout imports a UI framework/)
})

// The drawing half draws. It is not a subject, and an edge that reported it would be an edge
// nobody could satisfy.
check('edge 2 leaves MermaidView alone', () => {
  const result = run(tree({ [`${MERMAID_VIEW}/Drawn.swift`]: 'import SwiftUI\n' }))
  assert.equal(result.status, 0, `the drawing half was reported: ${result.output}`)
})

// A module that has moved is the failure this loop can hide: `grep -r` over a path that is not
// there matches nothing and exits clean, which is a gate that checks nothing and says so. Stated
// for the renderer alone, because removing the engine's sources takes edge 5's subject with them
// and the tree would then fail for a reason this case is not about.
check('edge 2 fails when MermaidLayout has moved', () => {
  const root = tree()
  rmSync(`${root}/${MERMAID}`, { recursive: true, force: true })
  const result = run(root)
  assert.equal(result.status, 1, `a missing module passed: ${result.output}`)
  assert.match(result.output, /edge 2 cannot see/)
})

report('swift boundaries: the headless modules')
