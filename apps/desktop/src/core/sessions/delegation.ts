// What a Session's delegations amount to, read the one way the row's dots and the Agents rail
// both read them (`cockpit-roster-row.html` · SubagentDots, #1269: the two must never disagree).
//
// A delegation whose result came back is finished. One whose result has not come back is running
// only while the Session that made it is live: a Session that settled cannot have work still
// running under it, so its open delegations are unresolved rather than running (#1076). And a
// Session whose own state Argo cannot place cannot be claimed to be delegating either, so its
// delegations are not read at all.
import type { SessionDelegation, SessionStatus } from './models'

const LIVE: readonly SessionStatus[] = ['starting', 'running', 'permission', 'asking']

export type DelegationReading =
  | { known: false }
  | {
      known: true
      running: SessionDelegation[]
      finished: number
      unresolved: number
    }

export function readDelegation(
  status: SessionStatus,
  delegations: readonly SessionDelegation[],
): DelegationReading {
  if (status === 'unknown') return { known: false }
  const open = delegations.filter((delegation) => !delegation.landed)
  const live = LIVE.includes(status)
  return {
    known: true,
    running: live ? open : [],
    finished: delegations.length - open.length,
    unresolved: live ? 0 : open.length,
  }
}

export function isLive(status: SessionStatus): boolean {
  return LIVE.includes(status)
}
