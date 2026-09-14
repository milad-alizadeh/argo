import { useEffect, useState } from 'react'
import type { SessionFeed, SessionId } from '../types'
import { readKeptSessionLimit } from './kept-documents'

// Kept documents (#1834): a Session's Feed remains mounted, and its scroller state with it, when
// the reader moves away, up to `keptDocumentLimit`. The selected Session's document is always
// drawn first regardless of insertion order.
export function useKeptDocuments(feed: SessionFeed | null, selectedSessionId: SessionId | null) {
  const [keptDocumentLimit] = useState(() => readKeptSessionLimit(window.localStorage))
  const [documents, setDocuments] = useState<Map<SessionId, SessionFeed>>(new Map())

  useEffect(() => {
    if (feed === null) return
    setDocuments((previous) => {
      const held = previous.get(feed.sessionId)
      if (held?.revision === feed.revision) return previous
      const next = new Map(previous)
      next.delete(feed.sessionId)
      next.set(feed.sessionId, feed)
      while (next.size > keptDocumentLimit) {
        const oldest = next.keys().next().value
        if (oldest === undefined) break
        next.delete(oldest)
      }
      return next
    })
  }, [feed, keptDocumentLimit])

  useEffect(() => {
    if (selectedSessionId === null) return
    setDocuments((previous) => {
      const document = previous.get(selectedSessionId)
      if (document === undefined) return previous
      const next = new Map(previous)
      next.delete(selectedSessionId)
      next.set(selectedSessionId, document)
      return next
    })
  }, [selectedSessionId])

  const current = selectedSessionId === null ? null : (documents.get(selectedSessionId) ?? null)
  const ordered =
    current === null
      ? [...documents.entries()]
      : [
          [current.sessionId, current] as const,
          ...[...documents.entries()].filter(([id]) => id !== current.sessionId),
        ]
  return { current, ordered }
}
