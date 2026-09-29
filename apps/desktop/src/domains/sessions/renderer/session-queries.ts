import type { QueryClient } from '@tanstack/react-query'
import { type SessionRosterState, sessionRosterPathKey } from './session-list/session-roster'
import type { SessionId } from './types'

export const SESSION_REFRESH_MS = 500
// A chain's latest reading, written by its subscription and read by every observer. A Subagent's
// Feed is its own query, so opening one never displaces the Session's (#1582).
export const sessionFeedReadingQueryKey = (
  sessionId: SessionId | null,
  subagentId: string | null = null,
) => ['sessions', 'feed-reading', sessionId, subagentId] as const
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
export const sessionArchivePathKey = ['sessions', 'archive'] as const
export const sessionArchiveQueryKey = (restoreId: SessionId | null) =>
  [...sessionArchivePathKey, restoreId] as const

export function markSessionRead(
  queryClient: QueryClient,
  sessionId: SessionId,
  retiredIds: readonly SessionId[],
) {
  const identities = new Set([sessionId, ...retiredIds])
  queryClient.setQueriesData<SessionRosterState>({ queryKey: sessionRosterPathKey }, (roster) => {
    if (roster?.list == null) return roster
    return {
      ...roster,
      list: {
        ...roster.list,
        rows: roster.list.rows.map((session) =>
          identities.has(session.id) || session.retiredIds.some((id) => identities.has(id))
            ? { ...session, unread: false }
            : session,
        ),
      },
    }
  })
}
