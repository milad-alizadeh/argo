import { useEffect, useState } from 'react'

const SEARCH_SETTLE_MS = 150

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
