// One Subagent's own transcript, drawn in the inspector beside the Session's own Feed rather than
// in place of it (#1582). The document is the Feed's, so a Subagent reads exactly the way the
// Session it belongs to reads.

import { useTranslation } from 'react-i18next'
import type { SessionDelegation } from '@/core/sessions/models'
import { FeedDocument } from '../../feed/feed-document'
import { INACTIVE_FEED_LIVE_FACTS } from '../../feed/feed-live-facts'
import type { SessionEvidence, SessionFeed } from '../../types'

import '../../feed/feed.css'

export function SessionDelegationInspector({
  activeEvidenceId,
  delegation,
  feed,
  onOpenEvidence,
  onOpenSession,
}: {
  activeEvidenceId: string | null
  delegation: SessionDelegation
  // What the read has returned so far, or null while the first read is in flight.
  feed: SessionFeed | null
  now?: number
  onOpenEvidence: (evidence: SessionEvidence) => void
  onOpenSession: (sessionId: string) => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <section
      aria-label={t('subagent')}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="feed min-h-0 flex-1">
        {feed === null ? (
          <p className="px-(--spacing-shell-item) py-(--spacing-shell-item) type-meta text-muted-foreground">
            {t('subagentLoading')}
          </p>
        ) : (
          <FeedDocument
            actions={{
              active: true,
              activeEvidenceId,
              answeringQuestionId: null,
              onAnswerQuestion: () => {},
              onOpenEvidence,
              onOpenSession,
              questionFailure: () => null,
            }}
            liveFacts={{
              ...INACTIVE_FEED_LIVE_FACTS,
              isRunning: !delegation.landed,
            }}
            reading={feed}
          />
        )}
      </div>
    </section>
  )
}
