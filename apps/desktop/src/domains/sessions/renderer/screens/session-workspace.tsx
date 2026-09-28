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

// The top of the composer's topmost drawn element (a stacked tray or the card), below the
// transparent band its root pads above them.
function composerInkTop(root: Element | null) {
  const tops = [...(root?.children ?? [])]
    .map((child) => child.getBoundingClientRect())
    .filter((bounds) => bounds.height > 0)
    .map((bounds) => bounds.top)
  return tops.length === 0 ? null : Math.min(...tops)
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasComposer = composer !== null
  useLayoutEffect(() => {
    if (!hasComposer) return
    const section = sectionRef.current
    const scroll = scrollRef.current
    const body = section?.parentElement
    if (!section || !scroll || !body) return
    const measure = () => {
      const sectionBounds = section.getBoundingClientRect()
      const inkTop = composerInkTop(scroll.firstElementChild) ?? sectionBounds.top
      const reach = sectionBounds.bottom - Math.max(inkTop, sectionBounds.top)
      body.style.setProperty('--session-composer-reach', `${reach}px`)
      section.style.setProperty('--session-composer-fade-start', `${sectionBounds.height / 2}px`)
      section.style.setProperty('--session-composer-fade-length', `${sectionBounds.height / 2}px`)
    }
    const resizes = new ResizeObserver(measure)
    resizes.observe(section)
    // The composer root remounts inside the wrapper, so the observer follows the live node and its
    // children: a growing draft, stacked prompts or attachments each resize one of them.
    let observed: Element[] = []
    const mutations = new MutationObserver(() => follow())
    const follow = () => {
      for (const element of observed) resizes.unobserve(element)
      const root = scroll.firstElementChild
      observed = root === null ? [] : [root, ...root.children]
      for (const element of observed) resizes.observe(element)
      if (root !== null) mutations.observe(root, { childList: true })
      measure()
    }
    mutations.observe(scroll, { childList: true })
    follow()
    return () => {
      resizes.disconnect()
      mutations.disconnect()
      body.style.removeProperty('--session-composer-reach')
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
        ref={scrollRef}
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
