import type { FeedRow } from '@shared'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { type Chapter, chapterTitle } from './feedIndex'

// PROTOTYPE — variant A's navigation, and the whole of it. A SPATIAL index rather than a textual
// one: it cannot repeat the feed because it carries no words, only where things are and what kind
// they were. That is also its risk, and the thing to judge — a shape you cannot read is a shape you
// may not be able to aim with.

// One tone per row kind, MATCHED to what that row wears in the feed, so the strip is a legend you
// never have to learn: gold is a prompt because the sticky seam is gold, teal is an edit because the
// diff card's added lines are, bright is a screenshot because thumbs are the brightest thing on the
// surface, red is the failure.
const ROW_TONE: Record<FeedRow['kind'], string> = {
  prompt: 'bg-primary',
  message: 'bg-foreground/45',
  thought: 'bg-foreground/12',
  mutation: 'bg-tone-run',
  call: 'bg-foreground/25',
  quiet: 'bg-foreground/10',
  media: 'bg-foreground/70',
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
  onJump,
}: {
  chapter: Chapter
  onJump: (key: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={chapterTitle(chapter)}
      onClick={() => onJump(chapter.key)}
      style={{ flexGrow: weightOfAll(chapter.rows) }}
      // Each chapter is its OWN BLOCK — rounded, inset from the track, air above and below — so
      // where one turn ends and the next begins is visible in the map itself, not inferred from a
      // hairline. NO highlight on the active block: where you are is the viewport window's one job,
      // and a second lit thing in a 34px strip is noise.
      className="group relative flex w-full shrink cursor-pointer basis-0 flex-col gap-hair rounded-md bg-foreground/4 p-hair"
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

// The window's motion, in the stylesheet rather than a scroll listener: the feed publishes its
// scroll position as a named timeline (`.proto-feed-scroller`, scoped by `.proto-feed-frame`), and
// the window is an animation over it — `top: 0 → 100%` with `translateY(0 → -100%)` so its bottom
// meets the track's bottom exactly at full scroll, whatever its height. Compositor-driven, zero JS,
// the minimap's spelling of what `position: sticky` is for the seams.
const TIMELINE_CSS = `
.proto-feed-frame { timeline-scope: --proto-feed; }
.proto-feed-scroller { scroll-timeline: --proto-feed block; }
.proto-minimap-window { animation: proto-minimap-window linear both; animation-timeline: --proto-feed; }
@keyframes proto-minimap-window {
  from { top: 0; transform: translateY(0); }
  to { top: 100%; transform: translateY(-100%); }
}
`

/**
 * The whole navigation surface of variant A: a scrubbable density strip on the feed's right edge.
 *
 * It is drawn from the SAME rows the feed renders, so it cannot fall out of step — but it renders
 * none of their words, which is the point: a minimap that repeated the titles would be the pane it
 * replaces, at a quarter of the width.
 */
export function DensityGutter({
  chapters,
  windowRef,
  onJump,
  onScrub,
}: {
  chapters: readonly Chapter[]
  /** The viewport-window overlay, positioned by the caller's scroll handler DIRECTLY — style
   * writes, not props — so a scroll never re-renders this component. */
  windowRef: React.RefObject<HTMLDivElement | null>
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
      className="relative w-[34px] shrink-0 overflow-hidden border-l border-l-inset-hair px-hair py-tight"
    >
      <style>{TIMELINE_CSS}</style>
      <div className="flex h-full flex-col gap-tight">
        {chapters.map((chapter) => (
          <ChapterTicks key={chapter.key} chapter={chapter} onJump={onJump} />
        ))}
      </div>
      {/* Where you are, as a window over the strip rather than a thumb beside it: the ticks under it
          stay visible, so the window says "you are looking at these events". */}
      <div
        ref={windowRef}
        className="proto-minimap-window pointer-events-none absolute inset-x-0 h-full rounded-sm bg-primary/10 ring-1 ring-primary/40"
      />
    </div>
  )
}
