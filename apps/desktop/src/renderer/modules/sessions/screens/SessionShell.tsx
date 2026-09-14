import { type ReactNode, useRef } from 'react'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { InspectorSplit } from '../../../components/InspectorSplit'
import { BasicFeed } from '../feed/BasicFeed'
import type { TurnMarkerView } from '../feed/turn-marker'
import type { useSessions } from '../hooks/useSessions'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import { useComposerFadeTop } from './useComposerFadeTop'

import './session-screen.css'

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

type SessionShellProps = {
  composer: ReactNode | null
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  inspector: ReactNode
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
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

export function SessionShell({
  composer,
  headerControls = null,
  inspector,
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
  defaultInspectorCollapsed = false,
  inspectorReveal = null,
}: SessionShellProps) {
  const composerElement = useRef<HTMLElement>(null)
  const workspaceElement = useRef<HTMLElement>(null)
  const fadeTop = useComposerFadeTop({ composerElement, workspaceElement })

  return (
    <main
      data-component="SessionShell"
      className="relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        inspector={inspector}
        defaultCollapsed={defaultInspectorCollapsed}
        noun="Session"
        reveal={inspectorReveal}
        sizes={SESSION_SPLIT}
        workspace={
          <section
            aria-label="Session workspace"
            className="relative flex h-full min-h-0 flex-col"
            ref={workspaceElement}
          >
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center gap-2 border-b border-border/60 bg-background px-(--spacing-shell-gutter)">
              {headerControls}
              <span className="flex-1" />
            </header>
            <section
              aria-label="Session feed"
              className="session-screen__feed min-h-0 flex-1 overflow-hidden"
            >
              <BasicFeed
                activeEvidenceId={activeEvidenceId}
                compactionStartedAt={compactionStartedAt}
                compactionPercentage={compactionPercentage}
                compactionTokens={compactionTokens}
                handoffStartedAt={handoffStartedAt}
                handoffTo={handoffTo}
                onOpenSession={onOpenSession}
                feed={feed}
                failure={feedError}
                onRetryFeed={onRetryFeed}
                isRunning={isRunning}
                posture={posture}
                optimisticRow={optimisticRow}
                turnMarker={turnMarker}
                selectedSessionId={selectedSessionId}
                onOpenEvidence={onOpenEvidence}
                onAnswerQuestion={onAnswerQuestion}
                answeringQuestionId={answeringQuestionId}
                questionFailure={questionFailure}
              />
            </section>
            {composer === null ? null : (
              <>
                <ComposerFade top={fadeTop} />
                <section
                  aria-label="Session composer"
                  className="absolute inset-x-0 bottom-0 z-20 isolate px-(--spacing-shell-inset)"
                  ref={composerElement}
                >
                  {composer}
                </section>
              </>
            )}
          </section>
        }
      />
    </main>
  )
}
