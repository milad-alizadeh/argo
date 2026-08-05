import { cn } from '@/lib/utils'
import { CaretLeftIcon, CaretRightIcon, IconButton, StatusDot, Text } from '@/shared/components/ui'
import { SUBAGENT_STATES } from '../activityStates'
import type { DelegateItem } from '../interiorActivity'
import { NAV_ROW, NAV_ROW_SELECTED, PANE_BAND } from './rowRecipes'
import { SubagentRow } from './SubagentRow'

/**
 * Organism: the agents rail — every agent on the surface, the main session first, then its
 * delegates. It IS the scope switcher: whichever agent's feed fills the surface is the selected
 * row, and the main session is a row like any other, so the way back is one click, not a back
 * button. A session with no delegates shows no rail at all: one agent is not a list.
 *
 * COLLAPSED it is a strip of dots and nothing else — still the switcher, still showing every
 * agent's state, in the width of one glyph. That is the point of collapsing rather than hiding: a
 * rail you closed to read a wide diff must not also stop telling you a delegate just failed. Its
 * WIDTH is the parent's to store (the splitter beside it reports px); this component only draws to
 * whatever room it is given.
 */
export function AgentsRail({
  delegates,
  scopeKey,
  live,
  collapsed,
  onSelect,
  onToggle,
}: {
  delegates: readonly DelegateItem[]
  /** Whose feed the surface is showing — `null` is the main session. */
  scopeKey: string | null
  /** Whether the session's own newest turn is still open — the main row's dot. */
  live: boolean
  collapsed: boolean
  onSelect: (key: string | null) => void
  onToggle: () => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  const main = SUBAGENT_STATES[live ? 'running' : 'done'].dot
  return (
    <div
      data-component="AgentsRail"
      data-collapsed={collapsed || undefined}
      className={cn(
        'flex shrink-0 flex-col overflow-y-auto overflow-x-hidden',
        // Collapsed the rail is a fixed strip; open it fills whatever the splitter gave it, so the
        // width lives on the parent and this never fights the drag for it.
        collapsed ? 'w-[38px] items-center' : 'w-full',
      )}
    >
      {/* The header wears the SAME band as the sticky chapter seam beside it — one recipe, one
          stated height — so the two bottom hairlines meet and read as one rule across the pane.
          Only the horizontal inset is this header's own. */}
      <div className={cn(PANE_BAND, 'w-full px-inset', collapsed ? 'justify-center' : 'gap-snug')}>
        {!collapsed && (
          <Text variant="eyebrow" className="min-w-0 flex-1 truncate text-foreground-faint">
            agents
          </Text>
        )}
        <IconButton
          aria-expanded={!collapsed}
          label={collapsed ? 'Expand agents' : 'Collapse agents'}
          onClick={onToggle}
        >
          {collapsed ? (
            <CaretRightIcon className="icon-sm" />
          ) : (
            <CaretLeftIcon className="icon-sm" />
          )}
        </IconButton>
      </div>
      {/* The padding the container gave up so the header could sit flush in its own band. */}
      <ul aria-label="Agents" className="flex w-full flex-col p-inset">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-current={scopeKey === null ? 'true' : undefined}
            title="Main session"
            aria-label="Main session"
            className={cn(
              NAV_ROW,
              scopeKey === null && NAV_ROW_SELECTED,
              collapsed && 'justify-center px-0',
            )}
          >
            <StatusDot tone={main.tone} glow={main.glow} pulse={main.pulse} />
            {!collapsed && (
              <Text variant="row" className="min-w-0 flex-1 truncate text-foreground">
                Main session
              </Text>
            )}
          </button>
        </li>
        {delegates.map((item) => (
          <SubagentRow
            key={item.key}
            row={item.subagent}
            selected={scopeKey === item.key}
            collapsed={collapsed}
            onSelect={() => onSelect(item.key)}
          />
        ))}
      </ul>
    </div>
  )
}
