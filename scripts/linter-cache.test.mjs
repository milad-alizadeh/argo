#!/usr/bin/env node
// Tests for the per-step memory as the three Swift linters use it (#1377).
//
// They are a harder case than the suites, because two of them also run from lint-staged over
// the STAGED paths. A verdict about the whole tree must never answer a question about three
// files, and a rewrite must never be skipped because a check passed. So the cases below are
// mostly about which runs are ineligible.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { linterScenario } from './linter-scenario.harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

check('a whole-tree format check is not taken twice', () => {
  const s = linterScenario()
  assert.equal(s.lint('swift-format.sh', ['--check']).status, 0)
  assert.equal(s.linted('swiftformat'), 1)
  const second = s.lint('swift-format.sh', ['--check'])
  assert.equal(second.status, 0, second.stdout + second.stderr)
  assert.equal(s.linted('swiftformat'), 1, 'the second check must read the verdict')
  assert.match(second.stdout, /not checked again/)
  s.cleanup()
})

// A rewrite has a product: the reformatted files. Skipping it because a CHECK passed would
// leave the tree unformatted and say it had been formatted.
check('a rewrite is never skipped, whatever a check recorded', () => {
  const s = linterScenario()
  s.lint('swift-format.sh', ['--check'])
  const after = s.linted('swiftformat')
  s.lint('swift-format.sh')
  assert.equal(s.linted('swiftformat'), after + 1, 'a rewrite must run')
  s.cleanup()
})

check('a format check naming paths is neither read nor recorded', () => {
  const s = linterScenario()
  s.lint('swift-format.sh', ['--check'])
  const after = s.linted('swiftformat')
  s.lint('swift-format.sh', ['--check', 'apps/macOS/Packages/ArgoUI/source.swift'])
  assert.equal(s.linted('swiftformat'), after + 1, 'a question about paths must be asked')
  s.cleanup()
})

check('a whole-tree lint is not taken twice', () => {
  const s = linterScenario()
  assert.equal(s.lint('swift-lint.sh').status, 0)
  assert.equal(s.linted('swiftlint'), 1)
  const second = s.lint('swift-lint.sh')
  assert.equal(second.status, 0, second.stdout + second.stderr)
  assert.equal(s.linted('swiftlint'), 1)
  assert.match(second.stdout, /not linted again/)
  s.cleanup()
})

check('a lint naming staged paths is neither read nor recorded', () => {
  const s = linterScenario()
  s.lint('swift-lint.sh')
  const after = s.linted('swiftlint')
  s.lint('swift-lint.sh', ['apps/macOS/Packages/ArgoUI/source.swift'])
  assert.equal(s.linted('swiftlint'), after + 1, 'lint-staged must always lint what it staged')
  s.cleanup()
})

check('a failing linter records nothing', () => {
  const s = linterScenario()
  const failed = s.lint('swift-lint.sh', [], { STUB_LINT_STATUS: '1' })
  assert.notEqual(failed.status, 0, 'the stub was told to fail')
  const after = s.linted('swiftlint')
  s.lint('swift-lint.sh')
  assert.equal(s.linted('swiftlint'), after + 1, 'a failure must not be read back as a pass')
  s.cleanup()
})

check('a changed tree is linted again', () => {
  const s = linterScenario()
  s.lint('swift-lint.sh')
  const after = s.linted('swiftlint')
  s.commit('apps/macOS/Packages/ArgoUI/source.swift', 'let a = 2\n')
  s.lint('swift-lint.sh')
  assert.equal(s.linted('swiftlint'), after + 1)
  s.cleanup()
})

// The boundary gate scans the whole tree and ignores its arguments, so it has no path-shaped
// question to distinguish and no fixture worth building: what matters is that it asks and
// records at all, and that the record comes after the last check rather than before the first.
check('the boundary gate asks the cache, and records only at the end', () => {
  const gate = readFileSync(path.join(ROOT, 'scripts/swift-boundaries.sh'), 'utf8')
  assert.match(gate, /step_begin swift-boundaries/, 'it must ask')
  assert.match(gate, /step_end swift-boundaries/, 'it must record')
  assert.ok(
    gate.indexOf('step_end swift-boundaries') > gate.lastIndexOf('failed=1'),
    'a verdict recorded before the last edge would certify a tree that failed one',
  )
})

report('linter cache')
