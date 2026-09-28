import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import {
  InspectorHeaderControls,
  InspectorSplit,
} from '@/platform/renderer/cockpit/inspector-split/inspector-split'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { BasicFeed } from '../feed/document/basic-feed'
import type { FeedLiveFacts } from '../feed/document/feed-live-facts'
import { FeedJumpToLatest } from '../feed/rows/feed-jump-to-latest'
import type { useSessionFeed } from '../feed/use-session-feed'
import { SessionTitle } from '../prompt/session-title'
import { sessionName } from '../session-list/rows/session-list-rows'
import type { Session, SessionEvidence } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import type { SessionWorkspaceIdentity } from './session-screen-workspace'

import './session-screen.css'

type SessionShellProps = {
  composer: ReactNode | null
  feed: ReturnType<typeof useSessionFeed>['feed']
  feedError: ReturnType<typeof useSessionFeed>['feedError']
  onRetryFeed: ReturnType<typeof useSessionFeed>['retryFeed']
  onLoadOlder?: ReturnType<typeof useSessionFeed>['loadOlder']
  hasOlder?: boolean
  loadingOlder?: boolean
  olderError?: boolean
  liveFacts: FeedLiveFacts
  stallTimeoutMs?: number
  onOpenSession: (sessionId: string) => void
  selectedSessionId: string | null
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  jumpToLatest?: (() => void) | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'harness' | 'id' | 'status' | 'title'> | null
  workspaceIdentity?: SessionWorkspaceIdentity | null
  inspector: ReactNode
  inspectorBar?: ReactNode
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
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
      className="session-screen__composer relative z-20 isolate flex shrink-0 flex-col overflow-hidden px-(--spacing-session-gutter)"
    >
      <ComposerFade onJumpToLatest={onJumpToLatest} />
      <div
        className="session-screen__composer-scroll flex min-h-0 flex-col"
        data-component="SessionComposerScroll"
      >
        {composer}
      </div>
    </section>
  )
}

function SessionIdentity({
  session,
  workspaceIdentity,
}: {
  session: SessionShellProps['session']
  workspaceIdentity: SessionWorkspaceIdentity | null
}) {
  const { t } = useTranslation('sessions')
  if (session === null || session === undefined) return null
  return (
    <div
      data-component="SessionIdentity"
      className="flex min-w-0 flex-1 flex-col items-start justify-center gap-(--spacing-shell-tight)"
    >
      <h1 className="w-full truncate type-heading">
        <SessionTitle session={session} text={sessionName(session, t('newSession'))} />
      </h1>
      <div
        data-component="SessionMetadata"
        className="flex w-full min-w-0 flex-wrap items-center gap-(--spacing-shell-section) type-meta text-muted-foreground"
      >
        <p
          data-component="SessionIdMetadata"
          className="flex min-w-0 max-w-40 items-center gap-(--spacing-shell-tight)"
        >
          <Icon name="session" size="meta" />
          <span className="shrink-0">{t('identity.sessionId')}</span>
          <code className="min-w-0 truncate font-mono text-foreground">{session.id}</code>
        </p>
        {workspaceIdentity ? (
          <>
            <p
              data-component="SessionWorkspaceMetadata"
              className="flex min-w-0 max-w-48 items-center gap-(--spacing-shell-tight)"
            >
              <Icon name="workspace" className="size-(--size-icon-inline) shrink-0" />
              <span className="shrink-0">{t('identity.workspace')}</span>
              <span className="min-w-0 truncate">{workspaceIdentity.displayName}</span>
            </p>
            {workspaceIdentity.branch === null ? null : (
              <p
                data-component="SessionBranchMetadata"
                className="flex min-w-0 max-w-48 items-center gap-(--spacing-shell-tight)"
              >
                <Icon name="branch" className="size-(--size-icon-inline) shrink-0" />
                <span className="shrink-0">{t('identity.branch')}</span>
                <span className="min-w-0 truncate">{workspaceIdentity.branch}</span>
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

function SessionHeaderControls({ children }: { children: ReactNode }) {
  return (
    <div
      data-component="SessionHeaderControls"
      className="no-drag-region ml-auto flex shrink-0 items-center gap-1"
    >
      {children}
    </div>
  )
}

export function SessionShell({
  headerControls = null,
  session = null,
  workspaceIdentity = null,
  inspector,
  inspectorBar = null,
  defaultInspectorCollapsed = false,
  inspectorReveal = null,
  composer,
  feed,
  feedError,
  onRetryFeed,
  onLoadOlder,
  hasOlder,
  loadingOlder,
  olderError,
  liveFacts,
  stallTimeoutMs,
  onOpenSession,
  selectedSessionId,
  activeEvidenceId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  jumpToLatest = null,
  onJumpToLatestChange,
}: SessionShellProps) {
  const { t } = useTranslation('sessions')
  return (
    <main
      data-component="SessionShell"
      className="session-screen__shell relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        bar={inspectorBar}
        defaultCollapsed={defaultInspectorCollapsed}
        inspector={inspector}
        noun="Session"
        reveal={inspectorReveal}
        sizes={SESSION_SPLIT}
        workspace={
          <section
            aria-label={t('workspaceLabel')}
            className="@container relative flex h-full min-h-0 flex-col"
          >
            <AppPageHeader multiline>
              <SessionIdentity session={session} workspaceIdentity={workspaceIdentity} />
              <SessionHeaderControls>
                {headerControls}
                <InspectorHeaderControls />
              </SessionHeaderControls>
            </AppPageHeader>
            {/* BasicFeed owns the Session Feed landmark, so this layout wrapper stays a div. */}
            <div className="session-screen__feed min-h-0 flex-1 overflow-hidden">
              <BasicFeed
                activeEvidenceId={activeEvidenceId}
                answeringQuestionId={answeringQuestionId}
                failure={feedError}
                feed={feed}
                onAnswerQuestion={onAnswerQuestion}
                onOpenEvidence={onOpenEvidence}
                onOpenSession={onOpenSession}
                onJumpToLatestChange={onJumpToLatestChange}
                onRetryFeed={onRetryFeed}
                onLoadOlder={onLoadOlder}
                hasOlder={hasOlder}
                loadingOlder={loadingOlder}
                olderError={olderError}
                questionFailure={questionFailure}
                selectedSessionId={selectedSessionId}
                stallTimeoutMs={stallTimeoutMs}
                liveFacts={liveFacts}
              />
            </div>
            <ComposerSection composer={composer} onJumpToLatest={jumpToLatest} />
          </section>
        }
      />
    </main>
  )
}
