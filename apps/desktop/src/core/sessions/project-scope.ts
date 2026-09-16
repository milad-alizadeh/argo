// Scoping one adapter's own rows to a Project, at that adapter's own discovery boundary (#2239):
// applied inside each CLI's `discoverSessions`, before its rows ever reach the shared reader, so a
// Project's reply is never a machine-wide list filtered down after the fact.
import { realpath } from 'node:fs/promises'

// A Project's root as registered and as the CLI records it: a CLI's cwd has symlinks resolved
// (macOS `/var` is `/private/var`). `null` means no Project is open, so nothing is filtered out.
export async function projectRootsOf(
  projectRoot: string | null | undefined,
): Promise<string[] | null> {
  if (projectRoot === null || projectRoot === undefined) return null
  const resolved = await realpath(projectRoot).catch(() => projectRoot)
  return resolved === projectRoot ? [projectRoot] : [projectRoot, resolved]
}

// A Session belongs to a Project when its cwd is the Project's root or a path under it (a
// worktree, a monorepo subfolder).
export function belongsToProject(cwd: string | null, roots: string[] | null): boolean {
  if (roots === null) return true
  if (cwd === null) return false
  return roots.some((root) => cwd === root || cwd.startsWith(`${root}/`))
}
