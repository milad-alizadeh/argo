import type { WorktreeCheckout } from '../composer'
import type { Session } from '../types'

export type SessionLocation = { path: string; base: string | null }

// Where the Session header says a Session works: its worktree, else its own folder. A worktree names
// its base branch only when that is not the main checkout's current branch.
export function sessionLocation(
  session: Pick<Session, 'cwd' | 'worktree'> | null,
  checkout: WorktreeCheckout | null,
): SessionLocation | null {
  if (session === null) return null
  const { worktree } = session
  if (worktree === null) return session.cwd === null ? null : { path: session.cwd, base: null }
  const named = checkout !== null && worktree.base !== null && worktree.base !== checkout.branch
  return { path: worktree.path, base: named ? worktree.base : null }
}
