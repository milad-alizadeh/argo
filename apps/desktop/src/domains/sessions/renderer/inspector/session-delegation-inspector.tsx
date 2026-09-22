import { INACTIVE_FEED_LIVE_FACTS, BasicFeed } from '../feed'
// One Subagent's own transcript, drawn in the inspector beside the Session's own Feed rather than
// in place of it (#1582). The document is the Feed's, so a Subagent reads exactly the way the
// Session it belongs to reads.

import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionSubagent } from '@/domains/sessions/contract/model'
import type {
  SessionError,
  SessionEvidence,
  SessionFeed,
  SessionFeedRow,
} from '../types'

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

function responseRow(delegation: SessionSubagent): SessionFeedRow | null {
  if (delegation.state === 'running') return null
  return {
    shape: 'subagent',
    id: `${delegation.id}:responded`,
    subagentId: delegation.id,
    event: 'responded',
    state: delegation.state,
    ...(delegation.label === null ? {} : { name: delegation.label }),
  }
}

// The child transcript is separate from its parent's lifecycle record, so its final event ends the child document.
function withResponseEvent(
  feed: SessionFeed | null,
  delegation: SessionSubagent,
): SessionFeed | null {
  const response = responseRow(delegation)
  if (feed === null || response === null) return feed
  return {
    ...feed,
    revision: `${feed.revision}:${response.id}`,
    rows: [...feed.rows, response],
  }
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
  // What the read has returned so far, or null while the first read is in flight.
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
  const reading = withResponseEvent(feed, delegation)
  return (
    <section
      aria-label={t('subagent')}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      ref={inspector}
    >
      <BasicFeed
        activeEvidenceId={activeEvidenceId}
        answeringQuestionId={null}
        failure={failure}
        feed={reading}
        liveFacts={{ ...INACTIVE_FEED_LIVE_FACTS, isRunning: delegation.state === 'running' }}
        onAnswerQuestion={() => {}}
        onOpenEvidence={onOpenEvidence}
        onOpenSession={onOpenSession}
        onRetryFeed={onRetryFeed}
        questionFailure={() => null}
        selectedSessionId={active ? (reading?.sessionId ?? sessionId) : null}
      />
    </section>
  )
}
