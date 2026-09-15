import type { SessionFeedRow } from './feed-rows'

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type DelegationGroup = Extract<SessionFeedRow, { shape: 'delegation-group' }>

function shellGroup(row: DelegationRow): DelegationGroup | null {
  if (row.actor !== 'shell' || row.groupId === null) return null
  return {
    shape: 'delegation-group',
    id: row.id,
    actor: 'shell',
    groupId: row.groupId,
    entries: [row],
  }
}

// A Shell can report several progress updates for one background task. Keep that one task in a
// compact card instead of making the Feed repeat the same Shell heading for every update.
export function groupDelegations(rows: SessionFeedRow[]): SessionFeedRow[] {
  const grouped: SessionFeedRow[] = []
  for (const row of rows) {
    if (row.shape !== 'delegation') {
      grouped.push(row)
      continue
    }
    const nextGroup = shellGroup(row)
    const previous = grouped.at(-1)
    if (
      nextGroup !== null &&
      previous?.shape === 'delegation-group' &&
      previous.groupId === nextGroup.groupId
    ) {
      previous.entries.push(row)
      continue
    }
    grouped.push(nextGroup ?? row)
  }
  return grouped
}
