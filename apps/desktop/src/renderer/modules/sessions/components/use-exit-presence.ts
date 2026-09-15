import { useEffect, useState } from 'react'

// How long an attached card takes to collapse; `composer-content.css` animates it in the same time.
export const ATTACHMENT_EXIT_MS = 280

// Keeps the last value on screen while it collapses, so it leaves the tray the way it arrived.
export function useExitPresence<T>(value: T | null) {
  const [shown, setShown] = useState(value)
  if (value !== null && value !== shown) setShown(value)
  const exiting = value === null && shown !== null
  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => setShown(null), ATTACHMENT_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])
  return { exiting, shown }
}
