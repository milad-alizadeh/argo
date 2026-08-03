import { branchMenuRows, type GitControlsProps, liveWorktreeSessions } from '@/shell/components'
import { useSessionStore } from './sessionStore'
import { useGitFacts } from './useGitFacts'

// The git group's props, assembled where the facts and the roster are both in reach: the menu's
// `↗` needs to know which live session is working in a worktree, and only the roster knows that.

/** The two escape hatches a diverged branch offers, plus the link out of a worktree row. Their
 * destinations are the shell's, not git's, so the container supplies them. */
export interface GitHatches {
  onOpenSession: (sessionId: string) => void
  onOpenScratchTerminal: () => void
  onResolveWithAgent: () => void
}

export function useGitGroup(hatches: GitHatches): GitControlsProps {
  const sessions = useSessionStore((state) => state.sessions)
  const activeProjectId = useSessionStore((state) => state.activeProjectId)
  const { facts, run } = useGitFacts(activeProjectId)

  return {
    facts,
    rows: facts === null ? [] : branchMenuRows(facts, liveWorktreeSessions(facts, sessions)),
    onCheckout: (ref) => void run('checkout', ref.name),
    onOperation: (operation, ref) => void run(operation, ref),
    onDelete: (ref) => void run('delete', ref.name),
    ...hatches,
  }
}
