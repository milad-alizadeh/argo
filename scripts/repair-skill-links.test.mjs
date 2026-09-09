#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  repairSkillLinks,
  UNIVERSAL_SKILLS_DIR,
} from '../packages/argo-skills/bin/repair-skill-links.mjs'
import { check, report } from './check-harness.mjs'

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function installBrokenSkill(root, name = 'audit-agent-context') {
  const skill = path.join(root, UNIVERSAL_SKILLS_DIR, name)
  mkdirSync(skill, { recursive: true })
  writeFileSync(path.join(skill, 'SKILL.md'), '# Audit\n')
  symlinkSync(`../../${UNIVERSAL_SKILLS_DIR}/${name}`, path.join(skill, name))
  return skill
}

function makeLinkedWorktree() {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-skill-links-repo-'))
  const worktree = `${root}-worktree`
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  writeFileSync(path.join(root, '.gitignore'), '.agents/\n')
  git(root, 'add', '.gitignore')
  git(root, 'commit', '-qm', 'initial')
  git(root, 'worktree', 'add', '-qb', 'linked', worktree)
  return { root, worktree }
}

check('removes the broken self-link from a regular project', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-skill-links-'))
  const skill = installBrokenSkill(root)
  const nested = path.join(skill, 'audit-agent-context')

  assert.equal(lstatSync(nested).isSymbolicLink(), true)
  assert.equal(readlinkSync(nested), '../../.agents/skills/audit-agent-context')
  assert.deepEqual(repairSkillLinks(root), [
    '.agents/skills/audit-agent-context/audit-agent-context',
  ])
  assert.throws(() => lstatSync(nested), { code: 'ENOENT' })
  assert.equal(lstatSync(skill).isDirectory(), true)
  assert.deepEqual(repairSkillLinks(root), [], 'a second install cleanup is a no-op')
  rmSync(root, { recursive: true, force: true })
})

check('preserves a same-named symlink with a different target', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-skill-links-'))
  const skill = installBrokenSkill(root, 'shared')
  const nested = path.join(skill, 'shared')
  const payload = path.join(root, 'payload')
  // `unlinkSync`, never `rmSync`: `nested` is the self-link the repair exists to remove, so
  // resolving it is ELOOP. Node 23.5.0's `rmSync` follows before it unlinks and returns having
  // deleted nothing, and the `symlinkSync` below then fails EEXIST — a green test on 24.20.0 and
  // a red one here, for a reason that has nothing to do with what is under test.
  unlinkSync(nested)
  mkdirSync(payload)
  symlinkSync(payload, nested)

  assert.deepEqual(repairSkillLinks(root), [])
  assert.equal(lstatSync(nested).isSymbolicLink(), true)
  assert.equal(readlinkSync(nested), payload)
  rmSync(root, { recursive: true, force: true })
})

check('repairs a linked worktree without touching its main checkout', () => {
  const { root, worktree } = makeLinkedWorktree()
  const mainSkill = installBrokenSkill(root, 'main-only')
  const linkedSkill = installBrokenSkill(worktree)

  assert.match(
    readFileSync('packages/argo-skills/bin/scaffold.mjs', 'utf8'),
    /repairSkillLinks\(projectRoot\)/,
    'the scaffolder runs this repair after installing skills',
  )
  assert.equal(lstatSync(path.join(linkedSkill, 'audit-agent-context')).isSymbolicLink(), true)
  assert.deepEqual(repairSkillLinks(worktree), [
    '.agents/skills/audit-agent-context/audit-agent-context',
  ])
  assert.equal(existsSync(path.join(linkedSkill, 'audit-agent-context')), false)
  assert.equal(lstatSync(path.join(mainSkill, 'main-only')).isSymbolicLink(), true)
  git(root, 'worktree', 'remove', '--force', worktree)
  rmSync(root, { recursive: true, force: true })
})

report('skill-link repair')
