import type { FeedRow, MediaRowModel } from '@shared'
import { useRef, useState } from 'react'
import { StatusDot, Text } from '@/shared/components/ui'
import { CompactionMarker } from '../components/CompactionMarker'
import { SubagentRow } from '../components/SubagentRow'
import { TurnFeed } from '../components/TurnFeed'
import type { PlanProgressModel } from '../sessionPlan'
import { PlanPull } from './ChapterBar'
import { DensityGutter } from './DensityGutter'
import { type Chapter, chapterTitle } from './feedIndex'
import { ShotGallery } from './ShotGallery'
import { type DelegateItem, SubagentScope } from './SubagentScope'
import { STICKY_BAR } from './stickyBar'
import { ANCHOR, jumpFeedTo, stepFeed, useMinimapWindow, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANT E · Synthesis (the direction picked out of A–D).
//
// One full-width feed. Navigation is the density gutter on the right edge, snapping chapter by
// chapter as the feed scrolls (A + D's selection). Each turn opens with a STICKY seam — its prompt,
// its state, the plan's count — so the current exchange and the session's intent are always one
// glance up, and nothing is numbered (the prompt is the name; a number was the nav pane's need, not
// the reader's). Subagents live in the turn that spawned them and OPEN AS A SCOPE: the whole surface
// becomes that agent's feed, with the sticky bar as the way back. Screenshots render as a thumbnail
// strip; the pixels at size are a lightbox away.

/** A chapter's rows with every run of consecutive shots pulled out as one gallery, so four
 * screenshots cost one row of thumbs rather than four screens of pixels. */
type Segment =
  | { key: string; kind: 'rows'; rows: FeedRow[] }
  | { key: string; kind: 'shots'; shots: MediaRowModel[] }

function segmentsOf(rows: readonly FeedRow[]): Segment[] {
  const segments: Segment[] = []
  // The prompt row is dropped: the sticky seam already leads with the prompt, and the same sentence
  // twice within an inch is the repetition this whole exploration is against. The cost is honest —
  // a multi-line prompt loses its tail to the seam's truncation — and is the thing to judge here.
  for (const row of rows.filter((candidate) => candidate.kind !== 'prompt')) {
    const last = segments.at(-1)
    if (row.kind === 'media') {
      if (last?.kind === 'shots') last.shots.push(row)
      else segments.push({ key: row.key, kind: 'shots', shots: [row] })
    } else if (last?.kind === 'rows') {
      last.rows.push(row)
    } else {
      segments.push({ key: row.key, kind: 'rows', rows: [row] })
    }
  }
  return segments
}

/** The seam a turn starts with, STUCK: whichever exchange you are inside, its cause and the plan's
 * count are the top line of the pane. No number — the prompt is the turn's name.
 *
 * ALWAYS gold, no active state: the gold is the same gold the minimap's prompt ticks wear, which is
 * what makes the strip readable as a legend — and being STUCK is already what says "this is the one
 * you are inside". No stop-reason word either — a finished turn needs no label, and a live one says
 * so with the session's own pulsing run dot. */
function StickySeam({
  chapter,
  plan,
}: {
  chapter: Chapter
  plan: PlanProgressModel | null
}): React.JSX.Element {
  return (
    <div className={STICKY_BAR}>
      <span className="h-[1.1em] w-[3px] shrink-0 self-center rounded-full bg-primary" />
      <Text variant="row-strong" className="min-w-0 flex-1 truncate text-primary">
        {chapterTitle(chapter)}
      </Text>
      {chapter.open && (
        <StatusDot tone="run" glow="live" pulse label="running" className="self-center" />
      )}
      {plan && <PlanPull plan={plan} />}
    </div>
  )
}

/** The delegates where they happened, open by default and clickable: this is the door to the scope
 * switch, and a door you have to unfold first is a door nobody finds. */
function DelegateDoor({
  delegates,
  onOpen,
}: {
  delegates: readonly DelegateItem[]
  onOpen: (item: DelegateItem) => void
}): React.JSX.Element | null {
  if (delegates.length === 0) return null
  return (
    <div className="flex flex-col gap-tight border-l border-l-inset-hair pl-inset">
      <ul aria-label="Subagents" className="flex flex-col">
        {delegates.map((item) => (
          <SubagentRow
            key={item.key}
            row={item.subagent}
            selected={false}
            onSelect={() => onOpen(item)}
          />
        ))}
      </ul>
    </div>
  )
}

export function VariantSynthesis({
  chapters,
  plan,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const minimapWindow = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<DelegateItem | null>(null)
  // No scroll STATE anywhere: the seams stick by CSS, the minimap window is positioned by direct
  // style writes, and stepping reads the DOM when asked. Scrolling re-renders nothing.
  useMinimapWindow(
    feed,
    minimapWindow,
    `${scope === null}:${chapters.map((chapter) => chapter.key).join('|')}`,
  )
  useStepKeys((delta) => stepFeed(feed.current, delta))

  if (scope !== null) {
    return <SubagentScope item={scope} onBack={() => setScope(null)} />
  }

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
        {/* Sections run at FULL pane width so the sticky seam spans edge to edge; only the prose
            column inside is held to a measure, because line length is a reading rule, not a layout. */}
        {chapters.map((chapter) => (
          <section key={chapter.key} {...{ [ANCHOR]: chapter.key }} className="flex flex-col">
            {chapter.compactedBefore && (
              <div className="py-region">
                <CompactionMarker />
              </div>
            )}
            <StickySeam chapter={chapter} plan={plan} />
            <div className="flex max-w-[78ch] flex-col gap-region py-region">
              {segmentsOf(chapter.rows).map((segment) =>
                segment.kind === 'shots' ? (
                  <ShotGallery key={segment.key} rows={segment.shots} />
                ) : (
                  <TurnFeed key={segment.key} rows={segment.rows} />
                ),
              )}
              <DelegateDoor delegates={chapter.delegates} onOpen={setScope} />
            </div>
          </section>
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
