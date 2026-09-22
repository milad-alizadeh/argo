import type { SessionChain } from '@/domains/sessions/contract/model'
import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import {
  type CompactionStart,
  readCompactionStarts,
  removeCompactionStart,
} from './compaction-starts'

// A compaction of a 200k-token context took 72 s; one this old is a Session killed mid-compaction.
const COMPACTION_PATIENCE_MS = 30 * 60_000

type CompactionWatch = {
  folder: string | undefined
  readChain: (sessionId: string) => Promise<SessionChain | null>
  // A managed Session the start names reads its own progress off the screen.
  begin?: (sessionId: string, startedAt: string) => void
}

// Claude Code writes nothing while it compacts, so the first record after the start ends it: the
// compact boundary, or a message when the compaction was interrupted.
export function compactionEndedAt(chain: SessionChain | null, startedAt: string, now: number) {
  if (now - Date.parse(startedAt) > COMPACTION_PATIENCE_MS) return new Date(now).toISOString()
  return (chain?.files ?? [])
    .flatMap((file) => file.records)
    .flatMap((record) => {
      if (record.kind !== 'compaction' && record.kind !== 'message') return []
      const at = record.timestamp ?? ''
      const ends = record.kind === 'compaction' ? at >= startedAt : at > startedAt
      return ends ? [at] : []
    })
    .sort()
    .at(0)
}

function rowFor(rows: SessionRosterRow[], start: CompactionStart) {
  return rows.find((row) => row.id === start.sessionId || row.retiredIds.includes(start.sessionId))
}

async function liveStart(
  start: CompactionStart,
  row: SessionRosterRow | undefined,
  watch: CompactionWatch,
) {
  const chain = row === undefined ? null : await watch.readChain(row.id)
  if (compactionEndedAt(chain, start.startedAt, Date.now()) !== undefined) {
    await removeCompactionStart(start)
    return null
  }
  return row === undefined ? null : start.startedAt
}

export async function markCompactingRows(
  rows: SessionRosterRow[],
  watch: CompactionWatch,
): Promise<SessionRosterRow[]> {
  if (watch.folder === undefined) return rows
  const starts = await readCompactionStarts(watch.folder)
  if (starts.length === 0) return rows
  const started = new Map<string, string>()
  for (const start of starts) {
    const row = rowFor(rows, start)
    const startedAt = await liveStart(start, row, watch)
    if (row === undefined || startedAt === null) continue
    watch.begin?.(row.id, startedAt)
    started.set(row.id, startedAt)
  }
  return rows.map((row) => {
    const startedAt = started.get(row.id)
    return startedAt === undefined
      ? row
      : { ...row, compactionStartedAt: row.compactionStartedAt ?? startedAt }
  })
}
