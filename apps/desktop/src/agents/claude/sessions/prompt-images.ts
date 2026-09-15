import { attachmentKindOf } from '@/core/sessions/attachments-contract'
import { fileImageUrl } from '@/core/sessions/feed-images'
import type { ContentBlock } from '@/core/sessions/transcript'

// Claude's TUI writes `[Image #N]` where a pasted image sat; the image block beside it is the picture.
const PASTED_PLACEHOLDER = /\[Image #\d+\] ?/g
const EDGE_PLACEHOLDERS = /^(?:\[Image #\d+\]\s*)+|(?:\s*\[Image #\d+\])+\s*$/g

// Claude's own `@path` file mention; the CLI attaches the image it names.
const MENTION = /(?<=^|\s)@(\/\S+)/g

// The mentions `embedAttachments` appends: the whole prompt, or a run after a blank line.
const APPENDED_MENTIONS = /(?:^|\n\n)(@\/\S+(?: @\/\S+)*)\s*$/

const isImagePath = (path: string) => attachmentKindOf(path) === 'image'

function mentionedImages(text: string): string[] {
  return [...text.matchAll(MENTION)].flatMap(([, path = '']) => {
    const url = isImagePath(path) ? fileImageUrl(path) : null
    return url === null ? [] : [url]
  })
}

// A mention the person typed is part of what they said; only the appended run is Argo's own.
function withoutAppendedImages(text: string): string {
  const run = APPENDED_MENTIONS.exec(text)
  if (run === null) return text
  const kept = (run[1] ?? '').split(' ').filter((token) => !isImagePath(token.slice(1)))
  const head = text.slice(0, run.index)
  return kept.length === 0
    ? head
    : `${head}${run[0].startsWith('\n') ? '\n\n' : ''}${kept.join(' ')}`
}

function withoutPlaceholders(text: string): string {
  return text.replace(EDGE_PLACEHOLDERS, '').replace(PASTED_PLACEHOLDER, '')
}

// A prompt's images become image blocks after everything it carries, pasted ones first, and the
// text that only stood in for them is dropped: the Feed draws the picture itself.
export function withPromptImages(blocks: ContentBlock[]): ContentBlock[] {
  const pasted = blocks.some((block) => block.shape === 'image')
  const mentioned: ContentBlock[] = []
  const read = blocks.flatMap((block): ContentBlock[] => {
    if (block.shape !== 'prose') return [block]
    const images = mentionedImages(block.text)
    mentioned.push(...images.map((url): ContentBlock => ({ shape: 'image', url })))
    const unmentioned = images.length > 0 ? withoutAppendedImages(block.text) : block.text
    const text = pasted ? withoutPlaceholders(unmentioned) : unmentioned
    // Only words this emptied are dropped; a prompt that arrived blank stays as it was.
    return text === block.text || text.trim() !== '' ? [{ shape: 'prose', text }] : []
  })
  return [...read, ...mentioned]
}
