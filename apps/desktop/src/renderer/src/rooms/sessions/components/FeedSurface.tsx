import { Fragment, useRef } from 'react'
import type { ChapterModel } from '../interiorTimeline'
import type { PlanProgressModel } from '../sessionPlan'
import { DensityGutter } from './DensityGutter'
import { FeedSeam } from './FeedSeam'
import { ANCHOR, jumpFeedTo, stepFeed, useMinimapWindow, useStepKeys } from './feedScroll'
import { segmentsOf } from './feedSegments'
import { ShotGallery } from './ShotGallery'
import { TurnFeed } from './TurnFeed'

/**
 * Organism: one agent's feed — full-width chapters under sticky gold seams, the density gutter as
 * the whole of navigation, screenshots as thumbnail strips.
 *
 * The same surface renders the session and a delegate's scope: whose feed it is comes from the
 * chapters handed in, never from a second layout. Sections run at FULL pane width so the seam
 * spans edge to edge; only the prose column inside is held to a measure, because line length is a
 * reading rule, not a layout.
 */
export function FeedSurface({
  chapters,
  plan,
}: {
  chapters: readonly ChapterModel[]
  plan: PlanProgressModel | null
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
    <div data-component="FeedSurface" className="feed-frame flex min-h-0 min-w-0 flex-1">
      <div
        ref={feed}
        className="feed-scroller min-h-0 min-w-0 flex-1 overflow-y-auto p-region pt-0"
      >
        {chapters.map((chapter, index) => (
          <Fragment key={chapter.key}>
            {/* Where one turn ends and the next begins, DRAWN: a full-width rule in the middle of
                the gap, so the boundary is a line you see rather than air you infer. */}
            {index > 0 && <div aria-hidden className="my-plane h-px shrink-0 bg-foreground/15" />}
            <section {...{ [ANCHOR]: chapter.key }} className="flex flex-col">
              <FeedSeam chapter={chapter} plan={plan} />
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
