import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  Text,
} from '@/shared/components/ui'
import type { BranchRow } from '../../git/branchMenuModel'
import { BranchMenuRow, type BranchRowHandlers } from './BranchMenuRow'

interface BranchMenuProps extends BranchRowHandlers {
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
  onDelete,
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
            <BranchMenuRow key={row.name} row={row} {...{ onCheckout, onOpenSession, onDelete }} />
          ))}
        </DropdownMenuGroup>
      ))}
    </DropdownMenuContent>
  )
}
