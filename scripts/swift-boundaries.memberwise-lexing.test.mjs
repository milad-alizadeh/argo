#!/usr/bin/env node
// Tests for what edge 6 reads as CODE, the third of the memberwise suites.
//
// Prose may hold anything a declaration can, and a literal may hold anything prose can. Every case
// here is a way the reader could lose its place in the text, and losing it fails quietly: the rest
// of the file goes uncounted while the gate says it passed.
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

// The `/* */` twin of the case above.
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

// Swift NESTS block comments, so the first `*/` need not close the one that is open. Reading it as
// the end leaves the rest of the comment as code, and a brace in there closes the struct early.
check('edge 6 closes a nested block comment at its own end', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    /* note /* inner */ { */\n') }))
  assert.equal(result.status, 1, `a nested comment leaked into the code: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A raw string and an extended regex literal escape nothing with `\`, so reading either by the
// plain-string rule runs past its terminator and swallows the brace that closes the struct — the
// whole rest of the file then goes uncounted, which is the fail-open this gate exists to not be.
const LITERALS = ['static let backslash = #"\\"#', 'static let brace = #/\\{/#']

for (const [index, literal] of LITERALS.entries()) {
  check(`edge 6 is not unbalanced by a raw literal (${index})`, () => {
    const result = run(tree({ [ACTIONS]: wideStruct(5, `    ${literal}\n`) }))
    assert.equal(result.status, 1, `a raw literal swallowed the body: ${result.output}`)
    assert.match(result.output, /memberwise init takes 5 parameters/)
  })
}

// An interpolation holds code, and code holds quotes. Ending the string at the first of them leaks
// whatever follows, and a `}` there closes the struct at nothing.
check('edge 6 does not end a string at a quote inside an interpolation', () => {
  const source = `struct Picked {
    let note = "\\("}")"
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let e: Int
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `an interpolation leaked a brace: ${result.output}`)
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

// Neither branch may hide a field, so the WIDEST is what counts — whichever branch it is in.
const BRANCHES = [
  '#if DEBUG\n    let d: Int\n    let e: Int\n#endif',
  '#if os(Linux)\n#else\n    let d: Int\n    let e: Int\n#endif',
]

for (const [index, branch] of BRANCHES.entries()) {
  check(`edge 6 reads every branch of a conditional (${index})`, () => {
    const source = `struct Picked {
    let a: Int
    let b: Int
    let c: Int
${branch}
}
`
    const result = run(tree({ [ACTIONS]: source }))
    assert.equal(result.status, 1, `a branch went unread: ${result.output}`)
    assert.match(result.output, /memberwise init takes 5 parameters/)
  })
}

// A conditional inside a conditional: the widest-branch bookkeeping is per nesting level, or an
// inner block overwrites the maximum its own outer branch had already reached.
check('edge 6 keeps the outer branch width across a nested conditional', () => {
  const source = `struct Picked {
#if !NEVER
    let a: Int
    let b: Int
    let c: Int
    let d: Int
    let e: Int
#else
#if os(iOS)
    let z: Int
#endif
#endif
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a nested conditional reset the count: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A directive is only a directive in CODE. One written in prose used to drive the state machine,
// and `#else` resets the running count — so a comment could zero a struct's width.
const PROSE = ['    static let doc = """\n#else\n"""', '    /*\n#else\n    */']

for (const [index, prose] of PROSE.entries()) {
  check(`edge 6 does not read a directive written in prose (${index})`, () => {
    const result = run(tree({ [ACTIONS]: wideStruct(5, `${prose}\n`) }))
    assert.equal(result.status, 1, `prose drove the conditional: ${result.output}`)
    assert.match(result.output, /memberwise init takes 5 parameters/)
  })
}

report('swift boundaries: reading Swift as text')
