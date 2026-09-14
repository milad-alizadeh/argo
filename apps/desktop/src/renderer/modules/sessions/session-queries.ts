import type { QueryClient } from '@tanstack/react-query'
import type { SessionId } from './types'

export const SESSION_REFRESH_MS = 500
export const sessionRosterQueryKey = ['sessions', 'roster'] as const
export const sessionFeedQueryKey = (sessionId: SessionId) =>
  ['sessions', 'feed', sessionId] as const
export const sessionPermissionQueryKey = (sessionId: SessionId) =>
  ['sessions', 'permission', sessionId] as const
// Keyed on the restoreId too: a different restoreId asks the reader to hand back a different row
// outside the loaded pages, so it is a different query rather than a refetch of the same one.
export const sessionArchiveQueryKey = (restoreId: SessionId | null) =>
  ['sessions', 'archive', restoreId] as const

export function invalidateSessionRoster(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sessionRosterQueryKey })
}
