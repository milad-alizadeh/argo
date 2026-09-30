import { createContext } from 'react'
import type { FeedSubagent } from '@/domains/sessions/api/feed'

export type BackgroundWorkLinks = {
  // With what the row says of it, since a nested Subagent's row is all the Session has of it.
  open: (subagent: FeedSubagent) => void
}

// Set by the Session screen, so every Subagent row opens its own feed. A row outside a Session
// draws the same title as plain text.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)
