import { MasterDetail, Text } from '@/shared/components/ui'
import type { ActivityModel } from '../interiorActivity'
import { AgentFeed } from './AgentFeed'
import { SubagentGroup } from './SubagentGroup'
import { TurnTimeline } from './TurnTimeline'

/**
 * Organism: the Activity surface — two panes, master left and one continuous detail feed right.
 *
 * The left pane holds two sections that are never merged: a Subagents group above the Timeline. The
 * right pane concatenates every item's detail in the same order, so scrolling flows item to item and
 * the highlight follows the scroll rather than the last click.
 */
export function ActivityPane({
  activity,
  splitter,
}: {
  /** The Activity surface's derived view-model. */
  activity: ActivityModel
  /** The drag handle between the two panes, wired by the room to the `activity` spine edge. */
  splitter?: React.ReactNode
}): React.JSX.Element {
  return (
    <div data-component="ActivityPane" className="flex min-h-0 min-w-0 flex-1">
      {activity.items.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-region">
          <Text variant="meta" className="text-foreground-faint">
            nothing observed yet — the Dock below is where this session starts
          </Text>
        </div>
      ) : (
        <MasterDetail
          splitter={splitter}
          sections={activity.items.map((item) => ({
            key: item.key,
            detail: <AgentFeed item={item} />,
          }))}
          nav={({ activeKey, jumpTo }) => (
            <>
              {activity.subagents && (
                <SubagentGroup group={activity.subagents} activeKey={activeKey} onSelect={jumpTo} />
              )}
              <TurnTimeline turns={activity.turns} activeKey={activeKey} onSelect={jumpTo} />
            </>
          )}
        />
      )}
    </div>
  )
}
