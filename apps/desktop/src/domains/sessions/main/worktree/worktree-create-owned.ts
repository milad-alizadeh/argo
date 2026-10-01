import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectSelectSchema } from '@/database/project/validation'
import { gitCommonDirectory } from '@/platform/main/git-worktrees'
import { readWorktreeBranch } from './worktree-branch'

const run = promisify(execFile)

function hasCode(error: unknown, code: string | number): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

function branchExists(projectPath: string, branch: string): Promise<boolean> {
  return run('git', [
    '-C',
    projectPath,
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ]).then(
    () => true,
    (error: unknown) => {
      if (hasCode(error, 1)) return false
      throw error
    },
  )
}

async function ensureWorktreeOnDisk(input: {
  projectRoot: { path: string; commonDirectory: string }
  worktreePath: string
  branch: string
}): Promise<void> {
  const { projectRoot, worktreePath, branch } = input
  const present = await stat(worktreePath).then(
    () => true,
    (error: unknown) => {
      if (hasCode(error, 'ENOENT')) return false
      throw error
    },
  )
  if (present) {
    const common = await realpath(await gitCommonDirectory(worktreePath))
    if (common !== projectRoot.commonDirectory || (await readWorktreeBranch(worktreePath)) !== branch)
      throw new Error('worktree-path-conflict')
    return
  }
  await mkdir(path.dirname(worktreePath), { recursive: true })
  const arguments_ = (await branchExists(projectRoot.path, branch))
    ? ['-C', projectRoot.path, 'worktree', 'add', worktreePath, branch]
    : ['-C', projectRoot.path, 'worktree', 'add', '-b', branch, worktreePath]
  await run('git', arguments_, { timeout: 120_000 })
}

// The worktree Argo makes for a new Session draft. A second Send of the same draft reuses it.
export async function createOwnedWorktree(input: {
  database: Database
  projectId: string
  draftId: string
  worktreeRoot: string
}): Promise<{ path: string; branch: string }> {
  const registered = projectSelectSchema.safeParse(
    input.database
      .select({ id: project.id, path: project.path, commonDirectory: project.commonDirectory })
      .from(project)
      .where(eq(project.id, input.projectId))
      .get(),
  )
  if (!registered.success) throw new Error('missing-project')
  const key = createHash('sha256').update(`${input.projectId}:${input.draftId}`).digest('hex')
  const worktreePath = path.join(input.worktreeRoot, key)
  const branch = `argo/session-${key.slice(0, 12)}`
  await ensureWorktreeOnDisk({ projectRoot: registered.data, worktreePath, branch })
  return { path: worktreePath, branch }
}
