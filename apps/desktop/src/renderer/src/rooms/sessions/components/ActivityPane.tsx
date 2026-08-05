import {
  MasterDetail,
  type MasterDetailSection,
  type MasterDetailSplitter,
  Text,
} from '@/shared/components/ui'
import type { ActivityModel } from '../interiorActivity'
import { AgentHead } from './AgentHead'
import { PlanProgress } from './PlanProgress'
import { SubagentGroup } from './SubagentGroup'
import { TurnFeed } from './TurnFeed'
import { TurnTimeline } from './TurnTimeline'

/** The feed: one section per turn of the DISPLAYED agent, in the order the nav lists them. Each section
 * declares the row anchors inside it, so a jump into a section the window has not mounted can reach the
 * section first and the row after. */
const feedSections = (activity: ActivityModel): MasterDetailSection[] =>
  activity.sections.map((section) => ({
    key: section.key,
    anchors: section.turn.steps.map((step) => step.key),
    detail: <TurnFeed rows={section.rows} />,
  }))

/** What the SESSION's own surface says before its first call. The feed is empty when nothing has been
 * called yet — but an agent that wrote its plan first has something to show, and the Dock's now-head is
 * already reporting its `N/M`, so drawing a bare zero-state over a plan we hold would make the two
 * surfaces disagree in exactly the state the tracker is most worth reading. */
function FreshSurface({ plan }: { plan: ActivityModel['plan'] }): React.JSX.Element {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-region p-region">
      {plan && <PlanProgress plan={plan} />}
      <Text variant="meta" className="text-foreground-faint">
        {plan === null
          ? 'nothing observed yet — the Dock below is where this session starts'
          : 'no calls yet — this is the plan it opened with'}
      </Text>
    </div>
  )
}

/** A delegate with no turns yet keeps the two panes — losing them would strand the reader inside an
 * agent with no way back — and says what is absent in the feed's own space. */
const NOTHING_OBSERVED: MasterDetailSection = {
  key: 'nothing-observed',
  detail: (
    <Text variant="prose" className="text-foreground-faint">
      no feed yet — nothing observed from this subagent
    </Text>
  ),
}

/**
 * Organism: the Activity surface — two panes, master left and ONE agent's continuous feed right.
 *
 * One agent at a time (issue 319): the root by default, and selecting a Subagents row replaces the feed
 * with that delegate's own, with an explicit way back in the head. A concatenation of several agents'
 * work reads as one timeline that never happened — and chronology, a single live edge and one
 * virtualised container are only definable within one agent anyway.
 *
 * The left pane holds two navigable sections that are never merged — a Subagents group above the
 * Timeline — with the plan BETWEEN them and outside the navigation, because it is neither: a plan
 * belongs to the SESSION, not to a turn, so there is one of it, it is not a list of places to jump to,
 * and it stays legible while every turn below it is folded. Delegated work leads because it is the only
 * work here that is running somewhere else.
 *
 * Both panes run OLDEST FIRST and are drawn from the same `sections`, so the highlight travels the way
 * the reader scrolls and the two panes cannot disagree about what a step is.
 */
export function ActivityPane({
  activity,
  splitter,
  onSelectAgent,
}: {
  /** The Activity surface's derived view-model, for the agent being displayed. */
  activity: ActivityModel
  /** The drag handle between the two panes, wired by the room to the `activity` spine edge. */
  splitter?: MasterDetailSplitter
  /** Show another agent's feed. The room holds which one, so the pane stays a View. */
  onSelectAgent?: (agentId: string) => void
}): React.JSX.Element {
  const sections = feedSections(activity)
  const select = onSelectAgent ?? ((): void => {})
  const fresh = sections.length === 0 && activity.agent.head === null
  return (
    <div data-component="ActivityPane" className="flex min-h-0 min-w-0 flex-1">
      {fresh ? (
        <FreshSurface plan={activity.plan} />
      ) : (
        <MasterDetail
          splitter={splitter}
          sections={sections.length === 0 ? [NOTHING_OBSERVED] : sections}
          // Keyed by the displayed agent: switching agents is not a scroll, so the follow and the
          // reading position are that agent's, and its feed opens at its own edge.
          feed={{ key: activity.agent.id, live: activity.agent.live }}
          head={<AgentHead agent={activity.agent} onSelectAgent={select} />}
          nav={({ activeKey, jumpTo }) => (
            <>
              {activity.subagents && (
                <SubagentGroup
                  group={activity.subagents}
                  displayedId={activity.agent.id}
                  onSelect={select}
                />
              )}
              {activity.plan && <PlanProgress plan={activity.plan} />}
              <TurnTimeline sections={activity.sections} activeKey={activeKey} onSelect={jumpTo} />
            </>
          )}
        />
      )}
    </div>
  )
}
