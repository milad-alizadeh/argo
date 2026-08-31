#!/usr/bin/env node
// Tests for swift-boundaries edge 6 — the parameter cap reaches initializers (#755).
//
// SwiftLint's own `function_parameter_count` visits function declarations only, so this edge is the
// only thing counting an `init`'s slots. It counts by paren depth rather than by pattern, and the
// cases below are the two ways that can go wrong: a default value carrying commas of its own, and
// the ratchet going unread — which would leave the edge passing everything and saying so.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { ENGINE, run, SHELL, swiftlint, tree } from './swift-boundaries.fixture.mjs'

const ACTIONS = `${SHELL}/CockpitActions.swift`
const CONFIG = 'apps/macOS/.swiftlint.yml'
const wideInit = (count) =>
  `struct CockpitActions {\n    init(\n${Array.from(
    { length: count },
    (_, i) => `        slot${i}: Int,\n`,
  ).join('')}    ) {}\n}\n`

check('edge 6 passes an init at the cap', () => {
  const result = run(tree({ [ACTIONS]: wideInit(4) }))
  assert.equal(result.status, 0, result.output)
})

check('edge 6 fails on the parameter past the cap', () => {
  const result = run(tree({ [ACTIONS]: wideInit(5) }))
  assert.equal(result.status, 1, `a fifth slot passed: ${result.output}`)
  assert.match(result.output, /over the 4-parameter cap/)
  assert.match(result.output, /init takes 5 parameters/)
})

// The cap in force is stated on every run. Until #992 the script named a ratchet of 18 above a
// stated cap of 4, and nothing said which was enforced — so "quality passed" read as "the cap
// held", and did not mean it.
check('edge 6 states the cap it is enforcing', () => {
  const result = run(tree({ [ACTIONS]: wideInit(4) }))
  assert.match(result.output, /initializer cap 4 parameters/)
  assert.match(result.output, /0 grandfathered by name/)
})

// The grandfather list, which is the ratchet: what predates the gate is named, one line each, and
// nothing else over the cap passes. A NUMBER wide enough for the widest of them covers every init
// anyone is likely to write next, which is the bug #992 is.
check('edge 6 passes an init the list names at its own width', () => {
  const config = swiftlint('CockpitActions.swift 9 — a fixture of nine slots')
  const result = run(tree({ [ACTIONS]: wideInit(9), [CONFIG]: config }))
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /1 grandfathered by name/)
})

// An entry covers the width it names: a file once named is not a file with no cap.
check('edge 6 fails an init wider than the entry naming its file', () => {
  const config = swiftlint('CockpitActions.swift 9 — a fixture of nine slots')
  const result = run(tree({ [ACTIONS]: wideInit(10), [CONFIG]: config }))
  assert.equal(result.status, 1, `a tenth slot passed on a 9-slot entry: ${result.output}`)
  assert.match(result.output, /init takes 10 parameters/)
})

// The list may only shrink: an entry for an init that was grouped is deleted, not left to authorise
// the next one written to that width — the placement gates fail on a stale entry too.
check('edge 6 fails a grandfathered entry that names nothing', () => {
  const config = swiftlint('Grouped.swift 9 — grouped in a ticket that forgot this line')
  const result = run(tree({ [ACTIONS]: wideInit(4), [CONFIG]: config }))
  assert.equal(result.status, 1, `a stale entry passed: ${result.output}`)
  assert.match(result.output, /not over the cap any more/)
  assert.match(result.output, /Grouped\.swift 9/)
})

// A second file of one name at one width would be covered by the same entry — reported, not
// resolved: an entry may only cover the init it was written for.
check('edge 6 fails when an entry cannot say which init it means', () => {
  const config = swiftlint('CockpitActions.swift 9 — a fixture of nine slots')
  const elsewhere = `${ENGINE}/CockpitActions.swift`
  const result = run(tree({ [ACTIONS]: wideInit(9), [elsewhere]: wideInit(9), [CONFIG]: config }))
  assert.equal(result.status, 1, `two files of one name shared an entry: ${result.output}`)
  assert.match(result.output, /cannot say which init it means/)
})

// A reason is what makes the list read as debt rather than as configuration, so the pattern
// requires one: an entry with nothing said about it grandfathers nothing.
check('edge 6 does not read a grandfathered entry with no reason', () => {
  const result = run(
    tree({ [ACTIONS]: wideInit(5), [CONFIG]: swiftlint('CockpitActions.swift 5') }),
  )
  assert.equal(result.status, 1, `a reasonless entry passed: ${result.output}`)
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
check('edge 6 fails when the rule it extends states no cap', () => {
  const result = run(tree({ [CONFIG]: 'file_length:\n  error: 175\n' }))
  assert.equal(result.status, 1, `a missing cap passed: ${result.output}`)
  assert.match(result.output, /cannot find its cap/)
})

report('swift boundaries: the initializer cap')
