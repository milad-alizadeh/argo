import type { BranchRef } from '@shared'
import { cn } from '@/lib/utils'
import {
  ArrowLineDownIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  GitBranchIcon,
  Text,
} from '@/shared/components/ui'
import type { BranchRow } from '../../branchMenuModel'

interface BranchMenuHandlers {
  /** Check this ref out. Only a `checkout` row can call it — the other three are refusals. */
  onCheckout: (ref: BranchRef) => void
  /** Open the live session working inside the worktree that holds a branch. */
  onOpenSession: (sessionId: string) => void
}

interface BranchMenuProps extends BranchMenuHandlers {
  /** Every ref the menu lists, each carrying the action the model already derived for it. */
  rows: BranchRow[]
}

/**
 * Organism: the branch select menu for the primary checkout.
 *
 * Its header says the files follow *this* checkout, which is what stops it being read as the
 * branch a session is on. Every refusal arrives pre-derived on the row; this file only renders
 * it, and a refused row is disabled with its reason beside the name rather than hidden.
 */
export function BranchMenu({
  rows,
  onCheckout,
  onOpenSession,
}: BranchMenuProps): React.JSX.Element {
  const groups = [
    { label: 'Local', rows: rows.filter((row) => !row.remote) },
    { label: 'Remote · origin', rows: rows.filter((row) => row.remote) },
  ].filter((group) => group.rows.length > 0)
  return (
    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuLabel>
        <Text variant="eyebrow">Files follow this</Text>
      </DropdownMenuLabel>
      {groups.map((group) => (
        <DropdownMenuGroup key={group.label}>
          <DropdownMenuLabel>
            <Text variant="eyebrow">{group.label}</Text>
          </DropdownMenuLabel>
          {group.rows.map((row) => (
            <BranchMenuRow key={row.name} row={row} {...{ onCheckout, onOpenSession }} />
          ))}
        </DropdownMenuGroup>
      ))}
    </DropdownMenuContent>
  )
}

function BranchMenuRow({
  row,
  onCheckout,
  onOpenSession,
}: BranchMenuHandlers & { row: BranchRow }): React.JSX.Element {
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
    default:
      return item
  }
}

function RowTrailing({ row }: { row: BranchRow }): React.JSX.Element {
  switch (row.action.kind) {
    case 'current':
      return (
        <>
          <Tracking row={row} />
          <CheckIcon role="img" aria-label="Checked out" className="icon-sm text-primary" />
        </>
      )
    case 'checkout':
      return (
        <>
          <Tracking row={row} />
          {row.remote && (
            <Text variant="meta" className="text-primary">
              Check out
            </Text>
          )}
        </>
      )
    case 'worktree-session':
      return <WorktreeWord />
    default:
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

function Tracking({ row }: { row: BranchRow }): React.JSX.Element {
  return (
    <>
      {row.ahead > 0 && <Text variant="meta" className="text-tone-run">{`↑${row.ahead}`}</Text>}
      {row.behind > 0 && <Text variant="meta" className="text-tone-amber">{`↓${row.behind}`}</Text>}
    </>
  )
}
