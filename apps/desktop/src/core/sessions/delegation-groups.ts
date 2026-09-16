import type { SessionFeedRow } from './feed-rows'

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type DelegationGroup = Extract<SessionFeedRow, { shape: 'delegation-group' }>

function delegationGroup(row: DelegationRow): DelegationGroup | null {
  if (row.groupId === null) return null
  return {
    shape: 'delegation-group',
    id: row.id,
    actor: row.actor,
    groupId: row.groupId,
    entries: [{ ...row, groupId: row.groupId }],
  }
}

function appendEntry(group: DelegationGroup, update: DelegationGroup): void {
  const [entry] = update.entries
  if (entry !== undefined) group.entries.push(entry)
}

// A Shell can report adjacent progress updates, while an Agent lifecycle can span parent rows.
// Keep each activity in one compact card instead of repeating its heading for every update.
export function groupDelegations(rows: SessionFeedRow[]): SessionFeedRow[] {
  const grouped: SessionFeedRow[] = []
  const agentGroups = new Map<string, DelegationGroup>()
  for (const row of rows) {
    if (row.shape !== 'delegation') {
      grouped.push(row)
      continue
    }
    const nextGroup = delegationGroup(row)
    if (nextGroup?.actor === 'agent') {
      const agentGroup = agentGroups.get(nextGroup.groupId)
      if (agentGroup !== undefined) {
        appendEntry(agentGroup, nextGroup)
        continue
      }
      agentGroups.set(nextGroup.groupId, nextGroup)
    }
    const previous = grouped.at(-1)
    if (
      nextGroup !== null &&
      previous?.shape === 'delegation-group' &&
      previous.groupId === nextGroup.groupId &&
      previous.actor === nextGroup.actor
    ) {
      appendEntry(previous, nextGroup)
      continue
    }
    grouped.push(nextGroup ?? row)
  }
  return grouped
}
