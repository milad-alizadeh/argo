import {
  getSessionMessages,
  getSubagentMessages,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'

export function decodeClaudeSessionMessages(messages: readonly SessionMessage[]): FeedContent[] {
  let rejected = 0
  const content = messages.flatMap((entry) =>
    decodeClaudeHistoryContent(entry, () => {
      rejected += 1
    }),
  )
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history shape(s).`)
  return content
}

export async function readClaudeSessionHistory(
  nativeId: string,
  cwd: string | null,
  subagentId: string | null = null,
): Promise<FeedContent[]> {
  const options = cwd === null ? {} : { dir: cwd }
  const messages =
    subagentId === null
      ? await getSessionMessages(nativeId, options)
      : await getSubagentMessages(nativeId, subagentId, options)
  return decodeClaudeSessionMessages(messages)
}
