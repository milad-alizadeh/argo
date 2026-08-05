import type { MediaResult, MediaRowModel } from '@shared'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, ImageIcon, Text } from '@/shared/components/ui'
import { FAILED_RING, LoudRow, type RowMark } from './LoudRow'
import { RowGlyph } from './RowGlyph'
import { DISCLOSURE } from './rowRecipes'

// The one thing a terminal cannot do at all: the screenshots the agent looked at, in the feed, so a
// visual debugging loop is followed by scrolling rather than by opening files.

const SAW: RowMark = { Icon: ImageIcon, word: 'Saw', tone: 'text-foreground-soft', ring: '' }

/** A call that broke and still returned what it had looked at. The picture is the fact worth showing,
 * and the mark is what stops the row reading as an ordinary successful look. */
const FAILED: RowMark = {
  Icon: ImageIcon,
  word: 'Failed',
  tone: 'text-tone-red',
  ring: FAILED_RING,
}

/** Why there are no pixels. The two cases are different FACTS about the same absence, and a reader
 * deciding whether to go and look at the file needs to know which. */
function absentReason(tier: MediaResult['tier']): string {
  return tier === 'direct'
    ? 'no image to show: the record declared one but carried no readable bytes'
    : 'no image to show: the file is missing, deleted, or unreadable'
}

/** The line a row wears when there is nothing to look at — and the one an image that will not decode
 * falls back to, which is why a broken-image glyph never reaches the screen. */
function Absent({ text }: { text: string }): React.JSX.Element {
  return (
    <Text variant="code" className="text-foreground-faint">
      {text}
    </Text>
  )
}

/**
 * The pixels, at usable width.
 *
 * `onError` is the whole reason this holds state: a `mediaType` the record declared is not a promise
 * the browser can decode it, and the failure only shows up at render. A row that has run out of ways
 * to show a picture says so in words — the one thing it must never do is leave the browser's own
 * broken-image glyph sitting in the feed. The caller keys this on `src` so a NEW picture starts from
 * scratch rather than inheriting the last one's failure.
 *
 * `decoding="async"` keeps a full-window screenshot off the main thread, so scrolling a turn full of
 * them does not stall the window.
 */
function MediaImage({ src, alt }: { src: string; alt: string }): React.JSX.Element {
  const [broken, setBroken] = useState(false)
  if (broken) return <Absent text="no image to show: these bytes could not be decoded" />
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="max-h-media w-full rounded-sm object-contain object-left"
    />
  )
}

/** The DERIVED tier's label, above the picture rather than below it: it changes what you are looking
 * at, and a caveat read after the fact is a caveat that arrived too late. Absent for the embedded
 * tier, which needs no qualifier — those bytes ARE what the agent saw. */
function DiskLabel(): React.JSX.Element {
  return (
    <Text variant="code" className="text-tone-amber">
      current file, not necessarily what the agent saw
    </Text>
  )
}

/** The picture, indented onto the feed's one column. */
function MediaBody({
  media,
  bytes,
  alt,
}: {
  media: MediaResult
  bytes: string
  alt: string
}): React.JSX.Element {
  const src = `data:${media.mediaType};base64,${bytes}`
  return (
    <div className="flex items-baseline gap-snug">
      {/* The mark column, empty, so the picture starts on the same axis as the row's own word. */}
      <span aria-hidden className="w-mark-col shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        {media.tier === 'derived' && <DiskLabel />}
        <MediaImage key={src} src={src} alt={alt} />
      </div>
    </div>
  )
}

/** What the reader has said about this row, where they have said anything.
 *
 * `auto` is the default and the load-bearing case: it lets the DERIVATION drive, so a shot that falls
 * past the decode bound as newer ones arrive un-mounts its `<img>` instead of staying decoded for the
 * rest of the turn. A plain `defaultOpen` seed cannot do that — it is read once, at mount, and a live
 * turn mounts every shot while it is still the newest one, which is precisely when the bound has not
 * caught up with it yet. An explicit click sticks, because a reader who went looking for an old
 * screenshot should not have it closed under them by the next one arriving. */
type Choice = 'auto' | 'shown' | 'hidden'

/**
 * Organism: one image the agent looked at, inline.
 *
 * What this shows is POINT-IN-TIME, and more sharply than a diff is: agents re-render the same
 * screenshot path several times within one turn, so three reads of one filename are three different
 * pictures and each row shows its OWN. That is why the embedded bytes from the record are the primary
 * source and the file on disk is only ever the labelled fallback — rendering the path would show the
 * newest picture under the oldest paragraph, in exactly the loop this exists to support.
 */
export function MediaRow({ row }: { row: MediaRowModel }): React.JSX.Element {
  const { subject, status, media, open: openByBound } = row
  const [choice, setChoice] = useState<Choice>('auto')
  const open = choice === 'auto' ? openByBound : choice === 'shown'
  const Caret = open ? CaretDownIcon : CaretRightIcon
  const named = subject ?? 'an image the record did not name'
  const mark = status === 'failed' ? FAILED : SAW
  // No pixels, no disclosure: an expander that opens onto a sentence is a row that lied about having
  // a picture behind it. The reason stands on the row itself, as it does for a call that printed
  // nothing.
  if (media.bytes === null) {
    return (
      <LoudRow mark={mark} subject={named}>
        <Absent text={absentReason(media.tier)} />
      </LoudRow>
    )
  }
  return (
    <LoudRow mark={mark} subject={named}>
      <button
        type="button"
        onClick={() => setChoice(open ? 'hidden' : 'shown')}
        aria-expanded={open}
        className={cn(DISCLOSURE, 'flex items-baseline gap-snug')}
      >
        <RowGlyph Icon={Caret} tone="text-foreground-faint" />
        <Text variant="code" className="text-foreground-faint">
          {open ? media.mediaType : `show image · ${media.mediaType}`}
        </Text>
      </button>
      {open && <MediaBody media={media} bytes={media.bytes} alt={named} />}
    </LoudRow>
  )
}
