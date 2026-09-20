import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { trustSetupWorktree } from './trust-setup-worktree'

const run = promisify(execFile)
const SETUP_WORKTREE_DIRECTORY = ['.argo', 'worktrees']

export async function prepareSetupWorktree(
  project: { id: string; path: string },
  claudeConfigPath: string = path.join(os.homedir(), '.claude.json'),
): Promise<string> {
  const worktree = path.join(project.path, ...SETUP_WORKTREE_DIRECTORY, `setup-${project.id}`)
  await trustSetupWorktree(claudeConfigPath, worktree)
  if (await isWorktree(worktree)) return worktree
  await ignoreSetupWorktrees(project.path)
  await run('git', ['-C', project.path, 'fetch', 'origin'])
  const branch = await remoteDefaultBranch(project.path)
  await mkdir(path.dirname(worktree), { recursive: true })
  await run('git', [
    '-C',
    project.path,
    'worktree',
    'add',
    '-b',
    `argo/setup-${project.id}`,
    worktree,
    `origin/${branch}`,
  ])
  return worktree
}

async function isWorktree(directory: string): Promise<boolean> {
  if (!(await exists(directory))) return false
  try {
    const result = await run('git', ['-C', directory, 'rev-parse', '--is-inside-work-tree'])
    return result.stdout.trim() === 'true'
  } catch {
    return false
  }
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

async function ignoreSetupWorktrees(projectPath: string): Promise<void> {
  const result = await run('git', ['-C', projectPath, 'rev-parse', '--git-path', 'info/exclude'])
  const file = path.resolve(projectPath, result.stdout.trim())
  const current = await readFile(file, 'utf8').catch(() => '')
  const entry = '.argo/worktrees/'
  if (current.split('\n').includes(entry)) return
  await writeFile(file, `${current}${current.endsWith('\n') || !current ? '' : '\n'}${entry}\n`)
}

async function remoteDefaultBranch(projectPath: string): Promise<string> {
  const result = await run('git', ['-C', projectPath, 'ls-remote', '--symref', 'origin', 'HEAD'])
  const line = result.stdout.split('\n').find((value) => value.endsWith('\tHEAD'))
  const branch = /^ref:\s+refs\/heads\/([^\s]+)\s+HEAD$/.exec(line ?? '')?.[1]
  if (!branch) throw new Error('Argo could not resolve the remote default branch.')
  return branch
}
