import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { BasicFeed } from '../feed/document/basic-feed'
import type { FeedLiveFacts } from '../feed/document/feed-live-facts'
import { FeedJumpToLatest } from '../feed/rows/feed-jump-to-latest'
import type { useSessionFeed } from '../feed/use-session-feed'
import type { SessionEvidence } from '../types'

export type SessionWorkspaceProps = {
  composer: ReactNode | null
  header?: ReactNode
  feed: ReturnType<typeof useSessionFeed>['feed']
  feedError: ReturnType<typeof useSessionFeed>['feedError']
  onRetryFeed: ReturnType<typeof useSessionFeed>['retryFeed']
  onLoadOlder?: ReturnType<typeof useSessionFeed>['loadOlder']
  hasOlder?: boolean
  loadingOlder?: boolean
  olderError?: boolean
  jumpToLatest?: (() => void) | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  liveFacts: FeedLiveFacts
  stallTimeoutMs?: number
  onOpenSession: (sessionId: string) => void
  selectedSessionId: string | null
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  onFeedStalledChange?: (sessionId: string | null) => void
}

function ComposerFade({ onJumpToLatest }: { onJumpToLatest: (() => void) | null }) {
  const { t } = useTranslation('sessions')
  return (
    <>
      <div
        aria-hidden="true"
        data-component="SessionComposerFade"
        className="pointer-events-none absolute inset-x-0 top-(--session-composer-fade-start) bottom-0 -z-10 bg-[image:var(--gradient-session-composer-fade)]"
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
  const sectionRef = useRef<HTMLElement>(null)
  const hasComposer = composer !== null
  useLayoutEffect(() => {
    if (!hasComposer) return
    const section = sectionRef.current
    const body = section?.parentElement
    if (!section || !body) return
    const card = section.querySelector<HTMLElement>('[data-component="ComposerCard"]')
    const measure = () => {
      const sectionBounds = section.getBoundingClientRect()
      body.style.setProperty('--session-composer-height', `${sectionBounds.height}px`)
      section.style.setProperty('--session-composer-fade-start', `${sectionBounds.height / 2}px`)
      section.style.setProperty('--session-composer-fade-length', `${sectionBounds.height / 2}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(section)
    if (card) observer.observe(card)
    measure()
    return () => {
      observer.disconnect()
      body.style.removeProperty('--session-composer-height')
    }
  }, [hasComposer])
  if (composer === null) return null
  return (
    <section
      aria-label={t('composerRegionLabel')}
      ref={sectionRef}
      className="session-screen__composer absolute inset-x-0 bottom-0 z-20 isolate flex flex-col px-(--spacing-session-gutter)"
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

export function SessionWorkspace({
  composer,
  header,
  feed,
  feedError,
  onRetryFeed,
  onLoadOlder,
  hasOlder,
  loadingOlder,
  olderError,
  jumpToLatest: externalJumpToLatest = undefined,
  onJumpToLatestChange,
  liveFacts,
  stallTimeoutMs,
  onOpenSession,
  selectedSessionId,
  activeEvidenceId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  onFeedStalledChange,
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
  const handleJumpToLatestChange = onJumpToLatestChange ?? updateJumpToLatest
  const { t } = useTranslation('sessions')

  return (
    <section aria-label={t('workspaceLabel')} className="panel-frame @container relative">
      {header ?? null}
      <div className="panel-body relative bg-(--color-session-surface)">
        {/* A layout wrapper only: `BasicFeed` is its own labelled landmark, so this stays a plain `div` to
          avoid a second "Session Feed" region with the same name. */}
        <div className="session-screen__feed min-h-0 flex-1 overflow-hidden">
          <BasicFeed
            activeEvidenceId={activeEvidenceId}
            answeringQuestionId={answeringQuestionId}
            failure={feedError}
            feed={feed}
            onAnswerQuestion={onAnswerQuestion}
            onOpenEvidence={onOpenEvidence}
            onOpenSession={onOpenSession}
            onJumpToLatestChange={handleJumpToLatestChange}
            onRetryFeed={onRetryFeed}
            onLoadOlder={onLoadOlder}
            hasOlder={hasOlder}
            loadingOlder={loadingOlder}
            olderError={olderError}
            questionFailure={questionFailure}
            selectedSessionId={selectedSessionId}
            onStalledChange={onFeedStalledChange}
            stallTimeoutMs={stallTimeoutMs}
            liveFacts={liveFacts}
          />
        </div>
        <ComposerSection
          composer={composer}
          onJumpToLatest={externalJumpToLatest ?? jumpToLatest?.action ?? null}
        />
      </div>
    </section>
  )
}
