// A Project with a real commit on `main`, so a discovered Workspace's live git facts are readable
// (a bare `git init` has no HEAD to report). Reuses the packaged app copy and launch helper every
// packaged Project proof shares (#2326).
import { execFile } from 'node:child_process'
import { mkdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { seedSingleProject } from '../../projects/fixtures/project.fixture'

const run = promisify(execFile)

export { launch } from '../../projects/fixtures/project.fixture'

export async function prepare(root: string, application: string) {
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
  await mkdir(userData, { recursive: true })
  await mkdir(projectPath, { recursive: true })
  await run('git', ['init', '--quiet', '--initial-branch=main', projectPath])
  await run('git', [
    '-C',
    projectPath,
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
  // Reconciliation compares discovered worktree roots by real path (macOS's tmpdir is a symlink);
  // the fixture resolves the Project's own path the same way so a listed Workspace's path matches.
  const realProjectPath = await realpath(projectPath)
  // Unselected: the real Cockpit never mounts a Session screen for this Project, so its own AC5
  // Workspace auto-selection never fires and races the direct IPC calls these tests make.
  seedSingleProject(userData, { id: 'project-1', path: realProjectPath, selectedId: null }).close()
  return { application, userData, projectPath: realProjectPath }
}

export async function addLinkedWorktree(projectPath: string, worktreePath: string, branch: string) {
  await run('git', ['-C', projectPath, 'worktree', 'add', '-b', branch, worktreePath, 'main'])
  return realpath(worktreePath)
}
