import type { GitOperation } from '@shared'
import {
  ArrowLineDownIcon,
  ArrowLineUpIcon,
  ArrowsClockwiseIcon,
  DropdownMenuItem,
  GitBranchIcon,
  type IconAtom,
  PencilSimpleIcon,
  PlusIcon,
  Text,
  TrashIcon,
} from '@/shared/components/ui'

// Every operation the vocabulary has a row for. `checkout` and `delete` are in the union but
// never in the manage menu — the branch list is where a branch is named — so they are spelled
// here only to keep the record total, which is what makes a new operation a compile error.
export const OPERATIONS: Record<GitOperation, { label: string; icon: IconAtom }> = {
  fetch: { label: 'Fetch', icon: ArrowsClockwiseIcon },
  pull: { label: 'Pull', icon: ArrowLineDownIcon },
  push: { label: 'Push', icon: ArrowLineUpIcon },
  'new-branch': { label: 'New branch', icon: PlusIcon },
  rename: { label: 'Rename', icon: PencilSimpleIcon },
  delete: { label: 'Delete', icon: TrashIcon },
  checkout: { label: 'Check out', icon: GitBranchIcon },
}

/** Molecule: one operation row in the manage menu, named from the shared vocabulary. */
export function OperationRow({
  operation,
  onSelect,
  keepOpen,
}: {
  operation: GitOperation
  onSelect: (operation: GitOperation) => void
  /** Hold the menu open, for a row that opens the name field inside it. */
  keepOpen?: boolean
}): React.JSX.Element {
  const { label, icon: Glyph } = OPERATIONS[operation]
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        if (keepOpen) event.preventDefault()
        onSelect(operation)
      }}
    >
      <Glyph className="icon-sm text-foreground-faint" />
      <Text variant="row">{label}</Text>
    </DropdownMenuItem>
  )
}
