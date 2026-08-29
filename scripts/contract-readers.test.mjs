#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the visual contract's zero-reader sweep, run via `bun run test:hooks`.
// Every case here is a way a sweep has already got the answer wrong. Soften the script and this
// test together, never one alone.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { sweep } from './contract-readers.mjs'

// One throwaway tree shaped like the real one: a contract directory inside a search root, so the
// sweep reads its declarations out of the same corpus it searches. Removed however the case ends.
function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'contract-sweep-'))
  try {
    const contract = path.join(root, 'VisualContract')
    mkdirSync(contract, { recursive: true })
    for (const [name, body] of Object.entries(files)) {
      const file = path.join(name.includes('/') ? root : contract, name)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, body)
    }
    return sweep({ contractDir: contract, searchRoot: root })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const names = (group) => group.map((member) => `${member.owner}.${member.name}`)

// The finding that made this a ticket: `ArgoFloatingGlass`, `ArgoLabelStyle` and `ArgoRamp` all had
// zero reads of their type name and were drawn on every surface, through an extension method.
check('an extension method reached bare in a modifier chain is a reader', () => {
  const swept = tree({
    'ArgoTheme.swift': `public extension View {
    func argoInk(_ theme: ArgoTheme) -> some View { tint(theme.color) }
}`,
    'Shell/FeedCell.swift': 'argoInk(environment.theme)',
  })
  assert.deepEqual(names(swept.unread), [])
  assert.deepEqual(names(swept.undrawn), [])
})

check('a member reached on its type is a reader', () => {
  const swept = tree({
    'ArgoRadius.swift': `public enum ArgoRadius {
    public static let control: CGFloat = 6
}`,
    'Shell/Chip.swift': '.cornerRadius(ArgoRadius.control)',
  })
  assert.deepEqual(names(swept.unread), [])
})

check('a member reached through inference is a reader', () => {
  const swept = tree({
    'ArgoIconSize.swift': `public enum ArgoIconSize {
    case inline
}`,
    'Shell/Glyph.swift': 'argoIcon(.inline)',
  })
  assert.deepEqual(names(swept.unread), [])
})

// The same error in the opposite direction: count the family's own catalog and nothing is ever dead.
check("a member named only by its family's own catalog is unread", () => {
  const swept = tree({
    'ArgoElevation.swift': `public enum ArgoElevation {
    public static let flat = 0
    public static let all = [("flat", flat)]
}`,
  })
  assert.deepEqual(names(swept.unread), ['ArgoElevation.flat', 'ArgoElevation.all'])
})

check('a member read only by the specimen and a test is undrawn, not unread', () => {
  const swept = tree({
    'ArgoWaitAge.swift': `public enum ArgoWaitAge {
    public static let coldest = 4
}`,
    'Specimen/ContractSpecimen.swift': 'Text(ArgoWaitAge.coldest)',
    'Tests/WaitAgeTests.swift': '#expect(ArgoWaitAge.coldest == 4)',
  })
  assert.deepEqual(names(swept.unread), [])
  assert.deepEqual(names(swept.undrawn), ['ArgoWaitAge.coldest'])
})

// `contrastRatio` reads a local named `lighter`. Counting it puts a name on the dead list that was
// never a member at all.
check('a local inside a function body is not a member', () => {
  const swept = tree({
    'ArgoColor.swift': `public struct ArgoColor {
    func contrastRatio(on backdrop: ArgoColor) -> Double {
        let lighter = max(1, 2)
        return lighter
    }
}`,
  })
  assert.equal(swept.members.length, 1)
  assert.deepEqual(names(swept.unread), ['ArgoColor.contrastRatio'])
})

check('a nested type owns its own cases', () => {
  const swept = tree({
    'ArgoMotion.swift': `public struct ArgoMotion {
    public enum Curve {
        case linear
    }
    public let curve: Curve
}`,
  })
  assert.deepEqual(names(swept.unread).sort(), ['ArgoMotion.Curve.linear', 'ArgoMotion.curve'])
})

// Prose names roles constantly without reading one. A dead list diluted by comments is one nobody
// reads to the end.
check('a member named only in a comment or a string is unread', () => {
  const swept = tree({
    'ArgoRadius.swift': `public enum ArgoRadius {
    public static let deck: CGFloat = 0
}`,
    'Shell/Deck.swift': '// The deck is flush.\nlabel("deck")',
  })
  assert.deepEqual(names(swept.unread), ['ArgoRadius.deck'])
})

// Two families spell `deck`, and the one surface hit is `ArgoElevation`'s. It keeps `ArgoRadius`'s
// alive too — sharing can only ever keep a member — so both are marked for a human to read.
check('a name a second family also spells is marked', () => {
  const swept = tree({
    'ArgoRadius.swift': 'public enum ArgoRadius {\n    public static let deck: CGFloat = 0\n}',
    'ArgoElevation.swift': 'public enum ArgoElevation {\n    public static let deck = 1\n}',
    'Shell/Deck.swift': 'background(ArgoElevation.deck)',
  })
  assert.deepEqual(names(swept.unread), [])
  assert.equal(
    swept.members.every((member) => member.shared),
    true,
  )
})

// A member with no type around it is the sweep's quietest failure: skipping it reports nothing, and
// nothing is what a clean sweep looks like too.
check('a declaration with no type around it is still a member', () => {
  const swept = tree({ 'ArgoMotion.swift': 'public let passReentry = 1.0 / 60' })
  assert.deepEqual(names(swept.unread), ['ArgoMotion.passReentry'])
})

report('contract-readers')
