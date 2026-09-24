import type { SessionFeedOutput } from '@/domains/sessions/contract/session-history'
import type { SessionFeed } from './types'

export function indexedSessionFeed(
  sessionId: string | null,
  result: SessionFeedOutput | undefined,
): SessionFeed | null {
  if (sessionId === null || result === undefined) return null
  const entries = result.result === 'history' ? result.entries : []
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: sessionId,
    sessionId,
    chainId: sessionId,
    revision: JSON.stringify(entries.map(({ sourceId }) => sourceId)),
    rows: entries.map(({ sourceId, role, text }) => ({
      shape: 'prose' as const,
      id: sourceId,
      role: role === 'system' ? 'assistant' : role,
      text,
    })),
  }
}
