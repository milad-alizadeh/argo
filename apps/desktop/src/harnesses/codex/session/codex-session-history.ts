import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest, ThreadReadResponse } from '../app-server'
import { codexCollabFacts, codexFeedContent } from './codex-feed'
import { readCodexNickname } from './codex-subagent-nicknames'

function readThread(request: CodexRequest, threadId: string) {
  return request(
    'thread/read',
    { threadId, includeTurns: true },
    (value) => value as ThreadReadResponse,
  )
}

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const { thread } = await readThread(request, nativeId)
  let rejected = 0
  const content = thread.turns.flatMap((turn) => {
    const collab = codexCollabFacts(turn.items)
    return turn.items.flatMap((item) =>
      codexFeedContent(item, () => (rejected += 1), collab.get(item.id)),
    )
  })
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex history shape(s).`)
  // Each spawned thread is read for the nickname Codex gave it; no history item carries it.
  return Promise.all(
    content.map(async (entry) => {
      if (entry.kind !== 'delegation') return entry
      const nickname = await readCodexNickname(request, entry.agentId)
      return nickname ? { ...entry, nickname } : entry
    }),
  )
}

export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const { thread } = await readThread(request, nativeId)
  return thread.turns.some((turn) => turn.id === turnId)
}
