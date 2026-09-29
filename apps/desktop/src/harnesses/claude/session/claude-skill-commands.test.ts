import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { skillLabels, writeSkillMarkdown } from '@/harnesses/skill-directory-fixtures'
import { readClaudeSkillCommands } from './claude-skill-commands'

let root: string

test('lists a user skill ahead of a project skill', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-skills-'))
  const home = path.join(root, 'claude-config')
  const repository = path.join(root, 'repo')
  mkdirSync(path.join(repository, '.git'), { recursive: true })
  writeSkillMarkdown(path.join(home, 'skills'), 'implement', 'Build an approved ticket')
  writeSkillMarkdown(path.join(repository, '.claude', 'skills'), 'implement', 'Project copy')
  writeSkillMarkdown(path.join(repository, '.claude', 'skills'), 'review', 'Read the diff')
  const rejected: string[] = []

  const commands = await readClaudeSkillCommands({
    cwd: repository,
    configDir: home,
    reject: (shape) => rejected.push(shape),
  })

  expect(skillLabels(commands)).toEqual([
    ['implement', 'Build an approved ticket'],
    ['review', 'Read the diff'],
  ])
  expect(rejected).toEqual([])
  expect(JSON.stringify(commands)).not.toContain('SKILL.md')
})

test('reads a folded description instead of the block marker', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-skills-'))
  const home = path.join(root, 'claude-config')
  const file = path.join(home, 'skills', 'simple-english', 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, '---\nname: simple-english\ndescription: |\n  Plain sentences.\n---\n')
  const commands = await readClaudeSkillCommands({ cwd: null, configDir: home })
  expect(commands.map((command) => command.description)).toEqual(['Plain sentences.'])
})

test('a linked worktree also lists skills from the main checkout', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-skills-'))
  const main = path.join(root, 'main')
  const worktree = path.join(root, 'worktree')
  const gitdir = path.join(main, '.git', 'worktrees', 'ticket')
  mkdirSync(gitdir, { recursive: true })
  mkdirSync(worktree, { recursive: true })
  writeFileSync(path.join(worktree, '.git'), `gitdir: ${gitdir}\n`)
  writeSkillMarkdown(path.join(main, '.claude', 'skills'), 'implement', 'Build an approved ticket')
  const commands = await readClaudeSkillCommands({
    cwd: worktree,
    configDir: path.join(root, 'home'),
  })
  expect(commands.map((command) => command.name)).toEqual(['implement'])
})

test('a missing skill folder is an empty list', async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-skills-'))
  const commands = await readClaudeSkillCommands({
    cwd: null,
    configDir: path.join(root, 'missing'),
  })
  expect(commands).toEqual([])
})

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})
