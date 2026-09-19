// What a Session's subagents amount to, read the one way the row's dots and the Agents rail
// both read them (`cockpit-roster-row.html` · SubagentDots, #1269: the two must never disagree).
//
// A Subagent that responded is finished. One that has not responded is running
// only while the Session that made it is live: a Session that settled cannot have work still
// running under it, so its open subagents are unresolved rather than running (#1076). And a
// Session whose own state Argo cannot place cannot be claimed to be delegating either, so its
// subagents are not read at all.
import type { SessionStatus, SessionSubagent } from '../contract/models'

const LIVE: readonly SessionStatus[] = ['starting', 'running', 'permission', 'asking']

export type SubagentReading =
  | { known: false }
  | {
      known: true
      running: SessionSubagent[]
      finished: number
      unresolved: number
    }

export function hasOpenSubagent(subagents: readonly SessionSubagent[]): boolean {
  return subagents.some((subagent) => subagent.state === 'running')
}

export function readSubagentReading(
  status: SessionStatus,
  subagents: readonly SessionSubagent[],
): SubagentReading {
  if (status === 'unknown') return { known: false }
  const open = subagents.filter((subagent) => subagent.state === 'running')
  const live = LIVE.includes(status)
  return {
    known: true,
    running: live ? open : [],
    finished: subagents.length - open.length,
    unresolved: live ? 0 : open.length,
  }
}

export function isLive(status: SessionStatus): boolean {
  return LIVE.includes(status)
}
