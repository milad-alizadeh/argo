import { getSubagentMessages } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'
import { readClaudeTranscriptChain } from './claude-transcript-file'

export function decodeClaudeSessionMessages(messages: readonly unknown[]): FeedContent[] {
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
  const messages =
    subagentId === null
      ? await readClaudeTranscriptChain(nativeId, cwd)
      : await getSubagentMessages(nativeId, subagentId, cwd === null ? {} : { dir: cwd })
  return decodeClaudeSessionMessages(messages)
}
