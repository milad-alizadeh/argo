import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeSkillFiles } from './claude-skill-files'

let root: string

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-skills-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function skill(directory: string, name: string): string {
  const file = path.join(directory, '.claude', 'skills', name, 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `# ${name}\n`)
  return file
}

test('finds a skill in the personal folder before the project, then the repo root before a nested folder', () => {
  const home = path.join(root, 'home')
  const repository = path.join(root, 'repo')
  const nested = path.join(repository, 'apps', 'desktop')
  mkdirSync(path.join(repository, '.git'), { recursive: true })
  mkdirSync(nested, { recursive: true })
  const personal = skill(home, 'deploy')
  skill(repository, 'deploy')
  const rootReview = skill(repository, 'code-review')
  skill(nested, 'code-review')
  const nestedOnly = skill(nested, 'tdd')

  const skillFile = claudeSkillFiles(nested, home)

  expect(skillFile('deploy')).toBe(personal)
  expect(skillFile('code-review')).toBe(rootReview)
  expect(skillFile('tdd')).toBe(nestedOnly)
  expect(skillFile('clear')).toBeNull()
})

test('reads no folder above the repo root, and no name that leaves the skills folder', () => {
  const repository = path.join(root, 'repo')
  mkdirSync(path.join(repository, '.git'), { recursive: true })
  skill(root, 'outside')
  skill(root, 'escape')

  const skillFile = claudeSkillFiles(repository, path.join(root, 'home'))

  expect(skillFile('outside')).toBeNull()
  expect(skillFile('../../../escape')).toBeNull()
  expect(skillFile('plugin:skill')).toBeNull()
  expect(claudeSkillFiles(null, path.join(root, 'home'))('outside')).toBeNull()
})
