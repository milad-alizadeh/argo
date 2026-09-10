// Registration is the act that creates a Project, and a Project is a registered git repository
// (CONTEXT.md · Project). This is where a chosen folder is proved to be one.
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { promisify } from 'node:util'
import { isRecord, type ProjectErrorCode } from './contract'

const run = promisify(execFile)

export type RepositoryRoot = { root: string } | { failure: ProjectErrorCode }

// git decides what a git root is. Reimplementing the walk would have to answer worktrees, submodule
// links and `GIT_DIR`, and would answer them differently from the tool the rest of Argo drives.
export async function repositoryRoot(folder: string): Promise<RepositoryRoot> {
  let output: { stdout: string }
  try {
    output = await run('git', ['-C', folder, 'rev-parse', '--show-toplevel'])
  } catch (error) {
    return { failure: spawnFailure(error) }
  }
  const root = output.stdout.trim()
  if (!root) return { failure: 'not-a-repository' }
  try {
    // Two paths to one repository must land on one Project, so the stored path is the resolved
    // one. On macOS `/tmp` is a symlink to `/private/tmp`, which is the case that shows it.
    return { root: await realpath(root) }
  } catch {
    return { failure: 'project-unavailable' }
  }
}

function spawnFailure(error: unknown): ProjectErrorCode {
  if (!isRecord(error)) return 'internal-error'
  // A spawn failure carries a string code and is a fact about this computer. A non-zero exit
  // carries a numeric one and is a fact about the chosen folder.
  if (error.code === 'ENOENT') return 'git-unavailable'
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'access-denied'
  if (typeof error.code === 'number') return 'not-a-repository'
  return 'internal-error'
}
