import type { MediaResult, MediaRowModel } from '@shared'
import { useEffect, useState } from 'react'
import { Text } from '@/shared/components/ui'

// Screenshots as a THUMBNAIL STRIP rather than full-width rows: a visual-debugging turn takes four
// shots, and four 560px images in a column push the prose they explain two screens away. A row of
// thumbs keeps the pictures adjacent to the paragraph; the pixels at size are one click away.

/** The data URI for a shot that HAS bytes. Never called for one that does not — an empty
 * `base64,` payload is a URI the browser cannot decode, and what it renders in its place is the
 * broken-image glyph this surface exists to keep out of the feed. */
const srcOf = (row: MediaRowModel & { media: { bytes: string } }): string =>
  `data:${row.media.mediaType};base64,${row.media.bytes}`

const nameOf = (row: MediaRowModel): string =>
  row.subject?.split('/').at(-1) ?? 'an image the record did not name'

/** Why there are no pixels — the same two facts `MediaRow` reports, because they are facts about
 * the media rather than about the row that draws it. A reader deciding whether to go and open the
 * file needs to know which one it was. */
const absentReason = (tier: MediaResult['tier']): string =>
  tier === 'direct'
    ? 'the record declared an image but carried no readable bytes'
    : 'the file is missing, deleted, or unreadable'

/** A shot with nothing to show, at thumbnail size: the frame is kept so the strip's rhythm holds
 * and the picture's place in the narrative is still visible, and the reason stands in it. */
function AbsentThumb({ reason }: { reason: string }): React.JSX.Element {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-sm bg-foreground/4 px-snug text-center ring-1 ring-inset-hair">
      <Text variant="tag" className="text-foreground-faint">
        {reason}
      </Text>
    </div>
  )
}

/** The picture, with the caveat where one is owed. A `derived` shot is the file as it is NOW, not
 * what the agent looked at — agents re-render one path several times in a turn — so the strip says
 * so rather than passing a current file off as a record of the past. */
function Thumb({ row }: { row: MediaRowModel & { media: { bytes: string } } }): React.JSX.Element {
  // Declaring a `mediaType` is not a promise the browser can decode those bytes, and the failure
  // only shows up at render — so the frame that says why is reachable from here too.
  const [broken, setBroken] = useState(false)
  if (broken) return <AbsentThumb reason="these bytes could not be decoded" />
  return (
    <>
      <img
        src={srcOf(row)}
        alt={row.subject ?? 'what the agent saw'}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="aspect-video w-full rounded-sm object-cover ring-1 ring-inset-hair group-hover:ring-primary/50"
      />
      {row.media.tier === 'derived' && (
        <Text variant="tag" className="w-full truncate text-tone-amber">
          current file
        </Text>
      )}
    </>
  )
}

const hasBytes = (row: MediaRowModel): row is MediaRowModel & { media: { bytes: string } } =>
  row.media.bytes !== null

/** The clicked shot at size, over a scrim. Click anywhere, or `esc`, to put it away. `esc` hangs
 * off the window because focus is still on the thumbnail that opened this — a key handler on the
 * scrim would only fire once you had clicked the thing you are trying to dismiss. */
function Lightbox({
  row,
  onClose,
}: {
  /** Narrowed to a shot that HAS pixels: the lightbox is what you open to look at them, and there
   * is nothing to open for a shot that has none. */
  row: MediaRowModel & { media: { bytes: string } }
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-plane">
      <button
        type="button"
        aria-label="Close the image"
        onClick={onClose}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        className="absolute inset-0 cursor-zoom-out bg-background/80 backdrop-blur-sm"
      />
      <figure className="pointer-events-none relative z-10 flex max-h-full max-w-[min(90vw,1100px)] flex-col gap-snug">
        <img
          src={srcOf(row)}
          alt={row.subject ?? 'what the agent saw'}
          className="min-h-0 rounded-lg object-contain shadow-2xl ring-1 ring-inset-hair"
        />
        <figcaption className="flex items-baseline justify-between gap-snug">
          <Text variant="code" className="min-w-0 truncate text-foreground-soft">
            {row.subject ?? 'unnamed'}
          </Text>
          <Text variant="tag" className="shrink-0 text-foreground-faint">
            esc to close
          </Text>
        </figcaption>
      </figure>
    </div>
  )
}

/** One shot's cell. A shot with pixels is a button that opens them; a shot without is not — an
 * affordance that zooms into nothing is a worse answer than the sentence saying why. */
function Shot({
  row,
  onOpen,
}: {
  row: MediaRowModel
  onOpen: (row: MediaRowModel) => void
}): React.JSX.Element {
  const caption = (
    <Text variant="code" className="w-full truncate text-foreground-faint">
      {nameOf(row)}
    </Text>
  )
  if (!hasBytes(row)) {
    return (
      <div className="flex w-44 shrink-0 flex-col gap-hair">
        <AbsentThumb reason={absentReason(row.media.tier)} />
        {caption}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title={row.subject ?? undefined}
      className="group flex w-44 shrink-0 cursor-zoom-in flex-col gap-hair text-left"
    >
      <Thumb row={row} />
      {caption}
    </button>
  )
}

/**
 * Organism: a run of consecutive shots as one row of thumbnails. One picture still gets a thumb,
 * not a full-width row — the strip is the feed's media treatment, not a fallback for crowds.
 *
 * A shot with no bytes keeps its cell and says why. It must never fall through to an `<img>` with
 * an empty payload: what the browser draws there is its own broken-image glyph, which claims the
 * app is broken rather than that the picture is gone.
 */
export function ShotGallery({ rows }: { rows: readonly MediaRowModel[] }): React.JSX.Element {
  const [open, setOpen] = useState<MediaRowModel | null>(null)
  return (
    // `pl-body-inset` — the same indent an opened row's box takes, so the strip's left edge lands on
    // the GLYPH column every row above it marks with. It sat flush at the feed's left edge, which
    // put it further left than anything else on the surface: a segment of its own rather than the
    // media the rows around it produced.
    <div
      data-component="ShotGallery"
      data-feedrow="media"
      className="flex flex-wrap gap-gap pl-body-inset"
    >
      {rows.map((row) => (
        <Shot key={row.key} row={row} onOpen={setOpen} />
      ))}
      {open && hasBytes(open) && <Lightbox row={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
