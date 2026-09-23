import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'

export type UnifiedRosterSource = {
  harness: string
  nextCursor: string | null
  rows: SessionRosterRow[]
}

export type UnifiedRosterCursor = {
  sources: Record<string, { buffer: SessionRosterRow[]; cursor: string | null }>
}

function compareActivity(left: SessionRosterRow, right: SessionRosterRow) {
  const activity = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
  if (activity !== 0) return activity
  const harness = left.harness.localeCompare(right.harness)
  return harness !== 0 ? harness : left.id.localeCompare(right.id)
}

// The cursor retains each provider's unused rows so a shorter page cannot reorder the next merge.
export function mergeRosterPage(sources: UnifiedRosterSource[], pageSize: number) {
  const queues = sources.map((source) => ({
    ...source,
    rows: [...source.rows].sort(compareActivity),
  }))
  const sessions: SessionRosterRow[] = []
  while (sessions.length < pageSize) {
    const next = queues.reduce<(typeof queues)[number] | undefined>((latest, source) => {
      const row = source.rows.at(0)
      const latestRow = latest?.rows.at(0)
      if (row === undefined) return latest
      if (latestRow === undefined || compareActivity(row, latestRow) < 0) return source
      return latest
    }, undefined)
    const row = next?.rows.shift()
    if (row === undefined) break
    sessions.push(row)
  }
  return {
    sessions,
    cursor: {
      sources: Object.fromEntries(
        queues.map((source) => [
          source.harness,
          { buffer: source.rows, cursor: source.nextCursor },
        ]),
      ),
    } satisfies UnifiedRosterCursor,
  }
}
