import type { MediaRowModel } from '@shared'
import { useEffect, useState } from 'react'
import { Text } from '@/shared/components/ui'

// Screenshots as a THUMBNAIL STRIP rather than full-width rows: a visual-debugging turn takes four
// shots, and four 560px images in a column push the prose they explain two screens away. A row of
// thumbs keeps the pictures adjacent to the paragraph; the pixels at size are one click away.

const srcOf = (row: MediaRowModel): string =>
  `data:${row.media.mediaType};base64,${row.media.bytes ?? ''}`

const nameOf = (row: MediaRowModel): string =>
  row.subject?.split('/').at(-1) ?? 'an image the record did not name'

/** The clicked shot at size, over a scrim. Click anywhere, or `esc`, to put it away. `esc` hangs
 * off the window because focus is still on the thumbnail that opened this — a key handler on the
 * scrim would only fire once you had clicked the thing you are trying to dismiss. */
function Lightbox({
  row,
  onClose,
}: {
  row: MediaRowModel
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

/**
 * Organism: a run of consecutive shots as one row of thumbnails. One picture still gets a thumb,
 * not a full-width row — the strip is the feed's media treatment, not a fallback for crowds.
 */
export function ShotGallery({ rows }: { rows: readonly MediaRowModel[] }): React.JSX.Element {
  const [open, setOpen] = useState<MediaRowModel | null>(null)
  return (
    <div data-component="ShotGallery" className="flex flex-wrap gap-gap">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={() => setOpen(row)}
          title={row.subject ?? undefined}
          className="group flex w-44 shrink-0 cursor-zoom-in flex-col gap-hair text-left"
        >
          <img
            src={srcOf(row)}
            alt={row.subject ?? 'what the agent saw'}
            loading="lazy"
            decoding="async"
            className="aspect-video w-full rounded-sm object-cover ring-1 ring-inset-hair group-hover:ring-primary/50"
          />
          <Text variant="code" className="w-full truncate text-foreground-faint">
            {nameOf(row)}
          </Text>
        </button>
      ))}
      {open && <Lightbox row={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
