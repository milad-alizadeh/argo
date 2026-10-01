import type { FeedContent } from '@/domains/sessions/api/feed-content'

// How much of the Session the vendor reader returned once the reply landed; a later reply grows it.
export type ReplyMatch = { size: number }

// One real Harness's own history reader, run against the throwaway HOME.
export type VendorHistoryReader<Records> = {
  sessionIds: () => Promise<string[]>
  records: (sessionId: string) => Promise<Records>
  content: (sessionId: string) => Promise<FeedContent[]>
  close: () => void
}

export function replyAfterPrompt(
  content: readonly FeedContent[],
  prompt: string,
): ReplyMatch | null {
  const promptAt = content.findIndex(
    (entry) => entry.kind === 'message' && entry.role === 'user' && entry.text.includes(prompt),
  )
  if (promptAt === -1) return null
  const replied = content
    .slice(promptAt + 1)
    .some((entry) => entry.kind === 'message' && entry.role === 'assistant')
  return replied ? { size: content.length } : null
}

// The first Session whose vendor read shows a reply after `prompt`. A Session part-way through a
// write reads as not yet replied, and the next poll asks again.
export async function vendorReplyAfterPrompt<Records>(
  reader: VendorHistoryReader<Records>,
  prompt: string,
): Promise<ReplyMatch | null> {
  for (const sessionId of await reader.sessionIds()) {
    const content = await reader.content(sessionId).catch(() => [])
    const matched = replyAfterPrompt(content, prompt)
    if (matched !== null) return matched
  }
  return null
}
