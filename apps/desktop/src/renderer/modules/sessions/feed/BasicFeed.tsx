import { MessagesSquare, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import { sessionFailureState } from '../sessionFailureState'
import type { SessionError, SessionFeed, SessionId } from '../types'
import { FeedDocument } from './FeedDocument'
import { readKeptSessionLimit } from './kept-documents'

import './feed.css'

function Standing({ failure, selected }: { failure: SessionError | null; selected: boolean }) {
  if (failure !== null)
    return (
      <section
        className="grid h-full place-items-center p-6"
        data-state={sessionFailureState(failure)}
      >
        <Alert className="max-w-sm" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Unable to load Session</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      </section>
    )
  if (!selected)
    return (
      <Empty className="h-full border-0" data-state="unselected">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquare aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Session selected</EmptyTitle>
          <EmptyDescription>Choose a Session from the Roster to read its history.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <section className="grid h-full place-items-center" data-state="loading">
      <Spinner className="size-6" />
    </section>
  )
}

export function BasicFeed({
  feed,
  failure,
  selectedSessionId,
}: {
  feed: SessionFeed | null
  failure: SessionError | null
  selectedSessionId: SessionId | null
}) {
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

  return (
    <section aria-label="Session Feed" className="feed">
      {ordered.map(([id, document]) => (
        <FeedDocument
          active={failure === null && id === selectedSessionId}
          feed={document}
          key={id}
        />
      ))}
      {failure !== null || current === null ? (
        <Standing failure={failure} selected={selectedSessionId !== null} />
      ) : null}
    </section>
  )
}
