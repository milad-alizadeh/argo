import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import { sessionListPathKey } from './session-list/session-list-query'
import type { SessionId, SessionListResult } from './types'

export const SESSION_REFRESH_MS = 500
// A chain's latest reading, written by its subscription and read by every observer. A Subagent's
// Feed is its own query, so opening one never displaces the Session's (#1582).
export const sessionFeedReadingQueryKey = (
  sessionId: SessionId | null,
  subagentId: string | null = null,
) => ['sessions', 'feed-reading', sessionId, subagentId] as const
// A Session's details by ID, written by its details subscription.
export const sessionDetailsPathKey = ['sessions', 'details'] as const
export const sessionDetailsQueryKey = (sessionId: SessionId | null) =>
  [...sessionDetailsPathKey, sessionId] as const
export const sessionSubagentUsageQueryKey = (sessionId: SessionId) =>
  ['sessions', 'delegation-usage', sessionId] as const
// Keyed on whether the command is still running too: the last poll of a running command can land
// before its final line is written, so the move to finished has to read once more (#1582).
export const sessionShellOutputQueryKey = (sessionId: SessionId, shellId: string, live = false) =>
  ['sessions', 'shell-output', sessionId, shellId, live] as const
export const sessionPermissionQueryKey = (sessionId: SessionId) =>
  ['sessions', 'permission', sessionId] as const

export function markSessionRead(
  queryClient: QueryClient,
  sessionId: SessionId,
  retiredIds: readonly SessionId[],
) {
  const identities = new Set([sessionId, ...retiredIds])
  queryClient.setQueriesData<InfiniteData<SessionListResult, number>>(
    { queryKey: sessionListPathKey },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          rows: page.rows.map((session) =>
            identities.has(session.id) || session.retiredIds.some((id) => identities.has(id))
              ? { ...session, unread: false }
              : session,
          ),
        })),
      },
  )
}
