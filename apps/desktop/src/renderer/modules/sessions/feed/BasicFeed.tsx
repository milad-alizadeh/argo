import { MessagesSquare, TriangleAlert } from 'lucide-react'
import { useCallback, useState } from 'react'
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
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { useKeptDocuments } from './kept-documents'
import { StalledFeed } from './StalledFeed'

import './feed.css'

function Standing({
  failure,
  selected,
  stalled,
  posture,
  onRetry,
}: {
  failure: SessionError | null
  selected: boolean
  stalled: boolean
  posture: 'managed' | 'external' | null
  onRetry: () => void
}) {
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
  if (stalled) return <StalledFeed posture={posture} onRetry={onRetry} />
  return (
    <section className="grid h-full place-items-center" data-state="loading">
      <Spinner className="size-6" />
    </section>
  )
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
  onRetryFeed,
  isRunning,
  posture = null,
  selectedSessionId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
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
  onRetryFeed: () => void
  isRunning: boolean
  posture?: 'managed' | 'external' | null
  selectedSessionId: SessionId | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
}) {
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const [retryToken, setRetryToken] = useState(0)
  const awaitingFeed = failure === null && selectedSessionId !== null && current === null
  const stalled = useStallTimer(
    awaitingFeed ? `${selectedSessionId}:${retryToken}` : false,
    stallTimeoutMs,
  )
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
    onRetryFeed()
  }, [onRetryFeed])

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
          posture={id === selectedSessionId ? posture : null}
          onAnswerQuestion={onAnswerQuestion}
          answeringQuestionId={answeringQuestionId}
          questionFailure={questionFailure}
          stallTimeoutMs={stallTimeoutMs}
        />
      ))}
      {failure !== null || current === null ? (
        <Standing
          failure={failure}
          selected={selectedSessionId !== null}
          stalled={stalled}
          posture={posture}
          onRetry={retry}
        />
      ) : null}
    </section>
  )
}
