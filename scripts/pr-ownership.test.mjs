#!/usr/bin/env node
// Holds AGENTS.md, "Pushing and pull requests" (#1669) as a failing check rather than prose:
// `/ship` is the only skill that may open a pull request, and only three other files may push
// anything at all. The first case is the rule over the real bundle; the rest inject the violation
// so the check is known to fire, because a grep-shaped gate over a tree it cannot find passes.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { ALLOWED, auditSkills, describeAudit, SKILLS } from './pr-ownership.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const allowlisted = [...new Set(Object.values(ALLOWED).flat())]

// Every allowlisted path exists and says nothing, so a case's only findings are what it injected.
const fixture = (injected = {}, missing = []) => {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-pr-ownership-'))
  const blank = allowlisted.filter((file) => !missing.includes(file)).map((file) => [file, '# \n'])
  for (const [file, text] of [...blank, ...Object.entries(injected)]) {
    const target = path.join(root, SKILLS, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, text)
  }
  return root
}

check('the shipped bundle keeps the push and the pull request to their allowlisted files', () => {
  const audit = auditSkills(ROOT)
  assert.equal(describeAudit(audit), '')
  assert.ok(
    audit.files.includes('ship/SKILL.md'),
    'read the real skills directory rather than an empty one',
  )
})

check('a skill outside the allowlist that opens a pull request is named, with its line', () => {
  const root = fixture({ 'implement/SKILL.md': '# Implement\n\nThen `gh pr create --fill`.\n' })
  const { violations } = auditSkills(root)
  assert.deepEqual(violations, [{ command: 'gh pr create', file: 'implement/SKILL.md', line: 3 }])
  assert.match(describeAudit(auditSkills(root)), /skills\/implement\/SKILL\.md:3/)
  rmSync(root, { recursive: true, force: true })
})

check('a skill outside the allowlist that pushes is named too', () => {
  const root = fixture({ 'tdd/SKILL.md': '# TDD\n\nFinish with `git push -u origin HEAD`.\n' })
  const { violations } = auditSkills(root)
  assert.deepEqual(violations, [{ command: 'git push', file: 'tdd/SKILL.md', line: 3 }])
  rmSync(root, { recursive: true, force: true })
})

// The allowlist is per command: being exempt for the push buys no exemption for the PR.
check('a push exception may still not open a pull request', () => {
  const root = fixture({ 'design-to-code/SKILL.md': '# Step 6\n\n`gh pr create --base main`\n' })
  const { violations } = auditSkills(root)
  assert.deepEqual(violations, [
    { command: 'gh pr create', file: 'design-to-code/SKILL.md', line: 3 },
  ])
  rmSync(root, { recursive: true, force: true })
})

check('an allowlisted file naming the command it is allowed is not a finding', () => {
  const root = fixture({ 'pixel-review/PR-EVIDENCE.md': '# Evidence\n\n`git push --force`\n' })
  assert.equal(describeAudit(auditSkills(root)), '')
  rmSync(root, { recursive: true, force: true })
})

check('an allowlisted file that has been renamed away is reported as stale, not passed', () => {
  const root = fixture({}, ['ship/SKILL.md'])
  const { stale } = auditSkills(root)
  assert.deepEqual(
    stale.map(({ file }) => file),
    ['ship/SKILL.md', 'ship/SKILL.md'],
  )
  assert.match(describeAudit(auditSkills(root)), /allowlist names a missing ship\/SKILL\.md/)
  rmSync(root, { recursive: true, force: true })
})

report('pr ownership')
