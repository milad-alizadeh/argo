import { Expand, ImageOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/renderer/components/ui/dialog'
import { FEED_EVIDENCE, type FeedPrototypeEvidence } from './evidence'

function ImageLightbox({
  evidence,
  compact = false,
}: {
  evidence: FeedPrototypeEvidence
  compact?: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={
              compact
                ? 'mt-3 flex items-center gap-2 rounded-md border bg-background p-1.5 text-control'
                : 'group relative h-full shrink-0 overflow-hidden rounded-lg border bg-card'
            }
            aria-label={`Open ${evidence.title} in lightbox`}
          />
        }
      >
        <img
          src={evidence.source}
          width={320}
          height={213}
          alt="Two people reviewing work on a laptop"
          className={
            compact ? '!size-10 rounded-sm object-cover' : '!h-full !w-auto max-w-none object-cover'
          }
        />
        {compact ? <span>{evidence.title}</span> : null}
        <span
          className={
            compact
              ? 'ml-2 text-muted-foreground'
              : 'absolute right-2 bottom-2 rounded-md border bg-popover/90 p-1 text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100'
          }
        >
          <Expand className="!size-(--size-icon-inline)" />
        </span>
      </DialogTrigger>
      <DialogContent className="w-fit max-w-[calc(100dvw-3rem)] bg-black/95 p-2 ring-white/15 sm:max-w-[calc(100dvw-3rem)]">
        <DialogTitle className="sr-only">{evidence.title}</DialogTitle>
        <DialogDescription className="sr-only">Full-size image preview</DialogDescription>
        <img
          src={evidence.source}
          width={1280}
          height={852}
          alt="Two people reviewing work on a laptop"
          className="max-h-[calc(100dvh-4rem)] max-w-[calc(100dvw-4rem)] rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}

export function FeedImages() {
  return (
    <div className="flex h-40 gap-2 overflow-x-auto" data-component="FeedGallery">
      <ImageLightbox evidence={FEED_EVIDENCE.image} />
      <ImageLightbox evidence={FEED_EVIDENCE.currentImage} />
    </div>
  )
}

export function FeedMissingImage() {
  return (
    <figure className="flex aspect-4/3 w-52 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
        <ImageOff className="!size-(--size-icon-control)" />
        <p className="text-control">Image unavailable</p>
      </div>
      <figcaption className="px-3 py-2 text-control text-muted-foreground">
        The transcript kept the image reference, but no image bytes are available.
      </figcaption>
    </figure>
  )
}

export function FeedAttachedImage() {
  return <ImageLightbox evidence={FEED_EVIDENCE.image} compact />
}
