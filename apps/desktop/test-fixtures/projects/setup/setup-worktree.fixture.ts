import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export async function setupWorktreeFixture(context: {
  after: (callback: () => Promise<void>) => void
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-setup-worktree-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const remote = path.join(root, 'remote.git')
  const project = path.join(root, 'project')
  await run('git', ['init', '--bare', '--quiet', remote])
  await run('git', ['init', '--quiet', '--initial-branch=main', project])
  await writeFile(path.join(project, 'README.md'), 'fixture\n')
  await run('git', ['-C', project, 'add', 'README.md'])
  await run('git', [
    '-C',
    project,
    '-c',
    'user.email=argo@example.test',
    '-c',
    'user.name=Argo',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ])
  await run('git', ['-C', project, 'remote', 'add', 'origin', remote])
  await run('git', ['-C', project, 'push', '--quiet', '-u', 'origin', 'main'])
  await run('git', ['-C', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main'])
  return { project, claudeConfigPath: path.join(root, 'claude.json') }
}
