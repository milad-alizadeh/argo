import { useCallback, useRef, useState } from 'react'
import { Text, ToggleGroup, ToggleGroupItem } from '@/shared/components/ui'
import { CompactionMarker } from '../components/CompactionMarker'
import { TurnFeed } from '../components/TurnFeed'
import { type Chapter, chapterTitle } from './feedIndex'
import { InlineDelegates } from './InlineDelegates'
import { JumpPalette, usePaletteKey } from './JumpPalette'
import { jumpTargets, LENS_BLURB, LENSES, type Lens, rowCount, throughLens } from './lenses'
import { ANCHOR, useFeedScroll, useStepKeys } from './useFeedScroll'

// PROTOTYPE — VARIANT C · Lens.
//
// The move: you do not navigate a long feed, you SHORTEN it. Pick a lens — changed / said / ran — and
// the sixty-row session becomes an eight-row one you can read top to bottom. When you do want to
// aim at something by name, `⌘K` summons an index richer than a standing pane could afford (turns,
// delegates and touched files in one list) and then puts it away again.
//
// Standing chrome: a floating pill, bottom right. Nothing else. No plan seat, no subagent seat, no
// nav pane — and no permanent index, because an index you only need twice an hour should not be
// on screen for the other fifty-eight minutes.
//
// What to judge: does a lens answer the question the nav pane was answering? And is `⌘K` discoverable
// enough to be the only aim, or does it need the pill to say so louder?

const HEADING = 'text-foreground-faint'

/** The pill: which reading you are in, what it dropped, and the shortcut that summons the index. */
function LensPill({
  lens,
  onLens,
  showing,
  total,
  onOpen,
}: {
  lens: Lens
  onLens: (lens: Lens) => void
  showing: number
  total: number
  onOpen: () => void
}): React.JSX.Element {
  return (
    <div className="pointer-events-auto absolute right-region bottom-region flex flex-col items-end gap-tight">
      <Text
        variant="tag"
        className="rounded-md bg-popover/95 px-snug py-hair text-foreground-faint backdrop-blur"
      >
        {showing} of {total} rows · {LENS_BLURB[lens]}
      </Text>
      <div className="flex items-center gap-snug rounded-xl bg-popover/95 p-hair shadow-lg ring-1 ring-inset-hair backdrop-blur">
        <ToggleGroup
          type="single"
          value={lens}
          onValueChange={(next) => {
            if (next !== '') onLens(next as Lens)
          }}
          className="border-0 p-0"
        >
          {LENSES.map((option) => (
            <ToggleGroupItem key={option} value={option} aria-label={LENS_BLURB[option]}>
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <button
          type="button"
          onClick={onOpen}
          className="cursor-pointer rounded-md px-gap py-tight text-meta text-foreground-faint hover:text-foreground"
        >
          ⌘K jump
        </button>
      </div>
    </div>
  )
}

export function VariantLens({ chapters }: { chapters: readonly Chapter[] }): React.JSX.Element {
  const feed = useRef<HTMLDivElement>(null)
  const [lens, setLens] = useState<Lens>('all')
  const [palette, setPalette] = useState(false)
  const lensed = throughLens(chapters, lens)
  const { jumpTo, step } = useFeedScroll(feed, `${lens}:${lensed.length}`)
  useStepKeys(step)
  usePaletteKey(useCallback(() => setPalette(true), []))

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <div ref={feed} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-region pb-[6rem]">
        <div className="flex max-w-[80ch] flex-col gap-region">
          {lensed.map((chapter) => (
            <section
              key={chapter.key}
              {...{ [ANCHOR]: chapter.key }}
              className="flex flex-col gap-region"
            >
              {chapter.compactedBefore && <CompactionMarker />}
              {/* Under a lens the turn seam has to carry its title: the rows left behind are out of
                  context on their own, and a bare rule between two edits says nothing about which
                  exchange made them. Under `all` it is the same quiet seam every variant uses. */}
              <div className="flex items-baseline gap-snug border-t border-t-inset-hair pt-snug">
                <Text variant="tag" className={HEADING}>
                  {chapter.ordinal}
                </Text>
                <Text variant="tag" className="min-w-0 flex-1 truncate text-foreground-faint">
                  {lens === 'all' ? '' : chapterTitle(chapter)}
                </Text>
                {chapter.hidden > 0 && (
                  <Text variant="tag" className={HEADING}>
                    {chapter.hidden} hidden
                  </Text>
                )}
              </div>
              <TurnFeed rows={chapter.rows} />
              <InlineDelegates delegates={chapter.delegates} />
            </section>
          ))}
        </div>
      </div>
      <LensPill
        lens={lens}
        onLens={setLens}
        showing={rowCount(lensed)}
        total={rowCount(chapters)}
        onOpen={() => setPalette(true)}
      />
      {palette && (
        <JumpPalette
          targets={jumpTargets(chapters)}
          onPick={jumpTo}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  )
}
