import type { SessionDetails } from '../types'

export type SessionLocation = { path: string; base: string | null }

// The header's folder: the worktree, else the cwd; a base shows only when off the default branch.
export function sessionLocation(
  session: Pick<SessionDetails, 'cwd' | 'worktree'> | null,
  defaultBranch: string,
): SessionLocation | null {
  if (session === null) return null
  const { worktree } = session
  if (worktree === null) return session.cwd === null ? null : { path: session.cwd, base: null }
  return { path: worktree.path, base: worktree.base === defaultBranch ? null : worktree.base }
}
