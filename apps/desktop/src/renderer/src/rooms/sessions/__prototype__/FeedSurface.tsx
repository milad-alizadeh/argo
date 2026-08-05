import { Fragment, useRef } from 'react'
import { CompactionMarker } from '../components/CompactionMarker'
import { TurnFeed } from '../components/TurnFeed'
import type { PlanProgressModel } from '../sessionPlan'
import { DensityGutter } from './DensityGutter'
import type { Chapter } from './feedIndex'
import { PlacementSeam, segmentsOf } from './PlacementSeam'
import { ShotGallery } from './ShotGallery'
import type { DelegateItem } from './SubagentScope'
import { ANCHOR, jumpFeedTo, stepFeed, useMinimapWindow, useStepKeys } from './useFeedScroll'

// PROTOTYPE — the locked feed surface, as ONE component: sticky seams, turn separators, the density
// gutter. Extracted so the main session and a delegate's scope render through the SAME surface —
// a subagent's feed is a feed like any other, so it earns no styling of its own.

export function FeedSurface({
  chapters,
  plan,
  seamDelegates,
  onOpen,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
  /** Render each chapter's delegates as a chip on its seam (the F3 placement). */
  seamDelegates?: boolean
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const minimapWindow = useRef<HTMLDivElement>(null)
  useMinimapWindow(feed, minimapWindow, chapters.map((chapter) => chapter.key).join('|'))
  useStepKeys((delta) => stepFeed(feed.current, delta))

  const scrub = (ratio: number): void => {
    const root = feed.current
    if (root) root.scrollTop = ratio * (root.scrollHeight - root.clientHeight)
  }

  return (
    <div className="proto-feed-frame flex min-h-0 min-w-0 flex-1">
      <div
        ref={feed}
        className="proto-feed-scroller min-h-0 min-w-0 flex-1 overflow-y-auto p-region pt-0"
      >
        {chapters.map((chapter, index) => (
          <Fragment key={chapter.key}>
            {/* Where one turn ends and the next begins, DRAWN: a full-width rule in the middle of
                the gap, so the boundary is a line you see rather than air you infer. */}
            {index > 0 && <div aria-hidden className="my-plane h-px shrink-0 bg-foreground/15" />}
            <section {...{ [ANCHOR]: chapter.key }} className="flex flex-col">
              {chapter.compactedBefore && (
                <div className="pb-region">
                  <CompactionMarker />
                </div>
              )}
              <PlacementSeam
                chapter={chapter}
                plan={plan}
                delegates={seamDelegates === true ? chapter.delegates : undefined}
                onOpen={onOpen}
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
          </Fragment>
        ))}
      </div>
      <DensityGutter
        chapters={chapters}
        windowRef={minimapWindow}
        onJump={(key) => jumpFeedTo(feed.current, key)}
        onScrub={scrub}
      />
    </div>
  )
}
