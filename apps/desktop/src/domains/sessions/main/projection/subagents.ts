// One reading of a Session's Subagents for the row's dots and the Agents rail (#1269); an open one is running only while its Session is live (#1076).
import type { SessionStatus, SessionSubagent } from '@/domains/sessions/contract/model'
import { LIVE_ACTIVITY_SILENCE_MS } from '../lifecycle'

const LIVE: readonly SessionStatus[] = ['starting', 'running', 'permission', 'asking']

export type SubagentReading =
  | { known: false }
  | {
      known: true
      running: SessionSubagent[]
      finished: number
      unresolved: number
    }

export function hasOpenSubagent(subagents: readonly SessionSubagent[], now: number): boolean {
  return subagents.some(
    (subagent) =>
      subagent.state === 'running' &&
      subagent.startedAt !== null &&
      now - Date.parse(subagent.startedAt) < LIVE_ACTIVITY_SILENCE_MS,
  )
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
