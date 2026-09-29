// One Subagent's own transcript, drawn in the inspector beside the Session's own Feed rather than
// in place of it (#1582). The document is the Feed's, so a Subagent reads exactly the way the
// Session it belongs to reads.

import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionSubagent } from '@/domains/sessions/renderer/model/models'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { BasicFeed } from '../feed/document/basic-feed'
import { INACTIVE_FEED_LIVE_FACTS } from '../feed/document/feed-live-facts'
import type { SessionError, SessionEvidence, SessionFeed } from '../types'

import '../feed/feed.css'

function useVisibleInspector() {
  const inspector = useRef<HTMLElement>(null)
  const [active, setActive] = useState(false)
  useLayoutEffect(() => {
    const element = inspector.current
    if (element === null) return
    const synchronizeActive = () => setActive(element.getBoundingClientRect().width > 0)
    const observer = new ResizeObserver(synchronizeActive)
    observer.observe(element)
    synchronizeActive()
    return () => observer.disconnect()
  }, [])
  return { active, inspector }
}

// An ended Subagent whose Feed holds only its own lifecycle events, or whose history the Harness
// cannot find, has no transcript to draw.
function hasNoTranscript(
  delegation: SessionSubagent,
  feed: SessionFeed | null,
  failure: SessionError | null,
) {
  if (failure?.code === 'missing-session') return true
  if (feed === null || failure !== null || delegation.state === 'running') return false
  return feed.rows.every((row) => row.shape === 'subagent' && row.subagentId === delegation.id)
}

function NoTranscript() {
  const { t } = useTranslation('sessions')
  return (
    <Empty className="h-full" data-state="no-transcript">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="agent" />
        </EmptyMedia>
        <EmptyTitle>{t('subagentNoTranscript.title')}</EmptyTitle>
        <EmptyDescription>{t('subagentNoTranscript.description')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function SessionDelegationInspector({
  activeEvidenceId,
  delegation,
  feed,
  failure,
  onOpenEvidence,
  onOpenSession,
  onRetryFeed,
  sessionId,
}: {
  activeEvidenceId: string | null
  delegation: SessionSubagent
  // Main's reading of the Subagent's own chain, ending with its response; null while it loads.
  feed: SessionFeed | null
  failure: SessionError | null
  now?: number
  onOpenEvidence: (evidence: SessionEvidence) => void
  onOpenSession: (sessionId: string) => void
  onRetryFeed: () => void
  sessionId: string | null
}) {
  const { t } = useTranslation('sessions')
  const { active, inspector } = useVisibleInspector()
  return (
    <section
      aria-label={t('subagent')}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      ref={inspector}
    >
      {hasNoTranscript(delegation, feed, failure) ? (
        <NoTranscript />
      ) : (
        <BasicFeed
          activeEvidenceId={activeEvidenceId}
          answeringQuestionId={null}
          failure={failure}
          feed={feed}
          feedLabel={t('subagentFeedLabel')}
          historyLabel={t('subagentHistoryLabel')}
          liveFacts={{ ...INACTIVE_FEED_LIVE_FACTS, isRunning: delegation.state === 'running' }}
          onAnswerQuestion={() => {}}
          onOpenEvidence={onOpenEvidence}
          onOpenSession={onOpenSession}
          onRetryFeed={onRetryFeed}
          questionFailure={() => null}
          selectedSessionId={active ? (feed?.sessionId ?? sessionId) : null}
        />
      )}
    </section>
  )
}
