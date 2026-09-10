import { Expand, ImageOff } from 'lucide-react'
import { FEED_EVIDENCE, type FeedEvidenceAction, type FeedPrototypeEvidence } from './evidence'

function ImageTile({
  evidence,
  onOpen,
  current = false,
}: {
  evidence: FeedPrototypeEvidence
  onOpen: FeedEvidenceAction
  current?: boolean
}) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => onOpen(evidence)}
        className="group relative block w-full"
        aria-label={`Inspect ${evidence.title}${current ? ', current file' : ', embedded image'}`}
      >
        <img
          src={evidence.source}
          width={320}
          height={213}
          alt="Two people reviewing work on a laptop"
          className="h-28 w-full object-cover"
        />
        <span className="absolute right-2 bottom-2 rounded-md border bg-popover p-1 text-popover-foreground">
          <Expand className="!size-(--size-icon-inline)" />
        </span>
      </button>
      <figcaption className="space-y-0.5 px-2 py-2 text-control">
        <p className="truncate">{evidence.title}</p>
        <p className="text-muted-foreground">{current ? 'Current file' : 'Embedded image'}</p>
      </figcaption>
    </figure>
  )
}

export function FeedImages({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <div className="grid grid-cols-2 gap-2" data-component="FeedGallery">
      <ImageTile evidence={FEED_EVIDENCE.image} onOpen={onOpen} />
      <ImageTile evidence={FEED_EVIDENCE.currentImage} onOpen={onOpen} current />
    </div>
  )
}

export function FeedMissingImage() {
  return (
    <figure className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-28 flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
        <ImageOff className="!size-(--size-icon-control)" />
        <p className="text-control">Image unavailable</p>
      </div>
      <figcaption className="px-3 py-2 text-control text-muted-foreground">
        The transcript kept the image reference, but no image bytes are available.
      </figcaption>
    </figure>
  )
}

export function FeedAttachedImage({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(FEED_EVIDENCE.image)}
      className="mt-3 flex items-center gap-2 rounded-md border bg-background p-1.5 text-control"
    >
      <img
        src={FEED_EVIDENCE.image.source}
        width={320}
        height={213}
        alt="Two people reviewing work on a laptop"
        className="size-10 rounded-sm object-cover"
      />
      <span>workspace-reference.jpg</span>
      <Expand className="ml-2 !size-(--size-icon-inline) text-muted-foreground" />
    </button>
  )
}
