import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import type { SubagentRowModel } from '../interiorSubagents'
import { NAV_ROW, NAV_ROW_SELECTED } from './rowRecipes'

/**
 * Molecule: one subagent as the group draws it — `dot · name · target · status`.
 *
 * Dense on purpose: a fanout of thirty has to stay scannable, which a card grid cannot do. State is
 * carried entirely by the dot, so the status word stays neutral dim text.
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
        {row.target !== '' && (
          <Text variant="code-inline" className="min-w-0 truncate text-foreground-faint">
            {row.target}
          </Text>
        )}
        <Text variant="eyebrow" className="shrink-0 text-foreground-soft">
          {row.status}
        </Text>
      </button>
    </li>
  )
}
