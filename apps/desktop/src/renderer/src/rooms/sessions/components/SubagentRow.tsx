import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../activityStates'
import type { SubagentRowModel } from '../interiorSubagents'
import { NAV_ROW, NAV_ROW_SELECTED } from './rowRecipes'

/**
 * Molecule: one subagent as the group draws it — `dot · name`, what it is on, then how long it has
 * been at it.
 *
 * The middle column holds the target, or the state word where there is no target — never both. State
 * is already carried by the dot, so a word beside a target is the same fact twice and costs the row
 * the width its target needs. A subagent that has touched nothing has nothing to name, and that is
 * exactly when its state is worth spelling out.
 *
 * The cost and the duration are what a fanout is actually read for — which delegate is taking the
 * time and burning the budget — so they hold the right edge and the target truncates before they do.
 * Both are absent until observed: a running delegate's spend arrives with its result.
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
        {row.target === null ? (
          <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
            {SUBAGENT_STATES[row.status].word}
          </Text>
        ) : (
          // `flex-1` alongside the name's: the two columns split the row instead of the target's
          // content width starving the name to nothing on a narrow rail.
          <Text variant="code-inline" className="min-w-0 flex-1 truncate text-foreground-faint">
            {row.target}
          </Text>
        )}
        {row.tokens !== null && (
          <Text variant="meta" className="shrink-0 tabular-nums text-foreground-faint">
            {row.tokens}
          </Text>
        )}
        {row.took !== null && (
          <Text variant="meta" className="shrink-0 tabular-nums text-foreground-faint">
            {row.took}
          </Text>
        )}
      </button>
    </li>
  )
}
