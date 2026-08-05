import type { FeedRow } from '@shared'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { type Chapter, chapterTitle } from './feedIndex'

// PROTOTYPE — variant A's navigation, and the whole of it. A SPATIAL index rather than a textual
// one: it cannot repeat the feed because it carries no words, only where things are and what kind
// they were. That is also its risk, and the thing to judge — a shape you cannot read is a shape you
// may not be able to aim with.

// One tone per row kind, so a session's shape is legible before a word of it is: what the agent said,
// what it changed, what it merely looked at. Three weights and one accent, not eight.
const ROW_TONE: Record<FeedRow['kind'], string> = {
  prompt: 'bg-primary/70',
  message: 'bg-foreground/40',
  thought: 'bg-foreground/12',
  mutation: 'bg-tone-run',
  call: 'bg-foreground/25',
  quiet: 'bg-foreground/10',
  media: 'bg-foreground/25',
  plan: 'bg-tone-amber/60',
  compaction: 'bg-foreground/8',
}

// A row's tick is taller when the row is longer, so a paragraph does not read as the same event as a
// one-line command. Weights, not pixels: the strip is proportional and always exactly fills the
// track, which is what makes the window over it mean anything.
const weightOf = (row: FeedRow): number => {
  if (row.kind === 'message') return 14
  if (row.kind === 'thought' || row.kind === 'mutation') return 8
  return 4
}

const weightOfAll = (rows: readonly FeedRow[]): number =>
  rows.reduce((total, row) => total + weightOf(row), 0)

function Tick({ row }: { row: FeedRow }): React.JSX.Element {
  return (
    <div
      style={{ flexGrow: weightOf(row) }}
      className={cn('min-h-px w-full basis-0', ROW_TONE[row.kind])}
    />
  )
}

/** One chapter's stack of ticks, and the label that only exists on hover — the strip is silent until
 * you aim at it, which is what keeps it from being a second list of turn titles. */
function ChapterTicks({
  chapter,
  active,
  onJump,
}: {
  chapter: Chapter
  active: boolean
  onJump: (key: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={chapterTitle(chapter)}
      onClick={() => onJump(chapter.key)}
      style={{ flexGrow: weightOfAll(chapter.rows) }}
      className={cn(
        'group relative flex w-full shrink cursor-pointer basis-0 flex-col gap-hair rounded-sm py-hair',
        'border-t border-t-inset-hair first:border-t-0',
        // The SNAP: the chapter under the trip line wears the same lit selection D's strip segments
        // do, so scrolling the feed visibly walks the strip chapter by chapter.
        active && 'border-t-transparent bg-primary/12 ring-1 ring-primary/40',
      )}
    >
      {chapter.rows.map((row) => (
        <Tick key={row.key} row={row} />
      ))}
      <Text
        variant="tag"
        className="pointer-events-none absolute top-0 right-full mr-snug hidden whitespace-nowrap rounded-md bg-popover px-snug py-hair text-foreground group-hover:block"
      >
        {chapterTitle(chapter)}
      </Text>
    </button>
  )
}

/**
 * The whole navigation surface of variant A: a scrubbable density strip on the feed's right edge.
 *
 * It is drawn from the SAME rows the feed renders, so it cannot fall out of step — but it renders
 * none of their words, which is the point: a minimap that repeated the titles would be the pane it
 * replaces, at a quarter of the width.
 */
export function DensityGutter({
  chapters,
  activeKey,
  window: viewport,
  onJump,
  onScrub,
}: {
  chapters: readonly Chapter[]
  activeKey: string | null
  /** Where the reader is: `top` and `height` as fractions of the whole feed. */
  window: { top: number; height: number }
  onJump: (key: string) => void
  onScrub: (ratio: number) => void
}): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const scrubFrom = (clientY: number): void => {
    const box = track.current?.getBoundingClientRect()
    if (box) onScrub(Math.min(1, Math.max(0, (clientY - box.top) / box.height)))
  }
  return (
    <div
      ref={track}
      aria-hidden
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        scrubFrom(event.clientY)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubFrom(event.clientY)
      }}
      className="relative w-nest shrink-0 overflow-hidden border-l border-l-inset-hair px-hair"
    >
      <div className="flex h-full flex-col">
        {chapters.map((chapter) => (
          <ChapterTicks
            key={chapter.key}
            chapter={chapter}
            active={chapter.key === activeKey}
            onJump={onJump}
          />
        ))}
      </div>
      {/* Where you are, as a window over the strip rather than a thumb beside it: the ticks under it
          stay visible, so the window says "you are looking at these events". */}
      <div
        style={{ top: `${viewport.top * 100}%`, height: `${viewport.height * 100}%` }}
        className="pointer-events-none absolute inset-x-0 rounded-sm bg-primary/10 ring-1 ring-primary/40"
      />
    </div>
  )
}
