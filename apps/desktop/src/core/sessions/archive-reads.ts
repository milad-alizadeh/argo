// The two archive operations (#1593, #2194, #2315). Argo owns the flag, so neither resolves an
// adapter: each reads every adapter's rows and joins them against Argo's own store. Both calls
// face the same problem, that the row they want can sit outside the window the Roster loads, so
// both grow that window (`archive-window.ts`) until the reading has what it needs.
import { z } from 'zod'
import { isArchivedSession } from './archive-store'
import { growWindow } from './archive-window'
import type { SessionArchiveListRequest, SessionArchiveSetRequest } from './contract'
import type { SessionRosterRow } from './models'
import { fromContext, type ReadContext } from './read-declaration'
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

export const archiveListRead = fromContext(
  'session.archive.listed',
  async (context: ReadContext, request: SessionArchiveListRequest) => {
    const archivedIds = await context.archive.archivedIds()
    const { windows, offset } = decodeArchiveCursor(request.cursor)
    const archivedIn = (rows: SessionRosterRow[]) =>
      rows
        .filter((row) => isArchivedSession(row, archivedIds))
        .map((row) => ({ ...row, archived: true }))
    // Two reasons to keep growing: this page is not full yet, and a `restoreId` the caller named
    // is neither found nor yet proved absent.
    const window = await growWindow(context.sources, windows, (rows) => {
      const found = archivedIn(rows)
      if (found.length < offset + ARCHIVE_PAGE_LIMIT) return false
      return request.restoreId === null || restoredIn(found, request.restoreId) !== null
    })
    const archived = archivedIn(window.rows)
    const more = !window.exhausted || archived.length > offset + ARCHIVE_PAGE_LIMIT
    return {
      sessions: archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT),
      nextCursor: more
        ? JSON.stringify({ windows: window.windows, offset: offset + ARCHIVE_PAGE_LIMIT })
        : null,
      restored: restoredIn(archived, request.restoreId),
    }
  },
)

// Every id each named Session has answered to. A Session outside the loaded window resolves to
// itself alone, which is still the right key to remove: it is the one the caller archived under.
async function everyIdAnsweredTo(
  sources: SessionSource[],
  sessionIds: readonly string[],
): Promise<string[]> {
  const found = (rows: { id: string }[]) =>
    sessionIds.every((id) => rows.some((row) => row.id === id))
  const { rows } = await growWindow(sources, {}, found)
  return sessionIds.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id)
    return row === undefined ? [id] : [row.id, ...row.retiredIds]
  })
}

// Argo owns the flag, so this writes its own store and needs no row in any other app's: a Session
// Argo has never discovered is archived under the id the caller named, and `failed` is a storage
// failure alone. Restoring has to reach every id the Session has answered to, because a Session
// archived before a resume is recorded under the id that was current then.
export const archiveSetWrite = fromContext(
  'session.archive.applied',
  async (context: ReadContext, request: SessionArchiveSetRequest) => {
    const { sessionIds, archived } = request
    // Archiving writes the id the caller holds, so it needs no lookup at all. Restoring does.
    const wrote = await context.archive.setArchived(
      archived ? sessionIds : await everyIdAnsweredTo(context.sources, sessionIds),
      archived,
    )
    return {
      archived,
      applied: wrote ? [...sessionIds] : [],
      failed: wrote ? [] : [...sessionIds],
    }
  },
)
