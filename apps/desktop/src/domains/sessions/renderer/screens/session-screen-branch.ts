import type { WorktreeSummary } from '../composer/toolbar/use-worktree-choices'
import type { Session } from '../types'

// The branch the Session header names: the listed folder's current branch, else the branch stored
// with the Session's own worktree, which is never listed because no other Session may choose it.
export function sessionBranch(
  session: Pick<Session, 'cwd' | 'worktree'> | null,
  worktrees: readonly Pick<WorktreeSummary, 'path' | 'branch'>[],
): string | null {
  if (session === null) return null
  const folder = session.worktree?.path ?? session.cwd
  const listed = worktrees.find(({ path }) => path === folder)
  return listed === undefined ? (session.worktree?.branch ?? null) : listed.branch
}
