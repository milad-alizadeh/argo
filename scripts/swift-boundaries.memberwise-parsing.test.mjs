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

// A `private let` with a value is settled, so it is not in the list and seals nothing — swiftc says
// such a struct keeps an internal memberwise init, and the gate must still count it.
check('edge 6 is not sealed by a settled private let', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    private let settled = 0\n') }))
  assert.equal(result.status, 1, `a settled private let sealed the type: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

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

// Neither a blank line nor a comment says what follows a held declaration, so neither settles it as
// stored — the accessor brace under them still makes the property computed.
const GAPS = ['    // The sum every caller wants.', '']

for (const [index, gap] of GAPS.entries()) {
  check(`edge 6 holds a declaration across a gap before its brace (${index})`, () => {
    const source = `struct Picked {
    var a: Int
    var b: Int
    var c: Int
    var d: Int
    var total: Int
${gap}
    {
        a + b + c + d
    }
}
`
    const result = run(tree({ [ACTIONS]: source }))
    assert.equal(result.status, 0, result.output)
  })
}

// `init!` and a generic `init<T>` are initializers too, so the written-init scanner counts them and
// the memberwise one knows they suppress the synthesized list.
const SPELLINGS = ['init!', 'init<T: BinaryInteger>']

for (const spelling of SPELLINGS) {
  check(`edge 6 counts a written \`${spelling}\``, () => {
    const source = `struct Picked {
    ${spelling}(a: Int, b: Int, c: Int, d: Int, e: Int) { }
}
`
    const result = run(tree({ [ACTIONS]: source }))
    assert.equal(result.status, 1, `${spelling} went uncounted: ${result.output}`)
    assert.match(result.output, /init takes 5 parameters/)
  })
}

report('swift boundaries: reading a struct body')
