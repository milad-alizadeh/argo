import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { sessionSearchQueryKey } from '../session-queries'
import type { RosterStatus } from '../state/use-roster-filter-store'
import type { SessionSearched } from '../types'

const SEARCH_DEBOUNCE_MS = 250

type SearchPage = Pick<SessionSearched, 'sessions' | 'nextCursor' | 'historyComplete'>

// The query text a search reads by, held back from every keystroke: a search only starts once a
// reader has paused on the text for a moment (#2375).
function useDebouncedQuery(query: string): string {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  return debounced
}

// Searching title and Session id across the complete indexed history (#2375), not just the rows
// the Roster's own window has already loaded. Scoped to the same Project and status filter the
// active Roster and Archive already read under. An empty query means no search is running: the
// caller shows the normal scoped Roster instead. A changed query, Project, or status is a
// different query key, so an in-flight reply for a query the reader has since changed away from
// lands in its own cache entry rather than overwriting the current one.
export function useSessionSearch(
  rawQuery: string,
  projectRoot: string | null,
  status: RosterStatus,
) {
  const query = useDebouncedQuery(rawQuery.trim())
  const enabled = query !== ''
  const searched = useInfiniteQuery<SearchPage, SessionContractError>({
    queryKey: sessionSearchQueryKey(projectRoot, status, query),
    enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      const reply = await window.argo.searchSessions({
        projectRoot,
        status,
        query,
        cursor: pageParam as string | null,
      })
      switch (reply.type) {
        case 'session.searched':
          return reply
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })

  const sessions = searched.data?.pages.flatMap((page) => page.sessions) ?? []
  // The most recently read page's word on it: backfill (#2373) can turn this true between one
  // fetch and the next, and only the latest read says where it stands right now.
  const historyComplete = searched.data?.pages.at(-1)?.historyComplete ?? true

  return {
    active: enabled,
    sessions,
    historyComplete,
    isLoading: enabled && searched.isPending,
    isFetchingNextPage: searched.isFetchingNextPage,
    hasNextPage: searched.hasNextPage,
    fetchNextPage: () => {
      if (searched.hasNextPage && !searched.isFetchingNextPage) void searched.fetchNextPage()
    },
    error: enabled ? searched.error : null,
  }
}
