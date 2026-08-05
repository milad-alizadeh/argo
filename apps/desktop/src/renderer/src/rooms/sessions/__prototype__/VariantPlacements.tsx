import { useRef, useState } from 'react'
import { CompactionMarker } from '../components/CompactionMarker'
import { TurnFeed } from '../components/TurnFeed'
import type { PlanProgressModel } from '../sessionPlan'
import { DensityGutter } from './DensityGutter'
import type { Chapter } from './feedIndex'
import { PlacementSeam, segmentsOf } from './PlacementSeam'
import { ShotGallery } from './ShotGallery'
import { allDelegates, SubagentChips, SubagentRail } from './SubagentPlacements'
import { type DelegateItem, SubagentScope } from './SubagentScope'
import { ANCHOR, jumpFeedTo, stepFeed, useMinimapWindow, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANTS F1/F2/F3: the locked synthesis (E) with the subagent announcement moved to
// one of three seats. Same feed, same gutter, same scope switch — the ONLY difference is where the
// delegate list lives, so the placements can be judged against each other with nothing else moving.
// The inline DelegateDoor is removed in all three: each placement IS the announcement.

export type Placement = 'chips' | 'rail' | 'seam'

export function VariantPlacements({
  chapters,
  plan,
  placement,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
  placement: Placement
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const minimapWindow = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<DelegateItem | null>(null)
  useMinimapWindow(
    feed,
    minimapWindow,
    `${placement}:${scope === null}:${chapters.map((chapter) => chapter.key).join('|')}`,
  )
  useStepKeys((delta) => stepFeed(feed.current, delta))

  if (scope !== null) {
    return <SubagentScope item={scope} onBack={() => setScope(null)} />
  }

  const scrub = (ratio: number): void => {
    const root = feed.current
    if (root) root.scrollTop = ratio * (root.scrollHeight - root.clientHeight)
  }

  const row = (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div ref={feed} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region pt-0">
        {chapters.map((chapter) => (
          <section key={chapter.key} {...{ [ANCHOR]: chapter.key }} className="flex flex-col">
            {chapter.compactedBefore && (
              <div className="py-region">
                <CompactionMarker />
              </div>
            )}
            <PlacementSeam
              chapter={chapter}
              plan={plan}
              delegates={placement === 'seam' ? chapter.delegates : undefined}
              onOpen={setScope}
            />
            <div className="flex max-w-[78ch] flex-col gap-region py-region">
              {segmentsOf(chapter.rows).map((segment) =>
                segment.kind === 'shots' ? (
                  <ShotGallery key={segment.key} rows={segment.shots} />
                ) : (
                  <TurnFeed key={segment.key} rows={segment.rows} />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      {placement === 'rail' && (
        <SubagentRail delegates={allDelegates(chapters)} onOpen={setScope} />
      )}
      <DensityGutter
        chapters={chapters}
        windowRef={minimapWindow}
        onJump={(key) => jumpFeedTo(feed.current, key)}
        onScrub={scrub}
      />
    </div>
  )

  if (placement !== 'chips') return row
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SubagentChips delegates={allDelegates(chapters)} onOpen={setScope} />
      {row}
    </div>
  )
}
