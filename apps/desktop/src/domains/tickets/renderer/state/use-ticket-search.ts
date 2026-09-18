import { useEffect, useState } from 'react'
import { create } from 'zustand'

// The sidebar's search field and the backlog it searches share one query.
type TicketSearchState = {
  open: boolean
  query: string
  setOpen: (open: boolean) => void
  setQuery: (query: string) => void
}

export const useTicketSearch = create<TicketSearchState>((set) => ({
  open: false,
  query: '',
  // Closing the field ends the search, so the backlog is never filtered by a query out of sight.
  setOpen: (open) => set(open ? { open } : { open, query: '' }),
  setQuery: (query) => set({ query }),
}))

// GitHub's search limit is 30 requests a minute, so a query is sent once typing pauses.
const SETTLE_MILLISECONDS = 300

export function useSettledQuery(): string {
  const query = useTicketSearch((state) => state.query).trim()
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), query === '' ? 0 : SETTLE_MILLISECONDS)
    return () => clearTimeout(timer)
  }, [query])
  return settled
}
