#!/usr/bin/env node
// Tests for what `scripts/swift-lint.sh` REFUSES to lint at all, run via `bun run test:hooks`.
// Its siblings assert the argv SwiftLint is handed; these assert the two configurations under
// which handing it anything would be a lie — a rule configured that nothing runs, and no config
// for it to discover. Their own file because they need a scratch tree rather than the real repo.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { MISSING, run, STUBBED, scratch, treeDeclaring } from './swift-tooling.harness.mjs'

const LINT = 'scripts/swift-lint.sh'

// `swiftlint lint` reads `analyzer_rules` and ignores it, so a rule listed there while nothing runs
// `swiftlint analyze` has never checked a file (#1043). MISSING rather than STUBBED throughout: the
// refusals under test come before the tool guard, and a PATH with no SwiftLint on it is what proves
// it — the argv assertions would pass either way, since a refusing script runs no linter.
check('swift-lint.sh refuses analyzer_rules that nothing runs', () => {
  const result = run(LINT, { ...MISSING, cwd: treeDeclaring({}) })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /analyzer_rules is declared in .*\.swiftlint\.yml/)
  assert.doesNotMatch(result.output, /skipping/)
})

// The comment that explains why nobody runs `analyze` is the likeliest text in the tree to hold the
// command, and it must not be what lifts the refusal.
check('swift-lint.sh is not satisfied by a mention of the command in a comment', () => {
  const tree = treeDeclaring({
    runner: 'scripts/note.sh',
    invocation: '# swiftlint analyze one day\n',
  })
  const result = run(LINT, { ...MISSING, cwd: tree })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /analyzer_rules is declared/)
})

check('swift-lint.sh refuses a tree with no .swiftlint.yml to discover', () => {
  const root = treeDeclaring({ analyzerRules: false })
  rmSync(path.join(root, 'apps/macOS/.swiftlint.yml'))
  const result = run(LINT, { ...MISSING, cwd: root })
  // SwiftLint would lint against its own defaults and exit 0: a pass over none of the caps.
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /lint against its defaults/)
  assert.doesNotMatch(result.output, /skipping/)
})

// The three places the ticket weighed putting the gate, and one of them is not a shell script —
// a guard that only reads `*.sh` would refuse a repo whose gate is wired and running (#1043).
for (const [placement, runner, invocation] of [
  ['package.json', 'package.json', '{"scripts":{"q":"swiftlint analyze --compiler-log-path log"}}'],
  ['a shell script', 'scripts/analyze.sh', 'exec swiftlint analyze --compiler-log-path log\n'],
  [
    'a node script',
    'scripts/analyze.mjs',
    "spawnSync('swiftlint analyze --compiler-log-path log')\n",
  ],
  ['a CI workflow', '.github/workflows/ci.yml', '      - run: swiftlint analyze --strict\n'],
]) {
  check(`swift-lint.sh lints as normal when ${placement} runs swiftlint analyze`, () => {
    const result = run(LINT, { ...STUBBED, cwd: treeDeclaring({ runner, invocation }) })
    assert.equal(result.status, 0, result.output)
    assert.ok(result.argv.includes('lint'), `no lint in: ${result.argv.join(' ')}`)
  })
}

check('swift-lint.sh lints as normal with no analyzer_rules at all', () => {
  const result = run(LINT, { ...STUBBED, cwd: treeDeclaring({ analyzerRules: false }) })
  assert.equal(result.status, 0, result.output)
  assert.ok(result.argv.includes('lint'), `no lint in: ${result.argv.join(' ')}`)
})

rmSync(scratch, { recursive: true, force: true })

report('swift lint config')
