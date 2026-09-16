import type { QueryClient } from '@tanstack/react-query'
import type { SessionId } from './types'

export const SESSION_REFRESH_MS = 500
// What a read that a watch tells about polls at anyway. The roster and the Feed are both read again
// when the transcript trees change (core/watch), so neither polls to notice a write. This is the
// fallback for a change no watch reports: a managed Session whose status moves without a transcript
// write, and a machine where the watch could not be opened at all.
export const WATCHED_FALLBACK_REFRESH_MS = 5_000
export const sessionRosterQueryKey = ['sessions', 'roster'] as const
// A Subagent's Feed is a document of its own, so it is its own query: switching between the
// Session's Feed and a Subagent's swaps documents rather than refetching one (#1582).
export const sessionFeedQueryKey = (sessionId: SessionId, delegationId: string | null = null) =>
  ['sessions', 'feed', sessionId, delegationId] as const
export const sessionDelegationUsageQueryKey = (sessionId: SessionId) =>
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

export function invalidateSessionRoster(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sessionRosterQueryKey })
}
