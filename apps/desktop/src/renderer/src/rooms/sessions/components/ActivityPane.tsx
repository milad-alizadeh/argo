import {
  MasterDetail,
  type MasterDetailGroup,
  type MasterDetailSplitter,
  Text,
} from '@/shared/components/ui'
import type { ActivityItem, ActivityModel } from '../interiorActivity'
import { AgentFeed } from './AgentFeed'
import { PlanProgress } from './PlanProgress'
import { SubagentGroup } from './SubagentGroup'
import { TurnTimeline } from './TurnTimeline'

const sectionsOf = (items: readonly ActivityItem[]): { key: string; detail: React.ReactNode }[] =>
  items.map((item) => ({ key: item.key, detail: <AgentFeed item={item} /> }))

/** The feed's two runs, in the order the nav pane lists them: every delegate's work under its own
 * heading and on its own spine, then this session's own steps back on the root axis. A run with
 * nothing in it is dropped rather than left as an empty heading. */
function feedGroups(activity: ActivityModel): MasterDetailGroup[] {
  const groups: MasterDetailGroup[] = []
  if (activity.delegated.length > 0) {
    groups.push({
      key: 'delegated',
      label: 'Subagents',
      // The SAME summary the navigation pane's header wears, derived once — the two headings name
      // one group, and a second spelling of it is a second fact to keep true.
      count: activity.subagents?.summary,
      nested: true,
      sections: sectionsOf(activity.delegated),
    })
  }
  if (activity.own.length > 0) {
    // The root group is headed by nothing: this IS the session whose plane you are inside, and a
    // surface that announces itself inside itself only adds a line to read.
    groups.push({ key: 'own', label: null, sections: sectionsOf(activity.own) })
  }
  return groups
}

/**
 * Organism: the Activity surface — two panes, master left and one continuous detail feed right.
 *
 * The left pane holds two navigable sections that are never merged — a Subagents group above the
 * Timeline — with the plan BETWEEN them and outside the navigation, because it is neither: a plan
 * belongs to the SESSION, not to a turn, so there is one of it, it is not a list of places to jump
 * to, and it stays legible while every turn below it is folded. Delegated work leads because it is
 * the only work here that is running somewhere else: the plan and the timeline are still there when
 * you look down, and a fanout you have to scroll past a tracker to find reads as a footnote to it.
 *
 * The right pane concatenates every item's detail in the same order, so scrolling flows item to item
 * and the highlight follows the scroll rather than the last click — but it concatenates in the same
 * two runs, headed and indented, so a delegate's feed is never read as a step of this session's turn.
 */
export function ActivityPane({
  activity,
  splitter,
}: {
  /** The Activity surface's derived view-model. */
  activity: ActivityModel
  /** The drag handle between the two panes, wired by the room to the `activity` spine edge. */
  splitter?: MasterDetailSplitter
}): React.JSX.Element {
  const groups = feedGroups(activity)
  return (
    <div data-component="ActivityPane" className="flex min-h-0 min-w-0 flex-1">
      {groups.length === 0 ? (
        // The feed is empty when nothing has been CALLED yet — but an agent that wrote its plan
        // before its first tool call has something to show, and the Dock's now-head is already
        // reporting its `N/M`. Drawing the zero-state over a plan we hold would make the two
        // surfaces disagree in exactly the state the tracker is most worth reading.
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-region p-region">
          {activity.plan && <PlanProgress plan={activity.plan} />}
          <Text variant="meta" className="text-foreground-faint">
            {activity.plan === null
              ? 'nothing observed yet — the Dock below is where this session starts'
              : 'no calls yet — this is the plan it opened with'}
          </Text>
        </div>
      ) : (
        <MasterDetail
          splitter={splitter}
          groups={groups}
          nav={({ activeKey, jumpTo }) => (
            <>
              {activity.subagents && (
                <SubagentGroup group={activity.subagents} activeKey={activeKey} onSelect={jumpTo} />
              )}
              {activity.plan && <PlanProgress plan={activity.plan} />}
              <TurnTimeline turns={activity.turns} activeKey={activeKey} onSelect={jumpTo} />
            </>
          )}
        />
      )}
    </div>
  )
}
