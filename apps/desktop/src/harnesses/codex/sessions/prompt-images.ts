import { z } from 'zod'
import {
  checkedDataImageUrl,
  fileImageUrl,
  imageBlocks,
} from '@/domains/sessions/contract/model/feed/feed-images'
import type { ContentBlock } from '@/domains/sessions/contract/model/transcript/transcript'
import { isRecord } from '@/shared/validation'

// A `UserMessage` item's own image inputs: a pasted `image` as a data URL, a `local_image` by path.
export function readImage(block: Record<string, unknown>): ContentBlock | null {
  return imageBlocks([imageUrl(block)])[0] ?? null
}

const stringsOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []

// A bare `user_message` event's images (codex-harness 0.147.0 `exec`): `images` inline, `local_images` by path.
export function promptEventImages(payload: Record<string, unknown>): ContentBlock[] {
  return imageBlocks([
    ...stringsOf(payload.images).map(checkedDataImageUrl),
    ...stringsOf(payload.local_images).map(fileImageUrl),
  ])
}

function imageUrl(block: Record<string, unknown>) {
  if (block.type === 'image' && typeof block.image_url === 'string')
    return checkedDataImageUrl(block.image_url)
  if (block.type === 'input_image' && typeof block.image_url === 'string')
    return checkedDataImageUrl(block.image_url)
  if (block.type === 'local_image' && typeof block.path === 'string')
    return fileImageUrl(block.path)
  return null
}

// codex 0.147.0 `TextElement`: a UTF-8 byte range into the text it marks, and its placeholder.
const textElementsSchema = z.array(
  z.object({
    byte_range: z.object({ start: z.number().int(), end: z.number().int() }),
    placeholder: z.string().nullish(),
  }),
)
const IMAGE_PLACEHOLDER = /^\[Image #\d+\]$/

type Mark = { start: number; end: number; path: string | null }

// The TUI marks the `[Image #N]` it wrote where an image sat (composer_submission.rs,
// rust-v0.147.0), and Argo marks an attached path with itself as placeholder (`inputItemsFor`).
function marks(text: string, elements: unknown, hasImage: boolean): Mark[] {
  const parsed = textElementsSchema.safeParse(elements)
  if (!parsed.success) return []
  const bytes = new TextEncoder().encode(text)
  const index = (byte: number) => new TextDecoder().decode(bytes.subarray(0, byte)).length
  return parsed.data
    .flatMap(({ byte_range, placeholder }) => {
      const start = index(byte_range.start)
      const end = index(byte_range.end)
      const slice = text.slice(start, end)
      const path = slice.startsWith('/') && placeholder === slice ? slice : null
      const image = hasImage && IMAGE_PLACEHOLDER.test(slice)
      return path !== null || image ? [{ start, end, path }] : []
    })
    .sort((left, right) => left.start - right.start)
}

// As for Claude, only a run of marks at either end leaves the words; its paths become files.
export function withoutEdgeMarks(text: string, elements: unknown, hasImage: boolean) {
  const found = marks(text, elements, hasImage)
  const blank = (from: number, to: number) => text.slice(from, to).trim() === ''
  let start = 0
  for (const mark of found) {
    if (!blank(start, mark.start)) break
    start = mark.end
  }
  let end = text.length
  for (const mark of [...found].reverse()) {
    if (mark.end <= start || !blank(mark.end, end)) break
    end = mark.start
  }
  let kept = text.slice(start, Math.max(start, end))
  if (start > 0) kept = kept.trimStart()
  if (end < text.length) kept = kept.trimEnd()
  const outside = found.filter((mark) => mark.end <= start || mark.start >= end)
  return { text: kept, files: outside.flatMap((mark) => (mark.path === null ? [] : [mark.path])) }
}

// A prompt's blocks, read beside the content they came from. Only words this emptied are dropped.
export function promptBlocks(content: unknown[], blocks: ContentBlock[]): ContentBlock[] {
  const hasImage = blocks.some((block) => block.shape === 'image')
  return blocks.flatMap((block, position): ContentBlock[] => {
    const raw = content[position]
    if (block.shape !== 'prose' || !isRecord(raw)) return [block]
    const { text, files } = withoutEdgeMarks(block.text, raw.text_elements, hasImage)
    const kept: ContentBlock[] =
      text === block.text || text.trim() !== '' ? [{ shape: 'prose', text }] : []
    return [...kept, ...files.map((path): ContentBlock => ({ shape: 'file', path }))]
  })
}
