import {
  type BranchRef,
  containsPath,
  type GitFacts,
  type GitOperation,
  type SessionView,
} from '@shared'

// What the global git group offers for the primary checkout, derived from git's own facts.
// Two refusals are the point of this file: a branch a worktree holds is never offered for
// checkout (git refuses it anyway, and predicting that is the only honest thing a menu can
// do), and a diverged branch is offered no sync at all — Argo ships no merge-conflict
// editor, so it hands the conflict off rather than starting one it cannot finish.

/** What clicking a branch row does, or why it does nothing. */
export type BranchRowAction =
  | { kind: 'current' }
  | { kind: 'checkout' }
  | { kind: 'worktree-session'; sessionId: string }
  | { kind: 'worktree-orphaned'; path: string }

export interface BranchRow extends BranchRef {
  action: BranchRowAction
}

export interface ManageMenu {
  /** Sync operations that cannot lose work, in the order the menu lists them. */
  sync: GitOperation[]
  branch: GitOperation[]
  /** Ahead *and* behind: the branch cannot sync safely, so the hatch replaces the sync. */
  diverged: boolean
}

/** The label a worktree row shows in place of a checkout, keyed by which live session (if
 * any) is working in it. `liveWorktrees` maps a worktree path to that session's id. */
export function branchMenuRows(facts: GitFacts, liveWorktrees: Map<string, string>): BranchRow[] {
  return facts.branches.map((ref) => ({ ...ref, action: rowAction(facts, ref, liveWorktrees) }))
}

/** Which worktree each session in the roster is working in, keyed by the worktree's path.
 * The label follows git and the link follows the session: a worktree the roster has no
 * session for has outlived it, and gets its path rather than a dead link. */
export function liveWorktreeSessions(
  facts: GitFacts,
  sessions: SessionView[],
): Map<string, string> {
  const paths = facts.branches.flatMap((ref) =>
    ref.worktreePath === null ? [] : [ref.worktreePath],
  )
  return new Map(
    paths.flatMap((path) => {
      const session = sessions.find((s) => s.cwd !== null && containsPath(path, s.cwd))
      return session ? [[path, session.id] as const] : []
    }),
  )
}

export function manageMenu(facts: GitFacts): ManageMenu {
  const diverged = facts.ahead > 0 && facts.behind > 0
  return {
    sync: [
      'fetch' as const,
      ...(facts.behind > 0 && !diverged ? (['pull'] as const) : []),
      ...(facts.ahead > 0 && !diverged ? (['push'] as const) : []),
    ],
    branch: ['new-branch', 'rename', 'delete'],
    diverged,
  }
}

function rowAction(
  facts: GitFacts,
  ref: BranchRef,
  liveWorktrees: Map<string, string>,
): BranchRowAction {
  if (ref.worktreePath === null) {
    return ref.name === facts.branch && !ref.remote ? { kind: 'current' } : { kind: 'checkout' }
  }
  const sessionId = liveWorktrees.get(ref.worktreePath)
  if (sessionId === undefined) return { kind: 'worktree-orphaned', path: ref.worktreePath }
  return { kind: 'worktree-session', sessionId }
}
