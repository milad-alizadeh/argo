import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text } from '@/shared/components/ui'
import { CompactionMarker } from '../components/CompactionMarker'
import { DISCLOSURE } from '../components/rowRecipes'
import { TurnFeed } from '../components/TurnFeed'
import type { PlanProgressModel } from '../sessionPlan'
import { ChapterBar } from './ChapterBar'
import { type Chapter, chapterTitle, chapterWord, editCount } from './feedIndex'
import { InlineDelegates } from './InlineDelegates'
import { ANCHOR, useFeedScroll, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANT B · Chapters.
//
// The move: the feed IS the navigation. Every turn folds to one row carrying exactly what the nav
// pane's row carried — number, prompt, edits, state — and unfolds in place. So there is no second
// list to fall out of step with the first, because there is only one list, and it is the feed.
//
// Standing chrome is ONE line: `‹ 5 of 8 ›` plus the plan behind a pull-down. Subagents fold into
// the turn that spawned them.
//
// What to judge: is folding a real navigation gesture, or does a feed you have to open feel like
// work? Note the honest cost — a folded turn's prose is not scannable at all, which is the exact
// trade the nav pane was buying.

/** A chapter's folded row: everything you scanned the nav pane for, on one line, in the feed. */
function ChapterHead({
  chapter,
  open,
  active,
  onToggle,
}: {
  chapter: Chapter
  open: boolean
  active: boolean
  onToggle: () => void
}): React.JSX.Element {
  const Caret = open ? CaretDownIcon : CaretRightIcon
  const edits = editCount(chapter)
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        DISCLOSURE,
        'flex w-full items-baseline gap-snug rounded-md px-snug py-tight hover:bg-foreground/4',
        active && 'bg-primary/8',
      )}
    >
      <Text aria-hidden variant="row" className="shrink-0 text-foreground-faint">
        <Caret className="icon-sm" />
      </Text>
      <Text variant="tag" className="w-[2ch] shrink-0 tabular-nums text-foreground-faint">
        {chapter.ordinal}
      </Text>
      <Text
        variant="row"
        className={cn('min-w-0 flex-1 truncate', open ? 'text-foreground' : 'text-foreground-soft')}
      >
        {chapterTitle(chapter)}
      </Text>
      {edits > 0 && (
        <Text variant="tag" className="shrink-0 text-tone-run">
          {edits} edit{edits === 1 ? '' : 's'}
        </Text>
      )}
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        {chapterWord(chapter)}
      </Text>
    </button>
  )
}

/** Which chapters start open: the live one and the one before it. Everything earlier is history, and
 * history that opens itself is history you scroll past. */
const initiallyOpen = (chapters: readonly Chapter[]): Set<string> =>
  new Set(chapters.slice(-2).map((chapter) => chapter.key))

export function VariantChapters({
  chapters,
  plan,
}: {
  chapters: readonly Chapter[]
  plan: PlanProgressModel | null
}): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(() => initiallyOpen(chapters))
  const { activeKey, jumpTo, step } = useFeedScroll(
    feed,
    chapters.map((chapter) => chapter.key).join('|'),
  )
  useStepKeys(step)

  const toggle = (key: string): void =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

  // Stepping OPENS what it lands on: a stepper that walked you to a closed row would be a stepper
  // that showed you nothing.
  const stepAndOpen = (delta: number): void => {
    const at = chapters.findIndex((chapter) => chapter.key === activeKey)
    const next = chapters[Math.min(chapters.length - 1, Math.max(0, at + delta))]
    if (!next) return
    setOpen((current) => new Set(current).add(next.key))
    jumpTo(next.key)
  }

  const current = chapters.find((chapter) => chapter.key === activeKey) ?? chapters[0]

  return (
    <div ref={feed} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region">
      <ChapterBar
        ordinal={current?.ordinal ?? 1}
        total={chapters.length}
        title={current ? chapterTitle(current) : ''}
        plan={plan}
        onStep={stepAndOpen}
      />
      <div className="flex max-w-[82ch] flex-col gap-tight">
        {chapters.map((chapter) => (
          <section
            key={chapter.key}
            {...{ [ANCHOR]: chapter.key }}
            className="flex flex-col gap-region"
          >
            {chapter.compactedBefore && <CompactionMarker />}
            <ChapterHead
              chapter={chapter}
              open={open.has(chapter.key)}
              active={chapter.key === activeKey}
              onToggle={() => toggle(chapter.key)}
            />
            {open.has(chapter.key) && (
              <div className="flex flex-col gap-region pb-region pl-nest">
                <TurnFeed rows={chapter.rows} />
                <InlineDelegates delegates={chapter.delegates} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
