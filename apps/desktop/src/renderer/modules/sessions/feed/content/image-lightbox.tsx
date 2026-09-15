import { Download, X } from 'lucide-react'
import type { ReactEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/renderer/components/ui/dialog'
import { FEED_CARD_RADIUS_CLASS } from './feed-surface'
import { useImageLightboxTransition } from './image-lightbox-transition'

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

function LightboxContent({
  image,
  transition,
}: {
  image: FeedImageSource
  transition: ReturnType<typeof useImageLightboxTransition>
}) {
  const { t } = useTranslation('sessions')
  return (
    <DialogContent
      showCloseButton={false}
      overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none! data-open:animate-none data-closed:animate-none"
      className="!inset-0 !h-dvh !w-dvw !max-w-none !translate-x-0 !translate-y-0 place-items-center rounded-none bg-transparent p-6 ring-0 duration-0 data-open:animate-none data-closed:animate-none sm:!max-w-none"
    >
      <DialogTitle className="sr-only">{image.title}</DialogTitle>
      <DialogDescription className="sr-only">{t('image.preview')}</DialogDescription>
      <button
        ref={transition.backdropRef}
        type="button"
        tabIndex={-1}
        aria-label={t('image.closeBackdrop')}
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
          aria-label={t('image.download', { title: image.title })}
          nativeButton={false}
          render={<a href={image.source} download={image.title} />}
        >
          <Download />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t('image.close')}
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
        className="relative z-10 max-h-[calc(100dvh-var(--inset-lightbox-margin-y))] max-w-[calc(100dvw-var(--inset-lightbox-margin-x))] rounded-lg object-cover"
      />
    </DialogContent>
  )
}

function triggerClass(compact: boolean, loading: boolean) {
  // The ring is drawn inside the frame, because the frame's own `overflow-hidden` clips it outside.
  const base = `shrink-0 overflow-hidden focus-visible:-outline-offset-2 ${FEED_CARD_RADIUS_CLASS}`
  if (compact) return `size-(--size-feed-attachment-preview) cursor-pointer ${base}`
  const frame = loading ? 'w-(--size-feed-image-frame)' : 'cursor-pointer'
  return `relative h-full border bg-card ${frame} ${base}`
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
      <LightboxContent image={image} transition={transition} />
    </Dialog>
  )
}
