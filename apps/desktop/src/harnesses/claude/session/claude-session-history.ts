import {
  getSessionMessages,
  getSubagentMessages,
  type SDKMessage,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { claudeFeedContent } from './claude-feed'
import { ClaudeFeedProjection } from './claude-feed-projection'

export function decodeClaudeSessionMessages(messages: readonly SessionMessage[]): FeedContent[] {
  let rejected = 0
  const projection = new ClaudeFeedProjection()
  // A transcript's system records are its own bookkeeping, not the SDK's system messages.
  const content = messages.flatMap((entry) =>
    entry.type === 'system'
      ? []
      : claudeFeedContent(entry as SDKMessage, () => {
          rejected += 1
        }).flatMap((decoded) => projection.project(decoded)),
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
