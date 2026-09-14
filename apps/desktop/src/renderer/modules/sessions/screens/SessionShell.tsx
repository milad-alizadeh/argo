import { GitFork } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { InspectorSplit } from '../../../components/InspectorSplit'
import { BasicFeed } from '../feed/BasicFeed'
import type { TurnMarkerView } from '../feed/turn-marker'
import type { useSessions } from '../hooks/useSessions'
import type { Session, SessionEvidence, SessionFeedRow } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import { worktreeName } from './session-worktree'
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

// Unmounted rather than hidden: a Session with nothing selected has no composer at all (#2105).
function ComposerSection({
  composer,
  fadeTop,
  label,
  sectionRef,
}: {
  composer: ReactNode | null
  fadeTop: number | null
  label: string
  sectionRef: React.RefObject<HTMLElement | null>
}) {
  if (composer === null) return null
  return (
    <>
      <ComposerFade top={fadeTop} />
      <section
        aria-label={label}
        className="absolute inset-x-0 bottom-0 z-20 isolate px-(--spacing-shell-inset)"
        ref={sectionRef}
      >
        {composer}
      </section>
    </>
  )
}

type SessionShellProps = {
  composer: ReactNode | null
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'cwd' | 'id' | 'title'> | null
  inspector: ReactNode
  inspectorBar?: ReactNode
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

function SessionHeader({ session }: { session: SessionShellProps['session'] }) {
  if (session === null || session === undefined) return null
  const worktree = worktreeName(session.cwd)
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <h1 className="truncate type-heading font-medium">{session.title?.text ?? session.id}</h1>
      {worktree ? (
        <p className="mt-1 flex min-w-0 items-center gap-1 type-meta text-muted-foreground">
          <GitFork aria-hidden="true" className="size-(--size-icon-inline) shrink-0" />
          <span className="truncate">{worktree}</span>
        </p>
      ) : null}
    </div>
  )
}

function SessionHeaderControls({ children }: { children: ReactNode }) {
  return (
    <div
      data-component="SessionHeaderControls"
      className="ml-auto flex shrink-0 items-center gap-1"
    >
      {children}
    </div>
  )
}

export function SessionShell({
  composer,
  headerControls = null,
  session = null,
  inspector,
  inspectorBar = null,
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
  const { t } = useTranslation('sessions')

  return (
    <main
      data-component="SessionShell"
      className="session-screen__shell relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        bar={inspectorBar}
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
            <header
              data-component="SessionHeader"
              className="flex h-(--size-chrome-bar) shrink-0 items-center gap-2 border-b border-border/60 bg-background px-(--spacing-shell-gutter)"
            >
              <SessionHeader session={session} />
              <SessionHeaderControls>{headerControls}</SessionHeaderControls>
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
            <ComposerSection
              composer={composer}
              fadeTop={fadeTop}
              label={t('composerRegionLabel')}
              sectionRef={composerElement}
            />
          </section>
        }
      />
    </main>
  )
}
