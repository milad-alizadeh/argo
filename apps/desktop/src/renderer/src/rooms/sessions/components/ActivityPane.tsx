import { useRef, useState } from 'react'
import { PanelSplitter, Text } from '@/shared/components/ui'
import { type ActivityModel, sessionChapters } from '../interiorActivity'
import { AgentsRail } from './AgentsRail'
import { FeedSurface } from './FeedSurface'
import { PlanProgress } from './PlanProgress'

/**
 * Organism: the Activity surface — one full-width feed, navigated by the density gutter on its
 * right edge, with the agents rail on the left when the session has delegates.
 *
 * Opening a delegate SWITCHES THE SCOPE of the whole surface: its chapters fill the same feed, the
 * way clicking into a directory switches a file listing — never a second pane beside the first.
 * The rail row is both the way in and the way back, and the scope is held as a KEY so a model
 * rebuild mid-read re-finds the same delegate rather than snapping back to the session.
 *
 * The rail's WIDTH lives here rather than in the rail, because a splitter resizes the thing beside
 * it and neither pane can own a boundary they share. Collapsing is a separate state from width, not
 * a width of zero: reopening has to return the rail to where you had it, which a single number
 * cannot remember through a close.
 */
/** The rail's width bounds. The floor is the widest a subagent row stays readable at rather than a
 * round number — under it the name truncates to nothing and the row is a dot with debris beside it,
 * which is what COLLAPSED is for and does better. */
const RAIL_MIN = 180
const RAIL_MAX = 460
const RAIL_DEFAULT = 240

export function ActivityPane({ activity }: { activity: ActivityModel }): React.JSX.Element {
  const [scopeKey, setScopeKey] = useState<string | null>(null)
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const rail = useRef<HTMLDivElement>(null)
  const scope = activity.delegated.find((item) => item.key === scopeKey) ?? null
  const chapters = scope === null ? sessionChapters(activity) : scope.chapters
  if (chapters.length === 0 && scope === null) {
    // Nothing observed yet — but an agent that wrote its plan before its first turn has something
    // to show, and the Dock's now-head is already reporting its `N/M`. Drawing the zero-state over
    // a plan we hold would make the two surfaces disagree exactly when the tracker matters most.
    return (
      <div
        data-component="ActivityPane"
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-region p-region"
      >
        {activity.plan && <PlanProgress plan={activity.plan} />}
        <Text variant="meta" className="text-foreground-faint">
          {activity.plan === null
            ? 'nothing observed yet — the Dock below is where this session starts'
            : 'no calls yet — this is the plan it opened with'}
        </Text>
      </div>
    )
  }
  const hasRail = activity.delegated.length > 0
  return (
    <div data-component="ActivityPane" className="flex min-h-0 min-w-0 flex-1">
      <div
        ref={rail}
        className="flex min-h-0 shrink-0"
        style={railCollapsed ? undefined : { width: railWidth }}
      >
        <AgentsRail
          delegates={activity.delegated}
          scopeKey={scope?.key ?? null}
          live={activity.turns.at(-1)?.open === true}
          collapsed={railCollapsed}
          onSelect={setScopeKey}
          onToggle={() => setRailCollapsed(!railCollapsed)}
        />
      </div>
      {/* No splitter on a collapsed rail: there is nothing to size, and a drag handle on a strip
          you closed would resize a panel you cannot see. */}
      {hasRail && !railCollapsed && (
        <PanelSplitter
          orientation="v"
          size={railWidth}
          measure={() => rail.current?.getBoundingClientRect().width ?? railWidth}
          min={RAIL_MIN}
          max={RAIL_MAX}
          label="Agents width"
          onResize={setRailWidth}
        />
      )}
      {/* Keyed by scope so switching agents starts the new feed at its top rather than at the old
          one's scroll offset. The plan is the SESSION's, so a delegate's scope carries none. */}
      <FeedSurface
        key={scope?.key ?? 'main'}
        chapters={chapters}
        plan={scope === null ? activity.plan : null}
        // The SESSION's root, delegate feeds included: a subagent runs in its parent's tree unless
        // it owns a worktree, and the tree is what the paths are relative to either way.
        root={activity.root}
      />
    </div>
  )
}
