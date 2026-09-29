import type { ReactNode } from 'react'
import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/renderer/model/models'
import type { SessionShellOutput } from '@/domains/sessions/renderer/work/types'
import type { SessionError, SessionEvidence, SessionFeed } from '../types'
import { SessionDelegationInspector } from './session-delegation-inspector'
import { SessionEvidenceInspector } from './session-evidence-inspector'
import { SessionShellInspector } from './session-shell-inspector'

// What the inspector shows, in the order the reader's own last act put it: recorded evidence they
// opened from the Feed, then the background work they picked in the header.
export function SessionInspector({
  activeEvidenceId,
  delegation,
  delegationFeed,
  delegationFeedError,
  evidence,
  sessionId,
  handoff,
  onOpenEvidence,
  onRetryDelegationFeed,
  shell,
  shellOutput,
}: {
  activeEvidenceId: string | null
  delegation: SessionSubagent | null
  delegationFeed: SessionFeed | null
  delegationFeedError: SessionError | null
  evidence: SessionEvidence | null
  sessionId: string | null
  // The Sessions this one was handed off to or from, drawn when nothing else is open.
  handoff: ReactNode
  onOpenEvidence: (evidence: SessionEvidence) => void
  onRetryDelegationFeed: () => void
  shell: SessionShellCommand | null
  shellOutput: SessionShellOutput | null
}) {
  if (evidence !== null)
    return <SessionEvidenceInspector evidence={evidence} sessionId={sessionId} />
  if (shell !== null && shellOutput?.state === 'available') {
    return <SessionShellInspector command={shell} output={shellOutput.tail} />
  }
  if (delegation !== null) {
    return (
      <SessionDelegationInspector
        activeEvidenceId={activeEvidenceId}
        delegation={delegation}
        feed={delegationFeed}
        failure={delegationFeedError}
        onOpenEvidence={onOpenEvidence}
        onRetryFeed={onRetryDelegationFeed}
        sessionId={sessionId}
      />
    )
  }
  return <>{handoff}</>
}
