#!/usr/bin/env node
// Tests for swift-boundaries edge 6 — the parameter cap reaches initializers (#755).
//
// SwiftLint's own `function_parameter_count` visits function declarations only, so this edge is the
// only thing counting an `init`'s slots. It counts by paren depth rather than by pattern, and the
// cases below are the two ways that can go wrong: a default value carrying commas of its own, and
// the ratchet going unread — which would leave the edge passing everything and saying so.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { run, SHELL, tree } from './swift-boundaries.fixture.mjs'

const ACTIONS = `${SHELL}/CockpitActions.swift`
const wideInit = (count) =>
  `struct CockpitActions {\n    init(\n${Array.from(
    { length: count },
    (_, i) => `        slot${i}: Int,\n`,
  ).join('')}    ) {}\n}\n`

check('edge 6 passes an init at the ratchet', () => {
  const result = run(tree({ [ACTIONS]: wideInit(4) }))
  assert.equal(result.status, 0, result.output)
})

check('edge 6 fails on the parameter past the ratchet', () => {
  const result = run(tree({ [ACTIONS]: wideInit(5) }))
  assert.equal(result.status, 1, `a fifth slot passed: ${result.output}`)
  assert.match(result.output, /over the 4-parameter ratchet/)
  assert.match(result.output, /init takes 5 parameters/)
})

// A default value may hold commas and parens of its own, and counting those would fire on an init
// that is within the cap — the shape `CockpitActions` is made of.
check('edge 6 does not count commas inside a default value', () => {
  const withDefaults = `struct CockpitActions {
    init(
        run: @escaping (String, Int) -> Void = { _, _ in },
        skills: @escaping () -> [String] = { ["a", "b"] },
        drive: (Int, Int) = (1, 2),
        note: String = "a, b, c",
    ) {}
}
`
  const result = run(tree({ [ACTIONS]: withDefaults }))
  assert.equal(result.status, 0, result.output)
})

// A `//` inside a string ends no comment. Stripping one anyway truncates the line, the parens never
// balance again, and every remaining init in the file goes uncounted — a gate passing everything
// and saying so (docs/agents/quality-gates.md). `://` appears in ~19 Swift files here.
check('edge 6 does not read a URL in a string as a comment', () => {
  const trap = `struct CockpitActions {
    init(
        url: String = "https://x, y",
        a: Int, b: Int, c: Int, d: Int, e: Int,
    ) {}
}

struct AfterTheTrap {
    init(
        f: Int, g: Int, h: Int, i: Int, j: Int, k: Int,
    ) {}
}
`
  const result = run(tree({ [ACTIONS]: trap }))
  assert.equal(result.status, 1, `a string swallowed the count: ${result.output}`)
  assert.match(result.output, /init takes 6 parameters/)
  // The second one is the real damage: an unbalanced line skips the REST of the file.
  assert.match(result.output, /CockpitActions\.swift:9/)
})

// A multi-line string holds prose, and prose may hold anything — including a line that reads as a
// declaration. Its contents are not code and must not be counted as any.
check('edge 6 does not count an init written inside a multi-line string', () => {
  const prose = `struct CockpitActions {
    static let help = """
    init(
        a: Int, b: Int, c: Int, d: Int, e: Int,
    )
    """
    init(a: Int) {}
}
`
  const result = run(tree({ [ACTIONS]: prose }))
  assert.equal(result.status, 0, result.output)
})

// A CALL is not a declaration, and the widest lists in this repo are calls. Counting one would fail
// the build on a line that declares nothing.
check('edge 6 counts declarations and not calls', () => {
  const call = `struct Caller {
    static let usage = "init(a: 1, b: 2, c: 3, d: 4, e: 5, f: 6)"

    func make() -> CockpitActions {
        self.init(a: 1, b: 2, c: 3, d: 4, e: 5, f: 6)
    }
}
`
  const result = run(tree({ [ACTIONS]: call }))
  assert.equal(result.status, 0, result.output)
})

// The gate's own fail-open: no number, no check, and nothing else in the repo would notice.
check('edge 6 fails when its ratchet is not recorded', () => {
  const result = run(
    tree({ 'apps/macOS/.swiftlint.yml': 'function_parameter_count:\n  error: 4\n' }),
  )
  assert.equal(result.status, 1, `a missing cap passed: ${result.output}`)
  assert.match(result.output, /cannot find its cap/)
})

report('swift boundaries: the initializer cap')
