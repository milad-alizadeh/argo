import { type ReactNode, useRef } from 'react'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { InspectorSplit } from '../../../components/InspectorSplit'
import { BasicFeed } from '../feed/BasicFeed'
import type { useSessions } from '../hooks/useSessions'
import type { SessionFeedRow } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import { useComposerFadeTop } from './useComposerFadeTop'

import './session-screen.css'

type SessionShellProps = {
  composer: ReactNode
  inspector: ReactNode
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  compactionStartedAt?: string | null
  compactionPercentage?: number | null
  compactionTokens?: string | null
  isRunning: boolean
  selectedSessionId: string | null
  activeEvidenceId: string | null
  onOpenEvidence: (row: Extract<SessionFeedRow, { shape: 'tool' }>) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

export function SessionShell({
  composer,
  inspector,
  feed,
  feedError,
  compactionStartedAt = null,
  compactionPercentage = null,
  compactionTokens = null,
  isRunning,
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
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background px-(--spacing-shell-gutter)">
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
                feed={feed}
                failure={feedError}
                isRunning={isRunning}
                selectedSessionId={selectedSessionId}
                onOpenEvidence={onOpenEvidence}
                onAnswerQuestion={onAnswerQuestion}
                answeringQuestionId={answeringQuestionId}
                questionFailure={questionFailure}
              />
            </section>
            {fadeTop === null ? null : (
              <div
                aria-hidden="true"
                data-component="SessionComposerFade"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[image:var(--gradient-session-composer-fade)]"
                style={{ top: `${fadeTop}px` }}
              />
            )}
            <section
              aria-label="Session composer"
              className="absolute inset-x-0 bottom-0 z-20 isolate px-(--spacing-shell-inset)"
              ref={composerElement}
            >
              {composer}
            </section>
          </section>
        }
      />
    </main>
  )
}
