import type { FeedRow } from '@shared'
import { Fragment, useRef } from 'react'
import type { ChapterModel } from '../interiorTimeline'
import type { PlanProgressModel } from '../sessionPlan'
import { DensityGutter } from './DensityGutter'
import { FeedSeam } from './FeedSeam'
import { ANCHOR, jumpFeedTo, stepFeed, useStepKeys } from './feedScroll'
import { segmentsOf } from './feedSegments'
import { useMinimapBlocks, useMinimapWindow } from './minimapGeometry'
import { ShotGallery } from './ShotGallery'
import { TurnFeed } from './TurnFeed'

// The minimap window's motion, in the stylesheet rather than a scroll listener: the feed publishes
// its scroll position as a named timeline (`.feed-scroller`, scoped by `.feed-frame`), and the
// window is an animation over it — `top: 0 → 100%` with `translateY(0 → -100%)` so its bottom meets
// the track's bottom exactly at full scroll, whatever its height. Compositor-driven, zero JS: the
// minimap's spelling of what `position: sticky` is for the seams.
const TIMELINE_CSS = `
.feed-frame { timeline-scope: --feed-scroll; }
.feed-scroller { scroll-timeline: --feed-scroll block; }
.feed-minimap-window { animation: feed-minimap-window linear both; animation-timeline: --feed-scroll; }
@keyframes feed-minimap-window {
  from { top: 0; transform: translateY(0); }
  to { top: 100%; transform: translateY(-100%); }
}
`

/** One chapter's rows under its seam, or NOTHING where the turn produced none.
 *
 * An exchange that produced nothing is a real fact — you ran `/effort` and the agent said nothing
 * back — and its seam still stands to say so. What it must not do is stand a region of empty
 * padding under that seam: an empty band between two rules reads as content that failed to load,
 * which is the one thing it does not mean. */
function ChapterBody({
  rows,
  root,
}: {
  rows: readonly FeedRow[]
  root: string | null
}): React.JSX.Element | null {
  const segments = segmentsOf(rows)
  if (segments.length === 0) return null
  return (
    <div className="flex max-w-[78ch] flex-col gap-region pt-region">
      {segments.map((segment) =>
        segment.kind === 'shots' ? (
          <ShotGallery key={segment.key} rows={segment.shots} />
        ) : (
          <TurnFeed key={segment.key} rows={segment.rows} root={root} />
        ),
      )}
    </div>
  )
}

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
  root,
}: {
  chapters: readonly ChapterModel[]
  plan: PlanProgressModel | null
  /** The session's working directory — what every path in these chapters is shown relative to. */
  root: string | null
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const minimapWindow = useRef<HTMLDivElement>(null)
  const contentKey = chapters.map((chapter) => chapter.key).join('|')
  const blocks = useMinimapBlocks(feed, contentKey)
  useMinimapWindow(feed, minimapWindow, contentKey)
  useStepKeys((delta) => stepFeed(feed.current, delta))

  const scrub = (ratio: number): void => {
    const root = feed.current
    if (root) root.scrollTop = ratio * (root.scrollHeight - root.clientHeight)
  }

  return (
    <div data-component="FeedSurface" className="feed-frame flex min-h-0 min-w-0 flex-1">
      <style>{TIMELINE_CSS}</style>
      <div
        ref={feed}
        className="feed-scroller min-h-0 min-w-0 flex-1 overflow-y-auto p-region pt-0"
      >
        {chapters.map((chapter, index) => (
          <Fragment key={chapter.key}>
            {/* Where one turn ends and the next begins, DRAWN: a full-width rule in the middle of
                the gap, so the boundary is a line you see rather than air you infer.
                `my-plane` is the WHOLE of the space around it — the body above carries no bottom
                padding of its own, so the rule sits the same distance from the last row above it
                as from the seam below. Padding on both would put a region-plus-plane above the
                line and a plane below, which reads as a rule belonging to the turn beneath. */}
            {index > 0 && <div aria-hidden className="my-plane h-px shrink-0 bg-foreground/15" />}
            <section {...{ [ANCHOR]: chapter.key }} className="flex flex-col">
              <FeedSeam chapter={chapter} plan={plan} />
              <ChapterBody rows={chapter.rows} root={root} />
            </section>
          </Fragment>
        ))}
      </div>
      <DensityGutter
        chapters={chapters}
        blocks={blocks}
        windowRef={minimapWindow}
        onJump={(key) => jumpFeedTo(feed.current, key)}
        onScrub={scrub}
      />
    </div>
  )
}
