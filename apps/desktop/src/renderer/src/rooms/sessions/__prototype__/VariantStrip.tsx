import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { CompactionMarker } from '../components/CompactionMarker'
import { TurnFeed } from '../components/TurnFeed'
import type { PlanProgressModel } from '../sessionPlan'
import { type Chapter, chapterTitle, chapterWord } from './feedIndex'
import { InlineDelegates } from './InlineDelegates'
import { TimelineStrip } from './TimelineStrip'
import { ANCHOR, useFeedScroll, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANT D · Strip.
//
// The move: keep an overview, but ROTATE it. A horizontal band above the feed cannot become a second
// feed — there is no room for prose on it — so the repetition problem is closed by geometry rather
// than by discipline. What it buys that no vertical list does: proportion. Turn 6 is visibly the big
// one, the fanout hangs off it as forks, and the plan is the band's fill rather than a block.
//
// Cost: it takes the feed's full width and about 56px of height, permanently. That is the trade to
// judge — 56px of shape against 380px of titles.

/** The seam a turn wears when the overview is somewhere else: number, title, state, on a rule. It
 * keeps its title here because the strip above deliberately does not carry one. */
function Seam({ chapter, active }: { chapter: Chapter; active: boolean }): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-snug border-t border-t-inset-hair pt-snug">
      <Text variant="tag" className={cn(active ? 'text-primary' : 'text-foreground-faint')}>
        {chapter.ordinal}
      </Text>
      <Text variant="tag" className="min-w-0 flex-1 truncate text-foreground-faint">
        {chapterTitle(chapter)}
      </Text>
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        {chapterWord(chapter)}
      </Text>
    </div>
  )
}

export function VariantStrip({
  chapters,
  plan,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const { activeKey, jumpTo, step } = useFeedScroll(
    feed,
    chapters.map((chapter) => chapter.key).join('|'),
  )
  useStepKeys(step)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TimelineStrip chapters={chapters} activeKey={activeKey} plan={plan} onJump={jumpTo} />
      <div ref={feed} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region">
        <div className="flex max-w-[80ch] flex-col gap-region">
          {chapters.map((chapter) => (
            <section
              key={chapter.key}
              {...{ [ANCHOR]: chapter.key }}
              className="flex flex-col gap-region"
            >
              {chapter.compactedBefore && <CompactionMarker />}
              <Seam chapter={chapter} active={chapter.key === activeKey} />
              <TurnFeed rows={chapter.rows} />
              <InlineDelegates delegates={chapter.delegates} />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
