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

// A mention the person typed is part of what they said; only the appended run is Argo's own, and
// what it names is drawn as the prompt's attachments.
function withoutAppendedRun(text: string): { text: string; files: ContentBlock[] } {
  const appended = APPENDED_MENTIONS.exec(text)
  if (appended === null) return { text, files: [] }
  const files = [...(appended[1] ?? '').matchAll(APPENDED_TOKEN)]
    .map(mentionedPath)
    .filter((path) => attachedImageUrl(path) === null)
    .map((path): ContentBlock => ({ shape: 'file', path }))
  return { text: text.slice(0, appended.index), files }
}

// A prompt's images, pasted ones first, then its files follow its blocks, minus their stand-in text.
export function promptBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const hasPastedImage = blocks.some((block) => block.shape === 'image')
  const attached: ContentBlock[] = []
  const withoutStandIns = blocks.flatMap((block): ContentBlock[] => {
    if (block.shape !== 'prose') return [block]
    const images = imageBlocks(
      [...block.text.matchAll(MENTION)].map((match) => attachedImageUrl(mentionedPath(match))),
    )
    const appended = withoutAppendedRun(block.text)
    attached.push(...images, ...appended.files)
    const text = hasPastedImage ? appended.text.replace(EDGE_PLACEHOLDERS, '') : appended.text
    // Only words this emptied are dropped; a prompt that arrived blank stays as it was.
    return text === block.text || text.trim() !== '' ? [{ shape: 'prose', text }] : []
  })
  return [...withoutStandIns, ...attached]
}
