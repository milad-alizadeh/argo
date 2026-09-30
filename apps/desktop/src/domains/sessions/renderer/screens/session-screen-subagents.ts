import type { FeedSubagent } from '@/domains/sessions/api/feed'
import type { SessionSubagent } from '../types'
import type { WorkSelection } from './work-selection'

// Main's Feed lists every Subagent its rows name; the Session index adds when each ran. Both key by id.
export function sessionScreenSubagents(
  feedSubagents: readonly FeedSubagent[],
  indexed: readonly SessionSubagent[],
): SessionSubagent[] {
  const subagents = new Map<string, SessionSubagent>(
    feedSubagents.map((subagent) => [subagent.id, { ...subagent, startedAt: null, endedAt: null }]),
  )
  // The index was read at the last sync; the Feed's state is at least as new.
  for (const subagent of indexed) {
    const current = subagents.get(subagent.id)
    // Only the Feed knows a nickname; the index never records one.
    const nickname = current?.nickname
    subagents.set(subagent.id, {
      ...subagent,
      ...(nickname === undefined ? {} : { nickname }),
      label: subagent.label ?? current?.label ?? null,
      state: current?.state ?? subagent.state,
    })
  }
  return [...subagents.values()]
}

// The Subagent picked: one the Session lists, or else what the Feed row that opened it said.
export function pickedSubagent(
  subagents: readonly SessionSubagent[],
  work: Pick<WorkSelection, 'subagentId' | 'opened'>,
): SessionSubagent | null {
  const listed = subagents.find((subagent) => subagent.id === work.subagentId)
  if (listed !== undefined) return listed
  if (work.opened === undefined || work.opened.id !== work.subagentId) return null
  return { ...work.opened, startedAt: null, endedAt: null }
}
