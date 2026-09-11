import { Download, Expand, ImageOff, X } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/renderer/components/ui/dialog'
import { FEED_EVIDENCE, type FeedPrototypeEvidence } from './evidence'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'
import { useImageLightboxTransition } from './imageLightboxTransition'

function LightboxContent({
  evidence,
  transition,
}: {
  evidence: FeedPrototypeEvidence
  transition: ReturnType<typeof useImageLightboxTransition>
}) {
  return (
    <DialogContent
      showCloseButton={false}
      overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none! data-open:animate-none data-closed:animate-none"
      className="!inset-0 !h-dvh !w-dvw !max-w-none !translate-x-0 !translate-y-0 place-items-center rounded-none bg-transparent p-6 ring-0 duration-0 data-open:animate-none data-closed:animate-none sm:!max-w-none"
    >
      <DialogTitle className="sr-only">{evidence.title}</DialogTitle>
      <DialogDescription className="sr-only">Full-size image preview</DialogDescription>
      <button
        ref={transition.backdropRef}
        type="button"
        tabIndex={-1}
        aria-label="Close image preview backdrop"
        className="absolute inset-0 border-0 bg-black/60 p-0 will-change-[opacity]"
        onClick={transition.close}
      />
      <div
        ref={transition.controlsRef}
        className="absolute top-4 right-4 z-20 flex items-center gap-2"
      >
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={`Download ${evidence.title}`}
          render={<a href={evidence.source} download={evidence.title} />}
        >
          <Download />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Close image preview"
          onClick={transition.close}
        >
          <X />
        </Button>
      </div>
      <img
        ref={transition.previewRef}
        src={evidence.source}
        width={1280}
        height={852}
        alt="Two people reviewing work on a laptop"
        className="relative z-10 max-h-[calc(100dvh-6rem)] max-w-[calc(100dvw-4rem)] rounded-lg object-cover"
      />
    </DialogContent>
  )
}

function ImageLightbox({
  evidence,
  compact = false,
}: {
  evidence: FeedPrototypeEvidence
  compact?: boolean
}) {
  const transition = useImageLightboxTransition()

  return (
    <Dialog open={transition.open} onOpenChange={transition.onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={
              compact
                ? 'mt-3 flex cursor-pointer items-center gap-2 rounded-md border bg-surface-raised p-1.5 text-left type-meta'
                : `relative h-full shrink-0 cursor-pointer overflow-hidden border bg-surface-raised ${FEED_CARD_RADIUS_CLASS}`
            }
            aria-label={`Open ${evidence.title} in lightbox`}
            onPointerDown={transition.captureSourceBounds}
          />
        }
      >
        <img
          ref={transition.sourceRef}
          src={evidence.source}
          width={320}
          height={213}
          alt="Two people reviewing work on a laptop"
          className={
            compact ? '!size-10 rounded-sm object-cover' : '!h-full !w-auto max-w-none object-cover'
          }
        />
        {compact ? <span className="min-w-0 flex-1 text-left">{evidence.title}</span> : null}
        {compact ? (
          <span className="ml-2 text-muted-foreground">
            <Expand className="!size-(--size-icon-inline)" />
          </span>
        ) : null}
      </DialogTrigger>
      <LightboxContent evidence={evidence} transition={transition} />
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
    <figure
      className={`aspect-4/3 w-52 overflow-hidden border bg-surface-raised ${FEED_CARD_RADIUS_CLASS}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-raised text-muted-foreground">
        <ImageOff className="!size-(--size-icon-control)" />
        <p className="type-meta">Image unavailable</p>
      </div>
    </figure>
  )
}

export function FeedAttachedImage() {
  return <ImageLightbox evidence={FEED_EVIDENCE.image} compact />
}
