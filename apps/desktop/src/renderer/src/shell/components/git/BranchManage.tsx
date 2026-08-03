import type { GitOperation } from '@shared'
import {
  ArrowLineDownIcon,
  ArrowLineUpIcon,
  ArrowsClockwiseIcon,
  DotsThreeIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  GitBranchIcon,
  type IconAtom,
  IconButton,
  PencilSimpleIcon,
  PlusIcon,
  Text,
  TrashIcon,
} from '@/shared/components/ui'
import type { ManageMenu } from '../../branchMenuModel'
import { ConflictHatch } from './ConflictHatch'

interface BranchManageProps {
  /** Which operations the menu may offer, derived by `manageMenu(facts)`. */
  menu: ManageMenu
  /** Run an operation on the primary checkout. */
  onOperation: (operation: GitOperation) => void
  /** The diverged branch's first escape hatch. */
  onOpenScratchTerminal: () => void
  /** The diverged branch's second escape hatch. */
  onResolveWithAgent: () => void
}

// Every operation the vocabulary has a row for. `checkout` is in the union but never in this
// menu — the branch list is where you check something out — so it is spelled here only to keep
// the record total, which is what makes a new operation a compile error.
const OPERATIONS: Record<GitOperation, { label: string; icon: IconAtom }> = {
  fetch: { label: 'Fetch', icon: ArrowsClockwiseIcon },
  pull: { label: 'Pull', icon: ArrowLineDownIcon },
  push: { label: 'Push', icon: ArrowLineUpIcon },
  'new-branch': { label: 'New branch', icon: PlusIcon },
  rename: { label: 'Rename', icon: PencilSimpleIcon },
  delete: { label: 'Delete', icon: TrashIcon },
  checkout: { label: 'Check out', icon: GitBranchIcon },
}

/**
 * Organism: the manage trigger and its menu — safe sync over branch CRUD.
 *
 * It offers only what cannot lose work: a fetch always, a pull only where it fast-forwards, a
 * push only where the remote will take it. There is no merge, no rebase, no force, and no
 * `Remove worktree` — a worktree may hold uncommitted work, and Argo does not destroy git state
 * it did not create. A diverged branch has no safe sync at all, so `ConflictHatch` takes the
 * whole group's place.
 */
export function BranchManage({
  menu,
  onOperation,
  onOpenScratchTerminal,
  onResolveWithAgent,
}: BranchManageProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label="Manage this branch"
          className="px-gap data-[state=open]:bg-accent-strong"
        >
          <DotsThreeIcon className="icon-sm" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {menu.diverged ? (
          <ConflictHatch
            onOpenScratchTerminal={onOpenScratchTerminal}
            onResolveWithAgent={onResolveWithAgent}
          />
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <Text variant="eyebrow">Sync with origin</Text>
            </DropdownMenuLabel>
            {menu.sync.map((operation) => (
              <OperationRow key={operation} operation={operation} onOperation={onOperation} />
            ))}
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Text variant="eyebrow">Branch</Text>
          </DropdownMenuLabel>
          {menu.branch.map((operation) => (
            <OperationRow key={operation} operation={operation} onOperation={onOperation} />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OperationRow({
  operation,
  onOperation,
}: {
  operation: GitOperation
  onOperation: (operation: GitOperation) => void
}): React.JSX.Element {
  const { label, icon: Glyph } = OPERATIONS[operation]
  return (
    <DropdownMenuItem
      variant={operation === 'delete' ? 'destructive' : 'default'}
      onSelect={() => onOperation(operation)}
    >
      <Glyph className="icon-sm text-foreground-faint" />
      <Text variant="row">{label}</Text>
    </DropdownMenuItem>
  )
}
