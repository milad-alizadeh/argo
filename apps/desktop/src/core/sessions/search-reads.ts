// Searching title and Session id across the complete indexed history (#2375), not just the rows a
// caller's Roster window has already loaded. Title/id search reads the same index background
// backfill (#2373) fills: where every source has one open, this reads it directly, exactly as
// `archive-reads.ts` resolves an id straight off the index rather than growing a window. Only
// where a source has no index does this fall back to growing the same bounded window the Roster
// and Archive already grow (`archive-window.ts`) and filtering the grown rows itself.
import { isArchivedSession } from '../storage/session-archive'
import { growWindow } from './archive-window'
import { newestFirst, type SessionRosterRow } from './models'
import { belongsToProject, projectRootsOf } from './project-scope'
import { fromContext, type ReadContext } from './read-declaration'
import type { RosterStatus, SessionSearchRequest } from './search-contract'
import { matchesSearchQuery } from './search-match'
import type { SessionSource } from './session-source'

export const SEARCH_PAGE_LIMIT = 20

// Every match across every source, when each has an index open. `null` means at least one source
// has none, so the caller must grow a window and filter it itself instead.
async function indexedSearch(
  sources: readonly SessionSource[],
  query: string,
): Promise<{ rows: SessionRosterRow[]; historyComplete: boolean } | null> {
  if (sources.some((source) => source.searchIndexed === undefined)) return null
  const [matched, completeness] = await Promise.all([
    Promise.all(sources.map((source) => source.searchIndexed?.(query))),
    Promise.all(sources.map((source) => source.historyComplete?.())),
  ])
  return {
    rows: matched.flatMap((rows) => rows ?? []),
    historyComplete: completeness.every(Boolean),
  }
}

// Status and Project scope, applied the same way the active Roster and Archive apply them, then
// newest-first (#1593, #2239).
function scoped(
  rows: readonly SessionRosterRow[],
  {
    status,
    archivedIds,
    projectRoots,
  }: {
    status: RosterStatus
    archivedIds: ReadonlySet<string>
    projectRoots: string[] | null
  },
): SessionRosterRow[] {
  return rows
    .filter((row) => belongsToProject(row.cwd, projectRoots))
    .flatMap((row) => {
      const archived = isArchivedSession(row, archivedIds)
      if (status === 'active' && archived) return []
      if (status === 'archived' && !archived) return []
      return [{ ...row, archived }]
    })
    .sort(newestFirst)
}

function decodeOffset(cursor: string | null): number {
  const parsed = cursor === null ? Number.NaN : Number.parseInt(cursor, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

export const searchRead = fromContext(
  'session.searched',
  async (context: ReadContext, request: SessionSearchRequest) => {
    const [archivedIds, projectRoots] = await Promise.all([
      context.archive.archivedIds(),
      projectRootsOf(request.projectRoot),
    ])
    const indexed = await indexedSearch(context.sources, request.query)
    const matched =
      indexed === null
        ? (await growWindow(context.sources, {}, () => false)).rows.filter((row) =>
            matchesSearchQuery(row, request.query),
          )
        : indexed.rows
    const found = scoped(matched, { status: request.status, archivedIds, projectRoots })
    const offset = decodeOffset(request.cursor)
    return {
      sessions: found.slice(offset, offset + SEARCH_PAGE_LIMIT),
      nextCursor:
        found.length > offset + SEARCH_PAGE_LIMIT ? String(offset + SEARCH_PAGE_LIMIT) : null,
      historyComplete: indexed?.historyComplete ?? true,
    }
  },
)
