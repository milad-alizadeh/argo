import type { BranchRef } from '@shared'
import { cn } from '@/lib/utils'
import {
  ArrowLineDownIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  DropdownMenuItem,
  GitBranchIcon,
  Text,
  TrashIcon,
} from '@/shared/components/ui'
import { type BranchRow, isDeletable } from '../../branchMenuModel'
import { TrackingCounts } from './TrackingCounts'

export interface BranchRowHandlers {
  /** Check this ref out. Only a `checkout` row can call it — the other three are refusals. */
  onCheckout: (ref: BranchRef) => void
  /** Open the live session working inside the worktree that holds a branch. */
  onOpenSession: (sessionId: string) => void
  /** Delete a local branch nobody is standing on. */
  onDelete: (ref: BranchRef) => void
}

/**
 * Molecule: one ref in the branch menu, rendered from the action the model already derived.
 *
 * Every refusal arrives pre-derived on the row, so this file decides nothing: a refused row is
 * disabled with its reason stated beside the name rather than hidden, because a control that
 * vanishes teaches nothing about why.
 */
export function BranchMenuRow({
  row,
  onCheckout,
  onOpenSession,
  onDelete,
}: BranchRowHandlers & { row: BranchRow }): React.JSX.Element {
  // Only `checkout` acts, so a kind this file has not met is refused — the safe direction.
  const refused = row.action.kind !== 'checkout'
  const current = row.action.kind === 'current'
  const Glyph = row.remote ? ArrowLineDownIcon : GitBranchIcon
  const item = (
    <DropdownMenuItem
      disabled={refused}
      onSelect={refused ? undefined : () => onCheckout(row)}
      // Inert, not refused: dimming the branch the files follow would read as the broken row.
      className={cn('min-w-0 flex-1', current && 'bg-accent-strong data-disabled:opacity-100')}
    >
      <Glyph className={cn('icon-sm', current ? 'text-primary' : 'text-foreground-faint')} />
      <Text variant="code" className="min-w-0 flex-1 truncate text-foreground">
        {row.name}
      </Text>
      <RowTrailing row={row} />
    </DropdownMenuItem>
  )
  switch (row.action.kind) {
    case 'worktree-session': {
      const { sessionId } = row.action
      return (
        <div className="flex items-center">
          {item}
          <DropdownMenuItem
            aria-label={`Open the session working in ${row.name}`}
            onSelect={() => onOpenSession(sessionId)}
          >
            <ArrowSquareOutIcon className="icon-sm text-primary" />
          </DropdownMenuItem>
        </div>
      )
    }
    case 'checkout':
      if (!isDeletable(row)) return item
      return (
        <div className="flex items-center">
          {item}
          <DropdownMenuItem
            variant="destructive"
            aria-label={`Delete ${row.name}`}
            onSelect={() => onDelete(row)}
          >
            <TrashIcon className="icon-sm" />
          </DropdownMenuItem>
        </div>
      )
    case 'current':
    case 'worktree-orphaned':
      return item
  }
}

function RowTrailing({ row }: { row: BranchRow }): React.JSX.Element {
  switch (row.action.kind) {
    case 'current':
      return (
        <>
          <TrackingCounts ahead={row.ahead} behind={row.behind} />
          <CheckIcon role="img" aria-label="Checked out" className="icon-sm text-primary" />
        </>
      )
    case 'checkout':
      return (
        <>
          <TrackingCounts ahead={row.ahead} behind={row.behind} />
          {row.remote && (
            <Text variant="meta" className="text-primary">
              Check out
            </Text>
          )}
        </>
      )
    case 'worktree-session':
      return <WorktreeWord />
    case 'worktree-orphaned':
      return (
        <>
          <WorktreeWord />
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-faint">
            {row.action.path}
          </Text>
        </>
      )
  }
}

// Plain ink: a tone here would claim a worktree state (live, stale) this row cannot know.
function WorktreeWord(): React.JSX.Element {
  return (
    <Text variant="tag" className="text-foreground-soft">
      worktree
    </Text>
  )
}
