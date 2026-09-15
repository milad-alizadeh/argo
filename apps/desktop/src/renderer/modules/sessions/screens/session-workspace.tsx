import { type ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { BasicFeed } from '../feed/basic-feed'
import { FeedJumpToLatest } from '../feed/feed-jump-to-latest'
import type { TurnMarkerView } from '../feed/turn-marker-state'
import type { useSessions } from '../hooks/use-sessions'
import type { SessionEvidence, SessionFeedRow } from '../types'

export type SessionWorkspaceProps = {
  composer: ReactNode | null
  header: ReactNode
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  onRetryFeed: ReturnType<typeof useSessions>['retryFeed']
  compactionStartedAt?: string | null
  compactionPercentage?: number | null
  compactionTokens?: string | null
  handoffStartedAt?: string | null
  handoffTo?: string | null
  onOpenSession: (sessionId: string) => void
  isRunning: boolean
  posture?: 'managed' | 'external' | null
  optimisticRow?: SessionFeedRow | null
  turnMarker?: TurnMarkerView | null
  selectedSessionId: string | null
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}

function ComposerFade({ onJumpToLatest }: { onJumpToLatest: (() => void) | null }) {
  const { t } = useTranslation('sessions')
  return (
    <>
      <div
        aria-hidden="true"
        data-component="SessionComposerFade"
        className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-session-composer-fade)]"
      />
      {onJumpToLatest === null ? null : (
        <FeedJumpToLatest
          className="absolute bottom-[calc(100%+var(--spacing-shell-item))] left-1/2 -translate-x-1/2"
          label={t('jumpToLatest')}
          onClick={onJumpToLatest}
        />
      )}
    </>
  )
}

// Unmounted rather than hidden: a Session with nothing selected has no composer at all (#2105).
function ComposerSection({
  composer,
  onJumpToLatest,
}: {
  composer: ReactNode | null
  onJumpToLatest: (() => void) | null
}) {
  const { t } = useTranslation('sessions')
  if (composer === null) return null
  return (
    <section
      aria-label={t('composerRegionLabel')}
      className="absolute inset-x-0 bottom-0 z-20 isolate px-(--spacing-session-gutter)"
    >
      <ComposerFade onJumpToLatest={onJumpToLatest} />
      {composer}
    </section>
  )
}

export function SessionWorkspace({
  composer,
  header,
  feed,
  feedError,
  onRetryFeed,
  compactionStartedAt = null,
  compactionPercentage = null,
  compactionTokens = null,
  handoffStartedAt = null,
  handoffTo = null,
  onOpenSession,
  isRunning,
  posture = null,
  optimisticRow = null,
  turnMarker = null,
  selectedSessionId,
  activeEvidenceId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
}: SessionWorkspaceProps) {
  const [jumpToLatest, setJumpToLatest] = useState<{
    action: () => void
    sessionId: string
  } | null>(null)
  const updateJumpToLatest = useCallback((sessionId: string, action: (() => void) | null) => {
    setJumpToLatest((current) => {
      if (action !== null) return { action, sessionId }
      return current?.sessionId === sessionId ? null : current
    })
  }, [])
  const { t } = useTranslation('sessions')

  return (
    <section aria-label={t('workspaceLabel')} className="relative flex h-full min-h-0 flex-col">
      {header}
      <section
        aria-label={t('feedRegionLabel')}
        className="session-screen__feed min-h-0 flex-1 overflow-hidden"
      >
        <BasicFeed
          activeEvidenceId={activeEvidenceId}
          answeringQuestionId={answeringQuestionId}
          compactionPercentage={compactionPercentage}
          compactionStartedAt={compactionStartedAt}
          compactionTokens={compactionTokens}
          failure={feedError}
          feed={feed}
          handoffStartedAt={handoffStartedAt}
          handoffTo={handoffTo}
          isRunning={isRunning}
          onAnswerQuestion={onAnswerQuestion}
          onOpenEvidence={onOpenEvidence}
          onOpenSession={onOpenSession}
          onJumpToLatestChange={updateJumpToLatest}
          onRetryFeed={onRetryFeed}
          optimisticRow={optimisticRow}
          posture={posture}
          questionFailure={questionFailure}
          selectedSessionId={selectedSessionId}
          turnMarker={turnMarker}
        />
      </section>
      <ComposerSection composer={composer} onJumpToLatest={jumpToLatest?.action ?? null} />
    </section>
  )
}
