import {
  FeedGallery,
  type FeedImageSource,
  ImageLightbox,
} from '../../sessions/feed/content/FeedImages'
import { FEED_EVIDENCE, type FeedPrototypeEvidence } from './evidence'

export { FeedMissingImage } from '../../sessions/feed/content/FeedImages'

function prototypeImage(evidence: FeedPrototypeEvidence): FeedImageSource {
  return {
    source: evidence.source,
    title: evidence.title,
    alt: 'Two people reviewing work on a laptop',
    size: { width: 320, height: 213 },
    previewSize: { width: 1280, height: 852 },
  }
}

export function FeedImages() {
  return (
    <FeedGallery>
      <ImageLightbox image={prototypeImage(FEED_EVIDENCE.image)} />
      <ImageLightbox image={prototypeImage(FEED_EVIDENCE.currentImage)} />
    </FeedGallery>
  )
}

export function FeedAttachedImage() {
  return <ImageLightbox image={prototypeImage(FEED_EVIDENCE.image)} compact />
}
