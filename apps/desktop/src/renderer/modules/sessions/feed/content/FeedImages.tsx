import { Download, ImageOff, X } from 'lucide-react'
import { type ReactEventHandler, type ReactNode, useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/renderer/components/ui/dialog'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'
import { useImageLightboxTransition } from './imageLightboxTransition'

type ImageSize = { width: number; height: number }

export type FeedImageSource = {
  source: string
  title: string
  alt: string
  // Intrinsic size where it is known. A transcript image carries none, so the gallery's fixed
  // height is what reserves its box (ADR-0035 rule 3).
  size?: ImageSize
  previewSize?: ImageSize
}

function LightboxContent({
  image,
  transition,
}: {
  image: FeedImageSource
  transition: ReturnType<typeof useImageLightboxTransition>
}) {
  return (
    <DialogContent
      showCloseButton={false}
      overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none! data-open:animate-none data-closed:animate-none"
      className="!inset-0 !h-dvh !w-dvw !max-w-none !translate-x-0 !translate-y-0 place-items-center rounded-none bg-transparent p-6 ring-0 duration-0 data-open:animate-none data-closed:animate-none sm:!max-w-none"
    >
      <DialogTitle className="sr-only">{image.title}</DialogTitle>
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
          aria-label={`Download ${image.title}`}
          render={<a href={image.source} download={image.title} />}
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
        src={image.source}
        width={image.previewSize?.width}
        height={image.previewSize?.height}
        alt={image.alt}
        className="relative z-10 max-h-[calc(100dvh-6rem)] max-w-[calc(100dvw-4rem)] rounded-lg object-cover"
      />
    </DialogContent>
  )
}

function triggerClass(compact: boolean, loading: boolean) {
  if (compact)
    return `size-(--size-feed-attachment-preview) shrink-0 cursor-pointer overflow-hidden ${FEED_CARD_RADIUS_CLASS}`
  const frame = loading ? 'w-(--size-feed-image-frame)' : 'cursor-pointer'
  // The ring is drawn inside the frame, because the gallery's scroll box clips anything outside it.
  return `relative h-full shrink-0 overflow-hidden border bg-card focus-visible:-outline-offset-2 ${frame} ${FEED_CARD_RADIUS_CLASS}`
}

export function ImageLightbox({
  image,
  compact = false,
  loading = false,
  onLoad,
  onError,
}: {
  image: FeedImageSource
  compact?: boolean
  loading?: boolean
  onLoad?: ReactEventHandler<HTMLImageElement>
  onError?: () => void
}) {
  const transition = useImageLightboxTransition()

  return (
    <Dialog open={transition.open} onOpenChange={transition.onOpenChange}>
      {/* A frame that has not loaded yet has no size for the lightbox to open to. */}
      <DialogTrigger
        disabled={loading}
        render={
          <button
            type="button"
            className={triggerClass(compact, loading)}
            aria-label={`Open ${image.title} in lightbox`}
            data-state={loading ? 'loading' : 'loaded'}
            onPointerDown={transition.captureSourceBounds}
          />
        }
      >
        <img
          ref={transition.sourceRef}
          src={image.source}
          width={image.size?.width}
          height={image.size?.height}
          alt={image.alt}
          onLoad={onLoad}
          onError={onError}
          // A loading frame stays empty: no alt text and no half-decoded picture.
          className={`${compact ? '!size-full' : '!h-full !w-auto max-w-none'} object-cover ${loading ? 'invisible' : ''}`}
        />
      </DialogTrigger>
      <LightboxContent image={image} transition={transition} />
    </Dialog>
  )
}

export function FeedGallery({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-(--size-feed-gallery) gap-2 overflow-x-auto"
      data-component="FeedGallery"
    >
      {children}
    </div>
  )
}

export function FeedMissingImage({ label }: { label?: string }) {
  return (
    <figure
      className={`aspect-4/3 w-(--size-feed-image-frame) shrink-0 overflow-hidden border bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-card text-muted-foreground">
        <ImageOff className="!size-(--size-icon-control)" />
        <p className="type-meta">Image unavailable</p>
      </div>
      {label ? <figcaption className="sr-only">{label}</figcaption> : null}
    </figure>
  )
}

// A transcript image. An empty `source` is one the Feed refused to load, drawn as the failure.
export function FeedImage({ source, alt }: { source: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
    source === '' ? 'failed' : 'loading',
  )
  // The lightbox measures its preview before that copy decodes, so it takes the natural size here.
  const [previewSize, setPreviewSize] = useState<ImageSize>()
  if (state === 'failed') return <FeedMissingImage label={alt} />
  return (
    <ImageLightbox
      image={{ source, alt, title: alt || 'Image', previewSize }}
      loading={state === 'loading'}
      onLoad={(event) => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget
        setPreviewSize({ width, height })
        setState('loaded')
      }}
      onError={() => setState('failed')}
    />
  )
}
