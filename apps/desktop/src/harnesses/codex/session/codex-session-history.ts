import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server'
import { readCodexNickname } from './codex-subagent-nicknames'
import { codexTurnContent, codexTurnPages } from './codex-turn-pages'

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const pages = codexTurnPages(request, {
    threadId: nativeId,
    itemsView: 'full',
    sortDirection: 'asc',
  })
  let rejected = 0
  const content: FeedContent[] = []
  for await (const turns of pages) {
    for (const turn of turns) content.push(...codexTurnContent(turn, () => (rejected += 1)))
  }
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

// Newest first, so a Turn just started is found on the first page.
export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const pages = codexTurnPages(request, {
    threadId: nativeId,
    itemsView: 'notLoaded',
    sortDirection: 'desc',
  })
  for await (const turns of pages) if (turns.some((turn) => turn.id === turnId)) return true
  return false
}
