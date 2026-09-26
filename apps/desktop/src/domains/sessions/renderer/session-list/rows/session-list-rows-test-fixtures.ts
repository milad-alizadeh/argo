import { SessionContractError } from '../../session-contract-error'
import type { Session } from '../../types'
import type { SessionListStatus } from '../hooks/use-session-list-filter-store'
import { sessionListRows } from './session-list-rows'

export const noArchive = {
  displayed: [] as Session[],
  error: null as SessionContractError | null,
  hasNextPage: false,
  historyComplete: true,
  isFetchingNextPage: false,
  isLoading: false,
}

export const someArchived = { ...noArchive, displayed: [{ id: 'archived-session' } as Session] }
export const loadingArchive = { ...noArchive, isLoading: true }
export const failedArchive = {
  ...noArchive,
  error: new SessionContractError({
    version: 1,
    type: 'session.error',
    requestId: 'test-archive-error',
    code: 'internal-error',
    message: 'read failed',
  }),
}
export const archiveWithMorePages = { ...someArchived, hasNextPage: true }
export const archiveFetchingMore = { ...someArchived, isFetchingNextPage: true }
export const archiveStillIndexing = { ...noArchive, historyComplete: false }
export const archivedSoFarStillIndexing = { ...someArchived, historyComplete: false }

export function activeSessionList(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `session-${index}` }) as Session)
}

export function kindsOf(options: {
  archived?: typeof noArchive
  hasMoreSessions?: boolean
  isFetchingMoreSessions?: boolean
  searching?: boolean
  showArchive?: boolean
  status?: SessionListStatus
}) {
  return sessionListRows({
    active: activeSessionList(2),
    archived: noArchive,
    hasMoreSessions: false,
    isFetchingMoreSessions: false,
    searching: false,
    showArchive: false,
    status: 'active',
    ...options,
  }).map((row) => row.kind)
}
