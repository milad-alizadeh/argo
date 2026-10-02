import {
  type InfiniteData,
  matchQuery,
  notifyManager,
  type QueryClient,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { type Harness, parseHarness } from '@/harnesses/harness'
import { trpc } from '@/platform/renderer/trpc-client'
import type { SessionId, SessionListResult } from '../types'

type CachedList = { pages: readonly { rows: readonly { id: string; harness: string }[] }[] }

const SESSION_LISTS = { queryKey: trpc.sessionList.pathKey() }

// The Harness a loaded Session list row names for a Session, or null when no row names a known one.
export function listedSessionHarness(
  lists: readonly (CachedList | undefined)[],
  sessionId: string,
): Harness | null {
  for (const list of lists)
    for (const page of list?.pages ?? []) {
      const row = page.rows.find((candidate) => candidate.id === sessionId)
      if (row !== undefined) return parseHarness(row.harness)
    }
  return null
}

export function readListedSessionHarness(queryClient: QueryClient, sessionId: SessionId) {
  const lists = queryClient.getQueriesData<InfiniteData<SessionListResult>>(SESSION_LISTS)
  return listedSessionHarness(
    lists.map(([, list]) => list),
    sessionId,
  )
}

// Batched like TanStack's own `useIsFetching`, so no change lands while another component renders.
export function subscribeToSessionLists(queryClient: QueryClient, onChange: () => void) {
  return queryClient.getQueryCache().subscribe(
    notifyManager.batchCalls(({ query }) => {
      if (matchQuery(SESSION_LISTS, query)) onChange()
    }),
  )
}

// The Harness any loaded Session list names for a Session, read before its details load (#3172).
// It follows the query cache, so a list that lands after the Session opened still counts.
export function useListedSessionHarness(sessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToSessionLists(queryClient, onChange),
    [queryClient],
  )
  return useSyncExternalStore(subscribe, () =>
    sessionId === null ? null : readListedSessionHarness(queryClient, sessionId),
  )
}
