// The archived-Session page (#1593, #2315). Archiving is Argo's own, so this reads every
// adapter's rows and joins them against Argo's archive store: the page holds Sessions from every
// harness, ordered the way the active Roster orders them.
import { z } from 'zod'
import type { SessionArchiveStore } from './archive-store'
import { isArchivedSession } from './archive-store'
import { growWindow } from './archive-window'
import { sessionArchiveListRequestSchema, sessionError } from './contract'
import type { SessionRosterRow } from './models'
import { versionFailure } from './read-request'
import { rosterCursorMapSchema } from './roster-cursor'
import type { SessionSource } from './session-source'

// A page's worth of Archived Sessions, read on demand rather than on every poll (#1593).
export const ARCHIVE_PAGE_LIMIT = 20

// The cursor names both dimensions the page moves over: `windows`, the per-adapter window the
// rows were read from, and `offset`, how many archived rows earlier pages already returned.
// Encoded together so a caller only ever echoes what a reply gave it.
const archiveCursorSchema = z.object({
  windows: rosterCursorMapSchema,
  offset: z.number().int().nonnegative(),
})

type ArchiveCursor = z.infer<typeof archiveCursorSchema>

const FIRST_PAGE: ArchiveCursor = { windows: {}, offset: 0 }

function decodeArchiveCursor(cursor: string | null): ArchiveCursor {
  try {
    const parsed = archiveCursorSchema.safeParse(JSON.parse(cursor ?? ''))
    return parsed.success ? parsed.data : FIRST_PAGE
  } catch {
    return FIRST_PAGE
  }
}

function restoredIn(rows: SessionRosterRow[], restoreId: string | null) {
  if (restoreId === null) return null
  return rows.find((row) => row.id === restoreId || row.retiredIds.includes(restoreId)) ?? null
}

export async function archiveListReply(
  sources: SessionSource[],
  value: unknown,
  archive: SessionArchiveStore,
) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionArchiveListRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const { cursor, restoreId, requestId } = parsed.data
  const archivedIds = await archive.archivedIds()
  const { windows, offset } = decodeArchiveCursor(cursor)
  const archivedIn = (rows: SessionRosterRow[]) =>
    rows
      .filter((row) => isArchivedSession(row, archivedIds))
      .map((row) => ({ ...row, archived: true }))
  // Two reasons to keep growing: this page is not full yet, and a `restoreId` the caller named is
  // neither found nor yet proved absent.
  const window = await growWindow(sources, windows, (rows) => {
    const archived = archivedIn(rows)
    if (archived.length < offset + ARCHIVE_PAGE_LIMIT) return false
    return restoreId === null || restoredIn(archived, restoreId) !== null
  })
  const archived = archivedIn(window.rows)
  const more = !window.exhausted || archived.length > offset + ARCHIVE_PAGE_LIMIT
  return {
    version: 1 as const,
    type: 'session.archive.listed' as const,
    requestId,
    sessions: archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT),
    nextCursor: more
      ? JSON.stringify({ windows: window.windows, offset: offset + ARCHIVE_PAGE_LIMIT })
      : null,
    restored: restoredIn(archived, restoreId),
  }
}
