// What a `paths:` glob covers. The other half of the rules guard, whose own suite is in
// rules-guard.test.mjs; split on file length alone, the way guards.test.mjs is.
//
// The three shapes Argo's own rules use are the three this has to answer: `**`,
// `apps/desktop/**` and `apps/macOS/**/*.swift`.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { covers, readRules, ruleGlobs, rulesFor } from './rule-paths.mjs'

const RULES = [
  { name: 'desktop.md', globs: ['apps/desktop/**'] },
  { name: 'house.md', globs: ['**'] },
  { name: 'swift.md', globs: ['apps/macOS/**/*.swift'] },
]

// --- the frontmatter --------------------------------------------------------------------------

test('ruleGlobs reads the paths list out of the frontmatter', () => {
  assert.deepEqual(ruleGlobs('---\npaths:\n  - "apps/desktop/**"\n---\n\n# Desktop'), [
    'apps/desktop/**',
  ])
})

test('ruleGlobs reads an unquoted item and more than one of them', () => {
  assert.deepEqual(ruleGlobs('---\npaths:\n  - apps/a/**\n  - "apps/b/**"\n---\n'), [
    'apps/a/**',
    'apps/b/**',
  ])
})

test('ruleGlobs stops at the next key, so a later list is not read as paths', () => {
  assert.deepEqual(ruleGlobs('---\npaths:\n  - "a/**"\nalso:\n  - "b/**"\n---\n'), ['a/**'])
})

test('ruleGlobs answers empty for a file with no frontmatter, which covers nothing', () => {
  assert.deepEqual(ruleGlobs('# Just a document\n\npaths:\n  - "**"\n'), [])
})

// --- the matcher ------------------------------------------------------------------------------

test('** covers every path, at every depth', () => {
  assert.equal(covers('**', 'AGENTS.md'), true)
  assert.equal(covers('**', 'apps/desktop/src/main.ts'), true)
})

test('a directory glob covers below it and nothing beside it', () => {
  assert.equal(covers('apps/desktop/**', 'apps/desktop/src/main.ts'), true)
  assert.equal(covers('apps/desktop/**', 'apps/macOS/App.swift'), false)
  // The neighbour whose name merely starts the same way.
  assert.equal(covers('apps/desktop/**', 'apps/desktop-old/x.ts'), false)
})

test('an extension glob covers only that extension, at any depth including none', () => {
  assert.equal(covers('apps/macOS/**/*.swift', 'apps/macOS/Sources/App/View.swift'), true)
  assert.equal(covers('apps/macOS/**/*.swift', 'apps/macOS/App.swift'), true)
  assert.equal(covers('apps/macOS/**/*.swift', 'apps/macOS/Package.resolved'), false)
})

test('* stops at a separator', () => {
  assert.equal(covers('rules/*.md', 'rules/house.md'), true)
  assert.equal(covers('rules/*.md', 'rules/nested/house.md'), false)
})

test('a dot in a glob is a literal dot, not any character', () => {
  assert.equal(covers('a/*.md', 'a/xxmd'), false)
})

test('a regular expression character in a glob is literal, so a glob never widens silently', () => {
  // Unescaped, the `?` would read as a quantifier and make the character before it optional.
  assert.equal(covers('a/x?.ts', 'a/x?.ts'), true)
  assert.equal(covers('a/x?.ts', 'a/x.ts'), false)
  assert.equal(covers('a/(x).ts', 'a/(x).ts'), true)
})

test('rulesFor returns every rule that covers a path', () => {
  assert.deepEqual(rulesFor(RULES, 'apps/desktop/src/main.ts'), ['desktop.md', 'house.md'])
  assert.deepEqual(rulesFor(RULES, 'apps/macOS/App.swift'), ['house.md', 'swift.md'])
  assert.deepEqual(rulesFor(RULES, 'README.md'), ['house.md'])
})

// --- reading the directory ---------------------------------------------------------------------

test('readRules reads the directory rather than a hard-coded list of names', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'argo-rules-'))
  after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(path.join(directory, 'zebra.md'), '---\npaths:\n  - "z/**"\n---\n')
  writeFileSync(path.join(directory, 'alpha.md'), '---\npaths:\n  - "a/**"\n---\n')
  // No frontmatter: it declares nothing, so it is not a rule this guard can enforce.
  writeFileSync(path.join(directory, 'notes.md'), '# notes\n')
  writeFileSync(path.join(directory, 'ignored.txt'), '---\npaths:\n  - "**"\n---\n')
  assert.deepEqual(readRules(directory), [
    { name: 'alpha.md', globs: ['a/**'] },
    { name: 'zebra.md', globs: ['z/**'] },
  ])
})

test('readRules answers empty for a directory that is not there, leaving the guard silent', () => {
  assert.deepEqual(readRules(path.join(tmpdir(), 'argo-rules-absent-directory')), [])
})

test("the repository's own rules parse, so the guard reads what rules/ actually declares", () => {
  const names = readRules(path.resolve(import.meta.dirname, '..', 'rules')).map((r) => r.name)
  assert.ok(names.includes('house.md'), `house.md missing from ${names.join(', ')}`)
  assert.ok(names.includes('desktop.md'), `desktop.md missing from ${names.join(', ')}`)
})
