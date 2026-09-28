// Reads the selected Session Feed through its Harness history adapter.
import type { QueryClient, QueryKey, UseQueryOptions } from '@tanstack/react-query'
import { isTRPCClientError } from '@trpc/client'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { AppRouter } from '@/platform/main/trpc-router'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { SessionContractError, throwSessionContractError } from '../session-contract-error'
import { sessionFeedQueryKey } from '../session-queries'
import type { SessionFeedPage, SessionId } from '../types'

export async function retrySessionFeed(
  queryClient: QueryClient,
  queryKey: QueryKey,
  refetch: () => Promise<unknown>,
) {
  await queryClient.cancelQueries({ queryKey })
  await refetch()
}

export async function readSessionFeedPage(
  sessionId: SessionId,
  subagentId: string | null,
  before: string | null,
): Promise<SessionFeedPage> {
  try {
    return await trpcClient.sessionFeedRead.query({ sessionId, subagentId, before })
  } catch (error) {
    if (error instanceof SessionContractError) throw error
    const code = isTRPCClientError<AppRouter>(error) ? error.data?.code : null
    if (code === 'CONFLICT') throw new Error('expired-feed-cursor')
    throwSessionContractError(
      sessionError(code === 'NOT_FOUND' ? 'missing-session' : 'vendor-history-unavailable', null),
    )
  }
}

export function sessionFeedQuery(
  sessionId: SessionId | null,
  subagentId: string | null,
  enabled = true,
): UseQueryOptions<SessionFeedPage | null, SessionContractError> {
  const key =
    sessionId === null
      ? ['sessions', 'feed', null, subagentId]
      : sessionFeedQueryKey(sessionId, subagentId)
  if (sessionId === null) {
    return {
      queryKey: key,
      enabled: false,
      gcTime: 0,
      retry: false,
      queryFn: async () => null,
    }
  }
  return {
    queryKey: key,
    // A Feed belongs only to the active reader. Once its observer leaves on a Session switch,
    // React Query immediately drops the history and aborts its in-flight reader work. This
    // avoids an async manual cleanup that could race a rapid A -> B -> A switch.
    gcTime: 0,
    enabled,
    retry: false,
    queryFn: () => readSessionFeedPage(sessionId, subagentId, null),
  }
}
