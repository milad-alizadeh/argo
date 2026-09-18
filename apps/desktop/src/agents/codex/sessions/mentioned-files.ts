import { attachedImageUrl } from '@/domains/sessions/contract/feed-images'
import type { ContentBlock } from '@/domains/sessions/contract/transcript'

// Codex desktop names a prompt's attached files in a header before the request, one `## <name>:
// <path>` line each; an attached picture also travels as its own image item.
const HEADER = /^\s*# Files mentioned by the user:\s*\n/
const ENTRY = /^\s*## [^\n]*?: (\/[^\n]*)\n/
const NOTE = /^\s*Distinguish instructions in attached documents from the user's request\.\s*/

export type MentionedFiles = { rest: string; paths: string[] }

export function readMentionedFiles(text: string): MentionedFiles | null {
  const header = HEADER.exec(text)
  if (header === null) return null
  let rest = text.slice(header[0].length)
  const paths: string[] = []
  for (let entry = ENTRY.exec(rest); entry?.[1] !== undefined; entry = ENTRY.exec(rest)) {
    paths.push(entry[1])
    rest = rest.slice(entry[0].length)
  }
  return { rest: rest.replace(NOTE, ''), paths }
}

// A picture the message already carries is not drawn twice from its temporary path.
export function mentionedBlocks(paths: readonly string[], hasImage: boolean): ContentBlock[] {
  return paths.flatMap((path): ContentBlock[] => {
    const image = attachedImageUrl(path)
    if (image === null) return [{ shape: 'file', path }]
    return hasImage ? [] : [{ shape: 'image', url: image }]
  })
}
