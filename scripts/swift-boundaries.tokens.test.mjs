#!/usr/bin/env node
// Tests for swift-boundaries edge 7 — a design constant is declared only in ArgoDesign (#1088).
//
// The edge exists because the contract became a MODULE. Everything below is a way the check can
// stop being one: a literal that reads as contract because of where it sits, a scope that moved
// out from under the scan, and an allowlist entry that goes on excusing something already fixed.
// The last two are the shapes that pass a broken tree silently, which is the failure this repo
// keeps finding (docs/agents/quality-gates.md).
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { ALLOW, ATOMS, CONTRACT, run, SHELL, tree } from './swift-boundaries.fixture.mjs'

const view = (body) => ({ [`${SHELL}/BadgeRow.swift`]: `struct BadgeRow: View {\n${body}\n}\n` })

check('edge 7 passes a tree that spends the contract rather than restating it', () => {
  const result = run(tree(view('    var body: some View { Text("hi") }')))
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /swift-boundaries: ok/)
})

// One case per constructor family the contract owns. A view may NAME any of these values; what it
// may not do is write one down.
for (const [name, line] of [
  ['a colour built from components', '    let ink = Color(red: 1, green: 0, blue: 0)'],
  ['a colour built in AppKit', '    let ink = NSColor(white: 0.2, alpha: 1)'],
  ['a colour written as a hex literal', '    let ink = ArgoColor(hex: 0x3E9BFF)'],
  ['a type size handed to the system font', '    let face = Font.system(size: 11)'],
  ['a rhythm step written as a number', '    var body: some View { stack.padding(12) }'],
  ['a stroke width written as a number', '    let edge = Rectangle().stroke(lineWidth: 1)'],
]) {
  check(`edge 7 fails on ${name} in a view`, () => {
    const result = run(tree(view(line)))
    assert.equal(result.status, 1, `expected a failure, got: ${result.output}`)
    assert.match(result.output, /declared outside ArgoDesign/)
    assert.match(result.output, /BadgeRow\.swift/)
  })
}

check('edge 7 leaves the module that owns the contract alone', () => {
  const declared = 'public let accent = Color(red: 0.24, green: 0.61, blue: 1)\n'
  const result = run(tree({ [`${CONTRACT}/GraphitePalette.swift`]: declared }))
  assert.equal(result.status, 0, `the contract may declare its own values: ${result.output}`)
})

// The atoms are handed the contract, not a second copy of it — they sit below every view and
// above nothing, so a literal here would be the hardest one to find.
check('edge 7 reaches the atoms', () => {
  const result = run(
    tree({ [`${ATOMS}/ArgoChip.swift`]: 'let ink = Color(red: 1, green: 0, blue: 0)\n' }),
  )
  assert.equal(result.status, 1, `an atom declared a colour: ${result.output}`)
  assert.match(result.output, /ArgoChip\.swift/)
})

check('edge 7 fails when its scope has moved', () => {
  const result = run(tree({ [`${CONTRACT}/ArgoColor.swift`]: null }))
  assert.equal(result.status, 1, `a missing scope passed: ${result.output}`)
  assert.match(result.output, /not there/)
})

// The allowlist, which is debt and not an exemption: it may only shrink, and an entry that
// silences a finding must not silence the tree.
const allowed = (contents, files) => tree({ [ALLOW]: contents, ...files })

check('edge 7 accepts a finding the allowlist names with a reason', () => {
  const result = run(
    allowed(
      '# #1088 — the fixture swatch, snapped when its render is re-taken.\nBadgeRow\\.swift:[0-9]+:.*Color\\(red:\n',
      view('    let ink = Color(red: 1, green: 0, blue: 0)'),
    ),
  )
  assert.equal(result.status, 0, result.output)
})

// The regression this suite exists for: while the patterns reached grep as its own stdin, every
// finding was filtered out and the tree reported clean the moment the list held one line.
check('an allowlisted finding does not silence the ones beside it', () => {
  const result = run(
    allowed(
      '# #1088 — the fixture swatch, snapped when its render is re-taken.\nBadgeRow\\.swift:[0-9]+:.*Color\\(red:\n',
      {
        ...view('    let ink = Color(red: 1, green: 0, blue: 0)'),
        [`${SHELL}/PlanPill.swift`]: 'let face = Font.system(size: 11)\n',
      },
    ),
  )
  assert.equal(result.status, 1, `one allowed entry cleared the tree: ${result.output}`)
  assert.match(result.output, /PlanPill\.swift/)
})

check('edge 7 fails on an allowlist entry that says nothing about itself', () => {
  const result = run(
    allowed(
      'BadgeRow\\.swift:[0-9]+:.*Color\\(red:\n',
      view('    let ink = Color(red: 1, green: 0, blue: 0)'),
    ),
  )
  assert.equal(result.status, 1, `an unreasoned entry was honoured: ${result.output}`)
  assert.match(result.output, /say nothing about themselves/)
})

check('edge 7 fails on an allowlist entry that matches nothing any more', () => {
  const result = run(
    allowed(
      '# #1088 — a swatch that has since been snapped.\nGoneFixture\\.swift:[0-9]+:.*Color\\(red:\n',
    ),
  )
  assert.equal(result.status, 1, `a stale entry passed: ${result.output}`)
  assert.match(result.output, /match nothing any more/)
  assert.match(result.output, /GoneFixture/)
})

report('swift boundaries: the token contract')
