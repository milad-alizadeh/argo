import { useInfiniteQuery } from '@tanstack/react-query'
import { type RouterInputs, trpc, trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionListResult } from '../types'

export type SessionListInput = Required<
  Pick<RouterInputs['sessionList'], 'projectId' | 'filter' | 'search'>
> &
  Pick<RouterInputs['sessionList'], 'ticketKey'>

const PAGE_SIZE = 30

// Read page by page; `SessionChanges` reads the loaded pages again when main announces a change.
export function useSessionListQuery(input: SessionListInput, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...trpc.sessionList.pathKey(), input],
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    // A new search or filter keeps the Project's rows on screen until its first page lands.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey.at(-1) as SessionListInput | undefined)?.projectId ===
      input.projectId
        ? previous
        : undefined,
    initialPageParam: 0,
    getNextPageParam: (
      last: SessionListResult,
      _pages: SessionListResult[],
      lastPageParam: number,
    ) => {
      const next = lastPageParam + last.rows.length
      return last.rows.length > 0 && next < last.total ? next : undefined
    },
    queryFn: ({ pageParam }) =>
      trpcClient.sessionList.query({ ...input, offset: pageParam, limit: PAGE_SIZE }),
  })
}
