import { cn } from '@/lib/utils'
import {
  ArrowSquareOutIcon,
  DropdownMenuItem,
  SparkleIcon,
  TerminalWindowIcon,
  Text,
  VERDICT_BLOCK_WASH,
} from '@/shared/components/ui'

interface ConflictHatchProps {
  /** Open a terminal on the primary checkout, attached to no agent. */
  onOpenScratchTerminal: () => void
  /** Hand the conflict to an agent — the resolution leaves the cockpit. */
  onResolveWithAgent: () => void
}

/**
 * Molecule: what a diverged branch is offered instead of a merge.
 *
 * Argo ships no merge-conflict editor, so the manage menu replaces its whole sync group with
 * this: it states that a pull would conflict and hands the work to a terminal or an agent.
 * There is deliberately no merge, rebase or force here — nothing in this chrome may lose work.
 */
export function ConflictHatch({
  onOpenScratchTerminal,
  onResolveWithAgent,
}: ConflictHatchProps): React.JSX.Element {
  return (
    <div className={cn('rounded-lg border p-tight', VERDICT_BLOCK_WASH)}>
      <Text as="p" variant="row-strong" className="px-inset pt-tight text-verdict-block">
        Diverged from origin. A pull will conflict.
      </Text>
      <Text as="p" variant="prose" className="px-inset pb-tight text-foreground-faint">
        Argo has no conflict editor. Resolve it where it is cheap:
      </Text>
      <DropdownMenuItem onSelect={onOpenScratchTerminal}>
        <TerminalWindowIcon className="icon-sm text-foreground-faint" />
        <Text variant="row">Open a scratch terminal</Text>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onResolveWithAgent}>
        <SparkleIcon className="icon-sm text-foreground-faint" />
        <Text variant="row">Resolve with an agent</Text>
        <ArrowSquareOutIcon className="icon-sm text-foreground-faint" />
      </DropdownMenuItem>
    </div>
  )
}
