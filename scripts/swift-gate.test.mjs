#!/usr/bin/env node
// Tests for `scripts/swift-gate.sh` and the `.husky/pre-push` hook that calls it — the gate
// that replaced ci.yml's `macos` job (#1340).
//
// Moving a gate off CI is only safe if the local one is proved to FIRE. Two ways it could
// quietly stop gating, both of which have happened to gates in this repo before:
//
//   - the pathspec drifts from ci.yml's, so a Swift change is judged out of scope and the
//     gate skips the push it existed for;
//   - the hook file is renamed or deleted, and husky's `[ ! -f "$s" ] && exit 0` passes
//     every push in silence.
//
// The scope case below re-reads ci.yml and compares the two pathspecs literally, and the
// invocation cases run the script against a real temporary repository rather than reading it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { gateScenario } from './gate-scenario.harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GATE = path.join(ROOT, 'scripts/swift-gate.sh')
const HOOK = path.join(ROOT, '.husky/pre-push')
const WORKFLOW = path.join(ROOT, '.github/workflows/ci.yml')

// The pathspec both sides must spell, as a list of operands. Whitespace and line breaks
// differ between a YAML `run:` block and a shell script, so both sides are reduced to this
// sequence of tokens before being compared.
const SCOPE = [
  'apps/macOS',
  "'scripts/swift-*.sh'",
  'package.json',
  'turbo.json',
  '.github/workflows/ci.yml',
  '.github/actions/setup',
  "':(exclude)*.md'",
]

// The Swift-scope pathspec operands, in order, as bare tokens.
function pathspecOf(text, label) {
  // Anchored on the operand list itself rather than on `--`: ci.yml passes its range through
  // a `changed()` shell function, so the literal `git diff --name-only ... -- "$@"` there is
  // the wrapper, not the scope. The list runs from its first operand to its exclude
  // pathspec, which both sides put last.
  const match = text.match(/apps\/macOS[\s\S]*?\*\.md'/)
  assert.ok(match, `${label}: found no Swift-scope pathspec to read`)
  return match[0]
    .split(/\s+/)
    .map((token) => token.replace(/\\$/, '').trim())
    .filter(Boolean)
}

check('the gate script spells the scope ci.yml documented', () => {
  assert.deepEqual(pathspecOf(readFileSync(GATE, 'utf8'), 'swift-gate.sh'), SCOPE)
})

check('ci.yml still spells the same scope, so the two have not drifted apart', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8')
  // The `changes` job is retired with the macos job it fed; while it is there, it must agree.
  if (!workflow.includes('git diff --name-only')) {
    // Nothing to drift from. The gate script is then the only definition of the scope, and
    // the case above is what holds it.
    assert.ok(workflow.includes('scripts/swift-gate.sh'), 'ci.yml must point at the local gate')
    return
  }
  assert.deepEqual(pathspecOf(workflow, 'ci.yml'), SCOPE)
})

check('the pre-push hook exists and calls the gate', () => {
  const hook = readFileSync(HOOK, 'utf8')
  // Husky exits 0 when this file is missing, so its absence is a silent pass, not an error.
  assert.match(hook, /swift-gate\.sh/, 'pre-push must call scripts/swift-gate.sh')
  assert.match(hook, /ARGO_SKIP_SWIFT_GATE/, 'the override must be named in the hook')
})

// --- the script, run for real -------------------------------------------------------------

// The repository, the stubs and the runner live in `gate-scenario.harness.mjs`, shared with
// `gate-cache.test.mjs` (#1377): both suites want the same throwaway repository, and a second
// copy of one is a second thing to keep true. Here a scenario is only ever the files the branch
// changed.
const scenario = (files) => gateScenario({ change: files })

check('a Swift change runs all three commands, formatter first', () => {
  const s = scenario({ 'apps/macOS/Sources/A.swift': 'let a = 1\n' })
  try {
    const result = s.run()
    assert.equal(result.status, 0, result.output)
    assert.deepEqual(s.ran(), [
      'run quality:swift',
      'run build --filter=@argo/macos',
      'run test --filter=@argo/macos',
    ])
  } finally {
    s.cleanup()
  }
})

check('a markdown-only change skips, exactly as the CI job did', () => {
  const s = scenario({ 'apps/macOS/README.md': 'docs\n' })
  try {
    const result = s.run()
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /skipping/)
    assert.deepEqual(s.ran(), [], 'nothing should have been run')
  } finally {
    s.cleanup()
  }
})

check('a change outside the Swift scope skips', () => {
  const s = scenario({ 'docs/agents/whatever.txt': 'x\n' })
  try {
    assert.deepEqual(s.ran(), [])
    const result = s.run()
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /skipping/)
  } finally {
    s.cleanup()
  }
})

// The case the whole ticket rests on: a failing check must FAIL, so the push is refused.
// Without this the gate is a log line.
check('a failing check fails the gate, so the push is blocked', () => {
  const s = scenario({ 'apps/macOS/Sources/A.swift': 'let a = 1\n' })
  try {
    const result = s.run({ STUB_BUN_STATUS: '1' })
    assert.notEqual(result.status, 0, `expected a non-zero exit, got: ${result.output}`)
    // `set -e` must stop at the first failure rather than running on to the tests.
    assert.deepEqual(s.ran(), ['run quality:swift'])
  } finally {
    s.cleanup()
  }
})

check('the gate demands the strict toolchain flag it inherited from CI', () => {
  assert.match(readFileSync(GATE, 'utf8'), /ARGO_REQUIRE_SWIFT_TOOLS=1/)
})

report('swift-gate')
