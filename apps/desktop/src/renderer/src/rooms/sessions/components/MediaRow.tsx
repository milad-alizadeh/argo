import type { MediaResult, MediaRowModel } from '@shared'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ImageIcon, Text } from '@/shared/components/ui'
import { inkFor } from './minimapMatrix'
import { PathSubject } from './PathSubject'
import { BODY_INSET } from './rowRecipes'
import { type RowMark, ToolRow } from './ToolRow'

// The one thing a terminal cannot do at all: the screenshots the agent looked at, in the feed, so a
// visual debugging loop is followed by scrolling rather than by opening files.

const SAW: RowMark = { Icon: ImageIcon, word: 'Saw', tone: inkFor('media') }

/** A call that broke and still returned what it had looked at. The picture is the fact worth showing,
 * and the mark is what stops the row reading as an ordinary successful look. */
const FAILED: RowMark = {
  Icon: ImageIcon,
  word: 'Failed',
  tone: inkFor('media', true),
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
    <Text variant="code" className={cn(BODY_INSET, 'text-foreground-faint')}>
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

/** The picture. Its indent comes from the row that opened it, like every other row's body. */
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
    <>
      {media.tier === 'derived' && <DiskLabel />}
      <MediaImage key={src} src={src} alt={alt} />
    </>
  )
}

/**
 * Organism: one image the agent looked at, inline.
 *
 * What this shows is POINT-IN-TIME, and more sharply than a diff is: agents re-render the same
 * screenshot path several times within one turn, so three reads of one filename are three different
 * pictures and each row shows its OWN. That is why the embedded bytes from the record are the primary
 * source and the file on disk is only ever the labelled fallback — rendering the path would show the
 * newest picture under the oldest paragraph, in exactly the loop this exists to support.
 *
 * The SAME row as every other tool call, drawn by the same component and opened by the same caret —
 * this had its own nested disclosure and its own shown-by-recency rule, so the one row on the
 * surface with the most to show was the one row whose caret behaved differently.
 *
 * `defaultOpen`, and it is the ONLY row that passes it. Everything else on this surface opens onto
 * EVIDENCE — a diff, a log, a line explaining an absence — which supports what the row's own line
 * already said and can wait to be asked for. A picture is not evidence for the row; it IS the row.
 * It is also the one thing a terminal cannot show you at all, which is the whole reason this feed
 * renders images rather than paths.
 *
 * The old decode bound is gone with the nested disclosure and is not replaced: a shot with no bytes
 * mounts no `<img>` at all, and a turn that took many is grouped into `ShotGallery` as thumbnails
 * long before this row would be drawn thirty times.
 */
export function MediaRow({ row }: { row: MediaRowModel }): React.JSX.Element {
  const { subject, status, media } = row
  const named = subject ?? 'an image the record did not name'
  return (
    <ToolRow
      mark={status === 'failed' ? FAILED : SAW}
      // A screenshot's subject is a PATH — `/tmp/argo-shots/cockpit-2026-08-05T18-22-04.png` — so it
      // is cut from the head like every other path on the surface. As a bare string it fell to the
      // row's own LTR truncate and lost the timestamped filename, which is the only part that says
      // which of a turn's six shots this one is.
      subject={<PathSubject path={subject} absent="an image the record did not name" />}
      defaultOpen
      // A picture reaches the box's edges: its own edge IS an edge, and a border-plus-gap around one
      // is two frames around the same rectangle. Its absence LINE is prose, and takes the column.
      bleed
    >
      {media.bytes === null ? (
        <Absent text={absentReason(media.tier)} />
      ) : (
        <MediaBody media={media} bytes={media.bytes} alt={named} />
      )}
    </ToolRow>
  )
}
