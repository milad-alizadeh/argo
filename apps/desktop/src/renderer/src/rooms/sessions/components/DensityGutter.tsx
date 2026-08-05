import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { type ChapterModel, chapterTitle } from '../interiorTimeline'
import type { MinimapBlock, MinimapTick } from './minimapGeometry'

// The feed's navigation: a SPATIAL index on its right edge rather than a textual one. It carries no
// words — only where things are and what kind they were — so it cannot repeat the feed it maps.
//
// Everything here is placed from MEASURED geometry (`minimapGeometry.ts`): a block's top and height
// are the exact fractions of the scroll its turn occupies, and a tick's are its row's. The strip is
// therefore the feed at 1:1 scale — the viewport window falls over precisely the events the pane is
// showing, which is the whole claim a minimap makes.

// One tone per row kind, MATCHED to what that row wears in the feed, so the strip is a legend you
// never have to learn: gold is a prompt because the sticky seam is gold, teal is an edit because
// the diff card's added lines are, bright is a screenshot.
const ROW_TONE: Record<string, string> = {
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

const pct = (fraction: number): string => `${fraction * 100}%`

/** A row at the exact fraction of the track its element occupies of the scroll. `min-h-px` so a
 * one-line row in a very long feed is faint rather than absent. */
function Tick({ tick }: { tick: MinimapTick }): React.JSX.Element {
  return (
    <div
      style={{ top: pct(tick.top), height: pct(tick.height) }}
      className={cn('absolute inset-x-0 min-h-px', ROW_TONE[tick.kind] ?? 'bg-foreground/25')}
    />
  )
}

/** One chapter's block, and the label that only exists on hover — the strip is silent until you aim
 * at it, which is what keeps it from being a second list of turn titles. */
function ChapterBlock({
  block,
  title,
  onJump,
}: {
  block: MinimapBlock
  title: string
  onJump: (key: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={() => onJump(block.key)}
      style={{ top: pct(block.top), height: pct(block.height) }}
      // Each turn is its OWN BLOCK — a washed ground behind its ticks — so where one ends and the
      // next begins is visible in the map itself. NO highlight on an active block: where you are is
      // the viewport window's one job.
      className="group absolute inset-x-0 cursor-pointer rounded-sm bg-foreground/4"
    >
      {block.ticks.map((tick) => (
        <Tick key={tick.key} tick={tick} />
      ))}
      <Text
        variant="tag"
        className="pointer-events-none absolute top-0 right-full mr-snug hidden whitespace-nowrap rounded-md bg-popover px-snug py-hair text-foreground group-hover:block"
      >
        {title}
      </Text>
    </button>
  )
}

/**
 * Organism: the scrubbable density strip on the feed's right edge — drawn from the feed's own
 * measured layout, so it maps it 1:1 while rendering none of its words.
 */
export function DensityGutter({
  chapters,
  blocks,
  windowRef,
  onJump,
  onScrub,
}: {
  /** The chapters, for their titles — the geometry comes from `blocks`. */
  chapters: readonly ChapterModel[]
  /** The measured strip: one entry per rendered chapter section. */
  blocks: readonly MinimapBlock[]
  /** The viewport-window overlay. Height is set by `useMinimapWindow`; position is pure CSS. */
  windowRef: React.RefObject<HTMLDivElement | null>
  onJump: (key: string) => void
  onScrub: (ratio: number) => void
}): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const titleOf = (key: string): string => {
    const chapter = chapters.find((candidate) => candidate.key === key)
    return chapter ? chapterTitle(chapter) : ''
  }
  const scrubFrom = (clientY: number): void => {
    const box = track.current?.getBoundingClientRect()
    if (box) onScrub(Math.min(1, Math.max(0, (clientY - box.top) / box.height)))
  }
  return (
    <div
      aria-hidden
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        scrubFrom(event.clientY)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubFrom(event.clientY)
      }}
      className="relative w-[34px] shrink-0 border-l border-l-inset-hair px-hair py-tight"
    >
      {/* The track IS the scroll: its full height maps the feed's scrollHeight, and every block is
          positioned as a fraction of it — no flex weighting between the two. */}
      <div ref={track} className="relative h-full overflow-hidden">
        {blocks.map((block) => (
          <ChapterBlock key={block.key} block={block} title={titleOf(block.key)} onJump={onJump} />
        ))}
        {/* Where you are, as a window over the strip rather than a thumb beside it: the ticks under
            it stay visible, so the window says "you are looking at these events". */}
        <div
          ref={windowRef}
          className="feed-minimap-window pointer-events-none absolute inset-x-0 h-full rounded-sm bg-primary/10 ring-1 ring-primary/40"
        />
      </div>
    </div>
  )
}
