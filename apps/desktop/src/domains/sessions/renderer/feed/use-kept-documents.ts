import type { SessionFeed, SessionId } from '@/domains/sessions/renderer/types'

// One active document is enough now that the Feed is virtualized. Retaining inactive documents
// retains their row data, mounted virtualizer state, and rich-content work; repeated switching
// used to grow that retained set to six full transcripts.
export function useKeptDocuments(feed: SessionFeed | null, selectedSessionId: SessionId | null) {
  const current = feed !== null && feed.sessionId === selectedSessionId ? feed : null
  const ordered = current === null ? [] : [[current.sessionId, current] as const]
  return { current, ordered }
}
