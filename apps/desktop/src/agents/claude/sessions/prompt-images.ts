import { attachedImageUrl, imageBlocks } from '@/core/sessions/feed-images'
import type { ContentBlock } from '@/core/sessions/transcript'

// Claude's TUI writes `[Image #N]` where a pasted image sat; the image block beside it is the
// picture. Only a run at either end is dropped: one inside a sentence is part of what it says.
const EDGE_PLACEHOLDERS = /^(?:\[Image #\d+\]\s*)+|(?:\s*\[Image #\d+\])+\s*$/g

// Claude Code 2.1.272's own file mention, `@"a b.png"` or `@/a.png`, which drops a trailing
// punctuation mark from the unquoted form; only absolute paths are drawn.
const MENTION = /(?<=^|[\s。、？！])@(?:"(\/[^"]+)"|(\/\S+)\b)/g
const APPENDED_TOKEN = /@(?:"(\/[^"]+)"|(\/\S+))/g

// The mentions `embedAttachments` appends: the whole prompt, or a run after a blank line.
const APPENDED_MENTIONS = new RegExp(
  `(?:^|\\n\\n)(${APPENDED_TOKEN.source}(?: ${APPENDED_TOKEN.source})*)\\s*$`,
)

const mentionedPath = ([, quoted, bare]: RegExpMatchArray) => quoted ?? bare ?? ''

// A mention the person typed is part of what they said; only the appended run is Argo's own.
function withoutAppendedImages(text: string): string {
  const appended = APPENDED_MENTIONS.exec(text)
  if (appended === null) return text
  const fileMentions = [...(appended[1] ?? '').matchAll(APPENDED_TOKEN)]
    .filter((match) => attachedImageUrl(mentionedPath(match)) === null)
    .map(([token]) => token)
  const before = text.slice(0, appended.index)
  if (fileMentions.length === 0) return before
  return `${before}${appended[0].startsWith('\n') ? '\n\n' : ''}${fileMentions.join(' ')}`
}

// A prompt's images follow its blocks, pasted ones first, and the text that stood in for them goes.
export function withPromptImages(blocks: ContentBlock[]): ContentBlock[] {
  const hasPastedImage = blocks.some((block) => block.shape === 'image')
  const mentioned: ContentBlock[] = []
  const withoutStandIns = blocks.flatMap((block): ContentBlock[] => {
    if (block.shape !== 'prose') return [block]
    const images = imageBlocks(
      [...block.text.matchAll(MENTION)].map((match) => attachedImageUrl(mentionedPath(match))),
    )
    mentioned.push(...images)
    const unmentioned = images.length > 0 ? withoutAppendedImages(block.text) : block.text
    const text = hasPastedImage ? unmentioned.replace(EDGE_PLACEHOLDERS, '') : unmentioned
    // Only words this emptied are dropped; a prompt that arrived blank stays as it was.
    return text === block.text || text.trim() !== '' ? [{ shape: 'prose', text }] : []
  })
  return [...withoutStandIns, ...mentioned]
}
