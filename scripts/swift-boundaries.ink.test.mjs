#!/usr/bin/env node
// Tests for swift-boundaries edge 7c — the text ramp's kind/rung pairing is made once, in
// `TextRoles.ink(_:)`, and not again at every call site (#1250).
//
// The edge is a BUDGET rather than a ban, because a glyph, a stroke and a ghosting comparison
// all take a rung and none of them is a line of text. That shape has two ways of quietly
// stopping: a budget that drifts upward, and a budget left above a tree that has fallen below it
// — the second is the one that authorises the next call site written to the shape just removed.
// Both are checked here, along with the scope and the file the number lives in
// (docs/agents/quality-gates.md).
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { CONTRACT, INK_BUDGET, run, SHELL, tree } from './swift-boundaries.fixture.mjs'

/// One view naming `n` rungs by hand, which is `n` against the budget.
const rows = (n) => ({
  [`${SHELL}/InkRow.swift`]: `struct InkRow: View {\n${Array.from(
    { length: n },
    (_, i) => `    let ink${i} = argo.color.text.tertiary`,
  ).join('\n')}\n}\n`,
})

const budget = (n) => ({ [INK_BUDGET]: `# The tree as a case states it.\n${n}\n` })

check('edge 7c passes a tree that stands exactly at its budget', () => {
  const result = run(tree({ ...rows(3), ...budget(3) }))
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /swift-boundaries: ok/)
})

check('edge 7c fails when a call site names a rung over the budget', () => {
  const result = run(tree({ ...rows(4), ...budget(3) }))
  assert.equal(result.status, 1, `a rung over the budget passed: ${result.output}`)
  assert.match(result.output, /pairing is being made at call sites/)
  assert.match(result.output, /InkRow\.swift/)
})

// The half that keeps the ratchet turning: converting a call site and leaving the number behind
// is a licence for the next one, so the fall has to be recorded.
check('edge 7c fails when the tree has fallen below its budget', () => {
  const result = run(tree({ ...rows(2), ...budget(3) }))
  assert.equal(result.status, 1, `an unrecorded fall passed: ${result.output}`)
  assert.match(result.output, /Lower the number/)
})

// `ink(` IS the pairing. Counting it would mean every fix raised the number it was lowering.
check('edge 7c does not count a line that asks for its kind', () => {
  const asked = 'struct InkRow: View {\n    let ink = argo.color.text.ink(.metadata)\n}\n'
  const result = run(tree({ [`${SHELL}/InkRow.swift`]: asked, ...budget(0) }))
  assert.equal(
    result.status,
    0,
    `asking for a kind was counted against the budget: ${result.output}`,
  )
})

// The contract DECLARES the ramp: its own pairing is a switch over the four rungs and has to name
// every one of them.
check('edge 7c leaves the module that owns the ramp alone', () => {
  const pairing = 'func ink(_ k: ArgoLineKind) -> ArgoColor { k == .title ? primary : tertiary }\n'
  const result = run(tree({ [`${CONTRACT}/TextRoles.swift`]: pairing, ...budget(0) }))
  assert.equal(result.status, 0, `the contract may name its own rungs: ${result.output}`)
})

check('edge 7c fails when its budget file has gone', () => {
  const result = run(tree({ [INK_BUDGET]: null }))
  assert.equal(result.status, 1, `a missing budget passed: ${result.output}`)
  assert.match(result.output, /budget is not there/)
})

check('edge 7c fails when its budget is not a number', () => {
  const result = run(tree({ [INK_BUDGET]: '# no number here\n' }))
  assert.equal(result.status, 1, `a budget with no number passed: ${result.output}`)
  assert.match(result.output, /not a number/)
})

report('swift boundaries: the ink ratchet')
