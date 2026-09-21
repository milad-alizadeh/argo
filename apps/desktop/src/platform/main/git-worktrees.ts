// The one reader of a Project's `.git` layout: the common git directory, and the raw paths of the
// main worktree and every linked one. Session scoping (project-scope.ts) and Workspace discovery
// both build on this rather than each walking `.git` and `worktrees/*/gitdir` by hand.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

async function gitDirectory(root: string): Promise<string> {
  const dotGit = path.join(root, '.git')
  const pointer = await readFile(dotGit, 'utf8').catch(() => null)
  if (pointer === null) return dotGit
  const gitdir = pointer.match(/^gitdir:\s*(.+)\s*$/)?.[1]
  return gitdir === undefined ? dotGit : path.resolve(root, gitdir)
}

export async function gitCommonDirectory(root: string): Promise<string> {
  const git = await gitDirectory(root)
  const common = await readFile(path.join(git, 'commondir'), 'utf8').catch(() => null)
  return common === null ? git : path.resolve(git, common.trim())
}

// `null` when the common directory is not itself a main worktree's `.git` (a bare repository).
export function mainWorktreePath(commonDirectory: string): string | null {
  return path.basename(commonDirectory) === '.git' ? path.dirname(commonDirectory) : null
}

// Every linked worktree's root, read from `<common>/worktrees/<name>/gitdir`. Unresolved: callers
// that need symlinks settled (macOS `/tmp` vs `/private/tmp`) resolve them themselves.
export async function linkedWorktreePaths(commonDirectory: string): Promise<string[]> {
  const worktrees = path.join(commonDirectory, 'worktrees')
  const names = await readdir(worktrees).catch(() => [])
  const roots = await Promise.all(
    names.map(async (name) => {
      const gitdir = await readFile(path.join(worktrees, name, 'gitdir'), 'utf8').catch(() => null)
      return gitdir === null ? null : path.dirname(path.resolve(worktrees, name, gitdir.trim()))
    }),
  )
  return roots.filter((root) => root !== null)
}
