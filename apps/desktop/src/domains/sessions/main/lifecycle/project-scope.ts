// Scoping one adapter's own rows to a Project; `discover-roster.ts` is the one place it applies.
import { readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

async function pathForms(root: string): Promise<string[]> {
  const resolved = await realpath(root).catch(() => root)
  return resolved === root ? [root] : [root, resolved]
}

async function gitDirectory(projectRoot: string): Promise<string> {
  const dotGit = path.join(projectRoot, '.git')
  const pointer = await readFile(dotGit, 'utf8').catch(() => null)
  if (pointer === null) return dotGit
  const gitdir = pointer.match(/^gitdir:\s*(.+)\s*$/)?.[1]
  return gitdir === undefined ? dotGit : path.resolve(projectRoot, gitdir)
}

async function commonGitDirectory(projectRoot: string): Promise<string> {
  const git = await gitDirectory(projectRoot)
  const common = await readFile(path.join(git, 'commondir'), 'utf8').catch(() => null)
  return common === null ? git : path.resolve(git, common.trim())
}

async function linkedWorktreeRoots(projectRoot: string): Promise<string[]> {
  const common = await commonGitDirectory(projectRoot)
  const worktrees = path.join(common, 'worktrees')
  const names = await readdir(worktrees).catch(() => [])
  const roots = await Promise.all(
    names.map(async (name) => {
      const metadata = path.join(worktrees, name)
      const gitdir = await readFile(path.join(metadata, 'gitdir'), 'utf8').catch(() => null)
      return gitdir === null ? [] : pathForms(path.dirname(path.resolve(metadata, gitdir.trim())))
    }),
  )
  return roots.flat()
}

async function mainWorktreeRoots(projectRoot: string): Promise<string[]> {
  const common = await commonGitDirectory(projectRoot)
  return path.basename(common) === '.git' ? pathForms(path.dirname(common)) : []
}

// A Project's root as registered and as the CLI records it: a CLI's cwd has symlinks resolved
// (macOS `/var` is `/private/var`). `null` means no Project is open, so nothing is filtered out.
export async function projectRootsOf(
  projectRoot: string | null | undefined,
): Promise<string[] | null> {
  if (projectRoot === null || projectRoot === undefined) return null
  return [
    ...new Set([
      ...(await pathForms(projectRoot)),
      ...(await mainWorktreeRoots(projectRoot)),
      ...(await linkedWorktreeRoots(projectRoot)),
    ]),
  ]
}

// A Session belongs to a Project when its cwd is the Project's root or a path under it (a
// worktree, a monorepo subfolder).
export function belongsToProject(cwd: string | null, roots: string[] | null): boolean {
  if (roots === null) return true
  if (cwd === null) return false
  return roots.some((root) => cwd === root || cwd.startsWith(`${root}/`))
}
