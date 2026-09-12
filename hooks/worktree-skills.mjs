import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { segments, tokenize, unexpanded } from './shell-commands.mjs'
import { gitArgs, parseWorktreeAdd } from './worktree-names.mjs'

const SKILL_DIRECTORIES = ['.agents/skills', '.claude/skills']

function primaryCheckout(cwd) {
  const commonDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd, encoding: 'utf8' },
  ).trim()
  return path.dirname(commonDirectory)
}

function worktreeAddDirectories(command) {
  const directories = []
  for (const segment of segments(command)) {
    const args = gitArgs(tokenize(segment))
    if (!args) continue
    const add = parseWorktreeAdd(args)
    if (add?.dir && !unexpanded(add.dir)) directories.push(add.dir)
  }
  return directories
}

/** Copy the primary checkout's installed skills after a successful worktree creation. */
export function copySkillsAfterWorktreeAdd({ toolName, toolInput = {}, cwd = process.cwd() }) {
  if (toolName !== 'Bash' || typeof toolInput.command !== 'string') return
  const primary = primaryCheckout(cwd)
  for (const directory of worktreeAddDirectories(toolInput.command)) {
    const worktree = path.resolve(cwd, directory)
    if (!existsSync(worktree)) continue
    for (const relative of SKILL_DIRECTORIES) {
      const source = path.join(primary, relative)
      const destination = path.join(worktree, relative)
      rmSync(destination, { recursive: true, force: true })
      if (!existsSync(source)) continue
      cpSync(source, destination, {
        recursive: true,
        preserveTimestamps: true,
        verbatimSymlinks: true,
      })
    }
  }
}
