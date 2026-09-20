import { createHash } from 'node:crypto'
import { mkdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'

// Attachments reach the Claude Code CLI as `@path` file mentions, its own syntax for pointing a
// Turn at a file (verified against Claude Code's own docs, #1845), appended after the draft text
// rather than through a structured channel, since the CLI is driven by pasting plain text into a PTY.
// Claude Code 2.1.272 reads `@"a b.png"` whole; unquoted, a mention ends at the first space.
function mention(path: string): string {
  return /\s/.test(path) && !path.includes('"') ? `@"${path}"` : `@${path}`
}

export function embedAttachments(text: string, attachments: SessionAttachmentInput[]): string {
  if (attachments.length === 0) return text
  const refs = attachments.map(({ path }) => mention(path)).join(' ')
  return text.trim().length > 0 ? `${text}\n\n${refs}` : refs
}

const unmentionable = (path: string) => /\s/.test(path) && path.includes('"')

// No mention holds a path with both a space and `"`, so such a file is mentioned through a link
// whose name has no `"`. Claude Code 2.1.273 reads a mention through a link, and reads it at Send.
export function mentionableAttachments(
  attachments: SessionAttachmentInput[],
  linkRoot = join(tmpdir(), 'argo-attachments'),
): Promise<SessionAttachmentInput[]> {
  return Promise.all(
    attachments.map(async (attachment) => {
      if (!unmentionable(attachment.path)) return attachment
      const hash = createHash('sha256').update(attachment.path).digest('hex').slice(0, 16)
      const folder = join(linkRoot, hash)
      const link = join(folder, basename(attachment.path).replaceAll('"', "'"))
      await mkdir(folder, { recursive: true })
      await symlink(attachment.path, link).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error
      })
      return { ...attachment, path: link }
    }),
  )
}
