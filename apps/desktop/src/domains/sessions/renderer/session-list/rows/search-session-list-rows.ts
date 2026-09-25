import type { SessionContractError } from '../../session-contract-error'
import type { Session } from '../../types'
import type { SessionListRow } from './session-list-rows'

export type SearchSessionListState = {
  sessions: readonly Session[]
  error: SessionContractError | null
  hasNextPage: boolean
  historyComplete: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
}

// A search's own rows (#2375): the query already scoped every match to the status filter, so
// there is no active/archived split to draw here the way the unscoped Session list and the on-demand
// Archive page need. Each matched row carries its own `archived` flag, stamped by the read.
export function searchSessionListRows(search: SearchSessionListState): SessionListRow[] {
  if (search.isLoading) return [{ kind: 'searchLoading' }]
  if (search.error !== null) return [{ kind: 'searchError', error: search.error }]
  if (search.sessions.length === 0) {
    return [search.historyComplete ? { kind: 'searchEmpty' } : { kind: 'searchIndexing' }]
  }
  const rows: SessionListRow[] = search.sessions.map((session) => ({
    kind: 'session',
    session,
    archived: session.archived === true,
  }))
  if (search.hasNextPage) rows.push({ kind: 'searchSentinel' })
  if (search.isFetchingNextPage) rows.push({ kind: 'searchLoadingMore' })
  if (!search.hasNextPage && !search.isFetchingNextPage && !search.historyComplete) {
    rows.push({ kind: 'searchIndexing' })
  }
  return rows
}
