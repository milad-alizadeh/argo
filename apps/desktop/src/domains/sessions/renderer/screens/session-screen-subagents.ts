import type { SessionSubagent } from '@/domains/sessions/renderer/model/models'
import type { SessionFeedRow } from '../types'

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

function foldFeedRows(rows: readonly SessionFeedRow[]): SessionSubagent[] {
  const subagents = new Map<string, SessionSubagent>()
  for (const row of rows) {
    if (row.shape !== 'subagent') continue
    const previous = subagents.get(row.subagentId)
    subagents.set(row.subagentId, {
      id: row.subagentId,
      label: row.name ?? previous?.label ?? null,
      state: stateOf(row),
      startedAt: previous?.startedAt ?? null,
      endedAt: row.event === 'responded' ? (previous?.endedAt ?? null) : null,
    })
  }
  return [...subagents.values()]
}

function stateOf(row: SubagentRow): SessionSubagent['state'] {
  if (row.event !== 'responded') return 'running'
  return row.state ?? 'failed'
}

export function sessionScreenSubagents(
  rows: readonly SessionFeedRow[],
  roster: readonly SessionSubagent[],
): SessionSubagent[] {
  const subagents = new Map(foldFeedRows(rows).map((subagent) => [subagent.id, subagent]))
  // The roster was read at the last sync; the Feed's state is at least as new.
  for (const subagent of roster) {
    const fed = subagents.get(subagent.id)
    subagents.set(subagent.id, {
      ...subagent,
      label: subagent.label ?? fed?.label ?? null,
      state: fed?.state ?? subagent.state,
    })
  }
  return [...subagents.values()]
}
