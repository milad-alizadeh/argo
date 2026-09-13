import type { QueryClient } from '@tanstack/react-query'
import type { SessionId } from './types'

export const SESSION_REFRESH_MS = 500
export const sessionRosterQueryKey = ['sessions', 'roster'] as const
export const sessionFeedQueryKey = (sessionId: SessionId) =>
  ['sessions', 'feed', sessionId] as const
export const sessionPermissionQueryKey = (sessionId: SessionId) =>
  ['sessions', 'permission', sessionId] as const

export function invalidateSessionRoster(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sessionRosterQueryKey })
}
