import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readCodexSkillCommands } from './codex-skill-commands'

let root: string

function skill(folder: string, name: string, description: string) {
  const file = path.join(folder, name, 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n# Body\n`)
}

test('lists a user skill ahead of a project skill, and a repo skill ahead of a nested one', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-skills-'))
  const home = path.join(root, 'codex-home')
  const repository = path.join(root, 'repo')
  const nested = path.join(repository, 'apps')
  mkdirSync(path.join(repository, '.git'), { recursive: true })
  skill(path.join(home, 'skills'), 'implement', 'Build an approved ticket')
  skill(path.join(repository, '.agents', 'skills'), 'implement', 'Project copy')
  skill(path.join(repository, '.agents', 'skills'), 'review', 'Read the diff')
  skill(path.join(nested, '.agents', 'skills'), 'review', 'Nested copy')
  skill(path.join(nested, '.agents', 'skills'), 'tdd', 'Red then green')
  mkdirSync(path.join(home, 'skills', '.system'))
  const rejected: string[] = []

  const commands = await readCodexSkillCommands({
    cwd: nested,
    codexHome: home,
    reject: (shape) => rejected.push(shape),
  })

  expect(commands.map((command) => [command.name, command.description])).toEqual([
    ['implement', 'Build an approved ticket'],
    ['review', 'Read the diff'],
    ['tdd', 'Red then green'],
  ])
  expect(commands.every((command) => command.argumentHint === '')).toBe(true)
  expect(rejected).toEqual([])
  expect(JSON.stringify(commands)).not.toContain('SKILL.md')
})

test('counts a skill directory whose name is not a command', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-skills-'))
  const home = path.join(root, 'codex-home')
  mkdirSync(path.join(home, 'skills', 'has space'), { recursive: true })
  const rejected: string[] = []
  const commands = await readCodexSkillCommands({
    cwd: null,
    codexHome: home,
    reject: (shape) => rejected.push(shape),
  })
  expect(commands).toEqual([])
  expect(rejected).toEqual(['codex-skill'])
})

test('follows a skill directory that is a symlink', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-skills-'))
  const home = path.join(root, 'codex-home')
  const real = path.join(root, 'real-implement')
  skill(root, 'real-implement', 'Build an approved ticket')
  mkdirSync(path.join(home, 'skills'), { recursive: true })
  symlinkSync(real, path.join(home, 'skills', 'implement'))
  const commands = await readCodexSkillCommands({ cwd: null, codexHome: home })
  expect(commands.map((command) => command.name)).toEqual(['implement'])
  expect(commands[0]?.description).toBe('Build an approved ticket')
})

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})
