import type { ReactNode } from 'react'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { InspectorSplit } from '../../../components/InspectorSplit'
import { BasicFeed } from '../feed/BasicFeed'
import type { useSessions } from '../hooks/useSessions'
import type { SessionFeedRow } from '../types'

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
}

const SESSION_SPLIT = {
  inspector: '--size-session-inspector',
  inspectorMin: '--size-session-inspector-min',
  workspaceMin: '--size-session-workspace-min',
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
}: SessionShellProps) {
  return (
    <main
      data-component="SessionShell"
      className="relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        inspector={inspector}
        noun="Session"
        sizes={SESSION_SPLIT}
        workspace={
          <section aria-label="Session workspace" className="flex h-full min-h-0 flex-col">
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background px-(--spacing-shell-gutter)">
              <span className="flex-1" />
            </header>
            <section aria-label="Session feed" className="min-h-0 flex-1 overflow-hidden">
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
            <section
              aria-label="Session composer"
              className="relative isolate shrink-0 bg-background"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-full h-(--size-session-composer-fade) bg-[image:var(--gradient-session-composer-fade)]"
              />
              {composer}
            </section>
          </section>
        }
      />
    </main>
  )
}
