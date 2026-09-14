import type { ReactNode } from 'react'
import type { SessionDelegation, SessionShellCommand } from '@/core/sessions/models'
import type { SessionEvidence, SessionFeed } from '../types'
import { SessionDelegationInspector } from './SessionDelegationInspector'
import { SessionEvidenceInspector } from './SessionEvidenceInspector'
import { SessionShellInspector } from './SessionShellInspector'

// What the reader picked out of the header's work buttons, held against the Session it was picked
// in: a selection made in one Session says nothing about the next, and keying it this way retires
// it without an effect that fires a frame late (#1582).
export type WorkSelection = {
  sessionId: string | null
  delegationId: string | null
  shellId: string | null
}

// What the inspector shows, in the order the reader's own last act put it: recorded evidence they
// opened from the Feed, then the background work they picked in the header.
export function SessionInspector({
  activeEvidenceId,
  delegation,
  delegationFeed,
  evidence,
  handoff,
  onOpenEvidence,
  onOpenSession,
  shell,
  shellOutput,
}: {
  activeEvidenceId: string | null
  delegation: SessionDelegation | null
  delegationFeed: SessionFeed | null
  evidence: SessionEvidence | null
  // The Sessions this one was handed off to or from, drawn when nothing else is open.
  handoff: ReactNode
  onOpenEvidence: (evidence: SessionEvidence) => void
  onOpenSession: (sessionId: string) => void
  shell: SessionShellCommand | null
  shellOutput: string | null
}) {
  if (evidence !== null) return <SessionEvidenceInspector evidence={evidence} />
  if (shell !== null) {
    return <SessionShellInspector command={shell} output={shellOutput} />
  }
  if (delegation !== null) {
    return (
      <SessionDelegationInspector
        activeEvidenceId={activeEvidenceId}
        delegation={delegation}
        feed={delegationFeed}
        onOpenEvidence={onOpenEvidence}
        onOpenSession={onOpenSession}
      />
    )
  }
  return <>{handoff}</>
}
