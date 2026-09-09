#!/usr/bin/env node
// The order an implement run verifies in, and what a review agent may run (#1711).
//
// Prose is what carries this — the review is a sub-agent reading a prompt, and no exit code
// stands between it and `bun run test`. So the prose is held here instead: the brief exists in
// two places and this suite is what makes them one place, and the step order is asserted by
// position rather than trusted to read correctly.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8')

const IMPLEMENT = 'packages/argo-skills/skills/implement/SKILL.md'
const SHIP = 'packages/argo-skills/skills/ship/SKILL.md'
const CONTRACT = 'docs/agents/code-review.md'

// A markdown blockquote, stripped of its indentation and its markers, so the same words indented
// inside a numbered list and flush at the left margin compare equal.
const quoted = (markdown) =>
  markdown
    .split('\n')
    .filter((line) => /^\s*> /.test(line))
    .map((line) => line.replace(/^\s*> /, '').trim())
    .join(' ')

check('the implement skill runs its steps in the one order that gates once', () => {
  const skill = read(IMPLEMENT)
  const at = (needle) => {
    const found = skill.indexOf(needle)
    assert.ok(found >= 0, `the implement skill does not say ${JSON.stringify(needle)}`)
    return found
  }

  const focused = at('Focused checks while you build')
  // The step, anchored on the invocation rather than on the words `code-review` — those also
  // appear in the doc path this skill cites two paragraphs earlier.
  const review = at('`/code-review`')
  const batch = at('Fix every finding in one batch')
  const commit = at('Commit your work')
  const gate = at("the project's full gate, once, on that committed tree")

  assert.ok(focused < review, 'the focused checks come before the review')
  assert.ok(review < batch, 'the fixes come after the review that found them')
  assert.ok(batch < commit, 'the final commit carries the fixes')
  assert.ok(commit < gate, 'the gate runs on the committed tree, not before it')
})

check('nothing tells an implement run to run the full suite before the review', () => {
  const skill = read(IMPLEMENT)
  const review = skill.indexOf('`/code-review`')
  const before = skill.slice(0, review)
  // The instruction this replaced: "Run typechecking regularly, single test files regularly,
  // and the full test suite once at the end" — an end that came before the review, over a tree
  // the review was about to change.
  assert.doesNotMatch(before, /full test suite/, 'a full suite is asked for before the review')
  assert.match(before, /Not the full suite, not a full build, not the project's gate/)
})

check('every axis prompt carries the read-only brief, and it is one text', () => {
  const inSkill = quoted(read(IMPLEMENT))
  const inContract = quoted(read(CONTRACT))
  assert.ok(inSkill.length > 200, `the brief is missing from ${IMPLEMENT}`)
  assert.equal(inSkill, inContract, 'the two copies of the brief have drifted apart')
})

check('the brief forbids each broad command by name', () => {
  const brief = quoted(read(CONTRACT))
  for (const forbidden of ['a build', 'a full test suite', 'bun run quality', 'bun run test']) {
    assert.ok(brief.includes(forbidden), `the brief does not forbid ${forbidden}`)
  }
  assert.match(brief, /Do not commit, push, or edit a file/)
})

check('the brief allows exactly one focused test, and says what earns it', () => {
  const brief = quoted(read(CONTRACT))
  assert.match(brief, /exactly ONE focused test/)
  assert.match(brief, /state the uncertainty it will\s+resolve/)
  // Naming the package is what makes the command safe: an unfiltered run is the whole suite by
  // another name.
  assert.match(brief, /the command names its package/)
  assert.match(brief, /If you cannot name what\s+the test would settle, do not run it/)
})

check('the contract says when a complete axis runs a second time', () => {
  const contract = read(CONTRACT)
  assert.match(contract, /## When a complete axis runs again/)
  assert.match(contract, /P0 or P1 fix that changes behaviour the axis covers/)
  assert.match(contract, /that axis — not both/)
  assert.match(contract, /one focused review of the hunks that changed/)
})

// #1758 deleted the push-time gate, so the only gate either skill can name is what CI runs. A
// skill that still named `swift-gate.sh` would be telling a session to run a file that is gone.
check('both skills gate on exactly what CI runs, and name nothing deleted', () => {
  for (const skill of [IMPLEMENT, SHIP]) {
    const text = read(skill)
    assert.match(text, /bun run test:hooks/, `${skill} does not run the hook suites`)
    assert.doesNotMatch(
      text,
      /swift-gate|ARGO_GATE_CALLER|ARGO_SKIP_SWIFT_GATE|gate:report/,
      `${skill} names a deleted gate`,
    )
  }
  assert.match(read(IMPLEMENT), /bun run quality/)
  assert.match(read(SHIP), /bun run format-and-lint/)
})

check('the repo rules point at the contract rather than restating it', () => {
  const agents = read('AGENTS.md')
  assert.match(agents, /A review agent is read-only/)
  assert.match(agents, /docs\/agents\/code-review\.md/)
})

report('review contract')
