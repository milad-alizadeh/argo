import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { RosterStatus } from '@/domains/sessions/renderer/model/roster-status'
import type { SessionId, SessionListPage } from './types'

export const SESSION_REFRESH_MS = 500
export const sessionListQueryKey = ['sessions', 'list'] as const
// A Subagent's Feed is a document of its own, so it is its own query: switching between the
// Session's Feed and a Subagent's swaps documents rather than refetching one (#1582).
export const sessionFeedQueryKey = (sessionId: SessionId, subagentId: string | null = null) =>
  ['sessions', 'feed', sessionId, subagentId] as const
export const sessionSubagentUsageQueryKey = (sessionId: SessionId) =>
  ['sessions', 'delegation-usage', sessionId] as const
// Keyed on whether the command is still running too: the last poll of a running command can land
// before its final line is written, so the move to finished has to read once more (#1582).
export const sessionShellOutputQueryKey = (sessionId: SessionId, shellId: string, live = false) =>
  ['sessions', 'shell-output', sessionId, shellId, live] as const
export const sessionPermissionQueryKey = (sessionId: SessionId) =>
  ['sessions', 'permission', sessionId] as const
// Keyed on the restoreId too: a different restoreId asks the reader to hand back a different row
// outside the loaded pages, so it is a different query rather than a refetch of the same one.
export const sessionArchiveQueryKey = (restoreId: SessionId | null) =>
  ['sessions', 'archive', restoreId] as const
// Keyed on everything that scopes a search's answer, so a changed Project, status filter or query
// text reads as a different query rather than a stale page of a different scope's results.
export const sessionSearchQueryKey = (
  projectRoot: string | null,
  status: RosterStatus,
  query: string,
) => ['sessions', 'search', projectRoot, status, query] as const

const pendingSessionListInvalidations = new WeakMap<QueryClient, Promise<void>>()

export function invalidateSessionList(queryClient: QueryClient) {
  const pending = pendingSessionListInvalidations.get(queryClient)
  if (pending !== undefined) return pending

  const invalidation = Promise.resolve().then(() => {
    pendingSessionListInvalidations.delete(queryClient)
    return queryClient.invalidateQueries({ queryKey: sessionListQueryKey })
  })
  pendingSessionListInvalidations.set(queryClient, invalidation)
  return invalidation
}

export function markSessionRead(
  queryClient: QueryClient,
  sessionId: SessionId,
  retiredIds: readonly SessionId[],
) {
  const identities = new Set([sessionId, ...retiredIds])
  queryClient.setQueriesData<InfiniteData<SessionListPage>>(
    { queryKey: sessionListQueryKey },
    (sessionList) => {
      if (sessionList === undefined) return sessionList
      return {
        ...sessionList,
        pages: sessionList.pages.map((page) => ({
          ...page,
          sessions: page.sessions.map((session) =>
            identities.has(session.id) || session.retiredIds.some((id) => identities.has(id))
              ? { ...session, unread: false }
              : session,
          ),
        })),
      }
    },
  )
}
