#!/usr/bin/env node
// Tests for how edge 6 READS a struct body, the sibling of `swift-boundaries.memberwise.test.mjs`.
//
// That file asks what Swift puts in the memberwise list. This one asks whether the scanner can find
// the list at all, because the answer used to depend on where the author put a newline — and a
// shape the gate cannot see is a gate that exits 0 because nothing looked. Every case here is one
// somebody could write today, and most were written by this tree already.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { ACTIONS, run, tree, wideStruct } from './swift-boundaries.fixture.mjs'

// Prose may hold anything, a struct declaration included. Its contents are not code.
check('edge 6 does not count a value type written inside a multi-line string', () => {
  const prose = `struct CockpitActions {
    static let help = """
    struct Picked {
        let slot0: Int
        let slot1: Int
        let slot2: Int
        let slot3: Int
        let slot4: Int
    }
    """
    let only: Int
}
`
  const result = run(tree({ [ACTIONS]: prose }))
  assert.equal(result.status, 0, result.output)
})

// A nested type declared on ONE line used to be read as the enclosing struct's own members, which
// is house style here (`GitHubIssue`'s wire types) and so was the cheapest way to pass this gate:
// its `init` suppressed the outer list, its `private` field sealed it, and its stored properties
// inflated the outer count. Segments rather than lines is what fixes all three.
const ONE_LINERS = [
  'struct Inner { init() {} }',
  'struct Inner { private var hidden = 0 }',
  'struct Inner: Decodable { let login: String }',
]

for (const inner of ONE_LINERS) {
  check(`edge 6 is not thrown off by \`${inner}\``, () => {
    const result = run(tree({ [ACTIONS]: wideStruct(5, `    ${inner}\n`) }))
    assert.equal(result.status, 1, `a one-line nested type hid the width: ${result.output}`)
    assert.match(result.output, /Picked's synthesized memberwise init takes 5 parameters/)
  })
}

// And the enclosing struct is counted at ITS width, not its width plus the nested types' fields.
check("edge 6 does not count a nested type's fields against the type around it", () => {
  const source = `struct Picked {
    let slot0: Int
    let slot1: Int
    struct A: Decodable { let a: String }
    struct B: Decodable { let b: String }
    struct C: Decodable { let c: String }
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// A whole struct on one line declares the same list as the same struct on seven.
check('edge 6 counts a value type written on one line', () => {
  const source = 'struct Picked { let a: Int; let b: Int; let c: Int; let d: Int; let e: Int }\n'
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a one-line struct passed: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// One declaration may bind several properties, and each is its own parameter.
check('edge 6 counts every property one declaration binds', () => {
  const source = `struct Picked {
    let slot0: Int, slot1: Int
    let slot2: Int, slot3: Int
    let slot4: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a second binding went uncounted: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// The commas inside a type are the type talking about itself, not further bindings. Counting them
// would fail the build on a struct within the cap.
check('edge 6 does not read a comma inside a type as a second binding', () => {
  const source = `struct Picked {
    let pair: (Int, Int)
    let map: Dictionary<String, Int>
    let call: (String, Int) -> Void
    let list: [(Int, Int)]
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// An `extension` wrapping the declaration is not the declaration: its brace opens no struct, so
// the type inside it is still counted at its own width.
check('edge 6 counts a value type an extension wraps on one line', () => {
  const source = `extension Head { struct Picked { let a: Int; let b: Int; let c: Int; let d: Int; let e: Int } }\n`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `an extension hid the width: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A block comment is prose, and prose may hold a declaration. Counting one would fail the build on
// a list Swift never declares — the `/* */` twin of the multi-line-string case below.
check('edge 6 does not count a value type written inside a block comment', () => {
  const source = `/*
struct Fake {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let e: Int
}
*/
struct Picked { let only: Int }
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// A block comment that opens and closes on one line hides only what is between its markers.
check('edge 6 reads the code around a one-line block comment', () => {
  const source = `struct Picked {
    let slot0: Int /* a note */, slot1: Int
    let slot2: Int
    let slot3: Int
    let slot4: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a block comment swallowed the line: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A name Swift escapes is still a name, and the type behind it declares the same list.
check('edge 6 counts a value type whose name is backtick-escaped', () => {
  const source = `struct \`default\` {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let e: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a backticked name hid the type: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// Only ONE branch of a conditional is compiled, so counting the property in each branch reports a
// width Swift never declares — and a false positive is what gets a gate suppressed.
check('edge 6 counts a conditionally compiled property once', () => {
  const source = `struct Picked {
    let slot0: Int
    let slot1: Int
    let slot2: Int
#if DEBUG
    let slot3: Int
#else
    let slot3: Int
#endif
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// The first branch is still read, so a conditional cannot be used to hide a field either.
check('edge 6 reads the first branch of a conditional', () => {
  const source = `struct Picked {
    let slot0: Int
    let slot1: Int
    let slot2: Int
#if DEBUG
    let slot3: Int
    let slot4: Int
#endif
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a conditional hid two fields: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A `private let` with a value is settled, so it is not in the list and seals nothing — swiftc says
// such a struct keeps an internal memberwise init, and the gate must still count it.
check('edge 6 is not sealed by a settled private let', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    private let settled = 0\n') }))
  assert.equal(result.status, 1, `a settled private let sealed the type: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// The seal is an exemption no `# INIT:` line records, so the run says how many it skipped. A gate
// that stays silent about what it did not read is one "quality passed" can be misread as covering.

// The struct keyword and the brace it opens need not share a line. A conformance list SwiftFormat
// wrapped is the common one, and it used to take the whole type out of the check — reachable by
// formatting alone, which is the worst kind of hole. Each row puts the brace somewhere else.
const HEADERS = [
  'struct Picked: Codable, Equatable,\n    Sendable {',
  'struct Picked\n{',
  'struct Picked:\n    Equatable\n{',
  'struct Picked<T>\nwhere T: Equatable {',
]

for (const [index, header] of HEADERS.entries()) {
  check(`edge 6 reads a struct header spread over lines (${index})`, () => {
    const source = `${header}\n    let a: Int\n    let b: Int\n    let c: Int\n    let d: Int\n    let e: Int\n}\n`
    const result = run(tree({ [ACTIONS]: source }))
    assert.equal(result.status, 1, `a wrapped header hid the type: ${result.output}`)
    assert.match(result.output, /Picked's synthesized memberwise init takes 5 parameters/)
  })
}

// A binding list wrapped over lines is one declaration, so the second line is not a stray.
check('edge 6 counts a binding list wrapped over lines', () => {
  const source = `struct Picked {
    let a: Int,
        b: Int
    let c: Int
    let d: Int
    let e: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a wrapped binding list went uncounted: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// Settling is a property of one BINDING, not of the line it is written on: `let e: Int, s = 7`
// settles only the second, and swiftc keeps `e` in the list.
check('edge 6 settles one binding without settling its neighbour', () => {
  const source = `struct Picked {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let e: Int, settled: Int = 7
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `one \`=\` settled the whole line: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A property whose name Swift escapes is still in the list.
check('edge 6 counts a backtick-escaped property name', () => {
  const source = `struct Picked {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let \`default\`: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a backticked property went uncounted: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A raw string and an extended regex literal escape nothing with `\`, so reading either by the
// plain-string rule runs past its terminator and swallows the brace that closes the struct — the
// whole rest of the file goes uncounted, which is the fail-open this gate exists to not be.
const LITERALS = ['static let backslash = #"\\"#', 'static let brace = #/\\{/#']

for (const [index, literal] of LITERALS.entries()) {
  check(`edge 6 is not unbalanced by a raw literal (${index})`, () => {
    const result = run(tree({ [ACTIONS]: wideStruct(5, `    ${literal}\n`) }))
    assert.equal(result.status, 1, `a raw literal swallowed the body: ${result.output}`)
    assert.match(result.output, /memberwise init takes 5 parameters/)
  })
}

// One branch of a conditional compiles and the gate cannot know which, so it counts the WIDEST:
// no branch hides a field, and no field is counted twice for being written in two branches.
check('edge 6 counts a field declared only in the else branch', () => {
  const source = `struct Picked {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
#if os(Linux)
#else
    let e: Int
#endif
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `the else branch went unread: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// An accessor brace on the next line is still an accessor, so the property is computed and stores
// nothing. Counting it would fail the build on a struct Swift gives a four-parameter init.
check('edge 6 does not count a property whose accessor brace is on the next line', () => {
  const source = `struct Picked {
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    var e: Int
    { a + b }
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

report('swift boundaries: reading a struct body')
