// Searching title and Session id across the complete indexed history (#2375), not just the rows a
// caller's Roster window has already loaded. Title/id search reads the same index background
// backfill (#2373) fills: where every source has one open, this reads it directly, exactly as
// `archive-reads.ts` resolves an id straight off the index rather than growing a window. Only
// where a source has no index does this fall back to growing the same bounded window the Roster
// and Archive already grow (`archive-window.ts`) and filtering the grown rows itself.

import type {
  RosterStatus,
  SessionSearchRequest,
} from '@/domains/sessions/contract/ipc/search-contract'
import { newestFirst, type SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { growWindow } from '../../archive/reads/archive-window'
import { isArchivedSession } from '../../archive/store/archive-store'
import { isSessionIndexFallback } from '../../indexing/session-index/recovery'
import { fromContext, type ReadContext } from '../../observation/reader/read-declaration'
import type { SessionSource } from '../../observation/reader/reader'
import { belongsToProject, projectRootsOf } from '../../project-scope/project-scope'
import { matchesSearchQuery } from './search-match'

export const SEARCH_PAGE_LIMIT = 20

async function searchDiscoveryWindow(source: SessionSource, query: string) {
  const window = await growWindow([source], {}, () => false)
  return {
    rows: window.rows.filter((row) => matchesSearchQuery(row, query)),
    historyComplete: true,
  }
}

// Search each source through its own capability; one missing capability must not grow every source.
async function searchSource(
  source: SessionSource,
  query: string,
): Promise<{ rows: SessionRosterRow[]; historyComplete: boolean }> {
  const search = source.searchSessions
  if (search === undefined) return searchDiscoveryWindow(source, query)
  try {
    const [rows, historyComplete] = await Promise.all([search(query), source.historyComplete?.()])
    return { rows, historyComplete: historyComplete ?? true }
  } catch (error) {
    if (!isSessionIndexFallback(error)) throw error
    return searchDiscoveryWindow(source, query)
  }
}

async function searchSources(sources: readonly SessionSource[], query: string) {
  const results = await Promise.all(sources.map((source) => searchSource(source, query)))
  return {
    rows: results.flatMap((result) => result.rows),
    historyComplete: results.every((result) => result.historyComplete),
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
    const result = await searchSources(context.sources, request.query)
    const found = scoped(result.rows, { status: request.status, archivedIds, projectRoots })
    const offset = decodeOffset(request.cursor)
    return {
      sessions: found.slice(offset, offset + SEARCH_PAGE_LIMIT),
      nextCursor:
        found.length > offset + SEARCH_PAGE_LIMIT ? String(offset + SEARCH_PAGE_LIMIT) : null,
      historyComplete: result.historyComplete,
    }
  },
)
