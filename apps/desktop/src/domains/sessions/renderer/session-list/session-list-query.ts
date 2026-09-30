import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClient, type RouterInputs, trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionListResult } from '../types'

export type SessionListInput = Required<
  Pick<RouterInputs['sessionList'], 'projectId' | 'filter' | 'search'>
>

const PAGE_SIZE = 30

export const sessionListPathKey = ['sessions', 'list'] as const
export const sessionListQueryKey = (input: SessionListInput) =>
  [...sessionListPathKey, input] as const

// Main announces each saved change, and every loaded list reads its pages again.
export function useSessionListQuery(input: SessionListInput, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const subscription = trpcClient.sessionListChanged.subscribe(undefined, {
      onData: () => queryClient.invalidateQueries({ queryKey: sessionListPathKey }),
    })
    return () => subscription.unsubscribe()
  }, [enabled])
  return useInfiniteQuery({
    queryKey: sessionListQueryKey(input),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    // A new search or filter keeps the Project's rows on screen until its first page lands.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[sessionListPathKey.length] as SessionListInput | undefined)
        ?.projectId === input.projectId
        ? previous
        : undefined,
    initialPageParam: 0,
    getNextPageParam: (last: SessionListResult, pages: SessionListResult[]) => {
      const loaded = pages.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    queryFn: ({ pageParam }) =>
      trpcClient.sessionList.query({ ...input, offset: pageParam, limit: PAGE_SIZE }),
  })
}
