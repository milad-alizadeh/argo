import { cn } from '@/lib/utils'
import { StatusDot, Text } from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../activityStates'
import type { DelegateItem } from '../interiorActivity'
import { NAV_ROW, NAV_ROW_SELECTED } from './rowRecipes'
import { SubagentRow } from './SubagentRow'

/**
 * Organism: the agents rail — every agent on the surface, the main session first, then its
 * delegates. It IS the scope switcher: whichever agent's feed fills the surface is the selected
 * row, and the main session is a row like any other, so the way back is one click, not a back
 * button. A session with no delegates shows no rail at all: one agent is not a list.
 */
export function AgentsRail({
  delegates,
  scopeKey,
  live,
  onSelect,
}: {
  delegates: readonly DelegateItem[]
  /** Whose feed the surface is showing — `null` is the main session. */
  scopeKey: string | null
  /** Whether the session's own newest turn is still open — the main row's dot. */
  live: boolean
  onSelect: (key: string | null) => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  const main = SUBAGENT_STATES[live ? 'running' : 'done'].dot
  return (
    <div
      data-component="AgentsRail"
      className="flex w-[240px] shrink-0 flex-col gap-tight overflow-y-auto border-r border-r-inset-hair p-inset"
    >
      <Text variant="eyebrow" className="text-foreground-faint">
        agents
      </Text>
      <ul aria-label="Agents" className="flex flex-col">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-current={scopeKey === null ? 'true' : undefined}
            className={cn(NAV_ROW, scopeKey === null && NAV_ROW_SELECTED)}
          >
            <StatusDot tone={main.tone} glow={main.glow} pulse={main.pulse} />
            <Text variant="row" className="min-w-0 flex-1 truncate text-foreground">
              Main session
            </Text>
          </button>
        </li>
        {delegates.map((item) => (
          <SubagentRow
            key={item.key}
            row={item.subagent}
            selected={scopeKey === item.key}
            onSelect={() => onSelect(item.key)}
          />
        ))}
      </ul>
    </div>
  )
}
