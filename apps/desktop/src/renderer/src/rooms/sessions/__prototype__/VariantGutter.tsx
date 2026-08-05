import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { CompactionMarker } from '../components/CompactionMarker'
import { TurnFeed } from '../components/TurnFeed'
import { DensityGutter } from './DensityGutter'
import { type Chapter, chapterWord } from './feedIndex'
import { InlineDelegates } from './InlineDelegates'
import { ANCHOR, useFeedScroll, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANT A · Density gutter.
//
// The move: DELETE the nav pane. One full-width feed, and navigation becomes SPATIAL — a strip on
// the right edge that draws the session's shape rather than restating its titles, scrubbable like a
// scrollbar and aimable like a minimap. Nothing textual can repeat, because nothing textual is there.
//
// Plan and subagents lose their standing seats entirely: the plan is already a row in the feed at the
// moment the agent revised it, and a fanout folds into the turn that spawned it.
//
// What to judge: can you actually AIM with a wordless strip? And does the feed at full width read
// better than at half, or does an 1100px-wide paragraph read worse than a cluttered pane cost?

/** A turn's seam: its number and how it ended, on a rule. Not a card and not clickable — in this
 * variant nothing in the feed is navigation, so a seam that looked pressable would lie. */
function Seam({ chapter, active }: { chapter: Chapter; active: boolean }): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-snug border-t border-t-inset-hair pt-snug">
      <Text variant="tag" className={cn(active ? 'text-primary' : 'text-foreground-faint')}>
        {chapter.ordinal}
      </Text>
      <div className="flex-1" />
      <Text variant="tag" className="text-foreground-faint">
        {chapterWord(chapter)}
      </Text>
    </div>
  )
}

export function VariantGutter({ chapters }: { chapters: readonly Chapter[] }): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const { activeKey, progress, visible, jumpTo, step } = useFeedScroll(
    feed,
    chapters.map((chapter) => chapter.key).join('|'),
  )
  useStepKeys(step)

  const scrub = (ratio: number): void => {
    const root = feed.current
    if (root) root.scrollTop = ratio * (root.scrollHeight - root.clientHeight)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div ref={feed} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region">
        {/* A measure, at full width: prose set across 1100px is prose nobody finishes, so the column
            that got its width back spends it on air rather than on line length. */}
        <div className="flex max-w-[78ch] flex-col gap-region">
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
      <DensityGutter
        chapters={chapters}
        window={{ top: progress * (1 - visible), height: visible }}
        onJump={jumpTo}
        onScrub={scrub}
      />
    </div>
  )
}
