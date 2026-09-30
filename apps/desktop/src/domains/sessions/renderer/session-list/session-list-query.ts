import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { type RouterInputs, trpc, trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionListResult } from '../types'

export type SessionListInput = Required<
  Pick<RouterInputs['sessionList'], 'projectId' | 'filter' | 'search'>
> &
  Pick<RouterInputs['sessionList'], 'ticketKey'>

export type SessionListFilter = SessionListInput['filter']

const PAGE_SIZE = 30
const SEARCH_SETTLE_MS = 150

// The closed set of filters, each with the catalog key that names it to the reader.
export const FILTER_LABELS = {
  active: 'sessionListStatusActive',
  archived: 'sessionListStatusArchived',
  all: 'sessionListStatusAll',
} as const satisfies Record<SessionListFilter, string>

function isSessionListFilter(value: string | null): value is SessionListFilter {
  return value !== null && Object.hasOwn(FILTER_LABELS, value)
}

// Which Sessions the list shows, held in the URL's `status` parameter.
export function useSessionListFilter() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status')
  const filter: SessionListFilter = isSessionListFilter(status) ? status : 'active'
  const setFilter = (next: SessionListFilter) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === 'active') updated.delete('status')
      else updated.set('status', next)
      return updated
    })
  return [filter, setFilter] as const
}

// The search text once typing pauses; clearing the field applies at once.
export function useSettledSearch(search: string): string {
  const trimmed = search.trim()
  const [settled, setSettled] = useState(trimmed)
  useEffect(() => {
    if (trimmed === '') {
      setSettled('')
      return
    }
    const timer = setTimeout(() => setSettled(trimmed), SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [trimmed])
  return settled
}

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
