// The one reader of a Project's `.git` layout: the common git directory, the main worktree, and
// every linked one with its branch.
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

// Every linked worktree's root and branch (null when detached), from `<common>/worktrees/<name>/`.
// Unresolved: callers settle symlinks (macOS `/tmp` vs `/private/tmp`) themselves.
export async function linkedWorktrees(
  commonDirectory: string,
): Promise<{ path: string; branch: string | null }[]> {
  const worktrees = path.join(commonDirectory, 'worktrees')
  const names = await readdir(worktrees).catch(() => [])
  const found = await Promise.all(
    names.map(async (name) => {
      const [gitdir, head] = await Promise.all(
        ['gitdir', 'HEAD'].map((file) =>
          readFile(path.join(worktrees, name, file), 'utf8').catch(() => null),
        ),
      )
      if (gitdir === null || gitdir === undefined) return null
      const branch = head?.match(/^ref: refs\/heads\/(.+)\s*$/)?.[1] ?? null
      return { path: path.dirname(path.resolve(worktrees, name, gitdir.trim())), branch }
    }),
  )
  return found.filter((worktree) => worktree !== null)
}

// The branch `origin/HEAD` names, or null without one. `git pack-refs` never packs a symbolic ref.
export async function remoteDefaultBranch(commonDirectory: string): Promise<string | null> {
  const head = await readFile(
    path.join(commonDirectory, 'refs', 'remotes', 'origin', 'HEAD'),
    'utf8',
  ).catch(() => null)
  return head?.match(/^ref: refs\/remotes\/origin\/(.+?)\s*$/)?.[1] ?? null
}
