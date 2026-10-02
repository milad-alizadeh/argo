import type { WorktreeCheckout } from '../composer'
import type { Session } from '../types'

// The branch the Session header names: its own worktree's branch, else the main checkout's current
// branch when it works there. Any other folder names no branch.
export function sessionBranch(
  session: Pick<Session, 'cwd' | 'worktree'> | null,
  checkout: WorktreeCheckout | null,
): string | null {
  if (session === null) return null
  if (session.worktree !== null) return session.worktree.branch
  return checkout !== null && session.cwd === checkout.path ? checkout.branch : null
}
