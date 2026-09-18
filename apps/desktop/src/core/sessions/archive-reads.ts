// The two archive operations (#1593, #2194, #2315). Argo owns the flag, so neither resolves an
// adapter: each reads every adapter's rows and joins them against Argo's own store. Both calls
// face the same problem, that the row they want can sit outside the window the Roster loads. Where
// every adapter's Session index is open, each resolves the ids it actually wants straight off the
// index's persisted resume graph (#2374) instead: no window to grow, and no transcript to open for
// a row the index already holds. Only when the index is absent, or still behind on an id it has
// not backfilled yet, does a reading fall back to growing the window (`archive-window.ts`) until
// it has what it needs.
import { z } from 'zod'
import { isArchivedSession } from './archive-store'
import { growWindow } from './archive-window'
import type { SessionArchiveListRequest, SessionArchiveSetRequest } from './contract'
import type { SessionRosterRow } from './models'
import { fromContext, type ReadContext } from './read-declaration'
import { rosterCursorMapSchema } from './roster-cursor'
import type { SessionSource } from './session-source'

// Every named id resolved off the index rather than a window, when every source has one open.
// `null` means at least one source has no index at all: the caller must grow a window instead.
async function indexedResolution(
  sources: readonly SessionSource[],
  ids: readonly string[],
): Promise<{ rows: SessionRosterRow[]; unresolvedIds: string[]; historyComplete: boolean } | null> {
  if (ids.length === 0) return { rows: [], unresolvedIds: [], historyComplete: true }
  if (sources.some((source) => source.resolveIndexedIds === undefined)) return null
  const resolved = await Promise.all(sources.map((source) => source.resolveIndexedIds?.(ids)))
  // Every source that carries `resolveIndexedIds` carries `historyComplete` too (both adapters
  // gate them on the same open index), so the guard above already proves this is defined.
  const completeness = await Promise.all(sources.map((source) => source.historyComplete?.()))
  const rows = resolved.flatMap((result) => result?.rows ?? [])
  const unresolvedIds = ids.filter((id) =>
    resolved.every((result) => result?.unresolvedIds.includes(id) ?? true),
  )
  return { rows, unresolvedIds, historyComplete: completeness.every(Boolean) }
}

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

function archivedIn(rows: readonly SessionRosterRow[], archivedIds: ReadonlySet<string>) {
  return rows
    .filter((row) => isArchivedSession(row, archivedIds))
    .map((row) => ({ ...row, archived: true }))
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
}

export const archiveListRead = fromContext(
  'session.archive.listed',
  async (context: ReadContext, request: SessionArchiveListRequest) => {
    const archivedIds = await context.archive.archivedIds()
    const { windows, offset } = decodeArchiveCursor(request.cursor)
    const idsToResolve =
      request.restoreId === null ? [...archivedIds] : [...archivedIds, request.restoreId]
    const indexed = await indexedResolution(context.sources, idsToResolve)
    // A restoreId the index has not resolved yet is not proved absent while backfill is still
    // running: falling through to the indexed branch here would answer `restored: null` for a
    // Session the mirror simply has not reached, rather than growing the window to find out.
    const restoreUnprovable =
      indexed !== null &&
      request.restoreId !== null &&
      !indexed.historyComplete &&
      indexed.unresolvedIds.includes(request.restoreId)
    if (indexed !== null && !restoreUnprovable) {
      const archived = archivedIn(indexed.rows, archivedIds)
      return {
        sessions: archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT),
        nextCursor:
          archived.length > offset + ARCHIVE_PAGE_LIMIT
            ? JSON.stringify({ windows: {}, offset: offset + ARCHIVE_PAGE_LIMIT })
            : null,
        restored: restoredIn(archived, request.restoreId),
        historyComplete: indexed.historyComplete,
      }
    }
    // No index open on some source: fall back to growing the same bounded window the Roster pages
    // by. Two reasons to keep growing: this page is not full yet, and a `restoreId` the caller
    // named is neither found nor yet proved absent.
    const window = await growWindow(context.sources, windows, (rows) => {
      const found = archivedIn(rows, archivedIds)
      if (found.length < offset + ARCHIVE_PAGE_LIMIT) return false
      return request.restoreId === null || restoredIn(found, request.restoreId) !== null
    })
    const archived = archivedIn(window.rows, archivedIds)
    const more = !window.exhausted || archived.length > offset + ARCHIVE_PAGE_LIMIT
    return {
      sessions: archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT),
      nextCursor: more
        ? JSON.stringify({ windows: window.windows, offset: offset + ARCHIVE_PAGE_LIMIT })
        : null,
      restored: restoredIn(archived, request.restoreId),
      historyComplete: true,
    }
  },
)

function answersTo(row: { id: string; retiredIds: readonly string[] }, id: string) {
  return row.id === id || row.retiredIds.includes(id)
}

// Every id each named Session has answered to, found under any of them: a caller holding an id
// the Session has since retired restores it just as one holding the current id does. A Session
// outside the loaded window resolves to itself alone, which is still the right key to remove: it
// is the one the caller archived under.
//
// The index resolves every id without growing a window (#2374). It falls back to one only while
// an id it could not resolve might simply not be backfilled yet (#2373): once every source's
// history is complete, an id the index still does not know really is answering to itself alone,
// exactly as an exhausted window would find.
async function everyIdAnsweredTo(
  sources: SessionSource[],
  sessionIds: readonly string[],
): Promise<string[]> {
  const indexed = await indexedResolution(sources, sessionIds)
  const stillIndexing =
    indexed !== null && indexed.unresolvedIds.length > 0 && !indexed.historyComplete
  const rows =
    indexed !== null && !stillIndexing
      ? indexed.rows
      : (
          await growWindow(sources, {}, (candidates) =>
            sessionIds.every((id) => candidates.some((row) => answersTo(row, id))),
          )
        ).rows
  return sessionIds.flatMap((id) => {
    const row = rows.find((candidate) => answersTo(candidate, id))
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
