import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import '../feed/feed.css'
import { readKeptSessionLimit } from '../feed/kept-documents'
import type { SessionFeed as SessionFeedData, SessionId } from '../types'
import { FeedDocument } from './FeedDocument'
import { FeedEmpty } from './FeedEmpty'
import { SessionActivityIndicator } from './SessionActivityIndicator'

type SessionFeedProps = {
  /** The reading for the selected Session, or null while there is nothing settled to draw. */
  feed: SessionFeedData | null
  /** The Session the deck is currently showing, including while its first read is in flight. */
  sessionId: SessionId | null
  /** Whether a Session is selected at all, so a Feed with no reading can tell "being read" from
      "nothing to read". */
  selected: boolean
  /** Why the selected Session's history could not be read, when it could not. */
  failure: string | null
}

// What stands in the Feed's place while no settled history can be drawn. A read or a measure pass
// in progress and a read that failed are one status Marker in the first row's place; nothing
// selected is an empty pane.
function Standing({ selected, failure }: Omit<SessionFeedProps, 'feed' | 'sessionId'>) {
  const { t } = useTranslation()
  if (failure !== null) return <SessionActivityIndicator busy={false} label={failure} />
  if (!selected) return <FeedEmpty reason="unselected" />
  return <SessionActivityIndicator busy label={t('reading')} />
}

export function SessionFeed({ feed, sessionId, selected, failure }: SessionFeedProps) {
  const { t } = useTranslation()
  const [keptDocumentLimit] = useState(() => readKeptSessionLimit(window.localStorage))
  const [documents, setDocuments] = useState<Map<SessionId, SessionFeedData>>(new Map())

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
    if (sessionId === null) return
    setDocuments((previous) => {
      const document = previous.get(sessionId)
      if (document === undefined) return previous
      const next = new Map(previous)
      next.delete(sessionId)
      next.set(sessionId, document)
      return next
    })
  }, [sessionId])

  const current = sessionId === null ? null : (documents.get(sessionId) ?? null)
  const ordered: readonly [SessionId, SessionFeedData][] =
    current === null
      ? [...documents.entries()]
      : [
          [current.sessionId, current],
          ...[...documents.entries()].filter(([id]) => id !== current.sessionId),
        ]

  return (
    <section aria-label={t('feedLabel')} className="feed">
      {ordered.map(([id, document]) => (
        <FeedDocument active={id === sessionId} feed={document} key={id} />
      ))}
      {current === null ? <Standing failure={failure} selected={selected} /> : null}
    </section>
  )
}
