import type { QueryClient } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'

export const sessionPermissionQueryKey = (sessionId: string) =>
  ['sessions', 'permission', sessionId] as const

const pendingSessionListInvalidations = new WeakMap<QueryClient, Promise<void>>()

export function invalidateSessionList(queryClient: QueryClient) {
  const pending = pendingSessionListInvalidations.get(queryClient)
  if (pending !== undefined) return pending
  const invalidation = Promise.resolve().then(() => {
    pendingSessionListInvalidations.delete(queryClient)
    return queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() })
  })
  pendingSessionListInvalidations.set(queryClient, invalidation)
  return invalidation
}
