// Attachments reach the Claude Code CLI as `@path` file mentions, its own syntax for pointing a
// Turn at a file (verified against Claude Code's own docs, #1845), appended after the draft text
// rather than through a structured channel, since the CLI is driven by pasting plain text into a PTY.
export function embedAttachments(text: string, paths: string[]): string {
  if (paths.length === 0) return text
  const refs = paths.map((path) => `@${path}`).join(' ')
  return text.trim().length > 0 ? `${text}\n\n${refs}` : refs
}
