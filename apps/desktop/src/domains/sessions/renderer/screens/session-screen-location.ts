import type { WorktreeCheckout } from '../composer'
import type { Session } from '../types'

export type SessionLocation = { path: string; base: string | null }

// The header's folder: the worktree, else the cwd; a base shows only when off the checkout's branch.
export function sessionLocation(
  session: Pick<Session, 'cwd' | 'worktree'> | null,
  checkout: WorktreeCheckout | null,
): SessionLocation | null {
  if (session === null) return null
  const { worktree } = session
  if (worktree === null) return session.cwd === null ? null : { path: session.cwd, base: null }
  const named = checkout !== null && worktree.base !== checkout.branch
  return { path: worktree.path, base: named ? worktree.base : null }
}
