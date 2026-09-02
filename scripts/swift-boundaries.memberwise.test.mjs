#!/usr/bin/env node
// Tests for swift-boundaries edge 6 on the SYNTHESIZED memberwise init (#1060).
//
// The sibling of `swift-boundaries.cap.test.mjs`, which covers the written `init`. This half has no
// declaration to find at all: the subject is the struct's body, so every case below is a question
// about what Swift puts in that list — checked against swiftc, not assumed.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { ACTIONS, CONFIG, run, swiftlint, tree, wideStruct } from './swift-boundaries.fixture.mjs'

// A value type's memberwise init is a parameter list every call site lines up, and nothing counted
// it — so a regroup could move width into one rather than remove it (#1060).
check('edge 6 counts a synthesized memberwise init past the cap', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5) }))
  assert.equal(result.status, 1, `a five-field value type passed: ${result.output}`)
  assert.match(result.output, /over the 4-parameter cap/)
  assert.match(result.output, /Picked's synthesized memberwise init takes 5 parameters/)
})

check('edge 6 passes a synthesized memberwise init at the cap', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(4) }))
  assert.equal(result.status, 0, result.output)
})

// A written init in the struct's BODY replaces the synthesized one, so there is one list and the
// written-init scanner already counts it. Counting both would report a list Swift never declares.
check('edge 6 does not count a memberwise init a written one replaces', () => {
  const result = run(
    tree({ [ACTIONS]: wideStruct(6, '    init(only: Int) { self.slot0 = only }\n') }),
  )
  assert.equal(result.status, 0, result.output)
})

// An init in an EXTENSION does not suppress the memberwise one — Swift synthesizes both, which is
// the standard trick for keeping it. So the wide list is still declared and still counts.
check('edge 6 counts a memberwise init an extension does not suppress', () => {
  const source = `${wideStruct(5)}extension Picked {\n    init(only: Int) { self.init(slot0: only, slot1: 0, slot2: 0, slot3: 0, slot4: 0) }\n}\n`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `an extension's init suppressed nothing: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// Only the members Swift actually puts in the list count. One row per shape, each built so the
// struct is at cap+1 ONLY if that row counts — so a miscount fires rather than passing vacuously.
// `lazy var` was checked against swiftc: `Picked(slot0:late:)` compiles, so it IS a parameter.
const MEMBERS = [
  ['static let shared = 0', false],
  ['var doubled: Int { slot0 * 2 }', false],
  ['var described: String {\n        get { "" }\n        set { slot0 = 0 }\n    }', false],
  ['lazy var late: Int = 0', true],
  ['var flag = false', true],
]

for (const [member, counts] of MEMBERS) {
  check(`edge 6 ${counts ? 'counts' : 'does not count'} \`${member.split('\n')[0]}\``, () => {
    const result = run(tree({ [ACTIONS]: wideStruct(4, `    ${member}\n`) }))
    assert.equal(result.status, counts ? 1 : 0, `expected counts=${counts}: ${result.output}`)
  })
}

// A `private lazy var` is stored and private, so it seals the list — the modifier filter must not
// swallow it before the seal is read.
check('edge 6 is sealed by a private lazy stored property', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    private lazy var late: Int = 0\n') }))
  assert.equal(result.status, 0, result.output)
})

// An initialised `let` is already settled, so Swift leaves it out of the memberwise list — verified
// against swiftc, not assumed. Counting it would report a parameter no call site can pass.
check('edge 6 does not count an initialised let', () => {
  const source = `struct Picked {
    let slot0: Int
    let slot1: Int
    let slot2: Int
    let slot3: Int
    let settled = 7
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// A defaulted `var` IS in the list, so it counts: the cap is on the parameter list Swift declares,
// and a caller may line up every slot of it. The ratchet, not the cap, is where a record says its
// width is its own shape.
check('edge 6 counts a defaulted stored property', () => {
  const source = `struct Picked {
    let slot0: Int
    var slot1 = 0
    var slot2 = 0
    var slot3 = 0
    var slot4 = 0
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a defaulted slot went uncounted: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// A private or fileprivate STORED property makes the whole memberwise init private — verified
// against swiftc — so no other file can call it and no width can cross into it. Counting one would
// fail the build on every SwiftUI view holding `@State private var`, which declares no seam at all.
check('edge 6 does not count a memberwise init a private field seals', () => {
  const source = `struct Picked {
    let slot0: Int
    let slot1: Int
    let slot2: Int
    let slot3: Int
    private var isHovered = false
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// A private COMPUTED property seals nothing: it is not a stored property, so it is not in the list
// and does not lower the list's access. Reading it as a seal would blind the edge to most of ArgoUI.
check('edge 6 is not sealed by a private computed property', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    private var body: Int { slot0 }\n') }))
  assert.equal(result.status, 1, `a private computed property sealed the count: ${result.output}`)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// Swift synthesizes a memberwise init for a struct and nothing else. A class or an enum with the
// same fields declares no such list.
check('edge 6 counts a memberwise init for structs only', () => {
  const source = `final class Wide {
    var slot0 = 0
    var slot1 = 0
    var slot2 = 0
    var slot3 = 0
    var slot4 = 0
}

enum Kind {
    case only
    static var slot0 = 0
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 0, result.output)
})

// A nested type is counted at its own width and its own line: the group #1058 extracted was nested
// inside the value that carried it, which is where the pattern puts it.
check('edge 6 counts a nested value type at its own width', () => {
  const source = `struct DeckContent {
    let picked: Picked

    struct Picked {
        let slot0: Int
        let slot1: Int
        let slot2: Int
        let slot3: Int
        let slot4: Int
    }
}
`
  const result = run(tree({ [ACTIONS]: source }))
  assert.equal(result.status, 1, `a nested value type passed: ${result.output}`)
  assert.match(result.output, /CockpitActions\.swift:4/)
  assert.match(result.output, /memberwise init takes 5 parameters/)
})

// The ratchet is one list: a synthesized memberwise init IS an initializer, so it is grandfathered
// by the same `# INIT:` line and the same width, and nothing new gets in free.
check('edge 6 passes a memberwise init the list names at its own width', () => {
  const config = swiftlint('CockpitActions.swift 5 — a fixture of five fields')
  const result = run(tree({ [ACTIONS]: wideStruct(5), [CONFIG]: config }))
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /1 grandfathered by name/)
})

check('edge 6 fails a memberwise init wider than the entry naming its file', () => {
  const config = swiftlint('CockpitActions.swift 5 — a fixture of five fields')
  const result = run(tree({ [ACTIONS]: wideStruct(6), [CONFIG]: config }))
  assert.equal(result.status, 1, `a sixth field passed on a 5-field entry: ${result.output}`)
  assert.match(result.output, /memberwise init takes 6 parameters/)
})

check('edge 6 says how many types the seal skipped', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(5, '    private var isHovered = false\n') }))
  assert.equal(result.status, 0, result.output)
  // Only a type the seal actually saved from failing is counted: the figure is what the gate did
  // not read, not how many private properties the tree holds.
  assert.match(result.output, /1 skipped, memberwise init sealed private/)
})

// And it says zero when nothing was skipped, so the figure is a reading rather than a decoration.
check('edge 6 reports no skips when nothing is sealed', () => {
  const result = run(tree({ [ACTIONS]: wideStruct(4) }))
  assert.match(result.output, /0 skipped, memberwise init sealed private/)
})

report('swift boundaries: the memberwise initializer cap')
