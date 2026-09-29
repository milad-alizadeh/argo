import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

const QUERY_PARAMETER = 'q'

export function useTicketSearch() {
  const [search, setSearch] = useSearchParams()
  const change = useCallback(
    (update: (next: URLSearchParams) => void) =>
      setSearch(
        (current) => {
          const next = new URLSearchParams(current)
          update(next)
          return next
        },
        { replace: true },
      ),
    [setSearch],
  )
  return {
    query: search.get(QUERY_PARAMETER) ?? '',
    setQuery: useCallback(
      (query: string) =>
        change((next) => {
          if (query === '') next.delete(QUERY_PARAMETER)
          else next.set(QUERY_PARAMETER, query)
        }),
      [change],
    ),
  }
}

// GitHub's search limit is 30 requests a minute, so a query is sent once typing pauses.
const SETTLE_MILLISECONDS = 300

export function useSettledQuery(): string {
  const query = useTicketSearch().query.trim()
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), query === '' ? 0 : SETTLE_MILLISECONDS)
    return () => clearTimeout(timer)
  }, [query])
  return settled
}
