import type { BranchRef, GitFacts, GitOperation } from '@shared'
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/components/ui'
import { type BranchRow, manageMenu } from '../../branchMenuModel'
import { BranchManage } from './BranchManage'
import { BranchMenu } from './BranchMenu'
import { BranchSelector } from './BranchSelector'

export interface GitControlsProps {
  /** The primary checkout's facts, or `null` when the project folder is not a git repository. */
  facts: GitFacts | null
  /** The branch rows `branchMenuRows(facts, liveWorktrees)` derived for this checkout. */
  rows: BranchRow[]
  /** Check a ref out on the primary checkout. */
  onCheckout: (ref: BranchRef) => void
  /** Run a manage-menu operation on the primary checkout. `ref` carries the name for the
   * operations that take one (`new-branch`, `rename`, `delete`). */
  onOperation: (operation: GitOperation, ref?: string) => void
  /** Delete a local branch nobody is standing on. */
  onDelete: (ref: BranchRef) => void
  /** Open the live session working inside the worktree that holds a branch. */
  onOpenSession: (sessionId: string) => void
  /** Open a scratch terminal — the diverged branch's escape hatch. */
  onOpenScratchTerminal: () => void
  /** Hand a divergence to an agent — the diverged branch's other escape hatch. */
  onResolveWithAgent: () => void
}

/**
 * Organism: the global git group — `[⎇ branch ↑ahead ↓behind ▾] [manage]`.
 *
 * It is chrome, so it is present in all three rooms and always means the project's *primary*
 * checkout, never the branch a session is on. A project whose folder is not a git repository
 * renders nothing at all: an empty branch label would be a control claiming a checkout that
 * does not exist.
 */
export function GitControls({
  facts,
  rows,
  onCheckout,
  onOperation,
  onDelete,
  onOpenSession,
  onOpenScratchTerminal,
  onResolveWithAgent,
}: GitControlsProps): React.JSX.Element | null {
  if (facts === null) return null
  return (
    <div className="inset-lip flex items-stretch gap-hair rounded-lg bg-well p-hair">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <BranchSelector branch={facts.branch} ahead={facts.ahead} behind={facts.behind} />
        </DropdownMenuTrigger>
        <BranchMenu
          rows={rows}
          onCheckout={onCheckout}
          onOpenSession={onOpenSession}
          onDelete={onDelete}
        />
      </DropdownMenu>
      <BranchManage
        menu={manageMenu(facts)}
        onOperation={onOperation}
        onOpenScratchTerminal={onOpenScratchTerminal}
        onResolveWithAgent={onResolveWithAgent}
      />
    </div>
  )
}
