import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

// A git checkout with one empty commit on main, ready for worktrees or reconciliation.
export async function initFixtureRepo(root: string): Promise<{ project: string }> {
  const project = path.join(root, 'project')
  await run('git', ['init', '--quiet', '--initial-branch=main', project])
  await run('git', [
    '-C',
    project,
    '-c',
    'user.email=argo@example.test',
    '-c',
    'user.name=Argo',
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'fixture',
  ])
  return { project }
}

// Reconciliation compares discovered roots by their real path (macOS's tmpdir is a symlink), so
// every fixture path is resolved the same way its callers will see it back from git.
export async function workspaceRepoFixture(context: {
  after: (callback: () => Promise<void>) => void
}): Promise<{ project: string }> {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-workspace-repo-')))
  context.after(() => rm(root, { recursive: true, force: true }))
  return initFixtureRepo(root)
}

// Adds a linked worktree checked out onto a new branch, and returns its path.
export async function addLinkedWorktree(project: string, branch = 'feature'): Promise<string> {
  const linked = path.join(path.dirname(project), 'linked')
  await run('git', ['-C', project, 'worktree', 'add', '-b', branch, linked, 'main'])
  return linked
}
