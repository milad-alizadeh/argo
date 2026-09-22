// Scoping one adapter's own rows to a Project; `discover-roster.ts` is the one place it applies.
import { realpath } from 'node:fs/promises'
import {
  gitCommonDirectory,
  linkedWorktreePaths,
  mainWorktreePath,
} from '@/platform/main/git-worktrees'

async function pathForms(root: string): Promise<string[]> {
  const resolved = await realpath(root).catch(() => root)
  return resolved === root ? [root] : [root, resolved]
}

async function linkedWorktreeRoots(projectRoot: string): Promise<string[]> {
  const common = await gitCommonDirectory(projectRoot)
  const roots = await Promise.all((await linkedWorktreePaths(common)).map(pathForms))
  return roots.flat()
}

async function mainWorktreeRoots(projectRoot: string): Promise<string[]> {
  const common = await gitCommonDirectory(projectRoot)
  const main = mainWorktreePath(common)
  return main === null ? [] : pathForms(main)
}

// A Project's root as registered and as the Harness records it: a Harness's cwd has symlinks resolved
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
