import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const SETUP_WORKTREE_DIRECTORY = ['.argo', 'worktrees']

// `claude` shows an interactive trust dialog the first time it launches in a directory, and a
// disposable setup worktree is always new. No human watches this launch to click through it, so
// mark the directory trusted the same way accepting that dialog would.
async function trustSetupWorktree(configPath: string, directory: string): Promise<void> {
  const raw = await readFile(configPath, 'utf8').catch(() => '{}')
  const config: { projects?: Record<string, { hasTrustDialogAccepted?: boolean }> } =
    JSON.parse(raw)
  config.projects ??= {}
  if (config.projects[directory]?.hasTrustDialogAccepted) return
  config.projects[directory] = { ...config.projects[directory], hasTrustDialogAccepted: true }
  await writeFile(configPath, JSON.stringify(config, null, 2))
}

export async function prepareSetupWorktree(
  project: { id: string; path: string },
  claudeConfigPath: string = path.join(os.homedir(), '.claude.json'),
): Promise<string> {
  const worktree = path.join(project.path, ...SETUP_WORKTREE_DIRECTORY, `setup-${project.id}`)
  await trustSetupWorktree(claudeConfigPath, worktree)
  if (await isWorktree(worktree)) return worktree
  await ignoreSetupWorktrees(project.path)
  await run('git', ['-C', project.path, 'fetch', 'origin'])
  await mkdir(path.dirname(worktree), { recursive: true })
  const branch = `argo/setup-${project.id}`
  if (await localBranchExists(project.path, branch)) {
    await run('git', ['-C', project.path, 'worktree', 'add', worktree, branch])
  } else {
    const defaultBranch = await remoteDefaultBranch(project.path)
    await run('git', [
      '-C',
      project.path,
      'worktree',
      'add',
      '-b',
      branch,
      worktree,
      `origin/${defaultBranch}`,
    ])
  }
  return worktree
}

export async function reconcileSetupWorktree(
  project: { id: string; path: string },
  worktreePath: string,
): Promise<{ kind: 'current' } | { kind: 'drifted'; reason: 'application-drift' }> {
  const expectedPath = path.join(project.path, ...SETUP_WORKTREE_DIRECTORY, `setup-${project.id}`)
  if (path.resolve(worktreePath) !== path.resolve(expectedPath))
    return {
      kind: 'drifted',
      reason: 'application-drift',
    }
  if (!(await isWorktree(worktreePath))) return { kind: 'drifted', reason: 'application-drift' }
  return { kind: 'current' }
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

async function localBranchExists(projectPath: string, branch: string): Promise<boolean> {
  try {
    await run('git', ['-C', projectPath, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`])
    return true
  } catch {
    return false
  }
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
