import { checkedDataImageUrl, fileImageUrl, imageBlocks } from '@/core/sessions/feed-images'
import type { ContentBlock } from '@/core/sessions/transcript'

// A `UserMessage` item's own image inputs: a pasted `image` as a data URL, a `local_image` by path.
export function readImage(block: Record<string, unknown>): ContentBlock | null {
  return imageBlocks([imageUrl(block)])[0] ?? null
}

const stringsOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []

// A bare `user_message` event's images (codex-cli 0.147.0 `exec`): `images` inline, `local_images` by path.
export function promptEventImages(payload: Record<string, unknown>): ContentBlock[] {
  return imageBlocks([
    ...stringsOf(payload.images).map(checkedDataImageUrl),
    ...stringsOf(payload.local_images).map(fileImageUrl),
  ])
}

function imageUrl(block: Record<string, unknown>) {
  if (block.type === 'image' && typeof block.image_url === 'string')
    return checkedDataImageUrl(block.image_url)
  if (block.type === 'local_image' && typeof block.path === 'string')
    return fileImageUrl(block.path)
  return null
}
