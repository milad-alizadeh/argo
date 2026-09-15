import type { SessionAttachmentInput } from '@/core/sessions/attachments-contract'

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
