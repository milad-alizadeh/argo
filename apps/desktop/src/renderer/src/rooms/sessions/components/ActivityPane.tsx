import { useState } from 'react'
import { Text } from '@/shared/components/ui'
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
 */
export function ActivityPane({ activity }: { activity: ActivityModel }): React.JSX.Element {
  const [scopeKey, setScopeKey] = useState<string | null>(null)
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
  return (
    <div data-component="ActivityPane" className="flex min-h-0 min-w-0 flex-1">
      <AgentsRail
        delegates={activity.delegated}
        scopeKey={scope?.key ?? null}
        live={activity.turns.at(-1)?.open === true}
        onSelect={setScopeKey}
      />
      {/* Keyed by scope so switching agents starts the new feed at its top rather than at the old
          one's scroll offset. The plan is the SESSION's, so a delegate's scope carries none. */}
      <FeedSurface
        key={scope?.key ?? 'main'}
        chapters={chapters}
        plan={scope === null ? activity.plan : null}
      />
    </div>
  )
}
