import type { ReactNode } from 'react'
import type { SessionShellOutput } from '@/domains/sessions/contract/model/wire/background-work-contract'
import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/contract/model/models'
import type { SessionError, SessionEvidence, SessionFeed } from '@/domains/sessions/renderer/types'
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
  onOpenSession,
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
  onOpenSession: (sessionId: string) => void
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
        onOpenSession={onOpenSession}
        onRetryFeed={onRetryDelegationFeed}
        sessionId={sessionId}
      />
    )
  }
  return <>{handoff}</>
}
