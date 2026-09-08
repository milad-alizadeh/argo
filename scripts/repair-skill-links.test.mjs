#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { repairSkillLinks } from '../packages/argo-skills/bin/repair-skill-links.mjs'
import { check, report } from './check-harness.mjs'

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function installBrokenSkill(root, name = 'audit-agent-context') {
  const skill = path.join(root, '.agents/skills', name)
  mkdirSync(skill, { recursive: true })
  writeFileSync(path.join(skill, 'SKILL.md'), '# Audit\n')
  symlinkSync(`../../.agents/skills/${name}`, path.join(skill, name))
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

  assert.equal(existsSync(nested), false, 'the upstream relative target is broken')
  assert.deepEqual(repairSkillLinks(root), [
    '.agents/skills/audit-agent-context/audit-agent-context',
  ])
  assert.equal(existsSync(nested), false)
  assert.equal(lstatSync(skill).isDirectory(), true)
  assert.deepEqual(repairSkillLinks(root), [], 'a second install cleanup is a no-op')
  rmSync(root, { recursive: true, force: true })
})

check('repairs a linked worktree without touching its main checkout', () => {
  const { root, worktree } = makeLinkedWorktree()
  const mainSkill = installBrokenSkill(root, 'main-only')
  const linkedSkill = installBrokenSkill(worktree)

  assert.deepEqual(repairSkillLinks(worktree), [
    '.agents/skills/audit-agent-context/audit-agent-context',
  ])
  assert.equal(existsSync(path.join(linkedSkill, 'audit-agent-context')), false)
  assert.equal(lstatSync(path.join(mainSkill, 'main-only')).isSymbolicLink(), true)
  git(root, 'worktree', 'remove', '--force', worktree)
  rmSync(root, { recursive: true, force: true })
})

report('skill-link repair')
