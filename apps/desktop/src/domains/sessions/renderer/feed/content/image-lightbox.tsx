import type { ReactEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogTrigger } from '@/platform/renderer/components/ui/dialog'
import { FEED_CARD_RADIUS_CLASS } from './feed-surface'
import { useImageLightboxTransition } from './image-lightbox-transition'
import { MediaDialog } from './media-dialog'

export type ImageSize = { width: number; height: number }

export type FeedImageSource = {
  source: string
  title: string
  alt: string
  // The trigger's name when the title reads wrong inside `image.open`'s sentence.
  openLabel?: string
  // Intrinsic size where it is known. A transcript image carries none, so the gallery's fixed
  // height is what reserves its box (ADR-0035 rule 3).
  size?: ImageSize
  previewSize?: ImageSize
}

function triggerClass(compact: boolean, loading: boolean) {
  const base = `shrink-0 overflow-hidden border ${FEED_CARD_RADIUS_CLASS}`
  // A thumbnail's ring sits outside it, against the bubble rather than the picture.
  if (compact) return `size-(--size-feed-attachment-preview) cursor-pointer ${base}`
  const frame = loading ? 'w-(--size-feed-image-frame)' : 'cursor-pointer'
  // The gallery's scrolling strip clips anything outside a frame, so its ring is drawn inside.
  return `relative h-full bg-card focus-visible:-outline-offset-2 ${frame} ${base}`
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
  const { t } = useTranslation('sessions')
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
            aria-label={image.openLabel ?? t('image.open', { title: image.title })}
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
      <MediaDialog image={image} transition={transition} />
    </Dialog>
  )
}
