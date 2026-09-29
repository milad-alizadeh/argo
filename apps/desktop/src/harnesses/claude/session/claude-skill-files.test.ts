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

function plugin(home: string, key: string, name: string): string {
  const installPath = path.join(home, 'plugin-cache', key)
  const file = path.join(installPath, 'skills', name, 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `# ${name}\n`)
  const record = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  mkdirSync(path.dirname(record), { recursive: true })
  writeFileSync(
    record,
    JSON.stringify({
      version: 2,
      plugins: { [`${key}@marketplace`]: [{ scope: 'user', installPath }] },
    }),
  )
  return file
}

test('expands a plugin skill invoked as plugin:skill', () => {
  const home = path.join(root, 'home')
  const document = plugin(home, 'anthropic-skills', 'docx')

  const skillFile = claudeSkillFiles(null, home)

  expect(skillFile('anthropic-skills:docx')).toBe(document)
  expect(skillFile('anthropic-skills:missing')).toBeNull()
  expect(skillFile('other-plugin:docx')).toBeNull()
})

test('rejects an installed-plugins record it cannot read', () => {
  const home = path.join(root, 'home')
  const record = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  mkdirSync(path.dirname(record), { recursive: true })
  writeFileSync(record, '{"plugins":"not a map"}')

  expect(claudeSkillFiles(null, home)('anthropic-skills:docx')).toBeNull()
})

test('skips one unreadable install and keeps the plugin skills the rest name', () => {
  const home = path.join(root, 'home')
  const document = plugin(home, 'anthropic-skills', 'docx')
  const record = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  writeFileSync(
    record,
    JSON.stringify({
      version: 2,
      plugins: {
        'anthropic-skills@marketplace': [
          { scope: 'user' },
          { scope: 'user', installPath: path.dirname(path.dirname(path.dirname(document))) },
        ],
      },
    }),
  )
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (message: unknown) => warnings.push(message)
  try {
    expect(claudeSkillFiles(null, home)('anthropic-skills:docx')).toBe(document)
  } finally {
    console.warn = warn
  }

  expect(warnings).toEqual(['Skipped 1 unrecognised installed-plugins record(s).'])
})
