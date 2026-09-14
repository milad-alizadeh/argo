import type { ReactNode } from 'react'
import type { SessionShellCommand } from '@/core/sessions/models'
import type { Session, SessionEvidence } from '../types'
import { SessionEvidenceInspector } from './SessionEvidenceInspector'
import { SessionShellInspector } from './SessionShellInspector'
import { SessionWorkInspector } from './SessionWorkInspector'

// What the reader picked out of the work rail, held against the Session it was picked in: a
// selection made in one Session says nothing about the next, and keying it this way retires it
// without an effect that fires a frame late (#1582).
export type WorkSelection = {
  sessionId: string | null
  delegationId: string | null
  shellId: string | null
}

// What the inspector shows, in the order the reader's own last act put it: recorded evidence they
// opened from the Feed, then a background Shell they picked, then the work rail itself.
export function SessionInspector({
  delegationTokens,
  evidence,
  handoff,
  onPick,
  session,
  selectedSessionId,
  shell,
  shellOutput,
  work,
}: {
  delegationTokens: Record<string, number | null>
  evidence: SessionEvidence | null
  // The Sessions this one was handed off to or from, drawn under the rail they belong beside.
  handoff: ReactNode
  onPick: (selection: WorkSelection) => void
  session: Session | null
  selectedSessionId: string | null
  shell: SessionShellCommand | null
  shellOutput: string | null
  work: WorkSelection
}) {
  if (evidence !== null) return <SessionEvidenceInspector evidence={evidence} />
  if (shell !== null) {
    return (
      <SessionShellInspector
        command={shell}
        output={shellOutput}
        onBack={() => onPick({ ...work, shellId: null })}
      />
    )
  }
  if (session === null) return null
  return (
    <>
      <SessionWorkInspector
        delegations={session.delegations}
        shell={session.shell}
        delegationTokens={delegationTokens}
        selectedDelegationId={work.delegationId}
        onSelectDelegation={(delegationId) =>
          onPick({ sessionId: selectedSessionId, delegationId, shellId: null })
        }
        selectedShellId={work.shellId}
        onSelectShell={(shellId) => onPick({ ...work, sessionId: selectedSessionId, shellId })}
      />
      {handoff}
    </>
  )
}
