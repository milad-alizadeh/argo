import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { type ChapterModel, chapterTitle } from '../interiorTimeline'
import type { MinimapBlock, MinimapTick } from './minimapGeometry'
import { markFor } from './minimapMatrix'

// The feed's navigation: a SPATIAL index on its right edge rather than a textual one. It carries no
// words — only where things are and what kind they were — so it cannot repeat the feed it maps.
//
// Everything here is placed from MEASURED geometry (`minimapGeometry.ts`): a block's top and height
// are the exact fractions of the scroll its turn occupies, and a tick's are its row's. The strip is
// therefore the feed at 1:1 scale — the viewport window falls over precisely the events the pane is
// showing, which is the whole claim a minimap makes.

// What each mark MEANS is one table, in `minimapMatrix.ts`: hue for the kind, width for how much
// it is worth your attention, red and full width for anything that broke.

const pct = (fraction: number): string => `${fraction * 100}%`

/** How tall one MARK may get, as a fraction of the whole track.
 *
 * A tick is an EVENT, and one event is worth one mark however much column it happened to occupy: an
 * open diff is a thousand pixels of feed and still one edit. Uncapped, a handful of tall rows paint
 * whole regions of the strip in their own tone — a session of fifty edits went solid teal and said
 * nothing about where anything was. */
const TICK_CAP = 0.012

/**
 * A row on the strip: a solid MARK at the top of where it sits, and — when the row runs longer than
 * the mark — a faint EXTENT under it for the rest of its height.
 *
 * Both, because either alone lies. Height straight from the row paints a wall. Capping alone leaves
 * a void: open one diff and the strip grows a blank region exactly where the most content is, which
 * reads as "nothing happened here" — the same failure the cap was introduced to fix, arriving from
 * the other side. So the mark says WHERE the event is and the extent says HOW MUCH SCROLL it costs,
 * and they are told apart by weight rather than conflated into one bar.
 */
function Tick({ tick }: { tick: MinimapTick }): React.JSX.Element {
  const mark = markFor(tick.kind, tick.failed)
  const capped = Math.min(tick.height, TICK_CAP)
  return (
    <>
      {tick.height > TICK_CAP && (
        <div
          style={{ top: pct(tick.top), height: pct(tick.height) }}
          className={cn('absolute right-0 left-0 rounded-[1px] opacity-20', mark.tone, mark.inset)}
        />
      )}
      {/* `min-h-px` so a one-line row in a very long feed is faint rather than absent. `left-0`
          always; `mark.inset` is a RIGHT inset, so a short mark stops early instead of hanging off
          the far edge — the strip then reads the same direction as the column it maps. */}
      <div
        style={{ top: pct(tick.top), height: pct(capped) }}
        className={cn('absolute right-0 left-0 min-h-px rounded-[1px]', mark.tone, mark.inset)}
      />
    </>
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
      //
      // The ground has to out-read the faintest tick standing on it or the block boundary is the
      // one thing in the strip you cannot see, which is why it sits above the fringe tones rather
      // than under them, and why the seam between two blocks is DRAWN as a hairline rather than
      // left to the gap between two washes of nearly the same value.
      className="group absolute inset-x-0 cursor-pointer overflow-hidden rounded-sm border-t border-t-foreground/20 bg-foreground/8"
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
        {/* WHERE YOU ARE — the loudest object in the gutter, and deliberately so: it is the only
            thing here you look for rather than at, and a strip you cannot find yourself on is a
            strip you stop using.
            It BRIGHTENS what it covers rather than tinting over it. A wash of a hue disappears the
            moment it sits on a dense stretch — exactly where you go looking for it — and raising
            the wash buries the ticks it exists to point at. Backdrop brightness lifts the marks
            themselves, so the window is most legible where the strip is busiest.
            The frame is a full gold border rather than a hairline ring, overhanging the track on
            both sides so it reads as a BRACKET around the events rather than as one more band among
            them.
            And the enormous outer shadow is a SPOTLIGHT: a 9999px spread of near-black, clipped by
            the track's `overflow-hidden`, so everything outside the window is dimmed rather than
            the window being brightened against equals. That is the only treatment that scales — a
            window made louder still competes with two hundred marks, while a window that is the
            one thing NOT dimmed cannot be lost however dense the strip gets. */}
        <div
          ref={windowRef}
          className="feed-minimap-window pointer-events-none absolute -inset-x-hair h-full rounded-sm border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.66),0_0_10px_2px_var(--color-primary)] backdrop-brightness-[1.75]"
        />
      </div>
    </div>
  )
}
