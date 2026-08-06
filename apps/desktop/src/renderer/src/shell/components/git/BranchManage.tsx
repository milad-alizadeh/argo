import type { GitOperation } from '@shared'
import { useState } from 'react'
import {
  DotsThreeIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Text,
} from '@/shared/components/ui'
import type { ManageMenu } from '../../git/branchMenuModel'
import { BranchNameField } from './BranchNameField'
import { OperationRow } from './BranchOperationRow'
import { ConflictHatch } from './ConflictHatch'

// The two operations that cannot run without a name. Selecting one opens the name field instead
// of dispatching, because dispatching without a name is an operation that can only fail.
const NEEDS_NAME: Record<string, { title: string; submitLabel: string } | undefined> = {
  'new-branch': { title: 'New branch', submitLabel: 'Create' },
  rename: { title: 'Rename branch', submitLabel: 'Rename' },
}

interface BranchManageProps {
  /** Which operations the menu may offer, derived by `manageMenu(facts)`. */
  menu: ManageMenu
  /** Run an operation on the primary checkout. `ref` carries the name for the operations that
   * take one (`new-branch`, `rename`). */
  onOperation: (operation: GitOperation, ref?: string) => void
  /** The diverged branch's first escape hatch. */
  onOpenScratchTerminal: () => void
  /** The diverged branch's second escape hatch. */
  onResolveWithAgent: () => void
}

/**
 * Organism: the manage trigger and its menu — safe sync over branch CRUD.
 *
 * It offers only what cannot lose work: a fetch always, a pull only where it fast-forwards, a
 * push only where the remote will take it. There is no merge, no rebase, no force, and no
 * `Remove worktree` — a worktree may hold uncommitted work, and Argo does not destroy git state
 * it did not create. A diverged branch keeps its `Fetch` (fetching cannot lose work either) and
 * gains `ConflictHatch` in place of the sync it cannot do safely.
 */
export function BranchManage({
  menu,
  onOperation,
  onOpenScratchTerminal,
  onResolveWithAgent,
}: BranchManageProps): React.JSX.Element {
  const [naming, setNaming] = useState<{
    title: string
    submitLabel: string
    operation: GitOperation
  } | null>(null)
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
      <DropdownMenuContent align="end" className="w-80" onCloseAutoFocus={() => setNaming(null)}>
        {naming ? (
          <BranchNameField
            title={naming.title}
            submitLabel={naming.submitLabel}
            onSubmit={(name) => {
              onOperation(naming.operation, name)
              setNaming(null)
            }}
            onCancel={() => setNaming(null)}
          />
        ) : (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <Text variant="eyebrow">Sync with origin</Text>
              </DropdownMenuLabel>
              {menu.sync.map((operation) => (
                <OperationRow key={operation} operation={operation} onSelect={onOperation} />
              ))}
            </DropdownMenuGroup>
            {menu.diverged ? (
              <ConflictHatch
                onOpenScratchTerminal={onOpenScratchTerminal}
                onResolveWithAgent={onResolveWithAgent}
              />
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <Text variant="eyebrow">Branch</Text>
              </DropdownMenuLabel>
              {menu.branch.map((operation) => (
                <OperationRow
                  key={operation}
                  operation={operation}
                  onSelect={(chosen) => {
                    const prompt = NEEDS_NAME[chosen]
                    if (prompt) return setNaming({ ...prompt, operation: chosen })
                    onOperation(chosen)
                  }}
                  keepOpen={NEEDS_NAME[operation] !== undefined}
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
