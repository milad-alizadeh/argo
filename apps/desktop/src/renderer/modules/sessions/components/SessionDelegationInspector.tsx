// One Subagent's own transcript, drawn in the inspector beside the Session's own Feed rather than
// in place of it (#1582). The document is the Feed's, so a Subagent reads exactly the way the
// Session it belongs to reads.
import type { SessionDelegation } from '@/core/sessions/models'
import { FeedDocument } from '../feed/FeedDocument'
import type { SessionEvidence, SessionFeed } from '../types'
import { workDuration } from './session-work'

import '../feed/feed.css'

export function SessionDelegationInspector({
  activeEvidenceId,
  delegation,
  feed,
  now,
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
  const title = delegation.label ?? delegation.id
  const duration = workDuration(delegation.startedAt, delegation.endedAt, now ?? Date.now())
  return (
    <section aria-label="Subagent" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 py-3">
        <p className="truncate type-meta text-foreground">{title}</p>
        <p className="type-meta text-muted-foreground">
          {[delegation.landed ? 'Landed' : 'Running', duration]
            .filter((fact) => fact !== null)
            .join(' · ')}
        </p>
      </div>
      <div className="feed min-h-0 flex-1">
        {feed === null ? null : (
          <FeedDocument
            active={true}
            activeEvidenceId={activeEvidenceId}
            answeringQuestionId={null}
            compactionStartedAt={null}
            compactionPercentage={null}
            compactionTokens={null}
            feed={feed}
            handoffStartedAt={null}
            handoffTo={null}
            isRunning={!delegation.landed}
            onAnswerQuestion={() => {}}
            onOpenEvidence={onOpenEvidence}
            onOpenSession={onOpenSession}
            questionFailure={() => null}
          />
        )}
      </div>
    </section>
  )
}
