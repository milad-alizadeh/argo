import type { SessionRosterRow } from '@/core/sessions/models'
import type { SessionChain } from '../sessions/chains'
import {
  type CompactionMarker,
  readCompactionMarkers,
  removeCompactionMarker,
} from './compaction-markers'

// A compaction of a 200k-token context took 72 s; a marker this old is a Session killed mid-compaction.
const COMPACTION_PATIENCE_MS = 30 * 60_000

type Settle = {
  // Unset in a proof, which reads fixture transcripts and leaves the person's markers alone.
  markers: string | undefined
  readChain: (sessionId: string) => Promise<SessionChain | null>
  // A managed Session the marker names starts reading its own progress off the screen.
  begin?: (sessionId: string, startedAt: string) => void
}

// Claude Code writes nothing while it compacts, so the first record after the start ends it: the
// compact boundary, or a reply when the compaction was interrupted.
function endedSince(chain: SessionChain | null, startedAt: string) {
  return (chain?.files ?? [])
    .flatMap((file) => file.records)
    .some((record) => {
      if (record.kind === 'compaction') return (record.timestamp ?? '') >= startedAt
      if (record.kind !== 'message' || record.role !== 'assistant') return false
      return (record.timestamp ?? '') > startedAt
    })
}

function rowFor(rows: SessionRosterRow[], marker: CompactionMarker) {
  return rows.find(
    (row) => row.id === marker.sessionId || row.retiredIds.includes(marker.sessionId),
  )
}

async function liveStart(
  marker: CompactionMarker,
  row: SessionRosterRow | undefined,
  settle: Settle,
) {
  const expired = Date.now() - Date.parse(marker.startedAt) > COMPACTION_PATIENCE_MS
  if (
    expired ||
    (row !== undefined && endedSince(await settle.readChain(row.id), marker.startedAt))
  ) {
    await removeCompactionMarker(marker)
    return null
  }
  return row === undefined ? null : marker.startedAt
}

export async function markCompactingRows(
  rows: SessionRosterRow[],
  settle: Settle,
): Promise<SessionRosterRow[]> {
  if (settle.markers === undefined) return rows
  const markers = await readCompactionMarkers(settle.markers)
  if (markers.length === 0) return rows
  const started = new Map<string, string>()
  for (const marker of markers) {
    const row = rowFor(rows, marker)
    const startedAt = await liveStart(marker, row, settle)
    if (row === undefined || startedAt === null) continue
    settle.begin?.(row.id, startedAt)
    started.set(row.id, startedAt)
  }
  return rows.map((row) => {
    const startedAt = started.get(row.id)
    return startedAt === undefined
      ? row
      : { ...row, compactionStartedAt: row.compactionStartedAt ?? startedAt }
  })
}
