import { MessagesSquare, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
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
import type { SessionError, SessionEvidence, SessionFeed, SessionId } from '../types'
import { FeedDocument } from './FeedDocument'
import { readKeptSessionLimit } from './kept-documents'

import './feed.css'

function Standing({ failure, selected }: { failure: SessionError | null; selected: boolean }) {
  if (failure !== null)
    return (
      <section
        className="grid h-full place-items-center p-6"
        data-state={sessionFailureState(failure.code)}
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

// Kept documents (#1834): a Session's Feed remains mounted, and its scroller state with it, when
// the reader moves away, up to `keptDocumentLimit`. The selected Session's document is always
// drawn first regardless of insertion order.
function useKeptDocuments(feed: SessionFeed | null, selectedSessionId: SessionId | null) {
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

export function BasicFeed({
  feed,
  activeEvidenceId,
  compactionStartedAt = null,
  compactionPercentage = null,
  compactionTokens = null,
  handoffStartedAt = null,
  handoffTo = null,
  onOpenSession,
  failure,
  isRunning,
  selectedSessionId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
}: {
  feed: SessionFeed | null
  activeEvidenceId: string | null
  compactionStartedAt?: string | null
  compactionPercentage?: number | null
  compactionTokens?: string | null
  handoffStartedAt?: string | null
  handoffTo?: string | null
  onOpenSession: (sessionId: string) => void
  failure: SessionError | null
  isRunning: boolean
  selectedSessionId: SessionId | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}) {
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)

  return (
    <section aria-label="Session Feed" className="feed">
      {ordered.map(([id, document]) => (
        <FeedDocument
          active={failure === null && id === selectedSessionId}
          activeEvidenceId={activeEvidenceId}
          compactionStartedAt={id === selectedSessionId ? compactionStartedAt : null}
          compactionPercentage={id === selectedSessionId ? compactionPercentage : null}
          compactionTokens={id === selectedSessionId ? compactionTokens : null}
          handoffStartedAt={id === selectedSessionId ? handoffStartedAt : null}
          handoffTo={id === selectedSessionId ? handoffTo : null}
          onOpenSession={onOpenSession}
          feed={document}
          key={id}
          onOpenEvidence={onOpenEvidence}
          isRunning={isRunning && id === selectedSessionId}
          onAnswerQuestion={onAnswerQuestion}
          answeringQuestionId={answeringQuestionId}
          questionFailure={questionFailure}
        />
      ))}
      {failure !== null || current === null ? (
        <Standing failure={failure} selected={selectedSessionId !== null} />
      ) : null}
    </section>
  )
}
