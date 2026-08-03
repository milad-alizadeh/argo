import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import type { SubagentRowModel } from '../interiorSubagents'
import { NAV_ROW, NAV_ROW_SELECTED } from './rowRecipes'

/**
 * Molecule: one subagent as the group draws it — `dot · name`, then ONE right-hand column.
 *
 * That column holds the target, or the state word where there is no target — never both. State is
 * already carried by the dot, so a word beside a target is the same fact twice and costs the row
 * the width its target needs. A subagent that has touched nothing has nothing to name, and that is
 * exactly when its state is worth spelling out.
 *
 * Dense on purpose: a fanout of thirty has to stay scannable, which a card grid cannot do.
 */
export function SubagentRow({
  row,
  selected,
  onSelect,
}: {
  /** The row, already derived — a component grades nothing itself. */
  row: SubagentRowModel
  /** Whether the detail feed is currently showing this subagent. */
  selected: boolean
  /** Jump the detail feed to this subagent's live feed. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        data-component="SubagentRow"
        onClick={() => onSelect?.(row.key)}
        aria-current={selected ? 'true' : undefined}
        className={cn(NAV_ROW, selected && NAV_ROW_SELECTED)}
      >
        <StatusDot tone={row.dot.tone} glow={row.dot.glow} pulse={row.dot.pulse} />
        <Text variant="row" className="min-w-0 flex-1 truncate text-foreground">
          {row.name}
        </Text>
        {row.target === '' ? (
          <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
            {row.status}
          </Text>
        ) : (
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-faint">
            {row.target}
          </Text>
        )}
      </button>
    </li>
  )
}
