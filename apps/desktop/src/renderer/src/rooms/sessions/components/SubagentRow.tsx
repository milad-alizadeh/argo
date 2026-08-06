import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../interior/activityStates'
import type { SubagentRowModel } from '../interior/subagents'
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
 *
 * COLLAPSED it is its dot and nothing else. The dot is the one thing that must survive the rail
 * being closed — a delegate that just went red is exactly what you would reopen it for — and its
 * name moves to the title attribute rather than being dropped.
 */
export function SubagentRow({
  row,
  selected,
  collapsed = false,
  onSelect,
}: {
  /** The row, already derived — a component grades nothing itself. */
  row: SubagentRowModel
  /** Whether the detail feed is currently showing this subagent. */
  selected: boolean
  /** Drawn as its dot alone, for a rail closed to give the feed the room. */
  collapsed?: boolean
  /** Jump the detail feed to this subagent's live feed. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  if (collapsed) {
    return (
      <li>
        <button
          type="button"
          data-component="SubagentRow"
          onClick={() => onSelect?.(row.key)}
          aria-current={selected ? 'true' : undefined}
          aria-label={row.name}
          title={`${row.name} — ${SUBAGENT_STATES[row.status].word}`}
          className={cn(NAV_ROW, 'justify-center px-0', selected && NAV_ROW_SELECTED)}
        >
          <StatusDot tone={row.dot.tone} glow={row.dot.glow} pulse={row.dot.pulse} />
        </button>
      </li>
    )
  }
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
        {/* NO target column. It held the last file the delegate touched, which in a rail this narrow
            got about six characters — `grep -r…` — and spent them starving the NAME, the one field
            that says which delegate this is. A truncated fact that costs a whole field is worth less
            than the field it took. The state word stays for a delegate with nothing to show yet,
            since that is exactly when its name is not enough. */}
        {row.target === null && (
          <Text variant="eyebrow" className="shrink-0 text-foreground-faint">
            {SUBAGENT_STATES[row.status].word}
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
