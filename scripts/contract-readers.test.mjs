#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the visual contract's zero-reader sweep, run via `bun run test:hooks`.
// Every case here is a way the last sweep got the answer wrong: a type-name grep could not see an
// extension method, and a name-anywhere grep counted a local, a comment and the family's own
// catalog as readers. Soften the script and this test together, never one alone.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sweep } from './contract-readers.mjs'

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

/// One throwaway tree shaped like the real one: a contract directory inside a search root, so the
/// sweep reads its own declarations out of the same corpus it searches.
function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'contract-sweep-'))
  const contract = path.join(root, 'VisualContract')
  mkdirSync(contract, { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(name.includes('/') ? root : contract, name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
  return sweep({ contractDir: contract, searchRoot: root })
}

const names = (group) => group.map((member) => `${member.owner}.${member.name}`)

// The finding that made this a ticket: `ArgoFloatingGlass`, `ArgoLabelStyle` and `ArgoRamp` all had
// zero reads of their type name and were used constantly, because a surface reaches them through an
// extension method. A sweep that cannot see `argoInk(theme)` reports a live modifier as dead.
check('an extension method reached bare in a modifier chain is a reader', () => {
  const swept = tree({
    'ArgoTheme.swift': [
      'public extension View {',
      '    func argoInk(_ theme: ArgoTheme) -> some View {',
      '        tint(theme.color)',
      '    }',
      '}',
    ].join('\n'),
    'Shell/FeedCell.swift': ['struct FeedCell: View {', '    argoInk(environment.theme)', '}'].join(
      '\n',
    ),
  })
  assert.deepEqual(names(swept.unread), [])
  assert.deepEqual(names(swept.undrawn), [])
})

check('a member reached on its type is a reader', () => {
  const swept = tree({
    'ArgoRadius.swift': [
      'public enum ArgoRadius {',
      '    public static let control: CGFloat = 6',
      '}',
    ].join('\n'),
    'Shell/Chip.swift': '.cornerRadius(ArgoRadius.control)',
  })
  assert.deepEqual(names(swept.unread), [])
})

check('a member reached through inference is a reader', () => {
  const swept = tree({
    'ArgoIconSize.swift': ['public enum ArgoIconSize {', '    case inline', '}'].join('\n'),
    'Shell/Glyph.swift': 'argoIcon(.inline)',
  })
  assert.deepEqual(names(swept.unread), [])
})

// The other half of the last sweep's error, in the opposite direction: a name-anywhere grep counts
// the family's own catalog, so nothing ever looks dead.
check("a member named only by its family's own catalog is unread", () => {
  const swept = tree({
    'ArgoElevation.swift': [
      'public enum ArgoElevation {',
      '    public static let flat = 0',
      '    public static let all = [("flat", flat)]',
      '}',
    ].join('\n'),
  })
  assert.deepEqual(names(swept.unread), ['ArgoElevation.flat', 'ArgoElevation.all'])
})

check('a member read only by the specimen and a test is undrawn, not unread', () => {
  const swept = tree({
    'ArgoWaitAge.swift': [
      'public enum ArgoWaitAge {',
      '    public static let coldest = 4',
      '}',
    ].join('\n'),
    'Specimen/ContractSpecimen.swift': 'Text(ArgoWaitAge.coldest)',
    'Tests/WaitAgeTests.swift': '#expect(ArgoWaitAge.coldest == 4)',
  })
  assert.deepEqual(names(swept.unread), [])
  assert.deepEqual(names(swept.undrawn), ['ArgoWaitAge.coldest'])
})

// `contrastRatio` reads a local named `lighter`; `ArgoLayout` reads a local named `taken`. Counting
// either as a member puts a name on the dead list that was never a member at all.
check('a local inside a function body is not a member', () => {
  const swept = tree({
    'ArgoColor.swift': [
      'public struct ArgoColor {',
      '    func contrastRatio(on backdrop: ArgoColor) -> Double {',
      '        let lighter = max(1, 2)',
      '        return lighter',
      '    }',
      '}',
    ].join('\n'),
  })
  assert.equal(swept.total, 1)
  assert.deepEqual(names(swept.unread), ['ArgoColor.contrastRatio'])
})

check('a nested type owns its own cases', () => {
  const swept = tree({
    'ArgoMotion.swift': [
      'public struct ArgoMotion {',
      '    public enum Curve {',
      '        case linear',
      '    }',
      '    public let curve: Curve',
      '}',
    ].join('\n'),
  })
  assert.deepEqual(names(swept.unread).sort(), ['ArgoMotion.Curve.linear', 'ArgoMotion.curve'])
})

// Prose names roles constantly without reading one. A sweep whose dead list is diluted by comments
// is a sweep nobody reads to the end.
check('a member named only in a comment or a string is unread', () => {
  const swept = tree({
    'ArgoRadius.swift': [
      'public enum ArgoRadius {',
      '    public static let deck: CGFloat = 0',
      '}',
    ].join('\n'),
    'Shell/Deck.swift': ['// The deck is flush.', 'label("deck")'].join('\n'),
  })
  assert.deepEqual(names(swept.unread), ['ArgoRadius.deck'])
})

// Two families spell `deck`, and the one surface hit is `ArgoElevation`'s. It keeps `ArgoRadius`'s
// alive too — sharing can only ever keep a member — so both are marked for a human to read.
check('a name a second family also spells is marked', () => {
  const swept = tree({
    'ArgoRadius.swift': [
      'public enum ArgoRadius {',
      '    public static let deck: CGFloat = 0',
      '}',
    ].join('\n'),
    'ArgoElevation.swift': [
      'public enum ArgoElevation {',
      '    public static let deck = 1',
      '}',
    ].join('\n'),
    'Shell/Deck.swift': 'background(ArgoElevation.deck)',
  })
  assert.deepEqual(names(swept.unread), [])
  assert.equal(
    swept.members.every((member) => swept.shared(member)),
    true,
  )
})

console.log(failures === 0 ? '\ncontract-readers: all checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
