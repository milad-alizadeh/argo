import type { FeedSubagent } from '@/domains/sessions/api/feed/feed-subagents'
import type { SessionSubagent } from '@/domains/sessions/renderer/model/models'

// Main's Feed lists every Subagent its rows name; the roster adds when each ran. Both key by id.
export function sessionScreenSubagents(
  feedSubagents: readonly FeedSubagent[],
  roster: readonly SessionSubagent[],
): SessionSubagent[] {
  const subagents = new Map<string, SessionSubagent>(
    feedSubagents.map((subagent) => [subagent.id, { ...subagent, startedAt: null, endedAt: null }]),
  )
  // The roster was read at the last sync; the Feed's state is at least as new.
  for (const subagent of roster) {
    const current = subagents.get(subagent.id)
    subagents.set(subagent.id, {
      ...subagent,
      label: subagent.label ?? current?.label ?? null,
      state: current?.state ?? subagent.state,
    })
  }
  return [...subagents.values()]
}
