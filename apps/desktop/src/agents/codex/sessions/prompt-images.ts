import { checkedDataImageUrl, fileImageUrl } from '@/core/sessions/feed-images'
import type { ContentBlock } from '@/core/sessions/transcript'

// A `UserMessage` item's own image inputs: a pasted `image` as a data URL, a `local_image` by path.
export function readImage(block: Record<string, unknown>): ContentBlock | null {
  const url = imageUrl(block)
  return url === null ? null : { shape: 'image', url }
}

function imageUrl(block: Record<string, unknown>): string | null {
  if (block.type === 'image' && typeof block.image_url === 'string')
    return checkedDataImageUrl(block.image_url)
  if (block.type === 'local_image' && typeof block.path === 'string')
    return fileImageUrl(block.path)
  return null
}
