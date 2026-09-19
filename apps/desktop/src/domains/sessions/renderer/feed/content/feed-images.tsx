import { ImageOff } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FEED_CARD_RADIUS_CLASS } from '@/domains/sessions/renderer/feed/content/feed-surface'
import {
  ImageLightbox,
  type ImageSize,
} from '@/domains/sessions/renderer/feed/content/image-lightbox'

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

// `compact` is a prompt's thumbnail: too small to hold the sentence, so it is read, not shown.
export function FeedMissingImage({
  label,
  compact = false,
}: {
  label?: string
  compact?: boolean
}) {
  const { t } = useTranslation('sessions')
  const frame = compact
    ? 'size-(--size-feed-attachment-preview)'
    : 'aspect-4/3 w-(--size-feed-image-frame)'
  return (
    <figure
      className={`${frame} shrink-0 overflow-hidden border bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-card text-muted-foreground">
        <ImageOff className="!size-(--size-icon-control)" />
        <p className={compact ? 'sr-only' : 'type-meta'}>{t('image.unavailable')}</p>
      </div>
      {label ? <figcaption className="sr-only">{label}</figcaption> : null}
    </figure>
  )
}

// A transcript image. An empty `source` is one the Feed refused to load, drawn as the failure.
export function FeedImage({
  source,
  alt,
  openLabel,
  compact = false,
}: {
  source: string
  alt: string
  openLabel?: string
  compact?: boolean
}) {
  const { t } = useTranslation('sessions')
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
    source === '' ? 'failed' : 'loading',
  )
  // The lightbox measures its preview before that copy decodes, so it takes the natural size here.
  const [previewSize, setPreviewSize] = useState<ImageSize>()
  if (state === 'failed') return <FeedMissingImage compact={compact} label={alt} />
  return (
    <ImageLightbox
      image={{ source, alt, openLabel, title: alt || t('image.fallbackTitle'), previewSize }}
      compact={compact}
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
