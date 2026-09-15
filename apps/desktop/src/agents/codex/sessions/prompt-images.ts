import { z } from 'zod'
import { isRecord } from '@/boundary'
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

// codex 0.147.0 `TextElement`: a UTF-8 byte range into the text it marks.
const textElementsSchema = z.array(
  z.object({ byte_range: z.object({ start: z.number().int(), end: z.number().int() }) }),
)
const PLACEHOLDER = /^\[Image #\d+\]$/

function placeholderSpans(text: string, elements: unknown) {
  const parsed = textElementsSchema.safeParse(elements)
  if (!parsed.success) return []
  const bytes = new TextEncoder().encode(text)
  const index = (byte: number) => new TextDecoder().decode(bytes.subarray(0, byte)).length
  return parsed.data
    .map(({ byte_range }) => ({ start: index(byte_range.start), end: index(byte_range.end) }))
    .filter(({ start, end }) => PLACEHOLDER.test(text.slice(start, end)))
    .sort((left, right) => left.start - right.start)
}

// The TUI writes `[Image #N]` where an image sat and marks it in `text_elements`
// (composer_submission.rs, rust-v0.147.0). As for Claude, only a run at either end is dropped.
export function withoutEdgePlaceholders(text: string, elements: unknown): string {
  const spans = placeholderSpans(text, elements)
  const blank = (from: number, to: number) => text.slice(from, to).trim() === ''
  let start = 0
  for (const span of spans) {
    if (!blank(start, span.start)) break
    start = span.end
  }
  let end = text.length
  for (const span of [...spans].reverse()) {
    if (span.end <= start || !blank(span.end, end)) break
    end = span.start
  }
  let kept = text.slice(start, Math.max(start, end))
  if (start > 0) kept = kept.trimStart()
  if (end < text.length) kept = kept.trimEnd()
  return kept
}

// Argo sends a non-image attachment as its own text item holding the absolute path (`inputItemsFor`).
const ATTACHED_PATH = /^\/[^\n]+$/

// A `UserMessage` item's blocks, read beside the content they came from: an attached path after
// the prompt becomes a file, and the placeholders an image left go. Only words this emptied are dropped.
export function promptBlocks(content: unknown[], blocks: ContentBlock[]): ContentBlock[] {
  const hasImage = blocks.some((block) => block.shape === 'image')
  let seenProse = false
  return blocks.flatMap((block, position): ContentBlock[] => {
    if (block.shape !== 'prose') return [block]
    const afterPrompt = seenProse
    seenProse = true
    if (afterPrompt && ATTACHED_PATH.test(block.text)) return [{ shape: 'file', path: block.text }]
    const raw = content[position]
    if (!hasImage || !isRecord(raw)) return [block]
    const text = withoutEdgePlaceholders(block.text, raw.text_elements)
    return text === block.text || text.trim() !== '' ? [{ shape: 'prose', text }] : []
  })
}
