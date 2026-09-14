import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { BasicFeed } from '../feed/BasicFeed'
import type { TurnMarkerView } from '../feed/turn-marker'
import type { useSessions } from '../hooks/useSessions'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { useComposerFadeTop } from './useComposerFadeTop'

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

function ComposerFade({ top }: { top: number | null }) {
  if (top === null) return null
  return (
    <div
      aria-hidden="true"
      data-component="SessionComposerFade"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[image:var(--gradient-session-composer-fade)]"
      style={{ top: `${top}px` }}
    />
  )
}

// Unmounted rather than hidden: a Session with nothing selected has no composer at all (#2105).
function ComposerSection({
  composer,
  fadeTop,
  sectionRef,
}: {
  composer: ReactNode | null
  fadeTop: number | null
  sectionRef: React.RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation('sessions')
  if (composer === null) return null
  return (
    <>
      <ComposerFade top={fadeTop} />
      <section
        aria-label={t('composerRegionLabel')}
        className="absolute inset-x-0 bottom-0 z-20 isolate px-(--spacing-shell-inset)"
        ref={sectionRef}
      >
        {composer}
      </section>
    </>
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
  const composerElement = useRef<HTMLElement>(null)
  const workspaceElement = useRef<HTMLElement>(null)
  const fadeTop = useComposerFadeTop({ composerElement, workspaceElement })
  const { t } = useTranslation('sessions')

  return (
    <section
      aria-label={t('workspaceLabel')}
      className="relative flex h-full min-h-0 flex-col"
      ref={workspaceElement}
    >
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
          onRetryFeed={onRetryFeed}
          optimisticRow={optimisticRow}
          posture={posture}
          questionFailure={questionFailure}
          selectedSessionId={selectedSessionId}
          turnMarker={turnMarker}
        />
      </section>
      <ComposerSection composer={composer} fadeTop={fadeTop} sectionRef={composerElement} />
    </section>
  )
}
